#ifndef BRIDGE_COMMON_H
#define BRIDGE_COMMON_H

#include <jni.h>
#include <string.h>
#include <stdlib.h>
#include <math.h>
#include <android/log.h>

#include <JavaScriptCore/JavaScript.h>
#include <yoga/Yoga.h>

#define LOG_TAG "GlyphisJSC"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

/* ------------------------------------------------------------------ */
/*  Globals (defined in jsc_bridge.cpp)                               */
/* ------------------------------------------------------------------ */

extern JSGlobalContextRef g_context;
extern JavaVM*            g_jvm;
extern jobject            g_runtime;

/* Cached JNI method ID for onMeasureText */
extern jmethodID g_measureTextMethod;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

char* JSStringToCString(JSStringRef jsStr);
JSStringRef CStringToJSString(const char* str);
JNIEnv* getJNIEnv(void);

void setFunctionProperty(
    JSContextRef ctx, JSObjectRef parent, const char* name,
    JSObjectCallAsFunctionCallback callback);

void setStringProperty(
    JSContextRef ctx, JSObjectRef parent,
    const char* key, const char* value);

/* ------------------------------------------------------------------ */
/*  Cached JS callback refs (defined in jsc_bridge.cpp)               */
/* ------------------------------------------------------------------ */

extern JSValueRef g_touch_callback;      /* __glyphis_handleTouch     */
extern JSValueRef g_text_change_cb;      /* __glyphis_onTextChange    */
extern JSValueRef g_text_submit_cb;      /* __glyphis_onTextSubmit    */
extern JSValueRef g_text_focus_cb;       /* __glyphis_onTextFocus     */
extern JSValueRef g_text_blur_cb;        /* __glyphis_onTextBlur      */
extern JSValueRef g_image_loaded_cb;     /* __glyphis_onImageLoaded   */
extern JSValueRef g_viewport_update_cb;  /* __glyphis_updateViewport  */
extern JSValueRef g_fetch_response_cb;   /* __glyphis_onFetchResponse */
extern JSValueRef g_fetch_error_cb;      /* __glyphis_onFetchError    */
extern JSValueRef g_ws_open_cb;          /* __glyphis_onWsOpen        */
extern JSValueRef g_ws_message_cb;       /* __glyphis_onWsMessage     */
extern JSValueRef g_ws_close_cb;         /* __glyphis_onWsClose       */
extern JSValueRef g_ws_error_cb;         /* __glyphis_onWsError       */
extern JSValueRef g_a11y_action_cb;      /* __glyphis_onAccessibilityAction */

/**
 * Look up and cache all __glyphis_* global callback functions.
 * Must be called AFTER the bundle has been evaluated.
 */
void cache_js_callbacks(JSContextRef ctx);

/**
 * Call a cached JS callback directly via JSObjectCallAsFunction.
 * Safe to call with NULL callback (no-op).
 */
void call_js_callback(JSContextRef ctx, JSValueRef callback, size_t argc, JSValueRef argv[]);

/* ------------------------------------------------------------------ */
/*  Registration functions (called from nativeInit)                   */
/* ------------------------------------------------------------------ */

void register_polyfills(JSContextRef ctx, JSObjectRef global);
void register_platform_bridge(JSContextRef ctx, JSObjectRef global);
void register_yoga_bridge(JSContextRef ctx, JSObjectRef global);

/* ------------------------------------------------------------------ */
/*  Yoga cleanup (called from nativeDestroy)                          */
/* ------------------------------------------------------------------ */

void yoga_destroy_all(void);

#endif /* BRIDGE_COMMON_H */

/* Timer callback direct invocation */
void fire_timer_callback(int timerId);
