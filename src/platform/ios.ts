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

import type { Renderer, AnyRenderCommand } from '../types';
import { createLayoutEngine } from '../layout/index';
import type { LayoutOutput } from '../layout';
import { GlyphNode, HOST_TYPES } from '../react/glyph-node';
import { nodeToLayoutInput, buildNodeLayoutMap } from '../react/node-to-layout';
import { generateNodeRenderCommands } from '../react/render-commands';
import {
  hitTestNode,
  createNodePointerEvent,
  dispatchNodeEvent,
} from '../react/event-handler';
import { renderReact } from '../react/renderer';
import type { ReactElement } from 'react';

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
 * bundled JS with the root React element.
 */
export function render(element: ReactElement): void {
  const renderer = new NativeRenderer();
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
    const layoutOutput = layoutEngine.computeLayout(
      layoutInput,
      renderer.getWidth(),
      renderer.getHeight(),
    );
    const layoutMap = buildNodeLayoutMap(rootNode, layoutOutput);
    const commands = generateNodeRenderCommands(rootNode, layoutMap);

    renderer.render(commands);

    // Store for touch handling
    (globalThis as any).__glyph_rootNode = rootNode;
    (globalThis as any).__glyph_layoutMap = layoutMap;
  }

  // Touch handler invoked by the native shell
  (globalThis as any).__glyph_handleTouch = (
    type: string,
    x: number,
    y: number,
  ) => {
    const currentRoot = (globalThis as any).__glyph_rootNode as
      | GlyphNode
      | undefined;
    const currentLayoutMap = (globalThis as any).__glyph_layoutMap as
      | Map<GlyphNode, LayoutOutput>
      | undefined;
    if (!currentRoot || !currentLayoutMap) return;

    const target = hitTestNode(currentRoot, currentLayoutMap, x, y);
    if (!target) return;

    const event = createNodePointerEvent(type as any, x, y, target.node);
    dispatchNodeEvent(event as any);
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

  renderReact(element, rootNode, scheduleRender);
}
