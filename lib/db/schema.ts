import { text, timestamp, boolean, pgTable, bigint, integer, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Better Auth required tables
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  expiresAt: timestamp('expiresAt'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
})

export const systemRoles = pgTable(
  'system_roles',
  {
    id: text('id').primaryKey(),
    telegramId: text('telegramId').notNull().unique(),
    role: text('role').notNull().default('admin'), // superadmin, admin
    addedBy: text('addedBy'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [index('system_roles_telegramId_idx').on(table.telegramId)]
)

export const systemTariffs = pgTable(
  'system_tariffs',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    features: text('features'), // JSON or newline-separated features list
    price: integer('price').notNull(), // UZS
    period: text('period').notNull().default('month'), // day, week, month, year
    cardNumber: text('cardNumber').notNull().default('9860350123453587'),
    cardOwner: text('cardOwner').notNull().default('AZizbek I'),
    cardBank: text('cardBank').default('HUMOCARD'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  }
)

// App-specific tables
export const authSessions = pgTable('auth_sessions', {
  token: text('token').primaryKey(),
  userId: text('userId').notNull(),
  telegramId: text('telegramId'),
  shopId: text('shopId'),
  role: text('role').default('user'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  expiresAt: timestamp('expiresAt').notNull(),
})

export const userProfiles = pgTable('user_profiles', {
  telegramId: text('telegramId').primaryKey(),
  termsAccepted: boolean('termsAccepted').notNull().default(false),
  tier: text('tier').notNull().default('free'), // free, premium
  premiumEndsAt: timestamp('premiumEndsAt'),
  acceptedAt: timestamp('acceptedAt'),
  referredBy: text('referredBy'),
  referralCount: integer('referralCount').notNull().default(0),
  rewardedDays: integer('rewardedDays').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const shops = pgTable(
  'shops',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    logoUrl: text('logoUrl'),
    approved: boolean('approved').notNull().default(false),
    slug: text('slug').notNull().unique(),
    cardLast4: text('cardLast4').notNull().default('3587'),
    cardNumber: text('cardNumber').notNull().default('9860350123453587'),
    cardBank: text('cardBank').default('HUMOCARD'),
    accountOwner: text('accountOwner'),
    webhookUrl: text('webhookUrl'),
    telegramChannelId: text('telegramChannelId'),
    userbotSession: text('userbotSession'),
    tier: text('tier').notNull().default('free'), // free, premium
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    index('shops_userId_idx').on(table.userId),
    index('shops_slug_idx').on(table.slug),
  ]
)

export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    shopId: text('shopId').notNull(),
    userId: text('userId').notNull(),
    amount: integer('amount').notNull(), // UZS
    currency: text('currency').notNull().default('UZS'),
    multiplier: integer('multiplier').notNull().default(1),
    status: text('status').notNull().default('pending'), // pending, paid, expired, rejected, archived
    isTest: boolean('isTest').default(false),
    expiresAt: timestamp('expiresAt').notNull(),
    matchedAt: timestamp('matchedAt'),
    sourceMessage: text('sourceMessage'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    index('payments_shopId_idx').on(table.shopId),
    index('payments_userId_idx').on(table.userId),
    index('payments_status_idx').on(table.status),
  ]
)

export const deliveryLogs = pgTable(
  'delivery_logs',
  {
    id: text('id').primaryKey(),
    paymentId: text('paymentId').notNull(),
    target: text('target').notNull(), // 'webhook', 'telegram'
    status: text('status').notNull(), // 'sent', 'failed', 'retrying'
    response: text('response'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    index('delivery_logs_paymentId_idx').on(table.paymentId),
    index('delivery_logs_target_idx').on(table.target),
  ]
)

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [index('webhook_endpoints_userId_idx').on(table.userId)]
)

export const channelEndpoints = pgTable(
  'channel_endpoints',
  {
    id: text('id').primaryKey(),
    shopId: text('shopId').notNull(),
    userId: text('userId').notNull(),
    channelId: text('channelId').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    index('channel_endpoints_shopId_idx').on(table.shopId),
    index('channel_endpoints_userId_idx').on(table.userId),
  ]
)

export const userbotConnections = pgTable(
  'userbot_connections',
  {
    id: text('id').primaryKey(),
    shopId: text('shopId').notNull(),
    userId: text('userId').notNull(),
    sessionString: text('sessionString').notNull(), // encrypted
    chatId: text('chatId'),
    status: text('status').notNull().default('connecting'), // connecting, active, error
    lastEventAt: timestamp('lastEventAt'),
    error: text('error'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    index('userbot_connections_shopId_idx').on(table.shopId),
    index('userbot_connections_userId_idx').on(table.userId),
  ]
)

export const storeApiKeys = pgTable(
  'store_api_keys',
  {
    id: text('id').primaryKey(),
    shopId: text('shopId').notNull(),
    userId: text('userId').notNull(),
    key: text('key').notNull().unique(),
    secret: text('secret').notNull(),
    active: boolean('active').notNull().default(true),
    lastUsedAt: timestamp('lastUsedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    index('store_api_keys_shopId_idx').on(table.shopId),
    index('store_api_keys_userId_idx').on(table.userId),
  ]
)

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    shopId: text('shopId').notNull(),
    userId: text('userId').notNull(),
    plan: text('plan').notNull(), // daily, weekly, monthly
    quantity: integer('quantity').notNull().default(1),
    totalPrice: integer('totalPrice').notNull(),
    expiresAt: timestamp('expiresAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    index('subscriptions_shopId_idx').on(table.shopId),
    index('subscriptions_userId_idx').on(table.userId),
  ]
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    action: text('action').notNull(),
    resourceType: text('resourceType'),
    resourceId: text('resourceId'),
    details: text('details'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_userId_idx').on(table.userId),
    index('audit_logs_createdAt_idx').on(table.createdAt),
  ]
)

export const fundraisers = pgTable(
  'fundraisers',
  {
    id: text('id').primaryKey(),
    shopId: text('shopId').notNull(),
    userId: text('userId').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    goalAmount: integer('goalAmount').notNull().default(0), // UZS, 0 = unlimited
    collectedAmount: integer('collectedAmount').notNull().default(0), // UZS
    donorCount: integer('donorCount').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    index('fundraisers_shopId_idx').on(table.shopId),
    index('fundraisers_userId_idx').on(table.userId),
  ]
)

export const donations = pgTable(
  'donations',
  {
    id: text('id').primaryKey(),
    fundraiserId: text('fundraiserId').notNull(),
    donorTempId: text('donorTempId').notNull(), // e.g. DONOR-928135
    donorName: text('donorName').notNull(), // Ism & Familiya
    amount: integer('amount').notNull(), // UZS
    comment: text('comment'), // Tilak / Izoh
    status: text('status').notNull().default('pending'), // pending, paid, cancelled
    paymentId: text('paymentId'), // Linked payment if matched via userbot
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    index('donations_fundraiserId_idx').on(table.fundraiserId),
    index('donations_donorTempId_idx').on(table.donorTempId),
    index('donations_status_idx').on(table.status),
  ]
)

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const mandatoryChannels = pgTable('mandatory_channels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  channelId: text('channelId').notNull(), // e.g. -1001234567890 or @username
  inviteUrl: text('inviteUrl').notNull(), // e.g. https://t.me/channel
  type: text('type').notNull().default('channel'), // channel, group
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// VIP & Paid Group / Channel Access (Pay-to-Write or Invite)
export const paidAccessRooms = pgTable('paid_access_rooms', {
  id: text('id').primaryKey(),
  shopId: text('shopId'),
  title: text('title').notNull(),
  chatId: text('chatId').notNull(), // Telegram chat_id (e.g. -100...)
  type: text('type').notNull().default('group'), // 'group' | 'channel'
  mode: text('mode').notNull().default('write_permission'), // 'write_permission' (mute non-paying) | 'invite_link' (private invite)
  hourlyPrice: integer('hourlyPrice').notNull().default(5000), // UZS
  dailyPrice: integer('dailyPrice').notNull().default(15000), // UZS
  weeklyPrice: integer('weeklyPrice').notNull().default(50000), // UZS
  monthlyPrice: integer('monthlyPrice').notNull().default(120000), // UZS
  currency: text('currency').notNull().default('UZS'),
  active: boolean('active').notNull().default(true),
  welcomeMessage: text('welcomeMessage'),
  ownerTelegramId: text('ownerTelegramId'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const paidAccessMembers = pgTable('paid_access_members', {
  id: text('id').primaryKey(),
  roomId: text('roomId').notNull(),
  userId: text('userId').notNull(), // Telegram User ID
  username: text('username'),
  fullName: text('fullName'),
  plan: text('plan').notNull().default('month'), // 'hour' | 'day' | 'week' | 'month'
  amountPaid: integer('amountPaid').notNull().default(0),
  status: text('status').notNull().default('active'), // 'active' | 'expired' | 'revoked'
  startsAt: timestamp('startsAt').notNull().defaultNow(),
  expiresAt: timestamp('expiresAt').notNull(),
  paymentId: text('paymentId'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  shops: many(shops),
  payments: many(payments),
  webhookEndpoints: many(webhookEndpoints),
  userbotConnections: many(userbotConnections),
  storeApiKeys: many(storeApiKeys),
  subscriptions: many(subscriptions),
  auditLogs: many(auditLogs),
}))

export const shopsRelations = relations(shops, ({ one, many }) => ({
  user: one(user, { fields: [shops.userId], references: [user.id] }),
  payments: many(payments),
  channelEndpoints: many(channelEndpoints),
  userbotConnections: many(userbotConnections),
  storeApiKeys: many(storeApiKeys),
  subscriptions: many(subscriptions),
}))

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  shop: one(shops, { fields: [payments.shopId], references: [shops.id] }),
  user: one(user, { fields: [payments.userId], references: [user.id] }),
  deliveryLogs: many(deliveryLogs),
}))

export const deliveryLogsRelations = relations(deliveryLogs, ({ one }) => ({
  payment: one(payments, { fields: [deliveryLogs.paymentId], references: [payments.id] }),
}))
