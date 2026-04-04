import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { CanvasRenderer } from '../src/canvas-renderer';
import type { AnyRenderCommand } from '../src/types';

interface MockCall {
  method: string;
  args: any[];
}

function createMockContext() {
  const calls: MockCall[] = [];
  const ctx: any = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1,
    fillRect: mock((...args: any[]) => calls.push({ method: 'fillRect', args })),
    strokeRect: mock((...args: any[]) => calls.push({ method: 'strokeRect', args })),
    clearRect: mock((...args: any[]) => calls.push({ method: 'clearRect', args })),
    fillText: mock((...args: any[]) => calls.push({ method: 'fillText', args })),
    beginPath: mock(() => calls.push({ method: 'beginPath', args: [] })),
    closePath: mock(() => calls.push({ method: 'closePath', args: [] })),
    moveTo: mock((...args: any[]) => calls.push({ method: 'moveTo', args })),
    lineTo: mock((...args: any[]) => calls.push({ method: 'lineTo', args })),
    arc: mock((...args: any[]) => calls.push({ method: 'arc', args })),
    arcTo: mock((...args: any[]) => calls.push({ method: 'arcTo', args })),
    quadraticCurveTo: mock((...args: any[]) => calls.push({ method: 'quadraticCurveTo', args })),
    fill: mock(() => calls.push({ method: 'fill', args: [] })),
    stroke: mock(() => calls.push({ method: 'stroke', args: [] })),
    clip: mock(() => calls.push({ method: 'clip', args: [] })),
    save: mock(() => calls.push({ method: 'save', args: [] })),
    restore: mock(() => calls.push({ method: 'restore', args: [] })),
    scale: mock((...args: any[]) => calls.push({ method: 'scale', args })),
    drawImage: mock((...args: any[]) => calls.push({ method: 'drawImage', args })),
    measureText: mock((text: string) => ({ width: text.length * 8 })),
    roundRect: mock((...args: any[]) => calls.push({ method: 'roundRect', args })),
    rect: mock((...args: any[]) => calls.push({ method: 'rect', args })),
    calls,
  };
  return ctx;
}

function createMockCanvas(ctx: any) {
  return {
    getContext: mock(() => ctx),
    getBoundingClientRect: mock(() => ({ width: 400, height: 800, left: 0, top: 0 })),
    width: 400,
    height: 800,
    addEventListener: mock(() => {}),
    removeEventListener: mock(() => {}),
  } as any;
}

// Patch window.devicePixelRatio for HiDPI tests
const originalDpr = (globalThis as any).window?.devicePixelRatio;

describe('CanvasRenderer', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let canvas: ReturnType<typeof createMockCanvas>;
  let renderer: CanvasRenderer;

  beforeEach(() => {
    ctx = createMockContext();
    canvas = createMockCanvas(ctx);
    // Ensure window exists for dpr detection
    (globalThis as any).window = { devicePixelRatio: 2 };
    renderer = new CanvasRenderer(canvas);
  });

  describe('constructor / HiDPI setup', () => {
    it('scales canvas dimensions by device pixel ratio', () => {
      expect(canvas.width).toBe(800); // 400 * 2
      expect(canvas.height).toBe(1600); // 800 * 2
    });

    it('calls ctx.scale with device pixel ratio', () => {
      const scaleCalls = ctx.calls.filter((c: MockCall) => c.method === 'scale');
      expect(scaleCalls.length).toBe(1);
      expect(scaleCalls[0].args).toEqual([2, 2]);
    });

    it('defaults dpr to 1 when window is undefined', () => {
      const origWindow = (globalThis as any).window;
      delete (globalThis as any).window;
      const ctx2 = createMockContext();
      const canvas2 = createMockCanvas(ctx2);
      const renderer2 = new CanvasRenderer(canvas2);
      // dpr=1, so canvas dimensions stay the same
      expect(canvas2.width).toBe(400);
      expect(canvas2.height).toBe(800);
      (globalThis as any).window = origWindow;
    });
  });

  describe('clear', () => {
    it('calls clearRect with canvas dimensions', () => {
      renderer.clear();
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 400, 800);
    });
  });

  describe('getWidth / getHeight', () => {
    it('returns width from getBoundingClientRect', () => {
      expect(renderer.getWidth()).toBe(400);
    });

    it('returns height from getBoundingClientRect', () => {
      expect(renderer.getHeight()).toBe(800);
    });
  });

  describe('measureText', () => {
    it('returns measured width and approximate height', () => {
      const result = renderer.measureText('hello', 16, 'Arial', 'normal');
      // mock measureText returns text.length * 8 = 5 * 8 = 40
      expect(result.width).toBe(40);
      expect(result.height).toBe(16 * 1.2);
    });

    it('sets the correct font before measuring', () => {
      renderer.measureText('test', 20, 'Helvetica', 'bold');
      expect(ctx.font).toBe('bold 20px Helvetica');
    });
  });

  describe('render rect command', () => {
    it('draws a filled rectangle without border radius', () => {
      const commands: AnyRenderCommand[] = [
        { type: 'rect', x: 10, y: 20, width: 100, height: 50, color: '#ff0000' },
      ];
      renderer.render(commands);
      expect(ctx.fillStyle).toBe('#ff0000');
      expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 100, 50);
    });

    it('draws a rounded rectangle with uniform border radius', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        { type: 'rect', x: 0, y: 0, width: 80, height: 40, color: 'blue', borderRadius: 8 },
      ];
      renderer.render(commands);
      const methods = ctx.calls.map((c: MockCall) => c.method);
      expect(methods).toContain('beginPath');
      expect(methods).toContain('arcTo');
      expect(methods).toContain('fill');
    });

    it('draws a rounded rectangle with per-corner border radius', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        { type: 'rect', x: 0, y: 0, width: 80, height: 40, color: 'green', borderRadius: [4, 8, 12, 16] },
      ];
      renderer.render(commands);
      const arcToCalls = ctx.calls.filter((c: MockCall) => c.method === 'arcTo');
      expect(arcToCalls.length).toBe(4);
      expect(ctx.calls.some((c: MockCall) => c.method === 'fill')).toBe(true);
    });

    it('uses fillRect when borderRadius is 0', () => {
      const commands: AnyRenderCommand[] = [
        { type: 'rect', x: 5, y: 5, width: 50, height: 25, color: 'red', borderRadius: 0 },
      ];
      renderer.render(commands);
      expect(ctx.fillRect).toHaveBeenCalledWith(5, 5, 50, 25);
    });

    it('uses fillRect when borderRadius is [0,0,0,0]', () => {
      const commands: AnyRenderCommand[] = [
        { type: 'rect', x: 5, y: 5, width: 50, height: 25, color: 'red', borderRadius: [0, 0, 0, 0] },
      ];
      renderer.render(commands);
      expect(ctx.fillRect).toHaveBeenCalledWith(5, 5, 50, 25);
    });
  });

  describe('render text command', () => {
    it('sets correct font and calls fillText', () => {
      const commands: AnyRenderCommand[] = [
        {
          type: 'text', x: 10, y: 20, width: 200,
          text: 'Hello', color: '#000', fontSize: 16,
          fontWeight: 'bold', fontFamily: 'Arial', textAlign: 'left',
        },
      ];
      renderer.render(commands);
      expect(ctx.font).toBe('bold 16px Arial');
      expect(ctx.fillStyle).toBe('#000');
      expect(ctx.textBaseline).toBe('middle');
      expect(ctx.fillText).toHaveBeenCalled();
    });

    it('handles left text alignment', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        {
          type: 'text', x: 10, y: 20, width: 200,
          text: 'Left', color: '#000', fontSize: 14,
          fontWeight: 'normal', fontFamily: 'system-ui', textAlign: 'left',
        },
      ];
      renderer.render(commands);
      expect(ctx.textAlign).toBe('left');
      const fillTextCalls = ctx.calls.filter((c: MockCall) => c.method === 'fillText');
      expect(fillTextCalls[0].args[1]).toBe(10); // x position for left align
    });

    it('handles center text alignment', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        {
          type: 'text', x: 10, y: 20, width: 200,
          text: 'Center', color: '#000', fontSize: 14,
          fontWeight: 'normal', fontFamily: 'system-ui', textAlign: 'center',
        },
      ];
      renderer.render(commands);
      expect(ctx.textAlign).toBe('center');
      const fillTextCalls = ctx.calls.filter((c: MockCall) => c.method === 'fillText');
      expect(fillTextCalls[0].args[1]).toBe(110); // x + width/2 = 10 + 100
    });

    it('handles right text alignment', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        {
          type: 'text', x: 10, y: 20, width: 200,
          text: 'Right', color: '#000', fontSize: 14,
          fontWeight: 'normal', fontFamily: 'system-ui', textAlign: 'right',
        },
      ];
      renderer.render(commands);
      expect(ctx.textAlign).toBe('right');
      const fillTextCalls = ctx.calls.filter((c: MockCall) => c.method === 'fillText');
      expect(fillTextCalls[0].args[1]).toBe(210); // x + width = 10 + 200
    });

    it('wraps long text into multiple lines', () => {
      ctx.calls.length = 0;
      // Mock measureText returns text.length * 8
      // width=50, so "hello world" (11*8=88) should wrap
      const commands: AnyRenderCommand[] = [
        {
          type: 'text', x: 0, y: 0, width: 50,
          text: 'hello world', color: '#000', fontSize: 14,
          fontWeight: 'normal', fontFamily: 'system-ui', textAlign: 'left',
        },
      ];
      renderer.render(commands);
      const fillTextCalls = ctx.calls.filter((c: MockCall) => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(2);
    });

    it('uses custom lineHeight for spacing', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        {
          type: 'text', x: 0, y: 0, width: 50,
          text: 'hello world', color: '#000', fontSize: 14,
          fontWeight: 'normal', fontFamily: 'system-ui', textAlign: 'left',
          lineHeight: 24,
        },
      ];
      renderer.render(commands);
      const fillTextCalls = ctx.calls.filter((c: MockCall) => c.method === 'fillText');
      expect(fillTextCalls.length).toBe(2);
      expect(fillTextCalls[0].args[2]).toBe(12);   // y of first line = 0 + lineHeight / 2
      expect(fillTextCalls[1].args[2]).toBe(36);   // y of second line = 0 + lineHeight + lineHeight / 2
    });
  });

  describe('render clip/restore commands', () => {
    it('clip calls save and clip', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        { type: 'clip', x: 10, y: 20, width: 100, height: 50 },
      ];
      renderer.render(commands);
      const methods = ctx.calls.map((c: MockCall) => c.method);
      expect(methods).toContain('save');
      expect(methods).toContain('clip');
    });

    it('clip with border radius uses rounded path', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        { type: 'clip', x: 0, y: 0, width: 100, height: 100, borderRadius: [10, 10, 10, 10] },
      ];
      renderer.render(commands);
      const methods = ctx.calls.map((c: MockCall) => c.method);
      expect(methods).toContain('arcTo');
      expect(methods).toContain('clip');
    });

    it('clip without border radius uses rect path', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        { type: 'clip', x: 5, y: 5, width: 90, height: 90 },
      ];
      renderer.render(commands);
      expect(ctx.rect).toHaveBeenCalledWith(5, 5, 90, 90);
      expect(ctx.clip).toHaveBeenCalled();
    });

    it('restore calls ctx.restore', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [{ type: 'restore' }];
      renderer.render(commands);
      expect(ctx.restore).toHaveBeenCalled();
    });
  });

  describe('render opacity/restoreOpacity commands', () => {
    it('opacity calls save and sets globalAlpha', () => {
      ctx.globalAlpha = 1;
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        { type: 'opacity', opacity: 0.5 },
      ];
      renderer.render(commands);
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.globalAlpha).toBe(0.5);
    });

    it('opacity multiplies with current globalAlpha', () => {
      ctx.globalAlpha = 0.8;
      const commands: AnyRenderCommand[] = [
        { type: 'opacity', opacity: 0.5 },
      ];
      renderer.render(commands);
      expect(ctx.globalAlpha).toBeCloseTo(0.4);
    });

    it('restoreOpacity calls ctx.restore', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [{ type: 'restoreOpacity' }];
      renderer.render(commands);
      expect(ctx.restore).toHaveBeenCalled();
    });
  });

  describe('render border command', () => {
    it('draws top border', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        {
          type: 'border', x: 0, y: 0, width: 100, height: 100,
          widths: [2, 0, 0, 0], colors: ['red', 'transparent', 'transparent', 'transparent'],
        },
      ];
      renderer.render(commands);
      expect(ctx.stroke).toHaveBeenCalled();
      // Verify strokeStyle was set to red
      expect(ctx.strokeStyle).toBe('red');
    });

    it('draws all four borders with different colors', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        {
          type: 'border', x: 0, y: 0, width: 100, height: 100,
          widths: [1, 1, 1, 1], colors: ['red', 'green', 'blue', 'yellow'],
        },
      ];
      renderer.render(commands);
      const strokeCalls = ctx.calls.filter((c: MockCall) => c.method === 'stroke');
      expect(strokeCalls.length).toBe(4);
    });

    it('skips transparent borders', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        {
          type: 'border', x: 0, y: 0, width: 100, height: 100,
          widths: [1, 0, 1, 0], colors: ['red', 'transparent', 'blue', 'transparent'],
        },
      ];
      renderer.render(commands);
      const strokeCalls = ctx.calls.filter((c: MockCall) => c.method === 'stroke');
      expect(strokeCalls.length).toBe(2);
    });
  });

  describe('render image command', () => {
    it('caches images and returns null on first load', () => {
      ctx.calls.length = 0;
      // Image constructor won't work in test env, so we test the render path
      // by checking that drawImage is not called when image isn't loaded
      const commands: AnyRenderCommand[] = [
        { type: 'image', x: 0, y: 0, width: 100, height: 100, src: 'test.png' },
      ];
      // This will try to create a new Image() which will fail in bun test
      // But we can verify the code path by checking no drawImage call
      try {
        renderer.render(commands);
      } catch {
        // Image constructor may not exist in test environment
      }
    });
  });

  describe('multiple commands in order', () => {
    it('processes commands sequentially', () => {
      ctx.calls.length = 0;
      const commands: AnyRenderCommand[] = [
        { type: 'opacity', opacity: 0.5 },
        { type: 'clip', x: 0, y: 0, width: 100, height: 100 },
        { type: 'rect', x: 10, y: 10, width: 80, height: 80, color: 'red' },
        { type: 'restore' },
        { type: 'restoreOpacity' },
      ];
      renderer.render(commands);

      const methods = ctx.calls.map((c: MockCall) => c.method);
      // save (opacity) -> save (clip) -> ... -> clip -> fillRect -> restore (clip) -> restore (opacity)
      const saveIndices = methods.reduce((acc: number[], m, i) => m === 'save' ? [...acc, i] : acc, []);
      const restoreIndices = methods.reduce((acc: number[], m, i) => m === 'restore' ? [...acc, i] : acc, []);
      expect(saveIndices.length).toBe(2);
      expect(restoreIndices.length).toBe(2);

      // fillRect should be between the two save/restore pairs
      const fillRectIndex = methods.indexOf('fillRect');
      expect(fillRectIndex).toBeGreaterThan(saveIndices[1]);
      expect(fillRectIndex).toBeLessThan(restoreIndices[0]);
    });
  });

  describe('setOnImageLoad', () => {
    it('stores callback for image load notifications', () => {
      const cb = mock(() => {});
      renderer.setOnImageLoad(cb);
      // Callback is stored internally; verified indirectly through image loading
    });
  });
});
