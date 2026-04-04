import { createRenderer } from '@vue/runtime-core';
import type { App, Component } from '@vue/runtime-core';
import { nodeOps } from './node-ops';
import { patchProp } from './patch-props';
import { GlyphNode, HOST_TYPES } from '../react/glyph-node';

const { render: vueRender, createApp: vueCreateApp } = createRenderer({
  ...nodeOps,
  patchProp,
});

export function createApp(rootComponent: Component, rootProps?: Record<string, any>): App {
  return vueCreateApp(rootComponent, rootProps);
}

export function renderVue(vnode: any, rootNode: GlyphNode): void {
  vueRender(vnode, rootNode as any);
}

export { GlyphNode, HOST_TYPES };
