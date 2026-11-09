package dev.shabri.sekeping

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.MediaStore
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import java.io.File

/**
 * A WebView <input type="file"> needs a WebChromeClient. Without
 * onShowFileChooser the scan button does nothing in the APK.
 *
 * The chooser always offers two entries:
 *  - the normal document/gallery picker from the input's accept types;
 *  - a camera intent that writes into the app cache through FileProvider.
 *
 * Both the main activity and the two dialog activities register this while
 * they are being created, before the activity reaches STARTED.
 */
class FileChooserHost(private val activity: AppCompatActivity) {

    private var callback: ValueCallback<Array<Uri>>? = null
    private var cameraUri: Uri? = null
    private var cameraFile: File? = null

    private val launcher: ActivityResultLauncher<Intent> =
        activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val pending = callback
            callback = null
            if (pending == null) {
                clearCamera(keep = false)
                return@registerForActivityResult
            }

            val files = if (result.resultCode == Activity.RESULT_OK) collect(result.data) else emptyList()
            pending.onReceiveValue(files.takeIf { it.isNotEmpty() }?.toTypedArray())
            clearCamera(keep = files.isNotEmpty() && files.firstOrNull() == cameraUri)
        }

    val client: WebChromeClient = object : WebChromeClient() {
        override fun onShowFileChooser(
            webView: WebView?,
            filePathCallback: ValueCallback<Array<Uri>>?,
            fileChooserParams: FileChooserParams?,
        ): Boolean {
            callback?.onReceiveValue(null)
            callback = filePathCallback
            return open(fileChooserParams)
        }
    }

    private fun open(params: WebChromeClient.FileChooserParams?): Boolean {
        return try {
            val gallery = params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "image/*"
            }
            if (gallery.type.isNullOrBlank()) gallery.type = "image/*"
            gallery.addCategory(Intent.CATEGORY_OPENABLE)

            val folder = File(activity.cacheDir, "receipts").apply { mkdirs() }
            val cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000
            folder.listFiles()?.forEach { old -> if (old.lastModified() < cutoff) old.delete() }
            val file = File.createTempFile("receipt-", ".jpg", folder)
            val uri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                file,
            )
            val camera = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            }
            cameraUri = uri
            cameraFile = file

            val chooser = Intent.createChooser(
                gallery,
                activity.getString(R.string.scan_choose_photo),
            ).apply {
                putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(camera))
            }
            launcher.launch(chooser)
            true
        } catch (_: Throwable) {
            callback?.onReceiveValue(null)
            callback = null
            clearCamera(keep = false)
            false
        }
    }

    private fun collect(data: Intent?): List<Uri> {
        val clipped = data?.clipData
        if (clipped != null && clipped.itemCount > 0) {
            return (0 until clipped.itemCount).mapNotNull { clipped.getItemAt(it).uri }
        }
        data?.data?.let { return listOf(it) }

        // Camera apps often return RESULT_OK with no data when EXTRA_OUTPUT is set.
        val captured = cameraFile
        val uri = cameraUri
        return if (captured != null && uri != null && captured.length() > 0) listOf(uri) else emptyList()
    }

    private fun clearCamera(keep: Boolean) {
        if (!keep) cameraFile?.delete()
        cameraFile = null
        cameraUri = null
    }
}
