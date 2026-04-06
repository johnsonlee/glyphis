import type { Platform, RenderCommand, InputEvent, TextInputConfig, SemanticsNode } from '../types';

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

  var textInputElements: Map<string, HTMLInputElement | HTMLTextAreaElement> = new Map();
  var ariaContainer: HTMLDivElement | null = null;
  var ariaElements: Map<number, HTMLDivElement> = new Map();

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

    showTextInput(config: TextInputConfig): void {
      var existing = textInputElements.get(config.inputId);
      if (existing) {
        existing.focus();
        return;
      }

      var el: HTMLInputElement | HTMLTextAreaElement;
      if (config.multiline) {
        el = document.createElement('textarea');
      } else {
        el = document.createElement('input');
        (el as HTMLInputElement).type = config.secureTextEntry ? 'password' : 'text';
      }

      el.value = config.value;
      el.placeholder = config.placeholder;
      el.style.position = 'absolute';
      el.style.left = config.x + 'px';
      el.style.top = config.y + 'px';
      el.style.width = config.width + 'px';
      el.style.height = config.height + 'px';
      el.style.fontSize = config.fontSize + 'px';
      el.style.color = config.color;
      el.style.border = 'none';
      el.style.outline = 'none';
      el.style.background = 'transparent';
      el.style.padding = '8px';
      el.style.margin = '0';
      el.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      el.style.boxSizing = 'border-box';
      el.style.zIndex = '10';
      if (config.maxLength > 0) el.maxLength = config.maxLength;

      switch (config.keyboardType) {
        case 'number-pad': el.inputMode = 'numeric'; break;
        case 'decimal-pad': el.inputMode = 'decimal'; break;
        case 'email-address': el.inputMode = 'email'; break;
        default: el.inputMode = 'text';
      }

      var capturedInputId = config.inputId;
      var capturedMultiline = config.multiline;

      el.addEventListener('input', function() {
        if (inputCallback) inputCallback({ type: 'textchange', inputId: capturedInputId, text: el.value });
      });
      el.addEventListener('focus', function() {
        if (inputCallback) inputCallback({ type: 'textfocus', inputId: capturedInputId });
      });
      el.addEventListener('blur', function() {
        if (inputCallback) inputCallback({ type: 'textblur', inputId: capturedInputId });
      });
      el.addEventListener('keydown', function(e: KeyboardEvent) {
        if (e.key === 'Enter' && !capturedMultiline) {
          if (inputCallback) inputCallback({ type: 'textsubmit', inputId: capturedInputId });
        }
      });

      // Position relative to canvas
      if (canvas.parentElement) {
        canvas.parentElement.style.position = 'relative';
        canvas.parentElement.appendChild(el);
      }
      textInputElements.set(config.inputId, el);
      el.focus();
    },

    updateTextInput(inputId: string, config: Partial<TextInputConfig>): void {
      var el = textInputElements.get(inputId);
      if (!el) return;
      if (config.x != null) el.style.left = config.x + 'px';
      if (config.y != null) el.style.top = config.y + 'px';
      if (config.width != null) el.style.width = config.width + 'px';
      if (config.height != null) el.style.height = config.height + 'px';
      if (config.value != null) el.value = config.value;
    },

    hideTextInput(inputId: string): void {
      var el = textInputElements.get(inputId);
      if (el) {
        el.blur();
        if (el.parentElement) el.parentElement.removeChild(el);
        textInputElements.delete(inputId);
      }
    },

    submitAccessibilityTree(nodes: SemanticsNode[]): void {
      if (!ariaContainer) {
        ariaContainer = document.createElement('div');
        ariaContainer.style.position = 'absolute';
        ariaContainer.style.top = '0';
        ariaContainer.style.left = '0';
        ariaContainer.style.width = '100%';
        ariaContainer.style.height = '100%';
        ariaContainer.style.pointerEvents = 'none';
        ariaContainer.setAttribute('aria-hidden', 'false');
        if (canvas.parentElement) {
          canvas.parentElement.style.position = 'relative';
          canvas.parentElement.appendChild(ariaContainer);
        }
      }

      // Track which IDs are in the new tree
      var activeIds = new Set<number>();

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        activeIds.add(node.id);

        var el = ariaElements.get(node.id);
        if (!el) {
          el = document.createElement('div');
          el.style.position = 'absolute';
          el.style.overflow = 'hidden';
          // Visually hidden but accessible to screen readers
          el.style.opacity = '0';
          el.style.fontSize = '1px';
          el.tabIndex = -1;
          if (ariaContainer) ariaContainer.appendChild(el);
          ariaElements.set(node.id, el);
        }

        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
        el.style.width = node.width + 'px';
        el.style.height = node.height + 'px';
        el.setAttribute('role', node.role === 'none' ? 'presentation' : node.role);
        el.setAttribute('aria-label', node.label);
        if (node.hint) {
          el.setAttribute('aria-roledescription', node.hint);
        } else {
          el.removeAttribute('aria-roledescription');
        }

        if (node.actions.indexOf('activate') >= 0) {
          el.style.pointerEvents = 'auto';
          el.style.cursor = 'pointer';
          el.tabIndex = 0;
          // Only bind events once
          if (!el.dataset.bound) {
            el.dataset.bound = '1';
            var capturedNodeId = node.id;
            el.addEventListener('click', function() {
              if (inputCallback) inputCallback({ type: 'accessibilityaction', nodeId: capturedNodeId, action: 'activate' });
            });
            el.addEventListener('keydown', function(e) {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (inputCallback) inputCallback({ type: 'accessibilityaction', nodeId: capturedNodeId, action: 'activate' });
              }
            });
          }
        }
      }

      // Remove elements not in new tree
      var idsToRemove: number[] = [];
      ariaElements.forEach(function(el, id) {
        if (!activeIds.has(id)) {
          if (el.parentElement) el.parentElement.removeChild(el);
          idsToRemove.push(id);
        }
      });
      for (var j = 0; j < idsToRemove.length; j++) {
        ariaElements.delete(idsToRemove[j]);
      }
    },

    onAccessibilityAction(callback: (nodeId: number, action: string) => void): void {
      // Accessibility actions are routed through the inputCallback mechanism
      // via the submitAccessibilityTree overlay click/keydown handlers
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
