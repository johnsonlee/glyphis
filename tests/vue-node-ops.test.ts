import { describe, it, expect } from 'bun:test';
import { nodeOps } from '../src/vue/node-ops';
import { HOST_TYPES } from '../src/react/glyph-node';

describe('Vue nodeOps', () => {
  it('createElement creates GlyphNode with correct type', () => {
    const node = nodeOps.createElement('glyph-view');
    expect(node.type).toBe('glyph-view');
    expect(node.children).toEqual([]);
    expect(node.parent).toBeNull();
  });

  it('createText creates text leaf node', () => {
    const node = nodeOps.createText('hello');
    expect(node.type).toBe(HOST_TYPES.TEXT_LEAF);
    expect(node.text).toBe('hello');
  });

  it('createComment creates comment node', () => {
    const node = nodeOps.createComment('a comment');
    expect(node.type).toBe('glyph-comment');
  });

  it('insert appends child when no anchor', () => {
    const parent = nodeOps.createElement('glyph-view');
    const child = nodeOps.createElement('glyph-text');
    nodeOps.insert(child, parent);
    expect(parent.children).toEqual([child]);
    expect(child.parent).toBe(parent);
  });

  it('insert with anchor inserts before anchor', () => {
    const parent = nodeOps.createElement('glyph-view');
    const first = nodeOps.createElement('glyph-text');
    const second = nodeOps.createElement('glyph-text');
    const inserted = nodeOps.createElement('glyph-view');

    nodeOps.insert(first, parent);
    nodeOps.insert(second, parent);
    nodeOps.insert(inserted, parent, second);

    expect(parent.children[0]).toBe(first);
    expect(parent.children[1]).toBe(inserted);
    expect(parent.children[2]).toBe(second);
  });

  it('remove detaches child from parent', () => {
    const parent = nodeOps.createElement('glyph-view');
    const child = nodeOps.createElement('glyph-text');
    nodeOps.insert(child, parent);
    expect(parent.children.length).toBe(1);

    nodeOps.remove(child);
    expect(parent.children.length).toBe(0);
    expect(child.parent).toBeNull();
  });

  it('remove does nothing when node has no parent', () => {
    const orphan = nodeOps.createElement('glyph-view');
    // Should not throw
    nodeOps.remove(orphan);
    expect(orphan.parent).toBeNull();
  });

  it('setText updates text content', () => {
    const node = nodeOps.createText('old');
    nodeOps.setText(node, 'new');
    expect(node.text).toBe('new');
  });

  it('setElementText clears children and adds text child', () => {
    const node = nodeOps.createElement('glyph-text');
    const existing = nodeOps.createElement('glyph-view');
    nodeOps.insert(existing, node);
    expect(node.children.length).toBe(1);

    nodeOps.setElementText(node, 'hello');
    expect(node.children.length).toBe(1);
    expect(node.children[0].type).toBe(HOST_TYPES.TEXT_LEAF);
    expect(node.children[0].text).toBe('hello');
  });

  it('setElementText with empty string clears children', () => {
    const node = nodeOps.createElement('glyph-text');
    nodeOps.setElementText(node, 'hello');
    expect(node.children.length).toBe(1);

    nodeOps.setElementText(node, '');
    expect(node.children.length).toBe(0);
  });

  it('parentNode returns parent', () => {
    const parent = nodeOps.createElement('glyph-view');
    const child = nodeOps.createElement('glyph-text');
    nodeOps.insert(child, parent);
    expect(nodeOps.parentNode(child)).toBe(parent);
  });

  it('parentNode returns null for root nodes', () => {
    const node = nodeOps.createElement('glyph-view');
    expect(nodeOps.parentNode(node)).toBeNull();
  });

  it('nextSibling returns correct sibling', () => {
    const parent = nodeOps.createElement('glyph-view');
    const first = nodeOps.createElement('glyph-text');
    const second = nodeOps.createElement('glyph-text');
    nodeOps.insert(first, parent);
    nodeOps.insert(second, parent);
    expect(nodeOps.nextSibling(first)).toBe(second);
  });

  it('nextSibling returns null for last child', () => {
    const parent = nodeOps.createElement('glyph-view');
    const child = nodeOps.createElement('glyph-text');
    nodeOps.insert(child, parent);
    expect(nodeOps.nextSibling(child)).toBeNull();
  });

  it('nextSibling returns null when node has no parent', () => {
    const node = nodeOps.createElement('glyph-view');
    expect(nodeOps.nextSibling(node)).toBeNull();
  });
});
