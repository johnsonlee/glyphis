import { describe, test, expect, beforeEach } from 'bun:test';
import Yoga from 'yoga-layout';
import { createGlyphisNode } from '../src/node';
import type { GlyphisNode } from '../src/node';
import { applyStyle } from '../src/styles';
import { buildSemanticsTree, findNodeBySemanticsId } from '../src/accessibility';

function makeNode(tag: string, style: GlyphisNode['style'] = {}): GlyphisNode {
  var yoga = Yoga.Node.create();
  var node = createGlyphisNode(yoga, tag);
  node.style = style;
  applyStyle(yoga, style);
  return node;
}

function appendChild(parent: GlyphisNode, child: GlyphisNode): void {
  parent.yoga.insertChild(child.yoga, parent.children.length);
  parent.children.push(child);
  child.parent = parent;
}

function layout(root: GlyphisNode): void {
  root.yoga.calculateLayout(undefined, undefined);
}

// ---------------------------------------------------------------------------
// buildSemanticsTree
// ---------------------------------------------------------------------------

describe('buildSemanticsTree', function () {
  test('empty tree returns empty array', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result).toEqual([]);
    root.yoga.freeRecursive();
  });

  test('node with accessible:true is included', function () {
    var root = makeNode('view', { width: 200, height: 200 });
    root.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Root',
      accessibilityRole: 'button',
    };
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result.length).toBe(1);
    expect(result[0].label).toBe('Root');
    expect(result[0].role).toBe('button');
    root.yoga.freeRecursive();
  });

  test('node with accessible:false is excluded', function () {
    var root = makeNode('view', { width: 200, height: 200 });
    root.accessibilityProps = {
      accessible: false,
      accessibilityLabel: 'Hidden',
    };
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result.length).toBe(0);
    root.yoga.freeRecursive();
  });

  test('non-accessible nodes are skipped', function () {
    var root = makeNode('view', { width: 200, height: 200 });
    // No accessibilityProps at all
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result.length).toBe(0);
    root.yoga.freeRecursive();
  });

  test('absolute positions accumulated from parent chain', function () {
    var root = makeNode('view', { width: 300, height: 300 });
    var parent = makeNode('view', { width: 200, height: 200, marginLeft: 10, marginTop: 20 });
    var child = makeNode('view', { width: 50, height: 50, marginLeft: 5, marginTop: 15 });
    child.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Child',
    };

    appendChild(root, parent);
    appendChild(parent, child);
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result.length).toBe(1);
    // child is at parent.left + child.left, parent.top + child.top
    expect(result[0].x).toBe(15); // 10 + 5
    expect(result[0].y).toBe(35); // 20 + 15
    expect(result[0].width).toBe(50);
    expect(result[0].height).toBe(50);
    root.yoga.freeRecursive();
  });

  test('label from accessibilityLabel prop', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    root.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'My Label',
    };
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result[0].label).toBe('My Label');
    root.yoga.freeRecursive();
  });

  test('label collected from __text children when no explicit label', function () {
    var root = makeNode('view', { width: 200, height: 100 });
    root.accessibilityProps = {
      accessible: true,
    };

    var textChild1 = makeNode('__text', {});
    textChild1.text = 'Hello';
    var textChild2 = makeNode('__text', {});
    textChild2.text = 'World';

    appendChild(root, textChild1);
    appendChild(root, textChild2);
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result.length).toBe(1);
    expect(result[0].label).toBe('Hello World');
    root.yoga.freeRecursive();
  });

  test('label collected from nested __text children', function () {
    var root = makeNode('view', { width: 200, height: 100 });
    root.accessibilityProps = {
      accessible: true,
    };

    var wrapper = makeNode('text', { width: 100, height: 50 });
    var textChild = makeNode('__text', {});
    textChild.text = 'Nested';

    appendChild(wrapper, textChild);
    appendChild(root, wrapper);
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result[0].label).toBe('Nested');
    root.yoga.freeRecursive();
  });

  test('role from accessibilityRole', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    root.accessibilityProps = {
      accessible: true,
      accessibilityRole: 'button',
    };
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result[0].role).toBe('button');
    root.yoga.freeRecursive();
  });

  test('role defaults to none when not specified', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    root.accessibilityProps = {
      accessible: true,
    };
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result[0].role).toBe('none');
    root.yoga.freeRecursive();
  });

  test('hint from accessibilityHint', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    root.accessibilityProps = {
      accessible: true,
      accessibilityHint: 'Double tap to activate',
    };
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result[0].hint).toBe('Double tap to activate');
    root.yoga.freeRecursive();
  });

  test('hint defaults to empty string when not specified', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    root.accessibilityProps = {
      accessible: true,
    };
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result[0].hint).toBe('');
    root.yoga.freeRecursive();
  });

  test('actions include activate when node has onPress handler', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    root.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Pressable',
    };
    root.handlers.onPress = function () {};
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result[0].actions).toContain('activate');
    root.yoga.freeRecursive();
  });

  test('actions empty when no onPress', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    root.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Static',
    };
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result[0].actions).toEqual([]);
    root.yoga.freeRecursive();
  });

  test('nested accessible nodes get correct parentId', function () {
    var root = makeNode('view', { width: 300, height: 300 });
    root.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Root',
    };

    var child = makeNode('view', { width: 100, height: 100 });
    child.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Child',
    };

    appendChild(root, child);
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result.length).toBe(2);
    // Root's parentId should be -1 (passed as initial parentSemanticsId)
    expect(result[0].parentId).toBe(-1);
    // Child's parentId should be root's semanticsId
    expect(result[1].parentId).toBe(result[0].id);
    root.yoga.freeRecursive();
  });

  test('semanticsId is assigned and stable across calls', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    root.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Stable',
    };
    layout(root);

    var result1 = buildSemanticsTree(root);
    var id1 = result1[0].id;
    expect(id1).toBeGreaterThan(0);

    // Second call should return the same semanticsId
    var result2 = buildSemanticsTree(root);
    expect(result2[0].id).toBe(id1);
    root.yoga.freeRecursive();
  });

  test('non-accessible parent passes position to accessible child', function () {
    var root = makeNode('view', { width: 400, height: 400 });
    var nonAccessibleParent = makeNode('view', { width: 200, height: 200, marginLeft: 50, marginTop: 60 });
    var accessibleChild = makeNode('view', { width: 80, height: 40 });
    accessibleChild.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Deep',
    };

    appendChild(root, nonAccessibleParent);
    appendChild(nonAccessibleParent, accessibleChild);
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result.length).toBe(1);
    expect(result[0].x).toBe(50);
    expect(result[0].y).toBe(60);
    root.yoga.freeRecursive();
  });
});

// ---------------------------------------------------------------------------
// findNodeBySemanticsId
// ---------------------------------------------------------------------------

describe('findNodeBySemanticsId', function () {
  test('returns the node with matching semanticsId', function () {
    var root = makeNode('view', { width: 200, height: 200 });
    root.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Root',
    };

    var child = makeNode('view', { width: 100, height: 100 });
    child.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Child',
    };

    appendChild(root, child);
    layout(root);

    // Build tree to assign semanticsIds
    var tree = buildSemanticsTree(root);
    expect(tree.length).toBe(2);

    var foundRoot = findNodeBySemanticsId(root, root.semanticsId!);
    expect(foundRoot).toBe(root);

    var foundChild = findNodeBySemanticsId(root, child.semanticsId!);
    expect(foundChild).toBe(child);
    root.yoga.freeRecursive();
  });

  test('returns null for unknown id', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    root.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Only',
    };
    layout(root);

    buildSemanticsTree(root);
    var result = findNodeBySemanticsId(root, 999999);
    expect(result).toBeNull();
    root.yoga.freeRecursive();
  });

  test('returns null when searching empty tree', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    layout(root);

    var result = findNodeBySemanticsId(root, 1);
    expect(result).toBeNull();
    root.yoga.freeRecursive();
  });

  test('finds deeply nested node', function () {
    var root = makeNode('view', { width: 300, height: 300 });
    var mid = makeNode('view', { width: 200, height: 200 });
    var deep = makeNode('view', { width: 100, height: 100 });
    deep.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Deep',
    };

    appendChild(root, mid);
    appendChild(mid, deep);
    layout(root);

    buildSemanticsTree(root);
    var found = findNodeBySemanticsId(root, deep.semanticsId!);
    expect(found).toBe(deep);
    root.yoga.freeRecursive();
  });
});
