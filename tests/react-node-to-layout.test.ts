import { describe, it, expect } from 'bun:test';
import { nodeToLayoutInput, buildNodeLayoutMap } from '../src/react/node-to-layout';
import { GlyphisNode, HOST_TYPES } from '../src/react/glyphis-node';
import type { Renderer } from '../src/types';
import type { LayoutOutput } from '../src/layout';

function createMockRenderer(): Renderer {
  return {
    clear() {},
    render() {},
    getWidth() { return 390; },
    getHeight() { return 844; },
    measureText(text: string, fontSize: number, _fontFamily: string, _fontWeight: string) {
      return { width: text.length * fontSize * 0.6, height: fontSize * 1.2 };
    },
  };
}

describe('nodeToLayoutInput', () => {
  const renderer = createMockRenderer();

  it('produces correct LayoutInput for simple node', () => {
    const node = new GlyphisNode('glyphis-view', { style: { flex: 1, backgroundColor: 'red' } });
    const input = nodeToLayoutInput(node, renderer);
    expect(input.style).toEqual({ flex: 1, backgroundColor: 'red' });
    expect(input.children).toEqual([]);
    expect(input.text).toBeUndefined();
    expect(input.measureText).toBeUndefined();
  });

  it('produces nested LayoutInput for nested nodes', () => {
    const parent = new GlyphisNode('glyphis-view', { style: { flex: 1 } });
    const child1 = new GlyphisNode('glyphis-view', { style: { width: 100 } });
    const child2 = new GlyphisNode('glyphis-view', { style: { width: 200 } });
    parent.appendChild(child1);
    parent.appendChild(child2);

    const input = nodeToLayoutInput(parent, renderer);
    expect(input.children.length).toBe(2);
    expect(input.children[0].style).toEqual({ width: 100 });
    expect(input.children[1].style).toEqual({ width: 200 });
  });

  it('sets text and measureText for text leaf node', () => {
    const textLeaf = new GlyphisNode(HOST_TYPES.TEXT_LEAF, {}, 'Hello');
    const input = nodeToLayoutInput(textLeaf, renderer);
    expect(input.text).toBe('Hello');
    expect(input.measureText).toBeDefined();

    const measured = input.measureText!('Hello', {});
    expect(measured.width).toBeGreaterThan(0);
    expect(measured.height).toBeGreaterThan(0);
  });

  it('text leaf inherits fontSize from parent', () => {
    const parent = new GlyphisNode(HOST_TYPES.TEXT, { style: { fontSize: 24 } });
    const leaf = new GlyphisNode(HOST_TYPES.TEXT_LEAF, {}, 'Big');
    parent.appendChild(leaf);

    const parentInput = nodeToLayoutInput(parent, renderer);
    const leafInput = parentInput.children[0];

    // measureText should use parent's fontSize (24)
    const measured = leafInput.measureText!('Big', {});
    const expectedHeight = 24 * 1.2;
    expect(measured.height).toBeCloseTo(expectedHeight, 1);
  });

  it('host text node with string children sets text from leaves', () => {
    const textNode = new GlyphisNode(HOST_TYPES.TEXT, { style: { fontSize: 16 } });
    const leaf1 = new GlyphisNode(HOST_TYPES.TEXT_LEAF, {}, 'Hello ');
    const leaf2 = new GlyphisNode(HOST_TYPES.TEXT_LEAF, {}, 'World');
    textNode.appendChild(leaf1);
    textNode.appendChild(leaf2);

    const input = nodeToLayoutInput(textNode, renderer);
    expect(input.text).toBe('Hello World');
    expect(input.measureText).toBeDefined();
  });

  it('empty node produces empty children array', () => {
    const node = new GlyphisNode('glyphis-view', { style: {} });
    const input = nodeToLayoutInput(node, renderer);
    expect(input.children).toEqual([]);
  });

  it('node without style defaults to empty object in layout', () => {
    const node = new GlyphisNode('glyphis-view', {});
    const input = nodeToLayoutInput(node, renderer);
    expect(input.style).toEqual({});
  });

  it('text node without text leaf children does not set text', () => {
    const textNode = new GlyphisNode(HOST_TYPES.TEXT, { style: { fontSize: 16 } });
    const childView = new GlyphisNode('glyphis-view', {});
    textNode.appendChild(childView);

    const input = nodeToLayoutInput(textNode, renderer);
    expect(input.text).toBeUndefined();
    expect(input.measureText).toBeUndefined();
  });
});

describe('buildNodeLayoutMap', () => {
  it('maps nodes to layout outputs', () => {
    const root = new GlyphisNode(HOST_TYPES.ROOT, {});
    const child = new GlyphisNode('glyphis-view', {});
    root.appendChild(child);

    const layout: LayoutOutput = {
      x: 0, y: 0, width: 390, height: 844,
      children: [
        { x: 10, y: 10, width: 370, height: 100, children: [] },
      ],
    };

    const map = buildNodeLayoutMap(root, layout);
    expect(map.get(root)).toBe(layout);
    expect(map.get(child)).toBe(layout.children[0]);
  });

  it('maps deeply nested tree', () => {
    const root = new GlyphisNode(HOST_TYPES.ROOT, {});
    const child = new GlyphisNode('glyphis-view', {});
    const grandchild = new GlyphisNode('glyphis-text', {});
    root.appendChild(child);
    child.appendChild(grandchild);

    const layout: LayoutOutput = {
      x: 0, y: 0, width: 390, height: 844,
      children: [{
        x: 0, y: 0, width: 390, height: 400,
        children: [{
          x: 10, y: 10, width: 100, height: 20,
          children: [],
        }],
      }],
    };

    const map = buildNodeLayoutMap(root, layout);
    expect(map.size).toBe(3);
    expect(map.get(grandchild)).toBe(layout.children[0].children[0]);
  });

  it('handles mismatched children counts gracefully', () => {
    const root = new GlyphisNode(HOST_TYPES.ROOT, {});
    const child1 = new GlyphisNode('glyphis-view', {});
    const child2 = new GlyphisNode('glyphis-view', {});
    root.appendChild(child1);
    root.appendChild(child2);

    // Layout only has 1 child
    const layout: LayoutOutput = {
      x: 0, y: 0, width: 390, height: 844,
      children: [
        { x: 0, y: 0, width: 100, height: 50, children: [] },
      ],
    };

    const map = buildNodeLayoutMap(root, layout);
    expect(map.get(root)).toBeDefined();
    expect(map.get(child1)).toBeDefined();
    expect(map.get(child2)).toBeUndefined();
  });
});
