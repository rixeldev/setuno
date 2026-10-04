import React from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Avatar } from "@/components/ui/Avatar"
import { Badge, Card, Divider } from "@/components/ui/Card"
import { ChevronRightIcon } from "@/components/ui/Icons"
import { PageHeader } from "@/components/ui/PageHeader"
import { useResponsive } from "@/hooks/useResponsive"
import { useOrganization } from "@/hooks/useOrganization"
import { useAuth } from "@/hooks/useAuth"
import { useOrgData } from "@/hooks/useOrgData"
import { MORE_NAV } from "@/libs/navigation"
import { pluralize } from "@/libs/format"
import { ROLE_LABELS } from "@/interfaces"

/**
 * Mobile hub for everything that doesn't fit the bottom bar (docs §21). On
 * desktop the sidebar lists these items directly, so this route is only linked
 * from the bottom bar.
 */
export default function MoreScreen() {
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const { gutter } = useResponsive()
  const { profile, user } = useAuth()
  const { organization, role, organizations } = useOrganization()
  const { songs, pendingSuggestions } = useOrgData()

  const displayName = profile?.displayName || user?.displayName || "Musician"

  return (
    <View style={styles.host}>
      <PageHeader title="More" large />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.identity}>
          <Avatar
            name={displayName}
            photoURL={profile?.photoURL ?? user?.photoURL ?? null}
            size={48}
            accessibilityLabel={`${displayName}${profile?.email ? `, ${profile.email}` : ""}`}
          />
          <View style={styles.flex}>
            <AppText variant="subheading" numberOfLines={1}>
              {displayName}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {organization
                ? `${organization.name} · ${ROLE_LABELS[role ?? "member"]}`
                : "No band selected"}
            </AppText>
          </View>
        </Card>

        <View style={styles.group}>
          {MORE_NAV.map((item, index) => {
            const Icon = item.icon
            const hint = item.badge === "suggestions" && pendingSuggestions.length > 0
              ? `${pendingSuggestions.length} new`
              : undefined
            return (
              <View key={item.href}>
                {index > 0 ? <Divider /> : null}
                <Card
                  padded={false}
                  onPress={() => router.push(item.href as never)}
                  accessibilityLabel={hint ? `${item.label}. ${hint}` : item.label}
                >
                  <View style={styles.row}>
                    <Icon size={18} color={Theme.colors.textMuted} />
                    <AppText variant="bodyStrong" style={styles.flex}>
                      {item.label}
                    </AppText>
                    {hint ? <Badge label={hint} tone="accent" /> : null}
                    <ChevronRightIcon size={16} color={Theme.colors.textFaint} />
                  </View>
                </Card>
              </View>
            )
          })}
        </View>

        <Card style={styles.summary}>
          <AppText variant="caption" tone="muted">
            {pluralize(songs.length, "song")} · {pluralize(organizations.length, "band")} ·{" "}
            {pluralize(pendingSuggestions.length, "pending suggestion")}
          </AppText>
          {role === "admin" ? (
            <Badge label="You're an admin in this band" tone="primary" />
          ) : (
            <AppText variant="caption" tone="faint">
              Members can suggest changes; admins approve them.
            </AppText>
          )}
        </Card>
      </ScrollView>
    </View>
  )
}

const createStyles = () =>
  StyleSheet.create({
    host: { flex: 1, backgroundColor: Theme.colors.background },
    scroll: { paddingTop: Theme.spacing.s, gap: Theme.spacing.xl, paddingBottom: Theme.spacing.huge },
    identity: { flexDirection: "row", alignItems: "center", gap: Theme.spacing.m },
    flex: { flex: 1, minWidth: 0 },
    group: {
      borderRadius: Theme.radii.xl,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      overflow: "hidden",
      backgroundColor: Theme.colors.surface,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      padding: Theme.spacing.l,
    },
    summary: { gap: Theme.spacing.s },
  })