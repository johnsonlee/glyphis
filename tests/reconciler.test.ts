import { describe, it, expect, beforeEach } from 'bun:test';
import { createReconciler } from '../src/reconciler';
import type { ReconcilerHost } from '../src/reconciler';
import type { VNode, Fiber, VNodeProps } from '../src/types';
import { Fragment, TextNode } from '../src/types';
import { setCurrentFiber } from '../src/hooks';

interface TrackedCall {
  method: string;
  fiber: Fiber;
  prevProps?: VNodeProps;
  nextProps?: VNodeProps;
}

function createMockHost() {
  const calls: TrackedCall[] = [];
  const nodes = new Map<Fiber, any>();

  const host: ReconcilerHost = {
    createNode(fiber: Fiber) {
      const node = { type: fiber.type, props: fiber.props };
      nodes.set(fiber, node);
      calls.push({ method: 'createNode', fiber });
      return node;
    },
    updateNode(fiber: Fiber, prevProps: VNodeProps, nextProps: VNodeProps) {
      calls.push({ method: 'updateNode', fiber, prevProps, nextProps });
    },
    removeNode(fiber: Fiber) {
      calls.push({ method: 'removeNode', fiber });
      nodes.delete(fiber);
    },
    commitEffects(fiber: Fiber) {
      calls.push({ method: 'commitEffects', fiber });
    },
  };

  return { host, calls, nodes };
}

function createElement(
  type: any,
  props?: Record<string, any> | null,
  ...children: any[]
): VNode {
  const flatChildren: any[] = [];
  for (const child of children) {
    if (Array.isArray(child)) {
      flatChildren.push(...child);
    } else {
      flatChildren.push(child);
    }
  }

  return {
    type,
    props: {
      ...(props || {}),
      children: flatChildren,
    },
    key: props?.key ?? null,
  };
}

async function flush() {
  // Let microtasks run
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}

describe('reconciler', () => {
  let mockHost: ReturnType<typeof createMockHost>;
  let reconciler: ReturnType<typeof createReconciler>;
  let container: any;

  beforeEach(() => {
    mockHost = createMockHost();
    reconciler = createReconciler(mockHost.host);
    container = { type: 'root' };
  });

  describe('basic rendering', () => {
    it('renders a simple host element', async () => {
      const element = createElement('View', null);
      reconciler.render(element, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
      expect(createCalls[0].fiber.type).toBe('View');
    });

    it('renders nested host elements', async () => {
      const element = createElement(
        'View',
        null,
        createElement('Text', null),
        createElement('View', null),
      );
      reconciler.render(element, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      const types = createCalls.map((c) => c.fiber.type);
      expect(types).toContain('View');
      expect(types).toContain('Text');
    });
  });

  describe('text nodes', () => {
    it('renders string children as text fibers', async () => {
      const element = createElement('Text', null, 'Hello');
      reconciler.render(element, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      const textFibers = createCalls.filter((c) => c.fiber.type === TextNode);
      expect(textFibers.length).toBe(1);
      expect(textFibers[0].fiber.props.nodeValue).toBe('Hello');
    });

    it('renders number children as text fibers', async () => {
      const element = createElement('Text', null, 42);
      reconciler.render(element, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      const textFibers = createCalls.filter((c) => c.fiber.type === TextNode);
      expect(textFibers.length).toBe(1);
      expect(textFibers[0].fiber.props.nodeValue).toBe('42');
    });
  });

  describe('conditional rendering', () => {
    it('skips null children', async () => {
      const element = createElement('View', null, null, createElement('Text', null));
      reconciler.render(element, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      // Should have View and Text, but not a null node
      const types = createCalls.map((c) => c.fiber.type);
      expect(types).not.toContain(null);
    });

    it('skips undefined children', async () => {
      const element = createElement('View', null, undefined, createElement('Text', null));
      reconciler.render(element, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      expect(createCalls.some((c) => c.fiber.type === 'Text')).toBe(true);
    });

    it('skips boolean children', async () => {
      const element = createElement('View', null, true, false, createElement('Text', null));
      reconciler.render(element, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      expect(createCalls.some((c) => c.fiber.type === 'Text')).toBe(true);
    });
  });

  describe('component rendering', () => {
    it('calls function components with props', async () => {
      let receivedProps: any;
      const MyComponent = (props: any) => {
        receivedProps = props;
        return createElement('View', null);
      };

      const element = createElement(MyComponent, { title: 'hello' });
      reconciler.render(element, container);
      await flush();

      expect(receivedProps.title).toBe('hello');
    });

    it('renders nested components', async () => {
      const Inner = () => createElement('Text', null, 'inner');
      const Outer = () => createElement('View', null, createElement(Inner, null));

      const element = createElement(Outer, null);
      reconciler.render(element, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      const types = createCalls.map((c) => c.fiber.type);
      expect(types).toContain('View');
      expect(types).toContain(TextNode);
    });

    it('handles components returning null', async () => {
      const NullComponent = () => null;
      const element = createElement('View', null, createElement(NullComponent, null));
      reconciler.render(element, container);
      await flush();

      // Should not throw
      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      expect(createCalls.some((c) => c.fiber.type === 'View')).toBe(true);
    });
  });

  describe('fragment support', () => {
    it('renders Fragment children without creating a node for the Fragment', async () => {
      const element = createElement(
        'View',
        null,
        createElement(Fragment, null, createElement('Text', null, 'A'), createElement('Text', null, 'B')),
      );
      reconciler.render(element, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      // Fragment itself should not generate a createNode call
      const fragmentCreates = createCalls.filter((c) => c.fiber.type === Fragment);
      expect(fragmentCreates.length).toBe(0);

      // Text nodes under the fragment should be created
      const textCreates = createCalls.filter((c) => c.fiber.type === TextNode);
      expect(textCreates.length).toBe(2);
    });
  });

  describe('re-rendering', () => {
    it('marks updated nodes with update effect', async () => {
      const element1 = createElement('View', { color: 'red' });
      reconciler.render(element1, container);
      await flush();

      mockHost.calls.length = 0;

      const element2 = createElement('View', { color: 'blue' });
      reconciler.render(element2, container);
      await flush();

      const updateCalls = mockHost.calls.filter((c) => c.method === 'updateNode');
      expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('adding children', () => {
    it('new children get placement effect', async () => {
      const element1 = createElement('View', null, createElement('Text', { key: 'a' }, 'A'));
      reconciler.render(element1, container);
      await flush();

      mockHost.calls.length = 0;

      const element2 = createElement(
        'View',
        null,
        createElement('Text', { key: 'a' }, 'A'),
        createElement('Text', { key: 'b' }, 'B'),
      );
      reconciler.render(element2, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      // The new 'b' text node should be created
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('removing children', () => {
    it('removed children get deletion effect', async () => {
      const element1 = createElement(
        'View',
        null,
        createElement('Text', { key: 'a' }, 'A'),
        createElement('Text', { key: 'b' }, 'B'),
      );
      reconciler.render(element1, container);
      await flush();

      mockHost.calls.length = 0;

      const element2 = createElement(
        'View',
        null,
        createElement('Text', { key: 'a' }, 'A'),
      );
      reconciler.render(element2, container);
      await flush();

      const removeCalls = mockHost.calls.filter((c) => c.method === 'removeNode');
      expect(removeCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('reordering with keys', () => {
    it('keyed children are correctly matched', async () => {
      const element1 = createElement(
        'View',
        null,
        createElement('Text', { key: 'a' }, 'A'),
        createElement('Text', { key: 'b' }, 'B'),
        createElement('Text', { key: 'c' }, 'C'),
      );
      reconciler.render(element1, container);
      await flush();

      mockHost.calls.length = 0;

      // Reverse order
      const element2 = createElement(
        'View',
        null,
        createElement('Text', { key: 'c' }, 'C'),
        createElement('Text', { key: 'b' }, 'B'),
        createElement('Text', { key: 'a' }, 'A'),
      );
      reconciler.render(element2, container);
      await flush();

      // Should be updates, not create+delete
      const removeCalls = mockHost.calls.filter((c) => c.method === 'removeNode');
      expect(removeCalls.length).toBe(0);

      const updateCalls = mockHost.calls.filter((c) => c.method === 'updateNode');
      expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('correctly handles mixed keyed and unkeyed children', async () => {
      const element1 = createElement(
        'View',
        null,
        createElement('Text', { key: 'a' }, 'A'),
        createElement('View', null),
      );
      reconciler.render(element1, container);
      await flush();

      // Should create both without error
      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      expect(createCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('effect lifecycle', () => {
    it('runs effects after commit', async () => {
      let effectRan = false;
      const { useState, useEffect } = await import('../src/hooks');

      const MyComponent = (props: any) => {
        useEffect(() => {
          effectRan = true;
        }, []);
        return createElement('View', null);
      };

      const element = createElement(MyComponent, null);
      reconciler.render(element, container);
      await flush();

      expect(effectRan).toBe(true);
    });

    it('runs cleanup on unmount via deletion', async () => {
      let cleanupRan = false;
      const { useEffect } = await import('../src/hooks');

      const MyComponent = (props: any) => {
        useEffect(() => {
          return () => {
            cleanupRan = true;
          };
        }, []);
        return createElement('View', null);
      };

      // First render with the component
      const element1 = createElement('View', null, createElement(MyComponent, null));
      reconciler.render(element1, container);
      await flush();

      // Run the effect to register the cleanup
      expect(cleanupRan).toBe(false);

      // Second render without the component
      const element2 = createElement('View', null);
      reconciler.render(element2, container);
      await flush();

      expect(cleanupRan).toBe(true);
    });
  });

  describe('multiple re-renders', () => {
    it('state updates trigger re-reconciliation', async () => {
      let renderCount = 0;
      const { useState } = await import('../src/hooks');

      let setCounter: any;
      const Counter = () => {
        const [count, setCount] = useState(0);
        setCounter = setCount;
        renderCount++;
        return createElement('Text', null, String(count));
      };

      const element = createElement(Counter, null);
      reconciler.render(element, container);
      await flush();

      expect(renderCount).toBe(1);

      // Trigger a state update
      setCounter(1);
      await flush();

      expect(renderCount).toBe(2);
    });
  });

  describe('createReconciler return value', () => {
    it('returns render and scheduleUpdate functions', () => {
      expect(typeof reconciler.render).toBe('function');
      expect(typeof reconciler.scheduleUpdate).toBe('function');
    });
  });

  describe('fiber tree structure', () => {
    it('builds correct parent-child-sibling relationships', async () => {
      let capturedFiber: Fiber | null = null;
      const { getCurrentFiber } = await import('../src/hooks');

      const Child = () => {
        capturedFiber = getCurrentFiber();
        return createElement('Text', null, 'child');
      };

      const element = createElement(
        'View',
        null,
        createElement(Child, null),
      );
      reconciler.render(element, container);
      await flush();

      expect(capturedFiber).not.toBeNull();
      expect(capturedFiber!.tag).toBe('component');
      expect(capturedFiber!.parent).not.toBeNull();
    });
  });

  describe('double buffering', () => {
    it('alternate links current and WIP trees', async () => {
      let capturedFiber: Fiber | null = null;
      const { getCurrentFiber, useState } = await import('../src/hooks');

      let setVal: any;
      const MyComp = () => {
        const [val, sv] = useState(0);
        setVal = sv;
        capturedFiber = getCurrentFiber();
        return createElement('View', null);
      };

      reconciler.render(createElement(MyComp, null), container);
      await flush();

      const firstFiber = capturedFiber;

      setVal(1);
      await flush();

      // On re-render, the new fiber should have alternate pointing to old
      if (capturedFiber && capturedFiber !== firstFiber) {
        expect(capturedFiber!.alternate).not.toBeNull();
      }
    });
  });

  describe('edge cases', () => {
    it('handles empty children array', async () => {
      const element = createElement('View', null);
      reconciler.render(element, container);
      await flush();

      // Should not throw
      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('handles deeply nested trees', async () => {
      const element = createElement(
        'View',
        null,
        createElement(
          'View',
          null,
          createElement(
            'View',
            null,
            createElement('Text', null, 'deep'),
          ),
        ),
      );
      reconciler.render(element, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      expect(createCalls.length).toBeGreaterThanOrEqual(4);
    });

    it('renders with string keys correctly', async () => {
      const element = createElement(
        'View',
        null,
        createElement('Text', { key: 'item-1' }, '1'),
        createElement('Text', { key: 'item-2' }, '2'),
      );
      reconciler.render(element, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      expect(createCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('handles nested arrays in children (flattenChildren)', async () => {
      // Children that are arrays should be flattened
      const element: VNode = {
        type: 'View',
        props: {
          children: [
            [createElement('Text', { key: 'a' }, 'A'), createElement('Text', { key: 'b' }, 'B')],
          ],
        },
        key: null,
      };
      reconciler.render(element, container);
      await flush();

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      const textCreates = createCalls.filter((c) => c.fiber.type === TextNode);
      expect(textCreates.length).toBe(2);
    });

    it('replaces child when type changes (type mismatch)', async () => {
      // First render: child is a Text
      const element1 = createElement(
        'View',
        null,
        createElement('Text', { key: 'x' }, 'hello'),
      );
      reconciler.render(element1, container);
      await flush();

      mockHost.calls.length = 0;

      // Second render: same key but different type
      const element2 = createElement(
        'View',
        null,
        createElement('View', { key: 'x' }),
      );
      reconciler.render(element2, container);
      await flush();

      // Old Text should be removed, new View should be created
      const removeCalls = mockHost.calls.filter((c) => c.method === 'removeNode');
      expect(removeCalls.length).toBeGreaterThanOrEqual(1);

      const createCalls = mockHost.calls.filter((c) => c.method === 'createNode');
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('runs effect cleanup on re-render when deps change', async () => {
      let cleanupCount = 0;
      let effectCount = 0;
      const { useEffect, useState } = await import('../src/hooks');

      let setVal: any;
      const MyComp = () => {
        const [val, sv] = useState(0);
        setVal = sv;
        useEffect(() => {
          effectCount++;
          return () => {
            cleanupCount++;
          };
        }, [val]);
        return createElement('View', null);
      };

      reconciler.render(createElement(MyComp, null), container);
      await flush();

      expect(effectCount).toBe(1);
      expect(cleanupCount).toBe(0);

      // Trigger a state change to cause effect deps to change
      setVal(1);
      await flush();

      // Cleanup from first effect should have run, new effect should have run
      expect(cleanupCount).toBe(1);
      expect(effectCount).toBe(2);
    });
  });
});
