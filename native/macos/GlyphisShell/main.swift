import AppKit

import Foundation
NSLog("[Glyphis] main.swift starting")
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
NSLog("[Glyphis] Calling app.run()")
app.run()
