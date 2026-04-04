import { createElement } from '../jsx';
import { useState } from '../hooks';
import type { VNode, Style } from '../types';

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
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email' | 'phone';
  autoFocus?: boolean;
  editable?: boolean;
  testID?: string;
}

export function TextInput(props: TextInputProps): VNode {
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

  return createElement('TextInput', {
    ...rest,
    style: inputStyle,
    value: displayValue,
    placeholder,
    multiline,
    maxLength,
    editable,
    focused,
    onChangeText: (text: string) => {
      if (!editable) return;
      const newText = maxLength ? text.slice(0, maxLength) : text;
      setInternalValue(newText);
      onChangeText?.(newText);
    },
    onFocus: () => {
      if (!editable) return;
      setFocused(true);
      onFocus?.();
    },
    onBlur: () => {
      setFocused(false);
      onBlur?.();
    },
  },
    showPlaceholder ? placeholder : displayValue
  );
}
