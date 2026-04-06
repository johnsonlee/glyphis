#include "bridge_common.h"

/* ------------------------------------------------------------------ */
/*  Globals                                                           */
/* ------------------------------------------------------------------ */

JSGlobalContextRef g_context          = NULL;
JavaVM*            g_jvm              = NULL;
jobject            g_runtime          = NULL;   /* GlobalRef to GlyphisRuntime */
jmethodID          g_measureTextMethod = NULL;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

char* JSStringToCString(JSStringRef jsStr) {
    size_t len = JSStringGetMaximumUTF8CStringSize(jsStr);
    char* buf = (char*)malloc(len);
    JSStringGetUTF8CString(jsStr, buf, len);
    return buf;
}

JSStringRef CStringToJSString(const char* str) {
    return JSStringCreateWithUTF8CString(str);
}

JNIEnv* getJNIEnv(void) {
    JNIEnv* env = NULL;
    g_jvm->GetEnv((void**)&env, JNI_VERSION_1_6);
    return env;
}

void setFunctionProperty(
    JSContextRef ctx, JSObjectRef parent, const char* name,
    JSObjectCallAsFunctionCallback callback)
{
    JSStringRef jname = CStringToJSString(name);
    JSObjectRef fn    = JSObjectMakeFunctionWithCallback(ctx, jname, callback);
    JSObjectSetProperty(ctx, parent, jname, fn, 0, NULL);
    JSStringRelease(jname);
}

void setStringProperty(
    JSContextRef ctx, JSObjectRef parent,
    const char* key, const char* value)
{
    JSStringRef jkey = CStringToJSString(key);
    JSStringRef jval = CStringToJSString(value);
    JSObjectSetProperty(ctx, parent, jkey,
        JSValueMakeString(ctx, jval), 0, NULL);
    JSStringRelease(jkey);
    JSStringRelease(jval);
}

/* ------------------------------------------------------------------ */
/*  Cached JS callback references                                     */
/* ------------------------------------------------------------------ */

JSValueRef g_touch_callback     = NULL;
JSValueRef g_text_change_cb     = NULL;
JSValueRef g_text_submit_cb     = NULL;
JSValueRef g_text_focus_cb      = NULL;
JSValueRef g_text_blur_cb       = NULL;
JSValueRef g_image_loaded_cb    = NULL;
JSValueRef g_viewport_update_cb = NULL;
JSValueRef g_fetch_response_cb  = NULL;
JSValueRef g_fetch_error_cb     = NULL;
JSValueRef g_ws_open_cb         = NULL;
JSValueRef g_ws_message_cb      = NULL;
JSValueRef g_ws_close_cb        = NULL;
JSValueRef g_ws_error_cb        = NULL;
JSValueRef g_a11y_action_cb     = NULL;

static void cache_one_callback(JSContextRef ctx, JSObjectRef global,
                                const char* name, JSValueRef* slot)
{
    JSStringRef jsName = JSStringCreateWithUTF8CString(name);
    JSValueRef val = JSObjectGetProperty(ctx, global, jsName, NULL);
    if (val && !JSValueIsUndefined(ctx, val) && JSValueIsObject(ctx, val)) {
        if (*slot) JSValueUnprotect(ctx, *slot);
        *slot = val;
        JSValueProtect(ctx, *slot);
    }
    JSStringRelease(jsName);
}

/* Delete a global property after caching its JSValueRef */
static void delete_global(JSContextRef ctx, JSObjectRef global, const char* name) {
    JSStringRef jsName = JSStringCreateWithUTF8CString(name);
    JSObjectDeleteProperty(ctx, global, jsName, NULL);
    JSStringRelease(jsName);
}

void cache_js_callbacks(JSContextRef ctx) {
    JSObjectRef global = JSContextGetGlobalObject(ctx);

    /* Cache JSValueRef for each callback (JSValueProtect keeps them alive) */
    cache_one_callback(ctx, global, "__glyphis_handleTouch",   &g_touch_callback);
    cache_one_callback(ctx, global, "__glyphis_onTextChange",  &g_text_change_cb);
    cache_one_callback(ctx, global, "__glyphis_onTextSubmit",  &g_text_submit_cb);
    cache_one_callback(ctx, global, "__glyphis_onTextFocus",   &g_text_focus_cb);
    cache_one_callback(ctx, global, "__glyphis_onTextBlur",    &g_text_blur_cb);
    cache_one_callback(ctx, global, "__glyphis_onImageLoaded",  &g_image_loaded_cb);
    cache_one_callback(ctx, global, "__glyphis_updateViewport", &g_viewport_update_cb);
    cache_one_callback(ctx, global, "__glyphis_onFetchResponse",&g_fetch_response_cb);
    cache_one_callback(ctx, global, "__glyphis_onFetchError",   &g_fetch_error_cb);
    cache_one_callback(ctx, global, "__glyphis_onWsOpen",       &g_ws_open_cb);
    cache_one_callback(ctx, global, "__glyphis_onWsMessage",    &g_ws_message_cb);
    cache_one_callback(ctx, global, "__glyphis_onWsClose",      &g_ws_close_cb);
    cache_one_callback(ctx, global, "__glyphis_onWsError",      &g_ws_error_cb);
    cache_one_callback(ctx, global, "__glyphis_onAccessibilityAction", &g_a11y_action_cb);

    /* Remove internal callbacks from globalThis — C holds the only reference.
       App code cannot override or inspect them after this point. */
    delete_global(ctx, global, "__glyphis_handleTouch");
    delete_global(ctx, global, "__glyphis_onTextChange");
    delete_global(ctx, global, "__glyphis_onTextSubmit");
    delete_global(ctx, global, "__glyphis_onTextFocus");
    delete_global(ctx, global, "__glyphis_onTextBlur");
    delete_global(ctx, global, "__glyphis_onImageLoaded");
    delete_global(ctx, global, "__glyphis_updateViewport");
    delete_global(ctx, global, "__glyphis_onFetchResponse");
    delete_global(ctx, global, "__glyphis_onFetchError");
    delete_global(ctx, global, "__glyphis_onWsOpen");
    delete_global(ctx, global, "__glyphis_onWsMessage");
    delete_global(ctx, global, "__glyphis_onWsClose");
    delete_global(ctx, global, "__glyphis_onWsError");
    delete_global(ctx, global, "__glyphis_onAccessibilityAction");
}

void call_js_callback(JSContextRef ctx, JSValueRef callback, size_t argc, JSValueRef argv[]) {
    if (!callback || JSValueIsUndefined(ctx, callback)) return;
    JSValueRef exception = NULL;
    JSObjectCallAsFunction(ctx, (JSObjectRef)callback, NULL, argc, argv, &exception);
    if (exception) {
        JSStringRef exStr = JSValueToStringCopy(ctx, exception, NULL);
        char* msg = JSStringToCString(exStr);
        LOGE("[JS Error] callback: %s", msg);
        free(msg);
        JSStringRelease(exStr);
    }
}

static void unprotect_cached_callbacks(JSContextRef ctx) {
    JSValueRef* slots[] = {
        &g_touch_callback, &g_text_change_cb, &g_text_submit_cb,
        &g_text_focus_cb, &g_text_blur_cb, &g_image_loaded_cb,
        &g_viewport_update_cb, &g_fetch_response_cb, &g_fetch_error_cb,
        &g_ws_open_cb, &g_ws_message_cb, &g_ws_close_cb, &g_ws_error_cb,
        &g_a11y_action_cb
    };
    for (int i = 0; i < 14; i++) {
        if (*slots[i]) {
            JSValueUnprotect(ctx, *slots[i]);
            *slots[i] = NULL;
        }
    }
}

/* ------------------------------------------------------------------ */
/*  setTimeout callback GC protection                                 */
/* ------------------------------------------------------------------ */

#define MAX_PROTECTED_VALUES 256
static JSValueRef g_protected_values[MAX_PROTECTED_VALUES];
static int        g_protected_count = 0;

static void unprotect_all_values(JSContextRef ctx) {
    for (int i = 0; i < g_protected_count; i++) {
        JSValueUnprotect(ctx, g_protected_values[i]);
        g_protected_values[i] = NULL;
    }
    g_protected_count = 0;
}

/* ------------------------------------------------------------------ */
/*  JNI entry points                                                  */
/* ------------------------------------------------------------------ */

extern "C" {

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeInit(JNIEnv* env, jobject thiz)
{
    env->GetJavaVM(&g_jvm);
    g_runtime = env->NewGlobalRef(thiz);

    /* Cache onMeasureText method ID for native measure during layout */
    jclass runtimeCls = env->GetObjectClass(thiz);
    g_measureTextMethod = env->GetMethodID(runtimeCls,
        "onMeasureText", "(Ljava/lang/String;DLjava/lang/String;)[D");
    env->DeleteLocalRef(runtimeCls);

    g_context = JSGlobalContextCreate(NULL);
    JSObjectRef global = JSContextGetGlobalObject(g_context);

    /* Register all bridges */
    register_platform_bridge(g_context, global);
    register_polyfills(g_context, global);
    register_yoga_bridge(g_context, global);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeEvaluateScript(
    JNIEnv* env, jobject thiz, jstring script)
{
    if (!g_context) return;

    const char*  cScript  = env->GetStringUTFChars(script, NULL);
    JSStringRef  jsScript = CStringToJSString(cScript);

    JSValueRef exception = NULL;
    JSEvaluateScript(g_context, jsScript, NULL, NULL, 0, &exception);

    if (exception) {
        JSStringRef exStr = JSValueToStringCopy(g_context, exception, NULL);
        char* msg = JSStringToCString(exStr);
        LOGE("[JS Error] %s", msg);
        free(msg);
        JSStringRelease(exStr);
    }

    env->ReleaseStringUTFChars(script, cScript);
    JSStringRelease(jsScript);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeDestroy(
    JNIEnv* env, jobject thiz)
{
    if (g_context) {
        unprotect_cached_callbacks(g_context);
        unprotect_all_values(g_context);
        yoga_destroy_all();
        JSGlobalContextRelease(g_context);
        g_context = NULL;
    }
    if (g_runtime) {
        env->DeleteGlobalRef(g_runtime);
        g_runtime = NULL;
    }
    g_measureTextMethod = NULL;
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeHandleTouch(
    JNIEnv* env, jobject thiz, jstring type, jdouble x, jdouble y)
{
    if (!g_context || !g_touch_callback) return;

    const char* cType = env->GetStringUTFChars(type, NULL);
    JSStringRef jsType = JSStringCreateWithUTF8CString(cType);
    JSValueRef args[3];
    args[0] = JSValueMakeString(g_context, jsType);
    args[1] = JSValueMakeNumber(g_context, x);
    args[2] = JSValueMakeNumber(g_context, y);
    call_js_callback(g_context, g_touch_callback, 3, args);
    JSStringRelease(jsType);
    env->ReleaseStringUTFChars(type, cType);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireTimer(
    JNIEnv* env, jobject thiz, jint timerId)
{
    if (!g_context) return;
    /* Direct callback invocation — no evaluateScript */
    fire_timer_callback(timerId);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeCacheCallbacks(
    JNIEnv* env, jobject thiz)
{
    if (!g_context) return;
    cache_js_callbacks(g_context);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireTextChange(
    JNIEnv* env, jobject thiz, jstring inputId, jstring text)
{
    if (!g_context || !g_text_change_cb) return;
    const char* idStr   = env->GetStringUTFChars(inputId, NULL);
    const char* textStr = env->GetStringUTFChars(text, NULL);
    JSStringRef jsId   = JSStringCreateWithUTF8CString(idStr);
    JSStringRef jsText = JSStringCreateWithUTF8CString(textStr);
    JSValueRef args[2];
    args[0] = JSValueMakeString(g_context, jsId);
    args[1] = JSValueMakeString(g_context, jsText);
    call_js_callback(g_context, g_text_change_cb, 2, args);
    JSStringRelease(jsId);
    JSStringRelease(jsText);
    env->ReleaseStringUTFChars(inputId, idStr);
    env->ReleaseStringUTFChars(text, textStr);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireTextSubmit(
    JNIEnv* env, jobject thiz, jstring inputId)
{
    if (!g_context || !g_text_submit_cb) return;
    const char* idStr = env->GetStringUTFChars(inputId, NULL);
    JSStringRef jsId  = JSStringCreateWithUTF8CString(idStr);
    JSValueRef args[1];
    args[0] = JSValueMakeString(g_context, jsId);
    call_js_callback(g_context, g_text_submit_cb, 1, args);
    JSStringRelease(jsId);
    env->ReleaseStringUTFChars(inputId, idStr);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireTextFocus(
    JNIEnv* env, jobject thiz, jstring inputId)
{
    if (!g_context || !g_text_focus_cb) return;
    const char* idStr = env->GetStringUTFChars(inputId, NULL);
    JSStringRef jsId  = JSStringCreateWithUTF8CString(idStr);
    JSValueRef args[1];
    args[0] = JSValueMakeString(g_context, jsId);
    call_js_callback(g_context, g_text_focus_cb, 1, args);
    JSStringRelease(jsId);
    env->ReleaseStringUTFChars(inputId, idStr);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireTextBlur(
    JNIEnv* env, jobject thiz, jstring inputId)
{
    if (!g_context || !g_text_blur_cb) return;
    const char* idStr = env->GetStringUTFChars(inputId, NULL);
    JSStringRef jsId  = JSStringCreateWithUTF8CString(idStr);
    JSValueRef args[1];
    args[0] = JSValueMakeString(g_context, jsId);
    call_js_callback(g_context, g_text_blur_cb, 1, args);
    JSStringRelease(jsId);
    env->ReleaseStringUTFChars(inputId, idStr);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireImageLoaded(
    JNIEnv* env, jobject thiz, jstring imageId, jdouble width, jdouble height)
{
    if (!g_context || !g_image_loaded_cb) return;
    const char* idStr = env->GetStringUTFChars(imageId, NULL);
    JSStringRef jsId  = JSStringCreateWithUTF8CString(idStr);
    JSValueRef args[3];
    args[0] = JSValueMakeString(g_context, jsId);
    args[1] = JSValueMakeNumber(g_context, width);
    args[2] = JSValueMakeNumber(g_context, height);
    call_js_callback(g_context, g_image_loaded_cb, 3, args);
    JSStringRelease(jsId);
    env->ReleaseStringUTFChars(imageId, idStr);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireViewportUpdate(
    JNIEnv* env, jobject thiz, jdouble width, jdouble height)
{
    if (!g_context || !g_viewport_update_cb) return;
    JSValueRef args[2];
    args[0] = JSValueMakeNumber(g_context, width);
    args[1] = JSValueMakeNumber(g_context, height);
    call_js_callback(g_context, g_viewport_update_cb, 2, args);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireFetchResponse(
    JNIEnv* env, jobject thiz, jint reqId, jint status,
    jstring headersJson, jstring body)
{
    if (!g_context || !g_fetch_response_cb) return;
    const char* cHeaders = env->GetStringUTFChars(headersJson, NULL);
    const char* cBody    = env->GetStringUTFChars(body, NULL);
    JSStringRef jsHeaders = JSStringCreateWithUTF8CString(cHeaders);
    JSStringRef jsBody    = JSStringCreateWithUTF8CString(cBody);
    JSValueRef args[4];
    args[0] = JSValueMakeNumber(g_context, reqId);
    args[1] = JSValueMakeNumber(g_context, status);
    args[2] = JSValueMakeString(g_context, jsHeaders);
    args[3] = JSValueMakeString(g_context, jsBody);
    call_js_callback(g_context, g_fetch_response_cb, 4, args);
    JSStringRelease(jsHeaders);
    JSStringRelease(jsBody);
    env->ReleaseStringUTFChars(headersJson, cHeaders);
    env->ReleaseStringUTFChars(body, cBody);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireFetchError(
    JNIEnv* env, jobject thiz, jint reqId, jstring message)
{
    if (!g_context || !g_fetch_error_cb) return;
    const char* cMsg = env->GetStringUTFChars(message, NULL);
    JSStringRef jsMsg = JSStringCreateWithUTF8CString(cMsg);
    JSValueRef args[2];
    args[0] = JSValueMakeNumber(g_context, reqId);
    args[1] = JSValueMakeString(g_context, jsMsg);
    call_js_callback(g_context, g_fetch_error_cb, 2, args);
    JSStringRelease(jsMsg);
    env->ReleaseStringUTFChars(message, cMsg);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireWsOpen(
    JNIEnv* env, jobject thiz, jint wsId)
{
    if (!g_context || !g_ws_open_cb) return;
    JSValueRef args[1];
    args[0] = JSValueMakeNumber(g_context, wsId);
    call_js_callback(g_context, g_ws_open_cb, 1, args);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireWsMessage(
    JNIEnv* env, jobject thiz, jint wsId, jstring data)
{
    if (!g_context || !g_ws_message_cb) return;
    const char* cData = env->GetStringUTFChars(data, NULL);
    JSStringRef jsData = JSStringCreateWithUTF8CString(cData);
    JSValueRef args[2];
    args[0] = JSValueMakeNumber(g_context, wsId);
    args[1] = JSValueMakeString(g_context, jsData);
    call_js_callback(g_context, g_ws_message_cb, 2, args);
    JSStringRelease(jsData);
    env->ReleaseStringUTFChars(data, cData);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireWsClose(
    JNIEnv* env, jobject thiz, jint wsId, jint code, jstring reason)
{
    if (!g_context || !g_ws_close_cb) return;
    const char* cReason = env->GetStringUTFChars(reason, NULL);
    JSStringRef jsReason = JSStringCreateWithUTF8CString(cReason);
    JSValueRef args[3];
    args[0] = JSValueMakeNumber(g_context, wsId);
    args[1] = JSValueMakeNumber(g_context, code);
    args[2] = JSValueMakeString(g_context, jsReason);
    call_js_callback(g_context, g_ws_close_cb, 3, args);
    JSStringRelease(jsReason);
    env->ReleaseStringUTFChars(reason, cReason);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireWsError(
    JNIEnv* env, jobject thiz, jint wsId, jstring message)
{
    if (!g_context || !g_ws_error_cb) return;
    const char* cMsg = env->GetStringUTFChars(message, NULL);
    JSStringRef jsMsg = JSStringCreateWithUTF8CString(cMsg);
    JSValueRef args[2];
    args[0] = JSValueMakeNumber(g_context, wsId);
    args[1] = JSValueMakeString(g_context, jsMsg);
    call_js_callback(g_context, g_ws_error_cb, 2, args);
    JSStringRelease(jsMsg);
    env->ReleaseStringUTFChars(message, cMsg);
}

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireAccessibilityAction(
    JNIEnv* env, jobject thiz, jint nodeId, jstring action)
{
    if (!g_context || !g_a11y_action_cb) return;
    const char* cAction = env->GetStringUTFChars(action, NULL);
    JSValueRef args[2];
    args[0] = JSValueMakeNumber(g_context, nodeId);
    JSStringRef jsAction = JSStringCreateWithUTF8CString(cAction);
    args[1] = JSValueMakeString(g_context, jsAction);
    call_js_callback(g_context, g_a11y_action_cb, 2, args);
    JSStringRelease(jsAction);
    env->ReleaseStringUTFChars(action, cAction);
}

JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void* reserved) {
    g_jvm = vm;
    return JNI_VERSION_1_6;
}

} // extern "C"
