import React, { useMemo, useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { usePathname, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Avatar } from "@/components/ui/Avatar"
import { Chip } from "@/components/ui/Card"
import { Button, IconButton } from "@/components/ui/Button"
import { ChevronDownIcon, CloseIcon, LogoIcon, SwapIcon } from "@/components/ui/Icons"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { useTabTransition } from "@/hooks/useTabTransition"
import { MOBILE_NAV, SIDEBAR_NAV, isNavActive, isTabActive } from "@/libs/navigation"

/**
 * Organization switcher: shows the active band and lets the user move between
 * the organizations they belong to (docs §7).
 */
export function OrgSwitcher({ compact = false }: { compact?: boolean }) {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const { organizations, organization, switchOrganization } = useOrganization()
  const [open, setOpen] = useState(false)

  const name = organization?.name || t("organizations.noBand")

  return (
    <View style={compact ? undefined : styles.host}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("organizations.switcherLabel", { name })}
        style={({ pressed }) => [styles.trigger, compact && styles.triggerCompact, pressed && styles.pressed]}
      >
        <Avatar name={name} photoURL={organization?.logoURL} size={compact ? 28 : 32} />
        {!compact ? (
          <View style={styles.triggerText}>
            <AppText variant="caption" tone="faint">
              {t("settings.organization")}
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {name}
            </AppText>
          </View>
        ) : null}
        <ChevronDownIcon size={16} color={Theme.colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={() => setOpen(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <AppText variant="heading">{t("organizations.bands")}</AppText>
            <IconButton
              label={t("common.close")}
              size={34}
              onPress={() => setOpen(false)}
              icon={<CloseIcon size={16} color={Theme.colors.textMuted} />}
            />
          </View>

          <ScrollView style={styles.sheetList}>
            {organizations.map((item) => {
              const active = item.id === organization?.id
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={async () => {
                    setOpen(false)
                    if (!active) await switchOrganization(item.id)
                    router.replace("/")
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <Avatar name={item.name} photoURL={item.logoURL} size={36} />
                  <View style={styles.rowText}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {item.name}
                    </AppText>
                    <AppText variant="caption" tone="faint">
                      {item.role === "admin" ? t("organizations.admin") : t("auth.musician")}
                    </AppText>
                  </View>
                  {active ? (
                    <Chip label={t("common.active")} tone="primary" size="sm" />
                  ) : (
                    <SwapIcon size={16} color={Theme.colors.textFaint} />
                  )}
                </Pressable>
              )
            })}
          </ScrollView>

          <Button
            label={t("organizations.bands")}
            variant="secondary"
            onPress={() => {
              setOpen(false)
              router.push("/organizations")
            }}
          />
        </View>
      </Modal>
    </View>
  )
}

/** Web sidebar navigation with the band switcher and account footer. */
export function SidebarNav() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const { pendingSuggestions } = useOrgData()
  const { signOut, profile } = useAuth()

  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarTop}>
        <View style={styles.brand}>
          <LogoIcon size={22} color={Theme.colors.primary} />
          <AppText variant="title">Stage Book</AppText>
        </View>
        <OrgSwitcher />
      </View>

      <ScrollView style={styles.nav} contentContainerStyle={styles.navContent}>
        {SIDEBAR_NAV.map((item) => {
          const active = isNavActive(item.href, pathname)
          const badge = item.badge === "suggestions" ? pendingSuggestions.length : 0
          const Icon = item.icon
          return (
            <Pressable
              key={item.href}
              accessibilityRole="link"
              accessibilityLabel={t(item.label)}
              accessibilityState={{ selected: active }}
              onPress={() => router.push(item.href as never)}
              style={({ pressed }) => [
                styles.navItem,
                active && styles.navItemActive,
                pressed && styles.pressed,
              ]}
            >
              <Icon size={18} color={active ? Theme.colors.primary : Theme.colors.textMuted} />
              <AppText variant="body" tone={active ? "primary" : "muted"} style={styles.navLabel}>
                {t(item.label)}
              </AppText>
              {badge > 0 ? (
                <View style={styles.badge}>
                  <AppText variant="caption" tone="inverse">
                    {badge}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={styles.sidebarFooter}>
        <Pressable
          onPress={() => router.push("/settings/profile")}
          accessibilityRole="button"
          accessibilityLabel={t("settings.profile")}
          style={({ pressed }) => [styles.userRow, pressed && styles.pressed]}
        >
          <Avatar name={profile?.displayName || "?"} photoURL={profile?.photoURL} size={34} />
          <View style={styles.rowText}>
            <AppText variant="caption" numberOfLines={1}>
              {profile?.displayName || t("auth.musician")}
            </AppText>
            <AppText variant="caption" tone="faint" numberOfLines={1}>
              {profile?.email}
            </AppText>
          </View>
        </Pressable>
        <Button label={t("settings.signOut")} variant="ghost" size="sm" onPress={() => void signOut()} />
      </View>
    </View>
  )
}

/** Mobile bottom tab bar (docs §18). */
export function BottomBar() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const { pendingSuggestions } = useOrgData()
  const { goToTab } = useTabTransition()

  const items = useMemo(() => MOBILE_NAV, [])

  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map((item) => {
        const active = isTabActive(item.href, pathname)
        const badge = item.badge === "suggestions" ? pendingSuggestions.length : 0
        const Icon = item.icon
        return (
          <Pressable
            key={item.href}
            accessibilityRole="link"
            accessibilityLabel={t(item.label)}
            accessibilityState={{ selected: active }}
            onPress={() => goToTab(item.href)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={[styles.tabIcon, active && styles.tabIconActive]}>
              <Icon size={21} color={active ? Theme.colors.primary : Theme.colors.textMuted} />
              {badge > 0 ? (
                <View style={styles.tabBadge}>
                  <AppText variant="caption" tone="inverse" style={styles.tabBadgeText}>
                    {badge}
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="caption" tone={active ? "primary" : "faint"}>
              {t(item.label)}
            </AppText>
          </Pressable>
        )
      })}
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    sidebar: {
      width: 268,
      height: "100%",
      backgroundColor: Theme.colors.chrome,
      borderRightWidth: 1,
      borderRightColor: Theme.colors.border,
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: Theme.spacing.l,
      gap: Theme.spacing.l,
    },
    sidebarTop: { gap: Theme.spacing.m },
    brand: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      paddingHorizontal: Theme.spacing.s,
    },
    nav: { flex: 1 },
    navContent: { gap: 2, paddingBottom: Theme.spacing.l },
    navItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: Theme.spacing.m,
      borderRadius: Theme.radii.m,
    },
    navItemActive: { backgroundColor: Theme.colors.primarySoft },
    navLabel: { flex: 1 },
    badge: {
      minWidth: 22,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: Theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sidebarFooter: {
      gap: Theme.spacing.s,
      borderTopWidth: 1,
      borderTopColor: Theme.colors.border,
      paddingTop: Theme.spacing.m,
    },
    userRow: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.s },
    rowText: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
    host: { paddingHorizontal: Theme.spacing.s },
    trigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      padding: Theme.spacing.s,
      borderRadius: Theme.radii.m,
      backgroundColor: Theme.colors.surface,
      borderWidth: 1,
      borderColor: Theme.colors.border,
    },
    triggerCompact: { padding: 4, backgroundColor: "transparent", borderColor: "transparent" },
    triggerText: { flex: 1, minWidth: 0 },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: Theme.colors.backdrop,
    },
    sheet: {
      position: "absolute",
      left: Theme.spacing.l,
      right: Theme.spacing.l,
      top: 76,
      maxWidth: 460,
      backgroundColor: Theme.colors.modal,
      borderRadius: Theme.radii.xl,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      padding: Theme.spacing.l,
      gap: Theme.spacing.m,
      ...Theme.shadows.lg,
    },
    sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sheetList: { maxHeight: 320 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.m,
      paddingHorizontal: Theme.spacing.s,
      borderRadius: Theme.radii.m,
    },
    bottomBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      paddingTop: Theme.spacing.s,
      backgroundColor: Theme.colors.chrome,
      borderTopWidth: 1,
      borderTopColor: Theme.colors.border,
    },
    tab: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
    // A fixed size (instead of padding) keeps the active pill perfectly round
    // on native as well as on web.
    tabIcon: {
      width: 54,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: Theme.radii.pill,
    },
    tabIconActive: { backgroundColor: Theme.colors.primarySoft },
    tabBadge: {
      position: "absolute",
      top: -4,
      right: -8,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: Theme.colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    tabBadgeText: { fontSize: 9 },
  })
