import { useCallback, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import * as api from '@/utils/api'

export function useApi() {
  const { publicKey, signMessage } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userTokens, setUserTokens] = useState<api.ApiResponse<api.Token[]> | null>(null)

  const signAndRequest = useCallback(
    async <T>(
      requestFn: (walletAddress: string, signature: string) => Promise<api.ApiResponse<T>>
    ) => {
      if (!publicKey || !signMessage) {
        setError('Wallet not connected')
        return { error: 'Wallet not connected' }
      }

      setLoading(true)
      setError(null)

      try {
        // Create a message to sign
        const message = new TextEncoder().encode(
          `Sign this message to authenticate with CoinMachine. Nonce: ${Date.now()}`
        )

        // Sign the message
        const signature = await signMessage(message)
        const signatureString = Buffer.from(signature).toString('base64')

        // Make the API request
        const response = await requestFn(publicKey.toString(), signatureString)

        if (response.error) {
          setError(response.error)
        }

        return response
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred'
        setError(errorMessage)
        return { error: errorMessage }
      } finally {
        setLoading(false)
      }
    },
    [publicKey, signMessage]
  )

  const createUser = useCallback(
    async (email?: string) => {
      if (!publicKey) {
        setError('Wallet not connected')
        return { error: 'Wallet not connected' }
      }

      return api.createUser(publicKey.toString(), email)
    },
    [publicKey]
  )

  const getUser = useCallback(
    async () => {
      if (!publicKey) {
        setError('Wallet not connected')
        return { error: 'Wallet not connected' }
      }

      return api.getUser(publicKey.toString())
    },
    [publicKey]
  )

  const createToken = useCallback(
    async (tokenData: Parameters<typeof api.createToken>[2]) => {
      return signAndRequest((walletAddress, signature) =>
        api.createToken(walletAddress, signature, tokenData)
      )
    },
    [signAndRequest]
  )

  const getToken = useCallback(api.getToken, [])

  const getUserTokens = useCallback(
    async () => {
      return signAndRequest(api.getUserTokens)
    },
    [signAndRequest]
  )

  const createTransaction = useCallback(
    async (transactionData: Parameters<typeof api.createTransaction>[2]) => {
      return signAndRequest((walletAddress, signature) =>
        api.createTransaction(walletAddress, signature, transactionData)
      )
    },
    [signAndRequest]
  )

  const updateTransaction = useCallback(
    async (
      transactionId: string,
      status: 'SUCCESS' | 'FAILED' | 'PENDING',
      error?: string
    ) => {
      return signAndRequest((walletAddress, signature) =>
        api.updateTransaction(walletAddress, signature, transactionId, status, error)
      )
    },
    [signAndRequest]
  )

  const getUserTransactions = useCallback(
    async () => {
      return signAndRequest(api.getUserTransactions)
    },
    [signAndRequest]
  )

  const fetchUserTokens = useCallback(async () => {
    if (!publicKey) return;
    try {
      setLoading(true);
      const response = await signAndRequest(api.getUserTokens) as api.ApiResponse<api.Token[]>;
      if (response && response.data) {
        setUserTokens(response);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch user tokens');
    } finally {
      setLoading(false);
    }
  }, [publicKey, signAndRequest, setLoading, setError, setUserTokens]);

  return {
    loading,
    error,
    createUser,
    getUser,
    createToken,
    getToken,
    getUserTokens,
    createTransaction,
    updateTransaction,
    getUserTransactions,
    fetchUserTokens,
    userTokens,
  }
} 