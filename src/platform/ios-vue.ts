/// <reference lib="es2020" />

declare const __glyph_native: {
  submitRenderCommands(json: string): void;
  measureText(
    text: string,
    fontSize: number,
    fontFamily: string,
    fontWeight: string,
  ): { width: number; height: number };
  getViewportSize(): { width: number; height: number };
  platform: string;
};

import type { Component } from '@vue/runtime-core';
import { createRenderer } from '@vue/runtime-core';
import type { Renderer, AnyRenderCommand } from '../types';
import { createLayoutEngine } from '../layout/index';
import { GlyphNode, HOST_TYPES } from '../react/glyph-node';
import { nodeToLayoutInput, buildNodeLayoutMap } from '../react/node-to-layout';
import { generateNodeRenderCommands } from '../react/render-commands';
import { NodeEventManager } from '../react/event-handler';
import { patchProp } from '../vue/patch-props';

/**
 * Native iOS renderer that forwards render commands to the Swift shell
 * via the __glyph_native bridge. The Swift side draws them with Core Graphics.
 */
class NativeRenderer implements Renderer {
  private viewport: { width: number; height: number };

  constructor() {
    this.viewport = __glyph_native.getViewportSize();
  }

  clear(): void {
    // No-op: native side clears on every draw cycle
  }

  render(commands: AnyRenderCommand[]): void {
    __glyph_native.submitRenderCommands(JSON.stringify(commands));
  }

  getWidth(): number {
    return this.viewport.width;
  }

  getHeight(): number {
    return this.viewport.height;
  }

  measureText(
    text: string,
    fontSize: number,
    fontFamily: string,
    fontWeight: string,
  ): { width: number; height: number } {
    return __glyph_native.measureText(text, fontSize, fontFamily, fontWeight);
  }

  updateViewport(width: number, height: number): void {
    this.viewport = { width, height };
  }
}

/**
 * Entry point for the iOS native runtime. Call this from your app's
 * bundled JS with the root Vue component.
 */
export function render(rootComponent: Component): void {
  const renderer = new NativeRenderer();
  const layoutEngine = createLayoutEngine();

  const rootNode = new GlyphNode(HOST_TYPES.ROOT, {
    style: { width: renderer.getWidth(), height: renderer.getHeight() },
  });

  const eventManager = new NodeEventManager();
  let needsRender = false;

  function scheduleRender() {
    if (!needsRender) {
      needsRender = true;
      requestAnimationFrame(performRender);
    }
  }

  function performRender() {
    needsRender = false;

    const layoutInput = nodeToLayoutInput(rootNode, renderer);
    const layoutOutput = layoutEngine.computeLayout(
      layoutInput,
      renderer.getWidth(),
      renderer.getHeight(),
    );
    const layoutMap = buildNodeLayoutMap(rootNode, layoutOutput);
    const commands = generateNodeRenderCommands(rootNode, layoutMap);

    renderer.render(commands);

    eventManager.setRoot(rootNode, layoutMap);
  }

  // Touch handler invoked by the native shell
  (globalThis as any).__glyph_handleTouch = (
    type: string,
    x: number,
    y: number,
  ) => {
    switch (type) {
      case 'pressIn':
        eventManager.handlePointerDown(x, y);
        break;
      case 'pressOut':
        // pressOut is handled inside handlePointerUp
        break;
      case 'press':
        eventManager.handlePointerUp(x, y);
        break;
    }
  };

  // Viewport resize handler invoked by the native shell
  (globalThis as any).__glyph_updateViewport = (
    width: number,
    height: number,
  ) => {
    renderer.updateViewport(width, height);
    rootNode.props.style = { width, height };
    scheduleRender();
  };

  // Create Vue renderer with mutation-triggered re-renders
  const { createApp } = createRenderer({
    createElement(tag: string): GlyphNode {
      return new GlyphNode(tag, {});
    },
    createText(text: string): GlyphNode {
      return new GlyphNode(HOST_TYPES.TEXT_LEAF, {}, text);
    },
    createComment(_text: string): GlyphNode {
      return new GlyphNode('glyph-comment', {});
    },
    insert(child: GlyphNode, parent: GlyphNode, anchor?: GlyphNode | null): void {
      if (anchor) {
        parent.insertBefore(child, anchor);
      } else {
        parent.appendChild(child);
      }
      scheduleRender();
    },
    remove(child: GlyphNode): void {
      if (child.parent) child.parent.removeChild(child);
      scheduleRender();
    },
    setText(node: GlyphNode, text: string): void {
      node.updateText(text);
      scheduleRender();
    },
    setElementText(node: GlyphNode, text: string): void {
      node.children.forEach(c => { c.parent = null; });
      node.children = [];
      if (text) {
        const textNode = new GlyphNode(HOST_TYPES.TEXT_LEAF, {}, text);
        node.appendChild(textNode);
      }
      scheduleRender();
    },
    parentNode(node: GlyphNode): GlyphNode | null {
      return node.parent;
    },
    nextSibling(node: GlyphNode): GlyphNode | null {
      if (!node.parent) return null;
      const siblings = node.parent.children;
      const idx = siblings.indexOf(node);
      return idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
    },
    patchProp(el: GlyphNode, key: string, prevValue: any, nextValue: any): void {
      patchProp(el, key, prevValue, nextValue);
      scheduleRender();
    },
  });

  const app = createApp(rootComponent);
  app.mount(rootNode as any);
}
