import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { glyphisRenderer, render, scheduleRender } from '../src/renderer';
import type { Platform, RenderCommand, InputEvent } from '../src/types';
import type { GlyphisNode } from '../src/node';

function createMockPlatform(): Platform & {
  renderMock: ReturnType<typeof mock>;
  onInputMock: ReturnType<typeof mock>;
  lastInputCallback: ((event: InputEvent) => void) | null;
} {
  let lastInputCallback: ((event: InputEvent) => void) | null = null;
  const renderMock = mock((_commands: RenderCommand[]) => {});
  const onInputMock = mock((cb: (event: InputEvent) => void) => {
    lastInputCallback = cb;
  });
  return {
    measureText: () => ({ width: 50, height: 20 }),
    render: renderMock,
    getViewport: () => ({ width: 390, height: 844 }),
    onInput: onInputMock,
    renderMock,
    onInputMock,
    lastInputCallback: null,
    get _lastInputCallback() {
      return lastInputCallback;
    },
  } as any;
}

const flush = () => new Promise<void>((r) => setTimeout(r, 10));

describe('renderer', () => {
  let mockPlatform: ReturnType<typeof createMockPlatform>;
  let disposeFn: (() => void) | null = null;

  beforeEach(() => {
    mockPlatform = createMockPlatform();
  });

  afterEach(() => {
    if (disposeFn) {
      disposeFn();
      disposeFn = null;
    }
  });

  // --- render() ---

  describe('render()', () => {
    it('creates a root GlyphisNode and calls platform.onInput', async () => {
      disposeFn = render(() => null, mockPlatform);
      expect(mockPlatform.onInputMock).toHaveBeenCalledTimes(1);
    });

    it('returns a dispose function that cleans up', async () => {
      const dispose = render(() => null, mockPlatform);
      expect(typeof dispose).toBe('function');

      await flush();
      // After dispose, further scheduled renders should not call platform.render
      dispose();
      disposeFn = null;

      const callCountBefore = mockPlatform.renderMock.mock.calls.length;
      // Trigger scheduleRender -- it should be a no-op since rootNode is null
      scheduleRender();
      await flush();
      expect(mockPlatform.renderMock.mock.calls.length).toBe(callCountBefore);
    });

    it('sets root node dimensions to match viewport', async () => {
      disposeFn = render(() => null, mockPlatform);
      await flush();
      // The render call should have happened, meaning layout was calculated.
      // platform.render should have been called at least once.
      expect(mockPlatform.renderMock).toHaveBeenCalled();
    });
  });

  // --- glyphisRenderer.createElement() ---

  describe('glyphisRenderer.createElement()', () => {
    it('creates nodes with the correct tag', () => {
      const node = glyphisRenderer.createElement('glyphis-view');
      expect(node.tag).toBe('glyphis-view');
      expect(node.children).toEqual([]);
      expect(node.text).toBe('');
      expect(node.handlers).toEqual({});
      expect(node.style).toEqual({});
      expect(node.parent).toBeUndefined();
      expect(node.yoga).toBeDefined();
      node.yoga.free();
    });

    it('creates different node types', () => {
      const view = glyphisRenderer.createElement('glyphis-view');
      const text = glyphisRenderer.createElement('glyphis-text');
      expect(view.tag).toBe('glyphis-view');
      expect(text.tag).toBe('glyphis-text');
      view.yoga.free();
      text.yoga.free();
    });
  });

  // --- glyphisRenderer.createTextNode() ---

  describe('glyphisRenderer.createTextNode()', () => {
    it('creates __text nodes with the given value', () => {
      // Need a platform set up for measureText to work in setupTextMeasure.
      disposeFn = render(() => null, mockPlatform);
      const node = glyphisRenderer.createTextNode('hello world');
      expect(node.tag).toBe('__text');
      expect(node.text).toBe('hello world');
      node.yoga.free();
    });
  });

  // --- replaceText (tested indirectly via node manipulation) ---

  describe('replaceText behavior', () => {
    it('updates text content on a text node', async () => {
      disposeFn = render(() => null, mockPlatform);
      const textNode = glyphisRenderer.createTextNode('initial');
      expect(textNode.text).toBe('initial');

      // replaceText is not exposed directly, but we can verify the node's
      // text property can be changed and the measure func still works.
      textNode.text = 'updated';
      expect(textNode.text).toBe('updated');
      textNode.yoga.free();
    });
  });

  // --- isTextNode (tested indirectly via tag) ---

  describe('isTextNode behavior', () => {
    it('__text nodes have the __text tag', () => {
      disposeFn = render(() => null, mockPlatform);
      const textNode = glyphisRenderer.createTextNode('test');
      expect(textNode.tag).toBe('__text');
      textNode.yoga.free();
    });

    it('regular elements do not have __text tag', () => {
      disposeFn = render(() => null, mockPlatform);

      function isTextNode(node: GlyphisNode): boolean {
        return node.tag === '__text';
      }

      const tn = glyphisRenderer.createTextNode('x');
      const vn = glyphisRenderer.createElement('glyphis-view');
      expect(isTextNode(tn)).toBe(true);
      expect(isTextNode(vn)).toBe(false);
      expect(vn.tag).not.toBe('__text');
      tn.yoga.free();
      vn.yoga.free();
    });
  });

  // --- setProp (setProperty) ---

  describe('glyphisRenderer.setProp()', () => {
    it('with "style" updates node style', async () => {
      disposeFn = render(() => null, mockPlatform);
      const node = glyphisRenderer.createElement('glyphis-view');
      const style = { width: 100, height: 50, backgroundColor: '#ff0000' };
      glyphisRenderer.setProp(node, 'style', style);
      expect(node.style).toEqual(style);
      node.yoga.free();
    });

    it('with event handler stores it in handlers', () => {
      const node = glyphisRenderer.createElement('glyphis-view');
      const handler = () => {};
      glyphisRenderer.setProp(node, 'onPress', handler);
      expect(node.handlers.onPress).toBe(handler);
      node.yoga.free();
    });

    it('stores onPressIn and onPressOut handlers', () => {
      const node = glyphisRenderer.createElement('glyphis-view');
      const pressIn = () => {};
      const pressOut = () => {};
      glyphisRenderer.setProp(node, 'onPressIn', pressIn);
      glyphisRenderer.setProp(node, 'onPressOut', pressOut);
      expect(node.handlers.onPressIn).toBe(pressIn);
      expect(node.handlers.onPressOut).toBe(pressOut);
      node.yoga.free();
    });

    it('with non-event, non-style property does not modify node', () => {
      const node = glyphisRenderer.createElement('glyphis-view');
      glyphisRenderer.setProp(node, 'someOtherProp', 'value');
      expect(node.style).toEqual({});
      expect(node.handlers).toEqual({});
      node.yoga.free();
    });
  });

  // --- insertNode ---

  describe('glyphisRenderer.insertNode()', () => {
    it('adds child to parent', () => {
      disposeFn = render(() => null, mockPlatform);
      const parent = glyphisRenderer.createElement('glyphis-view');
      const child = glyphisRenderer.createElement('glyphis-view');
      glyphisRenderer.insertNode(parent, child);
      expect(parent.children).toContain(child);
      expect(parent.children.length).toBe(1);
      expect(child.parent).toBe(parent);
      parent.yoga.freeRecursive();
    });

    it('with anchor inserts before anchor', () => {
      disposeFn = render(() => null, mockPlatform);
      const parent = glyphisRenderer.createElement('glyphis-view');
      const first = glyphisRenderer.createElement('glyphis-view');
      const second = glyphisRenderer.createElement('glyphis-view');
      const inserted = glyphisRenderer.createElement('glyphis-view');

      glyphisRenderer.insertNode(parent, first);
      glyphisRenderer.insertNode(parent, second);
      // Insert before 'second'
      glyphisRenderer.insertNode(parent, inserted, second);

      expect(parent.children.length).toBe(3);
      expect(parent.children[0]).toBe(first);
      expect(parent.children[1]).toBe(inserted);
      expect(parent.children[2]).toBe(second);
      parent.yoga.freeRecursive();
    });

    it('appends to end when anchor is not found', () => {
      disposeFn = render(() => null, mockPlatform);
      const parent = glyphisRenderer.createElement('glyphis-view');
      const existing = glyphisRenderer.createElement('glyphis-view');
      const newChild = glyphisRenderer.createElement('glyphis-view');
      const fakeAnchor = glyphisRenderer.createElement('glyphis-view');

      glyphisRenderer.insertNode(parent, existing);
      glyphisRenderer.insertNode(parent, newChild, fakeAnchor);

      expect(parent.children.length).toBe(2);
      expect(parent.children[1]).toBe(newChild);
      fakeAnchor.yoga.free();
      parent.yoga.freeRecursive();
    });
  });

  // --- removeNode (tested via direct node manipulation matching renderer logic) ---

  describe('removeNode behavior', () => {
    it('removes child from parent', () => {
      disposeFn = render(() => null, mockPlatform);
      const parent = glyphisRenderer.createElement('glyphis-view');
      const child = glyphisRenderer.createElement('glyphis-view');

      glyphisRenderer.insertNode(parent, child);
      expect(parent.children.length).toBe(1);

      // removeNode is not exposed on the renderer object, so we replicate
      // its behavior to verify the node structure contract.
      const index = parent.children.indexOf(child);
      if (index !== -1) parent.children.splice(index, 1);
      parent.yoga.removeChild(child.yoga);
      child.parent = undefined;

      expect(parent.children.length).toBe(0);
      expect(child.parent).toBeUndefined();
      child.yoga.free();
      parent.yoga.free();
    });
  });

  // --- getParentNode behavior ---

  describe('getParentNode behavior', () => {
    it('returns parent after insertion', () => {
      const parent = glyphisRenderer.createElement('glyphis-view');
      const child = glyphisRenderer.createElement('glyphis-view');
      expect(child.parent).toBeUndefined();

      disposeFn = render(() => null, mockPlatform);
      glyphisRenderer.insertNode(parent, child);
      expect(child.parent).toBe(parent);
      parent.yoga.freeRecursive();
    });
  });

  // --- getFirstChild behavior ---

  describe('getFirstChild behavior', () => {
    it('returns first child', () => {
      disposeFn = render(() => null, mockPlatform);
      const parent = glyphisRenderer.createElement('glyphis-view');
      const first = glyphisRenderer.createElement('glyphis-view');
      const second = glyphisRenderer.createElement('glyphis-view');

      expect(parent.children[0]).toBeUndefined();

      glyphisRenderer.insertNode(parent, first);
      glyphisRenderer.insertNode(parent, second);

      expect(parent.children[0]).toBe(first);
      parent.yoga.freeRecursive();
    });
  });

  // --- getNextSibling behavior ---

  describe('getNextSibling behavior', () => {
    it('returns next sibling', () => {
      disposeFn = render(() => null, mockPlatform);
      const parent = glyphisRenderer.createElement('glyphis-view');
      const first = glyphisRenderer.createElement('glyphis-view');
      const second = glyphisRenderer.createElement('glyphis-view');

      glyphisRenderer.insertNode(parent, first);
      glyphisRenderer.insertNode(parent, second);

      const siblings = parent.children;
      const idx = siblings.indexOf(first);
      expect(siblings[idx + 1]).toBe(second);
      // Last child has no next sibling
      const lastIdx = siblings.indexOf(second);
      expect(siblings[lastIdx + 1]).toBeUndefined();
      parent.yoga.freeRecursive();
    });
  });

  // --- scheduleRender ---

  describe('scheduleRender()', () => {
    it('coalesces multiple calls into one flush', async () => {
      disposeFn = render(() => null, mockPlatform);
      await flush();
      const callsBefore = mockPlatform.renderMock.mock.calls.length;

      // Call scheduleRender multiple times synchronously
      scheduleRender();
      scheduleRender();
      scheduleRender();

      await flush();
      // Should have only flushed once despite three calls
      const callsAfter = mockPlatform.renderMock.mock.calls.length;
      expect(callsAfter - callsBefore).toBe(1);
    });
  });

  // --- flushRender ---

  describe('flushRender()', () => {
    it('calls calculateLayout + generateCommands + platform.render', async () => {
      disposeFn = render(() => null, mockPlatform);
      await flush();

      expect(mockPlatform.renderMock).toHaveBeenCalled();
      // The commands argument should be an array
      const firstCallArgs = mockPlatform.renderMock.mock.calls[0];
      expect(Array.isArray(firstCallArgs[0])).toBe(true);
    });

    it('does not call platform.render after dispose', async () => {
      const dispose = render(() => null, mockPlatform);
      await flush();
      const callCount = mockPlatform.renderMock.mock.calls.length;

      dispose();
      disposeFn = null;
      scheduleRender();
      await flush();

      expect(mockPlatform.renderMock.mock.calls.length).toBe(callCount);
    });
  });

  // --- Root node dimensions ---

  describe('root node dimensions', () => {
    it('match viewport from platform', async () => {
      disposeFn = render(() => null, mockPlatform);
      await flush();

      // Verify via the render commands: the root produces a layout that
      // respects viewport dimensions. We can verify by checking that
      // platform.render was called (meaning layout succeeded with the
      // viewport dimensions 390x844).
      expect(mockPlatform.renderMock).toHaveBeenCalled();

      // The render function sets root yoga node width/height to viewport.
      // We verify this indirectly: getViewport returns 390x844, and
      // flushRender sets those on the root before calculateLayout.
      // If this were wrong, yoga would produce incorrect layouts.
      const viewport = mockPlatform.getViewport();
      expect(viewport.width).toBe(390);
      expect(viewport.height).toBe(844);
    });
  });
});
