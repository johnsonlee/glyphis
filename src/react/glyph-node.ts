import type { Style, GlyphPointerEvent } from '../types';

export class GlyphNode {
  type: string;
  props: GlyphNodeProps;
  children: GlyphNode[];
  parent: GlyphNode | null;
  text: string | null;  // for text leaf nodes only

  constructor(type: string, props: GlyphNodeProps, text?: string) {
    this.type = type;
    this.props = props;
    this.children = [];
    this.parent = null;
    this.text = text ?? null;
  }

  appendChild(child: GlyphNode): void {
    child.parent?.removeChild(child);
    this.children.push(child);
    child.parent = this;
  }

  removeChild(child: GlyphNode): void {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parent = null;
    }
  }

  insertBefore(child: GlyphNode, beforeChild: GlyphNode): void {
    child.parent?.removeChild(child);
    const idx = this.children.indexOf(beforeChild);
    if (idx !== -1) {
      this.children.splice(idx, 0, child);
    } else {
      this.children.push(child);
    }
    child.parent = this;
  }

  updateProps(newProps: GlyphNodeProps): void {
    this.props = newProps;
  }

  updateText(text: string): void {
    this.text = text;
  }
}

export interface GlyphNodeProps {
  style?: Style;
  onPress?: (event: GlyphPointerEvent) => void;
  onPressIn?: (event: GlyphPointerEvent) => void;
  onPressOut?: (event: GlyphPointerEvent) => void;
  onLayout?: (layout: { x: number; y: number; width: number; height: number }) => void;
  src?: string;
  numberOfLines?: number;
  testID?: string;
  [key: string]: any;
}

// Type constants for host elements
export const HOST_TYPES = {
  VIEW: 'glyph-view',
  TEXT: 'glyph-text',
  TEXT_LEAF: 'glyph-text-leaf',
  IMAGE: 'glyph-image',
  SCROLL_VIEW: 'glyph-scroll-view',
  TEXT_INPUT: 'glyph-text-input',
  ROOT: 'glyph-root',
} as const;
