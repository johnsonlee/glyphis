import { createSignal, createMemo } from 'solid-js';
import { glyphisRenderer } from './renderer';
import { View } from './components';
import type { Style } from './types';

export interface RecyclerListHandle {
  scrollTo: (offset: number) => void;
  scrollToIndex: (index: number) => void;
  getScrollOffset: () => number;
  getMaxScroll: () => number;
  pageDown: () => void;
  pageUp: () => void;
}

export interface RecyclerListProps<T> {
  data: T[];
  /**
   * Render function receives signal accessors, not values.
   * This enables node recycling — the function is called once per slot,
   * and data updates flow through the signals without recreating nodes.
   */
  renderItem: (getItem: () => T, getIndex: () => number) => any;
  itemHeight: number;
  style?: Style;
  onScroll?: (offset: number) => void;
  ref?: (handle: RecyclerListHandle) => void;
}

/**
 * RecyclerList renders only the items visible in the viewport, making it
 * feasible to display tens of thousands of rows without creating a Yoga
 * node for each one.
 *
 * Node recycling: a fixed pool of slot nodes is created once at init.
 * Each slot receives data via SolidJS signals. On scroll or data change,
 * the slot signals are updated — existing nodes re-render reactively
 * without being destroyed and recreated.
 *
 * Scrolling is driven externally through the RecyclerListHandle exposed
 * via the `ref` callback: scrollTo, scrollToIndex, pageDown, pageUp.
 *
 * Physics: momentum scrolling with friction on drag release, rubber-band
 * overscroll with spring snap-back.
 */
export function RecyclerList<T>(props: RecyclerListProps<T>): any {
  var scrollSignal = createSignal(0);
  var scrollOffset = scrollSignal[0];
  var setScrollOffset = scrollSignal[1];

  // Track data reference to trigger slot rebinds when data array changes
  var dataRef = createMemo(function() { return props.data; });

  function getViewportHeight(): number {
    var s = props.style;
    if (s && typeof s.height === 'number') return s.height;
    return 600;
  }

  function getMaxScroll(): number {
    var total = props.data.length * props.itemHeight;
    var vpH = getViewportHeight();
    var max = total - vpH;
    if (max < 0) return 0;
    return max;
  }

  function clampOffset(offset: number): number {
    if (offset < 0) return 0;
    var max = getMaxScroll();
    if (offset > max) return max;
    return offset;
  }

  // -- Public scrollTo: clamps, no rubber-band, no momentum --
  function scrollTo(offset: number): void {
    stopMomentum();
    var clamped = clampOffset(offset);
    setScrollOffset(clamped);
    if (props.onScroll) props.onScroll(clamped);
  }

  function scrollToIndex(index: number): void {
    scrollTo(index * props.itemHeight);
  }

  function pageDown(): void {
    scrollTo(scrollOffset() + getViewportHeight());
  }

  function pageUp(): void {
    scrollTo(scrollOffset() - getViewportHeight());
  }

  var handle: RecyclerListHandle = {
    scrollTo: scrollTo,
    scrollToIndex: scrollToIndex,
    getScrollOffset: scrollOffset,
    getMaxScroll: getMaxScroll,
    pageDown: pageDown,
    pageUp: pageUp,
  };

  if (props.ref) {
    props.ref(handle);
  }

  var BUFFER = 2;

  function getWindowSize(): number {
    return Math.ceil(getViewportHeight() / props.itemHeight) + BUFFER * 2;
  }

  var startIndex = createMemo(function () {
    // Read dataRef to retrigger when data array changes
    dataRef();
    var offset = scrollOffset();
    // Clamp negative offsets (from overscroll) to 0 for index calculation
    if (offset < 0) offset = 0;
    var idx = Math.floor(offset / props.itemHeight) - BUFFER;
    if (idx < 0) return 0;
    return idx;
  });

  var endIndex = createMemo(function () {
    var end = startIndex() + getWindowSize();
    var len = props.data.length;
    if (end > len) return len;
    return end;
  });

  // -- Slot pool for node recycling --
  // Each slot is created once with signal-backed item/index.
  // On scroll, we update the signals — the rendered nodes update reactively.
  var poolSize = getWindowSize();

  interface Slot {
    itemSignal: ReturnType<typeof createSignal<T | null>>;
    indexSignal: ReturnType<typeof createSignal<number>>;
    activeSignal: ReturnType<typeof createSignal<boolean>>;
    node: any;
  }

  var slots: Slot[] = [];
  for (var s = 0; s < poolSize; s++) {
    var itemSig = createSignal<T | null>(null);
    var indexSig = createSignal<number>(0);
    var activeSig = createSignal<boolean>(false);

    // Create the node ONCE via renderItem with signal accessors
    var capturedItemGet = itemSig[0];
    var capturedIndexGet = indexSig[0];
    var node = props.renderItem(
      capturedItemGet as () => T,
      capturedIndexGet
    );

    slots.push({
      itemSignal: itemSig,
      indexSignal: indexSig,
      activeSignal: activeSig,
      node: node,
    });
  }

  // Build container style
  function buildContainerStyle(): Style {
    var result: Style = { overflow: 'hidden' as const };
    var st = props.style;
    if (!st) return result;
    var keys = Object.keys(st) as (keyof Style)[];
    for (var k = 0; k < keys.length; k++) {
      (result as any)[keys[k]] = (st as any)[keys[k]];
    }
    result.overflow = 'hidden';
    return result;
  }

  var containerStyle = buildContainerStyle();

  // -- Scroll physics state --
  var FRICTION = 0.95;
  var MIN_VELOCITY = 0.5;
  var MAX_OVERSCROLL = 100;
  var RUBBER_BAND_FACTOR = 0.3;
  var SPRING_STIFFNESS = 0.15;
  var SPRING_DAMPING = 0.75;

  var momentumAnimId: any = null;

  // Velocity tracking during drag
  var lastMoveY: number = 0;
  var lastMoveTime: number = 0;
  var velocityY: number = 0;

  // -- Drag-to-scroll state --
  var dragStartY: number = 0;
  var dragStartOffset: number = 0;

  function stopMomentum(): void {
    if (momentumAnimId != null) {
      clearTimeout(momentumAnimId);
      momentumAnimId = null;
    }
  }

  /**
   * Apply scroll offset with rubber-band resistance at the edges.
   * Only used during drag — programmatic scrollTo clamps instead.
   */
  function scrollToWithRubberBand(target: number): void {
    var max = getMaxScroll();
    if (target < 0) {
      // Rubber-band: resistance increases with distance
      target = target * RUBBER_BAND_FACTOR;
    } else if (target > max) {
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
        // If overscrolled, snap back
        snapBack();
        return;
      }

      var newOffset = scrollOffset() + velocity;

      // Rubber-band if overscrolling during momentum
      var max = getMaxScroll();
      if (newOffset < 0 || newOffset > max) {
        // Reduce velocity faster when overscrolling
        velocity = velocity * 0.7;
        // Clamp overscroll extent
        if (newOffset < -MAX_OVERSCROLL) newOffset = -MAX_OVERSCROLL;
        if (newOffset > max + MAX_OVERSCROLL) newOffset = max + MAX_OVERSCROLL;
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
    } else if (offset > max) {
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
    // Stop any active momentum or snap animation
    stopMomentum();

    dragStartY = y;
    dragStartOffset = scrollOffset();

    // Reset velocity tracking
    lastMoveY = y;
    lastMoveTime = Date.now();
    velocityY = 0;
  }

  function handlePointerMove(x: number, y: number): void {
    // Track velocity
    var now = Date.now();
    var dt = now - lastMoveTime;
    if (dt > 0) {
      velocityY = (y - lastMoveY) / dt; // px/ms
    }
    lastMoveY = y;
    lastMoveTime = now;

    // Compute raw target offset (no clamping — allow overscroll with resistance)
    var dy = y - dragStartY;
    var rawTarget = dragStartOffset - dy;
    scrollToWithRubberBand(rawTarget);
  }

  function handleScrollDragEnd(x: number, y: number): void {
    // Convert velocityY from px/ms to px/frame (~16ms)
    // velocityY is in screen-space (positive = finger moving down),
    // but scroll offset is inverted (finger down = scroll up = offset decreases)
    var frameVelocity = -velocityY * 16;

    dragStartY = 0;
    dragStartOffset = 0;

    // Check if currently overscrolled — if so, snap back immediately
    var offset = scrollOffset();
    var max = getMaxScroll();
    if (offset < 0 || offset > max) {
      snapBack();
      return;
    }

    // Start momentum if velocity is significant
    if (Math.abs(frameVelocity) > MIN_VELOCITY) {
      startMomentum(frameVelocity);
    }
  }

  return glyphisRenderer.createComponent(View, {
    style: containerStyle,
    onPointerMove: handlePointerMove,
    onScrollDragStart: handleScrollDragStart,
    onScrollDragEnd: handleScrollDragEnd,
    get children() {
      var start = startIndex();
      var end = endIndex();
      var data = props.data;
      var itemH = props.itemHeight;
      var visibleCount = end - start;
      var offset = scrollOffset();

      // Sub-row pixel offset: how far the content is shifted within the
      // current top row. This produces smooth pixel-level scrolling.
      var subRowOffset = start * itemH - offset;

      // Assign data to slot signals — nodes update reactively, no recreation
      var slotNodes: any[] = [];
      for (var i = 0; i < poolSize; i++) {
        var slot = slots[i];
        if (i < visibleCount) {
          var dataIndex = start + i;
          slot.itemSignal[1](data[dataIndex]);
          slot.indexSignal[1](dataIndex);
          slot.activeSignal[1](true);
          slotNodes.push(slot.node);
        } else {
          slot.activeSignal[1](false);
        }
      }

      // Wrap all visible items in a View shifted by the sub-row offset.
      // position:relative + top moves the view visually without affecting layout.
      return glyphisRenderer.createComponent(View, {
        style: {
          position: 'relative' as const,
          top: subRowOffset,
        } as Style,
        children: slotNodes,
      });
    },
  });
}
