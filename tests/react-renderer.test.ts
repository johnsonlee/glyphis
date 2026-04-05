import { describe, it, expect, mock } from 'bun:test';
import React, { useState, useEffect, useRef, useContext, createContext, useMemo, useCallback } from 'react';
import { renderReact, GlyphisNode, HOST_TYPES } from '../src/react/renderer';

function renderToTree(element: React.ReactElement, onCommit?: () => void): Promise<GlyphisNode> {
  const rootNode = new GlyphisNode(HOST_TYPES.ROOT, {});
  renderReact(element, rootNode, onCommit ?? (() => {}));
  return new Promise(resolve => setTimeout(() => resolve(rootNode), 100));
}

function collectNodes(node: GlyphisNode): GlyphisNode[] {
  const result: GlyphisNode[] = [node];
  for (const child of node.children) {
    result.push(...collectNodes(child));
  }
  return result;
}

function findByType(root: GlyphisNode, type: string): GlyphisNode[] {
  return collectNodes(root).filter(n => n.type === type);
}

function findTextLeaves(root: GlyphisNode): string[] {
  return collectNodes(root)
    .filter(n => n.type === HOST_TYPES.TEXT_LEAF && n.text)
    .map(n => n.text!);
}

describe('React renderer integration', () => {
  it('renders a simple element to GlyphisNode tree', async () => {
    const el = React.createElement('glyphis-view', { style: { flex: 1 } });
    const root = await renderToTree(el);
    expect(root.children.length).toBe(1);
    expect(root.children[0].type).toBe('glyphis-view');
    expect(root.children[0].props.style).toEqual({ flex: 1 });
  });

  it('renders nested elements with correct tree structure', async () => {
    const el = React.createElement('glyphis-view', { style: { flex: 1 } },
      React.createElement('glyphis-text', { style: { fontSize: 16 } }),
      React.createElement('glyphis-view', { style: { flex: 2 } }),
    );
    const root = await renderToTree(el);
    const outer = root.children[0];
    expect(outer.children.length).toBe(2);
    expect(outer.children[0].type).toBe('glyphis-text');
    expect(outer.children[1].type).toBe('glyphis-view');
  });

  it('renders text children as text leaf nodes', async () => {
    const el = React.createElement('glyphis-text', { style: { fontSize: 14 } }, 'Hello');
    const root = await renderToTree(el);
    const textNode = root.children[0];
    expect(textNode.type).toBe('glyphis-text');
    expect(textNode.children.length).toBe(1);
    expect(textNode.children[0].type).toBe(HOST_TYPES.TEXT_LEAF);
    expect(textNode.children[0].text).toBe('Hello');
  });

  it('re-renders on state change (useState)', async () => {
    let setVal: ((v: number) => void) | null = null;

    function Counter() {
      const [count, setCount] = useState(0);
      setVal = setCount;
      return React.createElement('glyphis-text', {}, String(count));
    }

    const root = await renderToTree(React.createElement(Counter));
    expect(findTextLeaves(root)).toContain('0');

    setVal!(1);
    await new Promise(r => setTimeout(r, 100));
    expect(findTextLeaves(root)).toContain('1');
  });

  it('useEffect runs after commit', async () => {
    const effectFn = mock(() => {});

    function EffectComponent() {
      useEffect(() => {
        effectFn();
      }, []);
      return React.createElement('glyphis-view', {});
    }

    await renderToTree(React.createElement(EffectComponent));
    expect(effectFn).toHaveBeenCalledTimes(1);
  });

  it('useRef persists across renders', async () => {
    let refValues: (number | null)[] = [];
    let setVal: ((v: number) => void) | null = null;

    function RefComponent() {
      const ref = useRef<number | null>(null);
      const [count, setCount] = useState(0);
      setVal = setCount;

      if (ref.current === null) {
        ref.current = 42;
      }
      refValues.push(ref.current);

      return React.createElement('glyphis-text', {}, String(count));
    }

    await renderToTree(React.createElement(RefComponent));
    expect(refValues[0]).toBe(42);

    setVal!(1);
    await new Promise(r => setTimeout(r, 100));
    expect(refValues[1]).toBe(42);
  });

  it('useContext provides correct value', async () => {
    const MyContext = createContext('default');
    let received: string = '';

    function Consumer() {
      received = useContext(MyContext);
      return React.createElement('glyphis-view', {});
    }

    const el = React.createElement(MyContext.Provider, { value: 'provided' },
      React.createElement(Consumer),
    );
    await renderToTree(el);
    expect(received).toBe('provided');
  });

  it('useMemo caches value', async () => {
    let computeCount = 0;
    let setVal: ((v: number) => void) | null = null;

    function MemoComponent() {
      const [count, setCount] = useState(0);
      setVal = setCount;

      const _memoized = useMemo(() => {
        computeCount++;
        return 'computed';
      }, []);

      return React.createElement('glyphis-text', {}, String(count));
    }

    await renderToTree(React.createElement(MemoComponent));
    expect(computeCount).toBe(1);

    setVal!(1);
    await new Promise(r => setTimeout(r, 100));
    expect(computeCount).toBe(1);
  });

  it('useCallback returns stable function', async () => {
    let callbacks: Function[] = [];
    let setVal: ((v: number) => void) | null = null;

    function CallbackComponent() {
      const [count, setCount] = useState(0);
      setVal = setCount;

      const cb = useCallback(() => {}, []);
      callbacks.push(cb);

      return React.createElement('glyphis-text', {}, String(count));
    }

    await renderToTree(React.createElement(CallbackComponent));
    setVal!(1);
    await new Promise(r => setTimeout(r, 100));

    expect(callbacks.length).toBe(2);
    expect(callbacks[0]).toBe(callbacks[1]);
  });

  it('conditional rendering skips null children', async () => {
    function Conditional() {
      return React.createElement('glyphis-view', {},
        React.createElement('glyphis-text', {}, 'visible'),
        null,
        React.createElement('glyphis-text', {}, 'also visible'),
      );
    }

    const root = await renderToTree(React.createElement(Conditional));
    const outer = root.children[0];
    expect(outer.children.length).toBe(2);
    expect(findTextLeaves(root)).toEqual(['visible', 'also visible']);
  });

  it('key-based list reconciliation preserves identity on reorder', async () => {
    let setItems: ((items: string[]) => void) | null = null;

    function List() {
      const [items, setI] = useState(['A', 'B', 'C']);
      setItems = setI;

      return React.createElement('glyphis-view', {},
        ...items.map(item =>
          React.createElement('glyphis-text', { key: item }, item),
        ),
      );
    }

    const root = await renderToTree(React.createElement(List));
    expect(findTextLeaves(root)).toEqual(['A', 'B', 'C']);

    setItems!(['C', 'A', 'B']);
    await new Promise(r => setTimeout(r, 100));
    expect(findTextLeaves(root)).toEqual(['C', 'A', 'B']);
  });

  it('component unmount cleans up children', async () => {
    let setShow: ((v: boolean) => void) | null = null;

    function Parent() {
      const [show, setS] = useState(true);
      setShow = setS;

      return React.createElement('glyphis-view', {},
        show ? React.createElement('glyphis-text', {}, 'child') : null,
      );
    }

    const root = await renderToTree(React.createElement(Parent));
    expect(findTextLeaves(root)).toContain('child');

    setShow!(false);
    await new Promise(r => setTimeout(r, 100));
    expect(findTextLeaves(root)).not.toContain('child');
  });

  it('onCommit callback fires on renders', async () => {
    const onCommit = mock(() => {});
    let setVal: ((v: number) => void) | null = null;

    function Counter() {
      const [count, setCount] = useState(0);
      setVal = setCount;
      return React.createElement('glyphis-text', {}, String(count));
    }

    await renderToTree(React.createElement(Counter), onCommit);
    expect(onCommit).toHaveBeenCalled();

    const initialCount = onCommit.mock.calls.length;
    setVal!(1);
    await new Promise(r => setTimeout(r, 100));
    expect(onCommit.mock.calls.length).toBeGreaterThan(initialCount);
  });
});
