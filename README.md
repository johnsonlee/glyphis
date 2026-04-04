# Glyph

A cross-platform UI framework that renders your React and Vue apps with custom GPU-accelerated rendering -- not WebViews, not native widgets.

## What is Glyph?

Glyph takes your existing React or Vue code and renders it directly to canvas surfaces using native GPU APIs (Core Graphics on iOS, Android Canvas on Android, Canvas2D/CanvasKit on the web). Unlike WebView wrappers, there is no DOM. Unlike React Native, there are no platform-specific widgets. Your app looks pixel-identical on every platform.

The layout engine is Yoga (compiled to WASM), so you write styles using the same Flexbox model you already know. The rendering pipeline produces a stream of draw commands (rectangles, text, images, clipping, opacity) that each platform's native renderer consumes directly.

## Architecture

```
  Your React or Vue App
          |
  react-reconciler / Vue createRenderer
          |
      GlyphNode Tree
          |
      Yoga Layout (WASM)
          |
    Render Commands
          |
  ┌───────┼────────┬──────────────┐
  |       |        |              |
Canvas2D  CanvasKit  CoreGraphics  Android Canvas
 (Web)    (Web/GPU)   (iOS/JSC)    (Android/V8)
```

**GlyphNode Tree** -- A lightweight scene graph produced by the framework-specific reconciler. Each node carries style props and event handlers.

**Yoga Layout** -- Computes Flexbox layout in WASM. Glyph also ships a built-in layout engine (`glyph`) as a fallback.

**Render Commands** -- A flat array of JSON-serializable drawing instructions (`rect`, `text`, `image`, `border`, `clip`, `restore`, `opacity`). On native platforms these are sent across the JS-to-native bridge as a single JSON string per frame.

## Quick Start

```bash
mkdir my-app && cd my-app
bun init
bun add glyph react
```

Create `app.tsx`:

```tsx
import React, { useState, useCallback } from 'react';
import { View, Text, Button } from 'glyph/react';
import { render } from 'glyph/react/platform-web';

function App() {
  const [count, setCount] = useState(0);
  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 48, fontWeight: 'bold' }}>{String(count)}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button title="-" onPress={decrement} color="#F44336" />
        <Button title="+" onPress={increment} color="#4CAF50" />
      </View>
    </View>
  );
}

const canvas = document.getElementById('glyph-root') as HTMLCanvasElement;
render(<App />, canvas);
```

Run the dev server:

```bash
bun run dev -- app.tsx
# Open http://localhost:3000
```

## Vue Support

Glyph ships a Vue 3 custom renderer with the same rendering pipeline.

```typescript
import { defineComponent, ref, h } from '@vue/runtime-core';
import { GView, GText, GButton } from 'glyph/vue';
import { render } from 'glyph/vue/platform-web';

const App = defineComponent({
  setup() {
    const count = ref(0);
    return () => h(GView, {
      style: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    }, [
      h(GText, { style: { fontSize: 48, fontWeight: 'bold' } }, () => String(count.value)),
      h(GView, { style: { flexDirection: 'row', gap: 12 } }, [
        h(GButton, { title: '-', onPress: () => count.value--, color: '#F44336' }),
        h(GButton, { title: '+', onPress: () => count.value++, color: '#4CAF50' }),
      ]),
    ]);
  },
});

const canvas = document.getElementById('glyph-root') as HTMLCanvasElement;
render(App, canvas);
```

## Components

### React

| Component | Key Props | Description |
|-----------|-----------|-------------|
| `View` | `style`, `onPress`, `onPressIn`, `onPressOut`, `onLayout` | Flexbox container (defaults to `flexDirection: 'column'`) |
| `Text` | `style`, `numberOfLines`, `onPress` | Text display (default 14px, system-ui, black) |
| `Button` | `title`, `onPress`, `disabled`, `color`, `style` | Pressable button with built-in press feedback |
| `Image` | `src`, `resizeMode`, `style` | Image display (`cover`, `contain`, `stretch`, `center`) |
| `ScrollView` | `style`, `contentContainerStyle`, `horizontal` | Scrollable container |
| `TextInput` | `value`, `placeholder`, `onChangeText`, `multiline`, `maxLength`, `editable` | Text input with controlled/uncontrolled modes |
| `FlatList` | `data`, `renderItem`, `keyExtractor`, `horizontal`, `ItemSeparatorComponent` | Virtualized list |

### Vue

| Component | Key Props | Description |
|-----------|-----------|-------------|
| `GView` | `style`, `onPress`, `onPressIn`, `onPressOut` | Flexbox container |
| `GText` | `style`, `onPress` | Text display |
| `GButton` | `title`, `onPress`, `disabled`, `color`, `style` | Pressable button |
| `GImage` | `src`, `resizeMode`, `style` | Image display |

## Styling

Styles use a Flexbox model computed by Yoga. All numeric values are in logical pixels.

```tsx
const styles: Style = {
  // Dimensions
  width: 200, height: 100, minWidth: 50, maxHeight: 300,

  // Flexbox container
  flex: 1,
  flexDirection: 'row',          // 'row' | 'column' | 'row-reverse' | 'column-reverse'
  justifyContent: 'center',      // 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'
  alignItems: 'center',          // 'flex-start' | 'flex-end' | 'center' | 'stretch'
  gap: 8, rowGap: 4, columnGap: 12,

  // Flexbox item
  flexGrow: 1, flexShrink: 0, flexBasis: 'auto',
  alignSelf: 'center',

  // Spacing
  padding: 16, paddingHorizontal: 20, paddingVertical: 10,
  margin: 8, marginTop: 12,

  // Position
  position: 'absolute', top: 0, left: 0,

  // Visual
  backgroundColor: '#FFFFFF',
  borderRadius: 8,
  borderWidth: 1, borderColor: '#CCCCCC',
  opacity: 0.9,
  overflow: 'hidden',            // 'visible' | 'hidden' | 'scroll'

  // Text
  color: '#333333',
  fontSize: 16, fontWeight: 'bold', fontFamily: 'system-ui',
  textAlign: 'center',
  lineHeight: 24, letterSpacing: 0.5,
  textDecorationLine: 'underline',
  textTransform: 'uppercase',
};
```

## Platform Support

| Platform | Renderer | JS Engine | Status |
|----------|----------|-----------|--------|
| Browser | Canvas2D | Browser V8/SpiderMonkey | Working |
| Browser | CanvasKit (Skia via WASM) | Browser V8/SpiderMonkey | Working |
| iOS | Core Graphics | JavaScriptCore | Working |
| Android | Android Canvas | V8 (hidden WebView) | Working |

### Layout Engines

| Engine | Description | Default |
|--------|-------------|---------|
| `yoga` | Yoga Flexbox via WASM (`yoga-wasm-web`) | Yes |
| `glyph` | Built-in Flexbox implementation | No |

### Web Renderers

| Renderer | Description |
|----------|-------------|
| `canvas2d` | Standard Canvas 2D API (default, zero dependencies) |
| `canvaskit` | Skia GPU rendering via CanvasKit WASM |

## Building Native Apps

### iOS

Bundles your app's JS, generates an Xcode project, and builds for the iOS Simulator:

```bash
bun run scripts/build-ios.ts examples/react-counter/app.tsx
```

The iOS shell uses `JavaScriptCore` to run your bundled JS. Render commands cross the bridge as JSON and are drawn by a `GlyphRenderView` backed by Core Graphics. Touch events flow back from UIKit into JS via the same bridge.

To run in the simulator after building:

```bash
xcrun simctl boot "iPhone 15"
xcrun simctl install booted .glyph-build/ios/DerivedData/Build/Products/Debug-iphonesimulator/GlyphShell.app
xcrun simctl launch booted com.glyph.shell
```

### Android

Bundles your app's JS and builds a debug APK with Gradle:

```bash
bun run scripts/build-android.ts examples/react-counter/app.tsx
```

The Android shell uses a hidden `WebView` purely as a V8 JS engine (it is never displayed). Render commands are forwarded to a custom `GlyphRenderView` via a `@JavascriptInterface` bridge and drawn with Android Canvas.

To install after building:

```bash
adb install native/android/app/build/outputs/apk/debug/app-debug.apk
```

## Comparison with Existing Solutions

| Feature | Glyph | React Native | Flutter | Capacitor/Ionic | NativeScript |
|---------|-------|-------------|---------|-----------------|-------------|
| UI framework | React + Vue | React only | Dart/Flutter | Web (any) | JS/TS |
| Rendering | Custom canvas | Native widgets | Skia/Impeller | WebView | Native widgets |
| npm ecosystem | Full | Partial | pub.dev only | Full | Partial |
| Cross-platform consistency | Pixel-identical | Platform-specific | Pixel-identical | Web-like | Platform-specific |
| Bundle size (JS) | ~300 KB | ~7 MB | ~15 MB | ~2 MB | ~10 MB |
| Learning curve | None (React/Vue) | Learn RN APIs | Learn Dart | None (Web) | Learn NS APIs |
| Web support | Native | react-native-web | Flutter Web | Native | No |
| Custom rendering | Yes | No (platform widgets) | Yes | No (WebView) | No (platform widgets) |

**vs React Native** -- React Native maps components to platform-specific native widgets, which means a `<Button>` looks different on iOS and Android. Glyph renders every pixel itself, so your app looks the same everywhere. React Native also requires learning RN-specific APIs and components; Glyph uses standard React with a familiar style system.

**vs Flutter** -- Flutter requires learning Dart and an entirely new widget system. Your existing React/Vue skills and npm packages do not transfer. Glyph lets you use the code you already have and the entire npm ecosystem.

**vs Capacitor/Ionic** -- These wrap web apps in a WebView, inheriting DOM layout overhead and web-tier performance. Glyph renders via native GPU APIs (Core Graphics, Android Canvas) with no DOM layer.

**vs NativeScript** -- NativeScript maps to native widgets like React Native does. Glyph's custom rendering ensures pixel-identical output and avoids platform-specific layout quirks.

## Development

```bash
# Run the full test suite with coverage
bun test

# Dev server with HMR (browser preview)
bun run dev -- examples/react-counter/app.tsx
# Open http://localhost:3000

# Debug mode (shows layout borders)
# Open http://localhost:3000?debug=true

# Production build for web
bun run build
```

## Project Structure

```
src/
  react/              React integration (reconciler, components, host config)
  vue/                Vue 3 custom renderer and components
  layout/             Layout engines (Yoga WASM + built-in)
  renderers/          Canvas2D, CanvasKit, render command batcher
  platform/           Platform entry points (iOS, Android, web)
  devserver/          Bun dev server with HMR
  types.ts            Core type definitions (Style, Renderer, RenderCommand, etc.)

native/
  ios/                Swift shell (GlyphRuntime, GlyphRenderView, Xcode project)
  android/            Kotlin shell (GlyphRuntime, GlyphRenderView, Gradle project)

scripts/
  build-ios.ts        Bundle JS + build iOS app via xcodebuild
  build-android.ts    Bundle JS + build Android APK via Gradle

examples/
  react-counter/      React counter app
  react-todo/         React todo list app
  vue-counter/        Vue counter app
  calculator/         iOS Calculator clone (built with Glyph's own JSX runtime)

tests/                34 test files covering layout, rendering, events, components,
                      reconciler, platform bridges, and e2e scenarios
```

## License

MIT
