import { createElement } from '../jsx';
import { useMemo } from '../hooks';
import type { VNode, Style, VNodeChild } from '../types';

export interface FlatListProps<T> {
  data: T[];
  renderItem: (info: { item: T; index: number }) => VNodeChild;
  keyExtractor?: (item: T, index: number) => string;
  style?: Style;
  contentContainerStyle?: Style;
  horizontal?: boolean;
  ItemSeparatorComponent?: () => VNode;
  ListEmptyComponent?: (() => VNode) | VNode;
  ListHeaderComponent?: (() => VNode) | VNode;
  ListFooterComponent?: (() => VNode) | VNode;
  testID?: string;
}

export function FlatList<T>(props: FlatListProps<T>): VNode {
  const {
    data,
    renderItem,
    keyExtractor = (_item: T, index: number) => String(index),
    style,
    contentContainerStyle,
    horizontal = false,
    ItemSeparatorComponent,
    ListEmptyComponent,
    ListHeaderComponent,
    ListFooterComponent,
    ...rest
  } = props;

  const children = useMemo(() => {
    if (data.length === 0 && ListEmptyComponent) {
      return [typeof ListEmptyComponent === 'function' ? ListEmptyComponent() : ListEmptyComponent];
    }

    const items: VNodeChild[] = [];

    if (ListHeaderComponent) {
      items.push(typeof ListHeaderComponent === 'function' ? ListHeaderComponent() : ListHeaderComponent);
    }

    for (let i = 0; i < data.length; i++) {
      if (i > 0 && ItemSeparatorComponent) {
        items.push(createElement('Box', { key: `sep-${i}` }, ItemSeparatorComponent()));
      }
      const rendered = renderItem({ item: data[i], index: i });
      items.push(createElement('Box', { key: keyExtractor(data[i], i) }, rendered as any));
    }

    if (ListFooterComponent) {
      items.push(typeof ListFooterComponent === 'function' ? ListFooterComponent() : ListFooterComponent);
    }

    return items;
  }, [data, renderItem, keyExtractor, ItemSeparatorComponent, ListEmptyComponent, ListHeaderComponent, ListFooterComponent]);

  const containerStyle: Style = {
    overflow: 'scroll',
    flex: 1,
    ...style,
  };

  const innerStyle: Style = {
    flexDirection: horizontal ? 'row' : 'column',
    ...contentContainerStyle,
  };

  return createElement('ScrollView', {
    ...rest,
    style: containerStyle,
    horizontal,
  },
    createElement('Box', { style: innerStyle }, ...children)
  );
}
