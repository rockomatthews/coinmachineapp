import { useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { useWallet } from '@solana/wallet-adapter-react'

interface Token {
  id: string
  name: string
  symbol: string
  description: string
  imageUrl: string
  totalSupply: bigint
  decimals: number
  metadataUri: string
}

interface NewToken {
  name: string
  symbol: string
  description: string
  imageUrl: string
  totalSupply: number
  decimals: number
}

export function TokenManager() {
  const { publicKey } = useWallet()
  const {
    loading,
    error,
    createToken,
    getUserTokens,
    createTransaction,
    updateTransaction,
  } = useApi()
  const [tokens, setTokens] = useState<Token[]>([])
  const [newToken, setNewToken] = useState<NewToken>({
    name: '',
    symbol: '',
    description: '',
    imageUrl: '',
    totalSupply: 0,
    decimals: 9,
  })

  const handleCreateToken = async () => {
    if (!publicKey) return

    const response = await createToken({
      mintAddress: publicKey.toString(), // This would be generated in a real implementation
      name: newToken.name,
      symbol: newToken.symbol,
      description: newToken.description,
      imageUrl: newToken.imageUrl,
      totalSupply: BigInt(newToken.totalSupply),
      decimals: newToken.decimals,
      metadataUri: '', // This would be set in a real implementation
    })

    if (response.data) {
      const token = response.data as Token
      // Token created successfully
      const transactionResponse = await createTransaction({
        tokenId: token.id,
        type: 'CREATION',
        fromWallet: publicKey.toString(),
        toWallet: publicKey.toString(),
        amount: BigInt(newToken.totalSupply),
        txSignature: 'pending', // This would be the actual transaction signature
      })

      if (transactionResponse.data) {
        const transaction = transactionResponse.data as { id: string }
        // Update transaction status after confirmation
        await updateTransaction(
          transaction.id,
          'SUCCESS'
        )
      }
    }
  }

  const handleGetUserTokens = async () => {
    const response = await getUserTokens()
    if (response.data) {
      setTokens(response.data as Token[])
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Token Manager</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Create New Token</h3>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Token Name"
            value={newToken.name}
            onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
            className="p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Symbol"
            value={newToken.symbol}
            onChange={(e) => setNewToken({ ...newToken, symbol: e.target.value })}
            className="p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Description"
            value={newToken.description}
            onChange={(e) => setNewToken({ ...newToken, description: e.target.value })}
            className="p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Image URL"
            value={newToken.imageUrl}
            onChange={(e) => setNewToken({ ...newToken, imageUrl: e.target.value })}
            className="p-2 border rounded"
          />
          <input
            type="number"
            placeholder="Total Supply"
            value={newToken.totalSupply}
            onChange={(e) => setNewToken({ ...newToken, totalSupply: Number(e.target.value) })}
            className="p-2 border rounded"
          />
          <input
            type="number"
            placeholder="Decimals"
            value={newToken.decimals}
            onChange={(e) => setNewToken({ ...newToken, decimals: Number(e.target.value) })}
            className="p-2 border rounded"
          />
        </div>
        <button
          onClick={handleCreateToken}
          disabled={loading}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Token'}
        </button>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-2">Your Tokens</h3>
        <button
          onClick={handleGetUserTokens}
          className="mb-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Refresh Tokens
        </button>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tokens.map((token) => (
            <div key={token.id} className="border p-4 rounded">
              <h4 className="font-bold">{token.name}</h4>
              <p className="text-gray-600">{token.symbol}</p>
              <p className="mt-2">{token.description}</p>
              <p className="text-sm text-gray-500">
                Supply: {token.totalSupply.toString()} (Decimals: {token.decimals})
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 