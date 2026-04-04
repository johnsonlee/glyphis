import type { LayoutEngine } from './layout-engine';
import { GlyphLayoutEngine } from './glyph-layout';
import { YogaLayoutEngine } from './yoga-layout';

export type LayoutEngineType = 'glyph' | 'yoga';

let defaultEngine: LayoutEngineType = 'yoga';

export function setDefaultLayoutEngine(type: LayoutEngineType): void {
  defaultEngine = type;
}

export function getDefaultLayoutEngine(): LayoutEngineType {
  return defaultEngine;
}

export function createLayoutEngine(type?: LayoutEngineType): LayoutEngine {
  const engineType = type ?? defaultEngine;
  if (engineType === 'yoga') {
    return new YogaLayoutEngine();
  }
  return new GlyphLayoutEngine();
}

export type { LayoutEngine } from './layout-engine';
export { GlyphLayoutEngine } from './glyph-layout';
export { YogaLayoutEngine } from './yoga-layout';
