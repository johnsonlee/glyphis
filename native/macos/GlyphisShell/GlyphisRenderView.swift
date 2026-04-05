import AppKit

/// Custom NSView that renders Glyphis framework render commands using Core Graphics.
/// Receives a JSON array of render command dictionaries from the JS runtime and
/// draws them in `draw(_:)` using CGContext.
class GlyphisRenderView: NSView {
    private var renderCommands: [[String: Any]] = []
    private var needsRender = false
    private var renderTimer: Timer?

    /// Called by GlyphisRuntime when a mouse event occurs.
    /// Parameters: (eventType, x, y)
    var onTouch: ((String, CGFloat, CGFloat) -> Void)?

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
