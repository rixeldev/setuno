import { Theme } from "@/constants/Theme"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useThemedStyles } from "@/hooks/useThemedStyles"

export const Loading = ({ full = true }: { full?: boolean }) => {
  const styles = useThemedStyles(createStyles)
  return (
    <View style={[styles.container, !full && styles.inline]}>
      <ActivityIndicator
        size="large"
        color={Theme.colors.primarySoft}
        style={{ width: 38, height: 38, alignSelf: "center" }}
      />
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    container: {
      position: "absolute",
      width: "100%",
      height: "100%",
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 999999,
    },
    inline: {
      flex: 0,
      padding: Theme.spacing.xl,
    },
  })
