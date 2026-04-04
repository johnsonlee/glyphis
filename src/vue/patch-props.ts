import type { GlyphNode } from '../react/glyph-node';

export function patchProp(
  el: GlyphNode,
  key: string,
  _prevValue: any,
  nextValue: any,
): void {
  if (key === 'style') {
    el.props.style = nextValue ?? {};
  } else if (nextValue === undefined || nextValue === null) {
    delete el.props[key];
  } else {
    el.props[key] = nextValue;
  }
}
