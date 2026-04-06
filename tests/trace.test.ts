import { describe, it, expect, beforeEach } from 'bun:test';
import {
  enableTracing,
  disableTracing,
  isTracingEnabled,
  beginSpan,
  endSpan,
  traceSync,
  flushTraceEvents,
  getTraceEvents,
  clearTraceEvents,
} from '../src/trace';

describe('trace', function () {
  beforeEach(function () {
    disableTracing();
    clearTraceEvents();
  });

  it('disabled by default', function () {
    expect(isTracingEnabled()).toBe(false);
  });

  it('enableTracing/disableTracing toggles isTracingEnabled', function () {
    enableTracing();
    expect(isTracingEnabled()).toBe(true);
    disableTracing();
    expect(isTracingEnabled()).toBe(false);
  });

  it('beginSpan returns NOP_HANDLE when disabled', function () {
    const handle = beginSpan('test', 'cat');
    expect(handle._index).toBe(-1);
  });

  it('endSpan is noop with NOP_HANDLE', function () {
    const handle = beginSpan('test', 'cat');
    endSpan(handle);
    expect(getTraceEvents().length).toBe(0);
  });

  it('beginSpan/endSpan records B/E events with correct name/cat/ph', function () {
    enableTracing();
    const handle = beginSpan('mySpan', 'myCategory');
    endSpan(handle);

    const events = getTraceEvents();
    expect(events.length).toBe(2);

    expect(events[0].name).toBe('mySpan');
    expect(events[0].cat).toBe('myCategory');
    expect(events[0].ph).toBe('B');

    expect(events[1].name).toBe('mySpan');
    expect(events[1].cat).toBe('myCategory');
    expect(events[1].ph).toBe('E');
  });

  it('nested spans ordering', function () {
    enableTracing();
    const outer = beginSpan('outer', 'cat');
    const inner = beginSpan('inner', 'cat');
    endSpan(inner);
    endSpan(outer);

    const events = getTraceEvents();
    expect(events.length).toBe(4);

    expect(events[0].name).toBe('outer');
    expect(events[0].ph).toBe('B');
    expect(events[1].name).toBe('inner');
    expect(events[1].ph).toBe('B');
    expect(events[2].name).toBe('inner');
    expect(events[2].ph).toBe('E');
    expect(events[3].name).toBe('outer');
    expect(events[3].ph).toBe('E');
  });

  it('args on begin', function () {
    enableTracing();
    const handle = beginSpan('test', 'cat', { key: 'value' });
    endSpan(handle);

    const events = getTraceEvents();
    expect(events[0].args).toEqual({ key: 'value' });
  });

  it('args on end', function () {
    enableTracing();
    const handle = beginSpan('test', 'cat');
    endSpan(handle, { result: 42 });

    const events = getTraceEvents();
    expect(events[0].args).toBeUndefined();
    expect(events[1].args).toEqual({ result: 42 });
  });

  it('flushTraceEvents returns Chrome Trace Event Format JSON', function () {
    enableTracing();
    const handle = beginSpan('flush-test', 'cat');
    endSpan(handle);

    const json = flushTraceEvents();
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty('traceEvents');
    expect(Array.isArray(parsed.traceEvents)).toBe(true);
    expect(parsed.traceEvents.length).toBe(2);
    expect(parsed.traceEvents[0].ph).toBe('B');
    expect(parsed.traceEvents[1].ph).toBe('E');
  });

  it('flushTraceEvents clears buffer', function () {
    enableTracing();
    const handle = beginSpan('test', 'cat');
    endSpan(handle);

    flushTraceEvents();
    expect(getTraceEvents().length).toBe(0);
  });

  it('clearTraceEvents clears without returning', function () {
    enableTracing();
    const handle = beginSpan('test', 'cat');
    endSpan(handle);
    expect(getTraceEvents().length).toBe(2);

    const result = clearTraceEvents();
    expect(result).toBeUndefined();
    expect(getTraceEvents().length).toBe(0);
  });

  it('traceSync executes function and returns result when disabled', function () {
    const result = traceSync('test', 'cat', function () {
      return 123;
    });
    expect(result).toBe(123);
    expect(getTraceEvents().length).toBe(0);
  });

  it('traceSync records span and returns value when enabled', function () {
    enableTracing();
    const result = traceSync('syncOp', 'cat', function () {
      return 'hello';
    });

    expect(result).toBe('hello');
    const events = getTraceEvents();
    expect(events.length).toBe(2);
    expect(events[0].name).toBe('syncOp');
    expect(events[0].ph).toBe('B');
    expect(events[1].name).toBe('syncOp');
    expect(events[1].ph).toBe('E');
  });

  it('traceSync closes span on exception', function () {
    enableTracing();
    const error = new Error('boom');

    expect(function () {
      traceSync('failing', 'cat', function () {
        throw error;
      });
    }).toThrow(error);

    const events = getTraceEvents();
    expect(events.length).toBe(2);
    expect(events[0].name).toBe('failing');
    expect(events[0].ph).toBe('B');
    expect(events[1].name).toBe('failing');
    expect(events[1].ph).toBe('E');
  });

  it('disable stops new spans but endSpan still records for already-started spans', function () {
    enableTracing();
    const handleA = beginSpan('A', 'cat');

    disableTracing();
    const handleB = beginSpan('B', 'cat');
    endSpan(handleB);
    endSpan(handleA);

    const events = getTraceEvents();
    // Span A begin was recorded while enabled
    // Span B begin was NOT recorded (disabled at that point), returns NOP_HANDLE
    // endSpan(handleB) is noop because handleB._index === -1
    // endSpan(handleA) DOES record because it checks handle._index, not _enabled
    expect(events.length).toBe(2);
    expect(events[0].name).toBe('A');
    expect(events[0].ph).toBe('B');
    expect(events[1].name).toBe('A');
    expect(events[1].ph).toBe('E');
  });

  it('multiple flush cycles are independent', function () {
    enableTracing();

    const h1 = beginSpan('first', 'cat');
    endSpan(h1);
    const json1 = flushTraceEvents();
    const parsed1 = JSON.parse(json1);

    const h2 = beginSpan('second', 'cat');
    endSpan(h2);
    const json2 = flushTraceEvents();
    const parsed2 = JSON.parse(json2);

    expect(parsed1.traceEvents.length).toBe(2);
    expect(parsed1.traceEvents[0].name).toBe('first');
    expect(parsed1.traceEvents[1].name).toBe('first');

    expect(parsed2.traceEvents.length).toBe(2);
    expect(parsed2.traceEvents[0].name).toBe('second');
    expect(parsed2.traceEvents[1].name).toBe('second');
  });

  it('endSpan with stale handle after clearTraceEvents is safe no-op', function () {
    enableTracing();
    const handle = beginSpan('stale', 'cat');
    clearTraceEvents();

    // handle._index is 0, but _events was cleared, so _events[0] is undefined.
    // endSpan should silently bail out, not crash.
    endSpan(handle);
    expect(getTraceEvents().length).toBe(0);
  });

  it('high-volume span recording', function () {
    enableTracing();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      const h = beginSpan('span-' + i, 'load');
      endSpan(h);
    }

    const events = getTraceEvents();
    expect(events.length).toBe(count * 2);

    for (let i = 0; i < count; i++) {
      const b = events[i * 2];
      const e = events[i * 2 + 1];
      expect(b.ph).toBe('B');
      expect(e.ph).toBe('E');
      expect(b.name).toBe('span-' + i);
      expect(e.name).toBe('span-' + i);
    }
  });

  it('category defaults to default when omitted', function () {
    enableTracing();
    const handle = beginSpan('no-cat');
    endSpan(handle);

    const events = getTraceEvents();
    expect(events[0].cat).toBe('default');
    expect(events[1].cat).toBe('default');
  });

  it('B timestamp <= E timestamp', function () {
    enableTracing();
    const handle = beginSpan('timed', 'cat');
    // Busy loop to ensure some time passes
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      sum += i;
    }
    endSpan(handle);

    const events = getTraceEvents();
    expect(events[1].ts).toBeGreaterThanOrEqual(events[0].ts);
  });
});
