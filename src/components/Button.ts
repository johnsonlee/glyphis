import { createElement } from '../jsx';
import { useState } from '../hooks';
import type { VNode, Style, GlyphPointerEvent } from '../types';

export interface ButtonProps {
  title: string;
  onPress?: (event: GlyphPointerEvent) => void;
  disabled?: boolean;
  color?: string;
  style?: Style;
  testID?: string;
}

export function Button(props: ButtonProps): VNode {
  const { title, onPress, disabled = false, color = '#2196F3', style, ...rest } = props;
  const [pressed, setPressed] = useState(false);

  const buttonStyle: Style = {
    backgroundColor: disabled ? '#CCCCCC' : pressed ? adjustColor(color, -20) : color,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  const textStyle: Style = {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  };

  return createElement('Box', {
    ...rest,
    style: buttonStyle,
    onPressIn: () => { if (!disabled) setPressed(true); },
    onPressOut: () => { if (!disabled) setPressed(false); },
    onPress: (e: GlyphPointerEvent) => { if (!disabled && onPress) onPress(e); },
  },
    createElement('Text', { style: textStyle }, title)
  );
}

/** Simple color darkening/lightening utility. */
export function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
