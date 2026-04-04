import type { VNode, VNodeType, VNodeChild } from './types';
import { Fragment } from './types';

export function createElement(
  type: VNodeType,
  props: Record<string, any> | null,
  ...children: any[]
): VNode {
  const normalizedChildren: VNodeChild[] = [];
  for (const child of children) {
    if (Array.isArray(child)) {
      normalizedChildren.push(...child.flat(Infinity));
    } else {
      normalizedChildren.push(child);
    }
  }

  return {
    type,
    props: {
      ...(props || {}),
      children: normalizedChildren,
    },
    key: props?.key ?? null,
  };
}

export { Fragment };
export const h = createElement;
