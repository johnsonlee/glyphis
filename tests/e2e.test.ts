import { describe, it, expect } from 'bun:test';
import { createElement } from '../src/jsx';
import { useState, useCallback } from '../src/hooks';
import { createReconciler } from '../src/reconciler';
import type { ReconcilerHost } from '../src/reconciler';
import type { Fiber, AnyRenderCommand, Renderer, TextCommand } from '../src/types';
import { computeLayout } from '../src/layout';
import type { LayoutOutput } from '../src/layout';
import { fiberToLayoutInput, buildLayoutMap } from '../src/platform/web';
import { generateRenderCommands } from '../src/render-tree';
import { EventManager } from '../src/events';
import { Box } from '../src/components/Box';
import { Text } from '../src/components/Text';
import { Button } from '../src/components/Button';

const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;

const mockRenderer: Renderer = {
  clear() {},
  render() {},
  getWidth() { return SCREEN_WIDTH; },
  getHeight() { return SCREEN_HEIGHT; },
  measureText(text: string, fontSize: number, _fontFamily: string, _fontWeight: string) {
    return { width: text.length * fontSize * 0.6, height: fontSize * 1.2 };
  },
};

function flush(): Promise<void> {
  return new Promise<void>((resolve) => queueMicrotask(resolve));
}

function findTextCommands(commands: AnyRenderCommand[]): string[] {
  return commands
    .filter((cmd): cmd is TextCommand => cmd.type === 'text')
    .map((cmd) => cmd.text);
}

function renderPass(rootFiber: Fiber) {
  const layoutInput = fiberToLayoutInput(rootFiber, mockRenderer);
  layoutInput.style = { ...layoutInput.style, width: SCREEN_WIDTH, height: SCREEN_HEIGHT };
  const layoutOutput = computeLayout(layoutInput, SCREEN_WIDTH, SCREEN_HEIGHT);
  const layoutMap = buildLayoutMap(rootFiber, layoutOutput);
  const commands = generateRenderCommands(rootFiber, layoutMap);
  return { commands, layoutMap };
}

/** Find the first host fiber that has an onPress handler. */
function findHostFiberWithOnPress(fiber: Fiber): Fiber | null {
  if (fiber.tag === 'host' && fiber.props.onPress) return fiber;
  let child = fiber.child;
  while (child) {
    const found = findHostFiberWithOnPress(child);
    if (found) return found;
    child = child.sibling;
  }
  return null;
}

/**
 * Compute the absolute position of a fiber by summing layout offsets up the tree.
 * hitTest accumulates offsets from the root, so we need absolute coordinates
 * to place the pointer within the target.
 */
function getAbsolutePosition(
  fiber: Fiber,
  layoutMap: Map<Fiber, LayoutOutput>,
): { x: number; y: number; width: number; height: number } {
  const positions: { x: number; y: number }[] = [];
  let width = 0;
  let height = 0;
  let cur: Fiber | null = fiber;
  while (cur) {
    const lo = layoutMap.get(cur);
    if (lo) {
      if (cur === fiber) {
        width = lo.width;
        height = lo.height;
      }
      positions.push({ x: lo.x, y: lo.y });
    }
    cur = cur.parent;
  }
  let x = 0;
  let y = 0;
  for (let i = positions.length - 1; i >= 0; i--) {
    x += positions[i].x;
    y += positions[i].y;
  }
  return { x, y, width, height };
}

/**
 * Simulate a full press gesture (pointerDown + pointerUp) on a fiber
 * at its center coordinates.
 */
function simulatePress(
  rootFiber: Fiber,
  layoutMap: Map<Fiber, LayoutOutput>,
  targetFiber: Fiber,
) {
  const abs = getAbsolutePosition(targetFiber, layoutMap);
  const centerX = abs.x + abs.width / 2;
  const centerY = abs.y + abs.height / 2;

  const eventManager = new EventManager();
  eventManager.setRoot(rootFiber, layoutMap);
  eventManager.handlePointerDown(centerX, centerY);
  eventManager.handlePointerUp(centerX, centerY);
}

describe('E2E: Click -> State Update -> Re-render', () => {
  it('counter increments on button press', async () => {
    function Counter() {
      const [count, setCount] = useState(0);
      const increment = useCallback(() => setCount((c: number) => c + 1), []);

      return createElement(Box, { style: { flex: 1 } },
        createElement(Text, { style: { fontSize: 24 } }, String(count)),
        createElement(Button, { title: '+', onPress: increment }),
      );
    }

    let committedRoot: Fiber | null = null;

    const host: ReconcilerHost = {
      createNode(_fiber: Fiber) { return {}; },
      updateNode() {},
      removeNode() {},
      commitEffects(fiber: Fiber) {
        let current = fiber;
        while (current.parent) current = current.parent;
        committedRoot = current;
      },
    };

    const reconciler = createReconciler(host);
    const element = createElement(Counter, {});
    reconciler.render(element, {});

    // Wait for initial render microtask
    await flush();
    expect(committedRoot).not.toBeNull();

    // --- Verify initial render shows "0" ---
    let { commands, layoutMap } = renderPass(committedRoot!);
    let texts = findTextCommands(commands);
    expect(texts).toContain('0');

    // --- First click: count should become "1" ---
    let buttonFiber = findHostFiberWithOnPress(committedRoot!);
    expect(buttonFiber).not.toBeNull();

    simulatePress(committedRoot!, layoutMap, buttonFiber!);

    // The press triggers multiple state updates (Button pressed state + counter).
    // Each scheduleUpdate overwrites wipFiber but only one microtask fires.
    // A single flush processes the batched updates. Additional flushes handle
    // any cascading re-renders from intermediate state changes.
    await flush();
    await flush();
    await flush();

    ({ commands, layoutMap } = renderPass(committedRoot!));
    texts = findTextCommands(commands);
    expect(texts).toContain('1');

    // --- Second click: count should become "2" ---
    buttonFiber = findHostFiberWithOnPress(committedRoot!);
    expect(buttonFiber).not.toBeNull();

    simulatePress(committedRoot!, layoutMap, buttonFiber!);

    await flush();
    await flush();
    await flush();

    ({ commands } = renderPass(committedRoot!));
    texts = findTextCommands(commands);
    expect(texts).toContain('2');
  });
});
