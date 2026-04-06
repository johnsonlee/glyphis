package io.johnsonlee.glyphis.shell

import android.content.Context
import android.graphics.Color
import android.text.Editable
import android.text.InputFilter
import android.text.InputType
import android.text.TextWatcher
import android.text.method.PasswordTransformationMethod
import android.view.Gravity
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout

/**
 * Manages native EditText overlays for TextInput components.
 * Positions transparent EditText fields over the GlyphisRenderView
 * to capture keyboard input. Visual styling is handled by the Canvas.
 */
class TextInputManager(
    private val context: Context,
    private val container: FrameLayout,
    private val density: Float,
    private val onTextChange: (inputId: String, text: String) -> Unit,
    private val onTextSubmit: (inputId: String) -> Unit,
    private val onTextFocus: (inputId: String) -> Unit,
) {
    private val fields = mutableMapOf<String, EditText>()

    fun show(
        inputId: String,
        x: Double, y: Double, w: Double, h: Double,
        value: String, placeholder: String, fontSize: Double,
        colorStr: String, phColorStr: String,
        keyboardType: String, returnKeyType: String,
        secureTextEntry: Boolean, multiline: Boolean, maxLength: Int,
    ) {
        if (inputId.isEmpty()) return

        // Remove existing if present
        remove(inputId)

        val editText = EditText(context)

        // Match font from JS config
        editText.textSize = fontSize.toFloat()

        // Match text/placeholder colors from JS config
        try { editText.setTextColor(parseColor(colorStr)) }
        catch (_: Exception) { editText.setTextColor(Color.BLACK) }

        try { editText.setHintTextColor(parseColor(phColorStr)) }
        catch (_: Exception) { editText.setHintTextColor(Color.GRAY) }

        editText.hint = placeholder

        // Secure text entry
        if (secureTextEntry) {
            editText.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            editText.transformationMethod = PasswordTransformationMethod.getInstance()
        } else if (multiline) {
            editText.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
        } else {
            // Keyboard type mapping
            editText.inputType = when (keyboardType) {
                "number-pad" -> InputType.TYPE_CLASS_NUMBER
                "decimal-pad" -> InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
                "email-address" -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                "phone-pad" -> InputType.TYPE_CLASS_PHONE
                "url" -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
                else -> InputType.TYPE_CLASS_TEXT
            }
        }

        // Set text AFTER inputType/transformationMethod to ensure password masking works
        editText.setText(value)

        // Return key type mapping
        editText.imeOptions = when (returnKeyType) {
            "done" -> EditorInfo.IME_ACTION_DONE
            "go" -> EditorInfo.IME_ACTION_GO
            "next" -> EditorInfo.IME_ACTION_NEXT
            "search" -> EditorInfo.IME_ACTION_SEARCH
            "send" -> EditorInfo.IME_ACTION_SEND
            else -> EditorInfo.IME_ACTION_DONE
        }

        // Max length
        if (maxLength > 0) {
            editText.filters = arrayOf(InputFilter.LengthFilter(maxLength))
        }

        // Styling: no background, no padding
        editText.background = null
        editText.setPadding(0, 0, 0, 0)
        editText.gravity = Gravity.CENTER_VERTICAL

        // Set single line unless multiline
        if (!multiline) {
            editText.setSingleLine(true)
        }

        // Position via FrameLayout.LayoutParams (coordinates in dp, multiply by density for px)
        val lp = FrameLayout.LayoutParams(
            (w * density).toInt(),
            (h * density).toInt()
        )
        lp.leftMargin = (x * density).toInt()
        lp.topMargin = (y * density).toInt()

        container.addView(editText, lp)
        fields[inputId] = editText

        editText.requestFocus()

        // Show keyboard
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.showSoftInput(editText, 0)

        // Text change listener
        editText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val text = s?.toString() ?: ""
                onTextChange(inputId, text)
            }
        })

        // Submit (IME action) listener
        editText.setOnEditorActionListener { _, _, _ ->
            onTextSubmit(inputId)
            true
        }

        // Fire focus callback
        onTextFocus(inputId)
    }

    fun update(inputId: String, x: Double, y: Double, w: Double, h: Double) {
        if (inputId.isEmpty()) return

        val editText = fields[inputId] ?: return

        if (x >= 0 && y >= 0 && w >= 0 && h >= 0) {
            val lp = FrameLayout.LayoutParams(
                (w * density).toInt(),
                (h * density).toInt()
            )
            lp.leftMargin = (x * density).toInt()
            lp.topMargin = (y * density).toInt()
            editText.layoutParams = lp
        }
    }

    fun hide(inputId: String) {
        remove(inputId)
    }

    fun destroy() {
        for ((_, editText) in fields) {
            val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.hideSoftInputFromWindow(editText.windowToken, 0)
            container.removeView(editText)
        }
        fields.clear()
    }

    /** Must be called on the main thread. Removes an active text input overlay. */
    private fun remove(inputId: String) {
        val editText = fields[inputId] ?: return
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(editText.windowToken, 0)
        container.removeView(editText)
        fields.remove(inputId)
    }

    /** Parse a color string for EditText (delegated to shared ColorParser). */
    private fun parseColor(hex: String): Int = ColorParser.parse(hex)
}
