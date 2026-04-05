import type { Node as YogaNode } from 'yoga-layout';
import type { Style } from './types';

export interface ImageProps {
  src: string;
  imageId: string;
  resizeMode: string;
  loaded: boolean;
}

export interface GlyphisNode {
  yoga: YogaNode;
  tag: string;
  children: GlyphisNode[];
  style: Style;
  handlers: Record<string, Function>;
  text: string;
  parent: GlyphisNode | undefined;
  imageProps: ImageProps | undefined;
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
    imageProps: undefined,
  };
}
