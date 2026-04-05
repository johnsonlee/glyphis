import { describe, it, expect } from 'bun:test';
import { defineComponent, h } from '@vue/runtime-core';
import { createApp, GlyphisNode, HOST_TYPES } from '../src/vue/renderer';
import { GView, GText, GButton, GImage } from '../src/vue/components';

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

describe('Vue components', () => {
  describe('GView', () => {
    it('creates glyphis-view with column flexDirection', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GView, {});
        },
      });
      const root = await renderToTree(component);
      const views = findByType(root, 'glyphis-view');
      expect(views.length).toBe(1);
      expect(views[0].props.style.flexDirection).toBe('column');
      expect(views[0].props.style.display).toBe('flex');
    });

    it('merges custom style', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GView, { style: { flex: 1, backgroundColor: 'red' } });
        },
      });
      const root = await renderToTree(component);
      const view = findByType(root, 'glyphis-view')[0];
      expect(view.props.style.flex).toBe(1);
      expect(view.props.style.backgroundColor).toBe('red');
      expect(view.props.style.flexDirection).toBe('column');
    });

    it('passes onPress handler', async () => {
      const handler = () => {};
      const component = defineComponent({
        setup() {
          return () => h(GView, { onPress: handler });
        },
      });
      const root = await renderToTree(component);
      const view = findByType(root, 'glyphis-view')[0];
      expect(view.props.onPress).toBe(handler);
    });

    it('passes testID', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GView, { testID: 'myView' });
        },
      });
      const root = await renderToTree(component);
      const view = findByType(root, 'glyphis-view')[0];
      expect(view.props.testID).toBe('myView');
    });

    it('renders slot children', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GView, {}, [
            h(GText, {}, () => 'child text'),
          ]);
        },
      });
      const root = await renderToTree(component);
      const view = findByType(root, 'glyphis-view')[0];
      expect(view.children.length).toBeGreaterThanOrEqual(1);
      expect(findTextLeaves(root)).toContain('child text');
    });
  });

  describe('GText', () => {
    it('creates glyphis-text with default text styles', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GText, {}, () => 'Hello');
        },
      });
      const root = await renderToTree(component);
      const texts = findByType(root, 'glyphis-text');
      expect(texts.length).toBe(1);
      expect(texts[0].props.style.color).toBe('#000000');
      expect(texts[0].props.style.fontSize).toBe(14);
      expect(texts[0].props.style.fontFamily).toBe('system-ui');
    });

    it('custom style overrides defaults', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GText, { style: { fontSize: 24, color: 'blue' } }, () => 'Custom');
        },
      });
      const root = await renderToTree(component);
      const text = findByType(root, 'glyphis-text')[0];
      expect(text.props.style.fontSize).toBe(24);
      expect(text.props.style.color).toBe('blue');
    });

    it('renders string content as text leaf', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GText, {}, () => 'World');
        },
      });
      const root = await renderToTree(component);
      const leaves = findByType(root, HOST_TYPES.TEXT_LEAF);
      expect(leaves.length).toBe(1);
      expect(leaves[0].text).toBe('World');
    });
  });

  describe('GButton', () => {
    it('renders view with text child containing title', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GButton, { title: 'Click Me' });
        },
      });
      const root = await renderToTree(component);
      const views = findByType(root, 'glyphis-view');
      expect(views.length).toBeGreaterThanOrEqual(1);
      const texts = findByType(root, 'glyphis-text');
      expect(texts.length).toBe(1);
      expect(findTextLeaves(root)).toContain('Click Me');
    });

    it('applies button styling', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GButton, { title: 'Test', color: '#FF0000' });
        },
      });
      const root = await renderToTree(component);
      const view = findByType(root, 'glyphis-view')[0];
      expect(view.props.style.backgroundColor).toBe('#FF0000');
      expect(view.props.style.borderRadius).toBe(4);
      expect(view.props.style.alignItems).toBe('center');
    });

    it('disabled state changes appearance', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GButton, { title: 'Disabled', disabled: true });
        },
      });
      const root = await renderToTree(component);
      const view = findByType(root, 'glyphis-view')[0];
      expect(view.props.style.backgroundColor).toBe('#CCCCCC');
      expect(view.props.style.opacity).toBe(0.6);
    });

    it('uses default blue color', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GButton, { title: 'Default' });
        },
      });
      const root = await renderToTree(component);
      const view = findByType(root, 'glyphis-view')[0];
      expect(view.props.style.backgroundColor).toBe('#2196F3');
    });

    it('has white text', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GButton, { title: 'White' });
        },
      });
      const root = await renderToTree(component);
      const text = findByType(root, 'glyphis-text')[0];
      expect(text.props.style.color).toBe('#FFFFFF');
    });
  });

  describe('GImage', () => {
    it('creates glyphis-image with src', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GImage, {
            src: 'https://example.com/img.png',
            style: { width: 100, height: 100 },
          });
        },
      });
      const root = await renderToTree(component);
      const images = findByType(root, 'glyphis-image');
      expect(images.length).toBe(1);
      expect(images[0].props.src).toBe('https://example.com/img.png');
    });

    it('passes resizeMode prop', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GImage, { src: 'test.png', resizeMode: 'contain' });
        },
      });
      const root = await renderToTree(component);
      const image = findByType(root, 'glyphis-image')[0];
      expect(image.props.resizeMode).toBe('contain');
    });

    it('uses cover as default resizeMode', async () => {
      const component = defineComponent({
        setup() {
          return () => h(GImage, { src: 'test.png' });
        },
      });
      const root = await renderToTree(component);
      const image = findByType(root, 'glyphis-image')[0];
      expect(image.props.resizeMode).toBe('cover');
    });
  });
});
