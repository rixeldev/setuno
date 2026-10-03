import { SafeAreaProvider } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet"
import { Link, Stack } from "expo-router"
import { Theme } from "@/constants/Theme"
import { Image, Pressable, View } from "react-native"
import { CogIcon } from "@/components/ui/Icons"

export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <Stack
            screenOptions={{
              animationMatchesGesture: true,
              animation: "default",
              animationDuration: 100,
              contentStyle: { backgroundColor: Theme.colors.background },
              headerStyle: { backgroundColor: Theme.colors.background },
              headerShadowVisible: false,
              headerTintColor: Theme.colors.text,
              headerTitle: "Stage Book",
              headerTitleAlign: "center",
              headerTitleStyle: {
                fontSize: Theme.sizes.h0,
                fontFamily: Theme.fonts.onestBold,
                color: Theme.colors.text,
              },
              headerLeft: () => (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: Theme.colors.surface,
                    borderWidth: 1,
                    borderColor: Theme.colors.borderSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Image
                    source={require("@/assets/icons/ic_brand.png")}
                    style={{ width: 28, height: 28 }}
                  />
                </View>
              ),
              headerRight: () => (
                <Link asChild href="/settings">
                  <Pressable
                    style={({ pressed }) => [
                      {
                        position: "relative",
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: Theme.colors.surface,
                        borderWidth: 1,
                        borderColor: Theme.colors.borderSoft,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <CogIcon color={Theme.colors.primarySoft} size={22} />
                  </Pressable>
                </Link>
              ),
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: true }} />
          </Stack>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}
