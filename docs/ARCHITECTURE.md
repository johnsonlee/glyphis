# Glyphis Architecture

## What is Glyphis

Glyphis is a cross-platform app framework with near-native performance and browser-based dev preview.

## Priorities

1. **Performance.** Near-native rendering performance is the top priority. Everything else — ecosystem size, developer familiarity, implementation complexity — can be traded off for performance.

2. **Cross-platform consistency.** The same app produces pixel-identical results on every platform. No platform-specific visual differences.

3. **Browser-based dev preview.** The browser is the environment where AI can most effectively understand UI output and receive the fastest feedback. Development in the browser eliminates device dependency — no simulator, no physical device, no native build cycle. AI and developers iterate in the browser, then compile to native.

These priorities, in this order, drive every technical decision that follows.

## Data Flow

```
State change
    → signal update (SolidJS)
    → effect runs on affected node(s)
    → scheduleRender()
    → compute layout (Yoga)
    → generate render commands (tree walk)
    → draw to platform surface
```

```
Platform input (touch / click / mouse)
    → hit test (layout coordinates)
    → event handler on node
    → state change (signal)
    → (cycle repeats for affected nodes only)
```

## Key Decisions

Each decision traces back to the priorities above.

### Single-surface rendering

*Driven by: Priority 2 (cross-platform consistency)*

All UI is drawn to one platform surface rather than mapped to platform-native views. Native views look and behave differently across platforms — a single surface guarantees pixel-identical output everywhere. The tradeoff: text input, scrolling, and accessibility must be implemented by the framework.

### Fine-grained reactivity (SolidJS)

*Driven by: Priority 1 (performance)*

Virtual DOM frameworks (React, Vue) diff the entire component subtree on every state change. This O(n) cost grows with UI complexity and constrains every framework built on them to converge on the same architecture.

Fine-grained reactivity (signals) connects state directly to the nodes that depend on it. When state changes, only those nodes update — no diffing, no tree walk. Update cost is O(1) relative to tree size.

Glyphis uses SolidJS as its reactivity and component model. SolidJS provides `createRenderer` for custom render targets — Glyphis implements this interface with 10 node-operation functions.

### GlyphisNode — thin wrapper over Yoga

*Driven by: Priority 1 (performance)*

The renderer needs a host instance type — an object it creates, organizes into a tree, and sets properties on. `GlyphisNode` is a thin wrapper that holds a Yoga node reference plus metadata (element type, style, event handlers, text content) as direct properties.

One tree. Zero conversion overhead. The wrapper exists because yoga-layout's WASM bindings return new JS wrapper objects from `getParent()`/`getChild()`, breaking WeakMap identity. Storing metadata directly on `GlyphisNode` avoids this issue with no performance cost.

### Yoga layout

*Driven by: Priority 1 (performance, proven at scale)*

Flexbox layout engine. Proven on billions of devices. Incremental layout via dirty marking.

**Web:** yoga-layout v3 (WASM, 53 KB gzipped). Runs in browser's WebAssembly runtime.

**Native (iOS/macOS/Android):** Yoga C++ compiled from source (`vendor/yoga`, facebook/yoga v3.2.1 git submodule) and linked directly into each platform's binary. A JS bridge (`src/yoga-native.ts`) is a drop-in replacement for the `yoga-layout` npm package — Bun build plugins redirect the import at bundle time.

Native Yoga is required because Apple's `JSContext` does not expose WebAssembly (JIT entitlement restricted to WKWebView). This is actually a performance advantage: native Yoga is faster than WASM Yoga.

### JavaScriptCore

*Driven by: Priority 2 (cross-platform consistency) + Priority 1 (performance)*

JS engine for native platforms. System-provided on iOS and macOS (zero binary size cost). Available on Android via jsc-android (JNI bridge). Same engine on all platforms eliminates behavioral divergence.

JSC was chosen over QuickJS (no JIT, 3-5x slower) after verification that SolidJS runs correctly on both engines. Performance priority drove the decision to keep JSC.

### Immediate-mode 2D rendering

*Driven by: pragmatism*

Current renderers use platform-native 2D APIs (not GPU-accelerated). GPU rendering is deferred until profiling identifies rendering as the bottleneck — currently it is not. The architecture does not change when the renderer changes; render commands are the abstraction boundary.

| Platform | Renderer |
|---|---|
| Web | Canvas 2D |
| macOS | CoreGraphics (CGContext) |
| iOS | CoreGraphics (CGContext) |
| Android | Android Canvas |

## Platform Interface

Each platform implements four capabilities:

```typescript
interface Platform {
  measureText(text: string, fontSize: number, fontFamily?: string, fontWeight?: string): { width: number; height: number };
  render(commands: RenderCommand[]): void;
  getViewport(): { width: number; height: number };
  onInput(callback: (event: InputEvent) => void): void;
}
```

Adding a new platform means implementing this interface. The framework core has no knowledge of any specific platform.

## Native Bridge Architecture

On native platforms, three bridges connect JS to platform capabilities:

1. **`__glyphis_native`** — Platform bridge (measureText, submitRenderCommands, getViewportSize, touch events, loadImage, showTextInput/updateTextInput/hideTextInput)
2. **`__yoga.*`** — Yoga bridge (node lifecycle, style setters, layout calculation, measure callbacks)
3. **Timer polyfills** — setTimeout/setInterval/queueMicrotask (JSC doesn't provide these natively)

On Android, the C++ bridge is split into focused files:
- `jsc_bridge.cpp` — JNI entry points and JSC context setup
- `platform_bridge.cpp` — `__glyphis_native` functions
- `yoga_bridge.cpp` — `__yoga` functions
- `polyfills.cpp` — JS environment polyfills
- `bridge_common.h` — shared declarations

The Yoga bridge uses an ID-based protocol: JS refers to Yoga nodes by integer ID, native maintains the mapping to `YGNodeRef`. Text measurement happens directly in native (CoreText/Android Paint) without JS callbacks.

The Platform interface is split into focused capabilities:
- `RenderPlatform` — core rendering (measureText, render, getViewport, onInput)
- `ImagePlatform` — image loading (loadImage, onImageLoaded)
- `TextInputPlatform` — text input overlay (showTextInput, updateTextInput, hideTextInput)

### Zero-JSON pipeline

No JSON serialization on any hot path:
- **Render commands**: JS passes the command array directly. C reads properties via `JSObjectGetProperty`, dispatches typed JNI calls per command. No `JSON.stringify`, no `JSONArray` parsing.
- **TextInput config**: 15 typed args passed directly via JSC → JNI. No JSON.
- **Native→JS callbacks**: Cached `JSValueRef` + `JSObjectCallAsFunction`. No `evaluateScript` string interpolation.
- **Timer callbacks**: C stores `JSValueRef` at registration, calls directly on fire. No eval.

### Browser API polyfills

Polyfilled on native JSC so npm packages work without modification:
- `fetch` (URLSession / HttpURLConnection backed)
- `localStorage` (UserDefaults / SharedPreferences backed)
- `URL` / `URLSearchParams`, `TextEncoder` / `TextDecoder`, `atob` / `btoa`
- `crypto.getRandomValues`, `AbortController`
- `setTimeout` / `setInterval`, `queueMicrotask`, `MessageChannel`, `performance.now`

## Resolved

- **Text input**: Native overlay text fields (NSTextField/UITextField/EditText) positioned over Canvas. Handles IME, autocorrect, clipboard natively.
- **Scroll physics**: Friction-based momentum, rubber-band overscroll, spring snap-back. Pixel-level smooth scrolling.
- **View recycling**: RecyclerList with signal-based slot recycling. 10K rows in 6ms (131x faster than baseline).
- **Batch measure**: Eliminated JS↔native bridge calls during layout — text measured directly in native C++/ObjC.
- **Zero-JSON pipeline**: All hot-path serialization eliminated. Direct JSValueRef property access + typed JNI calls.

## Open Questions

- **Accessibility**: Single-surface rendering bypasses platform accessibility trees. Needs a strategy before production use.
- **GPU rendering**: When to introduce, and whether it changes the architecture.
