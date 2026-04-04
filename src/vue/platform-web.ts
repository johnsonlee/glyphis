import type { Component } from '@vue/runtime-core';
import { createRenderer } from '@vue/runtime-core';
import { GlyphNode, HOST_TYPES } from '../react/glyph-node';
import { nodeToLayoutInput, buildNodeLayoutMap } from '../react/node-to-layout';
import { generateNodeRenderCommands } from '../react/render-commands';
import { NodeEventManager } from '../react/event-handler';
import { CanvasRenderer } from '../canvas-renderer';
import { createLayoutEngine } from '../layout/index';
import { setDebugMode } from '../render-tree';
import { patchProp } from './patch-props';

export function render(rootComponent: Component, canvas: HTMLCanvasElement, rootProps?: Record<string, any>): void {
  const renderer = new CanvasRenderer(canvas);
  const eventManager = new NodeEventManager();
  const layoutEngine = createLayoutEngine();

  const rootNode = new GlyphNode(HOST_TYPES.ROOT, {
    style: { width: renderer.getWidth(), height: renderer.getHeight() },
  });

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
    const layoutOutput = layoutEngine.computeLayout(layoutInput, renderer.getWidth(), renderer.getHeight());
    const layoutMap = buildNodeLayoutMap(rootNode, layoutOutput);
    const commands = generateNodeRenderCommands(rootNode, layoutMap);
    renderer.clear();
    renderer.render(commands);
    eventManager.setRoot(rootNode, layoutMap);
  }

  // Debug mode
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === 'true') setDebugMode(true);
    (window as any).__GLYPH_DEBUG__ = (enabled: boolean) => {
      setDebugMode(enabled);
      scheduleRender();
    };
  }

  eventManager.attach(canvas);

  // Create Vue renderer with inline nodeOps that trigger scheduleRender on mutations
  const { createApp: vueCreateApp } = createRenderer({
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

  const app = vueCreateApp(rootComponent, rootProps);
  app.mount(rootNode as any);
}
