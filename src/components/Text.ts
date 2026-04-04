import { createElement } from '../jsx';
import type { VNode, Style, VNodeChild, GlyphPointerEvent } from '../types';

export interface TextProps {
  style?: Style;
  children?: VNodeChild[];
  numberOfLines?: number;
  onPress?: (event: GlyphPointerEvent) => void;
  testID?: string;
}

export function Text(props: TextProps): VNode {
  const { style, children, ...rest } = props;
  const defaultStyle: Style = {
    color: '#000000',
    fontSize: 14,
    fontFamily: 'system-ui',
  };
  return createElement('Text', {
    ...rest,
    style: { ...defaultStyle, ...style },
  }, ...(children || []));
}
