import { GlyphNode, HOST_TYPES } from '../react/glyph-node';

export const nodeOps = {
  createElement(tag: string): GlyphNode {
    return new GlyphNode(tag, {});
  },

  createText(text: string): GlyphNode {
    return new GlyphNode(HOST_TYPES.TEXT_LEAF, {}, text);
  },

  createComment(_text: string): GlyphNode {
    // Comments are no-ops in Glyph, but Vue requires this
    return new GlyphNode('glyph-comment', {});
  },

  insert(child: GlyphNode, parent: GlyphNode, anchor?: GlyphNode | null): void {
    if (anchor) {
      parent.insertBefore(child, anchor);
    } else {
      parent.appendChild(child);
    }
  },

  remove(child: GlyphNode): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }
  },

  setText(node: GlyphNode, text: string): void {
    node.updateText(text);
  },

  setElementText(node: GlyphNode, text: string): void {
    // Clear children and add a text leaf
    node.children.forEach(c => { c.parent = null; });
    node.children = [];
    if (text) {
      const textNode = new GlyphNode(HOST_TYPES.TEXT_LEAF, {}, text);
      node.appendChild(textNode);
    }
  },

  parentNode(node: GlyphNode): GlyphNode | null {
    return node.parent;
  },

  nextSibling(node: GlyphNode): GlyphNode | null {
    if (!node.parent) return null;
    const siblings = node.parent.children;
    const idx = siblings.indexOf(node);
    return idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  },
};
