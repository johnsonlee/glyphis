import type { InputEvent } from './types';
import type { GlyphisNode } from './node';

export function hitTest(root: GlyphisNode, x: number, y: number): GlyphisNode | null {
  return hitTestNode(root, 0, 0, x, y);
}

function hitTestNode(
  node: GlyphisNode,
  parentX: number,
  parentY: number,
  testX: number,
  testY: number,
): GlyphisNode | null {
  const layout = node.yoga.getComputedLayout();
  const x = parentX + layout.left;
  const y = parentY + layout.top;

  if (testX < x || testX > x + layout.width || testY < y || testY > y + layout.height) {
    return null;
  }

  for (let i = node.children.length - 1; i >= 0; i--) {
    const hit = hitTestNode(node.children[i], x, y, testX, testY);
    if (hit) return hit;
  }

  const h = node.handlers;
  if (h.onPress || h.onPressIn || h.onPressOut) {
    return node;
  }

  return null;
}

let pressedNode: GlyphisNode | null = null;

export function dispatchInput(root: GlyphisNode, event: InputEvent): void {
  if (event.type === 'pointerdown') {
    const target = hitTest(root, event.x, event.y);
    if (target) {
      pressedNode = target;
      if (target.handlers.onPressIn) target.handlers.onPressIn();
    }
  } else if (event.type === 'pointerup') {
    if (pressedNode) {
      if (pressedNode.handlers.onPressOut) pressedNode.handlers.onPressOut();
      const target = hitTest(root, event.x, event.y);
      if (target === pressedNode) {
        if (pressedNode.handlers.onPress) pressedNode.handlers.onPress();
      }
      pressedNode = null;
    }
  }
}
