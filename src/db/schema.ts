import { pgTable, text, timestamp, integer, boolean, bigint, pgEnum } from "drizzle-orm/pg-core";
import { createId } from '@paralleldrive/cuid2';

// Enums
export const tokenStatusEnum = pgEnum('token_status', ['ACTIVE', 'PENDING', 'FAILED']);
export const transactionTypeEnum = pgEnum('transaction_type', ['CREATION', 'TRANSFER', 'MARKET_CREATION']);
export const transactionStatusEnum = pgEnum('transaction_status', ['SUCCESS', 'FAILED', 'PENDING']);

// Tables
export const users = pgTable('users', {
  id: text('id').primaryKey().notNull().$defaultFn(() => createId()),
  walletAddress: text('wallet_address').notNull().unique(),
  email: text('email').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLogin: timestamp('last_login').defaultNow().notNull(),
  tokensCreated: integer('tokens_created').default(0).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
});

export const tokens = pgTable('tokens', {
  id: text('id').primaryKey().notNull().$defaultFn(() => createId()),
  mintAddress: text('mint_address').notNull().unique(),
  creatorWallet: text('creator_wallet').notNull().references(() => users.walletAddress),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  description: text('description').notNull(),
  imageUrl: text('image_url').notNull(),
  totalSupply: bigint('total_supply', { mode: 'number' }).notNull(),
  decimals: integer('decimals').notNull(),
  openBookMarket: text('open_book_market'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  status: tokenStatusEnum('status').default('ACTIVE').notNull(),
  metadataUri: text('metadata_uri').notNull(),
});

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey().notNull().$defaultFn(() => createId()),
  tokenId: text('token_id').notNull().references(() => tokens.id),
  type: transactionTypeEnum('type').notNull(),
  fromWallet: text('from_wallet').notNull().references(() => users.walletAddress),
  toWallet: text('to_wallet'),
  amount: bigint('amount', { mode: 'number' }),
  txSignature: text('tx_signature').notNull(),
  status: transactionStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  error: text('error'),
}); 