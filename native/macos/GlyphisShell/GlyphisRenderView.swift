import AppKit

// MARK: - Accessibility Element

class GlyphisAccessibilityElement: NSAccessibilityElement {
    let nodeId: Int
    var onActivate: (() -> Void)?
    var a11yRole: NSAccessibility.Role = .unknown
    var a11yFrame: NSRect = .zero
    var a11yLabel: String = ""
    var a11yHint: String = ""

    init(nodeId: Int) {
        self.nodeId = nodeId
        super.init()
    }

    override func accessibilityRole() -> NSAccessibility.Role? {
        return a11yRole
    }

    override func accessibilityLabel() -> String? {
        return a11yLabel
    }

    override func accessibilityHelp() -> String? {
        return a11yHint.isEmpty ? nil : a11yHint
    }

    override func accessibilityFrame() -> NSRect {
        return a11yFrame
    }

    override func accessibilityPerformPress() -> Bool {
        onActivate?()
        return onActivate != nil
    }

    override func isAccessibilityElement() -> Bool {
        return true
    }
}

/// Custom NSView that renders Glyphis framework render commands using Core Graphics.
/// Receives a JSON array of render command dictionaries from the JS runtime and
/// draws them in `draw(_:)` using CGContext.
class GlyphisRenderView: NSView {
    private var renderCommands: [[String: Any]] = []
    private var needsRender = false
    private var renderTimer: Timer?

    /// Lookup function for decoded images by imageId. Set by GlyphisRuntime.
    var imageLookup: ((String) -> CGImage?)? = nil

    /// Called by GlyphisRuntime when a mouse event occurs.
    /// Parameters: (eventType, x, y)
    var onTouch: ((String, CGFloat, CGFloat) -> Void)?

    /// Active native text input overlays keyed by inputId.
    private var textInputFields: [String: NSTextField] = [:]

    /// Callback closures for text input events, set by GlyphisRuntime.
    var onTextChange: ((String, String) -> Void)?
    var onTextSubmit: ((String) -> Void)?
    var onTextFocus: ((String) -> Void)?

    // MARK: - Accessibility

    private var accessibilityNodes: [GlyphisAccessibilityElement] = []
    var onAccessibilityAction: ((Int, String) -> Void)?

    override func isAccessibilityElement() -> Bool {
        return false
    }

    override func accessibilityChildren() -> [Any]? {
        return accessibilityNodes
    }

    func updateAccessibilityTree(_ nodes: [[String: Any]]) {
        var elements: [GlyphisAccessibilityElement] = []

        for node in nodes {
            guard let id = node["id"] as? Int,
                  let x = node["x"] as? Double,
                  let y = node["y"] as? Double,
                  let w = node["width"] as? Double,
                  let h = node["height"] as? Double else { continue }

            let label = node["label"] as? String ?? ""
            let hint = node["hint"] as? String ?? ""
            let role = node["role"] as? String ?? "none"
            let actions = node["actions"] as? [String] ?? []

            let element = GlyphisAccessibilityElement(nodeId: id)
            element.a11yLabel = label
            element.a11yHint = hint
            element.a11yRole = mapRole(role: role)

            // Convert view-local rect to screen coordinates
            let viewRect = NSRect(x: x, y: y, width: w, height: h)
            if let screenRect = window?.convertToScreen(convert(viewRect, to: nil)) {
                element.a11yFrame = screenRect
            } else {
                element.a11yFrame = viewRect
            }

            if actions.contains("activate") {
                element.onActivate = { [weak self] in
                    self?.onAccessibilityAction?(id, "activate")
                }
            }

            elements.append(element)
        }

        accessibilityNodes = elements
        NSAccessibility.post(element: self, notification: .layoutChanged)
    }

    private func mapRole(role: String) -> NSAccessibility.Role {
        switch role {
        case "button": return .button
        case "link": return .link
        case "image": return .image
        case "header": return .staticText
        case "search": return .textField
        case "switch": return .checkBox
        case "text": return .staticText
        default: return .unknown
        }
    }

    /// Flip the coordinate system so the origin is at the top-left, matching iOS.
    override var isFlipped: Bool { return true }

    override init(frame: CGRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.backgroundColor = NSColor.white.cgColor
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    deinit {
        renderTimer?.invalidate()
    }

    func setRenderCommands(_ commands: [[String: Any]]) {
        self.renderCommands = commands
        needsDisplay = true
    }

    // MARK: - Drawing

    override func draw(_ dirtyRect: NSRect) {
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }
        ctx.clear(bounds)

        // Fill white background
        ctx.setFillColor(NSColor.white.cgColor)
        ctx.fill(bounds)

        for cmd in renderCommands {
            guard let type = cmd["type"] as? String else { continue }

            switch type {
            case "rect":
                drawRect(ctx: ctx, cmd: cmd)
            case "text":
                drawText(ctx: ctx, cmd: cmd)
            case "image":
                drawImage(ctx: ctx, cmd: cmd)
            case "border":
                drawBorder(ctx: ctx, cmd: cmd)
            case "clip-start":
                ctx.saveGState()
                if let x = cgFloat(cmd, "x"), let y = cgFloat(cmd, "y"),
                   let w = cgFloat(cmd, "width"), let h = cgFloat(cmd, "height") {
                    let clipRect = CGRect(x: x, y: y, width: w, height: h)
                    if let radius = cgFloat(cmd, "borderRadius"), radius > 0 {
                        let path = CGPath(roundedRect: clipRect, cornerWidth: radius, cornerHeight: radius, transform: nil)
                        ctx.addPath(path)
                        ctx.clip()
                    } else {
                        ctx.clip(to: clipRect)
                    }
                }
            case "clip-end":
                ctx.restoreGState()
            default:
                break
            }
        }
    }

    // MARK: - Command Drawers

    private func drawRect(ctx: CGContext, cmd: [String: Any]) {
        guard let x = cgFloat(cmd, "x"), let y = cgFloat(cmd, "y"),
              let w = cgFloat(cmd, "width"), let h = cgFloat(cmd, "height"),
              let colorStr = cmd["color"] as? String
        else { return }

        let hasOpacity = cmd["opacity"] != nil
        if hasOpacity {
            ctx.saveGState()
            ctx.setAlpha(cgFloat(cmd, "opacity") ?? 1.0)
        }

        let color = parseColor(colorStr)
        ctx.setFillColor(color)

        let rect = CGRect(x: x, y: y, width: w, height: h)

        if let radius = cgFloat(cmd, "borderRadius"), radius > 0 {
            let path = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
            ctx.addPath(path)
            ctx.fillPath()
        } else {
            ctx.fill(rect)
        }

        if hasOpacity {
            ctx.restoreGState()
        }
    }

    private func drawText(ctx: CGContext, cmd: [String: Any]) {
        guard let x = cgFloat(cmd, "x"), let y = cgFloat(cmd, "y"),
              let text = cmd["text"] as? String,
              let colorStr = cmd["color"] as? String,
              let fontSize = cgFloat(cmd, "fontSize")
        else { return }

        let maxWidth: CGFloat = cgFloat(cmd, "maxWidth") ?? CGFloat.greatestFiniteMagnitude

        let hasOpacity = cmd["opacity"] != nil
        if hasOpacity {
            ctx.saveGState()
            ctx.setAlpha(cgFloat(cmd, "opacity") ?? 1.0)
        }

        let fontWeight = cmd["fontWeight"] as? String ?? "normal"
        let textAlign = cmd["textAlign"] as? String ?? "left"
        let lineHeight = fontSize * 1.2

        let color = NSColor(cgColor: parseColor(colorStr)) ?? NSColor.black
        let weight = mapFontWeight(fontWeight)

        let fontFamily = cmd["fontFamily"] as? String
        let font: NSFont
        if let family = fontFamily, let customFont = NSFont(name: family, size: fontSize) {
            font = customFont
        } else {
            font = NSFont.systemFont(ofSize: fontSize, weight: weight)
        }

        var alignment: NSTextAlignment = .left
        switch textAlign {
        case "center": alignment = .center
        case "right": alignment = .right
        default: alignment = .left
        }

        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = alignment
        paragraphStyle.lineSpacing = max(0, lineHeight - fontSize)

        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color,
            .paragraphStyle: paragraphStyle,
        ]

        let textSize = (text as NSString).size(withAttributes: attributes)
        let yOffset = (lineHeight - textSize.height) / 2

        let drawRect = CGRect(x: x, y: y + yOffset, width: maxWidth, height: lineHeight * 10)
        (text as NSString).draw(in: drawRect, withAttributes: attributes)

        if hasOpacity {
            ctx.restoreGState()
        }
    }

    private func drawBorder(ctx: CGContext, cmd: [String: Any]) {
        guard let x = cgFloat(cmd, "x"), let y = cgFloat(cmd, "y"),
              let w = cgFloat(cmd, "width"), let h = cgFloat(cmd, "height"),
              let colorStr = cmd["color"] as? String,
              let widths = cmd["widths"] as? [Any], widths.count == 4
        else { return }

        let tw = CGFloat(truncating: widths[0] as? NSNumber ?? 0)
        let rw = CGFloat(truncating: widths[1] as? NSNumber ?? 0)
        let bw = CGFloat(truncating: widths[2] as? NSNumber ?? 0)
        let lw = CGFloat(truncating: widths[3] as? NSNumber ?? 0)

        let hasOpacity = cmd["opacity"] != nil
        if hasOpacity {
            ctx.saveGState()
            ctx.setAlpha(cgFloat(cmd, "opacity") ?? 1.0)
        }

        let borderColor = parseColor(colorStr)

        // Top
        if tw > 0 {
            ctx.setStrokeColor(borderColor)
            ctx.setLineWidth(tw)
            ctx.move(to: CGPoint(x: x, y: y + tw / 2))
            ctx.addLine(to: CGPoint(x: x + w, y: y + tw / 2))
            ctx.strokePath()
        }
        // Right
        if rw > 0 {
            ctx.setStrokeColor(borderColor)
            ctx.setLineWidth(rw)
            ctx.move(to: CGPoint(x: x + w - rw / 2, y: y))
            ctx.addLine(to: CGPoint(x: x + w - rw / 2, y: y + h))
            ctx.strokePath()
        }
        // Bottom
        if bw > 0 {
            ctx.setStrokeColor(borderColor)
            ctx.setLineWidth(bw)
            ctx.move(to: CGPoint(x: x, y: y + h - bw / 2))
            ctx.addLine(to: CGPoint(x: x + w, y: y + h - bw / 2))
            ctx.strokePath()
        }
        // Left
        if lw > 0 {
            ctx.setStrokeColor(borderColor)
            ctx.setLineWidth(lw)
            ctx.move(to: CGPoint(x: x + lw / 2, y: y))
            ctx.addLine(to: CGPoint(x: x + lw / 2, y: y + h))
            ctx.strokePath()
        }

        if hasOpacity {
            ctx.restoreGState()
        }
    }

    private func drawImage(ctx: CGContext, cmd: [String: Any]) {
        guard let imageId = cmd["imageId"] as? String,
              let x = cgFloat(cmd, "x"), let y = cgFloat(cmd, "y"),
              let w = cgFloat(cmd, "width"), let h = cgFloat(cmd, "height"),
              let cgImage = imageLookup?(imageId) else { return }

        let resizeMode = (cmd["resizeMode"] as? String) ?? "cover"
        let hasOpacity = cmd["opacity"] != nil

        ctx.saveGState()
        if hasOpacity { ctx.setAlpha(cgFloat(cmd, "opacity") ?? 1.0) }

        // Clip for borderRadius
        if let radius = cgFloat(cmd, "borderRadius"), radius > 0 {
            let path = CGPath(roundedRect: CGRect(x: x, y: y, width: w, height: h),
                              cornerWidth: radius, cornerHeight: radius, transform: nil)
            ctx.addPath(path)
            ctx.clip()
        }

        let imgW = CGFloat(cgImage.width)
        let imgH = CGFloat(cgImage.height)

        var destRect: CGRect

        switch resizeMode {
        case "stretch":
            destRect = CGRect(x: x, y: y, width: w, height: h)
        case "contain":
            let scale = min(w / imgW, h / imgH)
            let dw = imgW * scale
            let dh = imgH * scale
            destRect = CGRect(x: x + (w - dw) / 2, y: y + (h - dh) / 2, width: dw, height: dh)
        default: // "cover"
            let scale = max(w / imgW, h / imgH)
            let dw = imgW * scale
            let dh = imgH * scale
            destRect = CGRect(x: x + (w - dw) / 2, y: y + (h - dh) / 2, width: dw, height: dh)
        }

        // CGContext.draw draws images bottom-up. Since isFlipped=true, flip manually.
        ctx.saveGState()
        ctx.translateBy(x: 0, y: destRect.origin.y + destRect.height)
        ctx.scaleBy(x: 1, y: -1)
        ctx.draw(cgImage, in: CGRect(x: destRect.origin.x, y: 0,
                                     width: destRect.width, height: destRect.height))
        ctx.restoreGState()

        ctx.restoreGState()
    }

    // MARK: - Helpers

    private func cgFloat(_ cmd: [String: Any], _ key: String) -> CGFloat? {
        if let n = cmd[key] as? NSNumber {
            return CGFloat(n.doubleValue)
        }
        return nil
    }

    // MARK: - Color Parsing

    private func parseColor(_ hex: String) -> CGColor {
        var hexStr = hex.trimmingCharacters(in: .whitespacesAndNewlines)

        // Handle rgba() format
        if hexStr.hasPrefix("rgba(") {
            let inner = hexStr.dropFirst(5).dropLast(1)
            let components = inner.split(separator: ",").map {
                $0.trimmingCharacters(in: .whitespaces)
            }
            if components.count == 4,
               let r = Double(components[0]),
               let g = Double(components[1]),
               let b = Double(components[2]),
               let a = Double(components[3]) {
                return CGColor(red: r / 255.0, green: g / 255.0, blue: b / 255.0, alpha: a)
            }
        }

        // Handle rgb() format
        if hexStr.hasPrefix("rgb(") {
            let inner = hexStr.dropFirst(4).dropLast(1)
            let components = inner.split(separator: ",").map {
                $0.trimmingCharacters(in: .whitespaces)
            }
            if components.count == 3,
               let r = Double(components[0]),
               let g = Double(components[1]),
               let b = Double(components[2]) {
                return CGColor(red: r / 255.0, green: g / 255.0, blue: b / 255.0, alpha: 1.0)
            }
        }

        // Handle "transparent"
        if hexStr == "transparent" {
            return CGColor(red: 0, green: 0, blue: 0, alpha: 0)
        }

        // Handle hex
        if hexStr.hasPrefix("#") { hexStr = String(hexStr.dropFirst()) }

        // 3-char hex shorthand (#FFF -> #FFFFFF)
        if hexStr.count == 3 {
            let c = Array(hexStr)
            hexStr = "\(c[0])\(c[0])\(c[1])\(c[1])\(c[2])\(c[2])"
        }

        // 8-char hex (with alpha)
        if hexStr.count == 8, let rgba = UInt64(hexStr, radix: 16) {
            let r = CGFloat((rgba >> 24) & 0xFF) / 255.0
            let g = CGFloat((rgba >> 16) & 0xFF) / 255.0
            let b = CGFloat((rgba >> 8) & 0xFF) / 255.0
            let a = CGFloat(rgba & 0xFF) / 255.0
            return CGColor(red: r, green: g, blue: b, alpha: a)
        }

        // 6-char hex
        guard hexStr.count == 6, let rgb = UInt64(hexStr, radix: 16) else {
            return NSColor.black.cgColor
        }
        let r = CGFloat((rgb >> 16) & 0xFF) / 255.0
        let g = CGFloat((rgb >> 8) & 0xFF) / 255.0
        let b = CGFloat(rgb & 0xFF) / 255.0
        return CGColor(red: r, green: g, blue: b, alpha: 1.0)
    }

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

    // MARK: - TextInput Overlay

    func showTextInput(
        inputId: String, x: Double, y: Double, width: Double, height: Double,
        value: String, placeholder: String, fontSize: Double,
        color: String, placeholderColor: String,
        keyboardType: String, returnKeyType: String,
        secureTextEntry: Bool, multiline: Bool, maxLength: Int
    ) {
        // Remove existing if present
        hideTextInput(inputId: inputId)

        let textField: NSTextField
        if secureTextEntry {
            textField = NSSecureTextField()
        } else {
            textField = NSTextField()
        }

        textField.frame = NSRect(x: x, y: y, width: width, height: height)
        textField.stringValue = value
        textField.placeholderString = placeholder
        textField.font = NSFont.systemFont(ofSize: CGFloat(fontSize))
        textField.textColor = NSColor(cgColor: parseColor(color))
        textField.isBordered = false
        textField.backgroundColor = .clear
        textField.focusRingType = .none
        textField.delegate = self

        if !placeholderColor.isEmpty {
            let phColor = NSColor(cgColor: parseColor(placeholderColor)) ?? NSColor.gray
            textField.placeholderAttributedString = NSAttributedString(
                string: placeholder,
                attributes: [
                    .foregroundColor: phColor,
                    .font: textField.font!,
                ]
            )
        }

        addSubview(textField)
        textInputFields[inputId] = textField

        window?.makeFirstResponder(textField)

        // Fire focus callback
        onTextFocus?(inputId)
    }

    func updateTextInput(inputId: String, x: Double, y: Double, width: Double, height: Double) {
        guard let field = textInputFields[inputId] else { return }
        if x >= 0 && y >= 0 && width >= 0 && height >= 0 {
            field.frame = NSRect(x: x, y: y, width: width, height: height)
        }
    }

    func hideTextInput(inputId: String) {
        if let field = textInputFields[inputId] {
            field.removeFromSuperview()
            textInputFields.removeValue(forKey: inputId)
        }
    }


    // MARK: - Mouse Handling

    override func mouseDown(with event: NSEvent) {
        let p = convert(event.locationInWindow, from: nil)
        onTouch?("pointerdown", p.x, p.y)
    }

    override func mouseDragged(with event: NSEvent) {
        let p = convert(event.locationInWindow, from: nil)
        onTouch?("pointermove", p.x, p.y)
    }

    override func mouseUp(with event: NSEvent) {
        let p = convert(event.locationInWindow, from: nil)
        onTouch?("pointerup", p.x, p.y)
    }
}

// MARK: - NSTextFieldDelegate

extension GlyphisRenderView: NSTextFieldDelegate {
    func controlTextDidChange(_ obj: Notification) {
        guard let field = obj.object as? NSTextField else { return }
        let inputId = textInputFields.first(where: { $0.value === field })?.key ?? ""
        onTextChange?(inputId, field.stringValue)
    }

    func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
        if commandSelector == #selector(NSResponder.insertNewline(_:)) {
            let inputId = textInputFields.first(where: { $0.value === control as? NSTextField })?.key ?? ""
            onTextSubmit?(inputId)
            return true
        }
        return false
    }
}
