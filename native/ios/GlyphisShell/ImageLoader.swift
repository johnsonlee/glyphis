import Foundation
import ImageIO

/// Loads images from URLs, decodes them into CGImages, and notifies
/// the caller with the decoded image and its pixel dimensions.
class ImageLoader {
    private let onImageLoaded: (_ imageId: String, _ image: CGImage, _ width: CGFloat, _ height: CGFloat) -> Void

    /// Cache of decoded images keyed by imageId.
    var cache: [String: CGImage] = [:]

    init(onImageLoaded: @escaping (_ imageId: String, _ image: CGImage, _ width: CGFloat, _ height: CGFloat) -> Void) {
        self.onImageLoaded = onImageLoaded
    }

    func load(imageId: String, url: String) {
        guard let imageUrl = URL(string: url) else { return }
        URLSession.shared.dataTask(with: imageUrl) { [weak self] data, _, error in
            guard let self = self,
                  let data = data, error == nil,
                  let source = CGImageSourceCreateWithData(data as CFData, nil),
                  let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil)
            else {
                if let error = error {
                    NSLog("[ImageLoader] Failed to load image %@: %@", imageId, error.localizedDescription)
                }
                return
            }
            let width = CGFloat(cgImage.width)
            let height = CGFloat(cgImage.height)
            self.cache[imageId] = cgImage
            self.onImageLoaded(imageId, cgImage, width, height)
        }.resume()
    }
}
