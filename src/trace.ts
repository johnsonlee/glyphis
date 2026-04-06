export interface SpanHandle {
  readonly _index: number;
}

export interface TraceEvent {
  name: string;
  cat: string;
  ph: 'B' | 'E';
  ts: number;
  pid: number;
  tid: number;
  args?: Record<string, unknown>;
}

let _enabled = false;
const _events: TraceEvent[] = [];
const NOP_HANDLE: SpanHandle = { _index: -1 };

function _now(): number {
  return performance.now() * 1000;
}

export function enableTracing(): void {
  _enabled = true;
}

export function disableTracing(): void {
  _enabled = false;
}

export function isTracingEnabled(): boolean {
  return _enabled;
}

export function beginSpan(name: string, category?: string, args?: Record<string, unknown>): SpanHandle {
  if (!_enabled) return NOP_HANDLE;
  const index = _events.length;
  const event: TraceEvent = {
    name,
    cat: category || 'default',
    ph: 'B',
    ts: _now(),
    pid: 1,
    tid: 1,
  };
  if (args) event.args = args;
  _events.push(event);
  return { _index: index };
}

export function endSpan(handle: SpanHandle, args?: Record<string, unknown>): void {
  if (handle._index === -1) return;
  const begin = _events[handle._index];
  if (!begin) return;
  const event: TraceEvent = {
    name: begin.name,
    cat: begin.cat,
    ph: 'E',
    ts: _now(),
    pid: 1,
    tid: 1,
  };
  if (args) event.args = args;
  _events.push(event);
}

export function traceSync<T>(name: string, category: string, fn: () => T): T {
  if (!_enabled) return fn();
  const handle = beginSpan(name, category);
  try {
    return fn();
  } finally {
    endSpan(handle);
  }
}

export function flushTraceEvents(): string {
  const json = JSON.stringify({ traceEvents: _events });
  _events.length = 0;
  return json;
}

export function getTraceEvents(): readonly TraceEvent[] {
  return _events;
}

export function clearTraceEvents(): void {
  _events.length = 0;
}
