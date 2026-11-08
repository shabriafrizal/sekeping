package dev.shabri.sekeping

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews

/**
 * One resizable home-screen widget. It shows the selected provider (account) with
 * its balance, the total of every active account, an eye toggle that masks both
 * amounts, and three labelled quick actions.
 */
class WidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { update(context, manager, it) }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
        newOptions: Bundle,
    ) {
        update(context, manager, widgetId)
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

        fun update(context: Context, manager: AppWidgetManager, widgetId: Int) {
            try {
                render(context, manager, widgetId)
            } catch (_: Throwable) {
                /* Never leave "Problem loading widget" on the launcher. */
                val fallback = RemoteViews(context.packageName, R.layout.widget_sekeping_fallback)
                fallback.setOnClickPendingIntent(R.id.widget_root, openApp(context, widgetId))
                manager.updateAppWidget(widgetId, fallback)
            }
        }

        private fun render(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val config = WidgetPrefs.config(context, widgetId)
            val summary = WidgetPrefs.summary(context)
            val hidden = WidgetPrefs.hidden(context)
            val language = summary.language
            val provider = summary.accounts.firstOrNull { it.id == config.accountId }
                ?: summary.accounts.firstOrNull()

            val layout = layoutFor(manager, widgetId)
            val views = RemoteViews(context.packageName, layout)

            views.setTextViewText(R.id.widget_provider, provider?.name ?: t(language, "Belum ada rekening", "No account yet"))
            views.setImageViewResource(R.id.widget_provider_icon, providerIcon(provider?.icon))
            views.setTextViewText(R.id.widget_provider_balance, mask(provider?.balance ?: "—", hidden))
            views.setTextViewText(
                R.id.widget_total,
                "${t(language, "Total", "Total")}  ${mask(summary.total, hidden)}",
            )

            views.setImageViewResource(
                R.id.widget_eye,
                if (hidden) R.drawable.ic_eye_off else R.drawable.ic_eye,
            )
            views.setOnClickPendingIntent(R.id.widget_eye, toggleHidden(context, widgetId))

            val labels = mapOf(
                R.id.widget_expense_label to t(language, "Pengeluaran", "Expense"),
                R.id.widget_income_label to t(language, "Pendapatan", "Income"),
                R.id.widget_transfer_label to t(language, "Transfer", "Transfer"),
            )
            labels.forEach { (id, text) -> views.setTextViewText(id, text) }

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
            val ids = manager.getAppWidgetIds(ComponentName(context, WidgetProvider::class.java))
            ids.forEach { update(context, manager, it) }
        }

        private fun t(language: String, indonesian: String, english: String): String =
            if (language.startsWith("en")) english else indonesian

        /** "Rp 43.425.500" -> "Rp ***" when the eye is closed. */
        private fun mask(value: String, hidden: Boolean): String =
            if (!hidden) value else value.replace(Regex("[0-9][0-9.,]*"), "***")

        private fun providerIcon(key: String?): Int = when (key) {
            "bank" -> R.drawable.ic_provider_bank
            "phone" -> R.drawable.ic_provider_phone
            "cash" -> R.drawable.ic_provider_cash
            "card" -> R.drawable.ic_provider_card
            "store" -> R.drawable.ic_provider_store
            else -> R.drawable.ic_wallet
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
