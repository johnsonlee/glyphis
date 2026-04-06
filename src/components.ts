import { createSignal, onCleanup, onMount } from 'solid-js';
import type { GlyphisNode } from './node';
import type { Style, TextInputConfig } from './types';
import { glyphisRenderer, showTextInput, hideTextInput, updateTextInput, textInputRegistry, scheduleRender } from './renderer';

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

interface ImageComponentProps {
  src: string;
  resizeMode?: 'cover' | 'contain' | 'stretch';
  style?: Style;
  onLoad?: (event: { width: number; height: number }) => void;
}

export function Image(props: ImageComponentProps): GlyphisNode {
  var node = glyphisRenderer.createElement('image');

  glyphisRenderer.setProp(node, 'imageProps', {
    src: props.src,
    imageId: props.src,
    resizeMode: props.resizeMode || 'cover',
    loaded: false,
  });

  if (props.onLoad) glyphisRenderer.setProp(node, 'onLoad', props.onLoad);

  glyphisRenderer.effect(function() {
    if (props.style) glyphisRenderer.setProp(node, 'style', props.style);
  });

  return node;
}

interface ButtonProps {
  title: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  disabled?: boolean;
  style?: Style;
}

export function Button(props: ButtonProps): GlyphisNode {
  var pressedSignal = createSignal(false);
  var pressed = pressedSignal[0];
  var setPressed = pressedSignal[1];

  var textChild = glyphisRenderer.createComponent(Text, {
    get style() {
      return {
        color: props.textColor || '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center' as const,
      };
    },
    get children() { return props.title; },
  });

  return glyphisRenderer.createComponent(View, {
    onPressIn: function() { if (!props.disabled) setPressed(true); },
    onPressOut: function() { setPressed(false); },
    onPress: function() { if (!props.disabled && props.onPress) props.onPress(); },
    get style(): Style {
      var base: Style = {
        backgroundColor: props.color || '#2196F3',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 4,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        opacity: props.disabled ? 0.4 : (pressed() ? 0.6 : 1),
      };
      if (props.style) {
        var keys = Object.keys(props.style);
        for (var i = 0; i < keys.length; i++) {
          (base as any)[keys[i]] = (props.style as any)[keys[i]];
        }
      }
      return base;
    },
    children: textChild,
  });
}

// --- TextInput ---

var nextInputId = 1;

export interface TextInputProps {
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  style?: Style;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'email-address';
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  secureTextEntry?: boolean;
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
}

function getAbsolutePosition(node: GlyphisNode): { x: number; y: number; width: number; height: number } {
  var layout = node.yoga.getComputedLayout();
  var x = layout.left;
  var y = layout.top;
  var current = node.parent;
  while (current) {
    var parentLayout = current.yoga.getComputedLayout();
    x = x + parentLayout.left;
    y = y + parentLayout.top;
    current = current.parent;
  }
  return { x: x, y: y, width: layout.width, height: layout.height };
}

export function TextInput(props: TextInputProps): GlyphisNode {
  var inputId = 'input_' + nextInputId++;
  var focusedSignal = createSignal(false);
  var focused = focusedSignal[0];
  var setFocused = focusedSignal[1];

  // Internal value for uncontrolled mode
  var internalValueSignal = createSignal(props.defaultValue || '');
  var internalValue = internalValueSignal[0];
  var setInternalValue = internalValueSignal[1];

  function getValue(): string {
    if (props.value != null) return props.value;
    return internalValue();
  }

  function getDisplayText(): string {
    var val = getValue();
    if (!val) return '';
    if (props.secureTextEntry) {
      var bullets = '';
      for (var i = 0; i < val.length; i++) bullets = bullets + '\u2022';
      return bullets;
    }
    return val;
  }

  // Register callbacks + node ref for position sync during scroll
  textInputRegistry.set(inputId, {
    onChangeText: function(text: string) {
      setInternalValue(text);
      if (props.onChangeText) props.onChangeText(text);
    },
    onFocus: function() {
      setFocused(true);
      var entry = textInputRegistry.get(inputId);
      if (entry) entry.focused = true;
      if (props.onFocus) props.onFocus();
    },
    onBlur: function() {
      setFocused(false);
      var entry = textInputRegistry.get(inputId);
      if (entry) entry.focused = false;
      if (props.onBlur) props.onBlur();
    },
    onSubmit: function() {
      if (props.onSubmitEditing) props.onSubmitEditing();
    },
    node: outerNode,
    focused: false,
  });

  onCleanup(function() {
    textInputRegistry.delete(inputId);
    hideTextInput(inputId);
  });

  function doFocus(): void {
    if (props.editable === false) return;
    var pos = getAbsolutePosition(outerNode);
    var style = props.style || {};
    var config: TextInputConfig = {
      inputId: inputId,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      value: getValue(),
      placeholder: props.placeholder || '',
      fontSize: style.fontSize || 14,
      color: style.color || '#000000',
      placeholderColor: props.placeholderTextColor || '#999999',
      keyboardType: props.keyboardType || 'default',
      returnKeyType: props.returnKeyType || 'done',
      secureTextEntry: props.secureTextEntry || false,
      multiline: props.multiline || false,
      maxLength: props.maxLength || 0,
    };
    showTextInput(config);
  }

  // Text child: shows value or placeholder when not focused
  var textChild = glyphisRenderer.createComponent(Text, {
    get style() {
      var style = props.style || {};
      var val = getValue();
      var isPlaceholder = !val;
      return {
        color: isPlaceholder ? (props.placeholderTextColor || '#999999') : (style.color || '#000000'),
        fontSize: style.fontSize || 14,
        fontWeight: style.fontWeight,
        fontFamily: style.fontFamily,
      };
    },
    get children() {
      if (focused()) return '';
      var val = getDisplayText();
      if (val) return val;
      return props.placeholder || '';
    },
  });

  var outerNode = glyphisRenderer.createComponent(View, {
    onPress: function() {
      doFocus();
    },
    get style(): Style {
      var base: Style = {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: focused() ? '#2196F3' : '#CCCCCC',
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 8,
        justifyContent: 'center' as const,
      };
      if (props.style) {
        var keys = Object.keys(props.style);
        for (var i = 0; i < keys.length; i++) {
          (base as any)[keys[i]] = (props.style as any)[keys[i]];
        }
      }
      return base;
    },
    children: textChild,
  });

  outerNode.textInputId = inputId;

  // Update registry with the actual node reference (was undefined during registration)
  var registryEntry = textInputRegistry.get(inputId);
  if (registryEntry) registryEntry.node = outerNode;

  if (props.autoFocus) {
    onMount(function() {
      // Delay slightly to ensure layout is computed
      setTimeout(function() { doFocus(); }, 50);
    });
  }

  return outerNode;
}
