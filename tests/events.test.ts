import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { hitTest, isInsideRoundedRect, createPointerEvent, dispatchEvent, EventManager } from '../src/events';
import type { Fiber } from '../src/types';
import type { LayoutOutput } from '../src/layout';

function createFiber(overrides: Partial<Fiber> = {}): Fiber {
  return {
    tag: 'host',
    type: 'View',
    props: {},
    key: null,
    parent: null,
    child: null,
    sibling: null,
    alternate: null,
    stateNode: null,
    effects: [],
    hooks: [],
    hookIndex: 0,
    ...overrides,
  };
}

function createLayout(x: number, y: number, width: number, height: number): LayoutOutput {
  return { x, y, width, height, children: [] };
}

describe('hitTest', () => {
  it('finds a fiber at given coordinates', () => {
    const fiber = createFiber();
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    const result = hitTest(fiber, layoutMap, 50, 50);
    expect(result).not.toBeNull();
    expect(result!.fiber).toBe(fiber);
  });

  it('returns null for coordinates outside any fiber', () => {
    const fiber = createFiber();
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    const result = hitTest(fiber, layoutMap, 150, 150);
    expect(result).toBeNull();
  });

  it('returns null when fiber has no layout', () => {
    const fiber = createFiber();
    const layoutMap = new Map<Fiber, LayoutOutput>();

    const result = hitTest(fiber, layoutMap, 50, 50);
    expect(result).toBeNull();
  });

  it('finds the deepest fiber at coordinates', () => {
    const child = createFiber({ type: 'Child' });
    const parent = createFiber({ child, type: 'Parent' });
    child.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 200, 200));
    layoutMap.set(child, createLayout(10, 10, 80, 80));

    const result = hitTest(parent, layoutMap, 50, 50);
    expect(result).not.toBeNull();
    expect(result!.fiber).toBe(child);
  });

  it('returns parent when point is outside child but inside parent', () => {
    const child = createFiber({ type: 'Child' });
    const parent = createFiber({ child, type: 'Parent' });
    child.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 200, 200));
    layoutMap.set(child, createLayout(10, 10, 80, 80));

    const result = hitTest(parent, layoutMap, 5, 5);
    expect(result).not.toBeNull();
    expect(result!.fiber).toBe(parent);
  });

  it('respects overflow: hidden by skipping children outside bounds', () => {
    const child = createFiber({ type: 'Child' });
    const parent = createFiber({
      child,
      type: 'Parent',
      props: { style: { overflow: 'hidden' as const } },
    });
    child.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 100, 100));
    // Child is positioned outside parent's bounds
    layoutMap.set(child, createLayout(120, 120, 50, 50));

    // Point inside child but outside parent - should return null due to overflow hidden
    const result = hitTest(parent, layoutMap, 130, 130);
    expect(result).toBeNull();
  });

  it('returns later children (higher z-order) first', () => {
    const child1 = createFiber({ type: 'First' });
    const child2 = createFiber({ type: 'Second' });
    child1.sibling = child2;

    const parent = createFiber({ child: child1, type: 'Parent' });
    child1.parent = parent;
    child2.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 200, 200));
    // Both children overlap at the same position
    layoutMap.set(child1, createLayout(10, 10, 80, 80));
    layoutMap.set(child2, createLayout(10, 10, 80, 80));

    const result = hitTest(parent, layoutMap, 50, 50);
    expect(result).not.toBeNull();
    expect(result!.fiber).toBe(child2); // Second child has higher z-order
  });

  it('handles nested fibers with offsets', () => {
    const grandchild = createFiber({ type: 'Grandchild' });
    const child = createFiber({ child: grandchild, type: 'Child' });
    const parent = createFiber({ child, type: 'Parent' });
    grandchild.parent = child;
    child.parent = parent;

    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(parent, createLayout(0, 0, 300, 300));
    layoutMap.set(child, createLayout(50, 50, 200, 200));
    layoutMap.set(grandchild, createLayout(10, 10, 50, 50));

    // Grandchild absolute position: parent(0,0) + child(50,50) + grandchild(10,10) = (60,60)
    const result = hitTest(parent, layoutMap, 70, 70);
    expect(result).not.toBeNull();
    expect(result!.fiber).toBe(grandchild);
    expect(result!.layout.x).toBe(60);
    expect(result!.layout.y).toBe(60);
  });

  it('does not return non-host fibers', () => {
    const fiber = createFiber({ tag: 'component' });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    const result = hitTest(fiber, layoutMap, 50, 50);
    expect(result).toBeNull();
  });

  it('returns result at the boundary edges', () => {
    const fiber = createFiber();
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    // Exactly on the edge
    expect(hitTest(fiber, layoutMap, 0, 0)).not.toBeNull();
    expect(hitTest(fiber, layoutMap, 100, 100)).not.toBeNull();
    expect(hitTest(fiber, layoutMap, 100, 0)).not.toBeNull();
    expect(hitTest(fiber, layoutMap, 0, 100)).not.toBeNull();

    // Just outside
    expect(hitTest(fiber, layoutMap, -1, 50)).toBeNull();
    expect(hitTest(fiber, layoutMap, 101, 50)).toBeNull();
    expect(hitTest(fiber, layoutMap, 50, -1)).toBeNull();
    expect(hitTest(fiber, layoutMap, 50, 101)).toBeNull();
  });
});

describe('isInsideRoundedRect', () => {
  it('returns true for a point in the center of a circle', () => {
    // 100x100 rect with borderRadius 50 = circle centered at (50,50)
    expect(isInsideRoundedRect(50, 50, 0, 0, 100, 100, 50)).toBe(true);
  });

  it('returns false for a point at the corner outside the circle', () => {
    // Point (1, 1) is in the top-left corner region, outside the arc
    expect(isInsideRoundedRect(1, 1, 0, 0, 100, 100, 50)).toBe(false);
  });

  it('returns true for a point on the edge of the arc', () => {
    // Circle centered at (50, 50) with radius 50; point on the edge at 45 degrees
    const edgeX = 50 - 50 * Math.cos(Math.PI / 4); // ~14.64
    const edgeY = 50 - 50 * Math.sin(Math.PI / 4); // ~14.64
    expect(isInsideRoundedRect(edgeX, edgeY, 0, 0, 100, 100, 50)).toBe(true);
  });
});

describe('hitTest with borderRadius', () => {
  it('returns fiber for a click inside the rounded shape', () => {
    const fiber = createFiber({
      props: { style: { borderRadius: 50 } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    // Center of the circle
    const result = hitTest(fiber, layoutMap, 50, 50);
    expect(result).not.toBeNull();
    expect(result!.fiber).toBe(fiber);
  });

  it('returns null for a click at the corner outside the rounded shape', () => {
    const fiber = createFiber({
      props: { style: { borderRadius: 50 } },
    });
    const layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(fiber, createLayout(0, 0, 100, 100));

    // Top-left corner, inside rect but outside circle
    const result = hitTest(fiber, layoutMap, 1, 1);
    expect(result).toBeNull();
  });
});

describe('createPointerEvent', () => {
  it('creates an event with correct type, coordinates, and target', () => {
    const fiber = createFiber();
    const event = createPointerEvent('press', 10, 20, fiber);
    expect(event.type).toBe('press');
    expect(event.x).toBe(10);
    expect(event.y).toBe(20);
    expect(event.target).toBe(fiber);
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it('creates event with null target', () => {
    const event = createPointerEvent('move', 0, 0, null);
    expect(event.target).toBeNull();
  });

  it('creates events of all types', () => {
    const fiber = createFiber();
    expect(createPointerEvent('press', 0, 0, fiber).type).toBe('press');
    expect(createPointerEvent('pressIn', 0, 0, fiber).type).toBe('pressIn');
    expect(createPointerEvent('pressOut', 0, 0, fiber).type).toBe('pressOut');
    expect(createPointerEvent('move', 0, 0, fiber).type).toBe('move');
  });
});

describe('preventDefault', () => {
  it('sets defaultPrevented to true', () => {
    const event = createPointerEvent('press', 0, 0, null) as any;
    expect(event.defaultPrevented).toBe(false);
    event.preventDefault();
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('stopPropagation', () => {
  it('sets propagationStopped to true', () => {
    const event = createPointerEvent('press', 0, 0, null) as any;
    expect(event.propagationStopped).toBe(false);
    event.stopPropagation();
    expect(event.propagationStopped).toBe(true);
  });
});

describe('dispatchEvent', () => {
  it('bubbles up from target to ancestors', () => {
    const callOrder: string[] = [];

    const grandparent = createFiber({
      type: 'Grandparent',
      props: { onPress: () => callOrder.push('grandparent') },
    });
    const parent = createFiber({
      type: 'Parent',
      parent: grandparent,
      props: { onPress: () => callOrder.push('parent') },
    });
    const child = createFiber({
      type: 'Child',
      parent,
      props: { onPress: () => callOrder.push('child') },
    });

    const event = createPointerEvent('press', 0, 0, child);
    dispatchEvent(event);

    expect(callOrder).toEqual(['child', 'parent', 'grandparent']);
  });

  it('stops propagation when stopPropagation is called', () => {
    const callOrder: string[] = [];

    const parent = createFiber({
      type: 'Parent',
      props: { onPress: () => callOrder.push('parent') },
    });
    const child = createFiber({
      type: 'Child',
      parent,
      props: {
        onPress: (e: any) => {
          callOrder.push('child');
          e.stopPropagation();
        },
      },
    });

    const event = createPointerEvent('press', 0, 0, child);
    dispatchEvent(event);

    expect(callOrder).toEqual(['child']);
  });

  it('calls correct handler for pressIn', () => {
    const handler = mock(() => {});
    const fiber = createFiber({ props: { onPressIn: handler } });

    const event = createPointerEvent('pressIn', 10, 20, fiber);
    dispatchEvent(event);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('calls correct handler for pressOut', () => {
    const handler = mock(() => {});
    const fiber = createFiber({ props: { onPressOut: handler } });

    const event = createPointerEvent('pressOut', 10, 20, fiber);
    dispatchEvent(event);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not call handler for move events (no onMove handler)', () => {
    const pressHandler = mock(() => {});
    const fiber = createFiber({ props: { onPress: pressHandler } });

    const event = createPointerEvent('move', 10, 20, fiber);
    dispatchEvent(event);

    expect(pressHandler).not.toHaveBeenCalled();
  });

  it('skips fibers without handlers during bubbling', () => {
    const callOrder: string[] = [];

    const grandparent = createFiber({
      type: 'Grandparent',
      props: { onPress: () => callOrder.push('grandparent') },
    });
    const parent = createFiber({
      type: 'Parent',
      parent: grandparent,
      props: {}, // No handler
    });
    const child = createFiber({
      type: 'Child',
      parent,
      props: { onPress: () => callOrder.push('child') },
    });

    const event = createPointerEvent('press', 0, 0, child);
    dispatchEvent(event);

    expect(callOrder).toEqual(['child', 'grandparent']);
  });

  it('handles null target gracefully', () => {
    const event = createPointerEvent('press', 0, 0, null);
    // Should not throw
    dispatchEvent(event);
  });
});

describe('EventManager', () => {
  let manager: EventManager;
  let rootFiber: Fiber;
  let childFiber: Fiber;
  let layoutMap: Map<Fiber, LayoutOutput>;

  beforeEach(() => {
    manager = new EventManager();

    childFiber = createFiber({ type: 'Child' });
    rootFiber = createFiber({ child: childFiber, type: 'Root' });
    childFiber.parent = rootFiber;

    layoutMap = new Map<Fiber, LayoutOutput>();
    layoutMap.set(rootFiber, createLayout(0, 0, 400, 800));
    layoutMap.set(childFiber, createLayout(50, 50, 100, 100));

    manager.setRoot(rootFiber, layoutMap);
  });

  it('handlePointerDown triggers pressIn on target', () => {
    const handler = mock(() => {});
    childFiber.props = { onPressIn: handler };

    manager.handlePointerDown(75, 75);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handlePointerDown does nothing without root', () => {
    const noRootManager = new EventManager();
    // Should not throw
    noRootManager.handlePointerDown(50, 50);
  });

  it('handlePointerUp triggers pressOut and press when same target', () => {
    const pressIn = mock(() => {});
    const pressOut = mock(() => {});
    const press = mock(() => {});
    childFiber.props = { onPressIn: pressIn, onPressOut: pressOut, onPress: press };

    manager.handlePointerDown(75, 75);
    manager.handlePointerUp(75, 75);

    expect(pressIn).toHaveBeenCalledTimes(1);
    expect(pressOut).toHaveBeenCalledTimes(1);
    expect(press).toHaveBeenCalledTimes(1);
  });

  it('handlePointerUp triggers pressOut but not press when released outside original bounds', () => {
    const pressOut = mock(() => {});
    const press = mock(() => {});
    // pressOut is dispatched on the current hit target at release position (rootFiber),
    // so put the handler on rootFiber to verify it fires
    rootFiber.props = { onPressOut: pressOut };
    childFiber.props = { onPress: press };

    manager.handlePointerDown(75, 75); // on child (bounds: 50,50 to 150,150)
    manager.handlePointerUp(5, 5); // outside child bounds, on root

    expect(pressOut).toHaveBeenCalledTimes(1);
    expect(press).not.toHaveBeenCalled();
  });

  it('handlePointerUp does nothing without prior press', () => {
    const press = mock(() => {});
    childFiber.props = { onPress: press };

    manager.handlePointerUp(75, 75);
    expect(press).not.toHaveBeenCalled();
  });

  it('handlePointerUp does nothing without root', () => {
    const noRootManager = new EventManager();
    // Should not throw
    noRootManager.handlePointerUp(50, 50);
  });

  it('handlePointerMove does nothing without root', () => {
    const noRootManager = new EventManager();
    // Should not throw
    noRootManager.handlePointerMove(50, 50);
  });

  it('handlePointerMove triggers move event on target', () => {
    // move events don't have a handler in getEventHandler, but the flow should work
    manager.handlePointerMove(75, 75);
    // No crash expected
  });

  it('handlePointerDown with no target at coordinates', () => {
    const handler = mock(() => {});
    childFiber.props = { onPressIn: handler };

    manager.handlePointerDown(350, 750); // Outside child, on root
    // pressIn is on root, but root may or may not have a handler
    // The point is it shouldn't crash
  });

  describe('attach', () => {
    it('attaches event listeners and returns detach function', () => {
      const addListener = mock(() => {});
      const removeListener = mock(() => {});
      const mockCanvas = {
        addEventListener: addListener,
        removeEventListener: removeListener,
        getBoundingClientRect: () => ({ width: 400, height: 800, left: 0, top: 0 }),
      } as any;

      const detach = manager.attach(mockCanvas);

      // Should have attached 6 listeners (mousedown, mouseup, mousemove, touchstart, touchend, touchmove)
      expect(addListener).toHaveBeenCalledTimes(6);

      detach();
      expect(removeListener).toHaveBeenCalledTimes(6);
    });

    it('attaches touch listeners with passive: false', () => {
      const addCalls: any[] = [];
      const mockCanvas = {
        addEventListener: (...args: any[]) => addCalls.push(args),
        removeEventListener: () => {},
        getBoundingClientRect: () => ({ width: 400, height: 800, left: 0, top: 0 }),
      } as any;

      manager.attach(mockCanvas);

      const touchStart = addCalls.find(c => c[0] === 'touchstart');
      expect(touchStart).toBeDefined();
      expect(touchStart[2]).toEqual({ passive: false });

      const touchEnd = addCalls.find(c => c[0] === 'touchend');
      expect(touchEnd).toBeDefined();
      expect(touchEnd[2]).toEqual({ passive: false });

      const touchMove = addCalls.find(c => c[0] === 'touchmove');
      expect(touchMove).toBeDefined();
      expect(touchMove[2]).toEqual({ passive: false });
    });
  });
});
