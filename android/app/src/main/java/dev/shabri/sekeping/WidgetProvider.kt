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
 * One resizable home-screen widget. It reflows between three layouts:
 * 4x1 (balance + icon row), 4x2 (balance, month flow, icon column) and
 * 2x2 (compact balance + icon row). Each icon button opens the quick-add
 * sheet over the home screen; tapping the card opens the full app.
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

    override fun onDeleted(context: Context, ids: IntArray) {
        ids.forEach { WidgetPrefs.remove(context, it) }
    }

    companion object {

        fun update(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val config = WidgetPrefs.config(context, widgetId)
            val summary = WidgetPrefs.summary(context)
            val layout = layoutFor(manager, widgetId)
            val views = RemoteViews(context.packageName, layout)

            val caption = context.getString(R.string.widget_caption)
            views.setTextViewText(R.id.widget_balance, summary.balance)
            views.setTextViewText(R.id.widget_caption, caption)

            if (layout == R.layout.widget_sekeping_medium || layout == R.layout.widget_sekeping_small) {
                views.setTextViewText(
                    R.id.widget_accounts,
                    if (summary.accounts > 0) {
                        context.getString(R.string.widget_accounts, summary.accounts)
                    } else {
                        context.getString(R.string.widget_accounts_none)
                    },
                )
            }

            if (layout == R.layout.widget_sekeping_medium) {
                views.setTextViewText(R.id.widget_month_in, summary.monthIn)
                views.setTextViewText(R.id.widget_month_out, summary.monthOut)
            }

            views.setViewVisibility(
                R.id.widget_expense,
                if (config.showExpense) View.VISIBLE else View.GONE,
            )
            views.setViewVisibility(
                R.id.widget_income,
                if (config.showIncome) View.VISIBLE else View.GONE,
            )
            views.setViewVisibility(
                R.id.widget_transfer,
                if (config.showTransfer) View.VISIBLE else View.GONE,
            )

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

        /** Pick the layout from the cells the widget currently occupies. */
        private fun layoutFor(manager: AppWidgetManager, widgetId: Int): Int {
            val options = manager.getAppWidgetOptions(widgetId)
            val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
            val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)
            return when {
                height in 1..99 -> R.layout.widget_sekeping_small
                width in 1..219 -> R.layout.widget_sekeping_square
                else -> R.layout.widget_sekeping_medium
            }
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
