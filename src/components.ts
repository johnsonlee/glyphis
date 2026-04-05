import { createSignal } from 'solid-js';
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
