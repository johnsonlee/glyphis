import type { Renderer } from '../types';
import { CanvasRenderer } from '../canvas-renderer';

export type RendererType = 'canvas2d' | 'canvaskit';

export async function createRenderer(
  canvas: HTMLCanvasElement,
  options?: { type?: RendererType },
): Promise<Renderer> {
  const type = options?.type ?? 'canvas2d';

  if (type === 'canvaskit') {
    const { initCanvasKit, CanvasKitRenderer } = await import('./canvaskit-renderer');
    await initCanvasKit();
    return new CanvasKitRenderer(canvas);
  }

  return new CanvasRenderer(canvas);
}

export { CanvasRenderer } from '../canvas-renderer';
export { batchCommands, countDrawCalls } from './command-batcher';
