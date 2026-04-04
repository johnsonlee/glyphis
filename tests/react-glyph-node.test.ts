import { describe, it, expect } from 'bun:test';
import { GlyphNode, HOST_TYPES } from '../src/react/glyph-node';

describe('GlyphNode', () => {
  describe('constructor', () => {
    it('creates node with correct type, props, and empty children', () => {
      const node = new GlyphNode('glyph-view', { style: { flex: 1 } });
      expect(node.type).toBe('glyph-view');
      expect(node.props).toEqual({ style: { flex: 1 } });
      expect(node.children).toEqual([]);
      expect(node.parent).toBeNull();
      expect(node.text).toBeNull();
    });

    it('creates text leaf node with text content', () => {
      const node = new GlyphNode(HOST_TYPES.TEXT_LEAF, {}, 'Hello');
      expect(node.type).toBe('glyph-text-leaf');
      expect(node.text).toBe('Hello');
      expect(node.children).toEqual([]);
    });

    it('defaults text to null when not provided', () => {
      const node = new GlyphNode('glyph-view', {});
      expect(node.text).toBeNull();
    });
  });

  describe('appendChild', () => {
    it('adds child and sets parent', () => {
      const parent = new GlyphNode('glyph-view', {});
      const child = new GlyphNode('glyph-view', {});
      parent.appendChild(child);
      expect(parent.children).toEqual([child]);
      expect(child.parent).toBe(parent);
    });

    it('removes child from previous parent first', () => {
      const oldParent = new GlyphNode('glyph-view', {});
      const newParent = new GlyphNode('glyph-view', {});
      const child = new GlyphNode('glyph-view', {});

      oldParent.appendChild(child);
      expect(oldParent.children.length).toBe(1);

      newParent.appendChild(child);
      expect(oldParent.children.length).toBe(0);
      expect(newParent.children.length).toBe(1);
      expect(child.parent).toBe(newParent);
    });

    it('maintains order of multiple children', () => {
      const parent = new GlyphNode('glyph-view', {});
      const a = new GlyphNode('glyph-view', { testID: 'a' });
      const b = new GlyphNode('glyph-view', { testID: 'b' });
      const c = new GlyphNode('glyph-view', { testID: 'c' });

      parent.appendChild(a);
      parent.appendChild(b);
      parent.appendChild(c);

      expect(parent.children).toEqual([a, b, c]);
    });
  });

  describe('removeChild', () => {
    it('removes child and clears parent', () => {
      const parent = new GlyphNode('glyph-view', {});
      const child = new GlyphNode('glyph-view', {});
      parent.appendChild(child);
      parent.removeChild(child);
      expect(parent.children).toEqual([]);
      expect(child.parent).toBeNull();
    });

    it('is no-op for non-existent child', () => {
      const parent = new GlyphNode('glyph-view', {});
      const other = new GlyphNode('glyph-view', {});
      parent.removeChild(other);
      expect(parent.children).toEqual([]);
      expect(other.parent).toBeNull();
    });

    it('preserves other children when removing one', () => {
      const parent = new GlyphNode('glyph-view', {});
      const a = new GlyphNode('glyph-view', {});
      const b = new GlyphNode('glyph-view', {});
      const c = new GlyphNode('glyph-view', {});
      parent.appendChild(a);
      parent.appendChild(b);
      parent.appendChild(c);

      parent.removeChild(b);
      expect(parent.children).toEqual([a, c]);
    });
  });

  describe('insertBefore', () => {
    it('inserts child at correct position', () => {
      const parent = new GlyphNode('glyph-view', {});
      const a = new GlyphNode('glyph-view', { testID: 'a' });
      const b = new GlyphNode('glyph-view', { testID: 'b' });
      const c = new GlyphNode('glyph-view', { testID: 'c' });

      parent.appendChild(a);
      parent.appendChild(c);
      parent.insertBefore(b, c);

      expect(parent.children).toEqual([a, b, c]);
      expect(b.parent).toBe(parent);
    });

    it('appends when anchor is not found', () => {
      const parent = new GlyphNode('glyph-view', {});
      const a = new GlyphNode('glyph-view', {});
      const b = new GlyphNode('glyph-view', {});
      const notChild = new GlyphNode('glyph-view', {});

      parent.appendChild(a);
      parent.insertBefore(b, notChild);

      expect(parent.children).toEqual([a, b]);
      expect(b.parent).toBe(parent);
    });

    it('removes from previous parent before inserting', () => {
      const oldParent = new GlyphNode('glyph-view', {});
      const newParent = new GlyphNode('glyph-view', {});
      const anchor = new GlyphNode('glyph-view', {});
      const child = new GlyphNode('glyph-view', {});

      oldParent.appendChild(child);
      newParent.appendChild(anchor);
      newParent.insertBefore(child, anchor);

      expect(oldParent.children.length).toBe(0);
      expect(newParent.children).toEqual([child, anchor]);
    });
  });

  describe('updateProps', () => {
    it('replaces props entirely', () => {
      const node = new GlyphNode('glyph-view', { style: { flex: 1 } });
      node.updateProps({ style: { flex: 2 }, testID: 'updated' });
      expect(node.props).toEqual({ style: { flex: 2 }, testID: 'updated' });
    });
  });

  describe('updateText', () => {
    it('updates text content', () => {
      const node = new GlyphNode(HOST_TYPES.TEXT_LEAF, {}, 'old');
      node.updateText('new');
      expect(node.text).toBe('new');
    });
  });

  describe('deep tree', () => {
    it('maintains correct parent pointers in three-level tree', () => {
      const root = new GlyphNode(HOST_TYPES.ROOT, {});
      const child = new GlyphNode('glyph-view', {});
      const grandchild = new GlyphNode('glyph-text', {});

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
    expect(HOST_TYPES.VIEW).toBe('glyph-view');
    expect(HOST_TYPES.TEXT).toBe('glyph-text');
    expect(HOST_TYPES.TEXT_LEAF).toBe('glyph-text-leaf');
    expect(HOST_TYPES.IMAGE).toBe('glyph-image');
    expect(HOST_TYPES.SCROLL_VIEW).toBe('glyph-scroll-view');
    expect(HOST_TYPES.TEXT_INPUT).toBe('glyph-text-input');
    expect(HOST_TYPES.ROOT).toBe('glyph-root');
  });
});
