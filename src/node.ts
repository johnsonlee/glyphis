import type { Node as YogaNode } from 'yoga-layout';
import type { Style } from './types';

export interface GlyphisNode {
  yoga: YogaNode;
  tag: string;
  children: GlyphisNode[];
  style: Style;
  handlers: Record<string, Function>;
  text: string;
  parent: GlyphisNode | undefined;
}

export function createGlyphisNode(yoga: YogaNode, tag: string): GlyphisNode {
  return {
    yoga,
    tag,
    children: [],
    style: {},
    handlers: {},
    text: '',
    parent: undefined,
  };
}
