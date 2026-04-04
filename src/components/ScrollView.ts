import { createElement } from '../jsx';
import { useRef } from '../hooks';
import type { VNode, Style, VNodeChild } from '../types';

export interface ScrollViewProps {
  style?: Style;
  contentContainerStyle?: Style;
  children?: VNodeChild[];
  horizontal?: boolean;
  showsScrollIndicator?: boolean;
  onScroll?: (offset: { x: number; y: number }) => void;
  testID?: string;
}

export function ScrollView(props: ScrollViewProps): VNode {
  const {
    style,
    contentContainerStyle,
    children,
    horizontal = false,
    showsScrollIndicator = true,
    onScroll,
    ...rest
  } = props;

  const scrollOffset = useRef({ x: 0, y: 0 });

  const containerStyle: Style = {
    overflow: 'scroll',
    flex: 1,
    ...style,
  };

  const contentStyle: Style = {
    flexDirection: horizontal ? 'row' : 'column',
    ...contentContainerStyle,
  };

  return createElement('ScrollView', {
    ...rest,
    style: containerStyle,
    horizontal,
    showsScrollIndicator,
    scrollOffset: scrollOffset.current,
    onScroll: (offset: { x: number; y: number }) => {
      scrollOffset.current = offset;
      onScroll?.(offset);
    },
  },
    createElement('Box', { style: contentStyle }, ...(children || []))
  );
}
