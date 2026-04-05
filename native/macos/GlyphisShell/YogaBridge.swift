import JavaScriptCore

/// Holds the JSContext reference and node ID for measure function callbacks.
/// Stored as the Yoga node context so the C measure function can reach back into JS.
private class MeasureInfo {
    let context: JSContext
    let nodeId: Int

    init(context: JSContext, nodeId: Int) {
        self.context = context
        self.nodeId = nodeId
    }
}

/// Top-level C-compatible measure function matching the YGMeasureFunc signature.
/// Retrieves the MeasureInfo from the Yoga node context and calls into JS.
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
    let script = "__yoga_measure(\(info.nodeId), \(width), \(widthMode.rawValue), \(height), \(heightMode.rawValue))"
    NSLog("[Glyphis] measure called for node %d, evaluating: %@", info.nodeId, script)
    let result = info.context.evaluateScript(script)
    let w = Float(result?.objectForKeyedSubscript("width")?.toDouble() ?? 0)
    let h = Float(result?.objectForKeyedSubscript("height")?.toDouble() ?? 0)
    NSLog("[Glyphis] measure result: %.1f x %.1f", w, h)
    return YGSize(width: w, height: h)
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

            // Create and retain a MeasureInfo, store its pointer as the node context
            let info = MeasureInfo(context: self.context, nodeId: nodeId)
            self.measureInfos[nodeId] = info
            let ptr = Unmanaged.passUnretained(info).toOpaque()
            YGNodeSetContext(node, ptr)

            YGNodeSetMeasureFunc(node, yogaMeasureFunc)
        }
        yoga.setObject(enable, forKeyedSubscript: "enableMeasure" as NSString)
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

    // MARK: - Helpers

    /// Returns the node ID for a given YGNodeRef, used by the measure callback.
    func nodeIdForRef(_ ref: YGNodeRef) -> Int? {
        for (id, node) in nodes where node == ref {
            return id
        }
        return nil
    }
}
