import { defineComponent, h } from '@vue/runtime-core';
import type { PropType } from '@vue/runtime-core';
import type { Style, GlyphPointerEvent } from '../types';

// Host element type constants
const HOST = {
  VIEW: 'glyph-view',
  TEXT: 'glyph-text',
  IMAGE: 'glyph-image',
  SCROLL_VIEW: 'glyph-scroll-view',
  TEXT_INPUT: 'glyph-text-input',
};

export const GView = defineComponent({
  name: 'GView',
  props: {
    style: { type: Object as PropType<Style>, default: () => ({}) },
    onPress: { type: Function as PropType<(e: GlyphPointerEvent) => void>, default: undefined },
    onPressIn: { type: Function as PropType<(e: GlyphPointerEvent) => void>, default: undefined },
    onPressOut: { type: Function as PropType<(e: GlyphPointerEvent) => void>, default: undefined },
    testID: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () => h(HOST.VIEW, {
      style: { display: 'flex', flexDirection: 'column' as const, ...props.style },
      onPress: props.onPress,
      onPressIn: props.onPressIn,
      onPressOut: props.onPressOut,
      testID: props.testID,
    }, slots.default?.());
  },
});

export const GText = defineComponent({
  name: 'GText',
  props: {
    style: { type: Object as PropType<Style>, default: () => ({}) },
    onPress: { type: Function as PropType<(e: GlyphPointerEvent) => void>, default: undefined },
    testID: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () => h(HOST.TEXT, {
      style: { color: '#000000', fontSize: 14, fontFamily: 'system-ui', ...props.style },
      onPress: props.onPress,
      testID: props.testID,
    }, slots.default?.());
  },
});

export const GButton = defineComponent({
  name: 'GButton',
  props: {
    title: { type: String, required: true },
    onPress: { type: Function as PropType<(e: GlyphPointerEvent) => void>, default: undefined },
    disabled: { type: Boolean, default: false },
    color: { type: String, default: '#2196F3' },
    style: { type: Object as PropType<Style>, default: () => ({}) },
    testID: { type: String, default: undefined },
  },
  setup(props) {
    return () => {
      const bgColor = props.disabled ? '#CCCCCC' : props.color;
      return h(HOST.VIEW, {
        style: {
          backgroundColor: bgColor,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 4,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          opacity: props.disabled ? 0.6 : 1,
          ...props.style,
        },
        onPress: (e: GlyphPointerEvent) => {
          if (!props.disabled && props.onPress) props.onPress(e);
        },
        testID: props.testID,
      }, h(HOST.TEXT, {
        style: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' as const, textAlign: 'center' as const },
      }, props.title));
    };
  },
});

export const GImage = defineComponent({
  name: 'GImage',
  props: {
    src: { type: String, required: true },
    style: { type: Object as PropType<Style>, default: () => ({}) },
    resizeMode: { type: String as PropType<'cover' | 'contain' | 'stretch' | 'center'>, default: 'cover' },
    testID: { type: String, default: undefined },
  },
  setup(props) {
    return () => h(HOST.IMAGE, {
      src: props.src,
      resizeMode: props.resizeMode,
      style: props.style,
      testID: props.testID,
    });
  },
});
