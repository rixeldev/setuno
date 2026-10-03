import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native"

interface Props {
  children: React.ReactNode
  padding?: number
}

export function Screen({ children, padding }: Props) {
  const styles = useThemedStyles(createStyles)
  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={styles.flex}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <View style={[styles.content, { padding: padding ?? Theme.spacing.l }]}>
        {children}
      </View>
    </KeyboardAvoidingView>
  )
}

const createStyles = () =>
  StyleSheet.create({
    flex: {
      flex: 1,
      width: "100%",
    },
    content: {
      flex: 1,
      width: "100%",
      backgroundColor: Theme.colors.transparent,
    },
  })
