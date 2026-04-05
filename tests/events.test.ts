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
});

describe('dispatchInput', () => {
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
    const onPressOut = mock(() => {});
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

    // Need to clear any global pressedNode state from prior tests by
    // simulating a complete cycle on a dummy node first
    const dummy = makeNode('View', { width: 10, height: 10 });
    dummy.handlers = { onPress: () => {} };
    layout(dummy);
    dispatchInput(dummy, { type: 'pointerdown', x: 5, y: 5 });
    dispatchInput(dummy, { type: 'pointerup', x: 5, y: 5 });

    // Now pointerup without a pointerdown on root
    dispatchInput(root, { type: 'pointerup', x: 50, y: 50 });
    expect(onPress).not.toHaveBeenCalled();
  });
});
