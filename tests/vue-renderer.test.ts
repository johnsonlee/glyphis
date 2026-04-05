import { describe, it, expect, mock } from 'bun:test';
import { defineComponent, h, ref, computed, nextTick } from '@vue/runtime-core';
import { createApp, GlyphisNode, HOST_TYPES } from '../src/vue/renderer';

function renderToTree(component: any): Promise<GlyphisNode> {
  const root = new GlyphisNode(HOST_TYPES.ROOT, {});
  const app = createApp(component);
  app.mount(root as any);
  return new Promise(resolve => setTimeout(() => resolve(root), 50));
}

function collectNodes(node: GlyphisNode): GlyphisNode[] {
  const result: GlyphisNode[] = [node];
  for (const child of node.children) {
    result.push(...collectNodes(child));
  }
  return result;
}

function findByType(root: GlyphisNode, type: string): GlyphisNode[] {
  return collectNodes(root).filter(n => n.type === type);
}

function findTextLeaves(root: GlyphisNode): string[] {
  return collectNodes(root)
    .filter(n => n.type === HOST_TYPES.TEXT_LEAF && n.text)
    .map(n => n.text!);
}

describe('Vue renderer integration', () => {
  it('createApp creates Vue app', () => {
    const component = defineComponent({
      setup() {
        return () => h('glyphis-view', {});
      },
    });
    const app = createApp(component);
    expect(app).toBeDefined();
    expect(app.mount).toBeInstanceOf(Function);
  });

  it('renders simple component to GlyphisNode tree', async () => {
    const component = defineComponent({
      setup() {
        return () => h('glyphis-view', { style: { flex: 1 } });
      },
    });

    const root = await renderToTree(component);
    expect(root.children.length).toBe(1);
    expect(root.children[0].type).toBe('glyphis-view');
    expect(root.children[0].props.style).toEqual({ flex: 1 });
  });

  it('renders nested components', async () => {
    const Inner = defineComponent({
      setup() {
        return () => h('glyphis-text', { style: { fontSize: 16 } }, 'inner');
      },
    });

    const Outer = defineComponent({
      setup() {
        return () => h('glyphis-view', { style: { flex: 1 } }, [
          h(Inner),
          h('glyphis-view', { style: { flex: 2 } }),
        ]);
      },
    });

    const root = await renderToTree(Outer);
    const outerView = root.children[0];
    expect(outerView.type).toBe('glyphis-view');
    // Inner component renders a glyphis-text, plus there's a glyphis-view sibling
    expect(outerView.children.length).toBe(2);
    expect(outerView.children[0].type).toBe('glyphis-text');
    expect(outerView.children[1].type).toBe('glyphis-view');
  });

  it('renders text children as text leaf nodes', async () => {
    const component = defineComponent({
      setup() {
        return () => h('glyphis-text', { style: { fontSize: 14 } }, 'Hello Vue');
      },
    });

    const root = await renderToTree(component);
    const textNode = root.children[0];
    expect(textNode.type).toBe('glyphis-text');
    expect(textNode.children.length).toBe(1);
    expect(textNode.children[0].type).toBe(HOST_TYPES.TEXT_LEAF);
    expect(textNode.children[0].text).toBe('Hello Vue');
  });

  it('reactive ref triggers re-render', async () => {
    let setCount: ((v: number) => void) | null = null;

    const component = defineComponent({
      setup() {
        const count = ref(0);
        setCount = (v: number) => { count.value = v; };
        return () => h('glyphis-text', {}, String(count.value));
      },
    });

    const root = await renderToTree(component);
    expect(findTextLeaves(root)).toContain('0');

    setCount!(5);
    await nextTick();
    await new Promise(r => setTimeout(r, 50));
    expect(findTextLeaves(root)).toContain('5');
  });

  it('computed values update correctly', async () => {
    let setCount: ((v: number) => void) | null = null;

    const component = defineComponent({
      setup() {
        const count = ref(2);
        const doubled = computed(() => count.value * 2);
        setCount = (v: number) => { count.value = v; };
        return () => h('glyphis-text', {}, String(doubled.value));
      },
    });

    const root = await renderToTree(component);
    expect(findTextLeaves(root)).toContain('4');

    setCount!(10);
    await nextTick();
    await new Promise(r => setTimeout(r, 50));
    expect(findTextLeaves(root)).toContain('20');
  });

  it('event handlers are set on GlyphisNode props', async () => {
    const handler = mock(() => {});

    const component = defineComponent({
      setup() {
        return () => h('glyphis-view', { onPress: handler });
      },
    });

    const root = await renderToTree(component);
    const view = findByType(root, 'glyphis-view')[0];
    expect(view.props.onPress).toBe(handler);
  });

  it('conditional rendering works', async () => {
    let setShow: ((v: boolean) => void) | null = null;

    const component = defineComponent({
      setup() {
        const show = ref(true);
        setShow = (v: boolean) => { show.value = v; };
        return () => h('glyphis-view', {}, [
          show.value ? h('glyphis-text', {}, 'visible') : null,
        ]);
      },
    });

    const root = await renderToTree(component);
    expect(findTextLeaves(root)).toContain('visible');

    setShow!(false);
    await nextTick();
    await new Promise(r => setTimeout(r, 50));
    expect(findTextLeaves(root)).not.toContain('visible');
  });

  it('list rendering with v-for pattern', async () => {
    let setItems: ((v: string[]) => void) | null = null;

    const component = defineComponent({
      setup() {
        const items = ref(['A', 'B', 'C']);
        setItems = (v: string[]) => { items.value = v; };
        return () => h('glyphis-view', {},
          items.value.map(item => h('glyphis-text', { key: item }, item)),
        );
      },
    });

    const root = await renderToTree(component);
    expect(findTextLeaves(root)).toEqual(['A', 'B', 'C']);

    setItems!(['C', 'A']);
    await nextTick();
    await new Promise(r => setTimeout(r, 50));
    expect(findTextLeaves(root)).toEqual(['C', 'A']);
  });
});
