import type { Fiber, Hook, RefObject } from './types';

let currentFiber: Fiber | null = null;
let scheduleUpdate: ((fiber: Fiber) => void) | null = null;

export function setCurrentFiber(fiber: Fiber | null): void {
  currentFiber = fiber;
}

export function getCurrentFiber(): Fiber | null {
  return currentFiber;
}

export function setScheduleUpdate(fn: (fiber: Fiber) => void): void {
  scheduleUpdate = fn;
}

function getHook(tag: HookTag): Hook {
  if (!currentFiber) {
    throw new Error('Hooks can only be called inside a component function');
  }

  const fiber = currentFiber;
  const index = fiber.hookIndex;
  const alternate = fiber.alternate;

  let hook: Hook;
  if (alternate && index < alternate.hooks.length) {
    // Re-render: clone from alternate
    hook = alternate.hooks[index];
  } else {
    // First render: create new hook
    hook = { tag, state: undefined, queue: [] };
  }

  // Ensure hooks array has space
  if (index >= fiber.hooks.length) {
    fiber.hooks.push(hook);
  } else {
    fiber.hooks[index] = hook;
  }

  fiber.hookIndex++;
  return hook;
}

type HookTag = 'state' | 'effect' | 'memo' | 'callback' | 'ref' | 'context';

function depsChanged(prevDeps: any[] | undefined, nextDeps: any[] | undefined): boolean {
  if (prevDeps === undefined || nextDeps === undefined) return true;
  if (prevDeps.length !== nextDeps.length) return true;
  for (let i = 0; i < prevDeps.length; i++) {
    if (!Object.is(prevDeps[i], nextDeps[i])) return true;
  }
  return false;
}

export function useState<T>(initialValue: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void] {
  const fiber = currentFiber!;
  const hook = getHook('state');

  // On first render, initialize state
  if (!fiber.alternate || fiber.alternate.hooks.length <= fiber.hookIndex - 1) {
    hook.state = typeof initialValue === 'function'
      ? (initialValue as () => T)()
      : initialValue;
  }

  // Process queued state updates
  for (const action of hook.queue) {
    hook.state = typeof action === 'function'
      ? (action as (prev: T) => T)(hook.state)
      : action;
  }
  hook.queue = [];

  const setState = (value: T | ((prev: T) => T)): void => {
    hook.queue.push(value);
    if (scheduleUpdate) {
      scheduleUpdate(fiber);
    }
  };

  return [hook.state as T, setState];
}

export function useEffect(callback: () => (void | (() => void)), deps?: any[]): void {
  const hook = getHook('effect');

  const hasChanged = depsChanged(hook.deps, deps);

  if (hasChanged) {
    hook.state = callback;
    hook.deps = deps;
  } else {
    // Deps unchanged: clear state so the effect does not re-run
    hook.state = null;
  }
  hook.tag = 'effect';
}

export function useMemo<T>(factory: () => T, deps: any[]): T {
  const hook = getHook('memo');
  const fiber = currentFiber!;

  const hasChanged = depsChanged(hook.deps, deps);

  if (hasChanged) {
    hook.state = factory();
    hook.deps = deps;
  }

  return hook.state as T;
}

export function useCallback<T extends Function>(callback: T, deps: any[]): T {
  return useMemo(() => callback, deps);
}

export function useRef<T>(initialValue: T): RefObject<T> {
  return useMemo(() => ({ current: initialValue }), []);
}

// --- Context ---

export interface Context<T> {
  _defaultValue: T;
  _currentValue: T;
  Provider: (props: { value: T; children?: any }) => any;
}

export function createContext<T>(defaultValue: T): Context<T> {
  const context: Context<T> = {
    _defaultValue: defaultValue,
    _currentValue: defaultValue,
    Provider: (props: { value: T; children?: any }) => {
      context._currentValue = props.value;
      return props.children;
    },
  };

  return context;
}

export function useContext<T>(context: Context<T>): T {
  const hook = getHook('context');
  hook.state = context._currentValue;
  return hook.state as T;
}
