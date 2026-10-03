import React, { useState, useRef, useEffect } from "react"
import {
  Animated,
  TextInput,
  StyleSheet,
  KeyboardTypeOptions,
  View,
} from "react-native"
import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"

interface FocusInputProps {
  placeholder: string
  type?: KeyboardTypeOptions
  onChange?: (text: string) => void
  capitalize?: "none" | "sentences" | "words" | "characters"
  value?: string
  editable?: boolean
  returnKeyType?: any
  onSubmitEditing?: () => void
}

export const FocusInput = ({
  type = "default",
  placeholder,
  onChange,
  capitalize,
  value,
  editable = true,
  onSubmitEditing,
  ...props
}: FocusInputProps) => {
  const styles = useThemedStyles(createStyles)
  const [isFocused, setIsFocused] = useState(false)
  const focusAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start()
  }, [isFocused, focusAnim])

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Theme.colors.borderSoft, Theme.colors.primarySoft],
  })

  const backgroundColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Theme.colors.surface, Theme.colors.surfaceHigh],
  })

  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  })

  return (
    <Animated.View
      style={[
        styles.inputContainer,
        {
          borderColor,
          backgroundColor,
          shadowColor: Theme.colors.primary,
          shadowOpacity,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        },
      ]}
    >
      <View style={styles.inner}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={Theme.colors.darkGray}
          keyboardType={type}
          cursorColor={Theme.colors.primarySoft}
          selectionColor={Theme.colors.primarySoft}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChangeText={onChange}
          autoCapitalize={capitalize}
          value={value}
          editable={editable}
          style={[styles.input, !editable && styles.disabled]}
          onSubmitEditing={onSubmitEditing}
          {...props}
        />
      </View>
    </Animated.View>
  )
}

const createStyles = () => StyleSheet.create({
  inputContainer: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
  },
  inner: {
    borderRadius: Theme.radii.lg,
    overflow: "hidden",
  },
  input: {
    paddingHorizontal: Theme.spacing.l,
    paddingVertical: Theme.spacing.m,
    color: Theme.colors.text,
    fontFamily: Theme.fonts.onest,
    fontSize: Theme.sizes.h4,
  },
  disabled: {
    color: Theme.colors.gray,
  },
})