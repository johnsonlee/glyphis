import { computeLayout } from '../layout';
import type { LayoutEngine } from './layout-engine';
import type { LayoutInput, LayoutOutput } from '../layout';

export class GlyphLayoutEngine implements LayoutEngine {
  computeLayout(input: LayoutInput, parentWidth: number, parentHeight: number): LayoutOutput {
    return computeLayout(input, parentWidth, parentHeight);
  }

  dispose(): void {}
}
