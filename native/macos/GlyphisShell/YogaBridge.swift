import JavaScriptCore
import AppKit

/// Holds text and font info for native text measurement during Yoga layout.
/// Stored as the Yoga node context so the C measure function can measure text
/// directly without calling back into JS.
private class MeasureInfo {
    let context: JSContext
    let nodeId: Int
    var text: String
    var fontSize: CGFloat
    var fontFamily: String
    var fontWeight: String

    init(context: JSContext, nodeId: Int, text: String, fontSize: CGFloat, fontFamily: String, fontWeight: String) {
        self.context = context
        self.nodeId = nodeId
        self.text = text
        self.fontSize = fontSize
        self.fontFamily = fontFamily
        self.fontWeight = fontWeight
    }
}

/// Maps a CSS font-weight string to NSFont.Weight.
private func mapFontWeight(_ weight: String) -> NSFont.Weight {
    switch weight {
    case "bold", "700": return .bold
    case "800": return .heavy
    case "900": return .black
    case "600": return .semibold
    case "500": return .medium
    case "300": return .light
    case "200": return .thin
    case "100": return .ultraLight
    default: return .regular
    }
}

/// Top-level C-compatible measure function matching the YGMeasureFunc signature.
/// Measures text directly using native APIs -- NO JS callback.
private func yogaMeasureFunc(
    _ nodeRef: YGNodeConstRef?,
    _ width: Float,
    _ widthMode: YGMeasureMode,
    _ height: Float,
    _ heightMode: YGMeasureMode
) -> YGSize {
    guard let nodeRef = nodeRef,
          let ptr = YGNodeGetContext(nodeRef)
    else {
        return YGSize(width: 0, height: 0)
    }
    let info = Unmanaged<MeasureInfo>.fromOpaque(ptr).takeUnretainedValue()

    // Measure directly using native API
    let weight = mapFontWeight(info.fontWeight)
    let font: NSFont
    if !info.fontFamily.isEmpty, let customFont = NSFont(name: info.fontFamily, size: info.fontSize) {
        font = customFont
    } else {
        font = NSFont.systemFont(ofSize: info.fontSize, weight: weight)
    }
    let size = (info.text as NSString).size(withAttributes: [.font: font])
    return YGSize(width: Float(ceil(size.width)), height: Float(ceil(size.height)))
}

/// Bridges the Yoga C layout API to JavaScript via JSContext.
///
/// Registers a `__yoga` object on the JSContext with functions that JS can call
/// to create, configure, and calculate layout for Yoga nodes. Each node is
/// identified by an integer ID on the JS side.
class YogaBridge {

    // MARK: - State

    private var nodes: [Int: YGNodeRef] = [:]
    private var nextId: Int = 1
    private let context: JSContext

    /// Retains MeasureInfo instances so they are not deallocated while the
    /// Yoga node still references them via YGNodeGetContext.
    private var measureInfos: [Int: MeasureInfo] = [:]

    init(context: JSContext) {
        self.context = context
    }

    // MARK: - Public API

    /// Registers the `__yoga` object and all bridge functions in the given JSContext.
    func register(in context: JSContext) {
        let yoga = JSValue(newObjectIn: context)!

        // -- Node lifecycle --

        registerNodeNew(on: yoga)
        registerNodeFreeRecursive(on: yoga)
        registerNodeInsertChild(on: yoga)
        registerNodeRemoveChild(on: yoga)
        registerNodeCalculateLayout(on: yoga)
        registerNodeMarkDirty(on: yoga)
        registerEnableMeasure(on: yoga)
        registerEnableMeasureNative(on: yoga)
        registerUpdateMeasureText(on: yoga)

        // -- Layout results --

        registerLayoutGetters(on: yoga)

        // -- Style setters: enums --

        registerEnumStyleSetters(on: yoga)

        // -- Style setters: float --

        registerFloatStyleSetters(on: yoga)

        // -- Style setters: dimension (value/percent/auto) --

        registerDimensionStyleSetters(on: yoga)

        // -- Style setters: edge-based (position, margin, padding, border) --

        registerEdgeStyleSetters(on: yoga)

        // -- Style setters: gap --

        registerGapSetter(on: yoga)

        // -- Batch style setter --

        registerBatchStyleSetter(on: yoga)

        context.setObject(yoga, forKeyedSubscript: "__yoga" as NSString)
    }

    // MARK: - Cleanup

    /// Frees all Yoga nodes and releases retained measure info objects.
    func destroy() {
        for (id, node) in nodes {
            cleanupMeasureInfo(for: id, node: node)
            YGNodeFreeRecursive(node)
        }
        nodes.removeAll()
        measureInfos.removeAll()
    }

    // MARK: - Node Lifecycle

    private func registerNodeNew(on yoga: JSValue) {
        let create: @convention(block) () -> Int = { [weak self] in
            guard let self = self else { return -1 }
            let id = self.nextId
            self.nextId += 1
            let node = YGNodeNew()!
            self.nodes[id] = node
            return id
        }
        yoga.setObject(create, forKeyedSubscript: "nodeNew" as NSString)
    }

    private func registerNodeFreeRecursive(on yoga: JSValue) {
        let free: @convention(block) (Int) -> Void = { [weak self] nodeId in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            self.cleanupMeasureInfo(for: nodeId, node: node)
            YGNodeFreeRecursive(node)
            self.nodes.removeValue(forKey: nodeId)
        }
        yoga.setObject(free, forKeyedSubscript: "nodeFreeRecursive" as NSString)
    }

    private func registerNodeInsertChild(on yoga: JSValue) {
        let insert: @convention(block) (Int, Int, Int) -> Void = { [weak self] parentId, childId, index in
            guard let self = self,
                  let parent = self.nodes[parentId],
                  let child = self.nodes[childId]
            else { return }
            YGNodeInsertChild(parent, child, index)
        }
        yoga.setObject(insert, forKeyedSubscript: "nodeInsertChild" as NSString)
    }

    private func registerNodeRemoveChild(on yoga: JSValue) {
        let remove: @convention(block) (Int, Int) -> Void = { [weak self] parentId, childId in
            guard let self = self,
                  let parent = self.nodes[parentId],
                  let child = self.nodes[childId]
            else { return }
            YGNodeRemoveChild(parent, child)
        }
        yoga.setObject(remove, forKeyedSubscript: "nodeRemoveChild" as NSString)
    }

    private func registerNodeCalculateLayout(on yoga: JSValue) {
        let calc: @convention(block) (Int, Double, Double, Int) -> Void = { [weak self] nodeId, width, height, direction in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeCalculateLayout(
                node,
                Float(width),
                Float(height),
                YGDirection(rawValue: Int32(direction))!
            )
        }
        yoga.setObject(calc, forKeyedSubscript: "nodeCalculateLayout" as NSString)
    }

    private func registerNodeMarkDirty(on yoga: JSValue) {
        let mark: @convention(block) (Int) -> Void = { [weak self] nodeId in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeMarkDirty(node)
        }
        yoga.setObject(mark, forKeyedSubscript: "nodeMarkDirty" as NSString)
    }

    // MARK: - Measure Function

    private func registerEnableMeasure(on yoga: JSValue) {
        let enable: @convention(block) (Int) -> Void = { [weak self] nodeId in
            guard let self = self, let node = self.nodes[nodeId] else { return }

            // Clean up any previous measure info for this node
            self.cleanupMeasureInfo(for: nodeId, node: node)

            // Create and retain a MeasureInfo with empty text (backward compat)
            let info = MeasureInfo(context: self.context, nodeId: nodeId, text: "", fontSize: 14, fontFamily: "", fontWeight: "")
            self.measureInfos[nodeId] = info
            let ptr = Unmanaged.passUnretained(info).toOpaque()
            YGNodeSetContext(node, ptr)

            YGNodeSetMeasureFunc(node, yogaMeasureFunc)
        }
        yoga.setObject(enable, forKeyedSubscript: "enableMeasure" as NSString)
    }

    private func registerEnableMeasureNative(on yoga: JSValue) {
        let enable: @convention(block) (Int, String, Double, String, String) -> Void = {
            [weak self] nodeId, text, fontSize, fontFamily, fontWeight in
            guard let self = self, let node = self.nodes[nodeId] else { return }

            // Clean up any previous measure info for this node
            self.cleanupMeasureInfo(for: nodeId, node: node)

            // Create MeasureInfo with text + font data for native measurement
            let info = MeasureInfo(
                context: self.context, nodeId: nodeId,
                text: text, fontSize: CGFloat(fontSize),
                fontFamily: fontFamily, fontWeight: fontWeight
            )
            self.measureInfos[nodeId] = info
            let ptr = Unmanaged.passUnretained(info).toOpaque()
            YGNodeSetContext(node, ptr)

            YGNodeSetMeasureFunc(node, yogaMeasureFunc)
        }
        yoga.setObject(enable, forKeyedSubscript: "enableMeasureNative" as NSString)
    }

    private func registerUpdateMeasureText(on yoga: JSValue) {
        let update: @convention(block) (Int, String) -> Void = { [weak self] nodeId, text in
            guard let self = self else { return }
            if let info = self.measureInfos[nodeId] {
                info.text = text
            }
        }
        yoga.setObject(update, forKeyedSubscript: "updateMeasureText" as NSString)
    }

    private func cleanupMeasureInfo(for nodeId: Int, node: YGNodeRef) {
        if measureInfos[nodeId] != nil {
            YGNodeSetContext(node, nil)
            YGNodeSetMeasureFunc(node, nil)
            measureInfos.removeValue(forKey: nodeId)
        }
    }

    // MARK: - Layout Getters

    private func registerLayoutGetters(on yoga: JSValue) {
        let getLeft: @convention(block) (Int) -> Double = { [weak self] nodeId in
            guard let self = self, let node = self.nodes[nodeId] else { return 0 }
            return Double(YGNodeLayoutGetLeft(node))
        }
        yoga.setObject(getLeft, forKeyedSubscript: "nodeLayoutGetLeft" as NSString)

        let getTop: @convention(block) (Int) -> Double = { [weak self] nodeId in
            guard let self = self, let node = self.nodes[nodeId] else { return 0 }
            return Double(YGNodeLayoutGetTop(node))
        }
        yoga.setObject(getTop, forKeyedSubscript: "nodeLayoutGetTop" as NSString)

        let getRight: @convention(block) (Int) -> Double = { [weak self] nodeId in
            guard let self = self, let node = self.nodes[nodeId] else { return 0 }
            return Double(YGNodeLayoutGetRight(node))
        }
        yoga.setObject(getRight, forKeyedSubscript: "nodeLayoutGetRight" as NSString)

        let getBottom: @convention(block) (Int) -> Double = { [weak self] nodeId in
            guard let self = self, let node = self.nodes[nodeId] else { return 0 }
            return Double(YGNodeLayoutGetBottom(node))
        }
        yoga.setObject(getBottom, forKeyedSubscript: "nodeLayoutGetBottom" as NSString)

        let getWidth: @convention(block) (Int) -> Double = { [weak self] nodeId in
            guard let self = self, let node = self.nodes[nodeId] else { return 0 }
            return Double(YGNodeLayoutGetWidth(node))
        }
        yoga.setObject(getWidth, forKeyedSubscript: "nodeLayoutGetWidth" as NSString)

        let getHeight: @convention(block) (Int) -> Double = { [weak self] nodeId in
            guard let self = self, let node = self.nodes[nodeId] else { return 0 }
            return Double(YGNodeLayoutGetHeight(node))
        }
        yoga.setObject(getHeight, forKeyedSubscript: "nodeLayoutGetHeight" as NSString)
    }

    // MARK: - Enum Style Setters

    private func registerEnumStyleSetters(on yoga: JSValue) {
        let setDirection: @convention(block) (Int, Int) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetDirection(node, YGDirection(rawValue: Int32(value))!)
        }
        yoga.setObject(setDirection, forKeyedSubscript: "nodeStyleSetDirection" as NSString)

        let setFlexDirection: @convention(block) (Int, Int) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetFlexDirection(node, YGFlexDirection(rawValue: Int32(value))!)
        }
        yoga.setObject(setFlexDirection, forKeyedSubscript: "nodeStyleSetFlexDirection" as NSString)

        let setJustifyContent: @convention(block) (Int, Int) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetJustifyContent(node, YGJustify(rawValue: Int32(value))!)
        }
        yoga.setObject(setJustifyContent, forKeyedSubscript: "nodeStyleSetJustifyContent" as NSString)

        let setAlignContent: @convention(block) (Int, Int) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetAlignContent(node, YGAlign(rawValue: Int32(value))!)
        }
        yoga.setObject(setAlignContent, forKeyedSubscript: "nodeStyleSetAlignContent" as NSString)

        let setAlignItems: @convention(block) (Int, Int) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetAlignItems(node, YGAlign(rawValue: Int32(value))!)
        }
        yoga.setObject(setAlignItems, forKeyedSubscript: "nodeStyleSetAlignItems" as NSString)

        let setAlignSelf: @convention(block) (Int, Int) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetAlignSelf(node, YGAlign(rawValue: Int32(value))!)
        }
        yoga.setObject(setAlignSelf, forKeyedSubscript: "nodeStyleSetAlignSelf" as NSString)

        let setPositionType: @convention(block) (Int, Int) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetPositionType(node, YGPositionType(rawValue: Int32(value))!)
        }
        yoga.setObject(setPositionType, forKeyedSubscript: "nodeStyleSetPositionType" as NSString)

        let setFlexWrap: @convention(block) (Int, Int) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetFlexWrap(node, YGWrap(rawValue: Int32(value))!)
        }
        yoga.setObject(setFlexWrap, forKeyedSubscript: "nodeStyleSetFlexWrap" as NSString)

        let setOverflow: @convention(block) (Int, Int) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetOverflow(node, YGOverflow(rawValue: Int32(value))!)
        }
        yoga.setObject(setOverflow, forKeyedSubscript: "nodeStyleSetOverflow" as NSString)

        let setDisplay: @convention(block) (Int, Int) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetDisplay(node, YGDisplay(rawValue: Int32(value))!)
        }
        yoga.setObject(setDisplay, forKeyedSubscript: "nodeStyleSetDisplay" as NSString)
    }

    // MARK: - Float Style Setters

    private func registerFloatStyleSetters(on yoga: JSValue) {
        let setFlex: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetFlex(node, Float(value))
        }
        yoga.setObject(setFlex, forKeyedSubscript: "nodeStyleSetFlex" as NSString)

        let setFlexGrow: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetFlexGrow(node, Float(value))
        }
        yoga.setObject(setFlexGrow, forKeyedSubscript: "nodeStyleSetFlexGrow" as NSString)

        let setFlexShrink: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetFlexShrink(node, Float(value))
        }
        yoga.setObject(setFlexShrink, forKeyedSubscript: "nodeStyleSetFlexShrink" as NSString)
    }

    // MARK: - Dimension Style Setters (value / percent / auto)

    private func registerDimensionStyleSetters(on yoga: JSValue) {
        // flexBasis
        let setFlexBasis: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetFlexBasis(node, Float(value))
        }
        yoga.setObject(setFlexBasis, forKeyedSubscript: "nodeStyleSetFlexBasis" as NSString)

        let setFlexBasisPercent: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetFlexBasisPercent(node, Float(value))
        }
        yoga.setObject(setFlexBasisPercent, forKeyedSubscript: "nodeStyleSetFlexBasisPercent" as NSString)

        let setFlexBasisAuto: @convention(block) (Int) -> Void = { [weak self] nodeId in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetFlexBasisAuto(node)
        }
        yoga.setObject(setFlexBasisAuto, forKeyedSubscript: "nodeStyleSetFlexBasisAuto" as NSString)

        // width
        let setWidth: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetWidth(node, Float(value))
        }
        yoga.setObject(setWidth, forKeyedSubscript: "nodeStyleSetWidth" as NSString)

        let setWidthPercent: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetWidthPercent(node, Float(value))
        }
        yoga.setObject(setWidthPercent, forKeyedSubscript: "nodeStyleSetWidthPercent" as NSString)

        let setWidthAuto: @convention(block) (Int) -> Void = { [weak self] nodeId in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetWidthAuto(node)
        }
        yoga.setObject(setWidthAuto, forKeyedSubscript: "nodeStyleSetWidthAuto" as NSString)

        // height
        let setHeight: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetHeight(node, Float(value))
        }
        yoga.setObject(setHeight, forKeyedSubscript: "nodeStyleSetHeight" as NSString)

        let setHeightPercent: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetHeightPercent(node, Float(value))
        }
        yoga.setObject(setHeightPercent, forKeyedSubscript: "nodeStyleSetHeightPercent" as NSString)

        let setHeightAuto: @convention(block) (Int) -> Void = { [weak self] nodeId in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetHeightAuto(node)
        }
        yoga.setObject(setHeightAuto, forKeyedSubscript: "nodeStyleSetHeightAuto" as NSString)

        // minWidth
        let setMinWidth: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetMinWidth(node, Float(value))
        }
        yoga.setObject(setMinWidth, forKeyedSubscript: "nodeStyleSetMinWidth" as NSString)

        let setMinWidthPercent: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetMinWidthPercent(node, Float(value))
        }
        yoga.setObject(setMinWidthPercent, forKeyedSubscript: "nodeStyleSetMinWidthPercent" as NSString)

        // minHeight
        let setMinHeight: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetMinHeight(node, Float(value))
        }
        yoga.setObject(setMinHeight, forKeyedSubscript: "nodeStyleSetMinHeight" as NSString)

        let setMinHeightPercent: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetMinHeightPercent(node, Float(value))
        }
        yoga.setObject(setMinHeightPercent, forKeyedSubscript: "nodeStyleSetMinHeightPercent" as NSString)

        // maxWidth
        let setMaxWidth: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetMaxWidth(node, Float(value))
        }
        yoga.setObject(setMaxWidth, forKeyedSubscript: "nodeStyleSetMaxWidth" as NSString)

        let setMaxWidthPercent: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetMaxWidthPercent(node, Float(value))
        }
        yoga.setObject(setMaxWidthPercent, forKeyedSubscript: "nodeStyleSetMaxWidthPercent" as NSString)

        // maxHeight
        let setMaxHeight: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetMaxHeight(node, Float(value))
        }
        yoga.setObject(setMaxHeight, forKeyedSubscript: "nodeStyleSetMaxHeight" as NSString)

        let setMaxHeightPercent: @convention(block) (Int, Double) -> Void = { [weak self] nodeId, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetMaxHeightPercent(node, Float(value))
        }
        yoga.setObject(setMaxHeightPercent, forKeyedSubscript: "nodeStyleSetMaxHeightPercent" as NSString)
    }

    // MARK: - Edge-Based Style Setters

    private func registerEdgeStyleSetters(on yoga: JSValue) {
        // position
        let setPosition: @convention(block) (Int, Int, Double) -> Void = { [weak self] nodeId, edge, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetPosition(node, YGEdge(rawValue: Int32(edge))!, Float(value))
        }
        yoga.setObject(setPosition, forKeyedSubscript: "nodeStyleSetPosition" as NSString)

        let setPositionPercent: @convention(block) (Int, Int, Double) -> Void = { [weak self] nodeId, edge, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetPositionPercent(node, YGEdge(rawValue: Int32(edge))!, Float(value))
        }
        yoga.setObject(setPositionPercent, forKeyedSubscript: "nodeStyleSetPositionPercent" as NSString)

        // margin
        let setMargin: @convention(block) (Int, Int, Double) -> Void = { [weak self] nodeId, edge, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetMargin(node, YGEdge(rawValue: Int32(edge))!, Float(value))
        }
        yoga.setObject(setMargin, forKeyedSubscript: "nodeStyleSetMargin" as NSString)

        let setMarginPercent: @convention(block) (Int, Int, Double) -> Void = { [weak self] nodeId, edge, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetMarginPercent(node, YGEdge(rawValue: Int32(edge))!, Float(value))
        }
        yoga.setObject(setMarginPercent, forKeyedSubscript: "nodeStyleSetMarginPercent" as NSString)

        let setMarginAuto: @convention(block) (Int, Int) -> Void = { [weak self] nodeId, edge in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetMarginAuto(node, YGEdge(rawValue: Int32(edge))!)
        }
        yoga.setObject(setMarginAuto, forKeyedSubscript: "nodeStyleSetMarginAuto" as NSString)

        // padding
        let setPadding: @convention(block) (Int, Int, Double) -> Void = { [weak self] nodeId, edge, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetPadding(node, YGEdge(rawValue: Int32(edge))!, Float(value))
        }
        yoga.setObject(setPadding, forKeyedSubscript: "nodeStyleSetPadding" as NSString)

        let setPaddingPercent: @convention(block) (Int, Int, Double) -> Void = { [weak self] nodeId, edge, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetPaddingPercent(node, YGEdge(rawValue: Int32(edge))!, Float(value))
        }
        yoga.setObject(setPaddingPercent, forKeyedSubscript: "nodeStyleSetPaddingPercent" as NSString)

        // border
        let setBorder: @convention(block) (Int, Int, Double) -> Void = { [weak self] nodeId, edge, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetBorder(node, YGEdge(rawValue: Int32(edge))!, Float(value))
        }
        yoga.setObject(setBorder, forKeyedSubscript: "nodeStyleSetBorder" as NSString)
    }

    // MARK: - Gap Setter

    private func registerGapSetter(on yoga: JSValue) {
        let setGap: @convention(block) (Int, Int, Double) -> Void = { [weak self] nodeId, gutter, value in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            YGNodeStyleSetGap(node, YGGutter(rawValue: Int32(gutter))!, Float(value))
        }
        yoga.setObject(setGap, forKeyedSubscript: "nodeStyleSetGap" as NSString)
    }

    // MARK: - Batch Style Setter

    private func registerBatchStyleSetter(on yoga: JSValue) {
        let setBatch: @convention(block) (Int, String) -> Void = { [weak self] nodeId, jsonString in
            guard let self = self, let node = self.nodes[nodeId] else { return }
            guard let data = jsonString.data(using: .utf8),
                  let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else { return }

            // Dimensions (number or "auto" or "N%")
            if let v = dict["width"] { self.applyDimension(node, v, set: YGNodeStyleSetWidth, setPercent: YGNodeStyleSetWidthPercent, setAuto: YGNodeStyleSetWidthAuto) }
            if let v = dict["height"] { self.applyDimension(node, v, set: YGNodeStyleSetHeight, setPercent: YGNodeStyleSetHeightPercent, setAuto: YGNodeStyleSetHeightAuto) }
            if let v = dict["minWidth"] { self.applyDimensionNoAuto(node, v, set: YGNodeStyleSetMinWidth, setPercent: YGNodeStyleSetMinWidthPercent) }
            if let v = dict["minHeight"] { self.applyDimensionNoAuto(node, v, set: YGNodeStyleSetMinHeight, setPercent: YGNodeStyleSetMinHeightPercent) }
            if let v = dict["maxWidth"] { self.applyDimensionNoAuto(node, v, set: YGNodeStyleSetMaxWidth, setPercent: YGNodeStyleSetMaxWidthPercent) }
            if let v = dict["maxHeight"] { self.applyDimensionNoAuto(node, v, set: YGNodeStyleSetMaxHeight, setPercent: YGNodeStyleSetMaxHeightPercent) }

            // Flex numeric
            if let v = dict["flex"] as? Double { YGNodeStyleSetFlex(node, Float(v)) }
            if let v = dict["flexGrow"] as? Double { YGNodeStyleSetFlexGrow(node, Float(v)) }
            if let v = dict["flexShrink"] as? Double { YGNodeStyleSetFlexShrink(node, Float(v)) }
            if let v = dict["flexBasis"] { self.applyDimension(node, v, set: YGNodeStyleSetFlexBasis, setPercent: YGNodeStyleSetFlexBasisPercent, setAuto: YGNodeStyleSetFlexBasisAuto) }

            // Flex enums (already resolved to Int by JS)
            if let v = dict["flexDirection"] as? Int { YGNodeStyleSetFlexDirection(node, YGFlexDirection(rawValue: Int32(v))!) }
            if let v = dict["flexWrap"] as? Int { YGNodeStyleSetFlexWrap(node, YGWrap(rawValue: Int32(v))!) }

            // Alignment enums
            if let v = dict["justifyContent"] as? Int { YGNodeStyleSetJustifyContent(node, YGJustify(rawValue: Int32(v))!) }
            if let v = dict["alignItems"] as? Int { YGNodeStyleSetAlignItems(node, YGAlign(rawValue: Int32(v))!) }
            if let v = dict["alignSelf"] as? Int { YGNodeStyleSetAlignSelf(node, YGAlign(rawValue: Int32(v))!) }
            if let v = dict["alignContent"] as? Int { YGNodeStyleSetAlignContent(node, YGAlign(rawValue: Int32(v))!) }

            // Padding (keys: padding_<edge>)
            for edge: Int32 in [0, 1, 2, 3, 6, 7, 8] {
                if let v = dict["padding_\(edge)"] as? Double {
                    YGNodeStyleSetPadding(node, YGEdge(rawValue: edge)!, Float(v))
                }
            }

            // Margin (keys: margin_<edge>)
            for edge: Int32 in [0, 1, 2, 3, 6, 7, 8] {
                if let v = dict["margin_\(edge)"] as? Double {
                    YGNodeStyleSetMargin(node, YGEdge(rawValue: edge)!, Float(v))
                }
            }

            // Position type
            if let v = dict["positionType"] as? Int { YGNodeStyleSetPositionType(node, YGPositionType(rawValue: Int32(v))!) }

            // Position edges (keys: position_<edge>)
            for edge: Int32 in [0, 1, 2, 3] {
                if let v = dict["position_\(edge)"] as? Double {
                    YGNodeStyleSetPosition(node, YGEdge(rawValue: edge)!, Float(v))
                }
            }

            // Border (keys: border_<edge>)
            for edge: Int32 in [0, 1, 2, 3, 8] {
                if let v = dict["border_\(edge)"] as? Double {
                    YGNodeStyleSetBorder(node, YGEdge(rawValue: edge)!, Float(v))
                }
            }

            // Display / overflow
            if let v = dict["display"] as? Int { YGNodeStyleSetDisplay(node, YGDisplay(rawValue: Int32(v))!) }
            if let v = dict["overflow"] as? Int { YGNodeStyleSetOverflow(node, YGOverflow(rawValue: Int32(v))!) }

            // Gap (keys: gap_<gutter>)
            for gutter: Int32 in [0, 1, 2] {
                if let v = dict["gap_\(gutter)"] as? Double {
                    YGNodeStyleSetGap(node, YGGutter(rawValue: gutter)!, Float(v))
                }
            }
        }
        yoga.setObject(setBatch, forKeyedSubscript: "nodeStyleSetBatch" as NSString)
    }

    /// Applies a dimension value that may be a number, "auto", or "N%" string.
    private func applyDimension(
        _ node: YGNodeRef, _ value: Any,
        set: (YGNodeRef, Float) -> Void,
        setPercent: (YGNodeRef, Float) -> Void,
        setAuto: (YGNodeRef) -> Void
    ) {
        if let s = value as? String {
            if s == "auto" {
                setAuto(node)
            } else if s.hasSuffix("%"), let num = Float(s.dropLast()) {
                setPercent(node, num)
            }
        } else if let n = value as? Double {
            set(node, Float(n))
        }
    }

    /// Applies a dimension value that may be a number or "N%" string (no auto variant).
    private func applyDimensionNoAuto(
        _ node: YGNodeRef, _ value: Any,
        set: (YGNodeRef, Float) -> Void,
        setPercent: (YGNodeRef, Float) -> Void
    ) {
        if let s = value as? String, s.hasSuffix("%"), let num = Float(s.dropLast()) {
            setPercent(node, num)
        } else if let n = value as? Double {
            set(node, Float(n))
        }
    }

    // MARK: - Helpers

    /// Returns the node ID for a given YGNodeRef, used by the measure callback.
    func nodeIdForRef(_ ref: YGNodeRef) -> Int? {
        for (id, node) in nodes where node == ref {
            return id
        }
        return nil
    }
}
