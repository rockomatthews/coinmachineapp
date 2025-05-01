import { PublicKey, Connection } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAccount, getMint } from '@solana/spl-token';
import axios from 'axios';

/**
 * Fetch metadata for a token
 * @param {Connection} connection - Solana connection instance
 * @param {PublicKey} tokenAddress - Token mint address
 * @returns {Promise<Object>} Token metadata
 */
export async function getTokenMetadata(connection, tokenAddress) {
  try {
    // Validate connection
    if (!connection) {
      console.warn("Connection is undefined in getTokenMetadata");
      return {
        name: 'Unknown Token',
        symbol: tokenAddress.toString().substring(0, 6),
        logo: null,
        description: 'Connection unavailable',
        website: '',
        twitter: '',
        decimals: 9 // Default decimals
      };
    }
    
    // If tokenAddress is a string, convert to PublicKey
    if (typeof tokenAddress === 'string') {
      try {
        tokenAddress = new PublicKey(tokenAddress);
      } catch (e) {
        console.error("Invalid token address:", e);
        throw new Error("Invalid token address");
      }
    }
    
    // Find the metadata account address (PDA)
    const metaplexProgramId = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    const [metadataAddress] = await PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        metaplexProgramId.toBuffer(),
        tokenAddress.toBuffer()
      ],
      metaplexProgramId
    );

    // Try to get metadata from on-chain
    try {
      const accountInfo = await connection.getAccountInfo(metadataAddress);
      if (accountInfo) {
        // Metadata exists on-chain, but parsing it requires more complex logic
        // For simplicity, let's fetch from Solscan API for now
      }
    } catch (error) {
      console.warn('Failed to fetch on-chain metadata:', error);
    }

    // As a fallback, try to get metadata from Solscan API
    try {
      const response = await axios.get(`https://api.solscan.io/token/meta?token=${tokenAddress.toString()}`);
      if (response.data && response.data.success) {
        const data = response.data.data;
        return {
          name: data.name || 'Unknown Token',
          symbol: data.symbol || 'UNKNOWN',
          logo: data.icon || null,
          description: data.description || '',
          website: data.website || '',
          twitter: data.twitter || ''
        };
      }
    } catch (apiError) {
      console.warn('Failed to fetch metadata from API:', apiError);
    }

    // If all else fails, try to get basic information from the mint account
    try {
      // Safe guard against connection issues
      if (!connection) {
        throw new Error("Connection is not available");
      }
      
      const mintInfo = await getMint(connection, tokenAddress);
      return {
        name: 'Unknown Token',
        symbol: tokenAddress.toString().substring(0, 6),
        logo: null,
        description: '',
        website: '',
        twitter: '',
        decimals: mintInfo.decimals
      };
    } catch (mintError) {
      console.warn('Failed to fetch mint information:', mintError);
      
      // Return minimal data when all methods fail
      return {
        name: 'Unknown Token',
        symbol: tokenAddress.toString().substring(0, 6),
        logo: null,
        description: 'Unable to load token data',
        website: '',
        twitter: '',
        decimals: 9 // Default to 9 decimals
      };
    }
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    
    // Don't throw, return fallback data
    return {
      name: 'Unknown Token',
      symbol: 'UNKNOWN',
      logo: null,
      description: `Error: ${error.message}`,
      website: '',
      twitter: '',
      decimals: 9
    };
  }
}

/**
 * Fetch the total supply of a token
 * @param {Connection} connection - Solana connection instance
 * @param {PublicKey} tokenAddress - Token mint address
 * @returns {Promise<Object>} Token supply information
 */
export async function getTokenSupply(connection, tokenAddress) {
  try {
    // Validate connection
    if (!connection) {
      console.warn("Connection is undefined in getTokenSupply");
      return {
        amount: '0',
        decimals: 9, // Default decimals
        uiAmount: 0
      };
    }
    
    // If tokenAddress is a string, convert to PublicKey
    if (typeof tokenAddress === 'string') {
      try {
        tokenAddress = new PublicKey(tokenAddress);
      } catch (e) {
        console.error("Invalid token address in getTokenSupply:", e);
        throw new Error("Invalid token address");
      }
    }
    
    const mintInfo = await getMint(connection, tokenAddress);
    return {
      amount: mintInfo.supply.toString(),
      decimals: mintInfo.decimals,
      uiAmount: Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals)
    };
  } catch (error) {
    console.error('Error fetching token supply:', error);
    
    // Return default values instead of throwing
    return {
      amount: '0',
      decimals: 9,
      uiAmount: 0
    };
  }
}

/**
 * Fetch token balance for a specific wallet
 * @param {Connection} connection - Solana connection instance
 * @param {PublicKey} tokenAddress - Token mint address
 * @param {PublicKey} walletAddress - Wallet address to check balance for
 * @returns {Promise<Object>} Token balance information
 */
export async function getTokenBalance(connection, tokenAddress, walletAddress) {
  try {
    // Validate connection and addresses
    if (!connection) {
      console.warn("Connection is undefined in getTokenBalance");
      return {
        amount: '0',
        decimals: 9,
        uiAmount: 0
      };
    }
    
    // Convert string addresses to PublicKey if needed
    if (typeof tokenAddress === 'string') {
      try {
        tokenAddress = new PublicKey(tokenAddress);
      } catch (e) {
        console.error("Invalid token address in getTokenBalance:", e);
        return { amount: '0', decimals: 9, uiAmount: 0 };
      }
    }
    
    if (typeof walletAddress === 'string') {
      try {
        walletAddress = new PublicKey(walletAddress);
      } catch (e) {
        console.error("Invalid wallet address in getTokenBalance:", e);
        return { amount: '0', decimals: 9, uiAmount: 0 };
      }
    }
    
    // Find the associated token account for this wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletAddress,
      { mint: tokenAddress }
    );

    if (tokenAccounts.value.length === 0) {
      return {
        amount: '0',
        decimals: 9,
        uiAmount: 0
      };
    }

    // Return the balance of the first token account
    const tokenAccount = tokenAccounts.value[0];
    const parsedInfo = tokenAccount.account.data.parsed.info;
    
    return {
      amount: parsedInfo.tokenAmount.amount,
      decimals: parsedInfo.tokenAmount.decimals,
      uiAmount: parsedInfo.tokenAmount.uiAmount
    };
  } catch (error) {
    console.error('Error fetching token balance:', error);
    // Return zero balance if we can't fetch the actual balance
    return {
      amount: '0',
      decimals: 9,
      uiAmount: 0
    };
  }
}

/**
 * Generates bonding curve data for a token
 * @param {number} totalSupply - Current total supply of the token
 * @param {number} maxSupply - Maximum supply of the token
 * @param {number} initialPrice - Initial price of the token in SOL
 * @param {number} priceMultiplier - Price multiplier for the bonding curve
 * @param {number} points - Number of data points to generate
 * @returns {Array<Object>} Array of price and supply data points
 */
export function getTokenBondingCurveData(totalSupply, maxSupply, initialPrice, priceMultiplier = 2, points = 20) {
  try {
    // Default values if not provided
    totalSupply = totalSupply || 0;
    maxSupply = maxSupply || 100000000;
    initialPrice = initialPrice || 0.00001;
    
    const data = [];
    const step = maxSupply / points;
    
    for (let i = 0; i <= points; i++) {
      const supply = i * step;
      // Simple bonding curve formula: price = initialPrice * (1 + (supply / maxSupply) * priceMultiplier)
      const price = initialPrice * (1 + (supply / maxSupply) * priceMultiplier);
      
      data.push({
        supply,
        price,
        totalValue: supply * price
      });
    }
    
    // Add current supply point for reference
    if (totalSupply > 0) {
      const currentPrice = initialPrice * (1 + (totalSupply / maxSupply) * priceMultiplier);
      data.push({
        supply: totalSupply,
        price: currentPrice,
        totalValue: totalSupply * currentPrice,
        isCurrent: true
      });
      
      // Sort the data by supply to ensure proper chart rendering
      data.sort((a, b) => a.supply - b.supply);
    }
    
    return data;
  } catch (error) {
    console.error('Error generating bonding curve data:', error);
    return [];
  }
}

/**
 * Calculate bonding curve progress for a token using the Pump.fun formula
 * @param {number} totalSupply - Total supply of the token (usually 1,000,000,000)
 * @param {number} reservedTokens - Amount of tokens reserved by creator (not in bonding curve)
 * @param {number} poolBalance - Current balance of tokens in the pool
 * @returns {number} Bonding curve progress as a percentage (0-100)
 */
export function calculateBondingCurveProgress(totalSupply, reservedTokens, poolBalance) {
  try {
    // Validate inputs
    if (!totalSupply || totalSupply <= 0) return 0;
    if (reservedTokens === undefined || reservedTokens < 0) reservedTokens = 0;
    if (!poolBalance || poolBalance < 0) return 0;
    
    // Formula from Pump.fun:
    // BondingCurveProgress = 100 - ((leftTokens * 100) / initialRealTokenReserves)
    
    // Where:
    // leftTokens = realTokenReserves - reservedTokens
    // initialRealTokenReserves = totalSupply - reservedTokens
    
    const initialRealTokenReserves = totalSupply - reservedTokens;
    const leftTokens = poolBalance - reservedTokens;
    
    // Edge cases
    if (initialRealTokenReserves <= 0) return 0;
    if (leftTokens <= 0) return 100; // All tokens purchased
    
    // Calculate progress
    const progress = 100 - ((leftTokens * 100) / initialRealTokenReserves);
    
    // Ensure progress is between 0 and 100
    return Math.max(0, Math.min(100, progress));
  } catch (error) {
    console.error('Error calculating bonding curve progress:', error);
    return 0;
  }
} 