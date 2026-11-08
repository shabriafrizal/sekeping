package dev.shabri.sekeping

import android.content.Context
import org.json.JSONArray

data class WidgetConfig(
    val accountId: String,
    val showExpense: Boolean,
    val showIncome: Boolean,
    val showTransfer: Boolean,
) {
    val hasAny: Boolean get() = showExpense || showIncome || showTransfer
}

/**
 * Small shared-preferences store for the home screen widget: the account list pushed
 * from the web app, plus the per-widget choices made in the setup popup.
 */
object WidgetPrefs {

    private const val FILE = "sekeping_widgets"
    private const val KEY_ACCOUNTS = "accounts_json"
    private const val KEY_IDS = "widget_ids"

    private fun prefs(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun setAccounts(context: Context, json: String) {
        prefs(context).edit().putString(KEY_ACCOUNTS, json).apply()
    }

    fun accounts(context: Context): List<Pair<String, String>> {
        val raw = prefs(context).getString(KEY_ACCOUNTS, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            buildList {
                for (i in 0 until array.length()) {
                    val item = array.optJSONObject(i) ?: continue
                    val id = item.optString("id")
                    val name = item.optString("name")
                    if (id.isNotEmpty()) add(id to name)
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun save(context: Context, widgetId: Int, config: WidgetConfig) {
        val ids = ids(context).toMutableSet()
        ids.add(widgetId)
        prefs(context).edit()
            .putString("account_$widgetId", config.accountId)
            .putBoolean("expense_$widgetId", config.showExpense)
            .putBoolean("income_$widgetId", config.showIncome)
            .putBoolean("transfer_$widgetId", config.showTransfer)
            .putStringSet(KEY_IDS, ids.map(Int::toString).toSet())
            .apply()
    }

    fun config(context: Context, widgetId: Int): WidgetConfig {
        val p = prefs(context)
        return WidgetConfig(
            accountId = p.getString("account_$widgetId", "") ?: "",
            showExpense = p.getBoolean("expense_$widgetId", true),
            showIncome = p.getBoolean("income_$widgetId", true),
            showTransfer = p.getBoolean("transfer_$widgetId", true),
        )
    }

    fun remove(context: Context, widgetId: Int) {
        val ids = ids(context).toMutableSet()
        ids.remove(widgetId)
        prefs(context).edit()
            .remove("account_$widgetId")
            .remove("expense_$widgetId")
            .remove("income_$widgetId")
            .remove("transfer_$widgetId")
            .putStringSet(KEY_IDS, ids.map(Int::toString).toSet())
            .apply()
    }

    fun ids(context: Context): Set<Int> {
        val raw = prefs(context).getStringSet(KEY_IDS, emptySet()) ?: emptySet()
        return raw.mapNotNull { it.toIntOrNull() }.toSet()
    }
}
