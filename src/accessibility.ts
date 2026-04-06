import type { GlyphisNode } from './node';
import type { SemanticsNode } from './types';
import { beginSpan, endSpan } from './trace';

var nextSemanticsId = 1;

export function buildSemanticsTree(root: GlyphisNode): SemanticsNode[] {
  var span = beginSpan('buildSemanticsTree', 'accessibility');
  var nodes: SemanticsNode[] = [];
  walkForSemantics(root, 0, 0, -1, nodes);
  endSpan(span, { nodeCount: nodes.length });
  return nodes;
}

function walkForSemantics(
  node: GlyphisNode,
  parentX: number,
  parentY: number,
  parentSemanticsId: number,
  result: SemanticsNode[]
): void {
  var layout = node.yoga.getComputedLayout();
  var x = parentX + layout.left;
  var y = parentY + layout.top;
  var w = layout.width;
  var h = layout.height;

  var currentParentId = parentSemanticsId;

  var a11y = node.accessibilityProps;
  if (a11y && a11y.accessible) {
    if (!node.semanticsId) {
      node.semanticsId = nextSemanticsId++;
    }
    var label = a11y.accessibilityLabel || '';
    // If no label, try to collect text from __text children
    if (!label) {
      label = collectTextContent(node);
    }

    var actions: string[] = [];
    if (node.handlers.onPress) {
      actions.push('activate');
    }

    result.push({
      id: node.semanticsId,
      parentId: parentSemanticsId,
      x: x,
      y: y,
      width: w,
      height: h,
      label: label,
      hint: a11y.accessibilityHint || '',
      role: a11y.accessibilityRole || 'none',
      actions: actions,
    });

    currentParentId = node.semanticsId;
  }

  for (var i = 0; i < node.children.length; i++) {
    walkForSemantics(node.children[i], x, y, currentParentId, result);
  }
}

function collectTextContent(node: GlyphisNode): string {
  if (node.tag === '__text') return node.text;
  var texts: string[] = [];
  for (var i = 0; i < node.children.length; i++) {
    var t = collectTextContent(node.children[i]);
    if (t) texts.push(t);
  }
  return texts.join(' ');
}

/**
 * Find a GlyphisNode by its semanticsId. Returns null if not found.
 */
export function findNodeBySemanticsId(root: GlyphisNode, semanticsId: number): GlyphisNode | null {
  if (root.semanticsId === semanticsId) return root;
  for (var i = 0; i < root.children.length; i++) {
    var found = findNodeBySemanticsId(root.children[i], semanticsId);
    if (found) return found;
  }
  return null;
}
