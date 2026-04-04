import type { Fiber, LayoutBox, GlyphPointerEvent } from './types';
import type { LayoutOutput } from './layout';

export interface EventTarget {
  fiber: Fiber;
  layout: LayoutBox;
}

export function isInsideRoundedRect(
  px: number, py: number,
  rx: number, ry: number,
  rw: number, rh: number,
  radius: number,
): boolean {
  const r = Math.min(radius, rw / 2, rh / 2);
  if (r <= 0) return true;

  // Top-left corner
  if (px < rx + r && py < ry + r) {
    return (px - rx - r) ** 2 + (py - ry - r) ** 2 <= r * r;
  }
  // Top-right corner
  if (px > rx + rw - r && py < ry + r) {
    return (px - rx - rw + r) ** 2 + (py - ry - r) ** 2 <= r * r;
  }
  // Bottom-left corner
  if (px < rx + r && py > ry + rh - r) {
    return (px - rx - r) ** 2 + (py - ry - rh + r) ** 2 <= r * r;
  }
  // Bottom-right corner
  if (px > rx + rw - r && py > ry + rh - r) {
    return (px - rx - rw + r) ** 2 + (py - ry - rh + r) ** 2 <= r * r;
  }

  return true;
}

export function hitTest(
  fiber: Fiber,
  layoutMap: Map<Fiber, LayoutOutput>,
  x: number,
  y: number,
  offsetX: number = 0,
  offsetY: number = 0,
): EventTarget | null {
  const layout = layoutMap.get(fiber);
  if (!layout) {
    // Component/fragment fibers don't have layout entries,
    // but their children do — keep walking through them
    const children: Fiber[] = [];
    let child = fiber.child;
    while (child) {
      children.push(child);
      child = child.sibling;
    }
    for (let i = children.length - 1; i >= 0; i--) {
      const result = hitTest(children[i], layoutMap, x, y, offsetX, offsetY);
      if (result) return result;
    }
    return null;
  }

  const nodeX = offsetX + layout.x;
  const nodeY = offsetY + layout.y;

  const isInBounds =
    x >= nodeX &&
    x <= nodeX + layout.width &&
    y >= nodeY &&
    y <= nodeY + layout.height;

  // If overflow is hidden and the point is outside this node, skip children
  const style = fiber.props.style || {};
  if (style.overflow === 'hidden' && !isInBounds) return null;

  // Collect children into an array for reverse iteration (later siblings render on top)
  const children: Fiber[] = [];
  let child = fiber.child;
  while (child) {
    children.push(child);
    child = child.sibling;
  }

  // Check children in reverse order (topmost first)
  for (let i = children.length - 1; i >= 0; i--) {
    const result = hitTest(children[i], layoutMap, x, y, nodeX, nodeY);
    if (result) return result;
  }

  // Also check borderRadius if present
  const borderRadius = style.borderRadius ?? 0;
  const isInShape = isInBounds && (borderRadius <= 0 || isInsideRoundedRect(
    x, y, nodeX, nodeY, layout.width, layout.height, borderRadius
  ));

  // Return this node if the point is within the rounded shape and it is a host fiber
  if (isInShape && fiber.tag === 'host') {
    return {
      fiber,
      layout: { x: nodeX, y: nodeY, width: layout.width, height: layout.height },
    };
  }

  return null;
}

export function createPointerEvent(
  type: GlyphPointerEvent['type'],
  x: number,
  y: number,
  target: Fiber | null,
): GlyphPointerEvent {
  let defaultPrevented = false;
  let propagationStopped = false;

  return {
    type,
    x,
    y,
    target,
    timestamp: Date.now(),
    preventDefault() {
      defaultPrevented = true;
    },
    stopPropagation() {
      propagationStopped = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
    get propagationStopped() {
      return propagationStopped;
    },
  } as GlyphPointerEvent & { defaultPrevented: boolean; propagationStopped: boolean };
}

export function dispatchEvent(event: GlyphPointerEvent): void {
  let fiber = event.target;
  const evt = event as GlyphPointerEvent & { propagationStopped: boolean };
  while (fiber && !evt.propagationStopped) {
    // Only dispatch events on host fibers — component and fragment fibers
    // are not real nodes and should not handle pointer events during bubbling.
    if (fiber.tag === 'host') {
      const handler = getEventHandler(fiber, event.type);
      if (handler) handler(event);
    }
    fiber = fiber.parent;
  }
}

function getEventHandler(
  fiber: Fiber,
  eventType: string,
): ((e: GlyphPointerEvent) => void) | null {
  const props = fiber.props;
  switch (eventType) {
    case 'press':
      return props.onPress || null;
    case 'pressIn':
      return props.onPressIn || null;
    case 'pressOut':
      return props.onPressOut || null;
    default:
      return null;
  }
}

export class EventManager {
  private layoutMap: Map<Fiber, LayoutOutput> = new Map();
  private rootFiber: Fiber | null = null;
  private pressedTarget: EventTarget | null = null;

  setRoot(fiber: Fiber, layoutMap: Map<Fiber, LayoutOutput>): void {
    this.rootFiber = fiber;
    this.layoutMap = layoutMap;
  }

  handlePointerDown(x: number, y: number): void {
    if (!this.rootFiber) return;
    const target = hitTest(this.rootFiber, this.layoutMap, x, y);
    this.pressedTarget = target;
    if (target) {
      const event = createPointerEvent('pressIn', x, y, target.fiber);
      dispatchEvent(event);
    }
  }

  handlePointerUp(x: number, y: number): void {
    if (!this.rootFiber) return;

    if (this.pressedTarget) {
      // Dispatch pressOut on the current target at the pressed position
      const currentTarget = hitTest(this.rootFiber, this.layoutMap, x, y);
      const pressOutFiber = currentTarget?.fiber ?? this.pressedTarget.fiber;
      const pressOutEvent = createPointerEvent('pressOut', x, y, pressOutFiber);
      dispatchEvent(pressOutEvent);

      // Fire press if the release position is still within the original pressed target's bounds
      // Use bounds comparison instead of fiber identity, since fibers are replaced on re-render
      const { layout } = this.pressedTarget;
      const isWithinOriginalBounds =
        x >= layout.x && x <= layout.x + layout.width &&
        y >= layout.y && y <= layout.y + layout.height;

      if (isWithinOriginalBounds && currentTarget) {
        const pressEvent = createPointerEvent('press', x, y, currentTarget.fiber);
        dispatchEvent(pressEvent);
      }
    }
    this.pressedTarget = null;
  }

  handlePointerMove(x: number, y: number): void {
    if (!this.rootFiber) return;
    const target = hitTest(this.rootFiber, this.layoutMap, x, y);
    if (target) {
      const event = createPointerEvent('move', x, y, target.fiber);
      dispatchEvent(event);
    }
  }

  attach(canvas: HTMLCanvasElement): () => void {
    const getPos = (e: MouseEvent | Touch): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMouseDown = (e: MouseEvent) => {
      const p = getPos(e);
      this.handlePointerDown(p.x, p.y);
    };
    const onMouseUp = (e: MouseEvent) => {
      const p = getPos(e);
      this.handlePointerUp(p.x, p.y);
    };
    const onMouseMove = (e: MouseEvent) => {
      const p = getPos(e);
      this.handlePointerMove(p.x, p.y);
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const p = getPos(e.touches[0]);
      this.handlePointerDown(p.x, p.y);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const p = getPos(e.changedTouches[0]);
      this.handlePointerUp(p.x, p.y);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const p = getPos(e.touches[0]);
      this.handlePointerMove(p.x, p.y);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchmove', onTouchMove);
    };
  }
}
