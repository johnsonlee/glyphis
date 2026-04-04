import type { VNode, Fiber, Style, Renderer } from '../types';
import { createReconciler } from '../reconciler';
import type { ReconcilerHost } from '../reconciler';
import { CanvasRenderer } from '../canvas-renderer';
import { EventManager } from '../events';
import { computeLayout } from '../layout';
import type { LayoutInput, LayoutOutput } from '../layout';
import { generateRenderCommands, setDebugMode } from '../render-tree';

export function render(element: VNode, container: HTMLCanvasElement): void {
  const renderer = new CanvasRenderer(container);
  const eventManager = new EventManager();

  let rootFiber: Fiber | null = null;
  let needsRender = false;

  const host: ReconcilerHost = {
    createNode(_fiber: Fiber) {
      return {};
    },
    updateNode(_fiber: Fiber, _prevProps: any, _nextProps: any) {
      scheduleRender();
    },
    removeNode(_fiber: Fiber) {
      scheduleRender();
    },
    commitEffects(fiber: Fiber) {
      rootFiber = findRoot(fiber);
      scheduleRender();
    },
  };

  const reconciler = createReconciler(host);

  function findRoot(fiber: Fiber): Fiber {
    let current = fiber;
    while (current.parent) {
      current = current.parent;
    }
    return current;
  }

  function scheduleRender() {
    if (!needsRender) {
      needsRender = true;
      requestAnimationFrame(performRender);
    }
  }

  function performRender() {
    needsRender = false;
    if (!rootFiber) return;

    const layoutInput = fiberToLayoutInput(rootFiber, renderer);
    // Root fills the entire canvas viewport
    layoutInput.style = { ...layoutInput.style, width: renderer.getWidth(), height: renderer.getHeight() };
    const layoutOutput = computeLayout(layoutInput, renderer.getWidth(), renderer.getHeight());
    const layoutMap = buildLayoutMap(rootFiber, layoutOutput);
    const commands = generateRenderCommands(rootFiber, layoutMap);

    renderer.clear();
    renderer.render(commands);

    eventManager.setRoot(rootFiber, layoutMap);
  }

  // Check for debug mode via URL query parameter
  if (typeof window !== 'undefined') {
    if (window.location) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === 'true') {
        setDebugMode(true);
      }
    }
    // Support toggling via global function
    (window as any).__GLYPH_DEBUG__ = (enabled: boolean) => {
      setDebugMode(enabled);
      scheduleRender();
    };
  }

  const detach = eventManager.attach(container);

  reconciler.render(element, container);
}

function collectLayoutChildren(fiber: Fiber, renderer: Renderer): LayoutInput[] {
  const result: LayoutInput[] = [];
  let child = fiber.child;
  while (child) {
    if (child.tag !== 'component' && child.tag !== 'fragment') {
      result.push(fiberToLayoutInput(child, renderer));
    } else {
      // Recursively unwrap component/fragment chains
      result.push(...collectLayoutChildren(child, renderer));
    }
    child = child.sibling;
  }
  return result;
}

export function fiberToLayoutInput(fiber: Fiber, renderer: Renderer): LayoutInput {
  const style: Style = fiber.props.style || {};
  const children = collectLayoutChildren(fiber, renderer);

  const input: LayoutInput = { style, children };

  if (fiber.tag === 'text') {
    const text = String(fiber.props.nodeValue || '');
    if (text) {
      const parentStyle = fiber.parent?.props.style || {};
      input.text = text;
      input.measureText = (t: string, s: Style) => {
        return renderer.measureText(
          t,
          s.fontSize || parentStyle.fontSize || style.fontSize || 14,
          s.fontFamily || parentStyle.fontFamily || style.fontFamily || 'system-ui',
          String(s.fontWeight || parentStyle.fontWeight || style.fontWeight || 'normal'),
        );
      };
    }
  } else if (fiber.props.children) {
    const textParts = fiber.props.children.filter(
      (c: any) => typeof c === 'string' || typeof c === 'number',
    );
    if (textParts.length > 0) {
      const text = textParts.join('');
      input.text = text;
      input.measureText = (t: string, s: Style) => {
        return renderer.measureText(
          t,
          s.fontSize || style.fontSize || 14,
          s.fontFamily || style.fontFamily || 'system-ui',
          String(s.fontWeight || style.fontWeight || 'normal'),
        );
      };
    }
  }

  return input;
}

export function buildLayoutMap(fiber: Fiber, layout: LayoutOutput): Map<Fiber, LayoutOutput> {
  const map = new Map<Fiber, LayoutOutput>();
  mapFiberToLayout(fiber, layout, map);
  return map;
}

function collectHostFibers(fiber: Fiber): Fiber[] {
  const result: Fiber[] = [];
  let child = fiber.child;
  while (child) {
    if (child.tag !== 'component' && child.tag !== 'fragment') {
      result.push(child);
    } else {
      result.push(...collectHostFibers(child));
    }
    child = child.sibling;
  }
  return result;
}

function mapFiberToLayout(
  fiber: Fiber,
  layout: LayoutOutput,
  map: Map<Fiber, LayoutOutput>,
): void {
  map.set(fiber, layout);

  const hostChildren = collectHostFibers(fiber);
  for (let i = 0; i < hostChildren.length && i < layout.children.length; i++) {
    mapFiberToLayout(hostChildren[i], layout.children[i], map);
  }
}
