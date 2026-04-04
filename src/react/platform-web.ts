import type { ReactElement } from 'react';
import { GlyphNode, HOST_TYPES } from './glyph-node';
import { renderReact } from './renderer';
import { nodeToLayoutInput, buildNodeLayoutMap } from './node-to-layout';
import { generateNodeRenderCommands } from './render-commands';
import { NodeEventManager } from './event-handler';
import { CanvasRenderer } from '../canvas-renderer';
import { createLayoutEngine } from '../layout/index';
import { setDebugMode } from '../render-tree';

export function render(element: ReactElement, canvas: HTMLCanvasElement): void {
  const renderer = new CanvasRenderer(canvas);
  const eventManager = new NodeEventManager();

  const rootNode = new GlyphNode(HOST_TYPES.ROOT, {
    style: { width: renderer.getWidth(), height: renderer.getHeight() },
  });

  let needsRender = false;

  function scheduleRender() {
    if (!needsRender) {
      needsRender = true;
      requestAnimationFrame(performRender);
    }
  }

  function performRender() {
    needsRender = false;

    const layoutInput = nodeToLayoutInput(rootNode, renderer);
    const layoutEngine = createLayoutEngine();
    const layoutOutput = layoutEngine.computeLayout(layoutInput, renderer.getWidth(), renderer.getHeight());
    const layoutMap = buildNodeLayoutMap(rootNode, layoutOutput);
    const commands = generateNodeRenderCommands(rootNode, layoutMap);

    renderer.clear();
    renderer.render(commands);

    eventManager.setRoot(rootNode, layoutMap);
  }

  // Check for debug mode
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === 'true') {
      setDebugMode(true);
    }
    (window as any).__GLYPH_DEBUG__ = (enabled: boolean) => {
      setDebugMode(enabled);
      scheduleRender();
    };
  }

  eventManager.attach(canvas);

  renderReact(element, rootNode, scheduleRender);
}
