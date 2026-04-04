import type {
  Renderer,
  AnyRenderCommand,
  RectCommand,
  TextCommand,
  ImageCommand,
  BorderCommand,
  ClipCommand,
  OpacityCommand,
} from './types';

export class CanvasRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private dpr: number;
  private imageCache = new Map<string, HTMLImageElement>();
  private onImageLoad: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.setupHiDPI();
  }

  setOnImageLoad(callback: () => void): void {
    this.onImageLoad = callback;
  }

  private setupHiDPI(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
  }

  clear(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
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
  }

  getWidth(): number {
    return this.canvas.getBoundingClientRect().width;
  }

  getHeight(): number {
    return this.canvas.getBoundingClientRect().height;
  }

  measureText(
    text: string,
    fontSize: number,
    fontFamily: string,
    fontWeight: string,
  ): { width: number; height: number } {
    this.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const metrics = this.ctx.measureText(text);
    return {
      width: metrics.width,
      height: fontSize * 1.2,
    };
  }

  private drawRect(cmd: RectCommand): void {
    this.ctx.fillStyle = cmd.color;
    if (cmd.borderRadius && this.hasNonZeroRadius(cmd.borderRadius)) {
      this.ctx.beginPath();
      this.roundRectPath(cmd.x, cmd.y, cmd.width, cmd.height, cmd.borderRadius);
      this.ctx.fill();
    } else {
      this.ctx.fillRect(cmd.x, cmd.y, cmd.width, cmd.height);
    }
  }

  private drawText(cmd: TextCommand): void {
    this.ctx.fillStyle = cmd.color;
    this.ctx.font = `${cmd.fontWeight} ${cmd.fontSize}px ${cmd.fontFamily}`;
    this.ctx.textAlign = cmd.textAlign as CanvasTextAlign;
    this.ctx.textBaseline = 'middle';

    const lineHeight = cmd.lineHeight ?? cmd.fontSize * 1.2;
    const words = cmd.text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = this.ctx.measureText(testLine);
      if (metrics.width > cmd.width && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    let textX = cmd.x;
    if (cmd.textAlign === 'center') {
      textX = cmd.x + cmd.width / 2;
    } else if (cmd.textAlign === 'right') {
      textX = cmd.x + cmd.width;
    }

    for (let i = 0; i < lines.length; i++) {
      this.ctx.fillText(lines[i], textX, cmd.y + i * lineHeight + lineHeight / 2);
    }
  }

  private drawImage(cmd: ImageCommand): void {
    const img = this.getImage(cmd.src);
    if (!img) return;

    if (cmd.borderRadius && cmd.borderRadius > 0) {
      this.ctx.save();
      this.ctx.beginPath();
      this.roundRectPath(cmd.x, cmd.y, cmd.width, cmd.height, cmd.borderRadius);
      this.ctx.clip();
      this.ctx.drawImage(img, cmd.x, cmd.y, cmd.width, cmd.height);
      this.ctx.restore();
    } else {
      this.ctx.drawImage(img, cmd.x, cmd.y, cmd.width, cmd.height);
    }
  }

  private drawBorder(cmd: BorderCommand): void {
    const [topW, rightW, bottomW, leftW] = cmd.widths;
    const [topC, rightC, bottomC, leftC] = cmd.colors;
    const x = cmd.x;
    const y = cmd.y;
    const w = cmd.width;
    const h = cmd.height;

    if (topW > 0 && topC !== 'transparent') {
      this.ctx.strokeStyle = topC;
      this.ctx.lineWidth = topW;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y + topW / 2);
      this.ctx.lineTo(x + w, y + topW / 2);
      this.ctx.stroke();
    }

    if (rightW > 0 && rightC !== 'transparent') {
      this.ctx.strokeStyle = rightC;
      this.ctx.lineWidth = rightW;
      this.ctx.beginPath();
      this.ctx.moveTo(x + w - rightW / 2, y);
      this.ctx.lineTo(x + w - rightW / 2, y + h);
      this.ctx.stroke();
    }

    if (bottomW > 0 && bottomC !== 'transparent') {
      this.ctx.strokeStyle = bottomC;
      this.ctx.lineWidth = bottomW;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y + h - bottomW / 2);
      this.ctx.lineTo(x + w, y + h - bottomW / 2);
      this.ctx.stroke();
    }

    if (leftW > 0 && leftC !== 'transparent') {
      this.ctx.strokeStyle = leftC;
      this.ctx.lineWidth = leftW;
      this.ctx.beginPath();
      this.ctx.moveTo(x + leftW / 2, y);
      this.ctx.lineTo(x + leftW / 2, y + h);
      this.ctx.stroke();
    }
  }

  private pushClip(cmd: ClipCommand): void {
    this.ctx.save();
    this.ctx.beginPath();
    if (cmd.borderRadius && this.hasNonZeroRadius(cmd.borderRadius)) {
      this.roundRectPath(cmd.x, cmd.y, cmd.width, cmd.height, cmd.borderRadius);
    } else {
      this.ctx.rect(cmd.x, cmd.y, cmd.width, cmd.height);
    }
    this.ctx.clip();
  }

  private popClip(): void {
    this.ctx.restore();
  }

  private pushOpacity(cmd: OpacityCommand): void {
    this.ctx.save();
    this.ctx.globalAlpha *= cmd.opacity;
  }

  private popOpacity(): void {
    this.ctx.restore();
  }

  private hasNonZeroRadius(radius: number | [number, number, number, number]): boolean {
    if (typeof radius === 'number') return radius > 0;
    return radius[0] > 0 || radius[1] > 0 || radius[2] > 0 || radius[3] > 0;
  }

  private roundRectPath(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number | [number, number, number, number],
  ): void {
    const [tl, tr, br, bl] = typeof radius === 'number'
      ? [radius, radius, radius, radius]
      : radius;

    this.ctx.moveTo(x + tl, y);
    this.ctx.lineTo(x + w - tr, y);
    this.ctx.arcTo(x + w, y, x + w, y + tr, tr);
    this.ctx.lineTo(x + w, y + h - br);
    this.ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    this.ctx.lineTo(x + bl, y + h);
    this.ctx.arcTo(x, y + h, x, y + h - bl, bl);
    this.ctx.lineTo(x, y + tl);
    this.ctx.arcTo(x, y, x + tl, y, tl);
    this.ctx.closePath();
  }

  private getImage(src: string): HTMLImageElement | null {
    if (this.imageCache.has(src)) {
      const img = this.imageCache.get(src)!;
      return img.complete ? img : null;
    }
    const img = new Image();
    img.onload = () => {
      if (this.onImageLoad) {
        this.onImageLoad();
      }
    };
    img.src = src;
    this.imageCache.set(src, img);
    return null;
  }
}
