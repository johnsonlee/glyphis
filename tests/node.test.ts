import { describe, test, expect } from 'bun:test';
import Yoga from 'yoga-layout';
import { createGlyphisNode, type GlyphisNode } from '../src/node';

describe('createGlyphisNode', () => {
  test('creates node with correct tag', () => {
    const yoga = Yoga.Node.create();
    const node = createGlyphisNode(yoga, 'view');
    expect(node.tag).toBe('view');
    yoga.free();
  });

  test('creates node with empty children array', () => {
    const yoga = Yoga.Node.create();
    const node = createGlyphisNode(yoga, 'view');
    expect(node.children).toEqual([]);
    expect(node.children).toBeInstanceOf(Array);
    expect(node.children.length).toBe(0);
    yoga.free();
  });

  test('creates node with empty style', () => {
    const yoga = Yoga.Node.create();
    const node = createGlyphisNode(yoga, 'view');
    expect(node.style).toEqual({});
    yoga.free();
  });

  test('creates node with empty handlers', () => {
    const yoga = Yoga.Node.create();
    const node = createGlyphisNode(yoga, 'view');
    expect(node.handlers).toEqual({});
    yoga.free();
  });

  test('creates node with empty text', () => {
    const yoga = Yoga.Node.create();
    const node = createGlyphisNode(yoga, 'text');
    expect(node.text).toBe('');
    yoga.free();
  });

  test('creates node with undefined parent', () => {
    const yoga = Yoga.Node.create();
    const node = createGlyphisNode(yoga, 'view');
    expect(node.parent).toBeUndefined();
    yoga.free();
  });

  test('stores the yoga node reference', () => {
    const yoga = Yoga.Node.create();
    const node = createGlyphisNode(yoga, 'view');
    expect(node.yoga).toBe(yoga);
    yoga.free();
  });

  test('preserves different tag values', () => {
    const yoga1 = Yoga.Node.create();
    const yoga2 = Yoga.Node.create();
    const yoga3 = Yoga.Node.create();
    const view = createGlyphisNode(yoga1, 'view');
    const text = createGlyphisNode(yoga2, 'text');
    const root = createGlyphisNode(yoga3, '__root');
    expect(view.tag).toBe('view');
    expect(text.tag).toBe('text');
    expect(root.tag).toBe('__root');
    yoga1.free();
    yoga2.free();
    yoga3.free();
  });
});

describe('GlyphisNode mutability', () => {
  test('style is mutable', () => {
    const yoga = Yoga.Node.create();
    const node = createGlyphisNode(yoga, 'view');
    node.style = { backgroundColor: '#FF0000', width: 100 };
    expect(node.style).toEqual({ backgroundColor: '#FF0000', width: 100 });
    yoga.free();
  });

  test('handlers are mutable', () => {
    const yoga = Yoga.Node.create();
    const node = createGlyphisNode(yoga, 'view');
    const handler = () => {};
    node.handlers['onPress'] = handler;
    expect(node.handlers['onPress']).toBe(handler);
    yoga.free();
  });

  test('text is mutable', () => {
    const yoga = Yoga.Node.create();
    const node = createGlyphisNode(yoga, '__text');
    node.text = 'Hello';
    expect(node.text).toBe('Hello');
    yoga.free();
  });

  test('parent is mutable', () => {
    const parentYoga = Yoga.Node.create();
    const childYoga = Yoga.Node.create();
    const parent = createGlyphisNode(parentYoga, 'view');
    const child = createGlyphisNode(childYoga, 'text');
    child.parent = parent;
    expect(child.parent).toBe(parent);
    parentYoga.free();
    childYoga.free();
  });

  test('children array supports push', () => {
    const parentYoga = Yoga.Node.create();
    const childYoga = Yoga.Node.create();
    const parent = createGlyphisNode(parentYoga, 'view');
    const child = createGlyphisNode(childYoga, 'text');
    parent.children.push(child);
    expect(parent.children.length).toBe(1);
    expect(parent.children[0]).toBe(child);
    parentYoga.free();
    childYoga.free();
  });

  test('children array supports splice', () => {
    const parentYoga = Yoga.Node.create();
    const c1Yoga = Yoga.Node.create();
    const c2Yoga = Yoga.Node.create();
    const parent = createGlyphisNode(parentYoga, 'view');
    const c1 = createGlyphisNode(c1Yoga, 'view');
    const c2 = createGlyphisNode(c2Yoga, 'view');
    parent.children.push(c1, c2);
    parent.children.splice(0, 1);
    expect(parent.children.length).toBe(1);
    expect(parent.children[0]).toBe(c2);
    parentYoga.free();
    c1Yoga.free();
    c2Yoga.free();
  });
});
