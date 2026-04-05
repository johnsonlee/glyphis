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
  var layout = node.yoga.getComputedLayout();
  var x = parentX + layout.left;
  var y = parentY + layout.top;

  if (testX < x || testX > x + layout.width || testY < y || testY > y + layout.height) {
    return null;
  }

  for (var i = node.children.length - 1; i >= 0; i--) {
    var hit = hitTestNode(node.children[i], x, y, testX, testY);
    if (hit) return hit;
  }

  var h = node.handlers;
  if (h.onPress || h.onPressIn || h.onPressOut) {
    return node;
  }

  return null;
}

/**
 * Hit test that returns the deepest node at the given coordinates,
 * regardless of whether it has press handlers. Used to find scrollable
 * ancestors when no pressable node is directly under the touch point.
 */
function hitTestAny(root: GlyphisNode, x: number, y: number): GlyphisNode | null {
  return hitTestAnyNode(root, 0, 0, x, y);
}

function hitTestAnyNode(
  node: GlyphisNode,
  parentX: number,
  parentY: number,
  testX: number,
  testY: number,
): GlyphisNode | null {
  var layout = node.yoga.getComputedLayout();
  var x = parentX + layout.left;
  var y = parentY + layout.top;

  if (testX < x || testX > x + layout.width || testY < y || testY > y + layout.height) {
    return null;
  }

  for (var i = node.children.length - 1; i >= 0; i--) {
    var hit = hitTestAnyNode(node.children[i], x, y, testX, testY);
    if (hit) return hit;
  }

  return node;
}

/**
 * Walk from a node up through its ancestors to find one with an
 * onPointerMove handler (i.e. a scrollable container like RecyclerList).
 */
function findScrollableAncestor(node: GlyphisNode | undefined): GlyphisNode | null {
  var current = node;
  while (current) {
    if (current.handlers.onPointerMove) return current;
    current = current.parent;
  }
  return null;
}

var pressedNode: GlyphisNode | null = null;
var scrollNode: GlyphisNode | null = null;
var pressStartX = 0;
var pressStartY = 0;
var pressCancelled = false;

var DRAG_THRESHOLD = 5;

export function dispatchInput(root: GlyphisNode, event: InputEvent): void {
  if (event.type === 'pointerdown') {
    var target = hitTest(root, event.x, event.y);
    pressStartX = event.x;
    pressStartY = event.y;
    pressCancelled = false;

    if (target) {
      pressedNode = target;
      if (target.handlers.onPressIn) target.handlers.onPressIn();
      // Walk up from pressable node to find scrollable ancestor
      scrollNode = findScrollableAncestor(target.parent);
    } else {
      pressedNode = null;
      // No pressable node hit — find any node at this point and walk up
      var anyNode = hitTestAny(root, event.x, event.y);
      scrollNode = findScrollableAncestor(anyNode || undefined);
    }

    // Notify scroll container that a drag may be starting
    if (scrollNode && scrollNode.handlers.onScrollDragStart) {
      scrollNode.handlers.onScrollDragStart(event.x, event.y);
    }

  } else if (event.type === 'pointermove') {
    var dx = event.x - pressStartX;
    var dy = event.y - pressStartY;

    // Cancel press if dragged beyond threshold
    if (!pressCancelled && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      pressCancelled = true;
      // Fire pressOut on the pressed node since we are now dragging
      if (pressedNode && pressedNode.handlers.onPressOut) {
        pressedNode.handlers.onPressOut();
      }
    }

    // Notify scroll handler
    if (scrollNode && scrollNode.handlers.onPointerMove) {
      scrollNode.handlers.onPointerMove(event.x, event.y);
    }

  } else if (event.type === 'pointerup') {
    // Notify scroll container that drag ended
    if (scrollNode && scrollNode.handlers.onScrollDragEnd) {
      scrollNode.handlers.onScrollDragEnd(event.x, event.y);
    }

    if (pressedNode) {
      // Only fire pressOut if we did not already fire it during drag
      if (!pressCancelled && pressedNode.handlers.onPressOut) {
        pressedNode.handlers.onPressOut();
      }
      // Only fire onPress if we did not drag
      if (!pressCancelled) {
        var target2 = hitTest(root, event.x, event.y);
        if (target2 === pressedNode && pressedNode.handlers.onPress) {
          pressedNode.handlers.onPress();
        }
      }
      pressedNode = null;
    }
    scrollNode = null;
  }
}
