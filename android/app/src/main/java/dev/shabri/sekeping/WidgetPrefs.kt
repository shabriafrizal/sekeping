package dev.shabri.sekeping

import android.content.Context
import org.json.JSONObject

data class WidgetConfig(
    val accountId: String,
    val showExpense: Boolean,
    val showIncome: Boolean,
    val showTransfer: Boolean,
) {
    val hasAny: Boolean get() = showExpense || showIncome || showTransfer
}

data class WidgetAccount(
    val id: String,
    val name: String,
    val icon: String,
    val balance: String,
)

/** The numbers the web app pushes so the widget can render without the app open. */
data class WidgetSummary(
    val total: String,
    val monthIn: String,
    val monthOut: String,
    val currency: String,
    val language: String,
    val accounts: List<WidgetAccount>,
) {
    companion object {
        val EMPTY = WidgetSummary("Rp 0", "+Rp 0", "−Rp 0", "IDR", "id", emptyList())
    }
}

/**
 * Small shared-preferences store for the home screen widget: the account list pushed
 * from the web app, the summary numbers, the privacy toggle, plus the per-widget
 * choices made in the setup dialog.
 */
object WidgetPrefs {

    private const val FILE = "sekeping_widgets"
    private const val KEY_ACCOUNTS = "accounts_json"
    private const val KEY_SUMMARY = "summary_json"
    private const val KEY_IDS = "widget_ids"
    private const val KEY_HIDDEN = "amounts_hidden"

    private fun prefs(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun setAccounts(context: Context, json: String) {
        prefs(context).edit().putString(KEY_ACCOUNTS, json).apply()
    }

    fun accounts(context: Context): List<Pair<String, String>> {
        val raw = prefs(context).getString(KEY_ACCOUNTS, null) ?: return emptyList()
        return try {
            val array = org.json.JSONArray(raw)
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

    fun setSummary(context: Context, json: String) {
        prefs(context).edit().putString(KEY_SUMMARY, json).apply()
    }

    fun summary(context: Context): WidgetSummary {
        val raw = prefs(context).getString(KEY_SUMMARY, null) ?: return WidgetSummary.EMPTY
        return try {
            val json = JSONObject(raw)
            val list = mutableListOf<WidgetAccount>()
            val array = json.optJSONArray("accounts")
            if (array != null) {
                for (i in 0 until array.length()) {
                    val item = array.optJSONObject(i) ?: continue
                    val id = item.optString("id")
                    if (id.isEmpty()) continue
                    list.add(
                        WidgetAccount(
                            id = id,
                            name = item.optString("name"),
                            icon = item.optString("icon", "wallet"),
                            balance = item.optString("balance", "Rp 0"),
                        ),
                    )
                }
            }
            WidgetSummary(
                total = json.optString("total", WidgetSummary.EMPTY.total),
                monthIn = json.optString("monthIn", WidgetSummary.EMPTY.monthIn),
                monthOut = json.optString("monthOut", WidgetSummary.EMPTY.monthOut),
                currency = json.optString("currency", WidgetSummary.EMPTY.currency),
                language = json.optString("language", WidgetSummary.EMPTY.language),
                accounts = list,
            )
        } catch (_: Exception) {
            WidgetSummary.EMPTY
        }
    }

    /** Masked balances are a device preference: the eye toggles every widget. */
    fun hidden(context: Context): Boolean = prefs(context).getBoolean(KEY_HIDDEN, false)

    fun setHidden(context: Context, hidden: Boolean) {
        prefs(context).edit().putBoolean(KEY_HIDDEN, hidden).apply()
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
