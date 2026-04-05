import UIKit

class GlyphisViewController: UIViewController {
    private var glyphisView: GlyphisRenderView!
    private var runtime: GlyphisRuntime!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white

        glyphisView = GlyphisRenderView(frame: view.bounds)
        glyphisView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(glyphisView)

        runtime = GlyphisRuntime(renderView: glyphisView)
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
