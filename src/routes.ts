import {Router} from '#/lib/routes/router'
import {type FlatNavigatorParams} from './lib/routes/types'

type AllNavigatableRoutes = Omit<
  FlatNavigatorParams,
  'NotFound' | 'SharedPreferencesTester'
>

export const router = new Router<AllNavigatableRoutes>({
  Home: ['/', '/download'],
  Search: '/search',
  Feeds: '/feeds',
  Notifications: '/notifications',
  NotificationsActivityList: '/notifications/activity',
  LegacyNotificationSettings: '/notifications/settings',
  Settings: '/settings',
  Lists: '/lists',
  // moderation
  Moderation: '/moderation',
  ModerationModlists: '/moderation/modlists',
  ModerationMutedAccounts: '/moderation/muted-accounts',
  ModerationBlockedAccounts: '/moderation/blocked-accounts',
  ModerationInteractionSettings: '/moderation/interaction-settings',
  ModerationVerificationSettings: '/moderation/verification-settings',
  // debug
  Debug: '/sys/debug',
  DebugMod: '/sys/debug-mod',
  Log: '/sys/log',
  // settings
  LanguageSettings: '/settings/language',
  AppPasswords: '/settings/app-passwords',
  PreferencesFollowingFeed: '/settings/following-feed',
  PreferencesThreads: '/settings/threads',
  PreferencesExternalEmbeds: '/settings/external-embeds',
  AccessibilitySettings: '/settings/accessibility',
  AppearanceSettings: '/settings/appearance',
  SavedFeeds: '/settings/saved-feeds',
  AccountSettings: '/settings/account',
  PrivacyAndSecuritySettings: '/settings/privacy-and-security',
  ActivityPrivacySettings: '/settings/privacy-and-security/activity',
  ContentAndMediaSettings: '/settings/content-and-media',
  InterestsSettings: '/settings/interests',
  AboutSettings: '/settings/about',
  AppIconSettings: '/settings/app-icon',
  NotificationSettings: '/settings/notifications',
  ReplyNotificationSettings: '/settings/notifications/replies',
  MentionNotificationSettings: '/settings/notifications/mentions',
  QuoteNotificationSettings: '/settings/notifications/quotes',
  LikeNotificationSettings: '/settings/notifications/likes',
  RepostNotificationSettings: '/settings/notifications/reposts',
  NewFollowerNotificationSettings: '/settings/notifications/new-followers',
  LikesOnRepostsNotificationSettings:
    '/settings/notifications/likes-on-reposts',
  RepostsOnRepostsNotificationSettings:
    '/settings/notifications/reposts-on-reposts',
  ActivityNotificationSettings: '/settings/notifications/activity',
  MiscellaneousNotificationSettings: '/settings/notifications/miscellaneous',
  FindContactsSettings: '/settings/find-contacts',
  // support
  Support: '/support',
  PrivacyPolicy: '/support/privacy',
  TermsOfService: '/support/tos',
  CommunityGuidelines: '/support/community-guidelines',
  CopyrightPolicy: '/support/copyright',
  // hashtags
  Hashtag: '/hashtag/:tag',
  Topic: '/topic/:topic',
  // DMs
  Messages: '/messages',
  MessagesSettings: '/messages/settings',
  MessagesInbox: '/messages/inbox',
  MessagesConversation: '/messages/:conversation',
  // starter packs
  Start: '/start/:name/:rkey',
  StarterPackEdit: '/starter-pack/edit/:rkey',
  StarterPack: '/starter-pack/:name/:rkey',
  StarterPackShort: '/starter-pack-short/:code',
  StarterPackWizard: '/starter-pack/create',
  VideoFeed: '/video-feed',
  Bookmarks: '/saved',
  FindContactsFlow: '/find-contacts',
  // books
  Books: '/books',
  BookDetail: '/books/:hiveId',
  // profiles, threads, lists — clean routes first (for URL building),
  // legacy /profile/ routes after (for backwards compat matching).
  // These MUST be last so /:name doesn't shadow fixed routes above.
  Profile: ['/:name', '/profile/:name', '/profile/:name/rss'],
  ProfileFollowers: ['/:name/followers', '/profile/:name/followers'],
  ProfileFollows: ['/:name/follows', '/profile/:name/follows'],
  ProfileKnownFollowers: [
    '/:name/known-followers',
    '/profile/:name/known-followers',
  ],
  ProfileSearch: ['/:name/search', '/profile/:name/search'],
  ProfileList: ['/:name/lists/:rkey', '/profile/:name/lists/:rkey'],
  PostThread: ['/:name/post/:rkey', '/profile/:name/post/:rkey'],
  PostLikedBy: [
    '/:name/post/:rkey/liked-by',
    '/profile/:name/post/:rkey/liked-by',
  ],
  PostRepostedBy: [
    '/:name/post/:rkey/reposted-by',
    '/profile/:name/post/:rkey/reposted-by',
  ],
  PostQuotes: ['/:name/post/:rkey/quotes', '/profile/:name/post/:rkey/quotes'],
  ProfileFeed: ['/:name/feed/:rkey', '/profile/:name/feed/:rkey'],
  ProfileFeedLikedBy: [
    '/:name/feed/:rkey/liked-by',
    '/profile/:name/feed/:rkey/liked-by',
  ],
  ProfileLabelerLikedBy: [
    '/:name/labeler/liked-by',
    '/profile/:name/labeler/liked-by',
  ],
})
