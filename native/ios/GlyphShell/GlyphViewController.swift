import UIKit

class GlyphViewController: UIViewController {
    private var glyphView: GlyphRenderView!
    private var runtime: GlyphRuntime!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white

        glyphView = GlyphRenderView(frame: view.bounds)
        glyphView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(glyphView)

        runtime = GlyphRuntime(renderView: glyphView)
        runtime.loadBundle()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        runtime?.updateViewportSize(
            width: view.bounds.width,
            height: view.bounds.height
        )
    }

    override var prefersStatusBarHidden: Bool { false }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
