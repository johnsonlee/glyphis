import { GlyphNode, GlyphNodeProps, HOST_TYPES } from './glyph-node';

// Container type: the root GlyphNode
export type Container = {
  rootNode: GlyphNode;
  onCommit: () => void;  // callback to trigger render pipeline
};

export type Instance = GlyphNode;
export type TextInstance = GlyphNode;

// Props diffing: return update payload or null
function diffProps(oldProps: GlyphNodeProps, newProps: GlyphNodeProps): GlyphNodeProps | null {
  let hasChanges = false;
  const diff: GlyphNodeProps = {};

  // Check for changed/added props
  for (const key of Object.keys(newProps)) {
    if (key === 'children') continue;
    if (oldProps[key] !== newProps[key]) {
      diff[key] = newProps[key];
      hasChanges = true;
    }
  }

  // Check for removed props
  for (const key of Object.keys(oldProps)) {
    if (key === 'children') continue;
    if (!(key in newProps)) {
      diff[key] = undefined;
      hasChanges = true;
    }
  }

  return hasChanges ? diff : null;
}

export const hostConfig = {
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,

  // --- Instance creation ---
  createInstance(type: string, props: GlyphNodeProps): Instance {
    const nodeProps: GlyphNodeProps = {};
    for (const key of Object.keys(props)) {
      if (key !== 'children') {
        nodeProps[key] = props[key];
      }
    }
    return new GlyphNode(type, nodeProps);
  },

  createTextInstance(text: string): TextInstance {
    return new GlyphNode(HOST_TYPES.TEXT_LEAF, {}, text);
  },

  // --- Tree manipulation ---
  appendInitialChild(parent: Instance, child: Instance | TextInstance): void {
    parent.appendChild(child);
  },

  appendChild(parent: Instance, child: Instance | TextInstance): void {
    parent.appendChild(child);
  },

  appendChildToContainer(container: Container, child: Instance | TextInstance): void {
    container.rootNode.appendChild(child);
  },

  removeChild(parent: Instance, child: Instance | TextInstance): void {
    parent.removeChild(child);
  },

  removeChildFromContainer(container: Container, child: Instance | TextInstance): void {
    container.rootNode.removeChild(child);
  },

  insertBefore(parent: Instance, child: Instance | TextInstance, beforeChild: Instance | TextInstance): void {
    parent.insertBefore(child, beforeChild);
  },

  insertInContainerBefore(container: Container, child: Instance | TextInstance, beforeChild: Instance | TextInstance): void {
    container.rootNode.insertBefore(child, beforeChild);
  },

  // --- Updates ---
  prepareUpdate(instance: Instance, type: string, oldProps: GlyphNodeProps, newProps: GlyphNodeProps): GlyphNodeProps | null {
    return diffProps(oldProps, newProps);
  },

  commitUpdate(instance: Instance, updatePayload: GlyphNodeProps, type: string, prevProps: GlyphNodeProps, nextProps: GlyphNodeProps): void {
    if (updatePayload) {
      const merged = { ...instance.props };
      for (const key of Object.keys(updatePayload)) {
        if (updatePayload[key] === undefined) {
          delete merged[key];
        } else {
          merged[key] = updatePayload[key];
        }
      }
      instance.updateProps(merged);
    }
  },

  commitTextUpdate(textInstance: TextInstance, oldText: string, newText: string): void {
    textInstance.updateText(newText);
  },

  // --- Finalization ---
  finalizeInitialChildren(): boolean {
    return false;
  },

  commitMount(): void {
    // No-op for now
  },

  // --- Commit lifecycle ---
  prepareForCommit(): Record<string, any> | null {
    return null;
  },

  resetAfterCommit(container: Container): void {
    // This triggers the layout -> render -> canvas pipeline
    container.onCommit();
  },

  // --- Context ---
  getRootHostContext(): {} {
    return {};
  },

  getChildHostContext(parentHostContext: {}): {} {
    return parentHostContext;
  },

  // --- Misc ---
  getPublicInstance(instance: Instance): Instance {
    return instance;
  },

  shouldSetTextContent(type: string, props: GlyphNodeProps): boolean {
    return false;
  },

  resetTextContent(): void {},

  clearContainer(container: Container): void {
    container.rootNode.children = [];
  },

  // --- Scheduling ---
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  isPrimaryRenderer: true,
  warnsIfNotActing: false,

  getCurrentEventPriority(): number {
    return 32; // DefaultEventPriority
  },

  getInstanceFromNode(): null {
    return null;
  },

  beforeActiveInstanceBlur(): void {},
  afterActiveInstanceBlur(): void {},

  prepareScopeUpdate(): void {},
  getInstanceFromScope(): null {
    return null;
  },

  detachDeletedInstance(): void {},

  preparePortalMount(): void {},

  now: typeof performance !== 'undefined' ? performance.now.bind(performance) : Date.now,

  supportsMicrotasks: true,
  scheduleMicrotask: typeof queueMicrotask !== 'undefined' ? queueMicrotask : (fn: () => void) => setTimeout(fn, 0),

  // --- React 19 / react-reconciler 0.33 required methods ---

  setCurrentUpdatePriority(newPriority: number): void {},
  getCurrentUpdatePriority(): number {
    return 32; // DefaultEventPriority
  },
  resolveUpdatePriority(): number {
    return 32; // DefaultEventPriority
  },

  shouldAttemptEagerTransition(): boolean {
    return false;
  },

  trackSchedulerEvent(): void {},
  resolveEventType(): null {
    return null;
  },
  resolveEventTimeStamp(): number {
    return -1.1;
  },

  requestPostPaintCallback(): void {},

  maySuspendCommit(): boolean {
    return false;
  },

  maySuspendCommitOnUpdate(): boolean {
    return false;
  },

  maySuspendCommitInSyncRender(): boolean {
    return false;
  },

  preloadInstance(): boolean {
    return true; // already loaded
  },

  startSuspendingCommit(): void {},

  suspendInstance(): void {},

  suspendOnActiveViewTransition(): void {},

  waitForCommitToBeReady(): null {
    return null;
  },

  getSuspendedCommitReason(): null {
    return null;
  },

  NotPendingTransition: null as any,

  HostTransitionContext: {
    $$typeof: Symbol.for('react.context'),
    Provider: null as any,
    Consumer: null as any,
    _currentValue: null as any,
    _currentValue2: null as any,
    _threadCount: 0,
  },

  resetFormInstance(): void {},

  bindToConsole(methodName: string, args: unknown[], badgeName: string) {
    return Function.prototype.bind.call(
      (console as any)[methodName],
      console,
      ...args,
    );
  },

  supportsTestSelectors: false,
  findFiberRoot(): null { return null; },
  getBoundingRect(): null { return null; },
  getTextContent(): null { return null; },
  isHiddenSubtree(): boolean { return false; },
  matchAccessibilityRole(): boolean { return false; },
  setFocusIfFocusable(): boolean { return false; },
  setupIntersectionObserver(): null { return null; },
} as const;
