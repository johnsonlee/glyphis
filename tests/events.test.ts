import { describe, it, expect, beforeEach, mock } from 'bun:test';
import Yoga from 'yoga-layout';
import { createGlyphisNode } from '../src/node';
import type { GlyphisNode } from '../src/node';
import { applyStyle } from '../src/styles';
import { hitTest, dispatchInput } from '../src/events';

function makeNode(tag: string, style: GlyphisNode['style'] = {}): GlyphisNode {
  const yoga = Yoga.Node.create();
  const node = createGlyphisNode(yoga, tag);
  node.style = style;
  applyStyle(yoga, style);
  return node;
}

function appendChild(parent: GlyphisNode, child: GlyphisNode): void {
  parent.yoga.insertChild(child.yoga, parent.children.length);
  parent.children.push(child);
  child.parent = parent;
}

function layout(root: GlyphisNode): void {
  root.yoga.calculateLayout(undefined, undefined);
}

/** Reset global event state by running a full press cycle on a throwaway node */
function resetEventState(): void {
  const dummy = makeNode('View', { width: 1, height: 1 });
  dummy.handlers = { onPress: () => {} };
  layout(dummy);
  dispatchInput(dummy, { type: 'pointerdown', x: 0, y: 0 });
  dispatchInput(dummy, { type: 'pointerup', x: 0, y: 0 });
}

describe('hitTest', () => {
  it('returns null for coordinates outside root', () => {
    const root = makeNode('View', { width: 100, height: 100 });
    root.handlers = { onPress: () => {} };
    layout(root);

    expect(hitTest(root, 150, 50)).toBeNull();
    expect(hitTest(root, 50, 150)).toBeNull();
    expect(hitTest(root, -1, 50)).toBeNull();
    expect(hitTest(root, 50, -1)).toBeNull();
  });

  it('returns the node with handlers at given coordinates', () => {
    const root = makeNode('View', { width: 200, height: 200 });
    root.handlers = { onPress: () => {} };
    layout(root);

    const result = hitTest(root, 50, 50);
    expect(result).toBe(root);
  });

  it('returns deepest (child) node when overlapping', () => {
    const root = makeNode('View', { width: 200, height: 200 });
    root.handlers = { onPress: () => {} };

    const child = makeNode('View', { width: 100, height: 100 });
    child.handlers = { onPress: () => {} };
    appendChild(root, child);
    layout(root);

    const result = hitTest(root, 50, 50);
    expect(result).toBe(child);
  });

  it('returns null if no node has handlers', () => {
    const root = makeNode('View', { width: 200, height: 200 });
    const child = makeNode('View', { width: 100, height: 100 });
    appendChild(root, child);
    layout(root);

    const result = hitTest(root, 50, 50);
    expect(result).toBeNull();
  });

  it('checks children in reverse order (topmost first)', () => {
    const root = makeNode('View', { width: 300, height: 300 });

    // Two children that overlap at (0,0)-(100,100) using absolute positioning
    const childA = makeNode('View', {
      width: 100, height: 100,
      position: 'absolute', top: 0, left: 0,
    });
    childA.handlers = { onPress: () => {} };

    const childB = makeNode('View', {
      width: 100, height: 100,
      position: 'absolute', top: 0, left: 0,
    });
    childB.handlers = { onPress: () => {} };

    appendChild(root, childA);
    appendChild(root, childB);
    layout(root);

    // childB is later in children array, so it is "on top" and should be hit first
    const result = hitTest(root, 50, 50);
    expect(result).toBe(childB);
  });

  it('returns parent when click is outside child but inside parent', () => {
    const root = makeNode('View', { width: 200, height: 200 });
    root.handlers = { onPress: () => {} };

    const child = makeNode('View', { width: 50, height: 50 });
    child.handlers = { onPress: () => {} };
    appendChild(root, child);
    layout(root);

    // (150, 150) is inside root but outside child
    const result = hitTest(root, 150, 150);
    expect(result).toBe(root);
  });

  it('recognizes onPressIn as a valid handler', () => {
    const root = makeNode('View', { width: 100, height: 100 });
    root.handlers = { onPressIn: () => {} };
    layout(root);

    expect(hitTest(root, 50, 50)).toBe(root);
  });

  it('recognizes onPressOut as a valid handler', () => {
    const root = makeNode('View', { width: 100, height: 100 });
    root.handlers = { onPressOut: () => {} };
    layout(root);

    expect(hitTest(root, 50, 50)).toBe(root);
  });

  it('returns null for node with only onPointerMove (not a press handler)', () => {
    const root = makeNode('View', { width: 100, height: 100 });
    root.handlers = { onPointerMove: () => {} };
    layout(root);

    // hitTest only considers press handlers, not scroll handlers
    expect(hitTest(root, 50, 50)).toBeNull();
  });
});

describe('dispatchInput', () => {
  beforeEach(() => {
    resetEventState();
  });

  it('pointerdown calls onPressIn', () => {
    const onPressIn = mock(() => {});
    const root = makeNode('View', { width: 100, height: 100 });
    root.handlers = { onPressIn, onPress: () => {} };
    layout(root);

    dispatchInput(root, { type: 'pointerdown', x: 50, y: 50 });
    expect(onPressIn).toHaveBeenCalledTimes(1);
  });

  it('pointerup calls onPressOut and onPress', () => {
    const onPressOut = mock(() => {});
    const onPress = mock(() => {});
    const root = makeNode('View', { width: 100, height: 100 });
    root.handlers = { onPressIn: () => {}, onPressOut, onPress };
    layout(root);

    dispatchInput(root, { type: 'pointerdown', x: 50, y: 50 });
    dispatchInput(root, { type: 'pointerup', x: 50, y: 50 });

    expect(onPressOut).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('pointerup on different node than pointerdown does not call onPress', () => {
    const onPressA = mock(() => {});
    const onPressOutA = mock(() => {});

    const root = makeNode('View', { width: 300, height: 300 });

    const childA = makeNode('View', { width: 100, height: 100 });
    childA.handlers = { onPress: onPressA, onPressIn: () => {}, onPressOut: onPressOutA };

    const childB = makeNode('View', {
      width: 100,
      height: 100,
      position: 'absolute',
      top: 150,
      left: 0,
    });
    childB.handlers = { onPress: () => {}, onPressIn: () => {}, onPressOut: () => {} };

    appendChild(root, childA);
    appendChild(root, childB);
    layout(root);

    // Press down on childA
    dispatchInput(root, { type: 'pointerdown', x: 50, y: 50 });
    // Release on childB (different node)
    dispatchInput(root, { type: 'pointerup', x: 50, y: 175 });

    // onPressOut should still fire on the originally pressed node
    expect(onPressOutA).toHaveBeenCalledTimes(1);
    // But onPress should NOT fire because release was on a different node
    expect(onPressA).not.toHaveBeenCalled();
  });

  it('full press lifecycle: pointerdown -> onPressIn, pointerup -> onPressOut + onPress', () => {
    const onPressIn = mock(() => {});
    const onPressOut = mock(() => {});
    const onPress = mock(() => {});

    const root = makeNode('View', { width: 100, height: 100 });
    root.handlers = { onPressIn, onPressOut, onPress };
    layout(root);

    // pointerdown triggers onPressIn
    dispatchInput(root, { type: 'pointerdown', x: 50, y: 50 });
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();

    // pointerup triggers onPressOut then onPress
    dispatchInput(root, { type: 'pointerup', x: 50, y: 50 });
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('pointerdown outside any handler node does not set pressedNode', () => {
    const root = makeNode('View', { width: 100, height: 100 });
    // No handlers on root
    layout(root);

    dispatchInput(root, { type: 'pointerdown', x: 50, y: 50 });
    // pointerup should not crash or call anything
    dispatchInput(root, { type: 'pointerup', x: 50, y: 50 });
    // If we get here without error, the test passes
  });

  it('pointerup without prior pointerdown does nothing', () => {
    const onPress = mock(() => {});
    const root = makeNode('View', { width: 100, height: 100 });
    root.handlers = { onPress };
    layout(root);

    // Now pointerup without a pointerdown on root
    dispatchInput(root, { type: 'pointerup', x: 50, y: 50 });
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('dispatchInput - scroll/drag', () => {
  beforeEach(() => {
    resetEventState();
  });

  /**
   * Build a tree: scrollParent (300x300, onPointerMove) > pressChild (100x100, onPress/onPressIn/onPressOut)
   */
  function buildScrollTree() {
    const onPointerMove = mock((_x: number, _y: number) => {});
    const onScrollDragStart = mock((_x: number, _y: number) => {});
    const onScrollDragEnd = mock((_x: number, _y: number) => {});
    const onPress = mock(() => {});
    const onPressIn = mock(() => {});
    const onPressOut = mock(() => {});

    const root = makeNode('View', { width: 400, height: 400 });

    const scrollParent = makeNode('View', { width: 300, height: 300 });
    scrollParent.handlers = {
      onPointerMove,
      onScrollDragStart,
      onScrollDragEnd,
    };
    appendChild(root, scrollParent);

    const pressChild = makeNode('View', { width: 100, height: 100 });
    pressChild.handlers = { onPress, onPressIn, onPressOut };
    appendChild(scrollParent, pressChild);

    layout(root);

    return {
      root,
      scrollParent,
      pressChild,
      onPointerMove,
      onScrollDragStart,
      onScrollDragEnd,
      onPress,
      onPressIn,
      onPressOut,
    };
  }

  it('hitTestAny returns deepest node regardless of handlers (tested via scroll on non-pressable area)', () => {
    // When tapping an area with no press handlers but inside a scrollable parent,
    // the event system should still find the scrollable ancestor via hitTestAny.
    const onPointerMove = mock((_x: number, _y: number) => {});
    const onScrollDragStart = mock((_x: number, _y: number) => {});

    const root = makeNode('View', { width: 400, height: 400 });

    const scrollContainer = makeNode('View', { width: 300, height: 300 });
    scrollContainer.handlers = {
      onPointerMove,
      onScrollDragStart,
    };
    appendChild(root, scrollContainer);

    // A child with NO press handlers
    const plainChild = makeNode('View', { width: 100, height: 100 });
    appendChild(scrollContainer, plainChild);

    layout(root);

    // Tap inside plainChild area - hitTest returns null (no press handlers),
    // so hitTestAny is used internally to find scrollable ancestor
    dispatchInput(root, { type: 'pointerdown', x: 50, y: 50 });
    expect(onScrollDragStart).toHaveBeenCalledTimes(1);
  });

  it('findScrollableAncestor walks up to find node with onPointerMove', () => {
    const t = buildScrollTree();

    // Press on the child, which has press handlers but not scroll handlers.
    // findScrollableAncestor should walk up to scrollParent.
    dispatchInput(t.root, { type: 'pointerdown', x: 50, y: 50 });
    expect(t.onScrollDragStart).toHaveBeenCalledTimes(1);

    // Now move - the scroll parent should receive onPointerMove
    dispatchInput(t.root, { type: 'pointermove', x: 50, y: 60 });
    expect(t.onPointerMove).toHaveBeenCalledTimes(1);
  });

  it('pointermove dispatches to scroll node onPointerMove', () => {
    const t = buildScrollTree();

    dispatchInput(t.root, { type: 'pointerdown', x: 50, y: 50 });
    dispatchInput(t.root, { type: 'pointermove', x: 52, y: 53 });

    expect(t.onPointerMove).toHaveBeenCalledTimes(1);
    expect(t.onPointerMove).toHaveBeenCalledWith(52, 53);
  });

  it('pointermove cancels press after 5px drag threshold', () => {
    const t = buildScrollTree();

    dispatchInput(t.root, { type: 'pointerdown', x: 50, y: 50 });
    expect(t.onPressIn).toHaveBeenCalledTimes(1);

    // Move less than threshold - press should NOT be cancelled
    dispatchInput(t.root, { type: 'pointermove', x: 50, y: 54 });
    expect(t.onPressOut).not.toHaveBeenCalled();

    // Move beyond threshold (dy > 5)
    dispatchInput(t.root, { type: 'pointermove', x: 50, y: 56 });
    expect(t.onPressOut).toHaveBeenCalledTimes(1);
  });

  it('pointermove fires onPressOut when drag threshold exceeded', () => {
    const t = buildScrollTree();

    dispatchInput(t.root, { type: 'pointerdown', x: 50, y: 50 });

    // Move beyond threshold in x direction
    dispatchInput(t.root, { type: 'pointermove', x: 56, y: 50 });

    expect(t.onPressOut).toHaveBeenCalledTimes(1);
  });

  it('pointerup does NOT fire onPress when drag was active', () => {
    const t = buildScrollTree();

    dispatchInput(t.root, { type: 'pointerdown', x: 50, y: 50 });
    // Drag beyond threshold
    dispatchInput(t.root, { type: 'pointermove', x: 50, y: 60 });
    // Release
    dispatchInput(t.root, { type: 'pointerup', x: 50, y: 60 });

    expect(t.onPress).not.toHaveBeenCalled();
    // onPressOut should have been called once during the drag, not again on up
    expect(t.onPressOut).toHaveBeenCalledTimes(1);
  });

  it('onScrollDragStart called on pointerdown for scrollable ancestor', () => {
    const t = buildScrollTree();

    dispatchInput(t.root, { type: 'pointerdown', x: 50, y: 50 });
    expect(t.onScrollDragStart).toHaveBeenCalledTimes(1);
    expect(t.onScrollDragStart).toHaveBeenCalledWith(50, 50);
  });

  it('onScrollDragEnd called on pointerup', () => {
    const t = buildScrollTree();

    dispatchInput(t.root, { type: 'pointerdown', x: 50, y: 50 });
    dispatchInput(t.root, { type: 'pointerup', x: 50, y: 50 });

    expect(t.onScrollDragEnd).toHaveBeenCalledTimes(1);
    expect(t.onScrollDragEnd).toHaveBeenCalledWith(50, 50);
  });

  it('full drag lifecycle: down -> move (>5px) -> onPressOut fired, onPointerMove called -> up -> onPress NOT fired', () => {
    const t = buildScrollTree();

    // 1. pointerdown - pressIn fires, scrollDragStart fires
    dispatchInput(t.root, { type: 'pointerdown', x: 100, y: 100 });
    expect(t.onPressIn).toHaveBeenCalledTimes(1);
    expect(t.onScrollDragStart).toHaveBeenCalledTimes(1);
    expect(t.onScrollDragStart).toHaveBeenCalledWith(100, 100);

    // 2. small move within threshold - no press cancellation
    dispatchInput(t.root, { type: 'pointermove', x: 100, y: 103 });
    expect(t.onPressOut).not.toHaveBeenCalled();
    expect(t.onPointerMove).toHaveBeenCalledTimes(1);

    // 3. move beyond threshold - press cancelled, onPressOut fires
    dispatchInput(t.root, { type: 'pointermove', x: 100, y: 120 });
    expect(t.onPressOut).toHaveBeenCalledTimes(1);
    expect(t.onPointerMove).toHaveBeenCalledTimes(2);
    expect(t.onPointerMove).toHaveBeenCalledWith(100, 120);

    // 4. further moves do not fire onPressOut again
    dispatchInput(t.root, { type: 'pointermove', x: 100, y: 140 });
    expect(t.onPressOut).toHaveBeenCalledTimes(1);
    expect(t.onPointerMove).toHaveBeenCalledTimes(3);

    // 5. pointerup - onPress NOT fired, onScrollDragEnd fires
    dispatchInput(t.root, { type: 'pointerup', x: 100, y: 140 });
    expect(t.onPress).not.toHaveBeenCalled();
    expect(t.onScrollDragEnd).toHaveBeenCalledTimes(1);
    expect(t.onScrollDragEnd).toHaveBeenCalledWith(100, 140);
    // onPressOut should NOT fire again on pointerup (already fired during drag)
    expect(t.onPressOut).toHaveBeenCalledTimes(1);
  });

  it('drag on area with no pressable child still dispatches scroll events', () => {
    const onPointerMove = mock((_x: number, _y: number) => {});
    const onScrollDragStart = mock((_x: number, _y: number) => {});
    const onScrollDragEnd = mock((_x: number, _y: number) => {});

    const root = makeNode('View', { width: 400, height: 400 });

    const scrollContainer = makeNode('View', { width: 300, height: 300 });
    scrollContainer.handlers = { onPointerMove, onScrollDragStart, onScrollDragEnd };
    appendChild(root, scrollContainer);

    layout(root);

    // Touch area inside scrollContainer but no press handler child
    dispatchInput(root, { type: 'pointerdown', x: 150, y: 150 });
    expect(onScrollDragStart).toHaveBeenCalledTimes(1);

    dispatchInput(root, { type: 'pointermove', x: 150, y: 170 });
    expect(onPointerMove).toHaveBeenCalledTimes(1);

    dispatchInput(root, { type: 'pointerup', x: 150, y: 170 });
    expect(onScrollDragEnd).toHaveBeenCalledTimes(1);
  });

  it('no scroll events when there is no scrollable ancestor', () => {
    const onPress = mock(() => {});
    const onPressIn = mock(() => {});
    const onPressOut = mock(() => {});

    const root = makeNode('View', { width: 200, height: 200 });
    const child = makeNode('View', { width: 100, height: 100 });
    child.handlers = { onPress, onPressIn, onPressOut };
    appendChild(root, child);
    layout(root);

    // Normal press cycle without scrollable ancestor should work fine
    dispatchInput(root, { type: 'pointerdown', x: 50, y: 50 });
    dispatchInput(root, { type: 'pointerup', x: 50, y: 50 });

    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
