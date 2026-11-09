package dev.shabri.sekeping

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.text.SpannableString
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.RelativeSizeSpan
import android.view.View
import android.widget.RemoteViews
import androidx.core.content.ContextCompat

/**
 * One home-screen widget. It shows the selected provider (account) with its
 * balance, the total of every active account, an eye toggle that masks both
 * amounts, and three icon-only quick actions.
 *
 * [WidgetProvider] itself is the resizable 4×2 entry. The two subclasses below
 * are fixed-size entries so the launcher's widget picker can offer 4×1 and 2×2
 * directly, instead of making people add a widget and resize it afterwards.
 */
open class WidgetProvider : AppWidgetProvider() {

    /** Size-specific providers render one layout; the base provider follows the launcher size. */
    protected open val fixedLayout: Int? = null

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { update(context, manager, it, fixedLayout) }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
        newOptions: Bundle,
    ) {
        update(context, manager, widgetId, fixedLayout)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_TOGGLE_HIDDEN) {
            WidgetPrefs.setHidden(context, !WidgetPrefs.hidden(context))
            refreshAll(context)
        }
    }

    override fun onDeleted(context: Context, ids: IntArray) {
        ids.forEach { WidgetPrefs.remove(context, it) }
    }

    companion object {

        const val ACTION_TOGGLE_HIDDEN = "dev.shabri.sekeping.widget.TOGGLE_HIDDEN"

        /** Every entry shown by the launcher's widget picker. */
        private val PROVIDERS: List<Pair<Class<*>, Int?>> = listOf(
            WidgetProvider::class.java to null,
            WidgetProviderWide::class.java to R.layout.widget_sekeping_small,
            WidgetProviderSquare::class.java to R.layout.widget_sekeping_square,
        )

        fun update(
            context: Context,
            manager: AppWidgetManager,
            widgetId: Int,
            fixedLayout: Int? = null,
        ) {
            try {
                render(context, manager, widgetId, fixedLayout)
            } catch (_: Throwable) {
                /* Never leave "Problem loading widget" on the launcher. */
                val fallback = RemoteViews(context.packageName, R.layout.widget_sekeping_fallback)
                fallback.setOnClickPendingIntent(R.id.widget_root, openApp(context, widgetId))
                manager.updateAppWidget(widgetId, fallback)
            }
        }

        private fun render(
            context: Context,
            manager: AppWidgetManager,
            widgetId: Int,
            fixedLayout: Int?,
        ) {
            val config = WidgetPrefs.config(context, widgetId)
            val summary = WidgetPrefs.summary(context)
            val hidden = WidgetPrefs.hidden(context)
            val language = summary.language
            val provider = summary.accounts.firstOrNull { it.id == config.accountId }
                ?: summary.accounts.firstOrNull()

            val layout = fixedLayout ?: layoutFor(manager, widgetId)
            val views = RemoteViews(context.packageName, layout)

            views.setTextViewText(R.id.widget_provider, provider?.name ?: t(language, "Belum ada rekening", "No account yet"))
            views.setImageViewResource(R.id.widget_provider_icon, providerIcon(context, provider?.icon))
            views.setTextViewText(R.id.widget_provider_balance, mask(provider?.balance ?: "—", hidden))
            val total = heroAmount(mask(summary.total, hidden))
            views.setTextViewText(R.id.widget_balance_label, t(language, "Saldo", "Balance"))
            views.setTextViewText(R.id.widget_total_label, t(language, "Total", "Total"))
            views.setTextViewText(R.id.widget_total, total)

            views.setImageViewResource(
                R.id.widget_eye,
                if (hidden) R.drawable.ic_eye_off else R.drawable.ic_eye,
            )
            views.setOnClickPendingIntent(R.id.widget_eye, toggleHidden(context, widgetId))

            views.setViewVisibility(R.id.widget_expense, if (config.showExpense) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.widget_income, if (config.showIncome) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.widget_transfer, if (config.showTransfer) View.VISIBLE else View.GONE)

            views.setOnClickPendingIntent(
                R.id.widget_expense,
                quickAdd(context, widgetId, 1, MainActivity.TYPE_EXPENSE, config.accountId),
            )
            views.setOnClickPendingIntent(
                R.id.widget_income,
                quickAdd(context, widgetId, 2, MainActivity.TYPE_INCOME, config.accountId),
            )
            views.setOnClickPendingIntent(
                R.id.widget_transfer,
                quickAdd(context, widgetId, 3, MainActivity.TYPE_TRANSFER, config.accountId),
            )
            views.setOnClickPendingIntent(R.id.widget_root, openApp(context, widgetId))

            manager.updateAppWidget(widgetId, views)
        }

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            for ((provider, layout) in PROVIDERS) {
                val ids = manager.getAppWidgetIds(ComponentName(context, provider))
                ids.forEach { update(context, manager, it, layout) }
            }
        }

        /**
         * The size key shown in the web setup dialog. Fixed providers report
         * their own shape; the resizable base provider follows the cells it
         * currently occupies.
         */
        fun sizeKey(context: Context, widgetId: Int): String {
            val manager = AppWidgetManager.getInstance(context)
            val className = manager.getAppWidgetInfo(widgetId)?.provider?.className
            if (className == WidgetProviderWide::class.java.name) return "4x1"
            if (className == WidgetProviderSquare::class.java.name) return "2x2"
            val options = manager.getAppWidgetOptions(widgetId)
            val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
            val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)
            return when {
                height in 1..89 -> "4x1"
                width in 1..219 -> "2x2"
                else -> "4x2"
            }
        }

        private fun t(language: String, indonesian: String, english: String): String =
            if (language.startsWith("en")) english else indonesian

        /** "Rp 43.425.500" -> "Rp ***" when the eye is closed. */
        private fun mask(value: String, hidden: Boolean): String =
            if (!hidden) value else value.replace(Regex("[0-9][0-9.,]*"), "***")

        /** Sets the currency code smaller than the figure, the way the app's totals read. */
        private fun heroAmount(value: String): CharSequence {
            val start = value.indexOf("Rp")
            if (start < 0) return value
            return SpannableString(value).apply {
                setSpan(RelativeSizeSpan(0.6f), start, start + 2, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }

        /** "Total  Rp 43.425.500" with the word in the muted colour and smaller. */
        private fun labelled(context: Context, label: String, value: CharSequence): CharSequence {
            val text = SpannableStringBuilder(label).append("  ").append(value)
            text.setSpan(
                ForegroundColorSpan(ContextCompat.getColor(context, R.color.widget_muted)),
                0,
                label.length,
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
            )
            text.setSpan(RelativeSizeSpan(0.8f), 0, label.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            return text
        }

        private fun providerIcon(context: Context, key: String?): Int {
            val id = when (key) {
                "bank" -> R.drawable.ic_provider_bank
                "phone" -> R.drawable.ic_provider_phone
                "cash" -> R.drawable.ic_provider_cash
                "card" -> R.drawable.ic_provider_card
                "store" -> R.drawable.ic_provider_store
                else -> R.drawable.ic_wallet
            }
            /* A malformed drawable would make the launcher show "Problem
               loading widget"; fall back to the wallet before sending it. */
            return try {
                context.resources.getDrawable(id, context.theme)
                id
            } catch (_: Throwable) {
                R.drawable.ic_wallet
            }
        }

        /** Pick the layout from the cells the widget currently occupies. */
        private fun layoutFor(manager: AppWidgetManager, widgetId: Int): Int {
            val options = manager.getAppWidgetOptions(widgetId)
            val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
            val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)
            return when {
                height in 1..89 -> R.layout.widget_sekeping_small
                width in 1..219 -> R.layout.widget_sekeping_square
                else -> R.layout.widget_sekeping_medium
            }
        }

        private fun toggleHidden(context: Context, widgetId: Int): PendingIntent {
            val intent = Intent(context, WidgetProvider::class.java).apply {
                action = ACTION_TOGGLE_HIDDEN
            }
            return PendingIntent.getBroadcast(
                context,
                widgetId * 10 + 9,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        /** The sheet activity floats over the launcher, without the dashboard. */
        private fun quickAdd(
            context: Context,
            widgetId: Int,
            slot: Int,
            type: String,
            accountId: String,
        ): PendingIntent {
            val intent = Intent(context, WidgetSheetActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(MainActivity.EXTRA_TYPE, type)
                if (accountId.isNotBlank()) putExtra(MainActivity.EXTRA_ACCOUNT, accountId)
            }
            return PendingIntent.getActivity(
                context,
                widgetId * 10 + slot,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        private fun openApp(context: Context, widgetId: Int): PendingIntent {
            val intent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            return PendingIntent.getActivity(
                context,
                widgetId * 10,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
}

/** Fixed 4×1 entry in the launcher's widget picker. */
class WidgetProviderWide : WidgetProvider() {
    override val fixedLayout: Int = R.layout.widget_sekeping_small
}

/** Fixed 2×2 entry in the launcher's widget picker. */
class WidgetProviderSquare : WidgetProvider() {
    override val fixedLayout: Int = R.layout.widget_sekeping_square
}
