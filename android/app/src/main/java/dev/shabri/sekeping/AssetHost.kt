package dev.shabri.sekeping

import android.content.Context
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader

/**
 * WebViewAssetLoader guesses a few MIME types poorly on older Android builds.
 * ORT loads its WASM loader as an ES module (.mjs), and wasm streaming needs
 * application/wasm, so set those explicitly for the bundled OCR runtime.
 */
object AssetHost {

    fun loader(context: Context): WebViewAssetLoader =
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", MimeAwareAssets(context))
            .build()

    private class MimeAwareAssets(context: Context) : WebViewAssetLoader.PathHandler {
        private val assets = WebViewAssetLoader.AssetsPathHandler(context)

        override fun handle(path: String): WebResourceResponse? {
            val response = assets.handle(path) ?: return null
            when {
                path.endsWith(".mjs") -> response.mimeType = "application/javascript"
                path.endsWith(".wasm") -> response.mimeType = "application/wasm"
                path.endsWith(".onnx") -> response.mimeType = "application/octet-stream"
            }
            return response
        }
    }
}
