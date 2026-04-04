import type { LayoutInput, LayoutOutput } from '../layout';

export interface LayoutEngine {
  computeLayout(input: LayoutInput, parentWidth: number, parentHeight: number): LayoutOutput;
  dispose(): void;
}
