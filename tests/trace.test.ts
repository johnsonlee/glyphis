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

  it('beginSpan/endSpan records events when enabled', function () {
    enableTracing();
    const handle = beginSpan('mySpan', 'myCategory');
    endSpan(handle);

    const events = getTraceEvents();
    expect(events.length).toBe(2);

    expect(events[0].name).toBe('mySpan');
    expect(events[0].cat).toBe('myCategory');
    expect(events[0].ph).toBe('B');
    expect(events[0].ts).toBeGreaterThan(0);

    expect(events[1].name).toBe('mySpan');
    expect(events[1].cat).toBe('myCategory');
    expect(events[1].ph).toBe('E');
    expect(events[1].ts).toBeGreaterThanOrEqual(events[0].ts);
  });

  it('nested spans', function () {
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

  it('args passed to beginSpan', function () {
    enableTracing();
    const handle = beginSpan('test', 'cat', { key: 'value' });
    endSpan(handle);

    const events = getTraceEvents();
    expect(events[0].args).toEqual({ key: 'value' });
  });

  it('args passed to endSpan', function () {
    enableTracing();
    const handle = beginSpan('test', 'cat');
    endSpan(handle, { result: 42 });

    const events = getTraceEvents();
    expect(events[0].args).toBeUndefined();
    expect(events[1].args).toEqual({ result: 42 });
  });

  it('traceSync executes function and returns result when disabled', function () {
    const result = traceSync('test', 'cat', function () {
      return 123;
    });
    expect(result).toBe(123);
    expect(getTraceEvents().length).toBe(0);
  });

  it('traceSync records span when enabled', function () {
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

  it('ts is in microseconds', function () {
    enableTracing();
    const handle = beginSpan('test', 'cat');
    endSpan(handle);

    const events = getTraceEvents();
    // performance.now() returns ms; ts = performance.now() * 1000 => microseconds
    // A reasonable ts should be well above 1000 (i.e. at least 1ms of process uptime)
    expect(events[0].ts).toBeGreaterThan(0);
    expect(events[0].ts).toBeGreaterThan(1000);
  });

  it('events have pid and tid', function () {
    enableTracing();
    const handle = beginSpan('test', 'cat');
    endSpan(handle);

    const events = getTraceEvents();
    for (const event of events) {
      expect(event.pid).toBe(1);
      expect(event.tid).toBe(1);
    }
  });
});
