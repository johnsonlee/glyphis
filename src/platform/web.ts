import type { Platform, RenderCommand, InputEvent } from '../types';

export function createWebPlatform(canvas: HTMLCanvasElement): Platform {
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  let inputCallback: ((event: InputEvent) => void) | null = null;

  function canvasCoords(e: PointerEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (inputCallback) inputCallback({ type: 'pointerdown', ...canvasCoords(e) });
  });
  canvas.addEventListener('pointerup', (e) => {
    if (inputCallback) inputCallback({ type: 'pointerup', ...canvasCoords(e) });
  });
  canvas.addEventListener('pointermove', (e) => {
    if (inputCallback) inputCallback({ type: 'pointermove', ...canvasCoords(e) });
  });

  var imageCache: Map<string, HTMLImageElement> = new Map();
  var imageLoadCallback: ((id: string, w: number, h: number) => void) | null = null;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;

  return {
    measureText(text: string, fontSize: number, fontFamily?: string, fontWeight?: string): { width: number; height: number } {
      const family = fontFamily || 'system-ui, -apple-system, sans-serif';
      const weight = fontWeight || '400';
      measureCtx.font = `${weight} ${fontSize}px ${family}`;
      const metrics = measureCtx.measureText(text);
      const height = fontSize * 1.2;
      return { width: metrics.width, height };
    },

    render(commands: RenderCommand[]): void {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      for (const cmd of commands) {
        switch (cmd.type) {
          case 'rect':
            drawRect(ctx, cmd);
            break;
          case 'text':
            drawText(ctx, cmd);
            break;
          case 'border':
            drawBorder(ctx, cmd);
            break;
          case 'image':
            drawImage(ctx, cmd, imageCache);
            break;
          case 'clip-start':
            ctx.save();
            clipRegion(ctx, cmd);
            break;
          case 'clip-end':
            ctx.restore();
            break;
        }
      }
    },

    getViewport(): { width: number; height: number } {
      return { width: rect.width, height: rect.height };
    },

    onInput(callback: (event: InputEvent) => void): void {
      inputCallback = callback;
    },

    loadImage(imageId: string, url: string): void {
      if (imageCache.has(imageId)) {
        var cached = imageCache.get(imageId)!;
        if (imageLoadCallback) imageLoadCallback(imageId, cached.naturalWidth, cached.naturalHeight);
        return;
      }
      var img = new (globalThis as any).Image() as HTMLImageElement;
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        imageCache.set(imageId, img);
        if (imageLoadCallback) imageLoadCallback(imageId, img.naturalWidth, img.naturalHeight);
      };
      img.onerror = function() {
        // Silent fail for v1
      };
      img.src = url;
    },

    onImageLoaded(callback: (id: string, w: number, h: number) => void): void {
      imageLoadCallback = callback;
    },
  };
}

function drawRect(ctx: CanvasRenderingContext2D, cmd: Extract<RenderCommand, { type: 'rect' }>): void {
  ctx.save();
  if (cmd.opacity !== undefined) ctx.globalAlpha = cmd.opacity;
  ctx.fillStyle = cmd.color;
  if (cmd.borderRadius) {
    roundRect(ctx, cmd.x, cmd.y, cmd.width, cmd.height, cmd.borderRadius);
    ctx.fill();
  } else {
    ctx.fillRect(cmd.x, cmd.y, cmd.width, cmd.height);
  }
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, cmd: Extract<RenderCommand, { type: 'text' }>): void {
  ctx.save();
  if (cmd.opacity !== undefined) ctx.globalAlpha = cmd.opacity;
  const family = cmd.fontFamily || 'system-ui, -apple-system, sans-serif';
  const weight = cmd.fontWeight || '400';
  ctx.font = `${weight} ${cmd.fontSize}px ${family}`;
  ctx.fillStyle = cmd.color;
  ctx.textBaseline = 'top';

  let x = cmd.x;
  if (cmd.textAlign === 'center' && cmd.maxWidth) {
    x = cmd.x + cmd.maxWidth / 2;
    ctx.textAlign = 'center';
  } else if (cmd.textAlign === 'right' && cmd.maxWidth) {
    x = cmd.x + cmd.maxWidth;
    ctx.textAlign = 'right';
  } else {
    ctx.textAlign = 'left';
  }

  ctx.fillText(cmd.text, x, cmd.y);
  ctx.restore();
}

function drawBorder(ctx: CanvasRenderingContext2D, cmd: Extract<RenderCommand, { type: 'border' }>): void {
  ctx.save();
  if (cmd.opacity !== undefined) ctx.globalAlpha = cmd.opacity;
  ctx.strokeStyle = cmd.color;
  const avgWidth = (cmd.widths[0] + cmd.widths[1] + cmd.widths[2] + cmd.widths[3]) / 4;
  ctx.lineWidth = avgWidth;
  const half = avgWidth / 2;
  if (cmd.borderRadius) {
    roundRect(ctx, cmd.x + half, cmd.y + half, cmd.width - avgWidth, cmd.height - avgWidth, cmd.borderRadius);
    ctx.stroke();
  } else {
    ctx.strokeRect(cmd.x + half, cmd.y + half, cmd.width - avgWidth, cmd.height - avgWidth);
  }
  ctx.restore();
}

function clipRegion(ctx: CanvasRenderingContext2D, cmd: Extract<RenderCommand, { type: 'clip-start' }>): void {
  ctx.beginPath();
  if (cmd.borderRadius) {
    roundRect(ctx, cmd.x, cmd.y, cmd.width, cmd.height, cmd.borderRadius);
  } else {
    ctx.rect(cmd.x, cmd.y, cmd.width, cmd.height);
  }
  ctx.clip();
}

function drawImage(ctx: CanvasRenderingContext2D, cmd: Extract<RenderCommand, { type: 'image' }>, cache: Map<string, HTMLImageElement>): void {
  var img = cache.get(cmd.imageId);
  if (!img) return;

  ctx.save();
  if (cmd.opacity != null) ctx.globalAlpha = cmd.opacity;

  // Clip for borderRadius
  if (cmd.borderRadius) {
    roundRect(ctx, cmd.x, cmd.y, cmd.width, cmd.height, cmd.borderRadius);
    ctx.clip();
  }

  var imgW = img.naturalWidth;
  var imgH = img.naturalHeight;
  var scale: number;
  var dw: number;
  var dh: number;
  var dx: number;
  var dy: number;

  if (cmd.resizeMode === 'stretch') {
    ctx.drawImage(img, cmd.x, cmd.y, cmd.width, cmd.height);
  } else if (cmd.resizeMode === 'contain') {
    scale = Math.min(cmd.width / imgW, cmd.height / imgH);
    dw = imgW * scale;
    dh = imgH * scale;
    dx = cmd.x + (cmd.width - dw) / 2;
    dy = cmd.y + (cmd.height - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    // cover (default)
    scale = Math.max(cmd.width / imgW, cmd.height / imgH);
    dw = imgW * scale;
    dh = imgH * scale;
    dx = cmd.x + (cmd.width - dw) / 2;
    dy = cmd.y + (cmd.height - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
