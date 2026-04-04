import Reconciler from 'react-reconciler';
import { hostConfig, Container } from './host-config';
import { GlyphNode, HOST_TYPES } from './glyph-node';
import type { ReactElement } from 'react';

const reconciler = Reconciler(hostConfig as any);

// Store active containers for re-rendering
const containers = new Map<GlyphNode, any>();

export function createGlyphRoot(rootNode: GlyphNode, onCommit: () => void) {
  const container: Container = { rootNode, onCommit };
  const fiberRoot = reconciler.createContainer(
    container,
    0,     // LegacyRoot tag
    null,  // hydrationCallbacks
    false, // isStrictMode
    null,  // concurrentUpdatesByDefaultOverride
    '',    // identifierPrefix
    (error: Error) => console.error('React uncaught error:', error),
    (error: Error) => console.error('React caught error:', error),
    (error: Error) => console.error('React recoverable error:', error),
    null,  // onDefaultTransitionIndicator
  );
  containers.set(rootNode, fiberRoot);
  return fiberRoot;
}

export function renderReact(element: ReactElement, rootNode: GlyphNode, onCommit: () => void): void {
  let fiberRoot = containers.get(rootNode);
  if (!fiberRoot) {
    fiberRoot = createGlyphRoot(rootNode, onCommit);
  }
  reconciler.updateContainer(element, fiberRoot, null, () => {});
}

export { GlyphNode, HOST_TYPES };
