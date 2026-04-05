#include "bridge_common.h"

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

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

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
/*  Register __yoga object on global context                          */
/* ------------------------------------------------------------------ */

void register_yoga_bridge(JSContextRef ctx, JSObjectRef global) {
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

void yoga_destroy_all(void) {
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
