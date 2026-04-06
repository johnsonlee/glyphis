import { createRenderer } from 'solid-js/universal';
import Yoga, { Direction } from 'yoga-layout';
import { type GlyphisNode, createGlyphisNode } from './node';
import { applyStyle } from './styles';
import { generateCommands } from './commands';
import { dispatchInput } from './events';
import { buildSemanticsTree, findNodeBySemanticsId } from './accessibility';
import type { Platform, RenderPlatform, ImagePlatform, TextInputPlatform, Style, InputEvent, TextInputConfig, SemanticsNode } from './types';
import { beginSpan, endSpan } from './trace';

let renderScheduled = false;
let rootNode: GlyphisNode | null = null;
let currentPlatform: Platform | null = null;
var lastSemanticsJson = '';

// Use setTimeout(0) as fallback — queueMicrotask may not drain
// in JSC's evaluateScript context (microtasks require runloop turn).
const schedule = typeof queueMicrotask === 'function' && typeof document !== 'undefined'
  ? queueMicrotask
  : (fn: () => void) => setTimeout(fn, 0);

function scheduleRender(): void {
  if (renderScheduled) return;
  renderScheduled = true;
  schedule(flushRender);
}

function flushRender(): void {
  renderScheduled = false;
  if (!rootNode || !currentPlatform) return;
  var frameSpan = beginSpan('flushRender', 'render');
  const viewport = currentPlatform.getViewport();
  rootNode.yoga.setWidth(viewport.width);
  rootNode.yoga.setHeight(viewport.height);
  var layoutSpan = beginSpan('yoga.calculateLayout', 'render');
  rootNode.yoga.calculateLayout(viewport.width, viewport.height, Direction.LTR);
  endSpan(layoutSpan);
  var cmdSpan = beginSpan('generateCommands', 'render');
  const commands = generateCommands(rootNode);
  endSpan(cmdSpan, { commandCount: commands.length });
  var drawSpan = beginSpan('platform.render', 'render');
  currentPlatform.render(commands);
  endSpan(drawSpan);
  var tiSpan = beginSpan('syncTextInputPositions', 'render');
  syncTextInputPositions();
  endSpan(tiSpan);

  // Sync accessibility tree (skip if unchanged)
  if (currentPlatform.submitAccessibilityTree) {
    var a11ySpan = beginSpan('accessibilitySync', 'render');
    var semanticsNodes = buildSemanticsTree(rootNode);
    var semanticsJson = JSON.stringify(semanticsNodes);
    if (semanticsJson !== lastSemanticsJson) {
      lastSemanticsJson = semanticsJson;
      currentPlatform.submitAccessibilityTree(semanticsNodes);
    }
    endSpan(a11ySpan);
  }
  endSpan(frameSpan);
}

function syncTextInputPositions(): void {
  if (!currentPlatform) return;
  textInputRegistry.forEach(function(entry, inputId) {
    if (entry.focused && entry.node) {
      var layout = entry.node.yoga.getComputedLayout();
      var x = layout.left;
      var y = layout.top;
      var current = entry.node.parent;
      while (current) {
        var pl = current.yoga.getComputedLayout();
        x = x + pl.left;
        y = y + pl.top;
        current = current.parent;
      }
      if (currentPlatform && currentPlatform.updateTextInput) {
        currentPlatform.updateTextInput(inputId, {
          x: x, y: y, width: layout.width, height: layout.height
        } as any);
      }
    }
  });
}

function initNode(tag: string): GlyphisNode {
  const yoga = Yoga.Node.create();
  return createGlyphisNode(yoga, tag);
}

function setupTextMeasure(node: GlyphisNode): void {
  if (!currentPlatform) return;
  const parentStyle = node.parent ? node.parent.style : {};
  // On native: pass text + font to native for direct measurement (no JS callback)
  if (typeof (node.yoga as any).enableMeasureNative === 'function') {
    (node.yoga as any).enableMeasureNative(
      node.text,
      parentStyle.fontSize || 14,
      parentStyle.fontFamily || '',
      parentStyle.fontWeight || '',
    );
  } else {
    // Web: use JS measure callback (original behavior)
    const platform = currentPlatform;
    node.yoga.setMeasureFunc(() => {
      const ps = node.parent ? node.parent.style : {};
      return platform.measureText(
        node.text,
        ps.fontSize || 14,
        ps.fontFamily,
        ps.fontWeight,
      );
    });
  }
}

const EVENT_PROPS = new Set(['onPress', 'onPressIn', 'onPressOut', 'onPointerMove', 'onScrollDragStart', 'onScrollDragEnd', 'onLoad']);

// Image loading registry
var imageLoadCallbacks: Map<string, (width: number, height: number) => void> = new Map();
var imageLoadListenerRegistered = false;

function setupImageLoad(node: GlyphisNode): void {
  if (!currentPlatform || !node.imageProps) return;
  if (!currentPlatform.loadImage || !currentPlatform.onImageLoaded) return;
  var imageId = node.imageProps.imageId;
  var platform = currentPlatform;

  imageLoadCallbacks.set(imageId, function(width: number, height: number) {
    var imgSpan = beginSpan('imageLoadCallback', 'render');
    if (!node.imageProps) { endSpan(imgSpan); return; }
    node.imageProps.loaded = true;
    if (node.handlers.onLoad) {
      node.handlers.onLoad({ width: width, height: height });
    }
    scheduleRender();
    endSpan(imgSpan);
  });

  if (!imageLoadListenerRegistered && platform.onImageLoaded) {
    imageLoadListenerRegistered = true;
    platform.onImageLoaded(function(imageId: string, width: number, height: number) {
      var cb = imageLoadCallbacks.get(imageId);
      if (cb) cb(width, height);
    });
  }

  if (platform.loadImage) {
    platform.loadImage(imageId, node.imageProps.src);
  }
}

export const glyphisRenderer = createRenderer<GlyphisNode>({
  createElement(tag: string): GlyphisNode {
    return initNode(tag);
  },

  createTextNode(value: string): GlyphisNode {
    const node = initNode('__text');
    node.text = value;
    setupTextMeasure(node);
    return node;
  },

  replaceText(node: GlyphisNode, value: string): void {
    node.text = value;
    if (typeof (node.yoga as any).updateMeasureText === 'function') {
      (node.yoga as any).updateMeasureText(value);
    }
    node.yoga.markDirty();
    scheduleRender();
  },

  isTextNode(node: GlyphisNode): boolean {
    return node.tag === '__text';
  },

  setProperty(node: GlyphisNode, name: string, value: any): void {
    if (name === 'style') {
      node.style = value as Style;
      applyStyle(node.yoga, value);
      scheduleRender();
    } else if (name === 'imageProps') {
      node.imageProps = value;
      setupImageLoad(node);
    } else if (EVENT_PROPS.has(name)) {
      node.handlers[name] = value;
    }
  },

  insertNode(parent: GlyphisNode, node: GlyphisNode, anchor?: GlyphisNode): void {
    // If the node already belongs to another parent, remove it first.
    // This is required for node recycling (e.g. RecyclerList) where
    // slot nodes are re-parented to a new wrapper View on each scroll.
    if (node.parent && node.parent !== parent) {
      const oldChildren = node.parent.children;
      const oldIdx = oldChildren.indexOf(node);
      if (oldIdx !== -1) oldChildren.splice(oldIdx, 1);
      node.parent.yoga.removeChild(node.yoga);
      node.parent = undefined;
    }

    const children = parent.children;
    const index = anchor ? children.indexOf(anchor) : -1;
    if (index >= 0) {
      children.splice(index, 0, node);
    } else {
      children.push(node);
    }
    parent.yoga.insertChild(node.yoga, children.indexOf(node));
    node.parent = parent;
    scheduleRender();
  },

  removeNode(parent: GlyphisNode, node: GlyphisNode): void {
    const index = parent.children.indexOf(node);
    if (index !== -1) parent.children.splice(index, 1);
    parent.yoga.removeChild(node.yoga);
    node.parent = undefined;
    scheduleRender();
  },

  getParentNode(node: GlyphisNode): GlyphisNode | undefined {
    return node.parent;
  },

  getFirstChild(node: GlyphisNode): GlyphisNode | undefined {
    return node.children[0];
  },

  getNextSibling(node: GlyphisNode): GlyphisNode | undefined {
    if (!node.parent) return undefined;
    const siblings = node.parent.children;
    const index = siblings.indexOf(node);
    return index >= 0 ? siblings[index + 1] : undefined;
  },
});

export function render(code: () => any, platform: Platform): () => void {
  currentPlatform = platform;
  imageLoadCallbacks.clear();
  imageLoadListenerRegistered = false;
  lastSemanticsJson = '';

  rootNode = initNode('__root');
  const viewport = platform.getViewport();
  rootNode.yoga.setWidth(viewport.width);
  rootNode.yoga.setHeight(viewport.height);

  platform.onInput(function(event: InputEvent) {
    if (event.type === 'pointerdown' || event.type === 'pointerup' || event.type === 'pointermove') {
      if (rootNode) dispatchInput(rootNode, event);
    } else if (event.type === 'textchange') {
      var cbs = textInputRegistry.get(event.inputId);
      if (cbs && cbs.onChangeText) cbs.onChangeText(event.text);
    } else if (event.type === 'textsubmit') {
      var cbs2 = textInputRegistry.get(event.inputId);
      if (cbs2 && cbs2.onSubmit) cbs2.onSubmit();
    } else if (event.type === 'textfocus') {
      var cbs3 = textInputRegistry.get(event.inputId);
      if (cbs3 && cbs3.onFocus) cbs3.onFocus();
    } else if (event.type === 'textblur') {
      var cbs4 = textInputRegistry.get(event.inputId);
      if (cbs4 && cbs4.onBlur) cbs4.onBlur();
    } else if (event.type === 'accessibilityaction') {
      if (rootNode && event.action === 'activate') {
        var target = findNodeBySemanticsId(rootNode, event.nodeId);
        if (target && target.handlers.onPress) target.handlers.onPress();
      }
    }
  });

  const dispose = glyphisRenderer.render(code, rootNode);
  scheduleRender();

  return () => {
    dispose();
    if (rootNode) {
      rootNode.yoga.freeRecursive();
      rootNode = null;
    }
    currentPlatform = null;
  };
}

// --- TextInput support ---

export var textInputRegistry: Map<string, {
  onChangeText?: Function;
  onFocus?: Function;
  onBlur?: Function;
  onSubmit?: Function;
  node?: GlyphisNode;
  focused?: boolean;
}> = new Map();

export function showTextInput(config: TextInputConfig): void {
  if (currentPlatform && currentPlatform.showTextInput) currentPlatform.showTextInput(config);
}

export function hideTextInput(inputId: string): void {
  if (currentPlatform && currentPlatform.hideTextInput) currentPlatform.hideTextInput(inputId);
}

export function updateTextInput(inputId: string, config: Partial<TextInputConfig>): void {
  if (currentPlatform && currentPlatform.updateTextInput) currentPlatform.updateTextInput(inputId, config);
}

export { scheduleRender };
