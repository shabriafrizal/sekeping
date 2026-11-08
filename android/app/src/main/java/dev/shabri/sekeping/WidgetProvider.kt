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
 * 4x1 home screen widget with the three quick actions. Each button opens the app straight
 * into the matching entry sheet, pre-selecting the account chosen in the setup popup.
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
            val views = RemoteViews(context.packageName, R.layout.widget_sekeping)

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
                action(context, widgetId, 1, MainActivity.TYPE_EXPENSE, config.accountId),
            )
            views.setOnClickPendingIntent(
                R.id.widget_income,
                action(context, widgetId, 2, MainActivity.TYPE_INCOME, config.accountId),
            )
            views.setOnClickPendingIntent(
                R.id.widget_transfer,
                action(context, widgetId, 3, MainActivity.TYPE_TRANSFER, config.accountId),
            )
            views.setOnClickPendingIntent(
                R.id.widget_root,
                action(context, widgetId, 0, null, config.accountId),
            )

            manager.updateAppWidget(widgetId, views)
        }

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, WidgetProvider::class.java))
            ids.forEach { update(context, manager, it) }
        }

        private fun action(
            context: Context,
            widgetId: Int,
            slot: Int,
            type: String?,
            accountId: String,
        ): PendingIntent {
            val intent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                if (type != null) putExtra(MainActivity.EXTRA_TYPE, type)
                if (accountId.isNotBlank()) putExtra(MainActivity.EXTRA_ACCOUNT, accountId)
            }
            val requestCode = widgetId * 10 + slot
            return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
}
