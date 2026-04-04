import type { VNode, VNodeChild } from './types';
import { Fragment } from './types';

function normalizeChildren(children: any[]): VNodeChild[] {
  const result: VNodeChild[] = [];
  for (const child of children) {
    if (Array.isArray(child)) {
      result.push(...normalizeChildren(child));
    } else {
      result.push(child);
    }
  }
  return result;
}

export function jsx(type: any, props: any, key?: string | number): VNode {
  const { children, ...restProps } = props || {};
  const normalizedChildren = children !== undefined
    ? Array.isArray(children) ? normalizeChildren(children) : [children]
    : [];

  return {
    type,
    props: { ...restProps, children: normalizedChildren },
    key: key ?? props?.key ?? null,
  };
}

export { jsx as jsxs, jsx as jsxDEV };
export { Fragment };
