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
/*  Globals                                                           */
/* ------------------------------------------------------------------ */

static JSGlobalContextRef g_context = NULL;
static JavaVM*            g_jvm     = NULL;
static jobject            g_runtime = NULL;   /* GlobalRef to GlyphisRuntime */

/* ------------------------------------------------------------------ */
/*  Yoga node storage (dynamically growing)                           */
/* ------------------------------------------------------------------ */

static YGNodeRef* g_yoga_nodes    = NULL;
static int        g_yoga_capacity = 0;
static int        g_yoga_next_id  = 1;

/* ------------------------------------------------------------------ */
/*  Per-node text/font storage for native measure                     */
/* ------------------------------------------------------------------ */

typedef struct {
    char* text;
    float fontSize;
    char  fontFamily[64];
    char  fontWeight[16];
} YogaMeasureData;

static YogaMeasureData** g_yoga_measure_data    = NULL;
static int               g_yoga_measure_capacity = 0;

/* Cached JNI method ID for onMeasureText */
static jmethodID g_measureTextMethod = NULL;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

static char* JSStringToCString(JSStringRef jsStr) {
    size_t len = JSStringGetMaximumUTF8CStringSize(jsStr);
    char* buf = (char*)malloc(len);
    JSStringGetUTF8CString(jsStr, buf, len);
    return buf;
}

static JSStringRef CStringToJSString(const char* str) {
    return JSStringCreateWithUTF8CString(str);
}

static JNIEnv* getJNIEnv(void) {
    JNIEnv* env = NULL;
    g_jvm->GetEnv((void**)&env, JNI_VERSION_1_6);
    return env;
}

static void yoga_ensure_capacity(int needed) {
    if (needed < g_yoga_capacity) return;
    int newCap = g_yoga_capacity == 0 ? 1024 : g_yoga_capacity;
    while (newCap <= needed) newCap *= 2;
    g_yoga_nodes = (YGNodeRef*)realloc(g_yoga_nodes, newCap * sizeof(YGNodeRef));
    memset(g_yoga_nodes + g_yoga_capacity, 0, (newCap - g_yoga_capacity) * sizeof(YGNodeRef));
    g_yoga_measure_data = (YogaMeasureData**)realloc(g_yoga_measure_data, newCap * sizeof(YogaMeasureData*));
    memset(g_yoga_measure_data + g_yoga_measure_capacity, 0, (newCap - g_yoga_measure_capacity) * sizeof(YogaMeasureData*));
    g_yoga_capacity = newCap;
    g_yoga_measure_capacity = newCap;
}

static YGNodeRef yoga_get_node(int id) {
    if (id < 1 || id >= g_yoga_capacity) return NULL;
    return g_yoga_nodes[id];
}

static void yoga_free_measure_data(int id) {
    if (id >= 0 && id < g_yoga_measure_capacity && g_yoga_measure_data[id]) {
        free(g_yoga_measure_data[id]->text);
        free(g_yoga_measure_data[id]);
        g_yoga_measure_data[id] = NULL;
    }
}

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
/*  JS callback: __glyphis_native.submitRenderCommands(json)          */
/* ------------------------------------------------------------------ */

static JSValueRef js_submitRenderCommands(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 1) return JSValueMakeUndefined(ctx);

    JSStringRef str = JSValueToStringCopy(ctx, argv[0], NULL);
    char* json = JSStringToCString(str);

    JNIEnv* env = getJNIEnv();
    if (env && g_runtime) {
        jclass    cls    = env->GetObjectClass(g_runtime);
        jmethodID method = env->GetMethodID(cls,
            "onRenderCommands", "(Ljava/lang/String;)V");
        jstring jstr = env->NewStringUTF(json);
        env->CallVoidMethod(g_runtime, method, jstr);
        env->DeleteLocalRef(jstr);
        env->DeleteLocalRef(cls);
    }

    free(json);
    JSStringRelease(str);
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
/*  JS callback: __glyphis_native.scheduleTimer(id, delayMs)          */
/* ------------------------------------------------------------------ */

static JSValueRef js_scheduleTimer(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 2) return JSValueMakeUndefined(ctx);

    int    timerId = (int)JSValueToNumber(ctx, argv[0], NULL);
    double delayMs = JSValueToNumber(ctx, argv[1], NULL);

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
/*  Yoga bridge: measure callback                                     */
/* ------------------------------------------------------------------ */

static YGSize yoga_measure_func(
    YGNodeConstRef nodeRef,
    float width,
    YGMeasureMode widthMode,
    float height,
    YGMeasureMode heightMode)
{
    YGSize result = { 0.0f, 0.0f };
    if (!nodeRef) return result;

    int id = (int)(intptr_t)YGNodeGetContext(nodeRef);
    if (id < 1 || id >= g_yoga_measure_capacity) return result;

    YogaMeasureData* data = g_yoga_measure_data[id];
    if (!data || !data->text) return result;

    /* Measure text via JNI callback to Kotlin onMeasureText */
    JNIEnv* env = getJNIEnv();
    if (!env || !g_runtime || !g_measureTextMethod) return result;

    jstring jtext   = env->NewStringUTF(data->text);
    jstring jweight = env->NewStringUTF(data->fontWeight);
    jdoubleArray jresult = (jdoubleArray)env->CallObjectMethod(
        g_runtime, g_measureTextMethod, jtext, (double)data->fontSize, jweight);

    if (jresult) {
        jdouble* vals = env->GetDoubleArrayElements(jresult, NULL);
        result.width  = (float)vals[0];
        result.height = (float)vals[1];
        env->ReleaseDoubleArrayElements(jresult, vals, 0);
        env->DeleteLocalRef(jresult);
    }
    env->DeleteLocalRef(jtext);
    env->DeleteLocalRef(jweight);

    return result;
}

/* ------------------------------------------------------------------ */
/*  Yoga bridge: JS function callbacks                                */
/* ------------------------------------------------------------------ */

/* __yoga.nodeNew() -> number */
static JSValueRef js_yoga_nodeNew(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    int id = g_yoga_next_id++;
    yoga_ensure_capacity(id + 1);
    YGNodeRef node = YGNodeNew();
    g_yoga_nodes[id] = node;
    return JSValueMakeNumber(ctx, id);
}

/* __yoga.nodeFreeRecursive(id) */
static JSValueRef js_yoga_nodeFreeRecursive(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 1) return JSValueMakeUndefined(ctx);
    int id = (int)JSValueToNumber(ctx, argv[0], NULL);
    YGNodeRef node = yoga_get_node(id);
    if (node) {
        yoga_free_measure_data(id);
        YGNodeFreeRecursive(node);
        g_yoga_nodes[id] = NULL;
    }
    return JSValueMakeUndefined(ctx);
}

/* __yoga.nodeInsertChild(parentId, childId, index) */
static JSValueRef js_yoga_nodeInsertChild(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 3) return JSValueMakeUndefined(ctx);
    int parentId = (int)JSValueToNumber(ctx, argv[0], NULL);
    int childId  = (int)JSValueToNumber(ctx, argv[1], NULL);
    int index    = (int)JSValueToNumber(ctx, argv[2], NULL);
    YGNodeRef parent = yoga_get_node(parentId);
    YGNodeRef child  = yoga_get_node(childId);
    if (parent && child) {
        YGNodeInsertChild(parent, child, (size_t)index);
    }
    return JSValueMakeUndefined(ctx);
}

/* __yoga.nodeRemoveChild(parentId, childId) */
static JSValueRef js_yoga_nodeRemoveChild(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 2) return JSValueMakeUndefined(ctx);
    int parentId = (int)JSValueToNumber(ctx, argv[0], NULL);
    int childId  = (int)JSValueToNumber(ctx, argv[1], NULL);
    YGNodeRef parent = yoga_get_node(parentId);
    YGNodeRef child  = yoga_get_node(childId);
    if (parent && child) {
        YGNodeRemoveChild(parent, child);
    }
    return JSValueMakeUndefined(ctx);
}

/* __yoga.nodeCalculateLayout(id, w, h, dir) */
static JSValueRef js_yoga_nodeCalculateLayout(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 4) return JSValueMakeUndefined(ctx);
    int id       = (int)JSValueToNumber(ctx, argv[0], NULL);
    float width  = (float)JSValueToNumber(ctx, argv[1], NULL);
    float height = (float)JSValueToNumber(ctx, argv[2], NULL);
    int dir      = (int)JSValueToNumber(ctx, argv[3], NULL);
    YGNodeRef node = yoga_get_node(id);
    if (node) {
        YGNodeCalculateLayout(node, width, height, (YGDirection)dir);
    }
    return JSValueMakeUndefined(ctx);
}

/* __yoga.nodeMarkDirty(id) */
static JSValueRef js_yoga_nodeMarkDirty(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 1) return JSValueMakeUndefined(ctx);
    int id = (int)JSValueToNumber(ctx, argv[0], NULL);
    YGNodeRef node = yoga_get_node(id);
    if (node) {
        YGNodeMarkDirty(node);
    }
    return JSValueMakeUndefined(ctx);
}

/* __yoga.enableMeasure(id) */
static JSValueRef js_yoga_enableMeasure(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 1) return JSValueMakeUndefined(ctx);
    int id = (int)JSValueToNumber(ctx, argv[0], NULL);
    YGNodeRef node = yoga_get_node(id);
    if (node) {
        /* Store node ID as the node context for the measure callback */
        YGNodeSetContext(node, (void*)(intptr_t)id);
        YGNodeSetMeasureFunc(node, yoga_measure_func);
    }
    return JSValueMakeUndefined(ctx);
}

/* __yoga.enableMeasureNative(id, text, fontSize, fontFamily, fontWeight) */
static JSValueRef js_yoga_enableMeasureNative(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 5) return JSValueMakeUndefined(ctx);
    int id = (int)JSValueToNumber(ctx, argv[0], NULL);
    YGNodeRef node = yoga_get_node(id);
    if (!node) return JSValueMakeUndefined(ctx);

    /* Extract text */
    JSStringRef textStr = JSValueToStringCopy(ctx, argv[1], NULL);
    char* text = JSStringToCString(textStr);
    JSStringRelease(textStr);

    /* Extract fontSize */
    float fontSize = (float)JSValueToNumber(ctx, argv[2], NULL);

    /* Extract fontFamily */
    JSStringRef familyStr = JSValueToStringCopy(ctx, argv[3], NULL);
    char* fontFamily = JSStringToCString(familyStr);
    JSStringRelease(familyStr);

    /* Extract fontWeight */
    JSStringRef weightStr = JSValueToStringCopy(ctx, argv[4], NULL);
    char* fontWeight = JSStringToCString(weightStr);
    JSStringRelease(weightStr);

    /* Free old measure data if any */
    yoga_free_measure_data(id);

    /* Allocate and populate measure data */
    YogaMeasureData* data = (YogaMeasureData*)calloc(1, sizeof(YogaMeasureData));
    data->text = text; /* takes ownership */
    data->fontSize = fontSize;
    strncpy(data->fontFamily, fontFamily, sizeof(data->fontFamily) - 1);
    strncpy(data->fontWeight, fontWeight, sizeof(data->fontWeight) - 1);
    free(fontFamily);
    free(fontWeight);

    yoga_ensure_capacity(id + 1);
    g_yoga_measure_data[id] = data;

    YGNodeSetContext(node, (void*)(intptr_t)id);
    YGNodeSetMeasureFunc(node, yoga_measure_func);

    return JSValueMakeUndefined(ctx);
}

/* __yoga.updateMeasureText(id, text) */
static JSValueRef js_yoga_updateMeasureText(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 2) return JSValueMakeUndefined(ctx);
    int id = (int)JSValueToNumber(ctx, argv[0], NULL);

    if (id < 1 || id >= g_yoga_measure_capacity || !g_yoga_measure_data[id])
        return JSValueMakeUndefined(ctx);

    JSStringRef textStr = JSValueToStringCopy(ctx, argv[1], NULL);
    char* text = JSStringToCString(textStr);
    JSStringRelease(textStr);

    free(g_yoga_measure_data[id]->text);
    g_yoga_measure_data[id]->text = text;

    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  Yoga bridge: layout getters                                       */
/* ------------------------------------------------------------------ */

#define YOGA_LAYOUT_GETTER(name, ygFunc) \
static JSValueRef js_yoga_##name( \
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj, \
    size_t argc, const JSValueRef argv[], JSValueRef* exc) \
{ \
    if (argc < 1) return JSValueMakeNumber(ctx, 0); \
    int id = (int)JSValueToNumber(ctx, argv[0], NULL); \
    YGNodeRef node = yoga_get_node(id); \
    if (!node) return JSValueMakeNumber(ctx, 0); \
    return JSValueMakeNumber(ctx, (double)ygFunc(node)); \
}

YOGA_LAYOUT_GETTER(nodeLayoutGetLeft,   YGNodeLayoutGetLeft)
YOGA_LAYOUT_GETTER(nodeLayoutGetTop,    YGNodeLayoutGetTop)
YOGA_LAYOUT_GETTER(nodeLayoutGetRight,  YGNodeLayoutGetRight)
YOGA_LAYOUT_GETTER(nodeLayoutGetBottom, YGNodeLayoutGetBottom)
YOGA_LAYOUT_GETTER(nodeLayoutGetWidth,  YGNodeLayoutGetWidth)
YOGA_LAYOUT_GETTER(nodeLayoutGetHeight, YGNodeLayoutGetHeight)

/* ------------------------------------------------------------------ */
/*  Yoga bridge: enum style setters (id, intValue)                    */
/* ------------------------------------------------------------------ */

#define YOGA_ENUM_SETTER(name, ygFunc, enumType) \
static JSValueRef js_yoga_##name( \
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj, \
    size_t argc, const JSValueRef argv[], JSValueRef* exc) \
{ \
    if (argc < 2) return JSValueMakeUndefined(ctx); \
    int id = (int)JSValueToNumber(ctx, argv[0], NULL); \
    int val = (int)JSValueToNumber(ctx, argv[1], NULL); \
    YGNodeRef node = yoga_get_node(id); \
    if (node) ygFunc(node, (enumType)val); \
    return JSValueMakeUndefined(ctx); \
}

YOGA_ENUM_SETTER(nodeStyleSetDirection,      YGNodeStyleSetDirection,      YGDirection)
YOGA_ENUM_SETTER(nodeStyleSetFlexDirection,  YGNodeStyleSetFlexDirection,  YGFlexDirection)
YOGA_ENUM_SETTER(nodeStyleSetJustifyContent, YGNodeStyleSetJustifyContent, YGJustify)
YOGA_ENUM_SETTER(nodeStyleSetAlignContent,   YGNodeStyleSetAlignContent,   YGAlign)
YOGA_ENUM_SETTER(nodeStyleSetAlignItems,     YGNodeStyleSetAlignItems,     YGAlign)
YOGA_ENUM_SETTER(nodeStyleSetAlignSelf,      YGNodeStyleSetAlignSelf,      YGAlign)
YOGA_ENUM_SETTER(nodeStyleSetPositionType,   YGNodeStyleSetPositionType,   YGPositionType)
YOGA_ENUM_SETTER(nodeStyleSetFlexWrap,       YGNodeStyleSetFlexWrap,       YGWrap)
YOGA_ENUM_SETTER(nodeStyleSetOverflow,       YGNodeStyleSetOverflow,       YGOverflow)
YOGA_ENUM_SETTER(nodeStyleSetDisplay,        YGNodeStyleSetDisplay,        YGDisplay)

/* ------------------------------------------------------------------ */
/*  Yoga bridge: float style setters (id, floatValue)                 */
/* ------------------------------------------------------------------ */

#define YOGA_FLOAT_SETTER(name, ygFunc) \
static JSValueRef js_yoga_##name( \
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj, \
    size_t argc, const JSValueRef argv[], JSValueRef* exc) \
{ \
    if (argc < 2) return JSValueMakeUndefined(ctx); \
    int id = (int)JSValueToNumber(ctx, argv[0], NULL); \
    float val = (float)JSValueToNumber(ctx, argv[1], NULL); \
    YGNodeRef node = yoga_get_node(id); \
    if (node) ygFunc(node, val); \
    return JSValueMakeUndefined(ctx); \
}

YOGA_FLOAT_SETTER(nodeStyleSetFlex,               YGNodeStyleSetFlex)
YOGA_FLOAT_SETTER(nodeStyleSetFlexGrow,            YGNodeStyleSetFlexGrow)
YOGA_FLOAT_SETTER(nodeStyleSetFlexShrink,          YGNodeStyleSetFlexShrink)
YOGA_FLOAT_SETTER(nodeStyleSetFlexBasis,           YGNodeStyleSetFlexBasis)
YOGA_FLOAT_SETTER(nodeStyleSetFlexBasisPercent,    YGNodeStyleSetFlexBasisPercent)
YOGA_FLOAT_SETTER(nodeStyleSetWidth,               YGNodeStyleSetWidth)
YOGA_FLOAT_SETTER(nodeStyleSetWidthPercent,        YGNodeStyleSetWidthPercent)
YOGA_FLOAT_SETTER(nodeStyleSetHeight,              YGNodeStyleSetHeight)
YOGA_FLOAT_SETTER(nodeStyleSetHeightPercent,       YGNodeStyleSetHeightPercent)
YOGA_FLOAT_SETTER(nodeStyleSetMinWidth,            YGNodeStyleSetMinWidth)
YOGA_FLOAT_SETTER(nodeStyleSetMinWidthPercent,     YGNodeStyleSetMinWidthPercent)
YOGA_FLOAT_SETTER(nodeStyleSetMinHeight,           YGNodeStyleSetMinHeight)
YOGA_FLOAT_SETTER(nodeStyleSetMinHeightPercent,    YGNodeStyleSetMinHeightPercent)
YOGA_FLOAT_SETTER(nodeStyleSetMaxWidth,            YGNodeStyleSetMaxWidth)
YOGA_FLOAT_SETTER(nodeStyleSetMaxWidthPercent,     YGNodeStyleSetMaxWidthPercent)
YOGA_FLOAT_SETTER(nodeStyleSetMaxHeight,           YGNodeStyleSetMaxHeight)
YOGA_FLOAT_SETTER(nodeStyleSetMaxHeightPercent,    YGNodeStyleSetMaxHeightPercent)

/* ------------------------------------------------------------------ */
/*  Yoga bridge: auto setters (id only)                               */
/* ------------------------------------------------------------------ */

#define YOGA_AUTO_SETTER(name, ygFunc) \
static JSValueRef js_yoga_##name( \
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj, \
    size_t argc, const JSValueRef argv[], JSValueRef* exc) \
{ \
    if (argc < 1) return JSValueMakeUndefined(ctx); \
    int id = (int)JSValueToNumber(ctx, argv[0], NULL); \
    YGNodeRef node = yoga_get_node(id); \
    if (node) ygFunc(node); \
    return JSValueMakeUndefined(ctx); \
}

YOGA_AUTO_SETTER(nodeStyleSetFlexBasisAuto, YGNodeStyleSetFlexBasisAuto)
YOGA_AUTO_SETTER(nodeStyleSetWidthAuto,     YGNodeStyleSetWidthAuto)
YOGA_AUTO_SETTER(nodeStyleSetHeightAuto,    YGNodeStyleSetHeightAuto)

/* ------------------------------------------------------------------ */
/*  Yoga bridge: edge-based setters (id, edge, floatValue)            */
/* ------------------------------------------------------------------ */

#define YOGA_EDGE_SETTER(name, ygFunc) \
static JSValueRef js_yoga_##name( \
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj, \
    size_t argc, const JSValueRef argv[], JSValueRef* exc) \
{ \
    if (argc < 3) return JSValueMakeUndefined(ctx); \
    int id    = (int)JSValueToNumber(ctx, argv[0], NULL); \
    int edge  = (int)JSValueToNumber(ctx, argv[1], NULL); \
    float val = (float)JSValueToNumber(ctx, argv[2], NULL); \
    YGNodeRef node = yoga_get_node(id); \
    if (node) ygFunc(node, (YGEdge)edge, val); \
    return JSValueMakeUndefined(ctx); \
}

YOGA_EDGE_SETTER(nodeStyleSetPosition,        YGNodeStyleSetPosition)
YOGA_EDGE_SETTER(nodeStyleSetPositionPercent,  YGNodeStyleSetPositionPercent)
YOGA_EDGE_SETTER(nodeStyleSetMargin,           YGNodeStyleSetMargin)
YOGA_EDGE_SETTER(nodeStyleSetMarginPercent,    YGNodeStyleSetMarginPercent)
YOGA_EDGE_SETTER(nodeStyleSetPadding,          YGNodeStyleSetPadding)
YOGA_EDGE_SETTER(nodeStyleSetPaddingPercent,   YGNodeStyleSetPaddingPercent)
YOGA_EDGE_SETTER(nodeStyleSetBorder,           YGNodeStyleSetBorder)

/* __yoga.nodeStyleSetMarginAuto(id, edge) */
static JSValueRef js_yoga_nodeStyleSetMarginAuto(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 2) return JSValueMakeUndefined(ctx);
    int id   = (int)JSValueToNumber(ctx, argv[0], NULL);
    int edge = (int)JSValueToNumber(ctx, argv[1], NULL);
    YGNodeRef node = yoga_get_node(id);
    if (node) YGNodeStyleSetMarginAuto(node, (YGEdge)edge);
    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  Yoga bridge: gap setter (id, gutter, floatValue)                  */
/* ------------------------------------------------------------------ */

static JSValueRef js_yoga_nodeStyleSetGap(
    JSContextRef ctx, JSObjectRef function, JSObjectRef thisObj,
    size_t argc, const JSValueRef argv[], JSValueRef* exc)
{
    if (argc < 3) return JSValueMakeUndefined(ctx);
    int id      = (int)JSValueToNumber(ctx, argv[0], NULL);
    int gutter  = (int)JSValueToNumber(ctx, argv[1], NULL);
    float val   = (float)JSValueToNumber(ctx, argv[2], NULL);
    YGNodeRef node = yoga_get_node(id);
    if (node) YGNodeStyleSetGap(node, (YGGutter)gutter, val);
    return JSValueMakeUndefined(ctx);
}

/* ------------------------------------------------------------------ */
/*  Yoga bridge: batch style setter                                   */
/* ------------------------------------------------------------------ */



/* ------------------------------------------------------------------ */
/*  Helper: register a JS function on a JSObjectRef                   */
/* ------------------------------------------------------------------ */

static void setFunctionProperty(
    JSContextRef ctx, JSObjectRef parent, const char* name,
    JSObjectCallAsFunctionCallback callback)
{
    JSStringRef jname = CStringToJSString(name);
    JSObjectRef fn    = JSObjectMakeFunctionWithCallback(ctx, jname, callback);
    JSObjectSetProperty(ctx, parent, jname, fn, 0, NULL);
    JSStringRelease(jname);
}

static void setStringProperty(
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
/*  Register __yoga object on global context                          */
/* ------------------------------------------------------------------ */

static void register_yoga_bridge(JSContextRef ctx, JSObjectRef global) {
    JSObjectRef yoga = JSObjectMake(ctx, NULL, NULL);
    JSStringRef yogaName = CStringToJSString("__yoga");
    JSObjectSetProperty(ctx, global, yogaName, yoga, 0, NULL);
    JSStringRelease(yogaName);

    /* Node lifecycle */
    setFunctionProperty(ctx, yoga, "nodeNew",             js_yoga_nodeNew);
    setFunctionProperty(ctx, yoga, "nodeFreeRecursive",   js_yoga_nodeFreeRecursive);
    setFunctionProperty(ctx, yoga, "nodeInsertChild",     js_yoga_nodeInsertChild);
    setFunctionProperty(ctx, yoga, "nodeRemoveChild",     js_yoga_nodeRemoveChild);
    setFunctionProperty(ctx, yoga, "nodeCalculateLayout", js_yoga_nodeCalculateLayout);
    setFunctionProperty(ctx, yoga, "nodeMarkDirty",       js_yoga_nodeMarkDirty);
    setFunctionProperty(ctx, yoga, "enableMeasure",       js_yoga_enableMeasure);
    setFunctionProperty(ctx, yoga, "enableMeasureNative", js_yoga_enableMeasureNative);
    setFunctionProperty(ctx, yoga, "updateMeasureText",   js_yoga_updateMeasureText);

    /* Layout getters */
    setFunctionProperty(ctx, yoga, "nodeLayoutGetLeft",   js_yoga_nodeLayoutGetLeft);
    setFunctionProperty(ctx, yoga, "nodeLayoutGetTop",    js_yoga_nodeLayoutGetTop);
    setFunctionProperty(ctx, yoga, "nodeLayoutGetRight",  js_yoga_nodeLayoutGetRight);
    setFunctionProperty(ctx, yoga, "nodeLayoutGetBottom", js_yoga_nodeLayoutGetBottom);
    setFunctionProperty(ctx, yoga, "nodeLayoutGetWidth",  js_yoga_nodeLayoutGetWidth);
    setFunctionProperty(ctx, yoga, "nodeLayoutGetHeight", js_yoga_nodeLayoutGetHeight);

    /* Enum style setters */
    setFunctionProperty(ctx, yoga, "nodeStyleSetDirection",      js_yoga_nodeStyleSetDirection);
    setFunctionProperty(ctx, yoga, "nodeStyleSetFlexDirection",  js_yoga_nodeStyleSetFlexDirection);
    setFunctionProperty(ctx, yoga, "nodeStyleSetJustifyContent", js_yoga_nodeStyleSetJustifyContent);
    setFunctionProperty(ctx, yoga, "nodeStyleSetAlignContent",   js_yoga_nodeStyleSetAlignContent);
    setFunctionProperty(ctx, yoga, "nodeStyleSetAlignItems",     js_yoga_nodeStyleSetAlignItems);
    setFunctionProperty(ctx, yoga, "nodeStyleSetAlignSelf",      js_yoga_nodeStyleSetAlignSelf);
    setFunctionProperty(ctx, yoga, "nodeStyleSetPositionType",   js_yoga_nodeStyleSetPositionType);
    setFunctionProperty(ctx, yoga, "nodeStyleSetFlexWrap",       js_yoga_nodeStyleSetFlexWrap);
    setFunctionProperty(ctx, yoga, "nodeStyleSetOverflow",       js_yoga_nodeStyleSetOverflow);
    setFunctionProperty(ctx, yoga, "nodeStyleSetDisplay",        js_yoga_nodeStyleSetDisplay);

    /* Float style setters */
    setFunctionProperty(ctx, yoga, "nodeStyleSetFlex",               js_yoga_nodeStyleSetFlex);
    setFunctionProperty(ctx, yoga, "nodeStyleSetFlexGrow",           js_yoga_nodeStyleSetFlexGrow);
    setFunctionProperty(ctx, yoga, "nodeStyleSetFlexShrink",         js_yoga_nodeStyleSetFlexShrink);
    setFunctionProperty(ctx, yoga, "nodeStyleSetFlexBasis",          js_yoga_nodeStyleSetFlexBasis);
    setFunctionProperty(ctx, yoga, "nodeStyleSetFlexBasisPercent",   js_yoga_nodeStyleSetFlexBasisPercent);
    setFunctionProperty(ctx, yoga, "nodeStyleSetFlexBasisAuto",      js_yoga_nodeStyleSetFlexBasisAuto);
    setFunctionProperty(ctx, yoga, "nodeStyleSetWidth",              js_yoga_nodeStyleSetWidth);
    setFunctionProperty(ctx, yoga, "nodeStyleSetWidthPercent",       js_yoga_nodeStyleSetWidthPercent);
    setFunctionProperty(ctx, yoga, "nodeStyleSetWidthAuto",          js_yoga_nodeStyleSetWidthAuto);
    setFunctionProperty(ctx, yoga, "nodeStyleSetHeight",             js_yoga_nodeStyleSetHeight);
    setFunctionProperty(ctx, yoga, "nodeStyleSetHeightPercent",      js_yoga_nodeStyleSetHeightPercent);
    setFunctionProperty(ctx, yoga, "nodeStyleSetHeightAuto",         js_yoga_nodeStyleSetHeightAuto);
    setFunctionProperty(ctx, yoga, "nodeStyleSetMinWidth",           js_yoga_nodeStyleSetMinWidth);
    setFunctionProperty(ctx, yoga, "nodeStyleSetMinWidthPercent",    js_yoga_nodeStyleSetMinWidthPercent);
    setFunctionProperty(ctx, yoga, "nodeStyleSetMinHeight",          js_yoga_nodeStyleSetMinHeight);
    setFunctionProperty(ctx, yoga, "nodeStyleSetMinHeightPercent",   js_yoga_nodeStyleSetMinHeightPercent);
    setFunctionProperty(ctx, yoga, "nodeStyleSetMaxWidth",           js_yoga_nodeStyleSetMaxWidth);
    setFunctionProperty(ctx, yoga, "nodeStyleSetMaxWidthPercent",    js_yoga_nodeStyleSetMaxWidthPercent);
    setFunctionProperty(ctx, yoga, "nodeStyleSetMaxHeight",          js_yoga_nodeStyleSetMaxHeight);
    setFunctionProperty(ctx, yoga, "nodeStyleSetMaxHeightPercent",   js_yoga_nodeStyleSetMaxHeightPercent);

    /* Edge-based style setters */
    setFunctionProperty(ctx, yoga, "nodeStyleSetPosition",        js_yoga_nodeStyleSetPosition);
    setFunctionProperty(ctx, yoga, "nodeStyleSetPositionPercent",  js_yoga_nodeStyleSetPositionPercent);
    setFunctionProperty(ctx, yoga, "nodeStyleSetMargin",           js_yoga_nodeStyleSetMargin);
    setFunctionProperty(ctx, yoga, "nodeStyleSetMarginPercent",    js_yoga_nodeStyleSetMarginPercent);
    setFunctionProperty(ctx, yoga, "nodeStyleSetMarginAuto",       js_yoga_nodeStyleSetMarginAuto);
    setFunctionProperty(ctx, yoga, "nodeStyleSetPadding",          js_yoga_nodeStyleSetPadding);
    setFunctionProperty(ctx, yoga, "nodeStyleSetPaddingPercent",   js_yoga_nodeStyleSetPaddingPercent);
    setFunctionProperty(ctx, yoga, "nodeStyleSetBorder",           js_yoga_nodeStyleSetBorder);

    /* Gap setter */
    setFunctionProperty(ctx, yoga, "nodeStyleSetGap",              js_yoga_nodeStyleSetGap);

    /* Batch style setter */
}

/* ------------------------------------------------------------------ */
/*  Yoga cleanup: free all nodes                                      */
/* ------------------------------------------------------------------ */

static void yoga_destroy_all(void) {
    for (int i = 1; i < g_yoga_capacity; i++) {
        if (g_yoga_nodes[i]) {
            YGNodeSetContext(g_yoga_nodes[i], NULL);
            YGNodeSetMeasureFunc(g_yoga_nodes[i], NULL);
            YGNodeFreeRecursive(g_yoga_nodes[i]);
            g_yoga_nodes[i] = NULL;
        }
        yoga_free_measure_data(i);
    }
    free(g_yoga_nodes);
    g_yoga_nodes = NULL;
    g_yoga_capacity = 0;
    free(g_yoga_measure_data);
    g_yoga_measure_data = NULL;
    g_yoga_measure_capacity = 0;
    g_yoga_next_id = 1;
}

/* ------------------------------------------------------------------ */
/*  setTimeout callback GC protection                                 */
/* ------------------------------------------------------------------ */

#define MAX_PROTECTED_VALUES 256
static JSValueRef g_protected_values[MAX_PROTECTED_VALUES];
static int        g_protected_count = 0;

static void protect_value(JSContextRef ctx, JSValueRef val) {
    if (g_protected_count < MAX_PROTECTED_VALUES) {
        JSValueProtect(ctx, val);
        g_protected_values[g_protected_count++] = val;
    }
}

static void unprotect_all_values(JSContextRef ctx) {
    for (int i = 0; i < g_protected_count; i++) {
        JSValueUnprotect(ctx, g_protected_values[i]);
        g_protected_values[i] = NULL;
    }
    g_protected_count = 0;
}

/* ------------------------------------------------------------------ */
/*  JNI: nativeInit                                                   */
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

    /* -- console object -- */
    JSObjectRef consoleObj = JSObjectMake(g_context, NULL, NULL);
    JSStringRef consoleName = CStringToJSString("console");
    JSObjectSetProperty(g_context, global, consoleName, consoleObj, 0, NULL);
    JSStringRelease(consoleName);

    const char* logNames[] = {"log", "warn", "error", "info", "debug"};
    JSStringRef logFnName = CStringToJSString("log");
    JSObjectRef logFn = JSObjectMakeFunctionWithCallback(
        g_context, logFnName, js_console_log);
    JSStringRelease(logFnName);

    for (int i = 0; i < 5; i++) {
        JSStringRef n = CStringToJSString(logNames[i]);
        JSObjectSetProperty(g_context, consoleObj, n, logFn, 0, NULL);
        JSStringRelease(n);
    }

    /* -- __glyphis_native bridge -- */
    JSObjectRef bridge = JSObjectMake(g_context, NULL, NULL);
    JSStringRef bridgeName = CStringToJSString("__glyphis_native");
    JSObjectSetProperty(g_context, global, bridgeName, bridge, 0, NULL);
    JSStringRelease(bridgeName);

    setFunctionProperty(g_context, bridge, "submitRenderCommands", js_submitRenderCommands);
    setFunctionProperty(g_context, bridge, "measureText",          js_measureText);
    setFunctionProperty(g_context, bridge, "getViewportSize",      js_getViewportSize);
    setFunctionProperty(g_context, bridge, "scheduleTimer",        js_scheduleTimer);
    setFunctionProperty(g_context, bridge, "loadImage",            js_loadImage);
    setStringProperty(g_context,   bridge, "platform",             "android");

    /* -- Yoga bridge -- */
    register_yoga_bridge(g_context, global);

    /* -- Polyfills evaluated as JS -- */
    const char* polyfills =
        /* performance.now */
        "var __glyphis_startTime = Date.now();"
        "var performance = { now: function() { return Date.now() - __glyphis_startTime; } };"

        /* setTimeout / clearTimeout / setInterval / clearInterval
           (defined first so queueMicrotask and MessageChannel can use setTimeout) */
        "var __glyphis_timers = {};"
        "var __glyphis_nextTimerId = 1;"
        ""
        "globalThis.setTimeout = function(callback, delay) {"
        "  var id = __glyphis_nextTimerId++;"
        "  __glyphis_timers[id] = callback;"
        "  __glyphis_native.scheduleTimer(id, delay || 0);"
        "  return id;"
        "};"
        ""
        "globalThis.clearTimeout = function(id) {"
        "  delete __glyphis_timers[id];"
        "};"
        ""
        "globalThis.setInterval = function(callback, interval) {"
        "  var id = __glyphis_nextTimerId++;"
        "  function tick() {"
        "    callback();"
        "    __glyphis_timers[id] = tick;"
        "    __glyphis_native.scheduleTimer(id, interval);"
        "  }"
        "  __glyphis_timers[id] = tick;"
        "  __glyphis_native.scheduleTimer(id, interval);"
        "  return id;"
        "};"
        ""
        "globalThis.clearInterval = globalThis.clearTimeout;"
        ""
        /* requestAnimationFrame / cancelAnimationFrame */
        "globalThis.requestAnimationFrame = function(callback) {"
        "  return setTimeout(function() { callback(performance.now()); }, 16);"
        "};"
        ""
        "globalThis.cancelAnimationFrame = globalThis.clearTimeout;"
        ""
        /* queueMicrotask — use setTimeout(cb, 0) instead of Promise.resolve().then()
           to ensure the microtask is dispatched via the native timer loop */
        "if (typeof queueMicrotask === 'undefined') {"
        "  globalThis.queueMicrotask = function(cb) { setTimeout(cb, 0); };"
        "}"
        ""
        /* MessageChannel */
        "if (typeof MessageChannel === 'undefined') {"
        "  function MessageChannel() {"
        "    this.port1 = { onmessage: null };"
        "    var self = this;"
        "    this.port2 = {"
        "      postMessage: function(msg) {"
        "        if (self.port1.onmessage) {"
        "          var h = self.port1.onmessage;"
        "          setTimeout(function() { h({ data: msg }); }, 0);"
        "        }"
        "      }"
        "    };"
        "  }"
        "  globalThis.MessageChannel = MessageChannel;"
        "}"
    ;

    JSStringRef polyfillStr = CStringToJSString(polyfills);
    JSEvaluateScript(g_context, polyfillStr, NULL, NULL, 0, NULL);
    JSStringRelease(polyfillStr);

}

/* ------------------------------------------------------------------ */
/*  JNI: nativeEvaluateScript                                         */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  JNI: nativeDestroy                                                */
/* ------------------------------------------------------------------ */

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeDestroy(
    JNIEnv* env, jobject thiz)
{
    if (g_context) {
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

/* ------------------------------------------------------------------ */
/*  JNI: nativeHandleTouch                                            */
/* ------------------------------------------------------------------ */

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeHandleTouch(
    JNIEnv* env, jobject thiz, jstring type, jdouble x, jdouble y)
{
    if (!g_context) return;

    const char* cType = env->GetStringUTFChars(type, NULL);

    char script[256];
    snprintf(script, sizeof(script),
        "if(typeof __glyphis_handleTouch==='function')"
        "__glyphis_handleTouch('%s',%f,%f);",
        cType, x, y);

    JSStringRef jsScript = CStringToJSString(script);
    JSEvaluateScript(g_context, jsScript, NULL, NULL, 0, NULL);
    JSStringRelease(jsScript);

    env->ReleaseStringUTFChars(type, cType);
}

/* ------------------------------------------------------------------ */
/*  JNI: nativeFireTimer                                              */
/* ------------------------------------------------------------------ */

JNIEXPORT void JNICALL
Java_io_johnsonlee_glyphis_shell_GlyphisRuntime_nativeFireTimer(
    JNIEnv* env, jobject thiz, jint timerId)
{
    if (!g_context) return;

    char script[256];
    snprintf(script, sizeof(script),
        "if(__glyphis_timers&&__glyphis_timers[%d]){"
        "var __cb=__glyphis_timers[%d];"
        "delete __glyphis_timers[%d];"
        "__cb(performance.now());"
        "}",
        timerId, timerId, timerId);

    JSStringRef jsScript = CStringToJSString(script);
    JSEvaluateScript(g_context, jsScript, NULL, NULL, 0, NULL);
    JSStringRelease(jsScript);
}

/* ------------------------------------------------------------------ */
/*  JNI_OnLoad                                                        */
/* ------------------------------------------------------------------ */

JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void* reserved) {
    g_jvm = vm;
    return JNI_VERSION_1_6;
}

} // extern "C"
