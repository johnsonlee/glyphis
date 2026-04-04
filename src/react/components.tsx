import React, { useState } from 'react';
import type { Style, GlyphPointerEvent } from '../types';

// Host element type constants (must match glyph-node.ts HOST_TYPES)
const HOST = {
  VIEW: 'glyph-view',
  TEXT: 'glyph-text',
  IMAGE: 'glyph-image',
  SCROLL_VIEW: 'glyph-scroll-view',
  TEXT_INPUT: 'glyph-text-input',
};

// --- View ---
export interface ViewProps {
  style?: Style;
  children?: React.ReactNode;
  onPress?: (event: GlyphPointerEvent) => void;
  onPressIn?: (event: GlyphPointerEvent) => void;
  onPressOut?: (event: GlyphPointerEvent) => void;
  onLayout?: (layout: { x: number; y: number; width: number; height: number }) => void;
  testID?: string;
}

export function View(props: ViewProps) {
  const { style, children, ...rest } = props;
  const defaultStyle: Style = { display: 'flex', flexDirection: 'column' };
  return React.createElement(HOST.VIEW, {
    ...rest,
    style: { ...defaultStyle, ...style },
  }, children);
}

// --- Text ---
export interface TextProps {
  style?: Style;
  children?: React.ReactNode;
  numberOfLines?: number;
  onPress?: (event: GlyphPointerEvent) => void;
  testID?: string;
}

export function Text(props: TextProps) {
  const { style, children, ...rest } = props;
  const defaultStyle: Style = {
    color: '#000000',
    fontSize: 14,
    fontFamily: 'system-ui',
  };
  return React.createElement(HOST.TEXT, {
    ...rest,
    style: { ...defaultStyle, ...style },
  }, children);
}

// --- Button ---
export interface ButtonProps {
  title: string;
  onPress?: (event: GlyphPointerEvent) => void;
  disabled?: boolean;
  color?: string;
  style?: Style;
  testID?: string;
}

export function Button(props: ButtonProps) {
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

  return React.createElement(HOST.VIEW, {
    ...rest,
    style: buttonStyle,
    onPressIn: () => { if (!disabled) setPressed(true); },
    onPressOut: () => { if (!disabled) setPressed(false); },
    onPress: (e: GlyphPointerEvent) => { if (!disabled && onPress) onPress(e); },
  },
    React.createElement(HOST.TEXT, { style: textStyle }, title),
  );
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// --- Image ---
export interface ImageProps {
  src: string;
  alt?: string;
  style?: Style;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onPress?: (event: GlyphPointerEvent) => void;
  testID?: string;
}

export function Image(props: ImageProps) {
  const { src, style, resizeMode = 'cover', ...rest } = props;
  return React.createElement(HOST.IMAGE, { ...rest, src, resizeMode, style });
}

// --- ScrollView ---
export interface ScrollViewProps {
  style?: Style;
  contentContainerStyle?: Style;
  children?: React.ReactNode;
  horizontal?: boolean;
  testID?: string;
}

export function ScrollView(props: ScrollViewProps) {
  const { style, contentContainerStyle, children, horizontal = false, ...rest } = props;
  const containerStyle: Style = { overflow: 'scroll', flex: 1, ...style };
  const contentStyle: Style = {
    flexDirection: horizontal ? 'row' : 'column',
    ...contentContainerStyle,
  };

  return React.createElement(HOST.SCROLL_VIEW, {
    ...rest,
    style: containerStyle,
    horizontal,
  },
    React.createElement(HOST.VIEW, { style: contentStyle }, children),
  );
}

// --- TextInput ---
export interface TextInputProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  placeholderTextColor?: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: Style;
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
  testID?: string;
}

export function TextInput(props: TextInputProps) {
  const {
    value: controlledValue,
    defaultValue = '',
    placeholder,
    placeholderTextColor = '#999999',
    onChangeText,
    onFocus,
    onBlur,
    style,
    multiline = false,
    maxLength,
    editable = true,
    ...rest
  } = props;

  const [internalValue, setInternalValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const displayValue = controlledValue !== undefined ? controlledValue : internalValue;
  const showPlaceholder = !displayValue && placeholder;

  const inputStyle: Style = {
    padding: 8,
    borderWidth: 1,
    borderColor: focused ? '#2196F3' : '#CCCCCC',
    borderRadius: 4,
    fontSize: 14,
    color: showPlaceholder ? placeholderTextColor : '#000000',
    backgroundColor: editable ? '#FFFFFF' : '#F5F5F5',
    minHeight: multiline ? 80 : undefined,
    ...style,
  };

  return React.createElement(HOST.TEXT_INPUT, {
    ...rest,
    style: inputStyle,
    value: displayValue,
    placeholder,
    multiline,
    maxLength,
    editable,
  },
    showPlaceholder ? placeholder : displayValue,
  );
}

// --- FlatList ---
export interface FlatListProps<T> {
  data: T[];
  renderItem: (info: { item: T; index: number }) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  style?: Style;
  contentContainerStyle?: Style;
  horizontal?: boolean;
  ItemSeparatorComponent?: React.ComponentType;
  ListEmptyComponent?: React.ReactNode;
  ListHeaderComponent?: React.ReactNode;
  ListFooterComponent?: React.ReactNode;
  testID?: string;
}

export function FlatList<T>(props: FlatListProps<T>) {
  const {
    data,
    renderItem,
    keyExtractor = (_: T, i: number) => String(i),
    style,
    contentContainerStyle,
    horizontal = false,
    ItemSeparatorComponent,
    ListEmptyComponent,
    ListHeaderComponent,
    ListFooterComponent,
    ...rest
  } = props;

  const containerStyle: Style = { overflow: 'scroll', flex: 1, ...style };
  const innerStyle: Style = {
    flexDirection: horizontal ? 'row' : 'column',
    ...contentContainerStyle,
  };

  let content: React.ReactNode;

  if (data.length === 0 && ListEmptyComponent) {
    content = ListEmptyComponent;
  } else {
    const items: React.ReactNode[] = [];
    if (ListHeaderComponent) items.push(ListHeaderComponent);
    for (let i = 0; i < data.length; i++) {
      if (i > 0 && ItemSeparatorComponent) {
        items.push(React.createElement(ItemSeparatorComponent, { key: `sep-${i}` }));
      }
      items.push(
        React.createElement(React.Fragment, { key: keyExtractor(data[i], i) },
          renderItem({ item: data[i], index: i }),
        ),
      );
    }
    if (ListFooterComponent) items.push(ListFooterComponent);
    content = items;
  }

  return React.createElement(HOST.SCROLL_VIEW, { ...rest, style: containerStyle, horizontal },
    React.createElement(HOST.VIEW, { style: innerStyle }, content),
  );
}
