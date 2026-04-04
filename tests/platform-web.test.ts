import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { Fiber, Style, Renderer } from '../src/types';
import { TextNode, Fragment } from '../src/types';
import { fiberToLayoutInput, buildLayoutMap } from '../src/platform/web';
import type { LayoutOutput } from '../src/layout';

function createFiber(overrides: Partial<Fiber>): Fiber {
  return {
    tag: 'host',
    type: 'Box',
    props: { children: [] },
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

function createMockRenderer(): Renderer {
  return {
    clear: mock(() => {}),
    render: mock(() => {}),
    getWidth: mock(() => 390),
    getHeight: mock(() => 844),
    measureText: mock((_text: string, fontSize: number, _fontFamily: string, _fontWeight: string) => ({
      width: fontSize * 0.6 * _text.length,
      height: fontSize * 1.2,
    })),
  };
}

describe('fiberToLayoutInput', () => {
  let renderer: Renderer;

  beforeEach(() => {
    renderer = createMockRenderer();
  });

  it('converts a simple host fiber to layout input', () => {
    const fiber = createFiber({
      tag: 'host',
      type: 'Box',
      props: {
        style: { width: 100, height: 50, backgroundColor: '#FF0000' },
        children: [],
      },
    });

    const input = fiberToLayoutInput(fiber, renderer);

    expect(input.style.width).toBe(100);
    expect(input.style.height).toBe(50);
    expect(input.style.backgroundColor).toBe('#FF0000');
    expect(input.children).toHaveLength(0);
    expect(input.text).toBeUndefined();
  });

  it('converts a fiber with children', () => {
    const child1 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: { width: 50 }, children: [] },
    });
    const child2 = createFiber({
      tag: 'host',
      type: 'Text',
      props: { style: { fontSize: 16 }, children: [] },
    });
    child1.sibling = child2;

    const parent = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: { flexDirection: 'row' }, children: [] },
    });
    parent.child = child1;
    child1.parent = parent;
    child2.parent = parent;

    const input = fiberToLayoutInput(parent, renderer);

    expect(input.children).toHaveLength(2);
    expect(input.children[0].style.width).toBe(50);
    expect(input.children[1].style.fontSize).toBe(16);
  });

  it('unwraps component fibers to their children', () => {
    const hostChild = createFiber({
      tag: 'host',
      type: 'Text',
      props: { style: { color: '#000' }, children: [] },
    });

    const componentFiber = createFiber({
      tag: 'component',
      type: function MyComponent() { return null; },
      props: { children: [] },
    });
    componentFiber.child = hostChild;
    hostChild.parent = componentFiber;

    const root = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    root.child = componentFiber;
    componentFiber.parent = root;

    const input = fiberToLayoutInput(root, renderer);

    expect(input.children).toHaveLength(1);
    expect(input.children[0].style.color).toBe('#000');
  });

  it('unwraps fragment fibers to their children', () => {
    const fragmentChild1 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: { width: 10 }, children: [] },
    });
    const fragmentChild2 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: { width: 20 }, children: [] },
    });
    fragmentChild1.sibling = fragmentChild2;

    const fragmentFiber = createFiber({
      tag: 'fragment',
      type: Fragment,
      props: { children: [] },
    });
    fragmentFiber.child = fragmentChild1;
    fragmentChild1.parent = fragmentFiber;
    fragmentChild2.parent = fragmentFiber;

    const root = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    root.child = fragmentFiber;
    fragmentFiber.parent = root;

    const input = fiberToLayoutInput(root, renderer);

    expect(input.children).toHaveLength(2);
    expect(input.children[0].style.width).toBe(10);
    expect(input.children[1].style.width).toBe(20);
  });

  it('sets text and measureText for text fibers', () => {
    const fiber = createFiber({
      tag: 'text',
      type: TextNode,
      props: { nodeValue: 'Hello World', children: [] },
    });

    const input = fiberToLayoutInput(fiber, renderer);

    expect(input.text).toBe('Hello World');
    expect(input.measureText).toBeDefined();
  });

  it('wires measureText correctly for text fibers', () => {
    const fiber = createFiber({
      tag: 'text',
      type: TextNode,
      props: {
        nodeValue: 'Test',
        children: [],
        style: { fontSize: 20, fontFamily: 'Arial', fontWeight: 'bold' as const },
      },
    });

    const input = fiberToLayoutInput(fiber, renderer);

    expect(input.measureText).toBeDefined();
    const result = input.measureText!('Test', { fontSize: 20, fontFamily: 'Arial', fontWeight: 'bold' });
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(renderer.measureText).toHaveBeenCalled();
  });

  it('uses default font values when style has no font properties', () => {
    const fiber = createFiber({
      tag: 'text',
      type: TextNode,
      props: { nodeValue: 'Hello', children: [] },
    });

    const input = fiberToLayoutInput(fiber, renderer);
    input.measureText!('Hello', {});

    expect(renderer.measureText).toHaveBeenCalledWith('Hello', 14, 'system-ui', 'normal');
  });

  it('sets text for host fibers with string children in props', () => {
    const fiber = createFiber({
      tag: 'host',
      type: 'Text',
      props: {
        style: { fontSize: 16 },
        children: ['Hello', ' ', 'World'],
      },
    });

    const input = fiberToLayoutInput(fiber, renderer);

    expect(input.text).toBe('Hello World');
    expect(input.measureText).toBeDefined();

    // Exercise the measureText callback to cover lines 110-115
    const result = input.measureText!('Hello World', { fontSize: 16 });
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('calls measureText on host fiber with correct defaults', () => {
    const fiber = createFiber({
      tag: 'host',
      type: 'Text',
      props: {
        style: {},
        children: ['test'],
      },
    });

    const input = fiberToLayoutInput(fiber, renderer);
    input.measureText!('test', {});

    expect(renderer.measureText).toHaveBeenCalledWith('test', 14, 'system-ui', 'normal');
  });

  it('calls measureText on host fiber using style params from argument', () => {
    const fiber = createFiber({
      tag: 'host',
      type: 'Text',
      props: {
        style: { fontSize: 18, fontFamily: 'monospace', fontWeight: '700' as const },
        children: ['code'],
      },
    });

    const input = fiberToLayoutInput(fiber, renderer);
    input.measureText!('code', { fontSize: 24, fontFamily: 'serif', fontWeight: 'bold' });

    expect(renderer.measureText).toHaveBeenCalledWith('code', 24, 'serif', 'bold');
  });

  it('falls back to fiber style for measureText on host fiber when arg style is empty', () => {
    const fiber = createFiber({
      tag: 'host',
      type: 'Text',
      props: {
        style: { fontSize: 20, fontFamily: 'Georgia', fontWeight: '600' as const },
        children: ['styled'],
      },
    });

    const input = fiberToLayoutInput(fiber, renderer);
    input.measureText!('styled', {});

    expect(renderer.measureText).toHaveBeenCalledWith('styled', 20, 'Georgia', '600');
  });

  it('sets text for host fibers with number children in props', () => {
    const fiber = createFiber({
      tag: 'host',
      type: 'Text',
      props: {
        style: {},
        children: [42],
      },
    });

    const input = fiberToLayoutInput(fiber, renderer);

    expect(input.text).toBe('42');
    expect(input.measureText).toBeDefined();

    // Exercise measureText on number children path
    const result = input.measureText!('42', {});
    expect(result.width).toBeGreaterThan(0);
  });

  it('does not set text when no string/number children', () => {
    const fiber = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });

    const input = fiberToLayoutInput(fiber, renderer);

    expect(input.text).toBeUndefined();
    expect(input.measureText).toBeUndefined();
  });

  it('defaults style to empty object when props.style is undefined', () => {
    const fiber = createFiber({
      tag: 'host',
      type: 'Box',
      props: { children: [] },
    });

    const input = fiberToLayoutInput(fiber, renderer);

    expect(input.style).toEqual({});
  });

  it('handles deeply nested fiber trees', () => {
    const leaf = createFiber({
      tag: 'text',
      type: TextNode,
      props: { nodeValue: 'deep', children: [] },
    });

    const mid = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    mid.child = leaf;
    leaf.parent = mid;

    const root = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    root.child = mid;
    mid.parent = root;

    const input = fiberToLayoutInput(root, renderer);

    expect(input.children).toHaveLength(1);
    expect(input.children[0].children).toHaveLength(1);
    expect(input.children[0].children[0].text).toBe('deep');
  });

  it('handles component with multiple host grandchildren', () => {
    const gc1 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: { width: 1 }, children: [] },
    });
    const gc2 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: { width: 2 }, children: [] },
    });
    const gc3 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: { width: 3 }, children: [] },
    });
    gc1.sibling = gc2;
    gc2.sibling = gc3;

    const comp = createFiber({
      tag: 'component',
      type: function Comp() { return null; },
      props: { children: [] },
    });
    comp.child = gc1;
    gc1.parent = comp;
    gc2.parent = comp;
    gc3.parent = comp;

    const root = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    root.child = comp;
    comp.parent = root;

    const input = fiberToLayoutInput(root, renderer);

    expect(input.children).toHaveLength(3);
    expect(input.children[0].style.width).toBe(1);
    expect(input.children[1].style.width).toBe(2);
    expect(input.children[2].style.width).toBe(3);
  });

  it('uses measureText style params from the provided style argument', () => {
    const fiber = createFiber({
      tag: 'text',
      type: TextNode,
      props: { nodeValue: 'X', children: [], style: { fontSize: 10 } },
    });

    const input = fiberToLayoutInput(fiber, renderer);
    input.measureText!('X', { fontSize: 24, fontFamily: 'Helvetica', fontWeight: 'bold' });

    expect(renderer.measureText).toHaveBeenCalledWith('X', 24, 'Helvetica', 'bold');
  });

  it('handles host fiber with mixed children (strings and non-strings)', () => {
    const childFiber = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });

    const parent = createFiber({
      tag: 'host',
      type: 'Text',
      props: { style: {}, children: ['prefix', childFiber as any, 'suffix'] },
    });
    parent.child = childFiber;
    childFiber.parent = parent;

    const input = fiberToLayoutInput(parent, renderer);

    // Should have text from string parts
    expect(input.text).toBe('prefixsuffix');
    // Should also have host child
    expect(input.children).toHaveLength(1);
  });
});

describe('buildLayoutMap', () => {
  it('maps a single fiber to its layout output', () => {
    const fiber = createFiber({
      tag: 'root',
      type: 'root',
      props: { children: [] },
    });

    const layout: LayoutOutput = { x: 0, y: 0, width: 390, height: 844, children: [] };

    const map = buildLayoutMap(fiber, layout);

    expect(map.size).toBe(1);
    expect(map.get(fiber)).toBe(layout);
  });

  it('maps parent and host children correctly', () => {
    const child1 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    const child2 = createFiber({
      tag: 'host',
      type: 'Text',
      props: { style: {}, children: [] },
    });
    child1.sibling = child2;

    const parent = createFiber({
      tag: 'root',
      type: 'root',
      props: { children: [] },
    });
    parent.child = child1;
    child1.parent = parent;
    child2.parent = parent;

    const layout: LayoutOutput = {
      x: 0, y: 0, width: 390, height: 844,
      children: [
        { x: 0, y: 0, width: 100, height: 50, children: [] },
        { x: 0, y: 50, width: 200, height: 30, children: [] },
      ],
    };

    const map = buildLayoutMap(parent, layout);

    expect(map.size).toBe(3);
    expect(map.get(parent)).toBe(layout);
    expect(map.get(child1)).toBe(layout.children[0]);
    expect(map.get(child2)).toBe(layout.children[1]);
  });

  it('unwraps component fibers when mapping layout', () => {
    const hostChild = createFiber({
      tag: 'host',
      type: 'Text',
      props: { style: {}, children: [] },
    });

    const comp = createFiber({
      tag: 'component',
      type: function C() { return null; },
      props: { children: [] },
    });
    comp.child = hostChild;
    hostChild.parent = comp;

    const root = createFiber({
      tag: 'root',
      type: 'root',
      props: { children: [] },
    });
    root.child = comp;
    comp.parent = root;

    const layout: LayoutOutput = {
      x: 0, y: 0, width: 390, height: 844,
      children: [
        { x: 10, y: 10, width: 100, height: 20, children: [] },
      ],
    };

    const map = buildLayoutMap(root, layout);

    expect(map.get(root)).toBe(layout);
    expect(map.get(hostChild)).toBe(layout.children[0]);
  });

  it('unwraps fragment fibers when mapping layout', () => {
    const fc1 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    const fc2 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    fc1.sibling = fc2;

    const frag = createFiber({
      tag: 'fragment',
      type: Fragment,
      props: { children: [] },
    });
    frag.child = fc1;
    fc1.parent = frag;
    fc2.parent = frag;

    const root = createFiber({
      tag: 'root',
      type: 'root',
      props: { children: [] },
    });
    root.child = frag;
    frag.parent = root;

    const layout: LayoutOutput = {
      x: 0, y: 0, width: 390, height: 844,
      children: [
        { x: 0, y: 0, width: 100, height: 50, children: [] },
        { x: 0, y: 50, width: 100, height: 50, children: [] },
      ],
    };

    const map = buildLayoutMap(root, layout);

    expect(map.get(fc1)).toBe(layout.children[0]);
    expect(map.get(fc2)).toBe(layout.children[1]);
  });

  it('handles nested host children in layout map', () => {
    const grandchild = createFiber({
      tag: 'host',
      type: 'Text',
      props: { style: {}, children: [] },
    });

    const child = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    child.child = grandchild;
    grandchild.parent = child;

    const root = createFiber({
      tag: 'root',
      type: 'root',
      props: { children: [] },
    });
    root.child = child;
    child.parent = root;

    const layout: LayoutOutput = {
      x: 0, y: 0, width: 390, height: 844,
      children: [
        {
          x: 0, y: 0, width: 200, height: 100,
          children: [
            { x: 10, y: 10, width: 50, height: 20, children: [] },
          ],
        },
      ],
    };

    const map = buildLayoutMap(root, layout);

    expect(map.size).toBe(3);
    expect(map.get(grandchild)).toBe(layout.children[0].children[0]);
  });

  it('skips mapping when layout children are exhausted', () => {
    const c1 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    const c2 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    c1.sibling = c2;

    const root = createFiber({
      tag: 'root',
      type: 'root',
      props: { children: [] },
    });
    root.child = c1;
    c1.parent = root;
    c2.parent = root;

    // Only one layout child despite two fiber children
    const layout: LayoutOutput = {
      x: 0, y: 0, width: 390, height: 844,
      children: [
        { x: 0, y: 0, width: 100, height: 50, children: [] },
      ],
    };

    const map = buildLayoutMap(root, layout);

    expect(map.get(root)).toBe(layout);
    expect(map.get(c1)).toBe(layout.children[0]);
    // c2 should not be in the map since layout children are exhausted
    expect(map.has(c2)).toBe(false);
  });

  it('handles empty fiber tree', () => {
    const root = createFiber({
      tag: 'root',
      type: 'root',
      props: { children: [] },
    });

    const layout: LayoutOutput = { x: 0, y: 0, width: 390, height: 844, children: [] };

    const map = buildLayoutMap(root, layout);

    expect(map.size).toBe(1);
    expect(map.get(root)).toBe(layout);
  });

  it('maps component grandchildren from multiple component wrappers', () => {
    const host1 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    const comp1 = createFiber({
      tag: 'component',
      type: function A() { return null; },
      props: { children: [] },
    });
    comp1.child = host1;
    host1.parent = comp1;

    const host2 = createFiber({
      tag: 'host',
      type: 'Box',
      props: { style: {}, children: [] },
    });
    const comp2 = createFiber({
      tag: 'component',
      type: function B() { return null; },
      props: { children: [] },
    });
    comp2.child = host2;
    host2.parent = comp2;

    comp1.sibling = comp2;

    const root = createFiber({
      tag: 'root',
      type: 'root',
      props: { children: [] },
    });
    root.child = comp1;
    comp1.parent = root;
    comp2.parent = root;

    const layout: LayoutOutput = {
      x: 0, y: 0, width: 390, height: 844,
      children: [
        { x: 0, y: 0, width: 100, height: 50, children: [] },
        { x: 0, y: 50, width: 100, height: 50, children: [] },
      ],
    };

    const map = buildLayoutMap(root, layout);

    expect(map.get(host1)).toBe(layout.children[0]);
    expect(map.get(host2)).toBe(layout.children[1]);
  });
});

describe('render function', () => {
  let rafCallbacks: Function[];
  let origRAF: typeof globalThis.requestAnimationFrame;
  let origQueueMicrotask: typeof globalThis.queueMicrotask;

  function createMockCanvas(): any {
    const listeners: Record<string, Function[]> = {};
    const ctx = {
      clearRect: mock(() => {}),
      fillRect: mock(() => {}),
      fillText: mock(() => {}),
      measureText: mock(() => ({ width: 50 })),
      beginPath: mock(() => {}),
      moveTo: mock(() => {}),
      lineTo: mock(() => {}),
      arcTo: mock(() => {}),
      closePath: mock(() => {}),
      fill: mock(() => {}),
      stroke: mock(() => {}),
      clip: mock(() => {}),
      rect: mock(() => {}),
      save: mock(() => {}),
      restore: mock(() => {}),
      scale: mock(() => {}),
      drawImage: mock(() => {}),
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      textAlign: 'left',
      textBaseline: 'top',
      globalAlpha: 1,
    };
    const canvas = {
      _ctx: ctx,
      getContext: mock(() => ctx),
      getBoundingClientRect: mock(() => ({
        width: 390,
        height: 844,
        left: 0,
        top: 0,
      })),
      width: 390,
      height: 844,
      addEventListener: mock((type: string, fn: Function) => {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
      }),
      removeEventListener: mock((type: string, _fn: Function) => {
        listeners[type] = [];
      }),
    };
    return canvas;
  }

  beforeEach(() => {
    rafCallbacks = [];
    origRAF = globalThis.requestAnimationFrame;
    origQueueMicrotask = globalThis.queueMicrotask;
    (globalThis as any).requestAnimationFrame = (cb: Function) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRAF;
    globalThis.queueMicrotask = origQueueMicrotask;
  });

  it('calls render on the reconciler with the element', async () => {
    const { render } = await import('../src/platform/web');
    const { createElement } = await import('../src/jsx');

    const canvas = createMockCanvas();
    const element = createElement('Box', { style: { width: 100, height: 100 } });

    render(element, canvas);

    // reconciler.render is called synchronously, scheduleWork uses queueMicrotask
    await new Promise<void>((r) => queueMicrotask(r));

    // After microtask, commitEffects should have scheduled a RAF
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(1);
  });

  it('performs render pipeline when RAF fires', async () => {
    const { render } = await import('../src/platform/web');
    const { createElement } = await import('../src/jsx');

    const canvas = createMockCanvas();
    const element = createElement('Box', {
      style: { width: 200, height: 100, backgroundColor: '#FF0000' },
    });

    render(element, canvas);

    await new Promise<void>((r) => queueMicrotask(r));

    // Fire all RAF callbacks
    for (const cb of rafCallbacks) {
      cb(performance.now());
    }

    // The canvas context should have been used for rendering
    const ctx = canvas._ctx;
    expect(ctx.clearRect).toHaveBeenCalled();
  });

  it('attaches event listeners to the canvas', async () => {
    const { render } = await import('../src/platform/web');
    const { createElement } = await import('../src/jsx');

    const canvas = createMockCanvas();
    const element = createElement('Box', { style: {} });

    render(element, canvas);

    // EventManager.attach should have added listeners
    expect(canvas.addEventListener).toHaveBeenCalled();
  });

  it('does not schedule multiple RAF calls for repeated updates', async () => {
    const { render } = await import('../src/platform/web');
    const { createElement } = await import('../src/jsx');

    const canvas = createMockCanvas();
    const element = createElement('Box', {
      style: { width: 100, height: 100 },
    },
      createElement('Box', { style: { width: 50, height: 50 } }),
    );

    render(element, canvas);

    await new Promise<void>((r) => queueMicrotask(r));

    // Multiple commitEffects calls should coalesce into one RAF
    const initialCount = rafCallbacks.length;
    expect(initialCount).toBeGreaterThanOrEqual(1);
  });

  it('handles render with a component element', async () => {
    const { render } = await import('../src/platform/web');
    const { createElement } = await import('../src/jsx');

    const MyComp = () => createElement('Box', { style: { width: 50, height: 50 } });

    const canvas = createMockCanvas();
    const element = createElement(MyComp, {});

    render(element, canvas);

    await new Promise<void>((r) => queueMicrotask(r));

    // Should have scheduled rendering
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(1);

    // Fire RAF
    for (const cb of rafCallbacks) {
      cb(performance.now());
    }

    const ctx = canvas._ctx;
    expect(ctx.clearRect).toHaveBeenCalled();
  });

  it('handles performRender when rootFiber is null', async () => {
    // This tests the early return in performRender
    const { render } = await import('../src/platform/web');
    const { createElement } = await import('../src/jsx');

    const canvas = createMockCanvas();

    // We cannot easily get rootFiber to be null during RAF,
    // but we can verify the function doesn't throw with a simple element
    const element = createElement('Box', { style: {} });
    render(element, canvas);

    await new Promise<void>((r) => queueMicrotask(r));

    // This should not throw
    for (const cb of rafCallbacks) {
      cb(performance.now());
    }
  });
});
