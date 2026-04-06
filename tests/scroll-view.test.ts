import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { render, glyphisRenderer } from '../src/renderer';
import { View, Text } from '../src/components';
import { ScrollView } from '../src/scroll-view';
import type { ScrollViewHandle } from '../src/scroll-view';
import type { Platform } from '../src/types';
import type { GlyphisNode } from '../src/node';

function createMockPlatform(): Platform {
  return {
    measureText: function () { return { width: 50, height: 16 }; },
    render: mock(function () {}),
    getViewport: function () { return { width: 390, height: 844 }; },
    onInput: function () {},
    loadImage: function () {},
    onImageLoaded: function () {},
  };
}

function flush(): Promise<void> {
  return new Promise(function (resolve) { setTimeout(resolve, 20); });
}

describe('ScrollView', function () {
  var disposeFn: (() => void) | null = null;
  var mockPlatform: Platform;

  beforeEach(function () {
    mockPlatform = createMockPlatform();
  });

  afterEach(function () {
    if (disposeFn) {
      disposeFn();
      disposeFn = null;
    }
  });

  it('renders children inside ScrollView', async function () {
    var viewNode: GlyphisNode | undefined;

    disposeFn = render(function () {
      viewNode = glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
        get children() {
          return glyphisRenderer.createComponent(Text, {
            children: 'Hello',
          });
        },
      });
      return viewNode;
    }, mockPlatform);

    await flush();

    expect(viewNode).toBeDefined();
    expect(viewNode!.tag).toBe('view');
    // The outer container should have at least one child (the content wrapper)
    expect(viewNode!.children.length).toBeGreaterThanOrEqual(1);
  });

  it('container has overflow hidden', async function () {
    var viewNode: GlyphisNode | undefined;

    disposeFn = render(function () {
      viewNode = glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
      });
      return viewNode;
    }, mockPlatform);

    await flush();

    expect(viewNode!.style.overflow).toBe('hidden');
  });

  it('ref callback receives handle with scrollTo and getScrollOffset', async function () {
    var handle: ScrollViewHandle | null = null;

    disposeFn = render(function () {
      return glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
        ref: function (h: ScrollViewHandle) { handle = h; },
      });
    }, mockPlatform);

    await flush();

    expect(handle).not.toBeNull();
    if (handle) {
      expect(typeof handle.scrollTo).toBe('function');
      expect(typeof handle.getScrollOffset).toBe('function');
    }
  });

  it('scrollTo changes scroll offset', async function () {
    var handle: ScrollViewHandle | null = null;

    disposeFn = render(function () {
      return glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
        contentHeight: 1000,
        ref: function (h: ScrollViewHandle) { handle = h; },
      });
    }, mockPlatform);

    await flush();

    expect(handle).not.toBeNull();
    if (handle) {
      expect(handle.getScrollOffset()).toBe(0);

      handle.scrollTo(200);
      await flush();

      expect(handle.getScrollOffset()).toBe(200);
    }
  });

  it('scrollTo clamps at 0 for negative values', async function () {
    var handle: ScrollViewHandle | null = null;

    disposeFn = render(function () {
      return glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
        contentHeight: 1000,
        ref: function (h: ScrollViewHandle) { handle = h; },
      });
    }, mockPlatform);

    await flush();

    if (handle) {
      handle.scrollTo(-100);
      await flush();

      expect(handle.getScrollOffset()).toBe(0);
    }
  });

  it('scrollTo clamps at max based on contentHeight', async function () {
    var handle: ScrollViewHandle | null = null;

    disposeFn = render(function () {
      return glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
        contentHeight: 1000,
        ref: function (h: ScrollViewHandle) { handle = h; },
      });
    }, mockPlatform);

    await flush();

    if (handle) {
      // maxScroll = contentHeight - viewportHeight = 1000 - 300 = 700
      handle.scrollTo(9999);
      await flush();

      expect(handle.getScrollOffset()).toBe(700);
    }
  });

  it('contentHeight less than viewport gives maxScroll of 0', async function () {
    var handle: ScrollViewHandle | null = null;

    disposeFn = render(function () {
      return glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
        contentHeight: 100,
        ref: function (h: ScrollViewHandle) { handle = h; },
      });
    }, mockPlatform);

    await flush();

    if (handle) {
      handle.scrollTo(50);
      await flush();

      // maxScroll = 100 - 300 = -200, clamped to 0
      expect(handle.getScrollOffset()).toBe(0);
    }
  });

  it('horizontal mode uses width for viewport size', async function () {
    var handle: ScrollViewHandle | null = null;

    disposeFn = render(function () {
      return glyphisRenderer.createComponent(ScrollView, {
        horizontal: true,
        style: { width: 200, height: 300 },
        contentHeight: 600,
        ref: function (h: ScrollViewHandle) { handle = h; },
      });
    }, mockPlatform);

    await flush();

    if (handle) {
      // maxScroll = 600 - 200 (width, because horizontal) = 400
      handle.scrollTo(9999);
      await flush();

      expect(handle.getScrollOffset()).toBe(400);
    }
  });

  it('onScroll callback is called when scroll offset changes', async function () {
    var handle: ScrollViewHandle | null = null;
    var scrollValues: number[] = [];

    disposeFn = render(function () {
      return glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
        contentHeight: 1000,
        ref: function (h: ScrollViewHandle) { handle = h; },
        onScroll: function (offset: number) { scrollValues.push(offset); },
      });
    }, mockPlatform);

    await flush();

    if (handle) {
      handle.scrollTo(150);
      await flush();

      expect(scrollValues.length).toBeGreaterThan(0);
      expect(scrollValues[scrollValues.length - 1]).toBe(150);
    }
  });

  it('scrollTo triggers platform render', async function () {
    var handle: ScrollViewHandle | null = null;
    var renderFn = mockPlatform.render as ReturnType<typeof mock>;

    disposeFn = render(function () {
      return glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
        contentHeight: 1000,
        ref: function (h: ScrollViewHandle) { handle = h; },
      });
    }, mockPlatform);

    await flush();

    var callsBefore = renderFn.mock.calls.length;

    if (handle) {
      handle.scrollTo(100);
      await flush();

      expect(renderFn.mock.calls.length).toBeGreaterThan(callsBefore);
    }
  });

  it('drag handlers are set on container node', async function () {
    var viewNode: GlyphisNode | undefined;

    disposeFn = render(function () {
      viewNode = glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
      });
      return viewNode;
    }, mockPlatform);

    await flush();

    expect(typeof viewNode!.handlers['onScrollDragStart']).toBe('function');
    expect(typeof viewNode!.handlers['onPointerMove']).toBe('function');
    expect(typeof viewNode!.handlers['onScrollDragEnd']).toBe('function');
  });

  it('user style is merged with overflow hidden', async function () {
    var viewNode: GlyphisNode | undefined;

    disposeFn = render(function () {
      viewNode = glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390, backgroundColor: '#FF0000' },
      });
      return viewNode;
    }, mockPlatform);

    await flush();

    expect(viewNode!.style.overflow).toBe('hidden');
    expect(viewNode!.style.height).toBe(300);
    expect(viewNode!.style.width).toBe(390);
    expect(viewNode!.style.backgroundColor).toBe('#FF0000');
  });

  it('user style overflow is overridden to hidden', async function () {
    var viewNode: GlyphisNode | undefined;

    disposeFn = render(function () {
      viewNode = glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, overflow: 'visible' as any },
      });
      return viewNode;
    }, mockPlatform);

    await flush();

    // overflow should always be 'hidden' regardless of user input
    expect(viewNode!.style.overflow).toBe('hidden');
  });

  it('defaults viewport height to 600 when style.height is missing', async function () {
    var handle: ScrollViewHandle | null = null;

    disposeFn = render(function () {
      return glyphisRenderer.createComponent(ScrollView, {
        style: { width: 390 },
        contentHeight: 1000,
        ref: function (h: ScrollViewHandle) { handle = h; },
      });
    }, mockPlatform);

    await flush();

    if (handle) {
      // maxScroll = 1000 - 600 (default) = 400
      handle.scrollTo(9999);
      await flush();

      expect(handle.getScrollOffset()).toBe(400);
    }
  });

  it('defaults viewport height to 600 when no style provided', async function () {
    var handle: ScrollViewHandle | null = null;

    disposeFn = render(function () {
      return glyphisRenderer.createComponent(ScrollView, {
        contentHeight: 1000,
        ref: function (h: ScrollViewHandle) { handle = h; },
      });
    }, mockPlatform);

    await flush();

    if (handle) {
      // maxScroll = 1000 - 600 (default) = 400
      handle.scrollTo(9999);
      await flush();

      expect(handle.getScrollOffset()).toBe(400);
    }
  });

  it('without contentHeight, maxScroll is Infinity so no upper clamp', async function () {
    var handle: ScrollViewHandle | null = null;

    disposeFn = render(function () {
      return glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
        ref: function (h: ScrollViewHandle) { handle = h; },
      });
    }, mockPlatform);

    await flush();

    if (handle) {
      handle.scrollTo(99999);
      await flush();

      expect(handle.getScrollOffset()).toBe(99999);
    }
  });

  it('inner content wrapper uses negative top offset for vertical scroll', async function () {
    var viewNode: GlyphisNode | undefined;
    var handle: ScrollViewHandle | null = null;

    disposeFn = render(function () {
      viewNode = glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
        contentHeight: 1000,
        ref: function (h: ScrollViewHandle) { handle = h; },
      });
      return viewNode;
    }, mockPlatform);

    await flush();

    if (handle) {
      handle.scrollTo(100);
      await flush();

      // The inner content wrapper is the first child of the container
      var innerWrapper = viewNode!.children[0];
      expect(innerWrapper).toBeDefined();
      expect(innerWrapper.style.position).toBe('absolute');
      expect(innerWrapper.style.top).toBe(-100);
    }
  });

  it('horizontal mode uses negative left offset', async function () {
    var viewNode: GlyphisNode | undefined;
    var handle: ScrollViewHandle | null = null;

    disposeFn = render(function () {
      viewNode = glyphisRenderer.createComponent(ScrollView, {
        horizontal: true,
        style: { width: 200, height: 300 },
        contentHeight: 600,
        ref: function (h: ScrollViewHandle) { handle = h; },
      });
      return viewNode;
    }, mockPlatform);

    await flush();

    if (handle) {
      handle.scrollTo(50);
      await flush();

      var innerWrapper = viewNode!.children[0];
      expect(innerWrapper.style.left).toBe(-50);
      expect(innerWrapper.style.top).toBe(0);
      expect(innerWrapper.style.bottom).toBe(0);
    }
  });

  it('contentStyle is merged into inner wrapper style', async function () {
    var viewNode: GlyphisNode | undefined;

    disposeFn = render(function () {
      viewNode = glyphisRenderer.createComponent(ScrollView, {
        style: { height: 300, width: 390 },
        contentStyle: { paddingTop: 10, paddingBottom: 10 },
      });
      return viewNode;
    }, mockPlatform);

    await flush();

    var innerWrapper = viewNode!.children[0];
    expect((innerWrapper.style as any).paddingTop).toBe(10);
    expect((innerWrapper.style as any).paddingBottom).toBe(10);
  });
});

describe('ScrollView scroll physics', function () {
  var disposeFn: (() => void) | null = null;
  var mockPlatform: Platform;

  beforeEach(function () {
    mockPlatform = createMockPlatform();
  });

  afterEach(function () {
    if (disposeFn) {
      disposeFn();
      disposeFn = null;
    }
  });

  function createScrollViewWithHandle(opts: {
    contentHeight: number;
    viewportHeight: number;
    horizontal?: boolean;
  }): { handle: ScrollViewHandle; scrollValues: number[]; node: GlyphisNode } {
    var handle: ScrollViewHandle | null = null;
    var scrollValues: number[] = [];
    var node: GlyphisNode | undefined;

    var style: any = { width: 390 };
    if (opts.horizontal) {
      style.width = opts.viewportHeight;
      style.height = 300;
    } else {
      style.height = opts.viewportHeight;
    }

    disposeFn = render(function () {
      node = glyphisRenderer.createComponent(ScrollView, {
        horizontal: opts.horizontal,
        style: style,
        contentHeight: opts.contentHeight,
        ref: function (h: ScrollViewHandle) { handle = h; },
        onScroll: function (offset: number) { scrollValues.push(offset); },
      });
      return node;
    }, mockPlatform);

    return { handle: handle!, scrollValues: scrollValues, node: node! };
  }

  it('drag start and move scrolls content via rubber band', async function () {
    var result = createScrollViewWithHandle({ contentHeight: 1000, viewportHeight: 300 });
    var handle = result.handle;
    var node = result.node;
    await flush();

    // Simulate drag: start at y=200, move to y=100 (finger moves up, scroll increases)
    var dragStart = node.handlers['onScrollDragStart'];
    var pointerMove = node.handlers['onPointerMove'];
    var dragEnd = node.handlers['onScrollDragEnd'];

    expect(dragStart).toBeDefined();
    expect(pointerMove).toBeDefined();
    expect(dragEnd).toBeDefined();

    dragStart(100, 200);
    pointerMove(100, 100);
    await flush();

    // Finger moved up by 100px => scroll offset increases by 100
    expect(handle.getScrollOffset()).toBe(100);

    dragEnd(100, 100);
  });

  it('rubber band applies resistance when dragging past top edge', async function () {
    var result = createScrollViewWithHandle({ contentHeight: 1000, viewportHeight: 300 });
    var handle = result.handle;
    var node = result.node;
    await flush();

    var dragStart = node.handlers['onScrollDragStart'];
    var pointerMove = node.handlers['onPointerMove'];
    var dragEnd = node.handlers['onScrollDragEnd'];

    // Start at y=200, move down to y=500 (finger moves down, raw target = 0 - 300 = -300)
    dragStart(100, 200);
    pointerMove(100, 500);
    await flush();

    var offset = handle.getScrollOffset();
    // Raw target is -300, rubber band applies 0.3 factor => -90
    expect(offset).toBeLessThan(0);
    expect(offset).toBeGreaterThan(-300);

    dragEnd(100, 500);
  });

  it('rubber band applies resistance when dragging past bottom edge', async function () {
    var result = createScrollViewWithHandle({ contentHeight: 1000, viewportHeight: 300 });
    var handle = result.handle;
    var node = result.node;
    await flush();

    // First scroll to max (700)
    handle.scrollTo(700);
    await flush();

    var dragStart = node.handlers['onScrollDragStart'];
    var pointerMove = node.handlers['onPointerMove'];
    var dragEnd = node.handlers['onScrollDragEnd'];

    // Start at y=200, move up to y=-100 (finger moves up by 300, raw target = 700 + 300 = 1000, past max 700)
    dragStart(100, 200);
    pointerMove(100, -100);
    await flush();

    var offset = handle.getScrollOffset();
    expect(offset).toBeGreaterThan(700);
    expect(offset).toBeLessThan(1000);

    dragEnd(100, -100);
  });

  it('snap back from overscroll past top edge', async function () {
    var result = createScrollViewWithHandle({ contentHeight: 1000, viewportHeight: 300 });
    var handle = result.handle;
    var node = result.node;
    await flush();

    var dragStart = node.handlers['onScrollDragStart'];
    var pointerMove = node.handlers['onPointerMove'];
    var dragEnd = node.handlers['onScrollDragEnd'];

    // Drag past top to create overscroll
    dragStart(100, 200);
    pointerMove(100, 400);
    await flush();

    expect(handle.getScrollOffset()).toBeLessThan(0);

    // Release - should snap back
    dragEnd(100, 400);

    // Wait for spring animation to settle
    await new Promise(function (r) { setTimeout(r, 800); });

    expect(Math.abs(handle.getScrollOffset())).toBeLessThan(1);
  });

  it('snap back from overscroll past bottom edge', async function () {
    var result = createScrollViewWithHandle({ contentHeight: 1000, viewportHeight: 300 });
    var handle = result.handle;
    var node = result.node;
    await flush();

    handle.scrollTo(700);
    await flush();

    var dragStart = node.handlers['onScrollDragStart'];
    var pointerMove = node.handlers['onPointerMove'];
    var dragEnd = node.handlers['onScrollDragEnd'];

    // Drag past bottom
    dragStart(100, 200);
    pointerMove(100, 50);
    await flush();

    expect(handle.getScrollOffset()).toBeGreaterThan(700);

    // Release - should snap back to max
    dragEnd(100, 50);

    await new Promise(function (r) { setTimeout(r, 800); });

    expect(Math.abs(handle.getScrollOffset() - 700)).toBeLessThan(1);
  });

  it('momentum continues after drag release with velocity', async function () {
    var result = createScrollViewWithHandle({ contentHeight: 5000, viewportHeight: 300 });
    var handle = result.handle;
    var scrollValues = result.scrollValues;
    var node = result.node;
    await flush();

    handle.scrollTo(2000);
    await flush();
    scrollValues.length = 0;

    var dragStart = node.handlers['onScrollDragStart'];
    var pointerMove = node.handlers['onPointerMove'];
    var dragEnd = node.handlers['onScrollDragEnd'];

    // Quick flick upward (finger moving up = scroll offset increases)
    dragStart(100, 300);
    await new Promise(function (r) { setTimeout(r, 16); });
    pointerMove(100, 280);
    await new Promise(function (r) { setTimeout(r, 16); });
    pointerMove(100, 250);

    var offsetBeforeRelease = handle.getScrollOffset();

    // Release
    dragEnd(100, 250);

    // Wait for momentum
    await new Promise(function (r) { setTimeout(r, 300); });

    // Momentum should have carried scroll further
    var offsetAfterMomentum = handle.getScrollOffset();
    expect(offsetAfterMomentum).not.toBe(offsetBeforeRelease);
    expect(scrollValues.length).toBeGreaterThan(0);
  });

  it('scrollTo stops active momentum', async function () {
    var result = createScrollViewWithHandle({ contentHeight: 5000, viewportHeight: 300 });
    var handle = result.handle;
    var node = result.node;
    await flush();

    handle.scrollTo(2000);
    await flush();

    var dragStart = node.handlers['onScrollDragStart'];
    var pointerMove = node.handlers['onPointerMove'];
    var dragEnd = node.handlers['onScrollDragEnd'];

    // Quick flick to start momentum
    dragStart(100, 300);
    await new Promise(function (r) { setTimeout(r, 10); });
    pointerMove(100, 200);
    dragEnd(100, 200);

    // Immediately call scrollTo to stop momentum
    handle.scrollTo(1000);
    await flush();

    // Wait to confirm no more momentum ticks
    await new Promise(function (r) { setTimeout(r, 200); });

    expect(handle.getScrollOffset()).toBe(1000);
  });

  it('velocity tracking during drag', async function () {
    var result = createScrollViewWithHandle({ contentHeight: 5000, viewportHeight: 300 });
    var handle = result.handle;
    var scrollValues = result.scrollValues;
    var node = result.node;
    await flush();

    handle.scrollTo(2000);
    await flush();
    scrollValues.length = 0;

    var dragStart = node.handlers['onScrollDragStart'];
    var pointerMove = node.handlers['onPointerMove'];
    var dragEnd = node.handlers['onScrollDragEnd'];

    dragStart(100, 300);
    await new Promise(function (r) { setTimeout(r, 16); });
    pointerMove(100, 290);
    await new Promise(function (r) { setTimeout(r, 16); });
    pointerMove(100, 280);
    await new Promise(function (r) { setTimeout(r, 16); });
    pointerMove(100, 270);
    await flush();

    // Scroll values should have been recorded
    expect(scrollValues.length).toBeGreaterThan(0);

    // Finger moved up by 30px total, scroll offset should have increased by ~30
    var lastScroll = scrollValues[scrollValues.length - 1];
    expect(lastScroll).toBeGreaterThan(2000);

    dragEnd(100, 270);
  });

  it('drag end with no significant velocity does not start momentum', async function () {
    var result = createScrollViewWithHandle({ contentHeight: 1000, viewportHeight: 300 });
    var handle = result.handle;
    var scrollValues = result.scrollValues;
    var node = result.node;
    await flush();

    var dragStart = node.handlers['onScrollDragStart'];
    var pointerMove = node.handlers['onPointerMove'];
    var dragEnd = node.handlers['onScrollDragEnd'];

    // Very slow drag (large time gap = low velocity)
    dragStart(100, 200);
    await new Promise(function (r) { setTimeout(r, 200); });
    pointerMove(100, 199);
    await new Promise(function (r) { setTimeout(r, 200); });

    var offsetAtRelease = handle.getScrollOffset();
    scrollValues.length = 0;

    dragEnd(100, 199);

    await new Promise(function (r) { setTimeout(r, 100); });

    // With very low velocity, momentum should not start (or stop immediately)
    // Offset should remain approximately the same
    var finalOffset = handle.getScrollOffset();
    expect(Math.abs(finalOffset - offsetAtRelease)).toBeLessThan(5);
  });

  it('horizontal drag uses x coordinate', async function () {
    var result = createScrollViewWithHandle({ contentHeight: 1000, viewportHeight: 200, horizontal: true });
    var handle = result.handle;
    var node = result.node;
    await flush();

    var dragStart = node.handlers['onScrollDragStart'];
    var pointerMove = node.handlers['onPointerMove'];
    var dragEnd = node.handlers['onScrollDragEnd'];

    // In horizontal mode, drag uses x coordinate
    // Start at x=200, move left to x=100 (scroll increases by 100)
    dragStart(200, 100);
    pointerMove(100, 100);
    await flush();

    expect(handle.getScrollOffset()).toBe(100);

    dragEnd(100, 100);
  });

  it('momentum negative overscroll is capped at MAX_OVERSCROLL', async function () {
    var result = createScrollViewWithHandle({ contentHeight: 1000, viewportHeight: 300 });
    var handle = result.handle;
    var scrollValues = result.scrollValues;
    var node = result.node;
    await flush();

    // Start at a small positive offset so drag end does NOT see offset < 0,
    // but momentum will push offset below 0
    handle.scrollTo(50);
    await flush();
    scrollValues.length = 0;

    var dragStart = node.handlers['onScrollDragStart'];
    var pointerMove = node.handlers['onPointerMove'];
    var dragEnd = node.handlers['onScrollDragEnd'];

    // Quick flick downward: finger moves down fast creating large negative frameVelocity
    // Start at y=100, rapidly move to y=102 then y=104 to keep offset just slightly above 0
    // but with high velocity
    dragStart(100, 100);
    // Small move that keeps offset positive but builds velocity
    await new Promise(function (r) { setTimeout(r, 1); });
    pointerMove(100, 200);

    // Now the offset might have gone slightly down from rubber band
    // Release at a point where offset is still >= 0
    // Actually we need to be smarter: the drag moves offset to 50 - (200-100) = -50
    // which triggers rubber band => ~-15. That's < 0 so snapBack triggers on dragEnd.

    // Different approach: use a bigger starting offset
    // Let me dispose and try differently
    if (disposeFn) {
      disposeFn();
      disposeFn = null;
    }

    var result2 = createScrollViewWithHandle({ contentHeight: 1000, viewportHeight: 300 });
    var handle2 = result2.handle;
    var scrollValues2 = result2.scrollValues;
    var node2 = result2.node;
    await flush();

    // Scroll to 200, then flick downward fast
    // drag: start y=100, move to y=150 => offset = 200 - 50 = 150 (still positive)
    // But velocity is high positive => frameVelocity is large negative
    handle2.scrollTo(200);
    await flush();
    scrollValues2.length = 0;

    var dragStart2 = node2.handlers['onScrollDragStart'];
    var pointerMove2 = node2.handlers['onPointerMove'];
    var dragEnd2 = node2.handlers['onScrollDragEnd'];

    dragStart2(100, 100);
    // Create high velocity with a quick move
    await new Promise(function (r) { setTimeout(r, 1); });
    pointerMove2(100, 110);
    await new Promise(function (r) { setTimeout(r, 1); });
    pointerMove2(100, 120);

    // Offset should be 200 - 20 = 180 (still positive, so momentum will start)
    // Velocity: (120-110)/1 = 10 px/ms => frameVelocity = -10*16 = -160 px/frame
    // With offset 180, first tick: 180 + (-160)*0.95 = 180 - 152 = 28
    // Second tick: 28 + (-152)*0.95 = 28 - 144.4 = -116.4 => capped at -100
    dragEnd2(100, 120);

    await new Promise(function (r) { setTimeout(r, 800); });

    // Check that negative overscroll was capped
    var minObserved = 0;
    for (var i = 0; i < scrollValues2.length; i++) {
      if (scrollValues2[i] < minObserved) {
        minObserved = scrollValues2[i];
      }
    }
    // Should have gone negative but not below -100
    expect(minObserved).toBeGreaterThanOrEqual(-100);
    expect(minObserved).toBeLessThan(0);
  });

  it('momentum overscroll is capped at MAX_OVERSCROLL', async function () {
    var result = createScrollViewWithHandle({ contentHeight: 500, viewportHeight: 300 });
    var handle = result.handle;
    var scrollValues = result.scrollValues;
    var node = result.node;
    await flush();

    // maxScroll = 200. Scroll to max.
    handle.scrollTo(200);
    await flush();

    var dragStart = node.handlers['onScrollDragStart'];
    var pointerMove = node.handlers['onPointerMove'];
    var dragEnd = node.handlers['onScrollDragEnd'];

    // Very fast flick upward to create high velocity
    dragStart(100, 300);
    await new Promise(function (r) { setTimeout(r, 5); });
    pointerMove(100, 100);

    dragEnd(100, 100);

    // Wait for momentum to run
    await new Promise(function (r) { setTimeout(r, 500); });

    // After momentum and snap back, should end at max (200) or 0
    // Check that during momentum we never exceeded max + 100 (MAX_OVERSCROLL)
    var maxObserved = 0;
    for (var i = 0; i < scrollValues.length; i++) {
      if (scrollValues[i] > maxObserved) {
        maxObserved = scrollValues[i];
      }
    }
    // MAX_OVERSCROLL is 100, so max observed should be at most 300 (200 + 100)
    expect(maxObserved).toBeLessThanOrEqual(300);
  });
});
