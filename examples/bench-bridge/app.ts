import { render, View, Text, Button, createWebPlatform, createSignal, glyphisRenderer } from '../../src';
import type { Style } from '../../src';

// Bridge micro-benchmark: measures the cost of individual JS→native calls
// Runs on all platforms (web uses yoga-layout WASM, native uses yoga-native bridge)

import Yoga from 'yoga-layout';

function App() {
  var resultsSignal = createSignal<string[]>([]);
  var results = resultsSignal[0];
  var setResults = resultsSignal[1];
  var runningSignal = createSignal(false);
  var running = runningSignal[0];
  var setRunning = runningSignal[1];

  function addResult(line: string) {
    setResults(function(prev: string[]) { return prev.concat([line]); });
  }

  function clearResults() {
    setResults([]);
  }

  function runBenchmark() {
    setRunning(true);
    clearResults();

    // Use setTimeout to let UI update before blocking
    setTimeout(function() {
      var N = 100000;
      var node = Yoga.Node.create();
      var child = Yoga.Node.create();

      // 1. Node creation
      var t0 = performance.now();
      var nodes: any[] = [];
      for (var i = 0; i < N; i++) {
        nodes.push(Yoga.Node.create());
      }
      var t1 = performance.now();
      addResult('Node.create x' + N + ': ' + (t1 - t0).toFixed(1) + 'ms (' + ((t1 - t0) / N * 1000).toFixed(2) + 'us/call)');

      // 2. Style setter (setWidth)
      t0 = performance.now();
      for (var i = 0; i < N; i++) {
        node.setWidth(i % 1000);
      }
      t1 = performance.now();
      addResult('setWidth x' + N + ': ' + (t1 - t0).toFixed(1) + 'ms (' + ((t1 - t0) / N * 1000).toFixed(2) + 'us/call)');

      // 3. Style setter (setFlexDirection)
      t0 = performance.now();
      for (var i = 0; i < N; i++) {
        node.setFlexDirection(i % 4);
      }
      t1 = performance.now();
      addResult('setFlexDirection x' + N + ': ' + (t1 - t0).toFixed(1) + 'ms (' + ((t1 - t0) / N * 1000).toFixed(2) + 'us/call)');

      // 4. Edge-based setter (setPadding)
      t0 = performance.now();
      for (var i = 0; i < N; i++) {
        node.setPadding(i % 9, i % 100);
      }
      t1 = performance.now();
      addResult('setPadding x' + N + ': ' + (t1 - t0).toFixed(1) + 'ms (' + ((t1 - t0) / N * 1000).toFixed(2) + 'us/call)');

      // 5. insertChild + removeChild
      var M = 10000;
      t0 = performance.now();
      for (var i = 0; i < M; i++) {
        node.insertChild(child, 0);
        node.removeChild(child);
      }
      t1 = performance.now();
      addResult('insert+remove x' + M + ': ' + (t1 - t0).toFixed(1) + 'ms (' + ((t1 - t0) / M * 1000).toFixed(2) + 'us/pair)');

      // 6. calculateLayout (single node)
      node.setWidth(100);
      node.setHeight(50);
      t0 = performance.now();
      for (var i = 0; i < M; i++) {
        node.calculateLayout(100, 50);
      }
      t1 = performance.now();
      addResult('calculateLayout(1 node) x' + M + ': ' + (t1 - t0).toFixed(1) + 'ms (' + ((t1 - t0) / M * 1000).toFixed(2) + 'us/call)');

      // 7. getComputedLayout
      t0 = performance.now();
      for (var i = 0; i < N; i++) {
        node.getComputedLayout();
      }
      t1 = performance.now();
      addResult('getComputedLayout x' + N + ': ' + (t1 - t0).toFixed(1) + 'ms (' + ((t1 - t0) / N * 1000).toFixed(2) + 'us/call)');

      // 8. calculateLayout (100 children)
      var parent = Yoga.Node.create();
      parent.setWidth(390);
      parent.setHeight(844);
      parent.setFlexDirection(0); // column
      var kids: any[] = [];
      for (var i = 0; i < 100; i++) {
        var k = Yoga.Node.create();
        k.setHeight(30);
        parent.insertChild(k, i);
        kids.push(k);
      }
      t0 = performance.now();
      for (var i = 0; i < 1000; i++) {
        parent.calculateLayout(390, 844);
      }
      t1 = performance.now();
      addResult('calculateLayout(100 children) x1000: ' + (t1 - t0).toFixed(1) + 'ms (' + ((t1 - t0) / 1000 * 1000).toFixed(2) + 'us/call)');

      // Cleanup
      for (var i = 0; i < kids.length; i++) {
        parent.removeChild(kids[i]);
        kids[i].free();
      }
      parent.free();
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].free();
      }
      node.free();
      child.free();

      addResult('--- Done ---');
      setRunning(false);
    }, 50);
  }

  // UI
  var header = glyphisRenderer.createComponent(View, {
    style: {
      backgroundColor: '#1a1a2e',
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    } as Style,
    children: [
      glyphisRenderer.createComponent(Text, {
        style: { color: '#fff', fontSize: 18, fontWeight: '700' } as Style,
        children: 'Bridge Micro-Benchmark',
      }),
      glyphisRenderer.createComponent(Button, {
        get title() { return running() ? 'Running...' : 'Run'; },
        onPress: runBenchmark,
        get disabled() { return running(); },
        color: '#533483',
      }),
    ],
  });

  var resultsList = glyphisRenderer.createComponent(View, {
    style: { flex: 1, padding: 16 } as Style,
    get children() {
      var lines = results();
      if (lines.length === 0) {
        return glyphisRenderer.createComponent(Text, {
          style: { color: '#666', fontSize: 14 } as Style,
          children: 'Press Run to start benchmark',
        });
      }
      return lines.map(function(line: string, i: number) {
        var isSeparator = line.indexOf('---') === 0;
        return glyphisRenderer.createComponent(Text, {
          style: {
            color: isSeparator ? '#666' : '#eee',
            fontSize: 13,
            fontFamily: 'monospace',
            paddingVertical: 3,
          } as Style,
          children: line,
        });
      });
    },
  });

  return glyphisRenderer.createComponent(View, {
    style: { flex: 1, backgroundColor: '#0f0f23' } as Style,
    children: [header, resultsList],
  });
}

// Bootstrap
var canvas = document.getElementById('glyphis-root') as HTMLCanvasElement;
if (canvas) {
  var platform = createWebPlatform(canvas);
  render(function() { return glyphisRenderer.createComponent(App, {}); }, platform);
}
