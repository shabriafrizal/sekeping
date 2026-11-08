package dev.shabri.sekeping

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import org.json.JSONObject

/**
 * The "Atur widget" dialog. It hosts the web build in config mode, so the
 * account list, toggles and live 4x1 / 4x2 / 2x2 preview use the same Astryx
 * components and theme as the app itself.
 */
class WidgetConfigActivity : AppCompatActivity() {

    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private lateinit var webView: WebView
    private var openedApp = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)

        widgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID,
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        /* Accept the widget before the web surface loads. If the dialog cannot
           render, the launcher still gets a working widget with the defaults;
           opening it again lets the user change the account and actions. */
        setResult(
            RESULT_OK,
            Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId),
        )

        applyBars()
        webView = try {
            WebAppHost.create(this, Bridge(), transparent = true)
        } catch (_: Throwable) {
            finish()
            return
        }
        setContentView(webView)
        webView.loadUrl(WebAppHost.url("widget_config=$widgetId"))

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    finish()
                }
            },
        )
    }

    private fun applyBars() {
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
    }

    /**
     * The setup dialog can send the user into the app to onboard or add an
     * account. Reload on return so the picker sees the ledger they just made.
     */
    override fun onResume() {
        super.onResume()
        if (openedApp) {
            openedApp = false
            webView.reload()
        }
    }

    inner class Bridge {

        /** Current choices, read synchronously by the web dialog on mount. */
        @JavascriptInterface
        fun getWidgetConfig(): String {
            val config = WidgetPrefs.config(this@WidgetConfigActivity, widgetId)
            return JSONObject().apply {
                put("widgetId", widgetId)
                put("accountId", config.accountId)
                put("showExpense", config.showExpense)
                put("showIncome", config.showIncome)
                put("showTransfer", config.showTransfer)
            }.toString()
        }

        @JavascriptInterface
        fun saveWidgetConfig(json: String) {
            val payload = try {
                JSONObject(json)
            } catch (_: Exception) {
                return
            }

            WidgetPrefs.save(
                this@WidgetConfigActivity,
                widgetId,
                WidgetConfig(
                    accountId = payload.optString("accountId", ""),
                    showExpense = payload.optBoolean("showExpense", true),
                    showIncome = payload.optBoolean("showIncome", true),
                    showTransfer = payload.optBoolean("showTransfer", true),
                ),
            )

            runOnUiThread {
                WidgetProvider.update(
                    this@WidgetConfigActivity,
                    AppWidgetManager.getInstance(this@WidgetConfigActivity),
                    widgetId,
                )
                Toast.makeText(this@WidgetConfigActivity, R.string.widget_saved, Toast.LENGTH_SHORT).show()
                setResult(
                    RESULT_OK,
                    Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId),
                )
                finish()
            }
        }

        @JavascriptInterface
        fun closeSheet() {
            runOnUiThread { finish() }
        }

        @JavascriptInterface
        fun openApp() {
            runOnUiThread {
                openedApp = true
                startActivity(Intent(this@WidgetConfigActivity, MainActivity::class.java))
            }
        }

        @JavascriptInterface
        fun toast(message: String) {
            runOnUiThread {
                Toast.makeText(this@WidgetConfigActivity, message, Toast.LENGTH_SHORT).show()
            }
        }

        /* The shared bundle still calls these; the config surface ignores them. */
        @JavascriptInterface
        fun setAccounts(json: String) = Unit

        @JavascriptInterface
        fun setSummary(json: String) = Unit

        @JavascriptInterface
        fun ready() = Unit
    }
}
