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

  function scrollTo(offset: number): void {
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
    var idx = Math.floor(scrollOffset() / props.itemHeight) - BUFFER;
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

  // -- Drag-to-scroll state --
  var dragStartY: number = 0;
  var dragStartOffset: number = 0;

  function handleScrollDragStart(x: number, y: number): void {
    dragStartY = y;
    dragStartOffset = scrollOffset();
  }

  function handlePointerMove(x: number, y: number): void {
    var dy = y - dragStartY;
    scrollTo(dragStartOffset - dy);
  }

  function handleScrollDragEnd(x: number, y: number): void {
    // Reset drag state; momentum scrolling can be added later
    dragStartY = 0;
    dragStartOffset = 0;
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
      var items: any[] = [];
      var visibleCount = end - start;

      // Top spacer
      var spacerHeight = start * itemH - scrollOffset();
      if (spacerHeight > 0) {
        items.push(
          glyphisRenderer.createComponent(View, {
            style: { height: spacerHeight } as Style,
          })
        );
      }

      // Assign data to slot signals — nodes update reactively, no recreation
      for (var i = 0; i < poolSize; i++) {
        var slot = slots[i];
        if (i < visibleCount) {
          var dataIndex = start + i;
          slot.itemSignal[1](data[dataIndex]);
          slot.indexSignal[1](dataIndex);
          slot.activeSignal[1](true);
          items.push(slot.node);
        } else {
          slot.activeSignal[1](false);
        }
      }

      return items;
    },
  });
}
