// Android platform shim for Glyph.
//
// On Android the JS bundle runs inside a hidden WebView (V8) that has full
// browser APIs (requestAnimationFrame, Canvas2D, etc.).  Rendering is done
// natively by GlyphRenderView via the render-command bridge injected by
// GlyphRuntime.kt, but the JS entry point uses the standard web render
// function since the WebView environment is browser-compatible.
//
// This file exists for symmetry with the iOS platform shim and can be
// extended later if Android-specific JS-side behaviour is needed.

export { render } from '../react/platform-web';
