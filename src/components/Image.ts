import { createElement } from '../jsx';
import type { VNode, Style, GlyphPointerEvent } from '../types';

export interface ImageProps {
  src: string;
  alt?: string;
  style?: Style;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onPress?: (event: GlyphPointerEvent) => void;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  testID?: string;
}

export function Image(props: ImageProps): VNode {
  const { src, style, resizeMode = 'cover', ...rest } = props;
  return createElement('Image', {
    ...rest,
    src,
    resizeMode,
    style: { ...style },
  });
}
