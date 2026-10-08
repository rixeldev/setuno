import Ionicons from "@expo/vector-icons/Ionicons"
import FontAwesome from "@expo/vector-icons/FontAwesome"
import FontAwesome5 from "@expo/vector-icons/FontAwesome5"
import Entypo from "@expo/vector-icons/Entypo"
import MaterialIcons from "@expo/vector-icons/MaterialIcons"
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons"
import AntDesign from "@expo/vector-icons/AntDesign"
import Octicons from "@expo/vector-icons/Octicons"
import Feather from "@expo/vector-icons/Feather"
import { Theme } from "@/constants/Theme"

export const GoogleIcon = (props: any) => (
  <AntDesign name="google" color={Theme.colors.text} size={24} {...props} />
)

export const RestartIcon = (props: any) => (
  <MaterialCommunityIcons
    name="restart"
    color={Theme.colors.text}
    size={24}
    {...props}
  />
)

export const RefreshIcon = (props: any) => (
  <MaterialCommunityIcons
    name="refresh"
    color={Theme.colors.text}
    size={24}
    {...props}
  />
)

export const UpdateIcon = (props: any) => (
  <MaterialCommunityIcons
    name="update"
    color={Theme.colors.text}
    size={24}
    {...props}
  />
)

export const CheckIcon = (props: any) => (
  <MaterialCommunityIcons
    name="check-decagram-outline"
    color={Theme.colors.text}
    size={24}
    {...props}
  />
)

export const CopyIcon = (props: any) => (
  <Ionicons
    name="copy-outline"
    color={Theme.colors.text}
    size={24}
    {...props}
  />
)

export const CloseIcon = (props: any) => (
  <Ionicons name="close" color={Theme.colors.text} size={24} {...props} />
)

export const ChatIcon = (props: any) => (
  <Ionicons
    name="chatbubble-ellipses-outline"
    color={Theme.colors.text}
    size={24}
    {...props}
  />
)

export const EmojiIcon = (props: any) => (
  <Ionicons name="happy-outline" color={Theme.colors.text} size={24} {...props} />
)

export const SendIcon = (props: any) => (
  <Ionicons name="send" color={Theme.colors.text} size={24} {...props} />
)

export const LanguageIcon = (props: any) => (
  <Ionicons name="language" color={Theme.colors.text} size={24} {...props} />
)

export const PlayIcon = (props: any) => (
  <Ionicons
    name="play-outline"
    color={Theme.colors.text}
    size={24}
    {...props}
  />
)

export const GithubIcon = (props: any) => (
  <Feather name="github" color={Theme.colors.text} size={24} {...props} />
)

export const UserIcon = (props: any) => (
  <Feather name="user" color={Theme.colors.text} size={24} {...props} />
)

export const UsersIcon = (props: any) => (
  <Feather name="users" color={Theme.colors.text} size={24} {...props} />
)

export const HashIcon = (props: any) => (
  <FontAwesome5
    name="slack-hash"
    color={Theme.colors.text}
    size={24}
    {...props}
  />
)

export const BoxesIcon = (props: any) => (
  <MaterialCommunityIcons
    name="vector-square"
    color={Theme.colors.text}
    size={24}
    {...props}
  />
)

export const StarIcon = (props: any) => (
  <Octicons name="star" color={Theme.colors.text} size={24} {...props} />
)

export const QuestionIcon = (props: any) => (
  <Octicons name="question" color={Theme.colors.text} size={24} {...props} />
)

export const ShareIcon = (props: any) => (
  <Octicons name="share" color={Theme.colors.text} size={24} {...props} />
)

export const InfoIcon = (props: any) => (
  <Octicons name="info" color={Theme.colors.text} size={24} {...props} />
)

export const EditIcon = (props: any) => (
  <Octicons name="pencil" color={Theme.colors.text} size={24} {...props} />
)

export const VerifiedIcon = (props: any) => (
  <Octicons name="verified" color={Theme.colors.text} size={24} {...props} />
)

export const EyeIcon = (props: any) => (
  <Octicons name="eye" color={Theme.colors.text} size={24} {...props} />
)

export const EyeOffIcon = (props: any) => (
  <Octicons name="eye-closed" color={Theme.colors.text} size={24} {...props} />
)

export const LockIcon = (props: any) => (
  <Octicons name="lock" color={Theme.colors.text} size={24} {...props} />
)

export const MailIcon = (props: any) => (
  <Octicons name="mail" color={Theme.colors.text} size={24} {...props} />
)

export const LinkIcon = (props: any) => (
  <Octicons name="link" color={Theme.colors.text} size={24} {...props} />
)

export const OfflineIcon = (props: any) => (
  <Octicons
    name="cloud-offline"
    color={Theme.colors.text}
    size={24}
    {...props}
  />
)

export const GameIcon = (props: any) => (
  <FontAwesome5 name="gamepad" color={Theme.colors.text} size={24} {...props} />
)

export const OnlineIcon = (props: any) => (
  <Octicons name="cloud" color={Theme.colors.text} size={24} {...props} />
)

export const BackIcon = (props: any) => (
  <Entypo name="chevron-left" color={Theme.colors.text} size={24} {...props} />
)

export const ForwardIcon = (props: any) => (
  <Entypo name="chevron-right" color={Theme.colors.text} size={24} {...props} />
)

export const CogIcon = (props: any) => (
  <FontAwesome name="cog" size={24} color={Theme.colors.text} {...props} />
)

export const HomeIcon = (props: any) => (
  <FontAwesome5 name="home" size={24} color={Theme.colors.text} {...props} />
)

export const StatsIcon = (props: any) => (
  <Ionicons name="stats-chart" size={24} color={Theme.colors.text} {...props} />
)

export const ComputerIcon = (props: any) => (
  <MaterialIcons
    name="computer"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const VibrationIcon = (props: any) => (
  <MaterialIcons
    name="vibration"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const PrivacyIcon = (props: any) => (
  <MaterialCommunityIcons
    name="security"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const WebIcon = (props: any) => (
  <MaterialCommunityIcons
    name="web"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const LogoutIcon = (props: any) => (
  <MaterialCommunityIcons
    name="account-arrow-left"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const ListIcon = (props: any) => (
  <MaterialCommunityIcons
    name="format-list-bulleted"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const SoundIcon = (props: any) => (
  <AntDesign name="sound" size={24} color={Theme.colors.text} {...props} />
)

export const AddIcon = (props: any) => (
  <MaterialIcons name="add" size={24} color={Theme.colors.text} {...props} />
)

export const RemoveIcon = (props: any) => (
  <MaterialIcons name="remove" size={24} color={Theme.colors.text} {...props} />
)

export const TrophyIcon = (props: any) => (
  <MaterialCommunityIcons
    name="trophy"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const ConnectIcon = (props: any) => (
  <MaterialCommunityIcons
    name="dots-grid"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const HangmanIcon = (props: any) => (
  <MaterialCommunityIcons
    name="alphabetical-variant"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const CalendarIcon = (props: any) => (
  <FontAwesome5 name="calendar" size={24} color={Theme.colors.text} {...props} />
)

export const DiamondIcon = (props: any) => (
  <FontAwesome5 name="gem" size={24} color={Theme.colors.text} {...props} />
)

export const CrownIcon = (props: any) => (
  <FontAwesome5 name="crown" size={24} color={Theme.colors.text} {...props} />
)

export const FlameIcon = (props: any) => (
  <FontAwesome5 name="fire" size={24} color={Theme.colors.text} {...props} />
)

export const StopwatchIcon = (props: any) => (
  <MaterialCommunityIcons
    name="timer"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const TargetIcon = (props: any) => (
  <MaterialCommunityIcons
    name="target"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const GridIcon = (props: any) => (
  <MaterialCommunityIcons name="grid" size={24} color={Theme.colors.text} {...props} />
)

export const GemsIcon = (props: any) => (
  <FontAwesome5 name="gem" size={24} color={Theme.colors.text} {...props} />
)

export const ArrowUpIcon = (props: any) => (
  <FontAwesome5 name="arrow-up" size={24} color={Theme.colors.text} {...props} />
)

export const CoinsIcon = (props: any) => (
  <FontAwesome5 name="coins" size={24} color={Theme.colors.text} {...props} />
)

export const ShopIcon = (props: any) => (
  <MaterialCommunityIcons
    name="shopping-outline"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const PaletteIcon = (props: any) => (
  <MaterialCommunityIcons
    name="palette-outline"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const SparklesIcon = (props: any) => (
  <MaterialCommunityIcons
    name="star-four-points-outline"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const ShieldIcon = (props: any) => (
  <MaterialCommunityIcons
    name="shield-check-outline"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const LightbulbIcon = (props: any) => (
  <MaterialCommunityIcons
    name="lightbulb-outline"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

export const BoostIcon = (props: any) => (
  <MaterialCommunityIcons
    name="speedometer"
    size={24}
    color={Theme.colors.text}
    {...props}
  />
)

/* ------------------------------------------------------------------------- */
/* Setuno icons                                                              */
/* Musical, editorial and navigation symbols used across the product.        */
/* ------------------------------------------------------------------------- */

export interface IconProps {
  size?: number
  color?: string
}

export const MusicIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="musical-notes" size={size} color={color} {...rest} />
)

export const NoteIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="musical-note" size={size} color={color} {...rest} />
)

export const MicIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="mic" size={size} color={color} {...rest} />
)

export const MicOffIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="mic-off" size={size} color={color} {...rest} />
)

export const GuitarIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="guitar-pick" size={size} color={color} {...rest} />
)

export const LibraryIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="library" size={size} color={color} {...rest} />
)

export const SearchIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="search" size={size} color={color} {...rest} />
)

export const TrashIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="trash-outline" size={size} color={color} {...rest} />
)

export const PlusIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="add" size={size} color={color} {...rest} />
)

export const SaveIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="checkmark-done" size={size} color={color} {...rest} />
)

export const ChevronRightIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="chevron-forward" size={size} color={color} {...rest} />
)

export const ChevronDownIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="chevron-down" size={size} color={color} {...rest} />
)

export const ChevronUpIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="chevron-up" size={size} color={color} {...rest} />
)

export const ArrowLeftIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="arrow-back" size={size} color={color} {...rest} />
)

export const ArrowDownIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="arrow-down" size={size} color={color} {...rest} />
)

export const ArrowUpwardIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="arrow-up" size={size} color={color} {...rest} />
)

export const AlertIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="alert-circle" size={size} color={color} {...rest} />
)

export const CheckCircleIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="checkmark-circle" size={size} color={color} {...rest} />
)

export const ClockIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="time-outline" size={size} color={color} {...rest} />
)

export const KeyIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="key" size={size} color={color} {...rest} />
)

export const TextSizeIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="format-size" size={size} color={color} {...rest} />
)

export const TransposeIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="git-compare-outline" size={size} color={color} {...rest} />
)

export const SettingsIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="settings-outline" size={size} color={color} {...rest} />
)

export const MenuIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="menu" size={size} color={color} {...rest} />
)

export const SwapIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="swap-horizontal" size={size} color={color} {...rest} />
)

export const SortIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="swap-vertical" size={size} color={color} {...rest} />
)

export const ExpandIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="expand-outline" size={size} color={color} {...rest} />
)

export const CollapseIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="contract-outline" size={size} color={color} {...rest} />
)

export const DragIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="reorder-three-outline" size={size} color={color} {...rest} />
)

export const LogoIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="guitar-electric" size={size} color={color} {...rest} />
)

/* Filter / list navigation icons used by search and menu screens. */
export const FilterIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="funnel-outline" size={size} color={color} {...rest} />
)

export const TuneIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="options-outline" size={size} color={color} {...rest} />
)

export const DotsIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="ellipsis-horizontal" size={size} color={color} {...rest} />
)

export const BookIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="book-open-page-variant-outline" size={size} color={color} {...rest} />
)

export const PlaylistIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="playlist-music" size={size} color={color} {...rest} />
)

export const CalendarOutlineIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="calendar-outline" size={size} color={color} {...rest} />
)

export const CalendarCheckIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="calendar-check" size={size} color={color} {...rest} />
)

export const SignOutIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="logout" size={size} color={color} {...rest} />
)

export const AccountIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="account-circle" size={size} color={color} {...rest} />
)

export const ShieldCheckIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="shield-checkmark" size={size} color={color} {...rest} />
)

export const PaletteIconNew = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="color-palette-outline" size={size} color={color} {...rest} />
)

export const PencilIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="pencil" size={size} color={color} {...rest} />
)

export const CopyListIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="content-copy" size={size} color={color} {...rest} />
)

export const StageIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="guitar-electric" size={size} color={color} {...rest} />
)

export const MapPinIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="map-marker-outline" size={size} color={color} {...rest} />
)

export const EmailIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="email-outline" size={size} color={color} {...rest} />
)

export const GroupIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="account-group" size={size} color={color} {...rest} />
)

export const FullscreenIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="fullscreen" size={size} color={color} {...rest} />
)

export const FullscreenExitIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="fullscreen-exit" size={size} color={color} {...rest} />
)

export const SuggestIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <MaterialCommunityIcons name="lightbulb-on-outline" size={size} color={color} {...rest} />
)

/** Band / organization mark used in settings and navigation. */
export const OrganizationIcon = ({ size = 24, color = Theme.colors.text, ...rest }: IconProps & Record<string, unknown>) => (
  <Ionicons name="business-outline" size={size} color={color} {...rest} />
)
