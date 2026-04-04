import type { VNode, VNodeChild, Fiber, FiberTag, EffectTag, VNodeProps } from './types';
import { Fragment, TextNode } from './types';
import { setCurrentFiber, setScheduleUpdate } from './hooks';

export interface ReconcilerHost {
  createNode(fiber: Fiber): any;
  updateNode(fiber: Fiber, prevProps: VNodeProps, nextProps: VNodeProps): void;
  removeNode(fiber: Fiber): void;
  commitEffects(fiber: Fiber): void;
}

function createFiber(
  tag: FiberTag,
  type: any,
  props: VNodeProps,
  key: string | number | null,
): Fiber {
  return {
    tag,
    type,
    props,
    key,
    parent: null,
    child: null,
    sibling: null,
    alternate: null,
    stateNode: null,
    effects: [],
    hooks: [],
    hookIndex: 0,
  };
}

function flattenChildren(children: VNodeChild[]): VNodeChild[] {
  const result: VNodeChild[] = [];
  for (const child of children) {
    if (Array.isArray(child)) {
      result.push(...flattenChildren(child));
    } else {
      result.push(child);
    }
  }
  return result;
}

function childToVNode(child: VNodeChild): VNode | null {
  if (child === null || child === undefined || typeof child === 'boolean') {
    return null;
  }
  if (typeof child === 'string' || typeof child === 'number') {
    return {
      type: TextNode,
      props: { nodeValue: String(child), children: [] },
      key: null,
    };
  }
  return child as VNode;
}

function getFiberTag(type: any): FiberTag {
  if (type === TextNode) return 'text';
  if (type === Fragment) return 'fragment';
  if (typeof type === 'function') return 'component';
  return 'host';
}

export function createReconciler(host: ReconcilerHost) {
  let rootFiber: Fiber | null = null;
  let currentRoot: Fiber | null = null;
  let wipFiber: Fiber | null = null;
  let deletions: Fiber[] = [];
  let pendingEffects: Fiber[] = [];
  let isScheduled = false;

  function render(element: VNode, container: any): void {
    rootFiber = createFiber('root', 'root', { children: [element] }, null);
    rootFiber.stateNode = container;
    rootFiber.alternate = currentRoot;
    wipFiber = rootFiber;
    deletions = [];
    scheduleWork();
  }

  function scheduleWork(): void {
    if (!isScheduled) {
      isScheduled = true;
      queueMicrotask(performWork);
    }
  }

  function performWork(): void {
    isScheduled = false;
    if (!wipFiber) return;

    // Build the fiber tree
    let fiber: Fiber | null = wipFiber;
    while (fiber) {
      fiber = performUnitOfWork(fiber);
    }

    // Commit phase
    commitRoot();
  }

  function performUnitOfWork(fiber: Fiber): Fiber | null {
    // Begin work: reconcile children
    const next = beginWork(fiber);

    if (next) {
      return next;
    }

    // No child, complete this fiber and find next work
    let current: Fiber | null = fiber;
    while (current) {
      completeWork(current);

      if (current.sibling) {
        return current.sibling;
      }
      current = current.parent;

      // If we've completed the wip root, we're done
      if (current === wipFiber) {
        completeWork(current);
        return null;
      }
    }

    return null;
  }

  function beginWork(fiber: Fiber): Fiber | null {
    switch (fiber.tag) {
      case 'component':
        return updateComponent(fiber);
      case 'root':
      case 'host':
      case 'fragment':
        return updateHostOrRoot(fiber);
      case 'text':
        // Text fibers are leaves
        return null;
      default:
        return null;
    }
  }

  function updateComponent(fiber: Fiber): Fiber | null {
    // Set up hook context
    setCurrentFiber(fiber);
    fiber.hookIndex = 0;

    if (!fiber.alternate) {
      fiber.hooks = [];
    }

    // Call the component function
    const fn = fiber.type as Function;
    const children = fn(fiber.props);
    setCurrentFiber(null);

    // Normalize the return value into an array of children
    const childArray = Array.isArray(children) ? children : [children];
    reconcileChildren(fiber, childArray);

    return fiber.child;
  }

  function updateHostOrRoot(fiber: Fiber): Fiber | null {
    const children = fiber.props.children || [];
    reconcileChildren(fiber, flattenChildren(children));
    return fiber.child;
  }

  function reconcileChildren(fiber: Fiber, children: VNodeChild[]): void {
    // Build a map of old children by key and index
    const oldChildren: Fiber[] = [];
    let oldChild = fiber.alternate?.child ?? null;
    while (oldChild) {
      oldChildren.push(oldChild);
      oldChild = oldChild.sibling;
    }

    // Build key map for old children
    const oldKeyMap = new Map<string | number, Fiber>();
    const oldIndexMap = new Map<number, Fiber>();
    for (let i = 0; i < oldChildren.length; i++) {
      const old = oldChildren[i];
      if (old.key !== null && old.key !== undefined) {
        oldKeyMap.set(old.key, old);
      } else {
        oldIndexMap.set(i, old);
      }
    }

    const usedOldFibers = new Set<Fiber>();
    let prevNewFiber: Fiber | null = null;
    let unkeyedIndex = 0;

    for (let i = 0; i < children.length; i++) {
      const vnode = childToVNode(children[i]);
      if (!vnode) {
        // Skip null/undefined/boolean children but increment unkeyed index
        unkeyedIndex++;
        continue;
      }

      let oldFiber: Fiber | undefined;

      // Try to find matching old fiber
      if (vnode.key !== null && vnode.key !== undefined) {
        oldFiber = oldKeyMap.get(vnode.key);
      } else {
        // Match unkeyed children by position
        oldFiber = oldIndexMap.get(unkeyedIndex);
        unkeyedIndex++;
      }

      let newFiber: Fiber;

      if (oldFiber && oldFiber.type === vnode.type) {
        // Reuse fiber
        newFiber = createFiber(
          oldFiber.tag,
          vnode.type,
          vnode.props,
          vnode.key,
        );
        newFiber.alternate = oldFiber;
        newFiber.stateNode = oldFiber.stateNode;
        newFiber.hooks = oldFiber.hooks;
        newFiber.effectTag = 'update';
        newFiber.memoizedProps = oldFiber.props;
        usedOldFibers.add(oldFiber);
      } else {
        // Create new fiber
        const tag = getFiberTag(vnode.type);
        newFiber = createFiber(tag, vnode.type, vnode.props, vnode.key);
        newFiber.effectTag = 'placement';

        if (oldFiber) {
          usedOldFibers.add(oldFiber);
          // Old fiber of different type is a deletion
          oldFiber.effectTag = 'deletion';
          deletions.push(oldFiber);
        }
      }

      newFiber.parent = fiber;

      if (prevNewFiber === null) {
        fiber.child = newFiber;
      } else {
        prevNewFiber.sibling = newFiber;
      }
      prevNewFiber = newFiber;
    }

    // If no children were added, clear the child pointer
    if (prevNewFiber === null) {
      fiber.child = null;
    }

    // Any old fiber not reused is a deletion
    for (const old of oldChildren) {
      if (!usedOldFibers.has(old)) {
        old.effectTag = 'deletion';
        deletions.push(old);
      }
    }
  }

  function completeWork(fiber: Fiber): void {
    // Collect effects from children
    let child = fiber.child;
    while (child) {
      fiber.effects.push(...child.effects);
      if (child.effectTag) {
        fiber.effects.push(child);
      }
      child = child.sibling;
    }
  }

  function commitRoot(): void {
    // Process deletions first
    for (const fiber of deletions) {
      commitDeletion(fiber);
    }

    // Process placement and update effects
    const effects = wipFiber?.effects ?? [];
    for (const fiber of effects) {
      commitFiber(fiber);
    }

    // Also commit the root if it has an effect tag
    if (wipFiber?.effectTag) {
      commitFiber(wipFiber);
    }

    // Run useEffect callbacks after commit
    runEffects(wipFiber);

    // Save as current root for next reconciliation
    currentRoot = wipFiber;
    wipFiber = null;
    deletions = [];
  }

  function commitFiber(fiber: Fiber): void {
    if (!fiber.effectTag) return;

    switch (fiber.effectTag) {
      case 'placement':
        if (fiber.tag === 'host' || fiber.tag === 'text') {
          fiber.stateNode = host.createNode(fiber);
        }
        host.commitEffects(fiber);
        break;
      case 'update':
        if (fiber.tag === 'host' || fiber.tag === 'text') {
          host.updateNode(fiber, fiber.memoizedProps || {}, fiber.props);
        }
        host.commitEffects(fiber);
        break;
    }

    fiber.effectTag = undefined;
  }

  function commitDeletion(fiber: Fiber): void {
    // Cleanup hooks
    cleanupFiberHooks(fiber);

    if (fiber.tag === 'host' || fiber.tag === 'text') {
      host.removeNode(fiber);
    } else {
      // For component/fragment fibers, remove their host children
      let child = fiber.child;
      while (child) {
        commitDeletion(child);
        child = child.sibling;
      }
    }
  }

  function cleanupFiberHooks(fiber: Fiber): void {
    if (fiber.hooks) {
      for (const hook of fiber.hooks) {
        if (hook.tag === 'effect' && typeof hook.cleanup === 'function') {
          hook.cleanup();
          hook.cleanup = undefined;
        }
      }
    }

    // Also cleanup child fibers
    let child = fiber.child;
    while (child) {
      cleanupFiberHooks(child);
      child = child.sibling;
    }
  }

  function runEffects(fiber: Fiber | null): void {
    if (!fiber) return;

    // Run effects on this fiber
    if (fiber.hooks) {
      for (const hook of fiber.hooks) {
        if (hook.tag === 'effect' && hook.state) {
          // Run cleanup from previous effect
          if (typeof hook.cleanup === 'function') {
            hook.cleanup();
          }
          // Run the effect
          const cleanup = hook.state();
          hook.cleanup = cleanup;
          hook.state = null; // Mark as executed
        }
      }
    }

    // Recurse into children
    let child = fiber.child;
    while (child) {
      runEffects(child);
      child = child.sibling;
    }
  }

  function findRootFiber(fiber: Fiber): Fiber {
    let current = fiber;
    while (current.parent) {
      current = current.parent;
    }
    return current;
  }

  function scheduleUpdateFn(fiber: Fiber): void {
    // Find the root from the current fiber tree
    const root = currentRoot ?? rootFiber;
    if (!root) return;

    // Create a new WIP root that mirrors the current root
    const newWipRoot = createFiber(
      root.tag,
      root.type,
      root.props,
      root.key,
    );
    newWipRoot.stateNode = root.stateNode;
    newWipRoot.alternate = root;
    newWipRoot.hooks = root.hooks;

    wipFiber = newWipRoot;
    deletions = [];
    scheduleWork();
  }

  // Wire up hook system
  setScheduleUpdate(scheduleUpdateFn);

  return { render, scheduleUpdate: scheduleUpdateFn };
}
