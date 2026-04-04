import { createElement } from '../jsx';
import type { VNode, Style, VNodeChild, GlyphPointerEvent } from '../types';

export interface BoxProps {
  style?: Style;
  children?: VNodeChild[];
  onPress?: (event: GlyphPointerEvent) => void;
  onPressIn?: (event: GlyphPointerEvent) => void;
  onPressOut?: (event: GlyphPointerEvent) => void;
  onLayout?: (layout: { x: number; y: number; width: number; height: number }) => void;
  testID?: string;
}

export function Box(props: BoxProps): VNode {
  const { style, children, ...rest } = props;
  const defaultStyle: Style = {
    display: 'flex',
    flexDirection: 'column',
  };
  return createElement('Box', {
    ...rest,
    style: { ...defaultStyle, ...style },
  }, ...(children || []));
}
