import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { setCurrentFiber } from '../src/hooks';
import { Box } from '../src/components/Box';
import { Text } from '../src/components/Text';
import { Button, adjustColor } from '../src/components/Button';
import { Image } from '../src/components/Image';
import { ScrollView } from '../src/components/ScrollView';
import { TextInput } from '../src/components/TextInput';
import { FlatList } from '../src/components/FlatList';
import { createElement } from '../src/jsx';
import type { Fiber, VNode, GlyphPointerEvent } from '../src/types';

function createTestFiber(): Fiber {
  return {
    tag: 'component',
    type: () => null,
    props: { children: [] },
    key: null,
    parent: null,
    child: null,
    sibling: null,
    alternate: null,
    stateNode: null,
    effects: [],
    hooks: [],
    hookIndex: 0,
  };
}

function renderComponent<P>(Component: (props: P) => VNode, props: P): { result: VNode; fiber: Fiber } {
  const fiber = createTestFiber();
  setCurrentFiber(fiber);
  fiber.hookIndex = 0;
  const result = Component(props);
  setCurrentFiber(null);
  return { result, fiber };
}

function createMockPointerEvent(overrides: Partial<GlyphPointerEvent> = {}): GlyphPointerEvent {
  return {
    type: 'press',
    x: 0,
    y: 0,
    timestamp: Date.now(),
    target: null,
    preventDefault: () => {},
    stopPropagation: () => {},
    ...overrides,
  };
}

// ─── Box ───────────────────────────────────────────────────────────────────────

describe('Box', () => {
  it('creates a VNode with type "Box"', () => {
    const { result } = renderComponent(Box, {});
    expect(result.type).toBe('Box');
  });

  it('applies default flexDirection column', () => {
    const { result } = renderComponent(Box, {});
    expect(result.props.style.flexDirection).toBe('column');
    expect(result.props.style.display).toBe('flex');
  });

  it('merges custom style over defaults', () => {
    const { result } = renderComponent(Box, {
      style: { flexDirection: 'row', backgroundColor: 'red' },
    });
    expect(result.props.style.flexDirection).toBe('row');
    expect(result.props.style.backgroundColor).toBe('red');
    expect(result.props.style.display).toBe('flex');
  });

  it('passes children through', () => {
    const child = createElement('Text', null, 'hello');
    const { result } = renderComponent(Box, { children: [child] });
    expect(result.props.children).toHaveLength(1);
    expect(result.props.children[0]).toBe(child);
  });

  it('handles empty children', () => {
    const { result } = renderComponent(Box, {});
    expect(result.props.children).toHaveLength(0);
  });

  it('passes event handlers', () => {
    const onPress = mock(() => {});
    const onPressIn = mock(() => {});
    const onPressOut = mock(() => {});
    const { result } = renderComponent(Box, { onPress, onPressIn, onPressOut });
    expect(result.props.onPress).toBe(onPress);
    expect(result.props.onPressIn).toBe(onPressIn);
    expect(result.props.onPressOut).toBe(onPressOut);
  });

  it('passes onLayout handler', () => {
    const onLayout = mock(() => {});
    const { result } = renderComponent(Box, { onLayout });
    expect(result.props.onLayout).toBe(onLayout);
  });

  it('passes testID', () => {
    const { result } = renderComponent(Box, { testID: 'my-box' });
    expect(result.props.testID).toBe('my-box');
  });
});

// ─── Text ──────────────────────────────────────────────────────────────────────

describe('Text', () => {
  it('creates a VNode with type "Text"', () => {
    const { result } = renderComponent(Text, {});
    expect(result.type).toBe('Text');
  });

  it('applies default color, fontSize, fontFamily', () => {
    const { result } = renderComponent(Text, {});
    expect(result.props.style.color).toBe('#000000');
    expect(result.props.style.fontSize).toBe(14);
    expect(result.props.style.fontFamily).toBe('system-ui');
  });

  it('merges custom style over defaults', () => {
    const { result } = renderComponent(Text, {
      style: { color: 'blue', fontSize: 20 },
    });
    expect(result.props.style.color).toBe('blue');
    expect(result.props.style.fontSize).toBe(20);
    expect(result.props.style.fontFamily).toBe('system-ui');
  });

  it('passes text children', () => {
    const { result } = renderComponent(Text, { children: ['Hello', ' World'] });
    expect(result.props.children).toHaveLength(2);
    expect(result.props.children[0]).toBe('Hello');
    expect(result.props.children[1]).toBe(' World');
  });

  it('passes numberOfLines prop', () => {
    const { result } = renderComponent(Text, { numberOfLines: 2 });
    expect(result.props.numberOfLines).toBe(2);
  });

  it('passes onPress handler', () => {
    const onPress = mock(() => {});
    const { result } = renderComponent(Text, { onPress });
    expect(result.props.onPress).toBe(onPress);
  });

  it('passes testID', () => {
    const { result } = renderComponent(Text, { testID: 'my-text' });
    expect(result.props.testID).toBe('my-text');
  });

  it('handles empty children', () => {
    const { result } = renderComponent(Text, {});
    expect(result.props.children).toHaveLength(0);
  });
});

// ─── Button ────────────────────────────────────────────────────────────────────

describe('Button', () => {
  it('renders with type "Box" containing a "Text" child', () => {
    const { result } = renderComponent(Button, { title: 'Click Me' });
    expect(result.type).toBe('Box');
    expect(result.props.children).toHaveLength(1);
    const textChild = result.props.children[0] as VNode;
    expect(textChild.type).toBe('Text');
    expect(textChild.props.children[0]).toBe('Click Me');
  });

  it('applies default color #2196F3 as backgroundColor', () => {
    const { result } = renderComponent(Button, { title: 'OK' });
    expect(result.props.style.backgroundColor).toBe('#2196F3');
  });

  it('applies custom color', () => {
    const { result } = renderComponent(Button, { title: 'OK', color: '#FF0000' });
    expect(result.props.style.backgroundColor).toBe('#FF0000');
  });

  it('applies disabled styles when disabled', () => {
    const { result } = renderComponent(Button, { title: 'OK', disabled: true });
    expect(result.props.style.backgroundColor).toBe('#CCCCCC');
    expect(result.props.style.opacity).toBe(0.6);
  });

  it('does not call onPress when disabled', () => {
    const onPress = mock(() => {});
    const { result } = renderComponent(Button, { title: 'OK', disabled: true, onPress });
    result.props.onPress(createMockPointerEvent());
    expect(onPress).not.toHaveBeenCalled();
  });

  it('calls onPress when enabled', () => {
    const onPress = mock(() => {});
    const { result } = renderComponent(Button, { title: 'OK', onPress });
    const event = createMockPointerEvent();
    result.props.onPress(event);
    expect(onPress).toHaveBeenCalledWith(event);
  });

  it('does not setPressed when disabled (onPressIn)', () => {
    const { result } = renderComponent(Button, { title: 'OK', disabled: true });
    // onPressIn should not throw when disabled
    result.props.onPressIn();
    // backgroundColor should remain #CCCCCC (disabled color)
    expect(result.props.style.backgroundColor).toBe('#CCCCCC');
  });

  it('uses useState for press state', () => {
    const { fiber } = renderComponent(Button, { title: 'OK' });
    // Button calls useState once for pressed state
    expect(fiber.hooks).toHaveLength(1);
    expect(fiber.hooks[0].tag).toBe('state');
    expect(fiber.hooks[0].state).toBe(false);
  });

  it('applies custom style over button defaults', () => {
    const { result } = renderComponent(Button, {
      title: 'OK',
      style: { borderRadius: 20 },
    });
    expect(result.props.style.borderRadius).toBe(20);
  });

  it('sets text style with white color and bold', () => {
    const { result } = renderComponent(Button, { title: 'OK' });
    const textChild = result.props.children[0] as VNode;
    expect(textChild.props.style.color).toBe('#FFFFFF');
    expect(textChild.props.style.fontWeight).toBe('bold');
    expect(textChild.props.style.fontSize).toBe(16);
    expect(textChild.props.style.textAlign).toBe('center');
  });

  it('passes testID', () => {
    const { result } = renderComponent(Button, { title: 'OK', testID: 'btn' });
    expect(result.props.testID).toBe('btn');
  });

  it('sets padding and alignment in button style', () => {
    const { result } = renderComponent(Button, { title: 'OK' });
    expect(result.props.style.paddingHorizontal).toBe(16);
    expect(result.props.style.paddingVertical).toBe(10);
    expect(result.props.style.alignItems).toBe('center');
    expect(result.props.style.justifyContent).toBe('center');
  });

  it('enabled button onPressIn/onPressOut do not throw', () => {
    const { result } = renderComponent(Button, { title: 'OK' });
    expect(() => result.props.onPressIn()).not.toThrow();
    expect(() => result.props.onPressOut()).not.toThrow();
  });
});

// ─── adjustColor ───────────────────────────────────────────────────────────────

describe('adjustColor', () => {
  it('darkens a color by a negative amount', () => {
    const darker = adjustColor('#FFFFFF', -20);
    expect(darker).toBe('#ebebeb');
  });

  it('lightens a color by a positive amount', () => {
    const lighter = adjustColor('#000000', 20);
    expect(lighter).toBe('#141414');
  });

  it('clamps to 0 (no negative channel values)', () => {
    const result = adjustColor('#050505', -20);
    expect(result).toBe('#000000');
  });

  it('clamps to 255 (no overflow)', () => {
    const result = adjustColor('#FAFAFA', 20);
    expect(result).toBe('#ffffff');
  });

  it('handles mid-range color', () => {
    const result = adjustColor('#808080', -10);
    expect(result).toBe('#767676');
  });

  it('handles hex without leading zeros', () => {
    // #010101 - 2 = #000000 (clamped)
    const result = adjustColor('#010101', -2);
    expect(result).toBe('#000000');
  });
});

// ─── Image ─────────────────────────────────────────────────────────────────────

describe('Image', () => {
  it('creates a VNode with type "Image"', () => {
    const { result } = renderComponent(Image, { src: 'http://example.com/img.png' });
    expect(result.type).toBe('Image');
  });

  it('passes src prop', () => {
    const { result } = renderComponent(Image, { src: 'http://example.com/img.png' });
    expect(result.props.src).toBe('http://example.com/img.png');
  });

  it('defaults resizeMode to "cover"', () => {
    const { result } = renderComponent(Image, { src: 'img.png' });
    expect(result.props.resizeMode).toBe('cover');
  });

  it('applies custom resizeMode', () => {
    const { result } = renderComponent(Image, { src: 'img.png', resizeMode: 'contain' });
    expect(result.props.resizeMode).toBe('contain');
  });

  it('applies custom style', () => {
    const { result } = renderComponent(Image, {
      src: 'img.png',
      style: { width: 100, height: 100, borderRadius: 50 },
    });
    expect(result.props.style.width).toBe(100);
    expect(result.props.style.height).toBe(100);
    expect(result.props.style.borderRadius).toBe(50);
  });

  it('passes alt prop', () => {
    const { result } = renderComponent(Image, { src: 'img.png', alt: 'logo' });
    expect(result.props.alt).toBe('logo');
  });

  it('passes onLoad and onError callbacks', () => {
    const onLoad = mock(() => {});
    const onError = mock(() => {});
    const { result } = renderComponent(Image, { src: 'img.png', onLoad, onError });
    expect(result.props.onLoad).toBe(onLoad);
    expect(result.props.onError).toBe(onError);
  });

  it('passes onPress handler', () => {
    const onPress = mock(() => {});
    const { result } = renderComponent(Image, { src: 'img.png', onPress });
    expect(result.props.onPress).toBe(onPress);
  });

  it('passes testID', () => {
    const { result } = renderComponent(Image, { src: 'img.png', testID: 'my-img' });
    expect(result.props.testID).toBe('my-img');
  });

  it('has no children', () => {
    const { result } = renderComponent(Image, { src: 'img.png' });
    expect(result.props.children).toHaveLength(0);
  });

  it('handles undefined style', () => {
    const { result } = renderComponent(Image, { src: 'img.png' });
    expect(result.props.style).toBeDefined();
  });
});

// ─── ScrollView ────────────────────────────────────────────────────────────────

describe('ScrollView', () => {
  it('creates a VNode with type "ScrollView"', () => {
    const { result } = renderComponent(ScrollView, {});
    expect(result.type).toBe('ScrollView');
  });

  it('applies overflow scroll and flex 1 by default', () => {
    const { result } = renderComponent(ScrollView, {});
    expect(result.props.style.overflow).toBe('scroll');
    expect(result.props.style.flex).toBe(1);
  });

  it('merges custom style', () => {
    const { result } = renderComponent(ScrollView, {
      style: { backgroundColor: 'white' },
    });
    expect(result.props.style.backgroundColor).toBe('white');
    expect(result.props.style.overflow).toBe('scroll');
  });

  it('defaults horizontal to false', () => {
    const { result } = renderComponent(ScrollView, {});
    expect(result.props.horizontal).toBe(false);
  });

  it('passes horizontal prop', () => {
    const { result } = renderComponent(ScrollView, { horizontal: true });
    expect(result.props.horizontal).toBe(true);
  });

  it('wraps children in a Box with content container style', () => {
    const child = createElement('Text', null, 'hello');
    const { result } = renderComponent(ScrollView, { children: [child] });
    // The single child of ScrollView is a Box
    expect(result.props.children).toHaveLength(1);
    const boxWrapper = result.props.children[0] as VNode;
    expect(boxWrapper.type).toBe('Box');
    // The Box contains the original child
    expect(boxWrapper.props.children).toHaveLength(1);
  });

  it('applies contentContainerStyle to inner Box', () => {
    const { result } = renderComponent(ScrollView, {
      contentContainerStyle: { padding: 10 },
    });
    const boxWrapper = result.props.children[0] as VNode;
    expect(boxWrapper.props.style.padding).toBe(10);
  });

  it('sets flexDirection row when horizontal', () => {
    const { result } = renderComponent(ScrollView, { horizontal: true });
    const boxWrapper = result.props.children[0] as VNode;
    expect(boxWrapper.props.style.flexDirection).toBe('row');
  });

  it('sets flexDirection column when vertical', () => {
    const { result } = renderComponent(ScrollView, { horizontal: false });
    const boxWrapper = result.props.children[0] as VNode;
    expect(boxWrapper.props.style.flexDirection).toBe('column');
  });

  it('defaults showsScrollIndicator to true', () => {
    const { result } = renderComponent(ScrollView, {});
    expect(result.props.showsScrollIndicator).toBe(true);
  });

  it('passes showsScrollIndicator', () => {
    const { result } = renderComponent(ScrollView, { showsScrollIndicator: false });
    expect(result.props.showsScrollIndicator).toBe(false);
  });

  it('calls onScroll callback and updates scroll offset', () => {
    const onScroll = mock(() => {});
    const { result } = renderComponent(ScrollView, { onScroll });
    const newOffset = { x: 10, y: 20 };
    result.props.onScroll(newOffset);
    expect(onScroll).toHaveBeenCalledWith(newOffset);
  });

  it('handles onScroll without callback', () => {
    const { result } = renderComponent(ScrollView, {});
    expect(() => result.props.onScroll({ x: 0, y: 0 })).not.toThrow();
  });

  it('passes testID', () => {
    const { result } = renderComponent(ScrollView, { testID: 'scroller' });
    expect(result.props.testID).toBe('scroller');
  });

  it('uses useRef for scroll offset', () => {
    const { fiber } = renderComponent(ScrollView, {});
    // useRef internally calls useMemo, which creates a 'memo' hook
    expect(fiber.hooks).toHaveLength(1);
    expect(fiber.hooks[0].tag).toBe('memo');
  });
});

// ─── TextInput ─────────────────────────────────────────────────────────────────

describe('TextInput', () => {
  it('creates a VNode with type "TextInput"', () => {
    const { result } = renderComponent(TextInput, {});
    expect(result.type).toBe('TextInput');
  });

  it('applies default styles', () => {
    const { result } = renderComponent(TextInput, {});
    expect(result.props.style.padding).toBe(8);
    expect(result.props.style.borderWidth).toBe(1);
    expect(result.props.style.borderColor).toBe('#CCCCCC');
    expect(result.props.style.borderRadius).toBe(4);
    expect(result.props.style.fontSize).toBe(14);
  });

  it('shows placeholder text color when value is empty and placeholder set', () => {
    const { result } = renderComponent(TextInput, { placeholder: 'Enter text' });
    expect(result.props.style.color).toBe('#999999');
  });

  it('shows normal color when value is present', () => {
    const { result } = renderComponent(TextInput, { value: 'hello' });
    expect(result.props.style.color).toBe('#000000');
  });

  it('uses custom placeholderTextColor', () => {
    const { result } = renderComponent(TextInput, {
      placeholder: 'Enter',
      placeholderTextColor: '#AAAAAA',
    });
    expect(result.props.style.color).toBe('#AAAAAA');
  });

  it('displays placeholder as child when value is empty', () => {
    const { result } = renderComponent(TextInput, { placeholder: 'Type here' });
    expect(result.props.children[0]).toBe('Type here');
  });

  it('displays value as child when value is present', () => {
    const { result } = renderComponent(TextInput, { value: 'Hello' });
    expect(result.props.children[0]).toBe('Hello');
  });

  it('uses controlled value over internal state', () => {
    const { result } = renderComponent(TextInput, { value: 'controlled' });
    expect(result.props.value).toBe('controlled');
  });

  it('uses defaultValue for uncontrolled initial state', () => {
    const { result } = renderComponent(TextInput, { defaultValue: 'initial' });
    expect(result.props.value).toBe('initial');
  });

  it('calls onChangeText callback', () => {
    const onChangeText = mock(() => {});
    const { result } = renderComponent(TextInput, { onChangeText });
    result.props.onChangeText('new text');
    expect(onChangeText).toHaveBeenCalledWith('new text');
  });

  it('enforces maxLength', () => {
    const onChangeText = mock(() => {});
    const { result } = renderComponent(TextInput, { maxLength: 5, onChangeText });
    result.props.onChangeText('abcdefgh');
    expect(onChangeText).toHaveBeenCalledWith('abcde');
  });

  it('does not call onChangeText when not editable', () => {
    const onChangeText = mock(() => {});
    const { result } = renderComponent(TextInput, { editable: false, onChangeText });
    result.props.onChangeText('text');
    expect(onChangeText).not.toHaveBeenCalled();
  });

  it('calls onFocus callback', () => {
    const onFocus = mock(() => {});
    const { result } = renderComponent(TextInput, { onFocus });
    result.props.onFocus();
    expect(onFocus).toHaveBeenCalled();
  });

  it('does not call onFocus when not editable', () => {
    const onFocus = mock(() => {});
    const { result } = renderComponent(TextInput, { editable: false, onFocus });
    result.props.onFocus();
    expect(onFocus).not.toHaveBeenCalled();
  });

  it('calls onBlur callback', () => {
    const onBlur = mock(() => {});
    const { result } = renderComponent(TextInput, { onBlur });
    result.props.onBlur();
    expect(onBlur).toHaveBeenCalled();
  });

  it('applies non-editable background color', () => {
    const { result } = renderComponent(TextInput, { editable: false });
    expect(result.props.style.backgroundColor).toBe('#F5F5F5');
  });

  it('applies editable background color', () => {
    const { result } = renderComponent(TextInput, { editable: true });
    expect(result.props.style.backgroundColor).toBe('#FFFFFF');
  });

  it('applies minHeight for multiline', () => {
    const { result } = renderComponent(TextInput, { multiline: true });
    expect(result.props.style.minHeight).toBe(80);
  });

  it('no minHeight for single line', () => {
    const { result } = renderComponent(TextInput, { multiline: false });
    expect(result.props.style.minHeight).toBeUndefined();
  });

  it('merges custom style', () => {
    const { result } = renderComponent(TextInput, {
      style: { borderColor: 'red' },
    });
    expect(result.props.style.borderColor).toBe('red');
  });

  it('passes testID', () => {
    const { result } = renderComponent(TextInput, { testID: 'input' });
    expect(result.props.testID).toBe('input');
  });

  it('passes secureTextEntry', () => {
    const { result } = renderComponent(TextInput, { secureTextEntry: true });
    expect(result.props.secureTextEntry).toBe(true);
  });

  it('passes keyboardType', () => {
    const { result } = renderComponent(TextInput, { keyboardType: 'numeric' });
    expect(result.props.keyboardType).toBe('numeric');
  });

  it('passes autoFocus', () => {
    const { result } = renderComponent(TextInput, { autoFocus: true });
    expect(result.props.autoFocus).toBe(true);
  });

  it('uses two useState hooks (internalValue and focused)', () => {
    const { fiber } = renderComponent(TextInput, {});
    expect(fiber.hooks).toHaveLength(2);
    expect(fiber.hooks[0].tag).toBe('state');
    expect(fiber.hooks[1].tag).toBe('state');
  });

  it('handles onChangeText without callback set', () => {
    const { result } = renderComponent(TextInput, {});
    expect(() => result.props.onChangeText('text')).not.toThrow();
  });

  it('handles onBlur correctly (always sets focused to false)', () => {
    const { result } = renderComponent(TextInput, {});
    expect(() => result.props.onBlur()).not.toThrow();
  });
});

// ─── FlatList ──────────────────────────────────────────────────────────────────

describe('FlatList', () => {
  const sampleData = ['Apple', 'Banana', 'Cherry'];
  const renderItem = ({ item, index }: { item: string; index: number }) =>
    createElement('Text', { key: String(index) }, item);

  it('creates a VNode with type "ScrollView"', () => {
    const { result } = renderComponent(FlatList, { data: sampleData, renderItem });
    expect(result.type).toBe('ScrollView');
  });

  it('renders items wrapped in Box elements', () => {
    const { result } = renderComponent(FlatList, { data: sampleData, renderItem });
    // ScrollView > Box (inner) > items
    const innerBox = result.props.children[0] as VNode;
    expect(innerBox.type).toBe('Box');
    // Should have 3 items
    expect(innerBox.props.children).toHaveLength(3);
  });

  it('uses default keyExtractor (index as string)', () => {
    const { result } = renderComponent(FlatList, { data: sampleData, renderItem });
    const innerBox = result.props.children[0] as VNode;
    const firstItem = innerBox.props.children[0] as VNode;
    expect(firstItem.key).toBe('0');
  });

  it('uses custom keyExtractor', () => {
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      keyExtractor: (item: string) => item.toLowerCase(),
    });
    const innerBox = result.props.children[0] as VNode;
    const firstItem = innerBox.props.children[0] as VNode;
    expect(firstItem.key).toBe('apple');
  });

  it('renders ItemSeparatorComponent between items', () => {
    const Separator = () => createElement('Box', { style: { height: 1, backgroundColor: '#CCC' } });
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      ItemSeparatorComponent: Separator,
    });
    const innerBox = result.props.children[0] as VNode;
    // 3 items + 2 separators = 5
    expect(innerBox.props.children).toHaveLength(5);
  });

  it('renders ListEmptyComponent when data is empty', () => {
    const EmptyComponent = () => createElement('Text', null, 'No items');
    const { result } = renderComponent(FlatList, {
      data: [],
      renderItem,
      ListEmptyComponent: EmptyComponent,
    });
    const innerBox = result.props.children[0] as VNode;
    expect(innerBox.props.children).toHaveLength(1);
    const emptyNode = innerBox.props.children[0] as VNode;
    expect(emptyNode.type).toBe('Text');
  });

  it('renders ListEmptyComponent as VNode when data is empty', () => {
    const emptyVNode = createElement('Text', null, 'Empty');
    const { result } = renderComponent(FlatList, {
      data: [],
      renderItem,
      ListEmptyComponent: emptyVNode,
    });
    const innerBox = result.props.children[0] as VNode;
    expect(innerBox.props.children).toHaveLength(1);
    expect(innerBox.props.children[0]).toBe(emptyVNode);
  });

  it('does not render ListEmptyComponent when data has items', () => {
    const EmptyComponent = () => createElement('Text', null, 'No items');
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      ListEmptyComponent: EmptyComponent,
    });
    const innerBox = result.props.children[0] as VNode;
    expect(innerBox.props.children).toHaveLength(3);
  });

  it('renders ListHeaderComponent', () => {
    const Header = () => createElement('Text', null, 'Header');
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      ListHeaderComponent: Header,
    });
    const innerBox = result.props.children[0] as VNode;
    // 1 header + 3 items = 4
    expect(innerBox.props.children).toHaveLength(4);
    const headerNode = innerBox.props.children[0] as VNode;
    expect(headerNode.type).toBe('Text');
  });

  it('renders ListHeaderComponent as VNode', () => {
    const headerVNode = createElement('Text', null, 'Header');
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      ListHeaderComponent: headerVNode,
    });
    const innerBox = result.props.children[0] as VNode;
    expect(innerBox.props.children).toHaveLength(4);
    expect(innerBox.props.children[0]).toBe(headerVNode);
  });

  it('renders ListFooterComponent', () => {
    const Footer = () => createElement('Text', null, 'Footer');
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      ListFooterComponent: Footer,
    });
    const innerBox = result.props.children[0] as VNode;
    // 3 items + 1 footer = 4
    expect(innerBox.props.children).toHaveLength(4);
    const footerNode = innerBox.props.children[innerBox.props.children.length - 1] as VNode;
    expect(footerNode.type).toBe('Text');
  });

  it('renders ListFooterComponent as VNode', () => {
    const footerVNode = createElement('Text', null, 'Footer');
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      ListFooterComponent: footerVNode,
    });
    const innerBox = result.props.children[0] as VNode;
    expect(innerBox.props.children).toHaveLength(4);
    expect(innerBox.props.children[innerBox.props.children.length - 1]).toBe(footerVNode);
  });

  it('applies horizontal prop to ScrollView', () => {
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      horizontal: true,
    });
    expect(result.props.horizontal).toBe(true);
  });

  it('sets inner Box flexDirection row when horizontal', () => {
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      horizontal: true,
    });
    const innerBox = result.props.children[0] as VNode;
    expect(innerBox.props.style.flexDirection).toBe('row');
  });

  it('sets inner Box flexDirection column when vertical', () => {
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      horizontal: false,
    });
    const innerBox = result.props.children[0] as VNode;
    expect(innerBox.props.style.flexDirection).toBe('column');
  });

  it('applies container style with overflow scroll', () => {
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      style: { backgroundColor: 'white' },
    });
    expect(result.props.style.overflow).toBe('scroll');
    expect(result.props.style.backgroundColor).toBe('white');
  });

  it('applies contentContainerStyle to inner Box', () => {
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      contentContainerStyle: { padding: 16 },
    });
    const innerBox = result.props.children[0] as VNode;
    expect(innerBox.props.style.padding).toBe(16);
  });

  it('passes testID', () => {
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      testID: 'list',
    });
    expect(result.props.testID).toBe('list');
  });

  it('uses useMemo for children computation', () => {
    const { fiber } = renderComponent(FlatList, { data: sampleData, renderItem });
    expect(fiber.hooks).toHaveLength(1);
    expect(fiber.hooks[0].tag).toBe('memo');
  });

  it('renders with all sub-components together', () => {
    const Header = () => createElement('Text', null, 'H');
    const Footer = () => createElement('Text', null, 'F');
    const Separator = () => createElement('Box', { style: { height: 1 } });
    const { result } = renderComponent(FlatList, {
      data: sampleData,
      renderItem,
      ListHeaderComponent: Header,
      ListFooterComponent: Footer,
      ItemSeparatorComponent: Separator,
    });
    const innerBox = result.props.children[0] as VNode;
    // 1 header + 3 items + 2 separators + 1 footer = 7
    expect(innerBox.props.children).toHaveLength(7);
  });

  it('renders empty data without ListEmptyComponent', () => {
    const { result } = renderComponent(FlatList, {
      data: [],
      renderItem,
    });
    const innerBox = result.props.children[0] as VNode;
    expect(innerBox.props.children).toHaveLength(0);
  });
});
