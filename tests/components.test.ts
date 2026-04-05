import { describe, test, expect, mock } from 'bun:test';
import { createSignal } from 'solid-js';
import { render, glyphisRenderer } from '../src/renderer';
import { View, Text, Image, Button } from '../src/components';
import type { Platform } from '../src/types';
import type { GlyphisNode } from '../src/node';

function createMockPlatform(): Platform {
  return {
    measureText: function () { return { width: 50, height: 20 }; },
    render: function () {},
    getViewport: function () { return { width: 390, height: 844 }; },
    onInput: function () {},
    loadImage: function () {},
    onImageLoaded: function () {},
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

describe('Image component', () => {
  test('creates a node with tag image', () => {
    var platform = createMockPlatform();
    var imgNode: GlyphisNode | undefined;

    var dispose = render(function () {
      imgNode = Image({ src: 'https://example.com/photo.jpg' });
      return imgNode;
    }, platform);

    expect(imgNode).toBeDefined();
    expect(imgNode!.tag).toBe('image');
    dispose();
  });

  test('sets imageProps on the node', () => {
    var platform = createMockPlatform();
    var imgNode: GlyphisNode | undefined;

    var dispose = render(function () {
      imgNode = Image({ src: 'https://example.com/photo.jpg', resizeMode: 'contain' });
      return imgNode;
    }, platform);

    expect(imgNode!.imageProps).toBeDefined();
    expect(imgNode!.imageProps!.src).toBe('https://example.com/photo.jpg');
    expect(imgNode!.imageProps!.imageId).toBe('https://example.com/photo.jpg');
    expect(imgNode!.imageProps!.resizeMode).toBe('contain');
    expect(imgNode!.imageProps!.loaded).toBe(false);
    dispose();
  });

  test('defaults resizeMode to cover', () => {
    var platform = createMockPlatform();
    var imgNode: GlyphisNode | undefined;

    var dispose = render(function () {
      imgNode = Image({ src: 'https://example.com/photo.jpg' });
      return imgNode;
    }, platform);

    expect(imgNode!.imageProps!.resizeMode).toBe('cover');
    dispose();
  });

  test('applies style reactively', async () => {
    var platform = createMockPlatform();
    var imgNode: GlyphisNode | undefined;
    var setWidth: (v: number) => void;

    var dispose = render(function () {
      var signal = createSignal(100);
      var width = signal[0];
      setWidth = signal[1];
      imgNode = Image({
        src: 'https://example.com/photo.jpg',
        get style() { return { width: width(), height: 100 }; },
      });
      return imgNode;
    }, platform);

    expect(imgNode!.style).toEqual({ width: 100, height: 100 });

    setWidth!(200);
    await new Promise(function (r) { setTimeout(r, 10); });

    expect(imgNode!.style).toEqual({ width: 200, height: 100 });
    dispose();
  });

  test('sets onLoad handler', () => {
    var platform = createMockPlatform();
    var imgNode: GlyphisNode | undefined;
    var handler = function () {};

    var dispose = render(function () {
      imgNode = Image({ src: 'https://example.com/photo.jpg', onLoad: handler });
      return imgNode;
    }, platform);

    expect(imgNode!.handlers['onLoad']).toBe(handler);
    dispose();
  });
});

describe('Button component', () => {
  test('creates a view with text child', () => {
    var platform = createMockPlatform();
    var btnNode: GlyphisNode | undefined;

    var dispose = render(function () {
      btnNode = Button({ title: 'Click Me', onPress: function () {} });
      return btnNode;
    }, platform);

    expect(btnNode).toBeDefined();
    expect(btnNode!.tag).toBe('view');
    // Should have at least one child that is a text node
    var textChild = btnNode!.children.find(function (c) { return c.tag === 'text'; });
    expect(textChild).toBeDefined();
    dispose();
  });

  test('has default backgroundColor', () => {
    var platform = createMockPlatform();
    var btnNode: GlyphisNode | undefined;

    var dispose = render(function () {
      btnNode = Button({ title: 'Click', onPress: function () {} });
      return btnNode;
    }, platform);

    expect(btnNode!.style.backgroundColor).toBe('#2196F3');
    dispose();
  });

  test('uses custom color when provided', () => {
    var platform = createMockPlatform();
    var btnNode: GlyphisNode | undefined;

    var dispose = render(function () {
      btnNode = Button({ title: 'Click', onPress: function () {}, color: '#FF0000' });
      return btnNode;
    }, platform);

    expect(btnNode!.style.backgroundColor).toBe('#FF0000');
    dispose();
  });

  test('disabled state sets opacity to 0.4', () => {
    var platform = createMockPlatform();
    var btnNode: GlyphisNode | undefined;

    var dispose = render(function () {
      btnNode = Button({ title: 'Click', onPress: function () {}, disabled: true });
      return btnNode;
    }, platform);

    expect(btnNode!.style.opacity).toBe(0.4);
    dispose();
  });

  test('press feedback changes opacity', async () => {
    var platform = createMockPlatform();
    var btnNode: GlyphisNode | undefined;

    var dispose = render(function () {
      btnNode = Button({ title: 'Click', onPress: function () {} });
      return btnNode;
    }, platform);

    // Initial opacity should be 1
    expect(btnNode!.style.opacity).toBe(1);

    // Simulate pressIn
    if (btnNode!.handlers.onPressIn) {
      btnNode!.handlers.onPressIn();
    }

    await new Promise(function (r) { setTimeout(r, 10); });

    // Opacity should be 0.6 when pressed
    expect(btnNode!.style.opacity).toBe(0.6);

    // Simulate pressOut
    if (btnNode!.handlers.onPressOut) {
      btnNode!.handlers.onPressOut();
    }

    await new Promise(function (r) { setTimeout(r, 10); });

    // Opacity should be back to 1
    expect(btnNode!.style.opacity).toBe(1);
    dispose();
  });

  test('onPress fires when not disabled', () => {
    var platform = createMockPlatform();
    var pressed = false;
    var btnNode: GlyphisNode | undefined;

    var dispose = render(function () {
      btnNode = Button({ title: 'Click', onPress: function () { pressed = true; } });
      return btnNode;
    }, platform);

    if (btnNode!.handlers.onPress) {
      btnNode!.handlers.onPress();
    }
    expect(pressed).toBe(true);
    dispose();
  });

  test('onPress does not fire when disabled', () => {
    var platform = createMockPlatform();
    var pressed = false;
    var btnNode: GlyphisNode | undefined;

    var dispose = render(function () {
      btnNode = Button({ title: 'Click', onPress: function () { pressed = true; }, disabled: true });
      return btnNode;
    }, platform);

    if (btnNode!.handlers.onPress) {
      btnNode!.handlers.onPress();
    }
    expect(pressed).toBe(false);
    dispose();
  });

  test('onPressIn does not fire when disabled', () => {
    var platform = createMockPlatform();
    var btnNode: GlyphisNode | undefined;

    var dispose = render(function () {
      btnNode = Button({ title: 'Click', onPress: function () {}, disabled: true });
      return btnNode;
    }, platform);

    // initial opacity = 0.4 (disabled)
    expect(btnNode!.style.opacity).toBe(0.4);

    if (btnNode!.handlers.onPressIn) {
      btnNode!.handlers.onPressIn();
    }

    // Should remain 0.4 because setPressed(true) is guarded by !disabled
    expect(btnNode!.style.opacity).toBe(0.4);
    dispose();
  });

  test('merges custom style onto base style', () => {
    var platform = createMockPlatform();
    var btnNode: GlyphisNode | undefined;

    var dispose = render(function () {
      btnNode = Button({
        title: 'Click',
        onPress: function () {},
        style: { marginTop: 10 },
      });
      return btnNode;
    }, platform);

    expect((btnNode!.style as any).marginTop).toBe(10);
    // Base style should still be present
    expect(btnNode!.style.borderRadius).toBe(4);
    dispose();
  });
});
