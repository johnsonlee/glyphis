import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { render, glyphisRenderer, View, Text, RecyclerList } from '../src';
import { createSignal, batch } from 'solid-js';
import { generateCommands } from '../src/commands';
import { applyStyle } from '../src/styles';
import { hitTest } from '../src/events';
import { createGlyphisNode } from '../src/node';
import Yoga, { Direction } from 'yoga-layout';
import type { Platform, RenderCommand, InputEvent, Style } from '../src';
import type { GlyphisNode } from '../src/node';
import type { RecyclerListHandle } from '../src';

function createMockPlatform(): Platform {
  return {
    measureText: function () { return { width: 50, height: 16 }; },
    render: function () {},
    getViewport: function () { return { width: 390, height: 844 }; },
    onInput: function () {},
  };
}

function flush(): Promise<void> {
  return new Promise(function (resolve) { setTimeout(resolve, 20); });
}

function logBench(name: string, ms: number, threshold: number): void {
  console.log('[bench] ' + name + ': ' + ms.toFixed(2) + 'ms (threshold: ' + threshold + 'ms)');
}

describe('Benchmarks', function () {
  var dispose: (() => void) | null = null;
  var platform: Platform;

  beforeEach(function () {
    platform = createMockPlatform();
  });

  afterEach(function () {
    if (dispose) { dispose(); dispose = null; }
  });

  // -- 1. Node creation throughput --

  it('node creation: 1000 View+Text in < 100ms', async function () {
    var threshold = 100;
    var t0 = performance.now();
    dispose = render(function () {
      var children: any[] = [];
      for (var i = 0; i < 1000; i++) {
        children.push(
          glyphisRenderer.createComponent(View, {
            style: { height: 30, flexDirection: 'row' as const },
            children: glyphisRenderer.createComponent(Text, {
              style: { color: '#000', fontSize: 14 },
              children: 'Row ' + i,
            }),
          })
        );
      }
      return glyphisRenderer.createComponent(View, {
        style: { flex: 1 },
        children: children,
      });
    }, platform);
    await flush();
    var elapsed = performance.now() - t0;
    logBench('1K nodes', elapsed, threshold);
    expect(elapsed).toBeLessThan(threshold);
  });

  // -- 2. Signal update throughput --

  it('signal updates: 1000 batch updates in < 20ms', async function () {
    var threshold = 20;
    var signals: Array<[() => number, (v: number) => void]> = [];
    for (var i = 0; i < 1000; i++) {
      var sig = createSignal(0);
      signals.push([sig[0], sig[1]]);
    }

    var t0 = performance.now();
    batch(function () {
      for (var j = 0; j < signals.length; j++) {
        signals[j][1](j + 1);
      }
    });
    var elapsed = performance.now() - t0;
    logBench('1K signal updates', elapsed, threshold);
    expect(elapsed).toBeLessThan(threshold);
  });

  // -- 3. RecyclerList creation with 10K data --

  it('RecyclerList: create with 10K items in < 100ms', async function () {
    var threshold = 100;
    var data: Array<{ id: number; label: string }> = [];
    for (var i = 0; i < 10000; i++) {
      data.push({ id: i, label: 'Item ' + i });
    }

    var t0 = performance.now();
    dispose = render(function () {
      return glyphisRenderer.createComponent(RecyclerList, {
        data: data,
        itemHeight: 44,
        style: { height: 600, width: 390 } as Style,
        renderItem: function (getItem: () => any, getIndex: () => number) {
          return glyphisRenderer.createComponent(View, {
            get style() {
              return { height: 44, flexDirection: 'row' as const };
            },
            get children() {
              var item = getItem();
              return glyphisRenderer.createComponent(Text, {
                style: { fontSize: 14, color: '#000' },
                children: item ? item.label : '',
              });
            },
          });
        },
      });
    }, platform);
    await flush();
    var elapsed = performance.now() - t0;
    logBench('RecyclerList 10K create', elapsed, threshold);
    expect(elapsed).toBeLessThan(threshold);
  });

  // -- 4. Render command generation --

  it('commands: generate for 100 styled nodes in < 10ms', async function () {
    var threshold = 10;
    var commandCount = 0;
    var capturedPlatform: Platform = {
      measureText: function () { return { width: 50, height: 16 }; },
      render: function (commands: RenderCommand[]) { commandCount = commands.length; },
      getViewport: function () { return { width: 390, height: 844 }; },
      onInput: function () {},
    };

    dispose = render(function () {
      var children: any[] = [];
      for (var i = 0; i < 100; i++) {
        children.push(
          glyphisRenderer.createComponent(View, {
            style: {
              height: 30,
              width: 390,
              backgroundColor: '#FF0000',
              borderWidth: 1,
              borderColor: '#000',
              padding: 4,
              margin: 2,
            },
            children: glyphisRenderer.createComponent(Text, {
              style: { color: '#000', fontSize: 14 },
              children: 'Item ' + i,
            }),
          })
        );
      }
      return glyphisRenderer.createComponent(View, {
        style: { flex: 1 },
        children: children,
      });
    }, capturedPlatform);
    await flush();

    // Build the tree manually for isolated command timing
    var root = createGlyphisNode(Yoga.Node.create(), '__root');
    root.yoga.setWidth(390);
    root.yoga.setHeight(844);
    for (var i = 0; i < 100; i++) {
      var child = createGlyphisNode(Yoga.Node.create(), 'view');
      child.style = {
        height: 30,
        width: 390,
        backgroundColor: '#FF0000',
        borderWidth: 1,
        borderColor: '#000',
      };
      applyStyle(child.yoga, child.style);
      root.children.push(child);
      root.yoga.insertChild(child.yoga, i);
      child.parent = root;
    }
    root.yoga.calculateLayout(390, 844, Direction.LTR);

    var t0 = performance.now();
    var cmds = generateCommands(root);
    var elapsed = performance.now() - t0;

    root.yoga.freeRecursive();

    logBench('100-node command gen', elapsed, threshold);
    expect(cmds.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(threshold);
  });

  // -- 5. Layout calculation --

  it('layout: calculate for 100 nodes in < 20ms', async function () {
    var threshold = 20;
    var root = Yoga.Node.create();
    root.setWidth(390);
    root.setHeight(844);
    root.setFlexDirection(0); // Column

    for (var i = 0; i < 100; i++) {
      var child = Yoga.Node.create();
      child.setHeight(30);
      child.setWidth(390);
      child.setMargin(3 /* Edge.All */, 2);
      child.setPadding(3 /* Edge.All */, 4);
      root.insertChild(child, i);
    }

    var t0 = performance.now();
    root.calculateLayout(390, 844, Direction.LTR);
    var elapsed = performance.now() - t0;

    // Verify layout was computed
    var firstChild = root.getChild(0);
    expect(firstChild.getComputedHeight()).toBe(30);

    root.freeRecursive();

    logBench('100-node layout', elapsed, threshold);
    expect(elapsed).toBeLessThan(threshold);
  });

  // -- 6. Style application --

  it('style: apply 10-prop style to 1000 nodes in < 40ms', async function () {
    var threshold = 40;
    var nodes: any[] = [];
    for (var i = 0; i < 1000; i++) {
      nodes.push(Yoga.Node.create());
    }

    var style: Style = {
      height: 30,
      width: 200,
      flexDirection: 'row' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 8,
      margin: 4,
      borderWidth: 1,
      backgroundColor: '#FF0000',
      opacity: 0.9,
    };

    var t0 = performance.now();
    for (var j = 0; j < nodes.length; j++) {
      applyStyle(nodes[j], style);
    }
    var elapsed = performance.now() - t0;

    for (var k = 0; k < nodes.length; k++) {
      nodes[k].free();
    }

    logBench('1K style apply', elapsed, threshold);
    expect(elapsed).toBeLessThan(threshold);
  });

  // -- 7. RecyclerList scroll (slot rebinding) --

  it('RecyclerList: scroll 10 pages in < 10ms avg per page', async function () {
    var threshold = 10;
    var data: Array<{ id: number; label: string }> = [];
    for (var i = 0; i < 10000; i++) {
      data.push({ id: i, label: 'Item ' + i });
    }

    var handle: RecyclerListHandle | null = null;

    dispose = render(function () {
      return glyphisRenderer.createComponent(RecyclerList, {
        data: data,
        itemHeight: 44,
        style: { height: 600, width: 390 } as Style,
        ref: function (h: RecyclerListHandle) { handle = h; },
        renderItem: function (getItem: () => any, getIndex: () => number) {
          return glyphisRenderer.createComponent(View, {
            get style() {
              return { height: 44 };
            },
            get children() {
              var item = getItem();
              return glyphisRenderer.createComponent(Text, {
                style: { fontSize: 14, color: '#000' },
                children: item ? item.label : '',
              });
            },
          });
        },
      });
    }, platform);
    await flush();

    expect(handle).not.toBeNull();

    var totalTime = 0;
    var pages = 10;
    for (var p = 0; p < pages; p++) {
      var t0 = performance.now();
      handle!.pageDown();
      totalTime = totalTime + (performance.now() - t0);
    }
    var avgPerPage = totalTime / pages;

    logBench('RecyclerList scroll avg/page', avgPerPage, threshold);
    expect(avgPerPage).toBeLessThan(threshold);
  });

  // -- 8. Tree walk (hit testing) --

  it('hit test: 100-node tree 1000 times in < 2ms avg', async function () {
    var threshold = 2;

    // Build a nested tree: root -> 10 children -> 10 grandchildren each = 100 leaf nodes
    var root = createGlyphisNode(Yoga.Node.create(), '__root');
    root.yoga.setWidth(390);
    root.yoga.setHeight(844);

    for (var i = 0; i < 10; i++) {
      var group = createGlyphisNode(Yoga.Node.create(), 'view');
      group.yoga.setHeight(80);
      group.yoga.setWidth(390);
      applyStyle(group.yoga, { height: 80, width: 390, flexDirection: 'row' as const });
      root.children.push(group);
      root.yoga.insertChild(group.yoga, i);
      group.parent = root;

      // Some nodes get press handlers so hitTest returns them
      group.handlers.onPress = function () {};

      for (var j = 0; j < 10; j++) {
        var leaf = createGlyphisNode(Yoga.Node.create(), 'view');
        leaf.yoga.setHeight(80);
        leaf.yoga.setWidth(39);
        applyStyle(leaf.yoga, { height: 80, width: 39 });
        group.children.push(leaf);
        group.yoga.insertChild(leaf.yoga, j);
        leaf.parent = group;

        if (j % 3 === 0) {
          leaf.handlers.onPress = function () {};
        }
      }
    }

    root.yoga.calculateLayout(390, 844, Direction.LTR);

    var iterations = 1000;
    var t0 = performance.now();
    for (var k = 0; k < iterations; k++) {
      // Test various coordinates across the viewport
      var testX = (k * 37) % 390;
      var testY = (k * 73) % 800;
      hitTest(root, testX, testY);
    }
    var elapsed = performance.now() - t0;
    var avgPerHit = elapsed / iterations;

    root.yoga.freeRecursive();

    logBench('hit test avg (1K runs)', avgPerHit, threshold);
    // Assert total time for 1000 hit tests is reasonable
    // Each hit test should be well under 1ms; total under 50ms
    expect(elapsed).toBeLessThan(50);
  });
});
