import { describe, it, expect } from 'bun:test';
import React, { useState } from 'react';
import { renderReact, GlyphNode, HOST_TYPES } from '../src/react/renderer';
import { View, Text, Button, Image, ScrollView, TextInput, FlatList } from '../src/react/components';

function renderToTree(element: React.ReactElement): Promise<GlyphNode> {
  const rootNode = new GlyphNode(HOST_TYPES.ROOT, {});
  renderReact(element, rootNode, () => {});
  return new Promise(resolve => setTimeout(() => resolve(rootNode), 100));
}

function collectNodes(node: GlyphNode): GlyphNode[] {
  const result: GlyphNode[] = [node];
  for (const child of node.children) {
    result.push(...collectNodes(child));
  }
  return result;
}

function findByType(root: GlyphNode, type: string): GlyphNode[] {
  return collectNodes(root).filter(n => n.type === type);
}

describe('React components', () => {
  describe('View', () => {
    it('creates glyph-view with default column flexDirection', async () => {
      const el = React.createElement(View, {});
      const root = await renderToTree(el);
      const views = findByType(root, 'glyph-view');
      expect(views.length).toBe(1);
      expect(views[0].props.style.flexDirection).toBe('column');
      expect(views[0].props.style.display).toBe('flex');
    });

    it('merges custom style with defaults', async () => {
      const el = React.createElement(View, { style: { flex: 1, backgroundColor: 'red' } });
      const root = await renderToTree(el);
      const view = findByType(root, 'glyph-view')[0];
      expect(view.props.style.flex).toBe(1);
      expect(view.props.style.backgroundColor).toBe('red');
      expect(view.props.style.flexDirection).toBe('column');
    });

    it('passes onPress handler', async () => {
      const handler = () => {};
      const el = React.createElement(View, { onPress: handler });
      const root = await renderToTree(el);
      const view = findByType(root, 'glyph-view')[0];
      expect(view.props.onPress).toBe(handler);
    });

    it('passes testID', async () => {
      const el = React.createElement(View, { testID: 'myView' });
      const root = await renderToTree(el);
      const view = findByType(root, 'glyph-view')[0];
      expect(view.props.testID).toBe('myView');
    });
  });

  describe('Text', () => {
    it('creates glyph-text with default text styles', async () => {
      const el = React.createElement(Text, {}, 'Hello');
      const root = await renderToTree(el);
      const texts = findByType(root, 'glyph-text');
      expect(texts.length).toBe(1);
      expect(texts[0].props.style.color).toBe('#000000');
      expect(texts[0].props.style.fontSize).toBe(14);
      expect(texts[0].props.style.fontFamily).toBe('system-ui');
    });

    it('renders string children as text leaf nodes', async () => {
      const el = React.createElement(Text, {}, 'World');
      const root = await renderToTree(el);
      const leaves = findByType(root, HOST_TYPES.TEXT_LEAF);
      expect(leaves.length).toBe(1);
      expect(leaves[0].text).toBe('World');
    });

    it('custom style overrides defaults', async () => {
      const el = React.createElement(Text, { style: { fontSize: 24, color: 'blue' } }, 'Custom');
      const root = await renderToTree(el);
      const text = findByType(root, 'glyph-text')[0];
      expect(text.props.style.fontSize).toBe(24);
      expect(text.props.style.color).toBe('blue');
    });
  });

  describe('Button', () => {
    it('renders view with text child containing title', async () => {
      const el = React.createElement(Button, { title: 'Click Me' });
      const root = await renderToTree(el);

      const views = findByType(root, 'glyph-view');
      expect(views.length).toBeGreaterThanOrEqual(1);

      const texts = findByType(root, 'glyph-text');
      expect(texts.length).toBe(1);

      const leaves = findByType(root, HOST_TYPES.TEXT_LEAF);
      expect(leaves.some(l => l.text === 'Click Me')).toBe(true);
    });

    it('applies button styling', async () => {
      const el = React.createElement(Button, { title: 'Test', color: '#FF0000' });
      const root = await renderToTree(el);
      const view = findByType(root, 'glyph-view')[0];
      expect(view.props.style.backgroundColor).toBe('#FF0000');
      expect(view.props.style.borderRadius).toBe(4);
      expect(view.props.style.alignItems).toBe('center');
    });

    it('disabled state changes appearance', async () => {
      const el = React.createElement(Button, { title: 'Disabled', disabled: true });
      const root = await renderToTree(el);
      const view = findByType(root, 'glyph-view')[0];
      expect(view.props.style.backgroundColor).toBe('#CCCCCC');
      expect(view.props.style.opacity).toBe(0.6);
    });

    it('uses default blue color', async () => {
      const el = React.createElement(Button, { title: 'Default' });
      const root = await renderToTree(el);
      const view = findByType(root, 'glyph-view')[0];
      expect(view.props.style.backgroundColor).toBe('#2196F3');
    });

    it('has white text', async () => {
      const el = React.createElement(Button, { title: 'White' });
      const root = await renderToTree(el);
      const text = findByType(root, 'glyph-text')[0];
      expect(text.props.style.color).toBe('#FFFFFF');
    });
  });

  describe('Image', () => {
    it('creates glyph-image with src', async () => {
      const el = React.createElement(Image, {
        src: 'https://example.com/img.png',
        style: { width: 100, height: 100 },
      });
      const root = await renderToTree(el);
      const images = findByType(root, 'glyph-image');
      expect(images.length).toBe(1);
      expect(images[0].props.src).toBe('https://example.com/img.png');
    });

    it('passes resizeMode prop', async () => {
      const el = React.createElement(Image, {
        src: 'test.png',
        resizeMode: 'contain',
      });
      const root = await renderToTree(el);
      const image = findByType(root, 'glyph-image')[0];
      expect(image.props.resizeMode).toBe('contain');
    });
  });

  describe('ScrollView', () => {
    it('creates scroll container with overflow scroll', async () => {
      const el = React.createElement(ScrollView, {},
        React.createElement(View, { style: { height: 100 } }),
      );
      const root = await renderToTree(el);
      const scrollViews = findByType(root, 'glyph-scroll-view');
      expect(scrollViews.length).toBe(1);
      expect(scrollViews[0].props.style.overflow).toBe('scroll');
      expect(scrollViews[0].props.style.flex).toBe(1);
    });

    it('wraps children in a content view', async () => {
      const el = React.createElement(ScrollView, {},
        React.createElement(View, {}),
      );
      const root = await renderToTree(el);
      const scrollView = findByType(root, 'glyph-scroll-view')[0];
      // ScrollView should have a glyph-view child as content container
      const contentViews = scrollView.children.filter(c => c.type === 'glyph-view');
      expect(contentViews.length).toBe(1);
    });

    it('horizontal scroll sets row direction on content', async () => {
      const el = React.createElement(ScrollView, { horizontal: true },
        React.createElement(View, {}),
      );
      const root = await renderToTree(el);
      const scrollView = findByType(root, 'glyph-scroll-view')[0];
      const contentView = scrollView.children.find(c => c.type === 'glyph-view');
      expect(contentView).toBeDefined();
      expect(contentView!.props.style.flexDirection).toBe('row');
    });
  });

  describe('TextInput', () => {
    it('creates glyph-text-input with default styling', async () => {
      const el = React.createElement(TextInput, { placeholder: 'Enter text' });
      const root = await renderToTree(el);
      const inputs = findByType(root, 'glyph-text-input');
      expect(inputs.length).toBe(1);
      expect(inputs[0].props.style.borderWidth).toBe(1);
      expect(inputs[0].props.style.borderRadius).toBe(4);
      expect(inputs[0].props.style.padding).toBe(8);
      expect(inputs[0].props.placeholder).toBe('Enter text');
    });

    it('shows placeholder text when no value', async () => {
      const el = React.createElement(TextInput, { placeholder: 'Type here' });
      const root = await renderToTree(el);
      const leaves = findByType(root, HOST_TYPES.TEXT_LEAF);
      expect(leaves.some(l => l.text === 'Type here')).toBe(true);
    });

    it('shows value when provided', async () => {
      const el = React.createElement(TextInput, { value: 'Hello' });
      const root = await renderToTree(el);
      const leaves = findByType(root, HOST_TYPES.TEXT_LEAF);
      expect(leaves.some(l => l.text === 'Hello')).toBe(true);
    });

    it('uses defaultValue when no controlled value', async () => {
      const el = React.createElement(TextInput, { defaultValue: 'Default' });
      const root = await renderToTree(el);
      const leaves = findByType(root, HOST_TYPES.TEXT_LEAF);
      expect(leaves.some(l => l.text === 'Default')).toBe(true);
    });

    it('non-editable has different background', async () => {
      const el = React.createElement(TextInput, { editable: false });
      const root = await renderToTree(el);
      const input = findByType(root, 'glyph-text-input')[0];
      expect(input.props.style.backgroundColor).toBe('#F5F5F5');
    });

    it('multiline has minHeight', async () => {
      const el = React.createElement(TextInput, { multiline: true });
      const root = await renderToTree(el);
      const input = findByType(root, 'glyph-text-input')[0];
      expect(input.props.style.minHeight).toBe(80);
    });
  });

  describe('FlatList', () => {
    it('renders list items', async () => {
      const el = React.createElement(FlatList, {
        data: ['A', 'B', 'C'],
        renderItem: ({ item }: { item: string }) =>
          React.createElement(Text, {}, item),
      });
      const root = await renderToTree(el);
      const leaves = findByType(root, HOST_TYPES.TEXT_LEAF);
      const texts = leaves.map(l => l.text);
      expect(texts).toContain('A');
      expect(texts).toContain('B');
      expect(texts).toContain('C');
    });

    it('renders in scroll container', async () => {
      const el = React.createElement(FlatList, {
        data: ['X'],
        renderItem: ({ item }: { item: string }) =>
          React.createElement(Text, {}, item),
      });
      const root = await renderToTree(el);
      const scrollViews = findByType(root, 'glyph-scroll-view');
      expect(scrollViews.length).toBe(1);
      expect(scrollViews[0].props.style.overflow).toBe('scroll');
    });

    it('renders empty component when data is empty', async () => {
      const el = React.createElement(FlatList, {
        data: [],
        renderItem: () => React.createElement(View, {}),
        ListEmptyComponent: React.createElement(Text, {}, 'No items'),
      });
      const root = await renderToTree(el);
      const leaves = findByType(root, HOST_TYPES.TEXT_LEAF);
      expect(leaves.some(l => l.text === 'No items')).toBe(true);
    });

    it('horizontal FlatList uses row direction', async () => {
      const el = React.createElement(FlatList, {
        data: ['A'],
        renderItem: ({ item }: { item: string }) =>
          React.createElement(Text, {}, item),
        horizontal: true,
      });
      const root = await renderToTree(el);
      const scrollView = findByType(root, 'glyph-scroll-view')[0];
      expect(scrollView.props.horizontal).toBe(true);
    });

    it('uses keyExtractor', async () => {
      const el = React.createElement(FlatList, {
        data: [{ id: 'x', label: 'X' }],
        renderItem: ({ item }: { item: { id: string; label: string } }) =>
          React.createElement(Text, {}, item.label),
        keyExtractor: (item: { id: string }) => item.id,
      });
      const root = await renderToTree(el);
      const leaves = findByType(root, HOST_TYPES.TEXT_LEAF);
      expect(leaves.some(l => l.text === 'X')).toBe(true);
    });
  });
});
