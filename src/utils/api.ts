import { Connection, PublicKey } from '@solana/web3.js'

export interface ApiResponse<T> {
  data?: T
  error?: string
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(response.status, data.error || 'API request failed')
    }

    return { data }
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message }
    }
    return { error: 'An unexpected error occurred' }
  }
}

export async function authenticatedApiRequest<T>(
  endpoint: string,
  walletAddress: string,
  signature: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      'x-wallet-address': walletAddress,
      'x-signature': signature,
      ...options.headers,
    },
  })
}

// User API functions
export async function createUser(walletAddress: string, email?: string) {
  return authenticatedApiRequest('/api/users', walletAddress, '', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, email }),
  })
}

export async function getUser(walletAddress: string) {
  return authenticatedApiRequest(
    `/api/users?walletAddress=${walletAddress}`,
    walletAddress,
    '',
    { method: 'GET' }
  )
}

// Token API functions
export async function createToken(
  walletAddress: string,
  signature: string,
  tokenData: {
    mintAddress: string
    name: string
    symbol: string
    description: string
    imageUrl: string
    totalSupply: bigint
    decimals: number
    metadataUri: string
  }
) {
  return authenticatedApiRequest('/api/tokens', walletAddress, signature, {
    method: 'POST',
    body: JSON.stringify({
      ...tokenData,
      creatorWallet: walletAddress,
    }),
  })
}

export async function getToken(mintAddress: string) {
  return apiRequest(`/api/tokens?mintAddress=${mintAddress}`, {
    method: 'GET',
  })
}

export async function getUserTokens(walletAddress: string, signature: string) {
  return authenticatedApiRequest(
    `/api/tokens?creatorWallet=${walletAddress}`,
    walletAddress,
    signature,
    { method: 'GET' }
  )
}

// Transaction API functions
export async function createTransaction(
  walletAddress: string,
  signature: string,
  transactionData: {
    tokenId: string
    type: 'CREATION' | 'TRANSFER' | 'MARKET_CREATION'
    toWallet?: string
    amount?: bigint
    txSignature: string
  }
) {
  return authenticatedApiRequest('/api/transactions', walletAddress, signature, {
    method: 'POST',
    body: JSON.stringify({
      ...transactionData,
      fromWallet: walletAddress,
    }),
  })
}

export async function updateTransaction(
  walletAddress: string,
  signature: string,
  transactionId: string,
  status: 'SUCCESS' | 'FAILED' | 'PENDING',
  error?: string
) {
  return authenticatedApiRequest('/api/transactions', walletAddress, signature, {
    method: 'PATCH',
    body: JSON.stringify({
      id: transactionId,
      status,
      error,
    }),
  })
}

export async function getUserTransactions(
  walletAddress: string,
  signature: string
) {
  return authenticatedApiRequest(
    `/api/transactions?fromWallet=${walletAddress}`,
    walletAddress,
    signature,
    { method: 'GET' }
  )
}

export interface Transaction {
  id: string
  tokenId: string
  type: 'CREATION' | 'TRANSFER' | 'MARKET_CREATION'
  fromWallet: string
  toWallet?: string
  amount?: bigint
  txSignature: string
  status: 'SUCCESS' | 'FAILED' | 'PENDING'
  error?: string
} 