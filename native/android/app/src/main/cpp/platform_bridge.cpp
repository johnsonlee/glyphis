#include "bridge_common.h"

/* ------------------------------------------------------------------ */
/*  JS callback: console.log / warn / error / info / debug            */
/* ------------------------------------------------------------------ */

static JSValueRef js_console_log(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    for (size_t i = 0; i < argc; i++) {
        JSStringRef str = JSValueToStringCopy(ctx, argv[i], NULL);
        char* cstr = JSStringToCString(str);
        LOGI("[JS] %s", cstr);
        free(cstr);
        JSStringRelease(str);
    }
    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.submitRenderCommands(commands)      */
/*  Reads the JS array directly via JSC API — no JSON serialization.  */
/* ------------------------------------------------------------------ */

/* Pre-created JSStringRef property names (initialized once) */
static JSStringRef s_prop_length = NULL;
static JSStringRef s_prop_type = NULL;
static JSStringRef s_prop_x = NULL;
static JSStringRef s_prop_y = NULL;
static JSStringRef s_prop_width = NULL;
static JSStringRef s_prop_height = NULL;
static JSStringRef s_prop_color = NULL;
static JSStringRef s_prop_borderRadius = NULL;
static JSStringRef s_prop_opacity = NULL;
static JSStringRef s_prop_text = NULL;
static JSStringRef s_prop_fontSize = NULL;
static JSStringRef s_prop_fontWeight = NULL;
static JSStringRef s_prop_fontFamily = NULL;
static JSStringRef s_prop_textAlign = NULL;
static JSStringRef s_prop_maxWidth = NULL;
static JSStringRef s_prop_widths = NULL;
static JSStringRef s_prop_id = NULL;
static JSStringRef s_prop_imageId = NULL;
static JSStringRef s_prop_resizeMode = NULL;

static void init_property_names(void) {
    if (s_prop_length) return;
    s_prop_length       = JSStringCreateWithUTF8CString("length");
    s_prop_type         = JSStringCreateWithUTF8CString("type");
    s_prop_x            = JSStringCreateWithUTF8CString("x");
    s_prop_y            = JSStringCreateWithUTF8CString("y");
    s_prop_width        = JSStringCreateWithUTF8CString("width");
    s_prop_height       = JSStringCreateWithUTF8CString("height");
    s_prop_color        = JSStringCreateWithUTF8CString("color");
    s_prop_borderRadius = JSStringCreateWithUTF8CString("borderRadius");
    s_prop_opacity      = JSStringCreateWithUTF8CString("opacity");
    s_prop_text         = JSStringCreateWithUTF8CString("text");
    s_prop_fontSize     = JSStringCreateWithUTF8CString("fontSize");
    s_prop_fontWeight   = JSStringCreateWithUTF8CString("fontWeight");
    s_prop_fontFamily   = JSStringCreateWithUTF8CString("fontFamily");
    s_prop_textAlign    = JSStringCreateWithUTF8CString("textAlign");
    s_prop_maxWidth     = JSStringCreateWithUTF8CString("maxWidth");
    s_prop_widths       = JSStringCreateWithUTF8CString("widths");
    s_prop_id           = JSStringCreateWithUTF8CString("id");
    s_prop_imageId      = JSStringCreateWithUTF8CString("imageId");
    s_prop_resizeMode   = JSStringCreateWithUTF8CString("resizeMode");
}

static inline double js_get_double(JSContextRef ctx, JSObjectRef obj, JSStringRef prop) {
    return JSValueToNumber(ctx, JSObjectGetProperty(ctx, obj, prop, NULL), NULL);
}

static inline int js_get_int(JSContextRef ctx, JSObjectRef obj, JSStringRef prop) {
    return (int)JSValueToNumber(ctx, JSObjectGetProperty(ctx, obj, prop, NULL), NULL);
}

static inline bool js_has_prop(JSContextRef ctx, JSObjectRef obj, JSStringRef prop) {
    JSValueRef val = JSObjectGetProperty(ctx, obj, prop, NULL);
    return val && !JSValueIsUndefined(ctx, val);
}

static jstring js_get_jstring(JSContextRef ctx, JSObjectRef obj, JSStringRef prop, JNIEnv* env) {
    JSValueRef val = JSObjectGetProperty(ctx, obj, prop, NULL);
    if (!val || JSValueIsUndefined(ctx, val)) return env->NewStringUTF("");
    JSStringRef jsStr = JSValueToStringCopy(ctx, val, NULL);
    char* cstr = JSStringToCString(jsStr);
    jstring result = env->NewStringUTF(cstr);
    free(cstr);
    JSStringRelease(jsStr);
    return result;
}

static char js_get_type_char(JSContextRef ctx, JSObjectRef obj) {
    JSValueRef val = JSObjectGetProperty(ctx, obj, s_prop_type, NULL);
    if (!val || JSValueIsUndefined(ctx, val)) return 0;
    JSStringRef jsStr = JSValueToStringCopy(ctx, val, NULL);
    size_t len = JSStringGetLength(jsStr);
    if (len == 0) { JSStringRelease(jsStr); return 0; }
    const JSChar* chars = JSStringGetCharactersPtr(jsStr);
    char first = (char)chars[0];
    char result = 0;
    if (first == 'r') result = 'R';
    else if (first == 't') result = 'T';
    else if (first == 'b') result = 'B';
    else if (first == 'i') result = 'I';
    else if (first == 'c' && len >= 6) {
        /* "clip-start" chars[5]='s', "clip-end" chars[5]='e' */
        char sixth = (char)chars[5];
        if (sixth == 's') result = 'S';
        else result = 'E';
    }
    JSStringRelease(jsStr);
    return result;
}

/* Cached JNI method IDs for per-command dispatch */
static jmethodID s_mid_beginBatch = NULL;
static jmethodID s_mid_endBatch = NULL;
static jmethodID s_mid_cmdRect = NULL;
static jmethodID s_mid_cmdText = NULL;
static jmethodID s_mid_cmdBorder = NULL;
static jmethodID s_mid_cmdClipStart = NULL;
static jmethodID s_mid_cmdClipEnd = NULL;
static jmethodID s_mid_cmdImage = NULL;
static bool s_jni_methods_cached = false;

static void cache_render_jni_methods(JNIEnv* env) {
    if (s_jni_methods_cached) return;
    jclass cls = env->GetObjectClass(g_runtime);
    s_mid_beginBatch   = env->GetMethodID(cls, "onBeginRenderBatch", "()V");
    s_mid_endBatch     = env->GetMethodID(cls, "onEndRenderBatch", "()V");
    s_mid_cmdRect      = env->GetMethodID(cls, "onCmdRect",
        "(DDDDLjava/lang/String;DD)V");
    s_mid_cmdText      = env->GetMethodID(cls, "onCmdText",
        "(DDLjava/lang/String;Ljava/lang/String;DLjava/lang/String;Ljava/lang/String;Ljava/lang/String;DD)V");
    s_mid_cmdBorder    = env->GetMethodID(cls, "onCmdBorder",
        "(DDDDLjava/lang/String;DDDDDD)V");
    s_mid_cmdClipStart = env->GetMethodID(cls, "onCmdClipStart",
        "(IDDDDD)V");
    s_mid_cmdClipEnd   = env->GetMethodID(cls, "onCmdClipEnd", "(I)V");
    s_mid_cmdImage     = env->GetMethodID(cls, "onCmdImage",
        "(Ljava/lang/String;DDDDLjava/lang/String;DD)V");
    env->DeleteLocalRef(cls);
    s_jni_methods_cached = true;
}

static JSValueRef js_submitRenderCommands(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 1) return JSValueMakeUndefined(ctx);

    JSObjectRef cmdArray = JSValueToObject(ctx, argv[0], NULL);
    if (!cmdArray) return JSValueMakeUndefined(ctx);

    int count = (int)JSValueToNumber(ctx,
        JSObjectGetProperty(ctx, cmdArray, s_prop_length, NULL), NULL);
    if (count <= 0) return JSValueMakeUndefined(ctx);

    JNIEnv* env = getJNIEnv();
    if (!env || !g_runtime) return JSValueMakeUndefined(ctx);

    if (!s_jni_methods_cached) cache_render_jni_methods(env);

    env->CallVoidMethod(g_runtime, s_mid_beginBatch);

    for (int i = 0; i < count; i++) {
        JSValueRef elem = JSObjectGetPropertyAtIndex(ctx, cmdArray, i, NULL);
        if (!elem || JSValueIsUndefined(ctx, elem)) continue;
        JSObjectRef cmd = JSValueToObject(ctx, elem, NULL);
        if (!cmd) continue;

        char type = js_get_type_char(ctx, cmd);

        switch (type) {
        case 'R': {
            double x  = js_get_double(ctx, cmd, s_prop_x);
            double y  = js_get_double(ctx, cmd, s_prop_y);
            double w  = js_get_double(ctx, cmd, s_prop_width);
            double h  = js_get_double(ctx, cmd, s_prop_height);
            jstring color = js_get_jstring(ctx, cmd, s_prop_color, env);
            double br = js_has_prop(ctx, cmd, s_prop_borderRadius)
                        ? js_get_double(ctx, cmd, s_prop_borderRadius) : 0.0;
            double op = js_has_prop(ctx, cmd, s_prop_opacity)
                        ? js_get_double(ctx, cmd, s_prop_opacity) : 1.0;
            env->CallVoidMethod(g_runtime, s_mid_cmdRect, x, y, w, h, color, br, op);
            env->DeleteLocalRef(color);
            break;
        }
        case 'T': {
            double x  = js_get_double(ctx, cmd, s_prop_x);
            double y  = js_get_double(ctx, cmd, s_prop_y);
            jstring text = js_get_jstring(ctx, cmd, s_prop_text, env);
            jstring color = js_get_jstring(ctx, cmd, s_prop_color, env);
            double fontSize = js_get_double(ctx, cmd, s_prop_fontSize);
            jstring fontWeight = js_get_jstring(ctx, cmd, s_prop_fontWeight, env);
            jstring fontFamily = js_get_jstring(ctx, cmd, s_prop_fontFamily, env);
            jstring textAlign  = js_get_jstring(ctx, cmd, s_prop_textAlign, env);
            double mw = js_has_prop(ctx, cmd, s_prop_maxWidth)
                        ? js_get_double(ctx, cmd, s_prop_maxWidth) : -1.0;
            double op = js_has_prop(ctx, cmd, s_prop_opacity)
                        ? js_get_double(ctx, cmd, s_prop_opacity) : 1.0;
            env->CallVoidMethod(g_runtime, s_mid_cmdText,
                x, y, text, color, fontSize, fontWeight, fontFamily, textAlign, mw, op);
            env->DeleteLocalRef(text);
            env->DeleteLocalRef(color);
            env->DeleteLocalRef(fontWeight);
            env->DeleteLocalRef(fontFamily);
            env->DeleteLocalRef(textAlign);
            break;
        }
        case 'B': {
            double x  = js_get_double(ctx, cmd, s_prop_x);
            double y  = js_get_double(ctx, cmd, s_prop_y);
            double w  = js_get_double(ctx, cmd, s_prop_width);
            double h  = js_get_double(ctx, cmd, s_prop_height);
            jstring color = js_get_jstring(ctx, cmd, s_prop_color, env);
            double tw = 0, rw = 0, bw = 0, lw = 0;
            if (js_has_prop(ctx, cmd, s_prop_widths)) {
                JSObjectRef widthsArr = JSValueToObject(ctx,
                    JSObjectGetProperty(ctx, cmd, s_prop_widths, NULL), NULL);
                if (widthsArr) {
                    tw = JSValueToNumber(ctx, JSObjectGetPropertyAtIndex(ctx, widthsArr, 0, NULL), NULL);
                    rw = JSValueToNumber(ctx, JSObjectGetPropertyAtIndex(ctx, widthsArr, 1, NULL), NULL);
                    bw = JSValueToNumber(ctx, JSObjectGetPropertyAtIndex(ctx, widthsArr, 2, NULL), NULL);
                    lw = JSValueToNumber(ctx, JSObjectGetPropertyAtIndex(ctx, widthsArr, 3, NULL), NULL);
                }
            }
            double br = js_has_prop(ctx, cmd, s_prop_borderRadius)
                        ? js_get_double(ctx, cmd, s_prop_borderRadius) : 0.0;
            double op = js_has_prop(ctx, cmd, s_prop_opacity)
                        ? js_get_double(ctx, cmd, s_prop_opacity) : 1.0;
            env->CallVoidMethod(g_runtime, s_mid_cmdBorder,
                x, y, w, h, color, tw, rw, bw, lw, br, op);
            env->DeleteLocalRef(color);
            break;
        }
        case 'S': {
            int id = js_get_int(ctx, cmd, s_prop_id);
            double x  = js_get_double(ctx, cmd, s_prop_x);
            double y  = js_get_double(ctx, cmd, s_prop_y);
            double w  = js_get_double(ctx, cmd, s_prop_width);
            double h  = js_get_double(ctx, cmd, s_prop_height);
            double br = js_has_prop(ctx, cmd, s_prop_borderRadius)
                        ? js_get_double(ctx, cmd, s_prop_borderRadius) : 0.0;
            env->CallVoidMethod(g_runtime, s_mid_cmdClipStart, id, x, y, w, h, br);
            break;
        }
        case 'E': {
            int id = js_get_int(ctx, cmd, s_prop_id);
            env->CallVoidMethod(g_runtime, s_mid_cmdClipEnd, id);
            break;
        }
        case 'I': {
            jstring imageId = js_get_jstring(ctx, cmd, s_prop_imageId, env);
            double x  = js_get_double(ctx, cmd, s_prop_x);
            double y  = js_get_double(ctx, cmd, s_prop_y);
            double w  = js_get_double(ctx, cmd, s_prop_width);
            double h  = js_get_double(ctx, cmd, s_prop_height);
            jstring resizeMode = js_get_jstring(ctx, cmd, s_prop_resizeMode, env);
            double op = js_has_prop(ctx, cmd, s_prop_opacity)
                        ? js_get_double(ctx, cmd, s_prop_opacity) : 1.0;
            double br = js_has_prop(ctx, cmd, s_prop_borderRadius)
                        ? js_get_double(ctx, cmd, s_prop_borderRadius) : 0.0;
            env->CallVoidMethod(g_runtime, s_mid_cmdImage,
                imageId, x, y, w, h, resizeMode, op, br);
            env->DeleteLocalRef(imageId);
            env->DeleteLocalRef(resizeMode);
            break;
        }
        default:
            break;
        }
    }

    env->CallVoidMethod(g_runtime, s_mid_endBatch);
    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.measureText(text, size, family, wt) */
/* ------------------------------------------------------------------ */

static JSValueRef js_measureText(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 4) return JSValueMakeUndefined(ctx);

    JSStringRef textStr   = JSValueToStringCopy(ctx, argv[0], NULL);
    double      fontSize  = JSValueToNumber(ctx, argv[1], NULL);
    JSStringRef familyStr = JSValueToStringCopy(ctx, argv[2], NULL);
    JSStringRef weightStr = JSValueToStringCopy(ctx, argv[3], NULL);

    char* text       = JSStringToCString(textStr);
    char* fontWeight = JSStringToCString(weightStr);

    JNIEnv* env = getJNIEnv();
    double width = 0, height = 0;

    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID method = env->GetMethodID(cls,
            "onMeasureText", "(Ljava/lang/String;DLjava/lang/String;)[D");
        jstring jtext   = env->NewStringUTF(text);
        jstring jweight = env->NewStringUTF(fontWeight);
        jdoubleArray result = (jdoubleArray)env->CallObjectMethod(
            g_runtime, method, jtext, fontSize, jweight);
        if (result) {
            jdouble* vals = env->GetDoubleArrayElements(result, NULL);
            width  = vals[0];
            height = vals[1];
            env->ReleaseDoubleArrayElements(result, vals, 0);
            env->DeleteLocalRef(result);
        }
        env->DeleteLocalRef(jtext);
        env->DeleteLocalRef(jweight);
        env->DeleteLocalRef(cls);
    }

    free(text);
    free(fontWeight);
    JSStringRelease(textStr);
    JSStringRelease(familyStr);
    JSStringRelease(weightStr);

    JSObjectRef obj = JSObjectMake(ctx, NULL, NULL);
    JSStringRef wKey = CStringToJSString("width");
    JSStringRef hKey = CStringToJSString("height");
    JSObjectSetProperty(ctx, obj, wKey, JSValueMakeNumber(ctx, width),  0, NULL);
    JSObjectSetProperty(ctx, obj, hKey, JSValueMakeNumber(ctx, height), 0, NULL);
    JSStringRelease(wKey);
    JSStringRelease(hKey);

    return obj;
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.loadImage(imageId, url)             */
/* ------------------------------------------------------------------ */

static JSValueRef js_loadImage(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 2) return JSValueMakeUndefined(ctx);

    JSStringRef idStr  = JSValueToStringCopy(ctx, argv[0], NULL);
    JSStringRef urlStr = JSValueToStringCopy(ctx, argv[1], NULL);
    char* imageId = JSStringToCString(idStr);
    char* url     = JSStringToCString(urlStr);

    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID method = env->GetMethodID(cls,
            "onLoadImage", "(Ljava/lang/String;Ljava/lang/String;)V");
        jstring jImageId = env->NewStringUTF(imageId);
        jstring jUrl     = env->NewStringUTF(url);
        env->CallVoidMethod(g_runtime, method, jImageId, jUrl);
        env->DeleteLocalRef(jImageId);
        env->DeleteLocalRef(jUrl);
        env->DeleteLocalRef(cls);
    }

    free(imageId);
    free(url);
    JSStringRelease(idStr);
    JSStringRelease(urlStr);

    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.getViewportSize()                   */
/* ------------------------------------------------------------------ */

static JSValueRef js_getViewportSize(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    JNIEnv* env = getJNIEnv();
    double w = 390, h = 844;

    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID method = env->GetMethodID(cls,
            "onGetViewportSize", "()[D");
        jdoubleArray result = (jdoubleArray)env->CallObjectMethod(
            g_runtime, method);
        if (result) {
            jdouble* vals = env->GetDoubleArrayElements(result, NULL);
            w = vals[0];
            h = vals[1];
            env->ReleaseDoubleArrayElements(result, vals, 0);
            env->DeleteLocalRef(result);
        }
        env->DeleteLocalRef(cls);
    }

    JSObjectRef obj = JSObjectMake(ctx, NULL, NULL);
    JSStringRef wKey = CStringToJSString("width");
    JSStringRef hKey = CStringToJSString("height");
    JSObjectSetProperty(ctx, obj, wKey, JSValueMakeNumber(ctx, w), 0, NULL);
    JSObjectSetProperty(ctx, obj, hKey, JSValueMakeNumber(ctx, h), 0, NULL);
    JSStringRelease(wKey);
    JSStringRelease(hKey);

    return obj;
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.scheduleTimer(id, delayMs, callback) */
/* ------------------------------------------------------------------ */

/* Timer callback storage — maps timer ID to JSValueRef */
#define MAX_TIMERS 4096
static JSValueRef g_timer_callbacks[MAX_TIMERS];
static int g_timer_count = 0;

void fire_timer_callback(int timerId) {
    if (timerId < 0 || timerId >= MAX_TIMERS) return;
    JSValueRef cb = g_timer_callbacks[timerId];
    if (!cb) return;
    g_timer_callbacks[timerId] = NULL;
    JSValueRef exception = NULL;
    JSValueRef args[1];
    args[0] = JSValueMakeNumber(g_context, 0); /* timestamp placeholder */
    JSObjectCallAsFunction(g_context, (JSObjectRef)cb, NULL, 1, args, &exception);
    JSValueUnprotect(g_context, cb);
    if (exception) {
        JSStringRef exStr = JSValueToStringCopy(g_context, exception, NULL);
        char* msg = JSStringToCString(exStr);
        LOGE("[JS Error] fireTimer(%d): %s", timerId, msg);
        free(msg);
        JSStringRelease(exStr);
    }
}

static JSValueRef js_scheduleTimer(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 3) return JSValueMakeUndefined(ctx);

    int    timerId = (int)JSValueToNumber(ctx, argv[0], NULL);
    double delayMs = JSValueToNumber(ctx, argv[1], NULL);
    JSValueRef callback = argv[2];

    /* Store the callback directly — no JS-side __glyphis_timers needed */
    if (timerId >= 0 && timerId < MAX_TIMERS) {
        g_timer_callbacks[timerId] = callback;
        JSValueProtect(ctx, callback);
    }

    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID method = env->GetMethodID(cls,
            "onScheduleTimer", "(ID)V");
        env->CallVoidMethod(g_runtime, method, timerId, delayMs);
        env->DeleteLocalRef(cls);
    }

    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.showTextInput(inputId, x, y, w, h, */
/*    value, placeholder, fontSize, color, placeholderColor,          */
/*    keyboardType, returnKeyType, secureTextEntry, multiline, maxLen)*/
/* ------------------------------------------------------------------ */

static JSValueRef js_showTextInput(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 15) return JSValueMakeUndefined(ctx);

    JSStringRef inputIdStr       = JSValueToStringCopy(ctx, argv[0], NULL);
    double      x                = JSValueToNumber(ctx, argv[1], NULL);
    double      y                = JSValueToNumber(ctx, argv[2], NULL);
    double      w                = JSValueToNumber(ctx, argv[3], NULL);
    double      h                = JSValueToNumber(ctx, argv[4], NULL);
    JSStringRef valueStr         = JSValueToStringCopy(ctx, argv[5], NULL);
    JSStringRef placeholderStr   = JSValueToStringCopy(ctx, argv[6], NULL);
    double      fontSize         = JSValueToNumber(ctx, argv[7], NULL);
    JSStringRef colorStr         = JSValueToStringCopy(ctx, argv[8], NULL);
    JSStringRef phColorStr       = JSValueToStringCopy(ctx, argv[9], NULL);
    JSStringRef kbTypeStr        = JSValueToStringCopy(ctx, argv[10], NULL);
    JSStringRef retKeyStr        = JSValueToStringCopy(ctx, argv[11], NULL);
    bool        secureTextEntry  = JSValueToBoolean(ctx, argv[12]);
    bool        multiline        = JSValueToBoolean(ctx, argv[13]);
    int         maxLength        = (int)JSValueToNumber(ctx, argv[14], NULL);

    char* inputId        = JSStringToCString(inputIdStr);
    char* value          = JSStringToCString(valueStr);
    char* placeholder    = JSStringToCString(placeholderStr);
    char* color          = JSStringToCString(colorStr);
    char* phColor        = JSStringToCString(phColorStr);
    char* keyboardType   = JSStringToCString(kbTypeStr);
    char* returnKeyType  = JSStringToCString(retKeyStr);

    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID method = env->GetMethodID(cls,
            "onShowTextInput",
            "(Ljava/lang/String;DDDDLjava/lang/String;Ljava/lang/String;DLjava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;ZZI)V");
        jstring jInputId     = env->NewStringUTF(inputId);
        jstring jValue       = env->NewStringUTF(value);
        jstring jPlaceholder = env->NewStringUTF(placeholder);
        jstring jColor       = env->NewStringUTF(color);
        jstring jPhColor     = env->NewStringUTF(phColor);
        jstring jKbType      = env->NewStringUTF(keyboardType);
        jstring jRetKey      = env->NewStringUTF(returnKeyType);
        env->CallVoidMethod(g_runtime, method,
            jInputId, x, y, w, h,
            jValue, jPlaceholder, fontSize,
            jColor, jPhColor,
            jKbType, jRetKey,
            (jboolean)secureTextEntry, (jboolean)multiline, (jint)maxLength);
        env->DeleteLocalRef(jInputId);
        env->DeleteLocalRef(jValue);
        env->DeleteLocalRef(jPlaceholder);
        env->DeleteLocalRef(jColor);
        env->DeleteLocalRef(jPhColor);
        env->DeleteLocalRef(jKbType);
        env->DeleteLocalRef(jRetKey);
        env->DeleteLocalRef(cls);
    }

    free(inputId);
    free(value);
    free(placeholder);
    free(color);
    free(phColor);
    free(keyboardType);
    free(returnKeyType);
    JSStringRelease(inputIdStr);
    JSStringRelease(valueStr);
    JSStringRelease(placeholderStr);
    JSStringRelease(colorStr);
    JSStringRelease(phColorStr);
    JSStringRelease(kbTypeStr);
    JSStringRelease(retKeyStr);

    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.updateTextInput(inputId, x, y, w, h)*/
/* ------------------------------------------------------------------ */

static JSValueRef js_updateTextInput(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 5) return JSValueMakeUndefined(ctx);

    JSStringRef inputIdStr = JSValueToStringCopy(ctx, argv[0], NULL);
    double      x          = JSValueToNumber(ctx, argv[1], NULL);
    double      y          = JSValueToNumber(ctx, argv[2], NULL);
    double      w          = JSValueToNumber(ctx, argv[3], NULL);
    double      h          = JSValueToNumber(ctx, argv[4], NULL);

    char* inputId = JSStringToCString(inputIdStr);

    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID method = env->GetMethodID(cls,
            "onUpdateTextInput", "(Ljava/lang/String;DDDD)V");
        jstring jInputId = env->NewStringUTF(inputId);
        env->CallVoidMethod(g_runtime, method, jInputId, x, y, w, h);
        env->DeleteLocalRef(jInputId);
        env->DeleteLocalRef(cls);
    }

    free(inputId);
    JSStringRelease(inputIdStr);
    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.hideTextInput(inputId)              */
/* ------------------------------------------------------------------ */

static JSValueRef js_hideTextInput(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 1) return JSValueMakeUndefined(ctx);

    JSStringRef str = JSValueToStringCopy(ctx, argv[0], NULL);
    char* inputId = JSStringToCString(str);

    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID method = env->GetMethodID(cls,
            "onHideTextInput", "(Ljava/lang/String;)V");
        jstring jstr = env->NewStringUTF(inputId);
        env->CallVoidMethod(g_runtime, method, jstr);
        env->DeleteLocalRef(jstr);
        env->DeleteLocalRef(cls);
    }

    free(inputId);
    JSStringRelease(str);
    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.fetch(reqId, url, method, hdrs, body) */
/* ------------------------------------------------------------------ */

static JSValueRef js_fetch(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 5) return JSValueMakeUndefined(ctx);

    int reqId = (int)JSValueToNumber(ctx, argv[0], NULL);

    JSStringRef urlStr     = JSValueToStringCopy(ctx, argv[1], NULL);
    JSStringRef methodStr  = JSValueToStringCopy(ctx, argv[2], NULL);
    JSStringRef headersStr = JSValueToStringCopy(ctx, argv[3], NULL);
    JSStringRef bodyStr    = JSValueToStringCopy(ctx, argv[4], NULL);

    char* url     = JSStringToCString(urlStr);
    char* method  = JSStringToCString(methodStr);
    char* headers = JSStringToCString(headersStr);
    char* body    = JSStringToCString(bodyStr);

    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID mid    = env->GetMethodID(cls, "onFetch",
            "(ILjava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V");
        jstring jUrl     = env->NewStringUTF(url);
        jstring jMethod  = env->NewStringUTF(method);
        jstring jHeaders = env->NewStringUTF(headers);
        jstring jBody    = env->NewStringUTF(body);
        env->CallVoidMethod(g_runtime, mid, reqId, jUrl, jMethod, jHeaders, jBody);
        env->DeleteLocalRef(jUrl);
        env->DeleteLocalRef(jMethod);
        env->DeleteLocalRef(jHeaders);
        env->DeleteLocalRef(jBody);
        env->DeleteLocalRef(cls);
    }

    free(url);
    free(method);
    free(headers);
    free(body);
    JSStringRelease(urlStr);
    JSStringRelease(methodStr);
    JSStringRelease(headersStr);
    JSStringRelease(bodyStr);

    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.storageSet(key, value)              */
/* ------------------------------------------------------------------ */

static JSValueRef js_storageSet(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 2) return JSValueMakeUndefined(ctx);

    JSStringRef keyStr = JSValueToStringCopy(ctx, argv[0], NULL);
    JSStringRef valStr = JSValueToStringCopy(ctx, argv[1], NULL);
    char* key   = JSStringToCString(keyStr);
    char* value = JSStringToCString(valStr);

    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID method = env->GetMethodID(cls,
            "onStorageSet", "(Ljava/lang/String;Ljava/lang/String;)V");
        jstring jKey   = env->NewStringUTF(key);
        jstring jValue = env->NewStringUTF(value);
        env->CallVoidMethod(g_runtime, method, jKey, jValue);
        env->DeleteLocalRef(jKey);
        env->DeleteLocalRef(jValue);
        env->DeleteLocalRef(cls);
    }

    free(key);
    free(value);
    JSStringRelease(keyStr);
    JSStringRelease(valStr);
    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.storageRemove(key)                  */
/* ------------------------------------------------------------------ */

static JSValueRef js_storageRemove(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 1) return JSValueMakeUndefined(ctx);

    JSStringRef keyStr = JSValueToStringCopy(ctx, argv[0], NULL);
    char* key = JSStringToCString(keyStr);

    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID method = env->GetMethodID(cls,
            "onStorageRemove", "(Ljava/lang/String;)V");
        jstring jKey = env->NewStringUTF(key);
        env->CallVoidMethod(g_runtime, method, jKey);
        env->DeleteLocalRef(jKey);
        env->DeleteLocalRef(cls);
    }

    free(key);
    JSStringRelease(keyStr);
    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.storageClear()                      */
/* ------------------------------------------------------------------ */

static JSValueRef js_storageClear(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID method = env->GetMethodID(cls,
            "onStorageClear", "()V");
        env->CallVoidMethod(g_runtime, method);
        env->DeleteLocalRef(cls);
    }
    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.storageGetAll() -> JSON string      */
/* ------------------------------------------------------------------ */

static JSValueRef js_storageGetAll(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID method = env->GetMethodID(cls,
            "onStorageGetAll", "()Ljava/lang/String;");
        jstring result = (jstring)env->CallObjectMethod(g_runtime, method);
        if (result) {
            const char* cstr = env->GetStringUTFChars(result, NULL);
            JSStringRef jsStr = CStringToJSString(cstr);
            JSValueRef  jsVal = JSValueMakeString(ctx, jsStr);
            env->ReleaseStringUTFChars(result, cstr);
            env->DeleteLocalRef(result);
            JSStringRelease(jsStr);
            env->DeleteLocalRef(cls);
            return jsVal;
        }
        env->DeleteLocalRef(cls);
    }
    return JSValueMakeNull(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.wsConnect(wsId, url, protocols)     */
/* ------------------------------------------------------------------ */

static JSValueRef js_wsConnect(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 3) return JSValueMakeUndefined(ctx);

    int wsId = (int)JSValueToNumber(ctx, argv[0], NULL);

    JSStringRef urlStr       = JSValueToStringCopy(ctx, argv[1], NULL);
    JSStringRef protocolsStr = JSValueToStringCopy(ctx, argv[2], NULL);
    char* url       = JSStringToCString(urlStr);
    char* protocols = JSStringToCString(protocolsStr);

    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls = env->GetObjectClass(g_runtime);
        jmethodID mid = env->GetMethodID(cls, "onWsConnect",
            "(ILjava/lang/String;Ljava/lang/String;)V");
        jstring jUrl       = env->NewStringUTF(url);
        jstring jProtocols = env->NewStringUTF(protocols);
        env->CallVoidMethod(g_runtime, mid, wsId, jUrl, jProtocols);
        env->DeleteLocalRef(jUrl);
        env->DeleteLocalRef(jProtocols);
        env->DeleteLocalRef(cls);
    }

    free(url);
    free(protocols);
    JSStringRelease(urlStr);
    JSStringRelease(protocolsStr);
    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.wsSend(wsId, data)                  */
/* ------------------------------------------------------------------ */

static JSValueRef js_wsSend(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 2) return JSValueMakeUndefined(ctx);

    int wsId = (int)JSValueToNumber(ctx, argv[0], NULL);

    JSStringRef dataStr = JSValueToStringCopy(ctx, argv[1], NULL);
    char* data = JSStringToCString(dataStr);

    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls = env->GetObjectClass(g_runtime);
        jmethodID mid = env->GetMethodID(cls, "onWsSend",
            "(ILjava/lang/String;)V");
        jstring jData = env->NewStringUTF(data);
        env->CallVoidMethod(g_runtime, mid, wsId, jData);
        env->DeleteLocalRef(jData);
        env->DeleteLocalRef(cls);
    }

    free(data);
    JSStringRelease(dataStr);
    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.wsClose(wsId, code, reason)         */
/* ------------------------------------------------------------------ */

static JSValueRef js_wsClose(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 3) return JSValueMakeUndefined(ctx);

    int wsId   = (int)JSValueToNumber(ctx, argv[0], NULL);
    int code   = (int)JSValueToNumber(ctx, argv[1], NULL);

    JSStringRef reasonStr = JSValueToStringCopy(ctx, argv[2], NULL);
    char* reason = JSStringToCString(reasonStr);

    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls = env->GetObjectClass(g_runtime);
        jmethodID mid = env->GetMethodID(cls, "onWsClose",
            "(IILjava/lang/String;)V");
        jstring jReason = env->NewStringUTF(reason);
        env->CallVoidMethod(g_runtime, mid, wsId, code, jReason);
        env->DeleteLocalRef(jReason);
        env->DeleteLocalRef(cls);
    }

    free(reason);
    JSStringRelease(reasonStr);
    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  Register __glyphis_native + console on global context             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  JS callback: __glyphis_native.submitAccessibilityTree(nodes)      */
/*  Reads the JS array directly via JSC API — no JSON serialization.  */
/* ------------------------------------------------------------------ */

/* Cached JSStringRef property names for accessibility nodes */
static JSStringRef s_a11y_prop_id = NULL;
static JSStringRef s_a11y_prop_parentId = NULL;
static JSStringRef s_a11y_prop_label = NULL;
static JSStringRef s_a11y_prop_hint = NULL;
static JSStringRef s_a11y_prop_role = NULL;
static JSStringRef s_a11y_prop_actions = NULL;

static void init_a11y_property_names(void) {
    if (s_a11y_prop_id) return;
    s_a11y_prop_id       = JSStringCreateWithUTF8CString("id");
    s_a11y_prop_parentId = JSStringCreateWithUTF8CString("parentId");
    s_a11y_prop_label    = JSStringCreateWithUTF8CString("label");
    s_a11y_prop_hint     = JSStringCreateWithUTF8CString("hint");
    s_a11y_prop_role     = JSStringCreateWithUTF8CString("role");
    s_a11y_prop_actions  = JSStringCreateWithUTF8CString("actions");
}

/* Cached JNI method IDs for accessibility batch dispatch */
static jmethodID s_mid_a11yBeginBatch = NULL;
static jmethodID s_mid_a11yNode       = NULL;
static jmethodID s_mid_a11yEndBatch   = NULL;
static bool s_a11y_jni_cached = false;

static void cache_a11y_jni_methods(JNIEnv* env) {
    if (s_a11y_jni_cached) return;
    jclass cls = env->GetObjectClass(g_runtime);
    s_mid_a11yBeginBatch = env->GetMethodID(cls, "onBeginAccessibilityBatch", "()V");
    s_mid_a11yNode       = env->GetMethodID(cls, "onAccessibilityNode",
        "(IIDDDDLjava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V");
    s_mid_a11yEndBatch   = env->GetMethodID(cls, "onEndAccessibilityBatch", "()V");
    env->DeleteLocalRef(cls);
    s_a11y_jni_cached = true;
}

static char* js_get_string(JSContextRef ctx, JSObjectRef obj, JSStringRef prop) {
    JSValueRef val = JSObjectGetProperty(ctx, obj, prop, NULL);
    if (!val || JSValueIsUndefined(ctx, val)) {
        char* empty = (char*)malloc(1);
        empty[0] = '\0';
        return empty;
    }
    JSStringRef jsStr = JSValueToStringCopy(ctx, val, NULL);
    char* cstr = JSStringToCString(jsStr);
    JSStringRelease(jsStr);
    return cstr;
}

static JSValueRef js_submitAccessibilityTree(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 1) return JSValueMakeUndefined(ctx);

    JSObjectRef nodeArray = JSValueToObject(ctx, argv[0], NULL);
    if (!nodeArray) return JSValueMakeUndefined(ctx);

    int count = (int)JSValueToNumber(ctx,
        JSObjectGetProperty(ctx, nodeArray, s_prop_length, NULL), NULL);
    if (count <= 0) return JSValueMakeUndefined(ctx);

    JNIEnv* env = getJNIEnv();
    if (!env || !g_runtime) return JSValueMakeUndefined(ctx);

    if (!s_a11y_jni_cached) cache_a11y_jni_methods(env);

    env->CallVoidMethod(g_runtime, s_mid_a11yBeginBatch);

    for (int i = 0; i < count; i++) {
        JSValueRef elem = JSObjectGetPropertyAtIndex(ctx, nodeArray, i, NULL);
        if (!elem || JSValueIsUndefined(ctx, elem)) continue;
        JSObjectRef node = JSValueToObject(ctx, elem, NULL);
        if (!node) continue;

        int id       = js_get_int(ctx, node, s_a11y_prop_id);
        int parentId = js_get_int(ctx, node, s_a11y_prop_parentId);
        double x     = js_get_double(ctx, node, s_prop_x);
        double y     = js_get_double(ctx, node, s_prop_y);
        double w     = js_get_double(ctx, node, s_prop_width);
        double h     = js_get_double(ctx, node, s_prop_height);

        char* label = js_get_string(ctx, node, s_a11y_prop_label);
        char* hint  = js_get_string(ctx, node, s_a11y_prop_hint);
        char* role  = js_get_string(ctx, node, s_a11y_prop_role);

        /* Read actions array as comma-separated string */
        char actionsBuf[256] = {0};
        JSValueRef actionsVal = JSObjectGetProperty(ctx, node, s_a11y_prop_actions, NULL);
        if (actionsVal && !JSValueIsUndefined(ctx, actionsVal)) {
            JSObjectRef actionsArr = JSValueToObject(ctx, actionsVal, NULL);
            if (actionsArr) {
                int aLen = (int)JSValueToNumber(ctx,
                    JSObjectGetProperty(ctx, actionsArr, s_prop_length, NULL), NULL);
                int pos = 0;
                for (int j = 0; j < aLen && pos < 250; j++) {
                    JSValueRef aElem = JSObjectGetPropertyAtIndex(ctx, actionsArr, j, NULL);
                    if (!aElem || JSValueIsUndefined(ctx, aElem)) continue;
                    JSStringRef aStr = JSValueToStringCopy(ctx, aElem, NULL);
                    char* aCstr = JSStringToCString(aStr);
                    if (j > 0 && pos < 254) actionsBuf[pos++] = ',';
                    int slen = (int)strlen(aCstr);
                    if (pos + slen < 255) {
                        memcpy(actionsBuf + pos, aCstr, slen);
                        pos += slen;
                    }
                    free(aCstr);
                    JSStringRelease(aStr);
                }
                actionsBuf[pos] = '\0';
            }
        }

        jstring jLabel   = env->NewStringUTF(label);
        jstring jHint    = env->NewStringUTF(hint);
        jstring jRole    = env->NewStringUTF(role);
        jstring jActions = env->NewStringUTF(actionsBuf);

        env->CallVoidMethod(g_runtime, s_mid_a11yNode,
            id, parentId, x, y, w, h, jLabel, jHint, jRole, jActions);

        env->DeleteLocalRef(jLabel);
        env->DeleteLocalRef(jHint);
        env->DeleteLocalRef(jRole);
        env->DeleteLocalRef(jActions);
        free(label);
        free(hint);
        free(role);
    }

    env->CallVoidMethod(g_runtime, s_mid_a11yEndBatch);
    return JSValueMakeUndefined(ctx);
}

void register_platform_bridge(JSContextRef ctx, JSObjectRef global) {
    /* Initialize cached JSStringRef property names for render command reading */
    init_property_names();
    init_a11y_property_names();

    /* -- console object -- */
    JSObjectRef consoleObj = JSObjectMake(ctx, NULL, NULL);
    JSStringRef consoleName = CStringToJSString("console");
    JSObjectSetProperty(ctx, global, consoleName, consoleObj, 0, NULL);
    JSStringRelease(consoleName);

    const char* logNames[] = {"log", "warn", "error", "info", "debug"};
    JSStringRef logFnName = CStringToJSString("log");
    JSObjectRef logFn = JSObjectMakeFunctionWithCallback(
        ctx, logFnName, js_console_log);
    JSStringRelease(logFnName);

    for (int i = 0; i < 5; i++) {
        JSStringRef n = CStringToJSString(logNames[i]);
        JSObjectSetProperty(ctx, consoleObj, n, logFn, 0, NULL);
        JSStringRelease(n);
    }

    /* -- __glyphis_native bridge -- */
    JSObjectRef bridge = JSObjectMake(ctx, NULL, NULL);
    JSStringRef bridgeName = CStringToJSString("__glyphis_native");
    JSObjectSetProperty(ctx, global, bridgeName, bridge, 0, NULL);
    JSStringRelease(bridgeName);

    setFunctionProperty(ctx, bridge, "submitRenderCommands", js_submitRenderCommands);
    setFunctionProperty(ctx, bridge, "measureText",          js_measureText);
    setFunctionProperty(ctx, bridge, "getViewportSize",      js_getViewportSize);
    setFunctionProperty(ctx, bridge, "scheduleTimer",        js_scheduleTimer);
    setFunctionProperty(ctx, bridge, "loadImage",            js_loadImage);
    setFunctionProperty(ctx, bridge, "showTextInput",        js_showTextInput);
    setFunctionProperty(ctx, bridge, "updateTextInput",      js_updateTextInput);
    setFunctionProperty(ctx, bridge, "hideTextInput",        js_hideTextInput);
    setFunctionProperty(ctx, bridge, "fetch",                js_fetch);
    setFunctionProperty(ctx, bridge, "storageSet",           js_storageSet);
    setFunctionProperty(ctx, bridge, "storageRemove",        js_storageRemove);
    setFunctionProperty(ctx, bridge, "storageClear",         js_storageClear);
    setFunctionProperty(ctx, bridge, "storageGetAll",        js_storageGetAll);
    setFunctionProperty(ctx, bridge, "wsConnect",            js_wsConnect);
    setFunctionProperty(ctx, bridge, "wsSend",               js_wsSend);
    setFunctionProperty(ctx, bridge, "wsClose",              js_wsClose);
    setFunctionProperty(ctx, bridge, "submitAccessibilityTree", js_submitAccessibilityTree);
    setStringProperty(ctx,   bridge, "platform",             "android");
}
