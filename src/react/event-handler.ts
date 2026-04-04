import type { GlyphPointerEvent } from '../types';
import type { LayoutOutput } from '../layout';
import { GlyphNode, HOST_TYPES } from './glyph-node';
import { isInsideRoundedRect } from '../events';

export interface NodeEventTarget {
  node: GlyphNode;
  layout: { x: number; y: number; width: number; height: number };
}

export function hitTestNode(
  node: GlyphNode,
  layoutMap: Map<GlyphNode, LayoutOutput>,
  x: number,
  y: number,
  offsetX: number = 0,
  offsetY: number = 0,
): NodeEventTarget | null {
  const layout = layoutMap.get(node);
  if (!layout) return null;

  const nodeX = offsetX + layout.x;
  const nodeY = offsetY + layout.y;

  const isInBounds =
    x >= nodeX && x <= nodeX + layout.width &&
    y >= nodeY && y <= nodeY + layout.height;

  const style = node.props.style || {};
  if (style.overflow === 'hidden' && !isInBounds) return null;

  // Check children in reverse (last child = topmost)
  for (let i = node.children.length - 1; i >= 0; i--) {
    const result = hitTestNode(node.children[i], layoutMap, x, y, nodeX, nodeY);
    if (result) return result;
  }

  // Check borderRadius
  const borderRadius = style.borderRadius ?? 0;
  const isInShape = isInBounds && (borderRadius <= 0 || isInsideRoundedRect(
    x, y, nodeX, nodeY, layout.width, layout.height, borderRadius
  ));

  if (isInShape && node.type !== HOST_TYPES.ROOT) {
    return { node, layout: { x: nodeX, y: nodeY, width: layout.width, height: layout.height } };
  }

  return null;
}

export function createNodePointerEvent(
  type: GlyphPointerEvent['type'],
  x: number,
  y: number,
  target: GlyphNode | null,
): GlyphPointerEvent {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    type, x, y, target: target as any,
    timestamp: Date.now(),
    preventDefault() { defaultPrevented = true; },
    stopPropagation() { propagationStopped = true; },
    get defaultPrevented() { return defaultPrevented; },
    get propagationStopped() { return propagationStopped; },
  } as GlyphPointerEvent & { defaultPrevented: boolean; propagationStopped: boolean };
}

export function dispatchNodeEvent(event: GlyphPointerEvent & { propagationStopped: boolean }): void {
  let current: GlyphNode | null = event.target as any;
  while (current && !event.propagationStopped) {
    const handler = getNodeEventHandler(current, event.type);
    if (handler) handler(event);
    current = current.parent;
  }
}

function getNodeEventHandler(
  node: GlyphNode,
  eventType: string,
): ((e: GlyphPointerEvent) => void) | null {
  switch (eventType) {
    case 'press': return node.props.onPress || null;
    case 'pressIn': return node.props.onPressIn || null;
    case 'pressOut': return node.props.onPressOut || null;
    default: return null;
  }
}

// NodeEventManager: manages pointer state for GlyphNode trees
export class NodeEventManager {
  private layoutMap: Map<GlyphNode, LayoutOutput> = new Map();
  private rootNode: GlyphNode | null = null;
  private pressedTarget: NodeEventTarget | null = null;

  setRoot(node: GlyphNode, layoutMap: Map<GlyphNode, LayoutOutput>): void {
    this.rootNode = node;
    this.layoutMap = layoutMap;
  }

  handlePointerDown(x: number, y: number): void {
    if (!this.rootNode) return;
    const target = hitTestNode(this.rootNode, this.layoutMap, x, y);
    this.pressedTarget = target;
    if (target) {
      const event = createNodePointerEvent('pressIn', x, y, target.node);
      dispatchNodeEvent(event as any);
    }
  }

  handlePointerUp(x: number, y: number): void {
    if (!this.rootNode) return;

    if (this.pressedTarget) {
      const currentTarget = hitTestNode(this.rootNode, this.layoutMap, x, y);
      const pressOutNode = currentTarget?.node ?? this.pressedTarget.node;
      const pressOutEvent = createNodePointerEvent('pressOut', x, y, pressOutNode);
      dispatchNodeEvent(pressOutEvent as any);

      const { layout } = this.pressedTarget;
      const isWithinBounds =
        x >= layout.x && x <= layout.x + layout.width &&
        y >= layout.y && y <= layout.y + layout.height;

      if (isWithinBounds && currentTarget) {
        const pressEvent = createNodePointerEvent('press', x, y, currentTarget.node);
        dispatchNodeEvent(pressEvent as any);
      }
    }
    this.pressedTarget = null;
  }

  handlePointerMove(x: number, y: number): void {
    // No-op for now, can be extended for hover/drag
  }

  attach(canvas: HTMLCanvasElement): () => void {
    const getPos = (e: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMouseDown = (e: MouseEvent) => { const p = getPos(e); this.handlePointerDown(p.x, p.y); };
    const onMouseUp = (e: MouseEvent) => { const p = getPos(e); this.handlePointerUp(p.x, p.y); };
    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); const p = getPos(e.touches[0]); this.handlePointerDown(p.x, p.y); };
    const onTouchEnd = (e: TouchEvent) => { e.preventDefault(); const p = getPos(e.changedTouches[0]); this.handlePointerUp(p.x, p.y); };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }
}
