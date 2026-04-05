import { render, View, Text, Image, Button, ScrollView, createWebPlatform, createSignal, glyphisRenderer } from '../../src';
import type { Style } from '../../src';

var PHOTOS = [
  'https://picsum.photos/id/10/400/300',
  'https://picsum.photos/id/20/400/300',
  'https://picsum.photos/id/30/400/300',
  'https://picsum.photos/id/40/400/300',
  'https://picsum.photos/id/50/400/300',
  'https://picsum.photos/id/60/400/300',
  'https://picsum.photos/id/70/400/300',
  'https://picsum.photos/id/80/400/300',
  'https://picsum.photos/id/90/400/300',
  'https://picsum.photos/id/100/400/300',
  'https://picsum.photos/id/110/400/300',
  'https://picsum.photos/id/120/400/300',
];

var RESIZE_MODES: Array<'cover' | 'contain' | 'stretch'> = ['cover', 'contain', 'stretch'];

function App() {
  var modeSignal = createSignal(0);
  var modeIndex = modeSignal[0];
  var setModeIndex = modeSignal[1];
  var loadedSignal = createSignal(0);
  var loadedCount = loadedSignal[0];
  var setLoadedCount = loadedSignal[1];

  function cycleMode() {
    setModeIndex(function(prev: number) { return (prev + 1) % RESIZE_MODES.length; });
  }

  // Header
  var header = glyphisRenderer.createComponent(View, {
    style: {
      backgroundColor: '#1a1a2e',
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    } as Style,
    children: [
      glyphisRenderer.createComponent(Text, {
        style: { color: '#fff', fontSize: 20, fontWeight: '700' } as Style,
        children: 'Image Gallery',
      }),
      glyphisRenderer.createComponent(View, {
        style: { flexDirection: 'row' as const, alignItems: 'center' as const } as Style,
        children: [
          glyphisRenderer.createComponent(Text, {
            style: { color: '#aaa', fontSize: 13, marginRight: 8 } as Style,
            get children() { return loadedCount() + '/' + PHOTOS.length + ' loaded'; },
          }),
          glyphisRenderer.createComponent(Button, {
            get title() { return 'Mode: ' + RESIZE_MODES[modeIndex()]; },
            onPress: cycleMode,
            color: '#533483',
          }),
        ],
      }),
    ],
  });

  // Photo grid — 2 columns
  var CARD_GAP = 8;
  var grid = glyphisRenderer.createComponent(View, {
    style: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      padding: CARD_GAP,
    } as Style,
    get children() {
      var mode = RESIZE_MODES[modeIndex()];
      return PHOTOS.map(function(url, i) {
        return glyphisRenderer.createComponent(View, {
          style: {
            width: '47%' as any,
            marginHorizontal: '1.5%' as any,
            marginBottom: CARD_GAP,
            borderRadius: 8,
            overflow: 'hidden' as const,
            backgroundColor: '#16213e',
          } as Style,
          children: [
            glyphisRenderer.createComponent(Image, {
              src: url,
              resizeMode: mode,
              style: { width: '100%' as any, height: 120 } as Style,
              onLoad: function() {
                setLoadedCount(function(c: number) { return c + 1; });
              },
            }),
            glyphisRenderer.createComponent(View, {
              style: { padding: 8 } as Style,
              children: glyphisRenderer.createComponent(Text, {
                style: { color: '#ccc', fontSize: 12 } as Style,
                children: 'Photo #' + (i + 1),
              }),
            }),
          ],
        });
      });
    },
  });

  var scrollableGrid = glyphisRenderer.createComponent(ScrollView, {
    style: { flex: 1 } as Style,
    contentHeight: Math.ceil(PHOTOS.length / 2) * 170,
    children: grid,
  });

  return glyphisRenderer.createComponent(View, {
    style: { flex: 1, backgroundColor: '#0f0f23' } as Style,
    children: [header, scrollableGrid],
  });
}

// -- Bootstrap --
var canvas = document.getElementById('glyphis-root') as HTMLCanvasElement;
if (canvas) {
  var platform = createWebPlatform(canvas);
  render(function() { return glyphisRenderer.createComponent(App, {}); }, platform);
}
