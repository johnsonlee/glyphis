import UIKit

// MARK: - Accessibility Element

class GlyphisAccessibilityElement: UIAccessibilityElement {
    let nodeId: Int
    var onActivate: (() -> Void)?

    init(accessibilityContainer container: Any, nodeId: Int) {
        self.nodeId = nodeId
        super.init(accessibilityContainer: container)
    }

    override func accessibilityActivate() -> Bool {
        onActivate?()
        return onActivate != nil
    }
}

/// Custom UIView that renders Glyphis framework render commands using Core Graphics.
/// Receives a JSON array of render command dictionaries from the JS runtime and
/// draws them in `draw(_:)` using CGContext.
class GlyphisRenderView: UIView {
    private var renderCommands: [[String: Any]] = []
    private var displayLink: CADisplayLink?
    private var needsRender = false

    /// Lookup function for decoded images by imageId. Set by GlyphisRuntime.
    var imageLookup: ((String) -> CGImage?)? = nil

    /// Called by GlyphisRuntime when a touch event occurs.
    /// Parameters: (eventType, x, y)
    var onTouch: ((String, CGFloat, CGFloat) -> Void)?

    /// Active native text input overlays keyed by inputId.
    private var textInputFields: [String: UITextField] = [:]

    /// Callback closures for text input events, set by GlyphisRuntime.
    var onTextChange: ((String, String) -> Void)?
    var onTextSubmit: ((String) -> Void)?
    var onTextFocus: ((String) -> Void)?

    // MARK: - Accessibility

    private var accessibilityNodes: [UIAccessibilityElement] = []
    var onAccessibilityAction: ((Int, String) -> Void)?

    override var isAccessibilityElement: Bool {
        get { return false }
        set {}
    }

    override var accessibilityElements: [Any]? {
        get { return accessibilityNodes }
        set {}
    }

    func updateAccessibilityTree(_ nodes: [[String: Any]]) {
        var elements: [UIAccessibilityElement] = []

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

            let element = GlyphisAccessibilityElement(accessibilityContainer: self, nodeId: id)
            element.accessibilityLabel = label
            element.accessibilityHint = hint
            element.accessibilityTraits = mapTraits(role: role)

            // Convert to screen coordinates
            let rect = CGRect(x: x, y: y, width: w, height: h)
            element.accessibilityFrame = UIAccessibility.convertToScreenCoordinates(rect, in: self)

            if actions.contains("activate") {
                element.onActivate = { [weak self] in
                    self?.onAccessibilityAction?(id, "activate")
                }
            }

            elements.append(element)
        }

        accessibilityNodes = elements
        UIAccessibility.post(notification: .layoutChanged, argument: nil)
    }

    private func mapTraits(role: String) -> UIAccessibilityTraits {
        switch role {
        case "button": return .button
        case "link": return .link
        case "image": return .image
        case "header": return .header
        case "search": return .searchField
        case "switch": return [.button]
        case "text": return .staticText
        default: return .none
        }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .white
        isMultipleTouchEnabled = false

        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkFired))
        displayLink?.add(to: .main, forMode: .common)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    deinit {
        displayLink?.invalidate()
    }

    func setRenderCommands(_ commands: [[String: Any]]) {
        self.renderCommands = commands
        needsRender = true
    }

    @objc private func displayLinkFired() {
        if needsRender {
            needsRender = false
            setNeedsDisplay()
        }
    }

    // MARK: - Drawing

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        ctx.clear(bounds)

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
                        let path = UIBezierPath(roundedRect: clipRect, cornerRadius: radius)
                        ctx.addPath(path.cgPath)
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
            let path = UIBezierPath(roundedRect: rect, cornerRadius: radius)
            ctx.addPath(path.cgPath)
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

        let color = UIColor(cgColor: parseColor(colorStr))
        let weight = mapFontWeight(fontWeight)

        let fontFamily = cmd["fontFamily"] as? String
        let font: UIFont
        if let family = fontFamily, let customFont = UIFont(name: family, size: fontSize) {
            font = customFont
        } else {
            font = UIFont.systemFont(ofSize: fontSize, weight: weight)
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
            let path = UIBezierPath(roundedRect: CGRect(x: x, y: y, width: w, height: h),
                                    cornerRadius: radius)
            ctx.addPath(path.cgPath)
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

        // Use UIImage to draw, which handles coordinate flipping automatically
        UIImage(cgImage: cgImage).draw(in: destRect)

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
            return UIColor.black.cgColor
        }
        let r = CGFloat((rgb >> 16) & 0xFF) / 255.0
        let g = CGFloat((rgb >> 8) & 0xFF) / 255.0
        let b = CGFloat(rgb & 0xFF) / 255.0
        return CGColor(red: r, green: g, blue: b, alpha: 1.0)
    }

    private func mapFontWeight(_ weight: String) -> UIFont.Weight {
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

        let textField = UITextField(frame: CGRect(x: x, y: y, width: width, height: height))
        textField.text = value
        textField.placeholder = placeholder
        textField.font = UIFont.systemFont(ofSize: CGFloat(fontSize))
        textField.textColor = UIColor(cgColor: parseColor(color))
        textField.isSecureTextEntry = secureTextEntry
        textField.borderStyle = .none
        textField.backgroundColor = .clear
        textField.delegate = self

        // Placeholder color
        if !placeholderColor.isEmpty {
            let phColor = UIColor(cgColor: parseColor(placeholderColor))
            textField.attributedPlaceholder = NSAttributedString(
                string: placeholder,
                attributes: [
                    .foregroundColor: phColor,
                    .font: textField.font!,
                ]
            )
        }

        // Keyboard type mapping
        switch keyboardType {
        case "number-pad": textField.keyboardType = .numberPad
        case "decimal-pad": textField.keyboardType = .decimalPad
        case "email-address": textField.keyboardType = .emailAddress
        case "phone-pad": textField.keyboardType = .phonePad
        case "url": textField.keyboardType = .URL
        default: textField.keyboardType = .default
        }

        // Return key type mapping
        switch returnKeyType {
        case "done": textField.returnKeyType = .done
        case "go": textField.returnKeyType = .go
        case "next": textField.returnKeyType = .next
        case "search": textField.returnKeyType = .search
        case "send": textField.returnKeyType = .send
        default: textField.returnKeyType = .default
        }

        // Text change listener via target-action
        textField.addTarget(self, action: #selector(textFieldDidChangeValue(_:)), for: .editingChanged)

        addSubview(textField)
        textInputFields[inputId] = textField

        textField.becomeFirstResponder()

        // Fire focus callback
        onTextFocus?(inputId)
    }

    func updateTextInput(inputId: String, x: Double, y: Double, width: Double, height: Double) {
        guard let field = textInputFields[inputId] else { return }
        if x >= 0 && y >= 0 && width >= 0 && height >= 0 {
            field.frame = CGRect(x: x, y: y, width: width, height: height)
        }
    }

    func hideTextInput(inputId: String) {
        if let field = textInputFields[inputId] {
            field.resignFirstResponder()
            field.removeFromSuperview()
            textInputFields.removeValue(forKey: inputId)
        }
    }

    @objc private func textFieldDidChangeValue(_ textField: UITextField) {
        let inputId = textInputFields.first(where: { $0.value === textField })?.key ?? ""
        let text = textField.text ?? ""
        onTextChange?(inputId, text)
    }

    // MARK: - Touch Handling

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let p = touch.location(in: self)
        onTouch?("pointerdown", p.x, p.y)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let p = touch.location(in: self)
        onTouch?("pointermove", p.x, p.y)
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let p = touch.location(in: self)
        onTouch?("pointerup", p.x, p.y)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let p = touch.location(in: self)
        onTouch?("pointerup", p.x, p.y)
    }
}

// MARK: - UITextFieldDelegate

extension GlyphisRenderView: UITextFieldDelegate {
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        let inputId = textInputFields.first(where: { $0.value === textField })?.key ?? ""
        onTextSubmit?(inputId)
        return true
    }

    func textField(_ textField: UITextField, shouldChangeCharactersIn range: NSRange, replacementString string: String) -> Bool {
        // Enforce maxLength if configured
        let inputId = textInputFields.first(where: { $0.value === textField })?.key ?? ""
        // maxLength enforcement would require storing config per input;
        // for now, allow all changes and let JS handle maxLength validation
        return true
    }
}
