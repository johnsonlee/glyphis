import { describe, it, expect } from 'bun:test';
import { jsx, jsxs, jsxDEV, Fragment } from '../src/jsx-runtime';
import { createElement, h, Fragment as CFragment } from '../src/jsx';

describe('jsx()', () => {
  it('creates correct VNode structure', () => {
    const node = jsx('div', { id: 'test', children: ['hello'] });
    expect(node).toEqual({
      type: 'div',
      props: { id: 'test', children: ['hello'] },
      key: null,
    });
  });

  it('handles no children', () => {
    const node = jsx('div', { id: 'test' });
    expect(node.props.children).toEqual([]);
  });

  it('handles single child', () => {
    const node = jsx('span', { children: 'text' });
    expect(node.props.children).toEqual(['text']);
  });

  it('handles multiple children', () => {
    const child1 = jsx('span', {});
    const child2 = jsx('span', {});
    const node = jsx('div', { children: [child1, child2] });
    expect(node.props.children).toEqual([child1, child2]);
  });

  it('flattens nested arrays of children', () => {
    const node = jsx('div', { children: [['a', ['b', 'c']], 'd'] });
    expect(node.props.children).toEqual(['a', 'b', 'c', 'd']);
  });

  it('uses key from third argument', () => {
    const node = jsx('div', {}, 'my-key');
    expect(node.key).toBe('my-key');
  });

  it('uses key from props if no third argument', () => {
    const node = jsx('div', { key: 'prop-key' });
    expect(node.key).toBe('prop-key');
  });

  it('third argument key takes priority over props key', () => {
    const node = jsx('div', { key: 'prop-key' }, 'arg-key');
    expect(node.key).toBe('arg-key');
  });

  it('handles ref prop', () => {
    const ref = { current: null };
    const node = jsx('div', { ref });
    expect(node.props.ref).toBe(ref);
  });

  it('handles function components as type', () => {
    function MyComponent() { return null; }
    const node = jsx(MyComponent, { title: 'test', children: ['child'] });
    expect(node.type).toBe(MyComponent);
    expect(node.props.title).toBe('test');
    expect(node.props.children).toEqual(['child']);
  });

  it('handles Fragment as type', () => {
    const node = jsx(Fragment, { children: ['a', 'b'] });
    expect(node.type).toBe(Fragment);
    expect(node.props.children).toEqual(['a', 'b']);
  });

  it('strips children from restProps', () => {
    const node = jsx('div', { id: 'x', children: ['y'] });
    // children should only appear in props.children, not duplicated
    expect(node.props.id).toBe('x');
    expect(node.props.children).toEqual(['y']);
  });

  it('handles null/undefined/boolean children in arrays', () => {
    const node = jsx('div', { children: [null, undefined, false, true, 0, ''] });
    expect(node.props.children).toEqual([null, undefined, false, true, 0, '']);
  });

  it('handles numeric children', () => {
    const node = jsx('div', { children: 42 });
    expect(node.props.children).toEqual([42]);
  });

  it('returns null key when no key provided', () => {
    const node = jsx('div', {});
    expect(node.key).toBeNull();
  });

  it('handles numeric key', () => {
    const node = jsx('div', {}, 0);
    expect(node.key).toBe(0);
  });
});

describe('jsxs', () => {
  it('is the same function as jsx', () => {
    expect(jsxs).toBe(jsx);
  });
});

describe('jsxDEV', () => {
  it('is the same function as jsx', () => {
    expect(jsxDEV).toBe(jsx);
  });
});

describe('createElement()', () => {
  it('creates correct VNode structure', () => {
    const node = createElement('div', { id: 'test' }, 'hello');
    expect(node).toEqual({
      type: 'div',
      props: { id: 'test', children: ['hello'] },
      key: null,
    });
  });

  it('handles null props', () => {
    const node = createElement('div', null, 'text');
    expect(node.props).toEqual({ children: ['text'] });
    expect(node.key).toBeNull();
  });

  it('handles no children', () => {
    const node = createElement('div', { id: 'test' });
    expect(node.props.children).toEqual([]);
  });

  it('handles multiple spread children', () => {
    const node = createElement('div', null, 'a', 'b', 'c');
    expect(node.props.children).toEqual(['a', 'b', 'c']);
  });

  it('flattens array children', () => {
    const node = createElement('div', null, ['a', ['b', 'c']], 'd');
    expect(node.props.children).toEqual(['a', 'b', 'c', 'd']);
  });

  it('extracts key from props', () => {
    const node = createElement('div', { key: 'my-key' });
    expect(node.key).toBe('my-key');
  });

  it('returns null key when no key in props', () => {
    const node = createElement('div', { id: 'test' });
    expect(node.key).toBeNull();
  });

  it('handles function components', () => {
    function Comp() { return null; }
    const node = createElement(Comp, { value: 42 }, 'child');
    expect(node.type).toBe(Comp);
    expect(node.props.value).toBe(42);
    expect(node.props.children).toEqual(['child']);
  });

  it('handles Fragment', () => {
    const node = createElement(CFragment, null, 'a', 'b');
    expect(node.type).toBe(Symbol.for('glyph.fragment'));
    expect(node.props.children).toEqual(['a', 'b']);
  });

  it('handles deeply nested array children', () => {
    const node = createElement('div', null, [[[['deep']]]]);
    expect(node.props.children).toEqual(['deep']);
  });
});

describe('h()', () => {
  it('is the same function as createElement', () => {
    expect(h).toBe(createElement);
  });
});

describe('Fragment export', () => {
  it('jsx-runtime Fragment matches jsx Fragment', () => {
    expect(Fragment).toBe(CFragment);
  });
});
