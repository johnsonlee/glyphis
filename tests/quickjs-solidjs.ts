// Test SolidJS reactivity in QuickJS (no yoga-layout / no WASM)

// QuickJS polyfills
if (typeof console.warn !== 'function') console.warn = console.log;
if (typeof console.error !== 'function') console.error = console.log;
if (typeof globalThis.queueMicrotask !== 'function') {
  globalThis.queueMicrotask = (cb: () => void) => Promise.resolve().then(cb);
}

import { createSignal, createEffect, createMemo, createRoot, batch } from 'solid-js';
import { createRenderer } from 'solid-js/universal';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  OK ${name}`);
    passed++;
  } else {
    console.log(`  FAIL ${name}`);
    failed++;
  }
}

// Test 1: Basic signals
console.log('Test 1: Signals');
{
  const [count, setCount] = createSignal(0);
  assert(count() === 0, 'initial value');
  setCount(42);
  assert(count() === 42, 'updated value');
  setCount((prev: number) => prev + 1);
  assert(count() === 43, 'functional update');
}

// Test 2: Effects
console.log('Test 2: Effects');
{
  const log: number[] = [];
  const [count, setCount] = createSignal(0);
  createRoot(() => {
    createEffect(() => { log.push(count()); });
  });
  setCount(1);
  setCount(2);
  assert(log.join(',') === '0,1,2', `effect log: ${log.join(',')}`);
}

// Test 3: Memos
console.log('Test 3: Memos');
{
  const [a, setA] = createSignal(2);
  const [b, setB] = createSignal(3);
  const product = createMemo(() => a() * b());
  assert(product() === 6, 'initial memo');
  setA(5);
  assert(product() === 15, 'memo after update');
}

// Test 4: Batch
console.log('Test 4: Batch');
{
  const log: string[] = [];
  const [a, setA] = createSignal(1);
  const [b, setB] = createSignal(2);
  createRoot(() => {
    createEffect(() => { log.push(`${a()}+${b()}`); });
  });
  batch(() => { setA(10); setB(20); });
  assert(log.join('|') === '1+2|10+20', `batch: ${log.join('|')}`);
}

// Test 5: Nested closures with signals
// SolidJS disposes inner effects when outer re-runs, so only the final
// state matters. This tests that closures survive correctly.
console.log('Test 5: Nested closures');
{
  const results: number[] = [];
  const [outer, setOuter] = createSignal(1);
  createRoot(() => {
    const [inner, setInner] = createSignal(10);
    createEffect(() => {
      const o = outer();
      createEffect(() => { results.push(o + inner()); });
    });
    setInner(20);
    setOuter(2);
    setInner(30);
  });
  // After all updates, the final nested effect captures outer=2, inner=30
  const last = results[results.length - 1];
  assert(last === 32, `final value: ${last}`);
  assert(results.length >= 1, `ran ${results.length} times`);
}

// Test 6: createRenderer
console.log('Test 6: createRenderer');
{
  type N = { tag: string; children: N[]; props: Record<string, any>; text?: string };
  const r = createRenderer<N>({
    createElement: (tag) => ({ tag, children: [], props: {} }),
    createTextNode: (value) => ({ tag: '__t', children: [], props: {}, text: value }),
    replaceText: (node, value) => { node.text = value; },
    isTextNode: (node) => node.tag === '__t',
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

  const root: N = { tag: 'root', children: [], props: {} };
  const [label, setLabel] = createSignal('hello');

  const dispose = r.render(() => {
    const node = r.createElement('view');
    r.insert(node, () => r.createTextNode(label()));
    return node;
  }, root);

  const view = root.children[0];
  assert(view?.tag === 'view', 'view created');
  assert(view?.children[0]?.text === 'hello', `text: ${view?.children[0]?.text}`);
  setLabel('world');
  assert(view?.children[0]?.text === 'world', `updated: ${view?.children[0]?.text}`);
  dispose();
}

// Test 7: Reactive component pattern (simulates Glyphis View/Text)
console.log('Test 7: Reactive component pattern');
{
  type N = { tag: string; children: N[]; props: Record<string, any>; text?: string };
  const r = createRenderer<N>({
    createElement: (tag) => ({ tag, children: [], props: {} }),
    createTextNode: (value) => ({ tag: '__t', children: [], props: {}, text: value }),
    replaceText: (node, value) => { node.text = value; },
    isTextNode: (node) => node.tag === '__t',
    setProperty: (node, name, value) => { node.props[name] = value; },
    insertNode: (parent, node) => { parent.children.push(node); },
    removeNode: (parent, node) => {
      const idx = parent.children.indexOf(node);
      if (idx >= 0) parent.children.splice(idx, 1);
    },
    getParentNode: () => undefined,
    getFirstChild: (node) => node.children[0],
    getNextSibling: () => undefined,
  });

  // Simulated View component
  function View(props: { style?: any; children?: any }): N {
    const node = r.createElement('view');
    r.effect(() => { if (props.style) r.setProp(node, 'style', props.style); });
    r.insert(node, () => props.children);
    return node;
  }

  // Simulated Text component
  function Text(props: { style?: any; children?: any }): N {
    const node = r.createElement('text');
    r.effect(() => { if (props.style) r.setProp(node, 'style', props.style); });
    r.insert(node, () => props.children);
    return node;
  }

  const root: N = { tag: 'root', children: [], props: {} };
  const [count, setCount] = createSignal(0);
  const [bg, setBg] = createSignal('#000');

  const dispose = r.render(() => {
    return r.createComponent(View, {
      get style() { return { backgroundColor: bg() }; },
      get children() {
        return r.createComponent(Text, {
          style: { color: '#FFF' },
          get children() { return `Count: ${count()}`; },
        });
      },
    });
  }, root);

  const view = root.children[0];
  assert(view?.props.style?.backgroundColor === '#000', 'initial bg');
  const text = view?.children[0];
  assert(text?.children[0]?.text === 'Count: 0', `initial text: ${text?.children[0]?.text}`);

  setCount(5);
  assert(text?.children[0]?.text === 'Count: 5', `updated text: ${text?.children[0]?.text}`);

  setBg('#FFF');
  assert(view?.props.style?.backgroundColor === '#FFF', `updated bg: ${view?.props.style?.backgroundColor}`);

  dispose();
}

// Test 8: Promise / microtask ordering
console.log('Test 8: Promise ordering');
await (async () => {
  const order: number[] = [];
  await new Promise<void>(resolve => {
    Promise.resolve().then(() => { order.push(1); });
    Promise.resolve().then(() => { order.push(2); });
    Promise.resolve().then(() => {
      Promise.resolve().then(() => {
        order.push(3);
        resolve();
      });
    });
  });
  assert(order.join(',') === '1,2,3', `promise order: ${order.join(',')}`);
})();

// Test 9: queueMicrotask
console.log('Test 9: queueMicrotask');
await (async () => {
  let ran = false;
  queueMicrotask(() => { ran = true; });
  await new Promise<void>(resolve => {
    queueMicrotask(() => {
      assert(ran, 'queueMicrotask executed');
      resolve();
    });
  });
})();

// Summary
console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(failed === 0 ? 'SOLIDJS ON QUICKJS: PASSED' : 'SOLIDJS ON QUICKJS: FAILED');
