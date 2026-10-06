import React from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { Theme, colorWithOpacity } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useResponsive } from "@/hooks/useResponsive"
import { AppText } from "@/components/ui/AppText"
import { Avatar } from "@/components/ui/Avatar"
import { Badge, Card } from "@/components/ui/Card"
import { ChevronRightIcon, ShieldCheckIcon } from "@/components/ui/Icons"
import { AppBackground } from "@/components/app/AppBackground"
import { useOrganization } from "@/hooks/useOrganization"
import { useAuth } from "@/hooks/useAuth"
import { useOrgData } from "@/hooks/useOrgData"
import { MORE_NAV } from "@/libs/navigation"

/**
 * Mobile hub for everything that doesn't fit the bottom bar (docs §21). On
 * desktop the sidebar lists these items directly, so this route is only linked
 * from the bottom bar.
 */
export default function MoreScreen() {
  const styles = useThemedStyles(createStyles)
  const { t } = useTranslation()
  const router = useRouter()
  const { gutter, contentMaxWidth } = useResponsive()
  const { profile, user } = useAuth()
  const { organization, role, organizations } = useOrganization()
  const { songs, pendingSuggestions } = useOrgData()

  const displayName = profile?.displayName || user?.displayName || t("auth.musician")
  const photoURL = profile?.photoURL ?? user?.photoURL ?? null
  const isAdmin = role === "admin"

  const stats: { label: string; value: number }[] = [
    { label: t("nav.songs"), value: songs.length },
    { label: t("organizations.bands"), value: organizations.length },
    { label: t("dashboard.stats.pending"), value: pendingSuggestions.length },
  ]

  return (
    <View style={styles.host}>
      <AppBackground />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]}
        showsVerticalScrollIndicator={false}
      >
      <LinearGradient
        colors={[...Theme.gradients.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { marginHorizontal: -gutter, paddingHorizontal: gutter }]}
      >
        <View style={[styles.heroInner, { maxWidth: contentMaxWidth }]}>
          <View style={styles.heroTop}>
            <View style={styles.flex}>
              <AppText variant="label" style={styles.heroKicker}>
                Stage Book
              </AppText>
              <AppText variant="display" tone="inverse">
                {t("nav.more")}
              </AppText>
            </View>
            {organization ? (
              <View style={styles.heroPill}>
                <AppText variant="caption" tone="inverse" numberOfLines={1}>
                  {role === "admin" ? t("organizations.admin") : t("organizations.member")}
                </AppText>
              </View>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("settings.profile")}
            onPress={() => router.push("/settings/profile")}
            style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
          >
            <View style={styles.avatarRing}>
              <Avatar
                name={displayName}
                photoURL={photoURL}
                size={52}
                accessibilityLabel={`${displayName}${profile?.email ? `, ${profile.email}` : ""}`}
              />
            </View>
            <View style={styles.flex}>
              <AppText variant="subheading" tone="inverse" numberOfLines={1}>
                {displayName}
              </AppText>
              <AppText variant="caption" style={styles.heroSubtle} numberOfLines={2}>
                {organization?.name ?? t("organizations.noBand")}
              </AppText>
            </View>
            <ChevronRightIcon size={18} color={Theme.colors.onPrimary} />
          </Pressable>
        </View>
      </LinearGradient>

      <View style={[styles.body, { maxWidth: contentMaxWidth }]}>
        <Card elevated padded={false} style={styles.stats}>
          {stats.map((stat, index) => (
            <View key={stat.label} style={[styles.stat, index > 0 && styles.statDivider]}>
              <AppText variant="heading">{stat.value}</AppText>
              <AppText variant="caption" tone="muted">
                {stat.label}
              </AppText>
            </View>
          ))}
        </Card>

        <View style={styles.section}>
          <AppText variant="label" tone="faint" style={styles.sectionLabel}>
            {t("nav.shortcuts")}
          </AppText>

          <View style={styles.grid}>
            {MORE_NAV.map((item) => {
              const Icon = item.icon
              const hint =
                item.badge === "suggestions" && pendingSuggestions.length > 0
                  ? t("common.newCount", { count: pendingSuggestions.length })
                  : null
              // Settings reads better as a full-width row; the rest stay as tiles.
              const horizontal = item.href === "/settings"
              return (
                <Pressable
                  key={item.href}
                  accessibilityRole="button"
                  accessibilityLabel={hint ? `${t(item.label)}. ${hint}` : t(item.label)}
                  onPress={() => router.push(item.href as never)}
                  style={({ pressed }) => [
                    styles.tile,
                    horizontal && styles.tileRow,
                    pressed && styles.tilePressed,
                  ]}
                >
                  {horizontal ? (
                    <>
                      <View style={styles.tileIcon}>
                        <Icon size={20} color={Theme.colors.primary} />
                      </View>
                      <View style={styles.tileTextRow}>
                        <AppText variant="bodyStrong" numberOfLines={1}>
                          {t(item.label)}
                        </AppText>
                        {item.description ? (
                          <AppText variant="caption" tone="faint" numberOfLines={1}>
                            {t(item.description)}
                          </AppText>
                        ) : null}
                      </View>
                      <ChevronRightIcon size={18} color={Theme.colors.textFaint} />
                    </>
                  ) : (
                    <>
                      <View style={styles.tileHeader}>
                        <View style={styles.tileIcon}>
                          <Icon size={20} color={Theme.colors.primary} />
                        </View>
                        {hint ? <Badge label={hint} tone="accent" /> : null}
                      </View>
                      <View style={styles.tileText}>
                        <AppText variant="bodyStrong" numberOfLines={1}>
                          {t(item.label)}
                        </AppText>
                        {item.description ? (
                          <AppText variant="caption" tone="faint" numberOfLines={2}>
                            {t(item.description)}
                          </AppText>
                        ) : null}
                      </View>
                    </>
                  )}
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={styles.notice}>
          <ShieldCheckIcon size={16} color={isAdmin ? Theme.colors.primary : Theme.colors.textFaint} />
          <AppText variant="caption" tone="muted" style={styles.flex}>
            {isAdmin ? t("dashboard.adminNote") : t("dashboard.memberNote")}
          </AppText>
        </View>
      </View>
      </ScrollView>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1 },
    scroll: { paddingBottom: Theme.spacing.huge },
    hero: {
      paddingTop: Theme.spacing.xxl,
      paddingBottom: Theme.spacing.xxxl,
      borderBottomLeftRadius: Theme.radii.xxl,
      borderBottomRightRadius: Theme.radii.xxl,
    },
    heroInner: { width: "100%", alignSelf: "center", gap: Theme.spacing.xl },
    heroTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: Theme.spacing.m,
    },
    heroKicker: { color: colorWithOpacity(Theme.colors.onPrimary, 0.72) },
    heroPill: {
      paddingHorizontal: Theme.spacing.m,
      paddingVertical: 5,
      borderRadius: Theme.radii.pill,
      backgroundColor: colorWithOpacity("#FFFFFF", 0.18),
      borderWidth: 1,
      borderColor: colorWithOpacity("#FFFFFF", 0.24),
    },
    identity: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      padding: Theme.spacing.m,
      borderRadius: Theme.radii.xl,
      backgroundColor: colorWithOpacity("#FFFFFF", 0.14),
      borderWidth: 1,
      borderColor: colorWithOpacity("#FFFFFF", 0.22),
    },
    avatarRing: {
      padding: 2,
      borderRadius: Theme.radii.pill,
      borderWidth: 2,
      borderColor: colorWithOpacity("#FFFFFF", 0.45),
    },
    heroSubtle: { color: colorWithOpacity(Theme.colors.onPrimary, 0.72) },
    body: {
      width: "100%",
      alignSelf: "center",
      marginTop: -Theme.spacing.xxl,
      gap: Theme.spacing.xl,
    },
    stats: { flexDirection: "row", overflow: "hidden" },
    stat: { flex: 1, alignItems: "center", gap: 2, paddingVertical: Theme.spacing.l },
    statDivider: { borderLeftWidth: 1, borderLeftColor: Theme.colors.borderSoft },
    section: { gap: Theme.spacing.m },
    sectionLabel: { paddingLeft: Theme.spacing.xs },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.m },
    tile: {
      flexGrow: 1,
      flexBasis: "45%",
      minHeight: 112,
      justifyContent: "space-between",
      gap: Theme.spacing.m,
      padding: Theme.spacing.l,
      borderRadius: Theme.radii.xl,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.surface,
      ...Theme.shadows.sm,
    },
    tilePressed: { opacity: 0.75 },
    // Full-width horizontal variant (settings): icon, texts, chevron.
    tileRow: {
      flexBasis: "100%",
      flexGrow: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      minHeight: 0,
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.m,
    },
    tileTextRow: { flex: 1, minWidth: 0, gap: 2 },
    tileHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Theme.spacing.s,
    },
    tileIcon: {
      width: 40,
      height: 40,
      borderRadius: Theme.radii.m,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Theme.colors.primarySoft,
    },
    tileText: { gap: 2, minWidth: 0 },
    notice: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      padding: Theme.spacing.m,
      borderRadius: Theme.radii.lg,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      backgroundColor: Theme.colors.background2,
    },
    flex: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.8 },
  })
