import React, { forwardRef, useRef, useState } from "react"
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { CloseIcon, EyeIcon, EyeOffIcon } from "@/components/ui/Icons"

export interface InputProps extends Omit<TextInputProps, "style"> {
  label?: string
  hint?: string
  error?: string | null
  icon?: React.ReactNode
  right?: React.ReactNode
  containerStyle?: StyleProp<ViewStyle>
  inputStyle?: TextInputProps["style"]
  /** Renders a show/hide toggle and switches the keyboard to password-safe. */
  secure?: boolean
  required?: boolean
  /**
   * Present only when the field comes from react-hook-form's `register()`.
   * Neither React Native's nor React Native Web's change event exposes
   * `event.target.name`, which is how react-hook-form resolves the field — the
   * bridge inside `Input` uses this to hand the value back to the form state.
   */
  name?: string
}

/**
 * The exact shape react-hook-form's `register()` handlers consume: the field is
 * resolved from `event.target.name` and the value read from `event.target.value`.
 */
interface FieldChangeEvent {
  target: { name?: string; value: string }
  type?: string
}
type FieldChangeHandler = (event: FieldChangeEvent) => void

/**
 * Labelled text field with inline validation feedback (docs §26, §28).
 * Every field is accessible: label, hint and error are wired for screen
 * readers through `accessibilityLabel`/`accessibilityHint`.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    hint,
    error,
    icon,
    right,
    containerStyle,
    inputStyle,
    secure = false,
    required = false,
    multiline,
    onFocus,
    onBlur,
    name,
    onChange,
    onChangeText,
    ...rest
  },
  ref,
) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const initialValue = typeof rest.value === "string" ? rest.value : ""
  const [focused, setFocused] = useState(initialValue.length > 0)
  const [hidden, setHidden] = useState(secure)

  // react-hook-form's `register()` gives back `name` plus `onChange`/`onBlur`
  // handlers that look the field up via `event.target.name`. That never happens
  // for free: React Native's event only carries `target` inside `nativeEvent`
  // (and there it is a react tag, not a name), while React Native Web's
  // TextInput does not forward `name` to the DOM input. The result was that
  // `_formValues` stayed at `""` for every field, so submitting an entirely
  // filled form reported "… is required." on all of them. Registered fields are
  // therefore bridged through `onChangeText`, which both platforms deliver as a
  // plain string; unregistered fields keep the native passthrough.
  const lastValue = useRef(initialValue)
  const isRegistered = name !== undefined && onChange !== undefined
  const fieldChange = isRegistered ? (onChange as unknown as FieldChangeHandler) : undefined
  const fieldBlur = isRegistered ? (onBlur as unknown as FieldChangeHandler | undefined) : undefined

  const borderColor = error
    ? Theme.colors.danger
    : focused
      ? Theme.colors.primary
      : Theme.colors.border

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <AppText variant="caption" tone="muted">
            {label}
            {required ? " *" : ""}
          </AppText>
        </View>
      ) : null}

      <View
        style={[
          styles.field,
          multiline && styles.fieldMultilineBox,
          { borderColor },
        ]}
      >
        {icon ? <View style={styles.adornment}>{icon}</View> : null}
        <TextInput
          ref={ref}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          placeholderTextColor={Theme.colors.textFaint}
          selectionColor={Theme.colors.primary}
          cursorColor={Theme.colors.primary}
          multiline={multiline}
          secureTextEntry={secure ? hidden : false}
          keyboardType={secure && hidden ? "default" : rest.keyboardType}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onChange={fieldChange ? undefined : onChange}
          onChangeText={(text) => {
            lastValue.current = text
            onChangeText?.(text)
            fieldChange?.({ target: { name, value: text }, type: "change" })
          }}
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            if (fieldBlur) {
              fieldBlur({ target: { name, value: lastValue.current }, type: "blur" })
            } else {
              onBlur?.(event)
            }
          }}
          {...rest}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            hitSlop={Theme.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t("common.showPassword") : t("common.hidePassword")}
            style={styles.adornment}
          >
            {hidden ? (
              <EyeOffIcon color={Theme.colors.textFaint} size={18} />
            ) : (
              <EyeIcon color={Theme.colors.textFaint} size={18} />
            )}
          </Pressable>
        ) : right ? (
          <View style={styles.adornment}>{right}</View>
        ) : null}
      </View>

      {error ? (
        <View style={styles.footer}>
          <AppText variant="caption" tone="danger">
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <View style={styles.footer}>
          <AppText variant="caption" tone="faint">
            {hint}
          </AppText>
        </View>
      ) : null}
    </View>
  )
})

interface SearchInputProps extends Omit<InputProps, "right"> {
  onClear?: () => void
}

/** Search field with a clear affordance (songs, members, suggestions). */
export const SearchInput = forwardRef<TextInput, SearchInputProps>(function SearchInput(
  { value, onClear, ...rest },
  ref,
) {
  const { t } = useTranslation()
  return (
    <Input
      ref={ref}
      value={value}
      returnKeyType="search"
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="never"
      accessibilityLabel={rest.label ?? t("common.search")}
      {...rest}
      right={
        typeof value === "string" && value.length > 0 ? (
          <Pressable
            onPress={onClear}
            hitSlop={Theme.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t("common.clearSearch")}
          >
            <CloseIcon color={Theme.colors.textFaint} size={16} />
          </Pressable>
        ) : undefined
      }
    />
  )
})

export interface Option<T extends string> {
  value: T
  label: string
}

interface SelectFieldProps<T extends string> {
  label?: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  placeholder?: string
  error?: string | null
  hint?: string
  containerStyle?: StyleProp<ViewStyle>
}

/**
 * Cross-platform select. Uses a native picker on Android and a styled dropdown
 * list on Web/iOS so both platforms get a native feel.
 */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  error,
  hint,
  containerStyle,
}: SelectFieldProps<T>) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)
  const placeholderText = placeholder ?? t("common.select")

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholderText}
        accessibilityValue={{ text: selected?.label ?? placeholderText }}
        accessibilityHint={t("common.opensOptions")}
        onPress={() => setOpen((value) => !value)}
        style={[
          styles.field,
          { borderColor: error ? Theme.colors.danger : open ? Theme.colors.primary : Theme.colors.border },
        ]}
      >
        <AppText tone={selected ? "default" : "faint"} numberOfLines={1} style={styles.selectText}>
          {selected?.label ?? placeholderText}
        </AppText>
      </Pressable>

      {open ? (
        <>
          <Pressable
            style={styles.backdrop}
            accessibilityLabel={t("common.close")}
            accessibilityRole="button"
            onPress={() => setOpen(false)}
          />
          <View style={styles.dropdown}>
            {options.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: option.value === value }}
                onPress={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                style={({ pressed }) => [
                  styles.option,
                  option.value === value && styles.optionActive,
                  pressed && styles.optionPressed,
                ]}
              >
                <AppText
                  variant={option.value === value ? "bodyStrong" : "body"}
                  tone={option.value === value ? "primary" : "default"}
                >
                  {option.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {error ? (
        <AppText variant="caption" tone="danger" style={styles.footer}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="faint" style={styles.footer}>
          {hint}
        </AppText>
      ) : null}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    container: { width: "100%", gap: 6 },
    labelRow: { flexDirection: "row", justifyContent: "space-between" },
    field: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      minHeight: 46,
      paddingHorizontal: Theme.spacing.l,
      borderRadius: Theme.radii.m,
      borderWidth: 1,
      backgroundColor: Theme.colors.surface,
    },
    fieldMultilineBox: { alignItems: "flex-start", paddingVertical: Theme.spacing.m },
    input: {
      flex: 1,
      color: Theme.colors.text,
      fontSize: Theme.sizes.h4,
      fontFamily: Theme.fonts.onest,
      paddingVertical: Theme.spacing.m,
    },
    inputMultiline: {
      minHeight: 110,
      textAlignVertical: "top",
    },
    adornment: { justifyContent: "center" },
    footer: { paddingHorizontal: 2 },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 20,
    },
    dropdown: {
      position: "absolute",
      top: 58,
      left: 0,
      right: 0,
      zIndex: 30,
      maxHeight: 260,
      backgroundColor: Theme.colors.modal,
      borderRadius: Theme.radii.lg,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      paddingVertical: 6,
      ...Theme.shadows.lg,
    },
    option: {
      paddingHorizontal: Theme.spacing.l,
      paddingVertical: Theme.spacing.m,
    },
    optionActive: { backgroundColor: Theme.colors.primarySoft },
    optionPressed: { backgroundColor: Theme.colors.surfaceHigh },
    selectText: { flex: 1 },
  })