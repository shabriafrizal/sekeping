package dev.shabri.sekeping

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * The setup popup shown when the widget is dropped on the home screen (and when the user
 * taps "reconfigure"). Picks the default account and which of the three buttons appear.
 */
class WidgetConfigActivity : AppCompatActivity() {

    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID

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

        setContentView(R.layout.activity_widget_config)

        val group = findViewById<RadioGroup>(R.id.account_group)
        val emptyHint = findViewById<TextView>(R.id.empty_hint)
        val openApp = findViewById<Button>(R.id.open_app)
        val checkExpense = findViewById<CheckBox>(R.id.check_expense)
        val checkIncome = findViewById<CheckBox>(R.id.check_income)
        val checkTransfer = findViewById<CheckBox>(R.id.check_transfer)

        val config = WidgetPrefs.config(this, widgetId)
        val accounts = WidgetPrefs.accounts(this)

        if (accounts.isEmpty()) {
            emptyHint.visibility = View.VISIBLE
            openApp.visibility = View.VISIBLE
            openApp.setOnClickListener { startActivity(Intent(this, MainActivity::class.java)) }
        } else {
            emptyHint.visibility = View.GONE
            accounts.forEach { (id, name) ->
                val radio = RadioButton(this).apply {
                    text = name
                    tag = id
                    isChecked = id == config.accountId
                    setPadding(0, 8, 0, 8)
                }
                group.addView(radio)
            }
            if (group.checkedRadioButtonId == -1) {
                group.check(group.getChildAt(0).id)
            }
        }

        checkExpense.isChecked = config.showExpense
        checkIncome.isChecked = config.showIncome
        checkTransfer.isChecked = config.showTransfer

        findViewById<Button>(R.id.cancel).setOnClickListener { finish() }

        findViewById<Button>(R.id.save).setOnClickListener {
            val checkedId = group.checkedRadioButtonId
            val accountId = if (checkedId != -1) {
                (group.findViewById<RadioButton>(checkedId)?.tag as? String).orEmpty()
            } else {
                ""
            }

            WidgetPrefs.save(
                this,
                widgetId,
                WidgetConfig(
                    accountId = accountId,
                    showExpense = checkExpense.isChecked,
                    showIncome = checkIncome.isChecked,
                    showTransfer = checkTransfer.isChecked,
                ),
            )

            WidgetProvider.update(this, AppWidgetManager.getInstance(this), widgetId)

            val result = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            setResult(RESULT_OK, result)
            finish()
        }
    }
}
