package io.johnsonlee.glyphis.shell

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import java.net.URL
import java.util.concurrent.Executors

/**
 * Loads images from URLs, decodes them into Bitmaps, and notifies
 * the caller with the decoded dimensions (in dp).
 *
 * Uses a fixed thread pool for concurrent loading with bounded parallelism.
 * Deduplicates requests — multiple loads for the same imageId are ignored
 * if a load is already in progress or the image is cached.
 */
class ImageLoader(
    private val density: Float,
    private val onImageLoaded: (imageId: String, bitmap: Bitmap, widthDp: Float, heightDp: Float) -> Unit,
) {
    val cache = mutableMapOf<String, Bitmap>()
    private val pending = mutableSetOf<String>()
    private val executor = Executors.newFixedThreadPool(4)

    fun load(imageId: String, url: String) {
        // Cache hit — deliver immediately
        val cached = cache[imageId]
        if (cached != null) {
            onImageLoaded(
                imageId, cached,
                cached.width.toFloat() / density,
                cached.height.toFloat() / density,
            )
            return
        }

        // Deduplicate — skip if already loading
        synchronized(pending) {
            if (!pending.add(imageId)) return
        }

        executor.execute {
            try {
                URL(url).openStream().use { stream ->
                    val bitmap = BitmapFactory.decodeStream(stream)
                    if (bitmap != null) {
                        cache[imageId] = bitmap
                        onImageLoaded(
                            imageId, bitmap,
                            bitmap.width.toFloat() / density,
                            bitmap.height.toFloat() / density,
                        )
                    } else {
                        Log.w(TAG, "Failed to decode image: $url")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load image: $url", e)
            } finally {
                synchronized(pending) {
                    pending.remove(imageId)
                }
            }
        }
    }

    fun destroy() {
        executor.shutdownNow()
        cache.clear()
        synchronized(pending) { pending.clear() }
    }

    companion object {
        private const val TAG = "ImageLoader"
    }
}
