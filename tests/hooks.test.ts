import { describe, it, expect, beforeEach } from 'bun:test';
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useContext,
  createContext,
  setCurrentFiber,
  getCurrentFiber,
  setScheduleUpdate,
} from '../src/hooks';
import type { Fiber } from '../src/types';

function createMockFiber(alternate?: Fiber): Fiber {
  return {
    tag: 'component',
    type: () => null,
    props: { children: [] },
    key: null,
    parent: null,
    child: null,
    sibling: null,
    alternate: alternate ?? null,
    stateNode: null,
    effects: [],
    hooks: [],
    hookIndex: 0,
  };
}

/**
 * Helper to call a hook function within a mock fiber context.
 * Returns the result and a rerender function that replays the hook
 * against a new fiber linked to the previous one via alternate.
 */
function renderHook<T>(hookFn: () => T): {
  result: { current: T };
  rerender: () => void;
  fiber: Fiber;
} {
  let fiber = createMockFiber();
  const result = { current: undefined as T };

  function run() {
    const newFiber = createMockFiber(fiber);
    newFiber.hooks = [];
    setCurrentFiber(newFiber);
    result.current = hookFn();
    setCurrentFiber(null);
    fiber = newFiber;
  }

  // First render
  setCurrentFiber(fiber);
  result.current = hookFn();
  setCurrentFiber(null);

  return {
    result,
    rerender: run,
    fiber,
  };
}

describe('hooks', () => {
  let scheduledFibers: Fiber[];

  beforeEach(() => {
    scheduledFibers = [];
    setScheduleUpdate((fiber: Fiber) => {
      scheduledFibers.push(fiber);
    });
  });

  describe('setCurrentFiber / getCurrentFiber', () => {
    it('sets and gets the current fiber', () => {
      const fiber = createMockFiber();
      setCurrentFiber(fiber);
      expect(getCurrentFiber()).toBe(fiber);
      setCurrentFiber(null);
      expect(getCurrentFiber()).toBeNull();
    });
  });

  describe('useState', () => {
    it('returns initial value (direct)', () => {
      const { result } = renderHook(() => useState(42));
      expect(result.current[0]).toBe(42);
    });

    it('returns initial value (factory function)', () => {
      const { result } = renderHook(() => useState(() => 'hello'));
      expect(result.current[0]).toBe('hello');
    });

    it('factory function is only called on first render', () => {
      let callCount = 0;
      const { result, rerender } = renderHook(() =>
        useState(() => {
          callCount++;
          return 10;
        }),
      );
      expect(callCount).toBe(1);
      expect(result.current[0]).toBe(10);

      rerender();
      // Factory should not be called again on re-render
      expect(callCount).toBe(1);
    });

    it('setState updates state on next render', () => {
      const { result, rerender } = renderHook(() => useState(0));

      const [, setState] = result.current;
      setState(5);

      rerender();
      expect(result.current[0]).toBe(5);
    });

    it('setState with function updater', () => {
      const { result, rerender } = renderHook(() => useState(10));

      const [, setState] = result.current;
      setState((prev: number) => prev + 5);

      rerender();
      expect(result.current[0]).toBe(15);
    });

    it('multiple setState calls batch correctly', () => {
      const { result, rerender } = renderHook(() => useState(0));

      const [, setState] = result.current;
      setState((prev: number) => prev + 1);
      setState((prev: number) => prev + 1);
      setState((prev: number) => prev + 1);

      rerender();
      expect(result.current[0]).toBe(3);
    });

    it('multiple useState hooks in same component', () => {
      const { result, rerender } = renderHook(() => {
        const [a, setA] = useState('a');
        const [b, setB] = useState('b');
        return { a, setA, b, setB };
      });

      expect(result.current.a).toBe('a');
      expect(result.current.b).toBe('b');

      result.current.setA('A');
      result.current.setB('B');

      rerender();
      expect(result.current.a).toBe('A');
      expect(result.current.b).toBe('B');
    });

    it('schedules an update when setState is called', () => {
      const { result } = renderHook(() => useState(0));
      const [, setState] = result.current;

      setState(1);
      expect(scheduledFibers.length).toBe(1);
    });

    it('throws when called outside a component', () => {
      setCurrentFiber(null);
      expect(() => useState(0)).toThrow('Hooks can only be called inside a component function');
    });
  });

  describe('useEffect', () => {
    it('stores the callback for execution', () => {
      let effectCalled = false;
      const fiber = createMockFiber();
      setCurrentFiber(fiber);

      useEffect(() => {
        effectCalled = true;
      });

      setCurrentFiber(null);

      // Effect should be stored but not called yet
      expect(effectCalled).toBe(false);
      expect(fiber.hooks.length).toBe(1);
      expect(fiber.hooks[0].tag).toBe('effect');
      expect(fiber.hooks[0].state).toBeTypeOf('function');
    });

    it('stores cleanup function when effect runs', () => {
      const fiber = createMockFiber();
      setCurrentFiber(fiber);

      const cleanup = () => {};
      useEffect(() => cleanup);

      setCurrentFiber(null);

      // Simulate running the effect
      const effectFn = fiber.hooks[0].state;
      const returnedCleanup = effectFn();
      expect(returnedCleanup).toBe(cleanup);
    });

    it('marks effect to run when deps change', () => {
      // First render
      const fiber1 = createMockFiber();
      setCurrentFiber(fiber1);
      useEffect(() => {}, [1]);
      setCurrentFiber(null);

      // Re-render with same deps
      const fiber2 = createMockFiber(fiber1);
      setCurrentFiber(fiber2);
      useEffect(() => {}, [1]);
      setCurrentFiber(null);

      // state should be null since deps didn't change
      expect(fiber2.hooks[0].state).toBeNull();

      // Re-render with different deps
      const fiber3 = createMockFiber(fiber2);
      setCurrentFiber(fiber3);
      useEffect(() => {}, [2]);
      setCurrentFiber(null);

      // state should have the new callback
      expect(fiber3.hooks[0].state).toBeTypeOf('function');
    });

    it('always marks to run with no deps array', () => {
      const fiber1 = createMockFiber();
      setCurrentFiber(fiber1);
      useEffect(() => {});
      setCurrentFiber(null);

      expect(fiber1.hooks[0].state).toBeTypeOf('function');

      const fiber2 = createMockFiber(fiber1);
      setCurrentFiber(fiber2);
      useEffect(() => {});
      setCurrentFiber(null);

      expect(fiber2.hooks[0].state).toBeTypeOf('function');
    });

    it('runs once with empty deps array', () => {
      const fiber1 = createMockFiber();
      setCurrentFiber(fiber1);
      useEffect(() => {}, []);
      setCurrentFiber(null);

      expect(fiber1.hooks[0].state).toBeTypeOf('function');

      // Simulate the effect having run
      fiber1.hooks[0].state = null;

      const fiber2 = createMockFiber(fiber1);
      setCurrentFiber(fiber2);
      useEffect(() => {}, []);
      setCurrentFiber(null);

      // Should not re-run since deps ([]) haven't changed
      expect(fiber2.hooks[0].state).toBeNull();
    });

    it('skips effect when deps have not changed', () => {
      const dep = { id: 1 };

      const fiber1 = createMockFiber();
      setCurrentFiber(fiber1);
      useEffect(() => {}, [dep]);
      setCurrentFiber(null);

      // Simulate running the effect
      fiber1.hooks[0].state = null;

      const fiber2 = createMockFiber(fiber1);
      setCurrentFiber(fiber2);
      useEffect(() => {}, [dep]); // same reference
      setCurrentFiber(null);

      expect(fiber2.hooks[0].state).toBeNull();
    });
  });

  describe('useMemo', () => {
    it('computes on first render', () => {
      const { result } = renderHook(() => useMemo(() => 42, []));
      expect(result.current).toBe(42);
    });

    it('returns cached value when deps unchanged', () => {
      let computeCount = 0;
      const { result, rerender } = renderHook(() =>
        useMemo(() => {
          computeCount++;
          return 'value';
        }, [1, 2]),
      );

      expect(computeCount).toBe(1);
      expect(result.current).toBe('value');

      rerender();
      expect(computeCount).toBe(1);
      expect(result.current).toBe('value');
    });

    it('recomputes when deps change', () => {
      let dep = 1;
      let computeCount = 0;

      const fiber1 = createMockFiber();
      setCurrentFiber(fiber1);
      const val1 = useMemo(() => {
        computeCount++;
        return dep * 2;
      }, [dep]);
      setCurrentFiber(null);

      expect(val1).toBe(2);
      expect(computeCount).toBe(1);

      dep = 2;
      const fiber2 = createMockFiber(fiber1);
      setCurrentFiber(fiber2);
      const val2 = useMemo(() => {
        computeCount++;
        return dep * 2;
      }, [dep]);
      setCurrentFiber(null);

      expect(val2).toBe(4);
      expect(computeCount).toBe(2);
    });

    it('uses Object.is for comparison', () => {
      // NaN === NaN should be true with Object.is
      const fiber1 = createMockFiber();
      setCurrentFiber(fiber1);
      let computeCount = 0;
      useMemo(() => { computeCount++; return 'x'; }, [NaN]);
      setCurrentFiber(null);

      expect(computeCount).toBe(1);

      const fiber2 = createMockFiber(fiber1);
      setCurrentFiber(fiber2);
      useMemo(() => { computeCount++; return 'x'; }, [NaN]);
      setCurrentFiber(null);

      // Object.is(NaN, NaN) is true, so should NOT recompute
      expect(computeCount).toBe(1);
    });

    it('detects +0 vs -0 difference', () => {
      const fiber1 = createMockFiber();
      setCurrentFiber(fiber1);
      let computeCount = 0;
      useMemo(() => { computeCount++; return 'x'; }, [+0]);
      setCurrentFiber(null);

      const fiber2 = createMockFiber(fiber1);
      setCurrentFiber(fiber2);
      useMemo(() => { computeCount++; return 'x'; }, [-0]);
      setCurrentFiber(null);

      // Object.is(+0, -0) is false
      expect(computeCount).toBe(2);
    });
  });

  describe('useCallback', () => {
    it('returns same function when deps unchanged', () => {
      const fn = () => {};
      const fiber1 = createMockFiber();
      setCurrentFiber(fiber1);
      const cb1 = useCallback(fn, [1]);
      setCurrentFiber(null);

      const fiber2 = createMockFiber(fiber1);
      setCurrentFiber(fiber2);
      const cb2 = useCallback(fn, [1]);
      setCurrentFiber(null);

      expect(cb1).toBe(cb2);
    });

    it('returns new function when deps change', () => {
      const fn1 = () => 'a';
      const fn2 = () => 'b';

      const fiber1 = createMockFiber();
      setCurrentFiber(fiber1);
      const cb1 = useCallback(fn1, [1]);
      setCurrentFiber(null);

      const fiber2 = createMockFiber(fiber1);
      setCurrentFiber(fiber2);
      const cb2 = useCallback(fn2, [2]);
      setCurrentFiber(null);

      expect(cb1).not.toBe(cb2);
      expect(cb2).toBe(fn2);
    });
  });

  describe('useRef', () => {
    it('returns object with current property', () => {
      const { result } = renderHook(() => useRef(42));
      expect(result.current).toEqual({ current: 42 });
    });

    it('persists across renders', () => {
      const fiber1 = createMockFiber();
      setCurrentFiber(fiber1);
      const ref1 = useRef('hello');
      setCurrentFiber(null);

      const fiber2 = createMockFiber(fiber1);
      setCurrentFiber(fiber2);
      const ref2 = useRef('hello');
      setCurrentFiber(null);

      expect(ref1).toBe(ref2);
    });

    it('current is mutable', () => {
      const { result } = renderHook(() => useRef<number>(0));
      result.current.current = 99;
      expect(result.current.current).toBe(99);
    });

    it('returns null initial value', () => {
      const { result } = renderHook(() => useRef<string | null>(null));
      expect(result.current.current).toBeNull();
    });
  });

  describe('createContext / useContext', () => {
    it('returns default value when no Provider', () => {
      const ctx = createContext('default');
      const { result } = renderHook(() => useContext(ctx));
      expect(result.current).toBe('default');
    });

    it('returns Provider value when set', () => {
      const ctx = createContext(0);
      // Simulate Provider setting the value
      ctx.Provider({ value: 42, children: null });

      const { result } = renderHook(() => useContext(ctx));
      expect(result.current).toBe(42);
    });

    it('updates when Provider value changes', () => {
      const ctx = createContext('initial');

      const fiber1 = createMockFiber();
      setCurrentFiber(fiber1);
      const val1 = useContext(ctx);
      setCurrentFiber(null);
      expect(val1).toBe('initial');

      ctx.Provider({ value: 'updated', children: null });

      const fiber2 = createMockFiber(fiber1);
      setCurrentFiber(fiber2);
      const val2 = useContext(ctx);
      setCurrentFiber(null);
      expect(val2).toBe('updated');
    });

    it('context Provider returns children', () => {
      const ctx = createContext(0);
      const children = [{ type: 'div', props: {}, key: null }];
      const result = ctx.Provider({ value: 1, children });
      expect(result).toBe(children);
    });

    it('creates independent contexts', () => {
      const ctx1 = createContext('a');
      const ctx2 = createContext('b');

      ctx1.Provider({ value: 'A', children: null });

      const fiber = createMockFiber();
      setCurrentFiber(fiber);
      const val1 = useContext(ctx1);
      const val2 = useContext(ctx2);
      setCurrentFiber(null);

      expect(val1).toBe('A');
      expect(val2).toBe('b');
    });
  });
});
