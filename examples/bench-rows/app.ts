import { render, View, Text, createWebPlatform, createSignal, batch, glyphisRenderer } from '../../src';
import type { Style } from '../../src';

// -- Data generation --

const ADJECTIVES = [
  'pretty', 'large', 'big', 'small', 'tall', 'short', 'long', 'handsome',
  'plain', 'quaint', 'clean', 'elegant', 'easy', 'angry', 'crazy', 'helpful',
  'mushy', 'odd', 'unsightly', 'adorable', 'important', 'inexpensive',
  'cheap', 'expensive', 'fancy',
];

const COLORS = [
  'red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'brown',
  'white', 'black', 'orange',
];

const NOUNS = [
  'table', 'chair', 'house', 'bbq', 'desk', 'car', 'pony', 'cookie',
  'sandwich', 'burger', 'pizza', 'mouse', 'keyboard',
];

function pick<T>(list: T[]): T {
  return list[(Math.random() * list.length) | 0];
}

let nextId = 1;

interface RowData {
  id: number;
  label: ReturnType<typeof createSignal<string>>;
}

function buildData(count: number): RowData[] {
  const data: RowData[] = new Array(count);
  for (let i = 0; i < count; i++) {
    data[i] = {
      id: nextId++,
      label: createSignal(`${pick(ADJECTIVES)} ${pick(COLORS)} ${pick(NOUNS)}`),
    };
  }
  return data;
}

// -- Colors --

const BG = '#1a1a2e';
const ROW_EVEN = '#16213e';
const ROW_ODD = '#0f3460';
const SELECTED = '#e94560';
const TEXT_COLOR = '#eee';
const BTN_COLOR = '#533483';

// -- Components --

function ActionButton(props: { label: string; onPress: () => void }) {
  const [pressed, setPressed] = createSignal(false);

  const textChild = glyphisRenderer.createComponent(Text, {
    style: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
      fontFamily: 'system-ui',
      textAlign: 'center' as const,
    } as Style,
    get children() { return props.label; },
  });

  return glyphisRenderer.createComponent(View, {
    onPressIn: () => setPressed(true),
    onPressOut: () => setPressed(false),
    onPress: props.onPress,
    get style(): Style {
      return {
        backgroundColor: BTN_COLOR,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 4,
        marginRight: 6,
        opacity: pressed() ? 0.6 : 1,
      };
    },
    children: textChild,
  });
}

function Row(props: {
  id: number;
  label: () => string;
  index: () => number;
  selected: () => boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const idText = glyphisRenderer.createComponent(Text, {
    style: {
      color: TEXT_COLOR,
      fontSize: 14,
      fontWeight: '400',
      fontFamily: 'monospace',
      width: 60,
    } as Style,
    children: String(props.id),
  });

  const labelText = glyphisRenderer.createComponent(Text, {
    style: {
      color: TEXT_COLOR,
      fontSize: 14,
      fontWeight: '400',
      fontFamily: 'system-ui',
      flex: 1,
    } as Style,
    get children() { return props.label(); },
  });

  const [delPressed, setDelPressed] = createSignal(false);

  const deleteBtn = glyphisRenderer.createComponent(View, {
    onPressIn: () => setDelPressed(true),
    onPressOut: () => setDelPressed(false),
    onPress: props.onDelete,
    get style(): Style {
      return {
        width: 30,
        height: 24,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        opacity: delPressed() ? 0.5 : 1,
      };
    },
    children: glyphisRenderer.createComponent(Text, {
      style: {
        color: '#e94560',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'system-ui',
        textAlign: 'center' as const,
      } as Style,
      children: 'x',
    }),
  });

  return glyphisRenderer.createComponent(View, {
    onPress: props.onSelect,
    get style(): Style {
      const sel = props.selected();
      const idx = props.index();
      return {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: sel ? SELECTED : (idx % 2 === 0 ? ROW_EVEN : ROW_ODD),
        paddingHorizontal: 12,
        paddingVertical: 6,
        height: 32,
      };
    },
    children: [idText, labelText, deleteBtn],
  });
}

function App() {
  const [rows, setRows] = createSignal<RowData[]>([]);
  const [selectedId, setSelectedId] = createSignal<number | null>(null);
  const [timing, setTiming] = createSignal('');

  function timed(name: string, fn: () => void) {
    const t0 = performance.now();
    fn();
    const t1 = performance.now();
    setTiming(`${name}: ${(t1 - t0).toFixed(1)}ms`);
  }

  function create1k() {
    timed('Create 1,000', () => {
      batch(() => {
        setRows(buildData(1000));
        setSelectedId(null);
      });
    });
  }

  function create10k() {
    timed('Create 10,000', () => {
      batch(() => {
        setRows(buildData(10000));
        setSelectedId(null);
      });
    });
  }

  function append1k() {
    timed('Append 1,000', () => {
      setRows(prev => [...prev, ...buildData(1000)]);
    });
  }

  function updateEvery10th() {
    timed('Update every 10th', () => {
      const data = rows();
      for (let i = 0; i < data.length; i += 10) {
        const [get, set] = data[i].label;
        set(get() + ' !!!');
      }
    });
  }

  function swapRows() {
    timed('Swap Rows', () => {
      const data = rows();
      if (data.length > 998) {
        const next = [...data];
        const tmp = next[1];
        next[1] = next[998];
        next[998] = tmp;
        setRows(next);
      }
    });
  }

  function clearRows() {
    timed('Clear', () => {
      batch(() => {
        setRows([]);
        setSelectedId(null);
      });
    });
  }

  // -- Toolbar --

  const toolbar = glyphisRenderer.createComponent(View, {
    style: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: '#0d0d1a',
    } as Style,
    children: [
      glyphisRenderer.createComponent(ActionButton, { label: 'Create 1,000', onPress: create1k }),
      glyphisRenderer.createComponent(ActionButton, { label: 'Create 10,000', onPress: create10k }),
      glyphisRenderer.createComponent(ActionButton, { label: 'Append 1,000', onPress: append1k }),
      glyphisRenderer.createComponent(ActionButton, { label: 'Update every 10th', onPress: updateEvery10th }),
      glyphisRenderer.createComponent(ActionButton, { label: 'Swap Rows', onPress: swapRows }),
      glyphisRenderer.createComponent(ActionButton, { label: 'Clear', onPress: clearRows }),
      glyphisRenderer.createComponent(Text, {
        style: {
          color: '#aaa',
          fontSize: 13,
          fontWeight: '400',
          fontFamily: 'monospace',
          marginLeft: 8,
        } as Style,
        get children() { return timing() || 'Ready'; },
      }),
    ],
  });

  // -- Row list --
  // We rebuild the row component list reactively whenever rows() or selectedId() changes.

  const rowList = glyphisRenderer.createComponent(View, {
    style: {
      flex: 1,
    } as Style,
    get children() {
      const data = rows();
      const sel = selectedId();
      return data.map((row, i) =>
        glyphisRenderer.createComponent(Row, {
          id: row.id,
          label: row.label[0],
          index: () => i,
          selected: () => sel === row.id,
          onSelect: () => setSelectedId(row.id),
          onDelete: () => setRows(prev => prev.filter(r => r.id !== row.id)),
        })
      );
    },
  });

  return glyphisRenderer.createComponent(View, {
    style: {
      flex: 1,
      backgroundColor: BG,
    } as Style,
    children: [toolbar, rowList],
  });
}

// -- Bootstrap --

const canvas = document.getElementById('glyphis-root') as HTMLCanvasElement;
if (canvas) {
  const platform = createWebPlatform(canvas);
  render(() => glyphisRenderer.createComponent(App, {}), platform);
}
