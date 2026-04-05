import { createSignal } from 'solid-js';
import { glyphisRenderer } from './renderer';
import { View } from './components';
import type { Style } from './types';

export interface ScrollViewHandle {
  scrollTo: (offset: number) => void;
  getScrollOffset: () => number;
}

export interface ScrollViewProps {
  style?: Style;
  contentStyle?: Style;
  children?: any;
  horizontal?: boolean;
  contentHeight?: number;
  onScroll?: (offset: number) => void;
  ref?: (handle: ScrollViewHandle) => void;
}

/**
 * ScrollView is a scrollable container for arbitrary children.
 *
 * Unlike RecyclerList, it does not virtualize -- all children are always
 * rendered. Scroll is achieved by offsetting the inner content wrapper
 * using absolute positioning inside an overflow-hidden container.
 *
 * Scroll physics (momentum, rubber-band, snap-back) are identical to
 * RecyclerList.
 */
export function ScrollView(props: ScrollViewProps): any {
  var scrollSignal = createSignal(0);
  var scrollOffset = scrollSignal[0];
  var setScrollOffset = scrollSignal[1];

  function getViewportSize(): number {
    var s = props.style;
    if (props.horizontal) {
      if (s && typeof s.width === 'number') return s.width;
    } else {
      if (s && typeof s.height === 'number') return s.height;
    }
    return 600;
  }

  function getMaxScroll(): number {
    if (props.contentHeight != null) {
      var vpSize = getViewportSize();
      var max = props.contentHeight - vpSize;
      if (max < 0) return 0;
      return max;
    }
    return Infinity;
  }

  function clampOffset(offset: number): number {
    if (offset < 0) return 0;
    var max = getMaxScroll();
    if (max !== Infinity && offset > max) return max;
    return offset;
  }

  // -- Scroll physics constants (same as RecyclerList) --
  var FRICTION = 0.95;
  var MIN_VELOCITY = 0.5;
  var MAX_OVERSCROLL = 100;
  var RUBBER_BAND_FACTOR = 0.3;
  var SPRING_STIFFNESS = 0.15;
  var SPRING_DAMPING = 0.75;

  var momentumAnimId: any = null;

  // Velocity tracking during drag
  var lastMovePos: number = 0;
  var lastMoveTime: number = 0;
  var velocityMain: number = 0;

  // Drag state
  var dragStartPos: number = 0;
  var dragStartOffset: number = 0;

  function stopMomentum(): void {
    if (momentumAnimId != null) {
      clearTimeout(momentumAnimId);
      momentumAnimId = null;
    }
  }

  // -- Public scrollTo: clamps, no rubber-band, no momentum --
  function scrollTo(offset: number): void {
    stopMomentum();
    var clamped = clampOffset(offset);
    setScrollOffset(clamped);
    if (props.onScroll) props.onScroll(clamped);
  }

  var handle: ScrollViewHandle = {
    scrollTo: scrollTo,
    getScrollOffset: scrollOffset,
  };

  if (props.ref) {
    props.ref(handle);
  }

  /**
   * Apply scroll offset with rubber-band resistance at the edges.
   * Only used during drag -- programmatic scrollTo clamps instead.
   */
  function scrollToWithRubberBand(target: number): void {
    var max = getMaxScroll();
    if (target < 0) {
      target = target * RUBBER_BAND_FACTOR;
    } else if (max !== Infinity && target > max) {
      var over = target - max;
      target = max + over * RUBBER_BAND_FACTOR;
    }
    setScrollOffset(target);
    if (props.onScroll) props.onScroll(target);
  }

  /**
   * Start momentum (inertia) animation after drag release.
   * velocity is in px/frame (~16ms), positive = scroll offset increasing.
   */
  function startMomentum(velocity: number): void {
    stopMomentum();

    function tick(): void {
      velocity = velocity * FRICTION;

      if (Math.abs(velocity) < MIN_VELOCITY) {
        velocity = 0;
        snapBack();
        return;
      }

      var newOffset = scrollOffset() + velocity;

      // Rubber-band if overscrolling during momentum
      var max = getMaxScroll();
      if (newOffset < 0 || (max !== Infinity && newOffset > max)) {
        velocity = velocity * 0.7;
        if (newOffset < -MAX_OVERSCROLL) newOffset = -MAX_OVERSCROLL;
        if (max !== Infinity && newOffset > max + MAX_OVERSCROLL) newOffset = max + MAX_OVERSCROLL;
      }

      setScrollOffset(newOffset);
      if (props.onScroll) props.onScroll(newOffset);

      momentumAnimId = setTimeout(tick, 16);
    }

    tick();
  }

  /**
   * If the current offset is past the edges, animate back with a spring.
   */
  function snapBack(): void {
    var offset = scrollOffset();
    var max = getMaxScroll();
    if (offset < 0) {
      startSnapAnimation(0);
    } else if (max !== Infinity && offset > max) {
      startSnapAnimation(max);
    }
  }

  /**
   * Spring animation to snap scroll offset back to a target value.
   */
  function startSnapAnimation(target: number): void {
    stopMomentum();
    var springVelocity = 0;

    function tick(): void {
      var current = scrollOffset();
      var force = (target - current) * SPRING_STIFFNESS;
      springVelocity = (springVelocity + force) * SPRING_DAMPING;
      var next = current + springVelocity;

      if (Math.abs(next - target) < 0.5 && Math.abs(springVelocity) < 0.5) {
        setScrollOffset(target);
        if (props.onScroll) props.onScroll(target);
        momentumAnimId = null;
        return;
      }

      setScrollOffset(next);
      if (props.onScroll) props.onScroll(next);
      momentumAnimId = setTimeout(tick, 16);
    }

    tick();
  }

  function handleScrollDragStart(x: number, y: number): void {
    stopMomentum();

    dragStartPos = props.horizontal ? x : y;
    dragStartOffset = scrollOffset();

    lastMovePos = dragStartPos;
    lastMoveTime = Date.now();
    velocityMain = 0;
  }

  function handlePointerMove(x: number, y: number): void {
    var pos = props.horizontal ? x : y;

    var now = Date.now();
    var dt = now - lastMoveTime;
    if (dt > 0) {
      velocityMain = (pos - lastMovePos) / dt; // px/ms
    }
    lastMovePos = pos;
    lastMoveTime = now;

    var delta = pos - dragStartPos;
    var rawTarget = dragStartOffset - delta;
    scrollToWithRubberBand(rawTarget);
  }

  function handleScrollDragEnd(x: number, y: number): void {
    // Convert velocity from px/ms to px/frame (~16ms)
    // Velocity is screen-space (positive = finger moving down/right),
    // scroll offset is inverted (finger down = scroll up = offset decreases)
    var frameVelocity = -velocityMain * 16;

    dragStartPos = 0;
    dragStartOffset = 0;

    // If currently overscrolled, snap back immediately
    var offset = scrollOffset();
    var max = getMaxScroll();
    if (offset < 0 || (max !== Infinity && offset > max)) {
      snapBack();
      return;
    }

    // Start momentum if velocity is significant
    if (Math.abs(frameVelocity) > MIN_VELOCITY) {
      startMomentum(frameVelocity);
    }
  }

  // Build container style: overflow hidden + user style
  function buildContainerStyle(): Style {
    var result: Style = { overflow: 'hidden' as const };
    var st = props.style;
    if (st) {
      var keys = Object.keys(st) as (keyof Style)[];
      for (var k = 0; k < keys.length; k++) {
        (result as any)[keys[k]] = (st as any)[keys[k]];
      }
    }
    result.overflow = 'hidden';
    return result;
  }

  var containerStyle = buildContainerStyle();

  return glyphisRenderer.createComponent(View, {
    style: containerStyle,
    onPointerMove: handlePointerMove,
    onScrollDragStart: handleScrollDragStart,
    onScrollDragEnd: handleScrollDragEnd,
    get children() {
      return glyphisRenderer.createComponent(View, {
        get style(): Style {
          var inner: Style = {
            position: 'absolute' as const,
            left: 0,
            right: 0,
          };
          if (props.horizontal) {
            inner.top = 0;
            inner.bottom = 0;
            inner.left = -scrollOffset();
            inner.right = undefined;
          } else {
            inner.top = -scrollOffset();
          }
          // Merge contentStyle overrides
          if (props.contentStyle) {
            var keys = Object.keys(props.contentStyle);
            for (var i = 0; i < keys.length; i++) {
              (inner as any)[keys[i]] = (props.contentStyle as any)[keys[i]];
            }
          }
          return inner;
        },
        get children() { return props.children; },
      });
    },
  });
}
