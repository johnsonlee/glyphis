import { describe, it, expect } from 'bun:test';
import { GlyphisNode, HOST_TYPES } from '../src/react/glyphis-node';

describe('GlyphisNode', () => {
  describe('constructor', () => {
    it('creates node with correct type, props, and empty children', () => {
      const node = new GlyphisNode('glyphis-view', { style: { flex: 1 } });
      expect(node.type).toBe('glyphis-view');
      expect(node.props).toEqual({ style: { flex: 1 } });
      expect(node.children).toEqual([]);
      expect(node.parent).toBeNull();
      expect(node.text).toBeNull();
    });

    it('creates text leaf node with text content', () => {
      const node = new GlyphisNode(HOST_TYPES.TEXT_LEAF, {}, 'Hello');
      expect(node.type).toBe('glyphis-text-leaf');
      expect(node.text).toBe('Hello');
      expect(node.children).toEqual([]);
    });

    it('defaults text to null when not provided', () => {
      const node = new GlyphisNode('glyphis-view', {});
      expect(node.text).toBeNull();
    });
  });

  describe('appendChild', () => {
    it('adds child and sets parent', () => {
      const parent = new GlyphisNode('glyphis-view', {});
      const child = new GlyphisNode('glyphis-view', {});
      parent.appendChild(child);
      expect(parent.children).toEqual([child]);
      expect(child.parent).toBe(parent);
    });

    it('removes child from previous parent first', () => {
      const oldParent = new GlyphisNode('glyphis-view', {});
      const newParent = new GlyphisNode('glyphis-view', {});
      const child = new GlyphisNode('glyphis-view', {});

      oldParent.appendChild(child);
      expect(oldParent.children.length).toBe(1);

      newParent.appendChild(child);
      expect(oldParent.children.length).toBe(0);
      expect(newParent.children.length).toBe(1);
      expect(child.parent).toBe(newParent);
    });

    it('maintains order of multiple children', () => {
      const parent = new GlyphisNode('glyphis-view', {});
      const a = new GlyphisNode('glyphis-view', { testID: 'a' });
      const b = new GlyphisNode('glyphis-view', { testID: 'b' });
      const c = new GlyphisNode('glyphis-view', { testID: 'c' });

      parent.appendChild(a);
      parent.appendChild(b);
      parent.appendChild(c);

      expect(parent.children).toEqual([a, b, c]);
    });
  });

  describe('removeChild', () => {
    it('removes child and clears parent', () => {
      const parent = new GlyphisNode('glyphis-view', {});
      const child = new GlyphisNode('glyphis-view', {});
      parent.appendChild(child);
      parent.removeChild(child);
      expect(parent.children).toEqual([]);
      expect(child.parent).toBeNull();
    });

    it('is no-op for non-existent child', () => {
      const parent = new GlyphisNode('glyphis-view', {});
      const other = new GlyphisNode('glyphis-view', {});
      parent.removeChild(other);
      expect(parent.children).toEqual([]);
      expect(other.parent).toBeNull();
    });

    it('preserves other children when removing one', () => {
      const parent = new GlyphisNode('glyphis-view', {});
      const a = new GlyphisNode('glyphis-view', {});
      const b = new GlyphisNode('glyphis-view', {});
      const c = new GlyphisNode('glyphis-view', {});
      parent.appendChild(a);
      parent.appendChild(b);
      parent.appendChild(c);

      parent.removeChild(b);
      expect(parent.children).toEqual([a, c]);
    });
  });

  describe('insertBefore', () => {
    it('inserts child at correct position', () => {
      const parent = new GlyphisNode('glyphis-view', {});
      const a = new GlyphisNode('glyphis-view', { testID: 'a' });
      const b = new GlyphisNode('glyphis-view', { testID: 'b' });
      const c = new GlyphisNode('glyphis-view', { testID: 'c' });

      parent.appendChild(a);
      parent.appendChild(c);
      parent.insertBefore(b, c);

      expect(parent.children).toEqual([a, b, c]);
      expect(b.parent).toBe(parent);
    });

    it('appends when anchor is not found', () => {
      const parent = new GlyphisNode('glyphis-view', {});
      const a = new GlyphisNode('glyphis-view', {});
      const b = new GlyphisNode('glyphis-view', {});
      const notChild = new GlyphisNode('glyphis-view', {});

      parent.appendChild(a);
      parent.insertBefore(b, notChild);

      expect(parent.children).toEqual([a, b]);
      expect(b.parent).toBe(parent);
    });

    it('removes from previous parent before inserting', () => {
      const oldParent = new GlyphisNode('glyphis-view', {});
      const newParent = new GlyphisNode('glyphis-view', {});
      const anchor = new GlyphisNode('glyphis-view', {});
      const child = new GlyphisNode('glyphis-view', {});

      oldParent.appendChild(child);
      newParent.appendChild(anchor);
      newParent.insertBefore(child, anchor);

      expect(oldParent.children.length).toBe(0);
      expect(newParent.children).toEqual([child, anchor]);
    });
  });

  describe('updateProps', () => {
    it('replaces props entirely', () => {
      const node = new GlyphisNode('glyphis-view', { style: { flex: 1 } });
      node.updateProps({ style: { flex: 2 }, testID: 'updated' });
      expect(node.props).toEqual({ style: { flex: 2 }, testID: 'updated' });
    });
  });

  describe('updateText', () => {
    it('updates text content', () => {
      const node = new GlyphisNode(HOST_TYPES.TEXT_LEAF, {}, 'old');
      node.updateText('new');
      expect(node.text).toBe('new');
    });
  });

  describe('deep tree', () => {
    it('maintains correct parent pointers in three-level tree', () => {
      const root = new GlyphisNode(HOST_TYPES.ROOT, {});
      const child = new GlyphisNode('glyphis-view', {});
      const grandchild = new GlyphisNode('glyphis-text', {});

      root.appendChild(child);
      child.appendChild(grandchild);

      expect(grandchild.parent).toBe(child);
      expect(child.parent).toBe(root);
      expect(root.parent).toBeNull();
    });
  });
});

describe('HOST_TYPES', () => {
  it('has expected type constants', () => {
    expect(HOST_TYPES.VIEW).toBe('glyphis-view');
    expect(HOST_TYPES.TEXT).toBe('glyphis-text');
    expect(HOST_TYPES.TEXT_LEAF).toBe('glyphis-text-leaf');
    expect(HOST_TYPES.IMAGE).toBe('glyphis-image');
    expect(HOST_TYPES.SCROLL_VIEW).toBe('glyphis-scroll-view');
    expect(HOST_TYPES.TEXT_INPUT).toBe('glyphis-text-input');
    expect(HOST_TYPES.ROOT).toBe('glyphis-root');
  });
});
