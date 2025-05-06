import { and, eq, desc } from 'drizzle-orm';
import { db } from './index';
import { users, tokens, transactions } from './schema';
import type { NewUser, NewToken, NewTransaction } from './types';

// User queries
export const createUser = async (data: NewUser) => {
  const result = await db.insert(users).values(data).returning();
  return result[0];
};

export const getUserByWalletAddress = async (walletAddress: string) => {
  return await db.query.users.findFirst({
    where: eq(users.walletAddress, walletAddress),
    with: {
      tokens: true,
      transactions: true,
    },
  });
};

export const getAllUsers = async () => {
  return await db.query.users.findMany({
    with: {
      tokens: true,
      transactions: true,
    },
  });
};

// Token queries
export const createToken = async (data: NewToken) => {
  const result = await db.insert(tokens).values(data).returning();
  return result[0];
};

export const getTokenById = async (id: string) => {
  return await db.query.tokens.findFirst({
    where: eq(tokens.id, id),
    with: {
      creator: true,
      transactions: true,
    },
  });
};

export const getTokensByCreator = async (creatorWallet: string) => {
  return await db.query.tokens.findMany({
    where: eq(tokens.creatorWallet, creatorWallet),
    with: {
      transactions: true,
    },
  });
};

// Transaction queries
export const createTransaction = async (data: NewTransaction) => {
  const result = await db.insert(transactions).values(data).returning();
  return result[0];
};

export const getTransactionsByToken = async (tokenId: string) => {
  return await db.query.transactions.findMany({
    where: eq(transactions.tokenId, tokenId),
    with: {
      token: true,
      user: true,
    },
    orderBy: [desc(transactions.createdAt)],
  });
};

export const getTransactionsByWallet = async (walletAddress: string) => {
  return await db.query.transactions.findMany({
    where: eq(transactions.fromWallet, walletAddress),
    with: {
      token: true,
    },
    orderBy: [desc(transactions.createdAt)],
  });
};

export const getTransactionsByOptions = async (options: {
  tokenId?: string;
  fromWallet?: string;
  status?: string;
}) => {
  const conditions = [];
  
  if (options.tokenId) {
    conditions.push(eq(transactions.tokenId, options.tokenId));
  }
  
  if (options.fromWallet) {
    conditions.push(eq(transactions.fromWallet, options.fromWallet));
  }
  
  if (options.status) {
    conditions.push(eq(transactions.status, options.status as any));
  }
  
  return await db.query.transactions.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      token: true,
    },
    orderBy: [desc(transactions.createdAt)],
  });
}; 