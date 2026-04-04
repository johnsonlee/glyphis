import type { LayoutEngine } from './layout-engine';
import type { LayoutInput, LayoutOutput } from '../layout';
import type { Node as YogaNode } from 'yoga-wasm-web/dist/wrapAsm';
import { Yoga, applyStyleToNode } from './style-to-yoga';

export class YogaLayoutEngine implements LayoutEngine {
  computeLayout(input: LayoutInput, parentWidth: number, parentHeight: number): LayoutOutput {
    const rootYogaNode = this.buildYogaTree(input);
    rootYogaNode.calculateLayout(parentWidth, parentHeight, Yoga.DIRECTION_LTR);
    const output = this.readLayout(rootYogaNode, input);
    rootYogaNode.freeRecursive();
    return output;
  }

  dispose(): void {}

  private buildYogaTree(input: LayoutInput): YogaNode {
    const node = Yoga.Node.create();
    applyStyleToNode(node, input.style);

    // Text measurement
    if (input.text && input.measureText && input.children.length === 0) {
      const text = input.text;
      const measureText = input.measureText;
      const style = input.style;
      node.setMeasureFunc((width: number, widthMode: number, height: number, heightMode: number) => {
        const measured = measureText(text, style);
        let finalWidth = measured.width;
        let finalHeight = measured.height;

        if (widthMode === Yoga.MEASURE_MODE_EXACTLY) {
          finalWidth = width;
        } else if (widthMode === Yoga.MEASURE_MODE_AT_MOST) {
          finalWidth = Math.min(finalWidth, width);
        }

        if (heightMode === Yoga.MEASURE_MODE_EXACTLY) {
          finalHeight = height;
        } else if (heightMode === Yoga.MEASURE_MODE_AT_MOST) {
          finalHeight = Math.min(finalHeight, height);
        }

        return { width: finalWidth, height: finalHeight };
      });
    } else {
      // Add children
      for (let i = 0; i < input.children.length; i++) {
        const childNode = this.buildYogaTree(input.children[i]);
        node.insertChild(childNode, i);
      }
    }

    return node;
  }

  private readLayout(yogaNode: YogaNode, input: LayoutInput): LayoutOutput {
    const layout = yogaNode.getComputedLayout();
    const children: LayoutOutput[] = [];

    if (!input.text || input.children.length > 0) {
      for (let i = 0; i < input.children.length; i++) {
        const childYoga = yogaNode.getChild(i);
        children.push(this.readLayout(childYoga, input.children[i]));
      }
    }

    return {
      x: layout.left,
      y: layout.top,
      width: layout.width,
      height: layout.height,
      children,
    };
  }
}
