import type {
  Renderer,
  AnyRenderCommand,
  RectCommand,
  TextCommand,
  ImageCommand,
  BorderCommand,
  ClipCommand,
  OpacityCommand,
} from '../types';

// CanvasKit types (use 'any' to avoid complex type imports)
let CanvasKit: any = null;

export async function initCanvasKit(): Promise<void> {
  if (CanvasKit) return;
  const ckModule = await import('canvaskit-wasm');
  const initCK = ckModule.default;
  CanvasKit = await initCK();
}

export function getCanvasKit(): any {
  if (!CanvasKit) throw new Error('CanvasKit not initialized. Call initCanvasKit() first.');
  return CanvasKit;
}

export class CanvasKitRenderer implements Renderer {
  private surface: any;
  private canvas: any; // SkCanvas
  private htmlCanvas: HTMLCanvasElement;
  private dpr: number;
  private imageCache = new Map<string, any>(); // Map<string, SkImage>
  private onImageLoad: (() => void) | null = null;

  constructor(htmlCanvas: HTMLCanvasElement) {
    this.htmlCanvas = htmlCanvas;
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    const CK = getCanvasKit();

    // Set canvas buffer dimensions for HiDPI
    const rect = htmlCanvas.getBoundingClientRect();
    htmlCanvas.width = rect.width * this.dpr;
    htmlCanvas.height = rect.height * this.dpr;

    // Create WebGL surface
    this.surface = CK.MakeWebGLCanvasSurface(htmlCanvas);
    if (!this.surface) {
      // Fallback: try software surface
      this.surface = CK.MakeSWCanvasSurface(htmlCanvas);
    }
    if (!this.surface) {
      throw new Error('Failed to create CanvasKit surface');
    }

    this.canvas = this.surface.getCanvas();
    this.canvas.scale(this.dpr, this.dpr);
  }

  setOnImageLoad(callback: () => void): void {
    this.onImageLoad = callback;
  }

  clear(): void {
    const CK = getCanvasKit();
    this.canvas.clear(CK.WHITE);
  }

  render(commands: AnyRenderCommand[]): void {
    for (const cmd of commands) {
      switch (cmd.type) {
        case 'rect':
          this.drawRect(cmd);
          break;
        case 'text':
          this.drawText(cmd);
          break;
        case 'image':
          this.drawImage(cmd);
          break;
        case 'border':
          this.drawBorder(cmd);
          break;
        case 'clip':
          this.pushClip(cmd);
          break;
        case 'restore':
          this.popClip();
          break;
        case 'opacity':
          this.pushOpacity(cmd);
          break;
        case 'restoreOpacity':
          this.popOpacity();
          break;
      }
    }
    this.surface.flush();
  }

  getWidth(): number {
    return this.htmlCanvas.getBoundingClientRect().width;
  }

  getHeight(): number {
    return this.htmlCanvas.getBoundingClientRect().height;
  }

  measureText(
    text: string,
    fontSize: number,
    _fontFamily: string,
    _fontWeight: string,
  ): { width: number; height: number } {
    const CK = getCanvasKit();
    const font = new CK.Font(null, fontSize);
    const ids = font.getGlyphIDs(text);
    const widths = font.getGlyphWidths(ids);
    let totalWidth = 0;
    for (const w of widths) totalWidth += w;
    font.delete();
    return { width: totalWidth, height: fontSize * 1.2 };
  }

  dispose(): void {
    // Clean up image cache
    for (const img of this.imageCache.values()) {
      if (img && typeof img.delete === 'function') img.delete();
    }
    this.imageCache.clear();
    if (this.surface) {
      this.surface.delete();
      this.surface = null;
    }
  }

  // --- Drawing methods ---

  private drawRect(cmd: RectCommand): void {
    const CK = getCanvasKit();
    const paint = new CK.Paint();
    paint.setColor(CK.parseColorString(cmd.color));
    paint.setStyle(CK.PaintStyle.Fill);
    paint.setAntiAlias(true);

    if (cmd.borderRadius && this.hasNonZeroRadius(cmd.borderRadius)) {
      const radii = this.resolveRadii(cmd.borderRadius);
      const rrect = CK.RRectXY(
        CK.LTRBRect(cmd.x, cmd.y, cmd.x + cmd.width, cmd.y + cmd.height),
        radii[0],
        radii[0], // Simplified: use first radius for all corners
      );
      this.canvas.drawRRect(rrect, paint);
    } else {
      this.canvas.drawRect(CK.LTRBRect(cmd.x, cmd.y, cmd.x + cmd.width, cmd.y + cmd.height), paint);
    }

    paint.delete();
  }

  private drawText(cmd: TextCommand): void {
    const CK = getCanvasKit();
    const paint = new CK.Paint();
    paint.setColor(CK.parseColorString(cmd.color));
    paint.setAntiAlias(true);

    const font = new CK.Font(null, cmd.fontSize);

    const lineHeight = cmd.lineHeight ?? cmd.fontSize * 1.2;

    // Simple word wrapping
    const words = cmd.text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const ids = font.getGlyphIDs(testLine);
      const widths = font.getGlyphWidths(ids);
      let testWidth = 0;
      for (const w of widths) testWidth += w;
      if (testWidth > cmd.width && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Draw each line
    for (let i = 0; i < lines.length; i++) {
      let textX = cmd.x;
      if (cmd.textAlign === 'center') {
        const ids = font.getGlyphIDs(lines[i]);
        const widths = font.getGlyphWidths(ids);
        let lineWidth = 0;
        for (const w of widths) lineWidth += w;
        textX = cmd.x + (cmd.width - lineWidth) / 2;
      } else if (cmd.textAlign === 'right') {
        const ids = font.getGlyphIDs(lines[i]);
        const widths = font.getGlyphWidths(ids);
        let lineWidth = 0;
        for (const w of widths) lineWidth += w;
        textX = cmd.x + cmd.width - lineWidth;
      }

      // CanvasKit drawText uses baseline, adjust Y for vertical centering
      const baselineY = cmd.y + i * lineHeight + lineHeight / 2 + cmd.fontSize * 0.35;
      this.canvas.drawText(lines[i], textX, baselineY, paint, font);
    }

    font.delete();
    paint.delete();
  }

  private drawImage(cmd: ImageCommand): void {
    const img = this.getCachedImage(cmd.src);
    if (!img) return;

    const CK = getCanvasKit();

    if (cmd.borderRadius && cmd.borderRadius > 0) {
      this.canvas.save();
      const rrect = CK.RRectXY(
        CK.LTRBRect(cmd.x, cmd.y, cmd.x + cmd.width, cmd.y + cmd.height),
        cmd.borderRadius,
        cmd.borderRadius,
      );
      this.canvas.clipRRect(rrect, CK.ClipOp.Intersect, true);
      this.canvas.drawImageRect(
        img,
        CK.LTRBRect(0, 0, img.width(), img.height()),
        CK.LTRBRect(cmd.x, cmd.y, cmd.x + cmd.width, cmd.y + cmd.height),
        null,
      );
      this.canvas.restore();
    } else {
      this.canvas.drawImageRect(
        img,
        CK.LTRBRect(0, 0, img.width(), img.height()),
        CK.LTRBRect(cmd.x, cmd.y, cmd.x + cmd.width, cmd.y + cmd.height),
        null,
      );
    }
  }

  private drawBorder(cmd: BorderCommand): void {
    const CK = getCanvasKit();
    const [topW, rightW, bottomW, leftW] = cmd.widths;
    const [topC, rightC, bottomC, leftC] = cmd.colors;

    const drawLine = (x1: number, y1: number, x2: number, y2: number, width: number, color: string) => {
      if (width <= 0 || color === 'transparent') return;
      const paint = new CK.Paint();
      paint.setColor(CK.parseColorString(color));
      paint.setStyle(CK.PaintStyle.Stroke);
      paint.setStrokeWidth(width);
      paint.setAntiAlias(true);
      this.canvas.drawLine(x1, y1, x2, y2, paint);
      paint.delete();
    };

    drawLine(cmd.x, cmd.y + topW / 2, cmd.x + cmd.width, cmd.y + topW / 2, topW, topC);
    drawLine(cmd.x + cmd.width - rightW / 2, cmd.y, cmd.x + cmd.width - rightW / 2, cmd.y + cmd.height, rightW, rightC);
    drawLine(cmd.x, cmd.y + cmd.height - bottomW / 2, cmd.x + cmd.width, cmd.y + cmd.height - bottomW / 2, bottomW, bottomC);
    drawLine(cmd.x + leftW / 2, cmd.y, cmd.x + leftW / 2, cmd.y + cmd.height, leftW, leftC);
  }

  private pushClip(cmd: ClipCommand): void {
    const CK = getCanvasKit();
    this.canvas.save();
    if (cmd.borderRadius && this.hasNonZeroRadius(cmd.borderRadius)) {
      const radii = this.resolveRadii(cmd.borderRadius);
      const rrect = CK.RRectXY(
        CK.LTRBRect(cmd.x, cmd.y, cmd.x + cmd.width, cmd.y + cmd.height),
        radii[0],
        radii[0],
      );
      this.canvas.clipRRect(rrect, CK.ClipOp.Intersect, true);
    } else {
      this.canvas.clipRect(
        CK.LTRBRect(cmd.x, cmd.y, cmd.x + cmd.width, cmd.y + cmd.height),
        CK.ClipOp.Intersect,
        true,
      );
    }
  }

  private popClip(): void {
    this.canvas.restore();
  }

  private pushOpacity(cmd: OpacityCommand): void {
    const CK = getCanvasKit();
    this.canvas.save();
    const layerPaint = new CK.Paint();
    layerPaint.setAlphaf(cmd.opacity);
    this.canvas.saveLayer(layerPaint);
    layerPaint.delete();
  }

  private popOpacity(): void {
    this.canvas.restore(); // restore saveLayer
    this.canvas.restore(); // restore save
  }

  private hasNonZeroRadius(radius: number | [number, number, number, number]): boolean {
    if (typeof radius === 'number') return radius > 0;
    return radius[0] > 0 || radius[1] > 0 || radius[2] > 0 || radius[3] > 0;
  }

  private resolveRadii(radius: number | [number, number, number, number]): [number, number, number, number] {
    if (typeof radius === 'number') return [radius, radius, radius, radius];
    return radius;
  }

  private getCachedImage(src: string): any | null {
    if (this.imageCache.has(src)) {
      return this.imageCache.get(src);
    }
    // Async image loading
    if (typeof fetch !== 'undefined') {
      fetch(src)
        .then((res) => res.arrayBuffer())
        .then((data) => {
          const CK = getCanvasKit();
          const img = CK.MakeImageFromEncoded(new Uint8Array(data));
          if (img) {
            this.imageCache.set(src, img);
            if (this.onImageLoad) this.onImageLoad();
          }
        })
        .catch(() => {});
    }
    return null;
  }
}
