// QuickJS compatibility test for SolidJS + yoga-layout + Glyphis renderer
// Tests: signals, effects, memos, microtasks, closures, render pipeline

import { createSignal, createEffect, createMemo, createRoot, batch } from 'solid-js';
import { createRenderer } from 'solid-js/universal';
import Yoga, { Direction, Edge, FlexDirection } from 'yoga-layout';
import { type GlyphisNode, createGlyphisNode } from '../src/node';
import { applyStyle } from '../src/styles';
import { generateCommands } from '../src/commands';
import type { Style } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

// ============================================================
// Test 1: Basic signals
// ============================================================
console.log('Test 1: Basic signals');
{
  const [count, setCount] = createSignal(0);
  assert(count() === 0, 'initial value');
  setCount(42);
  assert(count() === 42, 'updated value');
  setCount(prev => prev + 1);
  assert(count() === 43, 'functional update');
}

// ============================================================
// Test 2: Effects track dependencies
// ============================================================
console.log('Test 2: Effects');
{
  const log: number[] = [];
  const [count, setCount] = createSignal(0);
  createRoot(() => {
    createEffect(() => {
      log.push(count());
    });
  });
  setCount(1);
  setCount(2);
  // SolidJS effects run synchronously on signal change
  assert(log.join(',') === '0,1,2', `effect log: ${log.join(',')}`);
}

// ============================================================
// Test 3: Memos
// ============================================================
console.log('Test 3: Memos');
{
  const [a, setA] = createSignal(2);
  const [b, setB] = createSignal(3);
  let computeCount = 0;
  const product = createMemo(() => { computeCount++; return a() * b(); });
  assert(product() === 6, 'initial memo');
  setA(5);
  assert(product() === 15, 'memo after update');
  // Reading again shouldn't recompute
  const prevCount = computeCount;
  product();
  assert(computeCount === prevCount, 'memo cached');
}

// ============================================================
// Test 4: Batch updates
// ============================================================
console.log('Test 4: Batch');
{
  const log: string[] = [];
  const [a, setA] = createSignal(1);
  const [b, setB] = createSignal(2);
  createRoot(() => {
    createEffect(() => {
      log.push(`${a()}+${b()}`);
    });
  });
  batch(() => {
    setA(10);
    setB(20);
  });
  // Batch should produce one effect run, not two
  assert(log.join(' | ') === '1+2 | 10+20', `batch log: ${log.join(' | ')}`);
}

// ============================================================
// Test 5: Nested closures with signals (the old pain point)
// ============================================================
console.log('Test 5: Nested closures');
{
  const results: number[] = [];
  const [outer, setOuter] = createSignal(1);

  createRoot(() => {
    const [inner, setInner] = createSignal(10);

    createEffect(() => {
      const o = outer();
      createEffect(() => {
        results.push(o + inner());
      });
    });

    setInner(20);
    setOuter(2);
    setInner(30);
  });

  // Should see: 11, 21, 22, 32
  assert(results.length >= 3, `nested closure ran ${results.length} times`);
  assert(results[0] === 11, `first: ${results[0]}`);
}

// ============================================================
// Test 6: Yoga layout
// ============================================================
console.log('Test 6: Yoga layout');
{
  const root = Yoga.Node.create();
  root.setWidth(390);
  root.setHeight(844);
  root.setFlexDirection(FlexDirection.Column);

  const child1 = Yoga.Node.create();
  child1.setHeight(100);

  const child2 = Yoga.Node.create();
  child2.setFlex(1);

  root.insertChild(child1, 0);
  root.insertChild(child2, 1);
  root.calculateLayout(390, 844, Direction.LTR);

  assert(child1.getComputedHeight() === 100, 'child1 height = 100');
  assert(child2.getComputedHeight() === 744, `child2 flex = ${child2.getComputedHeight()}`);
  assert(child2.getComputedTop() === 100, `child2 top = ${child2.getComputedTop()}`);
  root.freeRecursive();
}

// ============================================================
// Test 7: Render command generation
// ============================================================
console.log('Test 7: Render commands');
{
  const root = createGlyphisNode(Yoga.Node.create(), '__root');
  root.yoga.setWidth(390);
  root.yoga.setHeight(844);

  const view = createGlyphisNode(Yoga.Node.create(), 'view');
  view.style = { backgroundColor: '#FF0000', flex: 1 };
  applyStyle(view.yoga, view.style);
  view.parent = root;
  root.children.push(view);
  root.yoga.insertChild(view.yoga, 0);

  const text = createGlyphisNode(Yoga.Node.create(), 'text');
  text.style = { color: '#FFF', fontSize: 24 };
  text.parent = view;
  view.children.push(text);
  view.yoga.insertChild(text.yoga, 0);

  const leaf = createGlyphisNode(Yoga.Node.create(), '__text');
  leaf.text = 'QuickJS test';
  leaf.parent = text;
  leaf.yoga.setMeasureFunc(() => ({ width: 120, height: 29 }));
  text.children.push(leaf);
  text.yoga.insertChild(leaf.yoga, 0);

  root.yoga.calculateLayout(390, 844, Direction.LTR);
  const cmds = generateCommands(root);

  assert(cmds.some(c => c.type === 'rect' && c.color === '#FF0000'), 'has rect');
  assert(cmds.some(c => c.type === 'text' && (c as any).text === 'QuickJS test' && (c as any).color === '#FFF'), 'has text');
  root.yoga.freeRecursive();
}

// ============================================================
// Test 8: SolidJS universal renderer
// ============================================================
console.log('Test 8: createRenderer');
{
  type TestNode = { tag: string; children: TestNode[]; props: Record<string, any>; text?: string };

  const renderer = createRenderer<TestNode>({
    createElement: (tag) => ({ tag, children: [], props: {} }),
    createTextNode: (value) => ({ tag: '__text', children: [], props: {}, text: value }),
    replaceText: (node, value) => { node.text = value; },
    isTextNode: (node) => node.tag === '__text',
    setProperty: (node, name, value) => { node.props[name] = value; },
    insertNode: (parent, node, anchor) => {
      const idx = anchor ? parent.children.indexOf(anchor) : -1;
      if (idx >= 0) parent.children.splice(idx, 0, node);
      else parent.children.push(node);
    },
    removeNode: (parent, node) => {
      const idx = parent.children.indexOf(node);
      if (idx >= 0) parent.children.splice(idx, 1);
    },
    getParentNode: () => undefined,
    getFirstChild: (node) => node.children[0],
    getNextSibling: () => undefined,
  });

  const root: TestNode = { tag: 'root', children: [], props: {} };
  const [label, setLabel] = createSignal('hello');

  const dispose = renderer.render(() => {
    const node = renderer.createElement('view');
    renderer.setProp(node, 'style', { flex: 1 });
    renderer.insert(node, () => {
      const text = renderer.createTextNode(label());
      return text;
    });
    return node;
  }, root);

  assert(root.children.length === 1, 'root has 1 child');
  assert(root.children[0]?.tag === 'view', 'child is view');

  // Find text node
  const viewNode = root.children[0];
  const textNode = viewNode?.children[0];
  assert(textNode?.text === 'hello', `text = ${textNode?.text}`);

  // Reactive update
  setLabel('world');
  const updatedText = viewNode?.children[0];
  assert(updatedText?.text === 'world', `updated text = ${updatedText?.text}`);

  dispose();
}

// ============================================================
// Test 9: queueMicrotask
// ============================================================
console.log('Test 9: queueMicrotask');
{
  let microtaskRan = false;
  queueMicrotask(() => { microtaskRan = true; });
  // In QuickJS, microtasks run after the current job completes
  // We check after a Promise to ensure microtask queue is flushed
  await new Promise<void>(resolve => {
    queueMicrotask(() => {
      assert(microtaskRan, 'microtask executed');
      resolve();
    });
  });
}

// ============================================================
// Test 10: Promise chains (the old problem area)
// ============================================================
console.log('Test 10: Promise chains');
{
  const order: number[] = [];
  await new Promise<void>(resolve => {
    Promise.resolve().then(() => { order.push(1); });
    Promise.resolve().then(() => { order.push(2); });
    Promise.resolve().then(() => {
      Promise.resolve().then(() => {
        order.push(3);
        assert(order.join(',') === '1,2,3', `promise order: ${order.join(',')}`);
        resolve();
      });
    });
  });
}

// ============================================================
// Summary
// ============================================================
console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('QUICKJS COMPATIBILITY: FAILED');
} else {
  console.log('QUICKJS COMPATIBILITY: PASSED');
}
