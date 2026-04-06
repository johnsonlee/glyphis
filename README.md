# Glyphis

A cross-platform app framework using SolidJS fine-grained reactivity, Yoga flexbox layout, and single-surface 2D rendering. No DOM, no native widgets, no WebView.

## How it works

```
SolidJS Component (View / Text)
        |
  solid-js/universal createRenderer
        |
    GlyphisNode Tree (thin Yoga wrapper)
        |
    Yoga Layout
        |
  Render Commands (rect, text, border, clip, opacity)
        |
  Platform Surface
```

All UI is self-drawn to a single surface. When state changes, SolidJS signals update only the affected nodes -- no virtual DOM diffing. Yoga computes flexbox layout. A tree walk produces a flat array of render commands. The platform draws them.

## Platforms

| Platform | JS Engine | Yoga | Renderer | Notes |
|----------|-----------|------|----------|-------|
| Web | Browser | WASM (`yoga-layout`) | Canvas 2D | Dev server with HMR |
| macOS | System JSC | Native C++ (`vendor/yoga`) | CoreGraphics | Single binary (~334KB) |
| iOS | System JSC | Native C++ | CoreGraphics | .app bundle for Simulator |
| Android | jsc-android (JNI) | Native C++ | Android Canvas | APK via Gradle |

System JavaScriptCore on iOS/macOS has no WebAssembly support (Apple security policy), so Yoga is compiled as native C++ on all native platforms.

## Components

Two components exist today:

- **`View`** -- Flexbox container. Props: `style`, `onPress`, `onPressIn`, `onPressOut`, `onPointerMove`.
- **`Text`** -- Text display. Props: `style`, children (string).
- **`Button`** -- Pressable button with feedback. Props: `title`, `onPress`, `color`, `textColor`, `disabled`, `style`.
- **`Image`** -- Async image loading with resize modes. Props: `src`, `resizeMode` (cover/contain/stretch), `onLoad`, `style`.
- **`TextInput`** -- Text input with native overlay. Props: `value`, `onChangeText`, `placeholder`, `keyboardType`, `secureTextEntry`, `multiline`, `maxLength`, `onFocus`, `onBlur`, `onSubmitEditing`, `style`.
- **`ScrollView`** -- Scrollable container with momentum and rubber-band. Props: `style`, `contentHeight`, `horizontal`, `children`.
- **`RecyclerList`** -- Virtual list with node recycling. Only creates visible rows. Props: `data`, `renderItem`, `itemHeight`, `ref` (scroll handle).

## Quick start

```bash
# Web dev server
bun run dev -- examples/calculator/app.ts
# Open http://localhost:3000

# macOS native (single binary)
bun run scripts/build-macos.ts examples/calculator/app.ts
.glyphis-build/macos/GlyphisApp

# iOS simulator
bun run scripts/build-ios.ts examples/calculator/app.ts

# Android APK
bun run scripts/build-android.ts examples/calculator/app.ts
```

## Example

The calculator example (`examples/calculator/app.ts`) is an iOS Calculator clone built with SolidJS:

```typescript
import { render, View, Text, createWebPlatform, createSignal } from 'glyphis';
import type { Style } from 'glyphis';

// ... see examples/calculator/app.ts for the full implementation
```

Other examples:

- `examples/bench-rows/` -- 1K/10K rows benchmark
- `examples/bench-dbmon/` -- Database monitoring grid benchmark
- `examples/bench-anim/` -- 200 animated boxes benchmark
- `examples/counter/` -- Minimal counter

## Styling

Styles use Yoga's flexbox model. All numeric values are logical pixels.

```typescript
const style: Style = {
  // Dimensions
  width: 200, height: 100,

  // Flexbox
  flex: 1,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 8,

  // Spacing
  padding: 16, margin: 8,

  // Visual
  backgroundColor: '#FFFFFF',
  borderRadius: 8,
  borderWidth: 1, borderColor: '#CCCCCC',
  opacity: 0.9,
  overflow: 'hidden',

  // Text
  color: '#333333',
  fontSize: 16, fontWeight: 'bold',
  textAlign: 'center',
};
```

## Project structure

```
src/
  renderer.ts         SolidJS universal renderer (createRenderer)
  node.ts             GlyphisNode type (thin Yoga wrapper)
  styles.ts           Style -> Yoga property mapping
  commands.ts         Tree walk -> RenderCommand[]
  events.ts           Hit testing + press lifecycle
  components.ts       View, Text component helpers
  types.ts            Style, RenderCommand, Platform, InputEvent
  yoga-native.ts      Drop-in yoga-layout replacement for native (calls __yoga.* bridge)
  platform/
    web.ts            Canvas 2D browser platform
    native.ts         Native platform adapter (__glyphis_native bridge)
  devserver/          Bun dev server with HMR

native/
  macos/GlyphisShell/   Swift macOS shell (CoreGraphics + YogaBridge)
  ios/GlyphisShell/     Swift iOS shell (CoreGraphics + YogaBridge)
  android/              Kotlin/JNI Android shell (Canvas + jsc_bridge.cpp)

vendor/
  yoga/               facebook/yoga v3.2.1 (git submodule)

scripts/
  build-macos.ts      Bundle JS + compile Swift + Yoga -> single binary
  build-ios.ts        Bundle JS + compile Yoga + xcodebuild
  build-android.ts    Bundle JS + Gradle build (CMake compiles Yoga + JNI)

examples/
  calculator/         iOS Calculator clone
  image-gallery/      Image loading + resize modes
  text-input/         Form with 5 input types
  bench-rows/         1K/10K rows benchmark (with RecyclerList)
  bench-dbmon/        Database monitoring grid benchmark
  bench-anim/         200 animated boxes benchmark
  bench-bridge/       JS↔native bridge micro-benchmark
```

## Browser API compatibility

Polyfilled on native (JSC) so npm packages work without modification:

`fetch`, `WebSocket`, `localStorage`, `setTimeout`/`setInterval`, `queueMicrotask`, `Promise`, `MessageChannel`, `performance.now`, `URL`/`URLSearchParams`, `TextEncoder`/`TextDecoder`, `atob`/`btoa`, `crypto.getRandomValues`, `AbortController`, `console`, `requestAnimationFrame`

## Not implemented yet

- Accessibility (single-surface rendering bypasses platform accessibility trees)
- GPU rendering (currently CPU 2D only)

## Development

```bash
bun test              # Run tests
bun run dev -- <app>  # Dev server with HMR
```

## License

MIT
