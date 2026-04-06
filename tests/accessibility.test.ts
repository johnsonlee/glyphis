import { describe, test, expect } from 'bun:test';
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

function removeChild(parent: GlyphisNode, child: GlyphisNode): void {
  var index = parent.children.indexOf(child);
  if (index !== -1) parent.children.splice(index, 1);
  parent.yoga.removeChild(child.yoga);
  child.parent = undefined;
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

  test('accessible:true included, accessible:false excluded', function () {
    var root = makeNode('view', { width: 300, height: 300 });

    var included = makeNode('view', { width: 100, height: 50 });
    included.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Visible',
      accessibilityRole: 'button',
    };

    var excluded = makeNode('view', { width: 100, height: 50 });
    excluded.accessibilityProps = {
      accessible: false,
      accessibilityLabel: 'Hidden',
    };

    appendChild(root, included);
    appendChild(root, excluded);
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result.length).toBe(1);
    expect(result[0].label).toBe('Visible');
    expect(result[0].role).toBe('button');
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
    expect(result[0].x).toBe(15); // 10 + 5
    expect(result[0].y).toBe(35); // 20 + 15
    expect(result[0].width).toBe(50);
    expect(result[0].height).toBe(50);
    root.yoga.freeRecursive();
  });

  test('label from explicit accessibilityLabel prop', function () {
    var root = makeNode('view', { width: 200, height: 200 });
    root.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Explicit Label',
    };

    // Also add a __text child to prove explicit label wins
    var textChild = makeNode('__text', {});
    textChild.text = 'Text Child';
    appendChild(root, textChild);
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result[0].label).toBe('Explicit Label');
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
    expect(result[0].parentId).toBe(-1);
    expect(result[1].parentId).toBe(result[0].id);
    root.yoga.freeRecursive();
  });

  test('semanticsId stable across calls', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    root.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Stable',
    };
    layout(root);

    var result1 = buildSemanticsTree(root);
    var id1 = result1[0].id;
    expect(id1).toBeGreaterThan(0);

    var result2 = buildSemanticsTree(root);
    expect(result2[0].id).toBe(id1);
    root.yoga.freeRecursive();
  });

  test('dynamic add/remove of accessible nodes preserves existing semanticsIds', function () {
    var root = makeNode('view', { width: 400, height: 400 });
    var childA = makeNode('view', { width: 100, height: 50 });
    childA.accessibilityProps = { accessible: true, accessibilityLabel: 'A' };

    appendChild(root, childA);
    layout(root);

    // Initial tree: just A
    var result1 = buildSemanticsTree(root);
    expect(result1.length).toBe(1);
    var idA = result1[0].id;

    // Add a new child B
    var childB = makeNode('view', { width: 100, height: 50 });
    childB.accessibilityProps = { accessible: true, accessibilityLabel: 'B' };
    appendChild(root, childB);
    layout(root);

    var result2 = buildSemanticsTree(root);
    expect(result2.length).toBe(2);
    // A's id must not change
    expect(result2[0].id).toBe(idA);
    expect(result2[0].label).toBe('A');
    expect(result2[1].label).toBe('B');
    var idB = result2[1].id;
    expect(idB).not.toBe(idA);

    // Remove B
    removeChild(root, childB);
    layout(root);

    var result3 = buildSemanticsTree(root);
    expect(result3.length).toBe(1);
    // A's id still stable
    expect(result3[0].id).toBe(idA);
    expect(result3[0].label).toBe('A');

    childB.yoga.free();
    root.yoga.freeRecursive();
  });

  test('accessibilityAction end-to-end: findNodeBySemanticsId then invoke onPress', function () {
    var root = makeNode('view', { width: 300, height: 300 });
    var button = makeNode('view', { width: 120, height: 40 });
    var pressed = false;
    button.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Submit',
      accessibilityRole: 'button',
    };
    button.handlers.onPress = function () {
      pressed = true;
    };

    appendChild(root, button);
    layout(root);

    // Build the semantics tree as the platform would
    var tree = buildSemanticsTree(root);
    expect(tree.length).toBe(1);
    expect(tree[0].actions).toContain('activate');

    // Platform receives a semanticsId from the OS accessibility layer
    var targetId = tree[0].id;

    // Look up the actual node by semanticsId
    var found = findNodeBySemanticsId(root, targetId);
    expect(found).not.toBeNull();
    expect(found).toBe(button);

    // Invoke the handler as the platform would for an "activate" action
    expect(found!.handlers.onPress).toBeDefined();
    found!.handlers.onPress();
    expect(pressed).toBe(true);

    root.yoga.freeRecursive();
  });

  test('multiple accessible nodes at same tree depth have correct sequential positions', function () {
    var root = makeNode('view', { width: 200, height: 500 });
    var buttons: GlyphisNode[] = [];

    for (var i = 0; i < 5; i++) {
      var btn = makeNode('view', { width: 200, height: 40 });
      btn.accessibilityProps = {
        accessible: true,
        accessibilityLabel: 'Button ' + i,
        accessibilityRole: 'button',
      };
      appendChild(root, btn);
      buttons.push(btn);
    }
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result.length).toBe(5);

    // All 5 nodes should appear at x=0 with sequential Y positions
    for (var j = 0; j < 5; j++) {
      expect(result[j].label).toBe('Button ' + j);
      expect(result[j].x).toBe(0);
      expect(result[j].y).toBe(j * 40);
      expect(result[j].width).toBe(200);
      expect(result[j].height).toBe(40);
    }

    // Verify non-overlapping: each node's Y starts where the previous ends
    for (var k = 1; k < 5; k++) {
      expect(result[k].y).toBe(result[k - 1].y + result[k - 1].height);
    }

    root.yoga.freeRecursive();
  });

  test('mixed accessible and non-accessible siblings produce correct output and parentIds', function () {
    var root = makeNode('view', { width: 300, height: 300 });
    // root is NOT accessible

    var first = makeNode('view', { width: 100, height: 50 });
    first.accessibilityProps = { accessible: true, accessibilityLabel: 'First' };

    var middle = makeNode('view', { width: 100, height: 50 });
    // middle is NOT accessible (no accessibilityProps)

    var last = makeNode('view', { width: 100, height: 50 });
    last.accessibilityProps = { accessible: true, accessibilityLabel: 'Last' };

    appendChild(root, first);
    appendChild(root, middle);
    appendChild(root, last);
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result.length).toBe(2);
    expect(result[0].label).toBe('First');
    expect(result[1].label).toBe('Last');
    // Both should have parentId -1 since root is not accessible
    expect(result[0].parentId).toBe(-1);
    expect(result[1].parentId).toBe(-1);

    root.yoga.freeRecursive();
  });

  test('deeply nested accessible -> non-accessible -> accessible: parentId skips non-accessible', function () {
    var root = makeNode('view', { width: 400, height: 400 });
    var outer = makeNode('view', { width: 300, height: 300 });
    outer.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Outer',
    };

    var nonAccessibleMiddle = makeNode('view', { width: 200, height: 200, marginLeft: 10, marginTop: 10 });
    // no accessibilityProps

    var inner = makeNode('view', { width: 100, height: 100 });
    inner.accessibilityProps = {
      accessible: true,
      accessibilityLabel: 'Inner',
    };

    appendChild(root, outer);
    appendChild(outer, nonAccessibleMiddle);
    appendChild(nonAccessibleMiddle, inner);
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result.length).toBe(2);

    var outerNode = result[0];
    var innerNode = result[1];
    expect(outerNode.label).toBe('Outer');
    expect(innerNode.label).toBe('Inner');

    // Inner's parentId should point to Outer (skipping the non-accessible middle)
    expect(innerNode.parentId).toBe(outerNode.id);

    // Inner's position should accumulate through the non-accessible middle
    expect(innerNode.x).toBe(10); // outer.left(0) + middle.marginLeft(10) + inner.left(0)
    expect(innerNode.y).toBe(10); // outer.top(0) + middle.marginTop(10) + inner.top(0)

    root.yoga.freeRecursive();
  });

  test('text collection skips non-text children', function () {
    var root = makeNode('view', { width: 300, height: 200 });
    root.accessibilityProps = {
      accessible: true,
    };

    // __text child - should be collected
    var text1 = makeNode('__text', {});
    text1.text = 'Hello';

    // view child - should NOT contribute to label
    var viewChild = makeNode('view', { width: 50, height: 50 });

    // A view child that itself contains __text - collectTextContent recurses,
    // so this WILL be collected (it finds __text inside)
    var wrapper = makeNode('view', { width: 50, height: 50 });
    var nestedText = makeNode('__text', {});
    nestedText.text = 'World';
    appendChild(wrapper, nestedText);

    // __text child - should be collected
    var text2 = makeNode('__text', {});
    text2.text = 'End';

    appendChild(root, text1);
    appendChild(root, viewChild);
    appendChild(root, wrapper);
    appendChild(root, text2);
    layout(root);

    var result = buildSemanticsTree(root);
    expect(result.length).toBe(1);
    // text1 + wrapper's nested text + text2 (viewChild has no text content)
    expect(result[0].label).toBe('Hello World End');

    root.yoga.freeRecursive();
  });

  test('large tree performance: 100 accessible nodes', function () {
    var root = makeNode('view', { width: 200, height: 5000 });

    for (var i = 0; i < 100; i++) {
      var child = makeNode('view', { width: 200, height: 40 });
      child.accessibilityProps = {
        accessible: true,
        accessibilityLabel: 'Item ' + i,
      };
      appendChild(root, child);
    }
    layout(root);

    var start = performance.now();
    var result = buildSemanticsTree(root);
    var elapsed = performance.now() - start;

    expect(result.length).toBe(100);
    // Sanity: should complete well under 100ms even on slow machines
    expect(elapsed).toBeLessThan(100);

    // Verify first and last are correct
    expect(result[0].label).toBe('Item 0');
    expect(result[99].label).toBe('Item 99');

    // Verify all have unique ids
    var ids = new Set(result.map(function (n) { return n.id; }));
    expect(ids.size).toBe(100);

    root.yoga.freeRecursive();
  });
});

// ---------------------------------------------------------------------------
// findNodeBySemanticsId
// ---------------------------------------------------------------------------

describe('findNodeBySemanticsId', function () {
  test('returns the correct node for root and child', function () {
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

    buildSemanticsTree(root);

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

  test('returns null when searching tree with no semanticsIds assigned', function () {
    var root = makeNode('view', { width: 100, height: 100 });
    layout(root);

    var result = findNodeBySemanticsId(root, 1);
    expect(result).toBeNull();
    root.yoga.freeRecursive();
  });

  test('finds deeply nested node through non-accessible intermediaries', function () {
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
