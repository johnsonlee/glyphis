import { describe, it, expect, mock } from 'bun:test';
import {
  hitTestNode,
  createNodePointerEvent,
  dispatchNodeEvent,
  NodeEventManager,
} from '../src/react/event-handler';
import { GlyphNode, HOST_TYPES } from '../src/react/glyph-node';
import type { LayoutOutput } from '../src/layout';

function createLayout(x: number, y: number, w: number, h: number, children: LayoutOutput[] = []): LayoutOutput {
  return { x, y, width: w, height: h, children };
}

describe('hitTestNode', () => {
  it('finds deepest node at coordinates', () => {
    const root = new GlyphNode(HOST_TYPES.ROOT, {});
    const parent = new GlyphNode('glyph-view', {});
    const child = new GlyphNode('glyph-view', {});
    root.appendChild(parent);
    parent.appendChild(child);

    const layoutMap = new Map<GlyphNode, LayoutOutput>();
    layoutMap.set(root, createLayout(0, 0, 400, 400, []));
    layoutMap.set(parent, createLayout(0, 0, 200, 200, []));
    layoutMap.set(child, createLayout(10, 10, 50, 50, []));

    // Hit within child bounds (offset by parent: 10+0=10, 10+0=10)
    const result = hitTestNode(root, layoutMap, 15, 15);
    expect(result).not.toBeNull();
    expect(result!.node).toBe(child);
  });

  it('returns null for coordinates outside all nodes', () => {
    const root = new GlyphNode(HOST_TYPES.ROOT, {});
    const child = new GlyphNode('glyph-view', {});
    root.appendChild(child);

    const layoutMap = new Map<GlyphNode, LayoutOutput>();
    layoutMap.set(root, createLayout(0, 0, 100, 100));
    layoutMap.set(child, createLayout(10, 10, 50, 50));

    // Outside root: hitTestNode excludes ROOT type from results
    const result = hitTestNode(root, layoutMap, 500, 500);
    expect(result).toBeNull();
  });

  it('returns null for coordinates inside root but outside children', () => {
    const root = new GlyphNode(HOST_TYPES.ROOT, {});
    const child = new GlyphNode('glyph-view', {});
    root.appendChild(child);

    const layoutMap = new Map<GlyphNode, LayoutOutput>();
    layoutMap.set(root, createLayout(0, 0, 400, 400));
    layoutMap.set(child, createLayout(10, 10, 50, 50));

    // Inside root but outside child -- ROOT is excluded from results
    const result = hitTestNode(root, layoutMap, 300, 300);
    expect(result).toBeNull();
  });

  it('checks children in reverse order (z-order)', () => {
    const root = new GlyphNode(HOST_TYPES.ROOT, {});
    const below = new GlyphNode('glyph-view', { testID: 'below' });
    const above = new GlyphNode('glyph-view', { testID: 'above' });
    root.appendChild(below);
    root.appendChild(above);

    const layoutMap = new Map<GlyphNode, LayoutOutput>();
    layoutMap.set(root, createLayout(0, 0, 400, 400));
    // Overlapping layouts
    layoutMap.set(below, createLayout(0, 0, 100, 100));
    layoutMap.set(above, createLayout(0, 0, 100, 100));

    const result = hitTestNode(root, layoutMap, 50, 50);
    expect(result).not.toBeNull();
    expect(result!.node).toBe(above); // last child = topmost
  });

  it('respects overflow hidden clipping', () => {
    const root = new GlyphNode(HOST_TYPES.ROOT, {});
    const parent = new GlyphNode('glyph-view', { style: { overflow: 'hidden' } });
    const child = new GlyphNode('glyph-view', {});
    root.appendChild(parent);
    parent.appendChild(child);

    const layoutMap = new Map<GlyphNode, LayoutOutput>();
    layoutMap.set(root, createLayout(0, 0, 400, 400));
    layoutMap.set(parent, createLayout(0, 0, 50, 50));
    // Child extends beyond parent
    layoutMap.set(child, createLayout(0, 0, 200, 200));

    // Point outside parent bounds but inside child
    const result = hitTestNode(root, layoutMap, 100, 100);
    expect(result).toBeNull();
  });

  it('returns correct layout coordinates', () => {
    const root = new GlyphNode(HOST_TYPES.ROOT, {});
    const child = new GlyphNode('glyph-view', {});
    root.appendChild(child);

    const layoutMap = new Map<GlyphNode, LayoutOutput>();
    layoutMap.set(root, createLayout(0, 0, 400, 400));
    layoutMap.set(child, createLayout(20, 30, 100, 50));

    const result = hitTestNode(root, layoutMap, 50, 40);
    expect(result).not.toBeNull();
    expect(result!.layout).toEqual({ x: 20, y: 30, width: 100, height: 50 });
  });
});

describe('createNodePointerEvent', () => {
  it('creates event with correct shape', () => {
    const target = new GlyphNode('glyph-view', {});
    const event = createNodePointerEvent('press', 100, 200, target);
    expect(event.type).toBe('press');
    expect(event.x).toBe(100);
    expect(event.y).toBe(200);
    expect(event.target).toBe(target);
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.defaultPrevented).toBe(false);
    expect((event as any).propagationStopped).toBe(false);
  });

  it('preventDefault sets defaultPrevented', () => {
    const event = createNodePointerEvent('press', 0, 0, null);
    event.preventDefault();
    expect(event.defaultPrevented).toBe(true);
  });

  it('stopPropagation sets propagationStopped', () => {
    const event = createNodePointerEvent('press', 0, 0, null);
    event.stopPropagation();
    expect((event as any).propagationStopped).toBe(true);
  });
});

describe('dispatchNodeEvent', () => {
  it('bubbles through parent chain', () => {
    const grandparent = new GlyphNode('glyph-view', {});
    const parent = new GlyphNode('glyph-view', {});
    const child = new GlyphNode('glyph-view', {});
    grandparent.appendChild(parent);
    parent.appendChild(child);

    const calls: string[] = [];
    child.props.onPress = () => calls.push('child');
    parent.props.onPress = () => calls.push('parent');
    grandparent.props.onPress = () => calls.push('grandparent');

    const event = createNodePointerEvent('press', 0, 0, child);
    dispatchNodeEvent(event as any);

    expect(calls).toEqual(['child', 'parent', 'grandparent']);
  });

  it('stops propagation when stopPropagation is called', () => {
    const parent = new GlyphNode('glyph-view', {});
    const child = new GlyphNode('glyph-view', {});
    parent.appendChild(child);

    const calls: string[] = [];
    child.props.onPress = (e) => { calls.push('child'); e.stopPropagation(); };
    parent.props.onPress = () => calls.push('parent');

    const event = createNodePointerEvent('press', 0, 0, child);
    dispatchNodeEvent(event as any);

    expect(calls).toEqual(['child']);
  });

  it('dispatches pressIn events', () => {
    const node = new GlyphNode('glyph-view', {});
    const handler = mock(() => {});
    node.props.onPressIn = handler;

    const event = createNodePointerEvent('pressIn', 10, 20, node);
    dispatchNodeEvent(event as any);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches pressOut events', () => {
    const node = new GlyphNode('glyph-view', {});
    const handler = mock(() => {});
    node.props.onPressOut = handler;

    const event = createNodePointerEvent('pressOut', 10, 20, node);
    dispatchNodeEvent(event as any);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('skips nodes without handlers', () => {
    const parent = new GlyphNode('glyph-view', {});
    const child = new GlyphNode('glyph-view', {});
    parent.appendChild(child);

    const parentHandler = mock(() => {});
    parent.props.onPress = parentHandler;
    // child has no onPress

    const event = createNodePointerEvent('press', 0, 0, child);
    dispatchNodeEvent(event as any);

    expect(parentHandler).toHaveBeenCalledTimes(1);
  });
});

describe('NodeEventManager', () => {
  function setupManager() {
    const root = new GlyphNode(HOST_TYPES.ROOT, {});
    const button = new GlyphNode('glyph-view', {});
    root.appendChild(button);

    const layoutMap = new Map<GlyphNode, LayoutOutput>();
    layoutMap.set(root, createLayout(0, 0, 400, 400));
    layoutMap.set(button, createLayout(10, 10, 100, 50));

    const em = new NodeEventManager();
    em.setRoot(root, layoutMap);

    return { root, button, layoutMap, em };
  }

  it('handlePointerDown triggers pressIn', () => {
    const { button, em } = setupManager();
    const handler = mock(() => {});
    button.props.onPressIn = handler;

    em.handlePointerDown(50, 30);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handlePointerUp triggers pressOut and press', () => {
    const { button, em } = setupManager();
    const pressOut = mock(() => {});
    const press = mock(() => {});
    button.props.onPressOut = pressOut;
    button.props.onPress = press;

    em.handlePointerDown(50, 30);
    em.handlePointerUp(50, 30);

    expect(pressOut).toHaveBeenCalledTimes(1);
    expect(press).toHaveBeenCalledTimes(1);
  });

  it('press only fires when pointer up is within original bounds', () => {
    const { button, em } = setupManager();
    const press = mock(() => {});
    button.props.onPress = press;

    em.handlePointerDown(50, 30);
    // Release far outside button
    em.handlePointerUp(350, 350);

    expect(press).not.toHaveBeenCalled();
  });

  it('pressOut still fires even when outside bounds', () => {
    const { button, em } = setupManager();
    const pressOut = mock(() => {});
    button.props.onPressOut = pressOut;

    em.handlePointerDown(50, 30);
    em.handlePointerUp(350, 350);

    expect(pressOut).toHaveBeenCalledTimes(1);
  });

  it('no events when pointer down misses all nodes', () => {
    const { button, em } = setupManager();
    const pressIn = mock(() => {});
    const press = mock(() => {});
    button.props.onPressIn = pressIn;
    button.props.onPress = press;

    em.handlePointerDown(350, 350);
    em.handlePointerUp(350, 350);

    expect(pressIn).not.toHaveBeenCalled();
    expect(press).not.toHaveBeenCalled();
  });

  it('does nothing without setRoot', () => {
    const em = new NodeEventManager();
    // Should not throw
    em.handlePointerDown(50, 50);
    em.handlePointerUp(50, 50);
  });

  it('handlePointerMove is a no-op', () => {
    const { em } = setupManager();
    // Should not throw
    em.handlePointerMove(50, 50);
  });
});
