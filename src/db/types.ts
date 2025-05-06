import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { users, tokens, transactions } from './schema';

// User types
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// Token types
export type Token = InferSelectModel<typeof tokens>;
export type NewToken = InferInsertModel<typeof tokens>;

// Transaction types
export type Transaction = InferSelectModel<typeof transactions>;
export type NewTransaction = InferInsertModel<typeof transactions>; 