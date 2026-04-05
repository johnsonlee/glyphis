import { render, View, Text, RecyclerList, createWebPlatform, createSignal, batch, glyphisRenderer } from '../../src';
import type { Style, RecyclerListHandle } from '../../src';

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
  label: string;
}

function buildData(count: number): RowData[] {
  var data: RowData[] = new Array(count);
  for (var i = 0; i < count; i++) {
    data[i] = {
      id: nextId++,
      label: pick(ADJECTIVES) + ' ' + pick(COLORS) + ' ' + pick(NOUNS),
    };
  }
  return data;
}

// -- Colors --

var BG = '#1a1a2e';
var ROW_EVEN = '#16213e';
var ROW_ODD = '#0f3460';
var SELECTED = '#e94560';
var TEXT_COLOR = '#eee';
var BTN_COLOR = '#533483';

// -- Row height for virtual list --
var ROW_HEIGHT = 32;

// -- Components --

function ActionButton(props: { label: string; onPress: () => void }) {
  var pressedSignal = createSignal(false);
  var pressed = pressedSignal[0];
  var setPressed = pressedSignal[1];

  var textChild = glyphisRenderer.createComponent(Text, {
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
    onPressIn: function() { setPressed(true); },
    onPressOut: function() { setPressed(false); },
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

// renderRow receives signal accessors — called ONCE per slot, nodes reused on scroll
function renderRow(getItem: () => RowData | null, getIndex: () => number, selectedId: () => number | null, onSelect: (id: number) => void, onDelete: (id: number) => void) {
  return glyphisRenderer.createComponent(View, {
    onPress: function() { var item = getItem(); if (item) onSelect(item.id); },
    get style(): Style {
      var item = getItem();
      var index = getIndex();
      var sel = selectedId();
      var isSelected = item ? sel === item.id : false;
      return {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: isSelected ? SELECTED : (index % 2 === 0 ? ROW_EVEN : ROW_ODD),
        paddingHorizontal: 12,
        paddingVertical: 6,
        height: ROW_HEIGHT,
      };
    },
    children: [
      glyphisRenderer.createComponent(Text, {
        style: { color: TEXT_COLOR, fontSize: 14, fontWeight: '400', fontFamily: 'monospace', width: 60 } as Style,
        get children() { var item = getItem(); return item ? String(item.id) : ''; },
      }),
      glyphisRenderer.createComponent(Text, {
        style: { color: TEXT_COLOR, fontSize: 14, fontWeight: '400', fontFamily: 'system-ui', flex: 1 } as Style,
        get children() { var item = getItem(); return item ? item.label : ''; },
      }),
      glyphisRenderer.createComponent(View, {
        onPress: function() { var item = getItem(); if (item) onDelete(item.id); },
        style: { width: 30, height: 24, justifyContent: 'center' as const, alignItems: 'center' as const } as Style,
        children: glyphisRenderer.createComponent(Text, {
          style: { color: '#e94560', fontSize: 16, fontWeight: '700', fontFamily: 'system-ui', textAlign: 'center' as const } as Style,
          children: 'x',
        }),
      }),
    ],
  });
}

function App() {
  var rowsSignal = createSignal<RowData[]>([]);
  var rows = rowsSignal[0];
  var setRows = rowsSignal[1];
  var selectedSignal = createSignal<number | null>(null);
  var selectedId = selectedSignal[0];
  var setSelectedId = selectedSignal[1];
  var timingSignal = createSignal('');
  var timing = timingSignal[0];
  var setTiming = timingSignal[1];

  var listHandle: RecyclerListHandle | null = null;

  function timed(name: string, fn: () => void) {
    var t0 = performance.now();
    fn();
    var t1 = performance.now();
    setTiming(name + ': ' + (t1 - t0).toFixed(1) + 'ms');
  }

  function create1k() {
    timed('Create 1,000', function() {
      batch(function() {
        setRows(buildData(1000));
        setSelectedId(null);
      });
    });
  }

  function create10k() {
    timed('Create 10,000', function() {
      batch(function() {
        setRows(buildData(10000));
        setSelectedId(null);
      });
    });
  }

  function append1k() {
    timed('Append 1,000', function() {
      var prev = rows();
      setRows(prev.concat(buildData(1000)));
    });
  }

  function updateEvery10th() {
    timed('Update every 10th', function() {
      var data = rows();
      var updated = data.slice();
      for (var i = 0; i < updated.length; i += 10) {
        updated[i] = { id: updated[i].id, label: updated[i].label + ' !!!' };
      }
      setRows(updated);
    });
  }

  function swapRows() {
    timed('Swap Rows', function() {
      var data = rows();
      if (data.length > 998) {
        var next = data.slice();
        var tmp = next[1];
        next[1] = next[998];
        next[998] = tmp;
        setRows(next);
      }
    });
  }

  function clearRows() {
    timed('Clear', function() {
      batch(function() {
        setRows([]);
        setSelectedId(null);
      });
    });
  }

  function scrollDown() {
    if (listHandle) listHandle.pageDown();
  }

  function scrollUp() {
    if (listHandle) listHandle.pageUp();
  }

  // -- Toolbar --
  var toolbar = glyphisRenderer.createComponent(View, {
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
      glyphisRenderer.createComponent(ActionButton, { label: 'Update 10th', onPress: updateEvery10th }),
      glyphisRenderer.createComponent(ActionButton, { label: 'Swap', onPress: swapRows }),
      glyphisRenderer.createComponent(ActionButton, { label: 'Clear', onPress: clearRows }),
      glyphisRenderer.createComponent(ActionButton, { label: '\u25B2', onPress: scrollUp }),
      glyphisRenderer.createComponent(ActionButton, { label: '\u25BC', onPress: scrollDown }),
      glyphisRenderer.createComponent(Text, {
        style: { color: '#aaa', fontSize: 13, fontWeight: '400', fontFamily: 'monospace', marginLeft: 8 } as Style,
        get children() { return timing() || 'Ready'; },
      }),
    ],
  });

  // -- RecyclerList --
  var rowList = glyphisRenderer.createComponent(RecyclerList, {
    get data() { return rows(); },
    itemHeight: ROW_HEIGHT,
    style: { flex: 1, height: 700 } as Style,
    ref: function(handle: RecyclerListHandle) { listHandle = handle; },
    renderItem: function(getItem: () => RowData | null, getIndex: () => number) {
      return renderRow(getItem, getIndex, selectedId, function(id: number) { setSelectedId(id); }, function(id: number) {
        setRows(function(prev: RowData[]) { return prev.filter(function(r) { return r.id !== id; }); });
      });
    },
  });

  return glyphisRenderer.createComponent(View, {
    style: { flex: 1, backgroundColor: BG } as Style,
    children: [toolbar, rowList],
  });
}

// -- Bootstrap --

var canvas = document.getElementById('glyphis-root') as HTMLCanvasElement;
if (canvas) {
  var platform = createWebPlatform(canvas);
  render(function() { return glyphisRenderer.createComponent(App, {}); }, platform);
}
