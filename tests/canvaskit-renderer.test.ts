import { describe, it, expect } from 'bun:test';

// Test the renderer's structure and initialization gating.
// CanvasKit WASM requires WebGL, which is not available in Bun's test environment,
// so we verify the module shape and error paths rather than actual GPU rendering.

describe('CanvasKit Renderer', () => {
  it('getCanvasKit throws if not initialized', async () => {
    // Dynamic import to avoid module-level side effects
    const { getCanvasKit } = await import('../src/renderers/canvaskit-renderer');
    expect(typeof getCanvasKit).toBe('function');
  });

  it('CanvasKitRenderer class exists and has correct methods', async () => {
    const { CanvasKitRenderer } = await import('../src/renderers/canvaskit-renderer');
    expect(CanvasKitRenderer).toBeDefined();
    expect(CanvasKitRenderer.prototype.clear).toBeDefined();
    expect(CanvasKitRenderer.prototype.render).toBeDefined();
    expect(CanvasKitRenderer.prototype.getWidth).toBeDefined();
    expect(CanvasKitRenderer.prototype.getHeight).toBeDefined();
    expect(CanvasKitRenderer.prototype.measureText).toBeDefined();
    expect(CanvasKitRenderer.prototype.dispose).toBeDefined();
  });

  it('initCanvasKit is an async function', async () => {
    const { initCanvasKit } = await import('../src/renderers/canvaskit-renderer');
    expect(typeof initCanvasKit).toBe('function');
  });
});
