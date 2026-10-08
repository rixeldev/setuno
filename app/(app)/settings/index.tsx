import React, { useState } from "react"
import { Linking, Pressable, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import Constants from "expo-constants"
import { useTranslation } from "react-i18next"

import { Theme } from "@/constants/Theme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { AppText } from "@/components/ui/AppText"
import { Avatar } from "@/components/ui/Avatar"
import { Badge, Card, Divider } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { useToast } from "@/components/ui/Toast"
import {
  ChevronRightIcon,
  GroupIcon,
  LanguageIcon,
  LinkIcon,
  LogoutIcon,
  OrganizationIcon,
  PaletteIconNew,
  ShieldIcon,
} from "@/components/ui/Icons"
import { ScreenContainer } from "@/components/app/ScreenContainer"
import { LanguageSheet } from "@/components/settings/LanguageSheet"
import { ThemeSheet } from "@/components/settings/ThemeSheet"
import { useAuth } from "@/hooks/useAuth"
import { useOrganization } from "@/hooks/useOrganization"
import { useOrgData } from "@/hooks/useOrgData"
import { getAppearance } from "@/services/themeManager"
import { useLanguagePreference } from "@/services/i18next"
import { getDeviceLanguage } from "@/libs/deviceLanguage"
import { PRIVACY_URL, TERMS_URL } from "@/libs/appLinks"
import { LANGUAGE_NAMES, matchLanguage } from "@/libs/language"
import { toFriendlyError } from "@/services/errors"
import { pluralize } from "@/libs/format"

interface RowProps {
  icon: React.ComponentType<{ size?: number; color?: string }>
  title: string
  subtitle?: string
  onPress: () => void
  danger?: boolean
  /** Brings its own padding, for rows living in a `padded={false}` card. */
  compact?: boolean
}

/**
 * Settings hub: profile summary, links to the settings sub-screens and the
 * sign-out confirmation.
 */
export default function SettingsScreen() {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)
  const router = useRouter()
  const toast = useToast()
  const { profile, user, signOut } = useAuth()
  const { organization, role, organizations } = useOrganization()
  const { songs, setlists, performances, members } = useOrgData()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [sheet, setSheet] = useState<"theme" | "language" | null>(null)

  const displayName = profile?.displayName ?? user?.displayName ?? ""
  const email = user?.email ?? profile?.email ?? ""
  const appearance = getAppearance()
  const languagePreference = useLanguagePreference()
  const modeLabel =
    appearance.mode === "system"
      ? t("settings.system")
      : appearance.mode === "light"
        ? t("settings.light")
        : t("settings.dark")
  const languageLabel =
    languagePreference === "device"
      ? `${t("settings.automatic")} · ${LANGUAGE_NAMES[matchLanguage(getDeviceLanguage())]}`
      : LANGUAGE_NAMES[languagePreference]

  const appVersion = Constants.expoConfig?.version ?? ""

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      toast.showSuccess(t("toasts.signedOut"))
    } catch (error) {
      toast.showError(toFriendlyError(error))
    } finally {
      setSigningOut(false)
      setConfirmSignOut(false)
    }
  }

  return (
    <ScreenContainer
      title={t("settings.settings")}
      subtitle={t("settings.subtitle")}
      large
      back
    >
      <Card
        style={styles.card}
        onPress={() => router.push("/settings/profile")}
        accessibilityLabel={t("settings.profile")}
      >
        <View style={styles.profile}>
          <Avatar
            name={displayName || email}
            photoURL={profile?.photoURL ?? user?.photoURL ?? null}
            size={56}
          />
          <View style={styles.profileText}>
            <AppText variant="title" numberOfLines={1}>
              {displayName || email}
            </AppText>
            {email ? (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {email}
              </AppText>
            ) : null}
            {role ? (
              <Badge
                label={
                  isOwner(user?.uid, organization?.ownerId)
                    ? t("organizations.owner")
                    : role === "admin"
                      ? t("organizations.admin")
                      : t("organizations.member")
                }
                tone="primary"
                style={styles.badge}
              />
            ) : null}
          </View>
          <ChevronRightIcon size={18} color={Theme.colors.textFaint} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Row
          icon={OrganizationIcon}
          title={t("settings.organization")}
          subtitle={organization?.name}
          onPress={() => router.push("/settings/organization")}
        />
        <Divider />
        <Row
          icon={PaletteIconNew}
          title={t("settings.appearance")}
          subtitle={modeLabel}
          onPress={() => setSheet("theme")}
        />
        <Divider />
        <Row
          icon={LanguageIcon}
          title={t("settings.language")}
          subtitle={languageLabel}
          onPress={() => setSheet("language")}
        />
        <Divider />
        <Row
          icon={GroupIcon}
          title={t("organizations.bands")}
          subtitle={pluralize(organizations.length, "band")}
          onPress={() => router.push("/organizations")}
        />
      </Card>

      <Card style={styles.card}>
        <View style={styles.stats}>
          <Stat label={t("dashboard.stats.totalSongs")} value={songs.length} />
          <Stat label={t("dashboard.stats.totalSetlists")} value={setlists.length} />
          <Stat label={t("dashboard.stats.upcomingShows")} value={performances.length} />
          <Stat label={t("dashboard.stats.members")} value={members.length} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Row
          icon={LinkIcon}
          title={t("settings.terms")}
          onPress={() => void Linking.openURL(TERMS_URL).catch(() => undefined)}
        />
        <Divider />
        <Row
          icon={ShieldIcon}
          title={t("settings.privacy")}
          onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => undefined)}
        />
      </Card>

      <Card padded={false}>
        <Row
          icon={LogoutIcon}
          title={t("settings.signOut")}
          danger
          compact
          onPress={() => setConfirmSignOut(true)}
        />
      </Card>

      <AppText variant="caption" tone="faint" style={styles.footer}>
        {t("settings.version", { version: appVersion })}
      </AppText>

      <Dialog
        visible={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title={t("settings.signOutConfirm", {
          defaultValue: "Sign out of your account?",
        })}
        description={t("settings.signOutDescription", {
          defaultValue: "Your songs stay safe on the server. Sign back in any time.",
        })}
        confirmLabel={t("settings.signOut")}
        cancelLabel={t("common.cancel")}
        confirmLoading={signingOut}
        tone="danger"
        onConfirm={handleSignOut}
      />

      <ThemeSheet visible={sheet === "theme"} onClose={() => setSheet(null)} />
      <LanguageSheet visible={sheet === "language"} onClose={() => setSheet(null)} />
    </ScreenContainer>
  )
}

function Row({ icon: Icon, title, subtitle, onPress, danger, compact = false }: RowProps) {
  const styles = useThemedStyles(createStyles)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.row,
        compact && styles.rowCompact,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Icon
          size={20}
          color={danger ? Theme.colors.danger : Theme.colors.primary}
        />
      </View>
      <View style={styles.rowBody}>
        <AppText variant="bodyStrong" tone={danger ? "danger" : "default"}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {!danger ? (
        <ChevronRightIcon size={18} color={Theme.colors.textFaint} />
      ) : null}
    </Pressable>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  const styles = useThemedStyles(createStyles)
  return (
    <View style={styles.stat}>
      <AppText variant="heading">{value}</AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  )
}

function isOwner(uid: string | undefined, ownerId: string | undefined): boolean {
  return Boolean(uid && ownerId && uid === ownerId)
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      marginBottom: Theme.spacing.xs,
    },
    profile: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.m,
      paddingVertical: Theme.spacing.xs,
    },
    profileText: {
      flex: 1,
      gap: 2,
    },
    badge: {
      alignSelf: "flex-start",
      marginTop: 6,
    },
    stats: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Theme.spacing.m,
    },
    stat: {
      flexGrow: 1,
      minWidth: 110,
      gap: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.s,
      paddingVertical: Theme.spacing.s,
    },
    // Compact rows (sign out) carry their own padding so the card stays slim.
    rowCompact: {
      paddingHorizontal: Theme.spacing.l,
      paddingVertical: Theme.spacing.s,
    },
    rowPressed: {
      opacity: 0.6,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: Theme.radii.m,
      backgroundColor: Theme.colors.surface,
      borderWidth: 1,
      borderColor: Theme.colors.borderSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    rowIconDanger: {
      backgroundColor: Theme.colors.background,
    },
    rowBody: {
      flex: 1,
      gap: 2,
    },
    footer: {
      textAlign: "center",
      marginTop: Theme.spacing.m,
      marginBottom: Theme.spacing.l,
    },
  })
