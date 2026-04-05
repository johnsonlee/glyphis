import type { GlyphisNode } from './node';
import type { Style } from './types';
import { glyphisRenderer } from './renderer';

interface ViewProps {
  style?: Style;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onPointerMove?: (x: number, y: number) => void;
  onScrollDragStart?: (x: number, y: number) => void;
  onScrollDragEnd?: (x: number, y: number) => void;
  children?: any;
}

export function View(props: ViewProps): GlyphisNode {
  const node = glyphisRenderer.createElement('view');

  glyphisRenderer.effect(() => {
    if (props.style) glyphisRenderer.setProp(node, 'style', props.style);
  });

  if (props.onPress) glyphisRenderer.setProp(node, 'onPress', props.onPress);
  if (props.onPressIn) glyphisRenderer.setProp(node, 'onPressIn', props.onPressIn);
  if (props.onPressOut) glyphisRenderer.setProp(node, 'onPressOut', props.onPressOut);
  if (props.onPointerMove) glyphisRenderer.setProp(node, 'onPointerMove', props.onPointerMove);
  if (props.onScrollDragStart) glyphisRenderer.setProp(node, 'onScrollDragStart', props.onScrollDragStart);
  if (props.onScrollDragEnd) glyphisRenderer.setProp(node, 'onScrollDragEnd', props.onScrollDragEnd);

  glyphisRenderer.insert(node, () => props.children);

  return node;
}

interface TextProps {
  style?: Style;
  children?: any;
}

export function Text(props: TextProps): GlyphisNode {
  const node = glyphisRenderer.createElement('text');

  glyphisRenderer.effect(() => {
    if (props.style) glyphisRenderer.setProp(node, 'style', props.style);
  });

  glyphisRenderer.insert(node, () => props.children);

  return node;
}
