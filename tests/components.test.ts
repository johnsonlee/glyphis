import { describe, test, expect } from 'bun:test';
import { createSignal } from 'solid-js';
import { render, glyphisRenderer } from '../src/renderer';
import { View, Text } from '../src/components';
import type { Platform } from '../src/types';
import type { GlyphisNode } from '../src/node';

function createMockPlatform(): Platform {
  return {
    measureText: () => ({ width: 50, height: 20 }),
    render: () => {},
    getViewport: () => ({ width: 390, height: 844 }),
    onInput: () => {},
  };
}

/**
 * Helper that renders a component inside a full render() context.
 * Returns the root node so we can inspect the tree.
 * Also returns a dispose function for cleanup.
 */
function renderInContext(code: () => any): { rootNode: GlyphisNode; dispose: () => void } {
  const platform = createMockPlatform();
  let rootRef: GlyphisNode | null = null;

  // render() creates a root node internally and renders `code` into it.
  // The code() function should return an element that gets inserted as a child of root.
  const dispose = render(code, platform);

  // We can't directly access rootNode from render(), but we can inspect via
  // the returned tree. We'll use a workaround: render a known component and
  // grab it from the renderer.
  return { rootNode: null as any, dispose };
}

describe('View component', () => {
  test('creates a view element node', () => {
    const platform = createMockPlatform();
    let viewNode: GlyphisNode | undefined;

    const dispose = render(() => {
      viewNode = View({});
      return viewNode;
    }, platform);

    expect(viewNode).toBeDefined();
    expect(viewNode!.tag).toBe('view');
    dispose();
  });

  test('with style sets style property', () => {
    const platform = createMockPlatform();
    let viewNode: GlyphisNode | undefined;
    const style = { backgroundColor: '#FF0000', width: 100 };

    const dispose = render(() => {
      viewNode = View({ style });
      return viewNode;
    }, platform);

    // Effects run synchronously within the reactive root in solid-js
    expect(viewNode!.style).toEqual(style);
    dispose();
  });

  test('with onPress sets event handler', () => {
    const platform = createMockPlatform();
    let viewNode: GlyphisNode | undefined;
    const handler = () => {};

    const dispose = render(() => {
      viewNode = View({ onPress: handler });
      return viewNode;
    }, platform);

    expect(viewNode!.handlers['onPress']).toBe(handler);
    dispose();
  });

  test('with onPressIn sets event handler', () => {
    const platform = createMockPlatform();
    let viewNode: GlyphisNode | undefined;
    const handler = () => {};

    const dispose = render(() => {
      viewNode = View({ onPressIn: handler });
      return viewNode;
    }, platform);

    expect(viewNode!.handlers['onPressIn']).toBe(handler);
    dispose();
  });

  test('with onPressOut sets event handler', () => {
    const platform = createMockPlatform();
    let viewNode: GlyphisNode | undefined;
    const handler = () => {};

    const dispose = render(() => {
      viewNode = View({ onPressOut: handler });
      return viewNode;
    }, platform);

    expect(viewNode!.handlers['onPressOut']).toBe(handler);
    dispose();
  });

  test('with children inserts children', () => {
    const platform = createMockPlatform();
    let viewNode: GlyphisNode | undefined;

    const dispose = render(() => {
      const child = View({});
      viewNode = View({ children: child });
      return viewNode;
    }, platform);

    expect(viewNode!.children.length).toBeGreaterThanOrEqual(1);
    // The child should be a view node
    const childView = viewNode!.children.find(c => c.tag === 'view');
    expect(childView).toBeDefined();
    dispose();
  });
});

describe('Text component', () => {
  test('creates a text element node', () => {
    const platform = createMockPlatform();
    let textNode: GlyphisNode | undefined;

    const dispose = render(() => {
      textNode = Text({});
      return textNode;
    }, platform);

    expect(textNode).toBeDefined();
    expect(textNode!.tag).toBe('text');
    dispose();
  });

  test('with style sets style property', () => {
    const platform = createMockPlatform();
    let textNode: GlyphisNode | undefined;
    const style = { color: '#000', fontSize: 16 };

    const dispose = render(() => {
      textNode = Text({ style });
      return textNode;
    }, platform);

    expect(textNode!.style).toEqual(style);
    dispose();
  });

  test('with string children creates text nodes', () => {
    const platform = createMockPlatform();
    let textNode: GlyphisNode | undefined;

    const dispose = render(() => {
      textNode = Text({ children: 'Hello World' });
      return textNode;
    }, platform);

    // The string child should be inserted as a __text node
    expect(textNode!.children.length).toBeGreaterThanOrEqual(1);
    const textChild = textNode!.children.find(c => c.tag === '__text');
    expect(textChild).toBeDefined();
    expect(textChild!.text).toBe('Hello World');
    dispose();
  });
});

describe('Reactive behavior', () => {
  test('reactive style updates when signal changes', async () => {
    const platform = createMockPlatform();
    let viewNode: GlyphisNode | undefined;
    let setBg: (v: string) => void;

    const dispose = render(() => {
      const [bg, _setBg] = createSignal('#000');
      setBg = _setBg;
      viewNode = View({
        get style() {
          return { backgroundColor: bg() };
        },
      });
      return viewNode;
    }, platform);

    // Verify initial state
    expect(viewNode!.style).toEqual({ backgroundColor: '#000' });

    // Update signal
    setBg!('#FFF');

    // Wait for effects to run
    await new Promise(r => setTimeout(r, 10));

    expect(viewNode!.style).toEqual({ backgroundColor: '#FFF' });
    dispose();
  });

  test('reactive children update when signal changes', async () => {
    const platform = createMockPlatform();
    let textNode: GlyphisNode | undefined;
    let setLabel: (v: string) => void;

    const dispose = render(() => {
      const [label, _setLabel] = createSignal('Hello');
      setLabel = _setLabel;
      textNode = Text({
        get children() {
          return label();
        },
      });
      return textNode;
    }, platform);

    // Verify initial state
    const initialText = textNode!.children.find(c => c.tag === '__text');
    expect(initialText).toBeDefined();
    expect(initialText!.text).toBe('Hello');

    // Update signal
    setLabel!('World');

    // Wait for effects to run
    await new Promise(r => setTimeout(r, 10));

    // The text should have been updated via replaceText
    const updatedText = textNode!.children.find(c => c.tag === '__text');
    expect(updatedText).toBeDefined();
    expect(updatedText!.text).toBe('World');
    dispose();
  });
});
