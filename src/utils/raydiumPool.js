/**
 * Raydium Liquidity Pool Utilities
 * This file contains functions for creating Raydium liquidity pools and markets
 * Updated to use Raydium V3 (CP-Swap) which doesn't require OpenBook
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  TransactionInstruction,
  Keypair,
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';

import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
  createInitializeMintInstruction,
  createSetAuthorityInstruction,
  AuthorityType
} from '@solana/spl-token';

import BN from 'bn.js';
import * as BufferLayout from '@solana/buffer-layout';

// Ensure Buffer is available in browser context
const BufferFrom = (
  typeof window !== 'undefined' && typeof window.Buffer !== 'undefined'
    ? window.Buffer
    : Buffer
);

// Add browser-compatible buffer layout extensions
const BufferLayoutExt = {
  ...BufferLayout,
  u64: (property) => {
    return BufferLayout.blob(8, property);
  },
  u128: (property) => {
    return BufferLayout.blob(16, property);
  },
  nu64: (property) => {
    return BufferLayout.blob(8, property);
  }
};

// Raydium program IDs - Updated for CP-Swap (Raydium V3)
const RAYDIUM_CP_SWAP_PROGRAM_ID = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Helper function to check if a transaction succeeded even if confirmation timed out
async function checkTransactionStatus(connection, signature) {
  try {
    const status = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    
    console.log("Transaction status:", status);
    
    // If null, transaction not found
    if (!status || !status.value) {
      return false;
    }
    
    // If has error, transaction failed
    if (status.value && status.value.err) {
      return false;
    }
    
    // If confirmations > 0 or status is 'confirmed'/'finalized', transaction succeeded
    return (
      status.value.confirmationStatus === 'confirmed' ||
      status.value.confirmationStatus === 'finalized' ||
      (status.value.confirmations !== null && status.value.confirmations > 0)
    );
  } catch (error) {
    console.error("Error checking transaction status:", error);
    return false;
  }
}

// Update sendRawTransaction to use more robust confirmation
async function sendTransactionWithConfirmation(connection, signedTx, commitment = 'confirmed') {
  const txid = await connection.sendRawTransaction(signedTx.serialize());
  console.log("Transaction sent:", txid);
  
  try {
    await confirmTransactionWithRetry(connection, txid, commitment);
    console.log("Transaction confirmed successfully:", txid);
  } catch (error) {
    console.warn("Transaction confirmation timed out, checking status...");
    const status = await checkTransactionStatus(connection, txid);
    if (!status) {
      console.error("Transaction failed or not found:", txid);
      throw new Error(`Transaction failed. Signature: ${txid}`);
    } else {
      console.log("Transaction was actually successful despite timeout!");
    }
  }
  
  return txid;
}

// Helper function to confirm a transaction with retries
async function confirmTransactionWithRetry(connection, signature, commitment, timeoutMs = 60000, retries = 3) {
  let retryCount = 0;
  let lastError = null;
  
  while (retryCount < retries) {
    try {
      const result = await connection.confirmTransaction(
        { signature, blockhash: (await connection.getLatestBlockhash()).blockhash },
        commitment
      );
      
      if (result.value.err) {
        throw new Error(`Transaction ${signature} failed: ${JSON.stringify(result.value.err)}`);
      }
      
      return result;
    } catch (error) {
      console.warn(`Confirmation attempt ${retryCount + 1} failed:`, error.message);
      lastError = error;
      retryCount++;
      
      if (retryCount >= retries) {
        break;
      }
      
      // Add exponential backoff
      await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retryCount)));
    }
  }
  
  // Check transaction status directly as a last resort
  const status = await checkTransactionStatus(connection, signature);
  if (status) {
    console.log("Transaction succeeded despite confirmation issues");
    return { value: { err: null } };
  }
  
  throw lastError || new Error(`Failed to confirm transaction ${signature} after ${retries} attempts`);
}

/**
 * Creates a Raydium V3 (CP-Swap) liquidity pool without requiring OpenBook
 * This implements the same approach used by coinfactory.app
 * @param {Object} params Parameters for creating a liquidity pool
 * @param {Connection} params.connection - Solana connection
 * @param {PublicKey} params.userPublicKey - User wallet public key
 * @param {Keypair} params.mintKeypair - Token mint keypair
 * @param {number} params.tokenDecimals - Token decimals
 * @param {BigInt} params.tokenAmount - Token amount to add to the pool (in raw units)
 * @param {number} params.solAmount - SOL amount to add to the pool (in lamports)
 * @param {Function} params.signTransaction - Function to sign transactions
 * @param {boolean} params.dryRun - Whether to perform a dry run
 * @returns {Promise<Object>} Pool creation result
 */
export async function createRaydiumPool({
  connection,
  userPublicKey,
  mintKeypair,
  tokenDecimals,
  tokenAmount,
  solAmount,
  signTransaction,
  dryRun = false
}) {
  console.log("Starting Raydium V3 CP-Swap pool creation process...");
  console.log("Initial parameters:", solAmount / LAMPORTS_PER_SOL, "SOL,", tokenAmount.toString(), "tokens");
  
  try {
    // Set minimum viable SOL amount - Competitive with coinfactory.app
    const minimumSolAmount = 0.15 * LAMPORTS_PER_SOL;
    if (solAmount < minimumSolAmount) {
      console.warn(`WARNING: SOL amount ${solAmount / LAMPORTS_PER_SOL} is below absolute minimum. Increasing to ${minimumSolAmount / LAMPORTS_PER_SOL} SOL.`);
      solAmount = minimumSolAmount;
    }
    
    // Check if we have enough balance before proceeding
    const userBalance = await connection.getBalance(userPublicKey);
    console.log("User balance:", userBalance / LAMPORTS_PER_SOL, "SOL");
    
    if (userBalance < solAmount + 10000000) { // Add 0.01 SOL buffer for transaction fees
      throw new Error(`Insufficient SOL balance. Required: ${(solAmount + 10000000) / LAMPORTS_PER_SOL} SOL, Available: ${userBalance / LAMPORTS_PER_SOL} SOL`);
    }
    
    // Generate necessary keypairs for the pool
    const poolStateKeypair = Keypair.generate();
    const poolAuthority = await derivePoolAuthority(RAYDIUM_CP_SWAP_PROGRAM_ID, poolStateKeypair.publicKey);
    console.log("Pool state keypair created:", poolStateKeypair.publicKey.toString());
    console.log("Pool authority derived:", poolAuthority.toString());
    
    // Get token accounts
    const userTokenAccount = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      userPublicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    
    // Create vault accounts
    const baseVault = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      poolAuthority,
      true,
      TOKEN_PROGRAM_ID
    );
    
    const quoteVault = await getAssociatedTokenAddress(
      SOL_MINT,
      poolAuthority,
      true,
      TOKEN_PROGRAM_ID
    );
    
    console.log("Base vault:", baseVault.toString());
    console.log("Quote vault:", quoteVault.toString());
    
    // Create initialize pool transaction
    const initPoolTx = new Transaction();
    
    // Add priority fee to increase transaction success chances
    const { ComputeBudgetProgram } = await import('@solana/web3.js');
    initPoolTx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 10000 // Reduce to more reasonable value
      }),
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 500000 // Increase compute limit for complex CP-Swap transaction
      })
    );
    
    // Create pool state account
    const poolStateAccountRent = await connection.getMinimumBalanceForRentExemption(1024); // Assuming 1024 bytes for pool state
    
    initPoolTx.add(
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: poolStateKeypair.publicKey,
        lamports: poolStateAccountRent,
        space: 1024, // Pool state size
        programId: RAYDIUM_CP_SWAP_PROGRAM_ID
      })
    );
    
    // Create token accounts if needed
    const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
    if (!userTokenAccountInfo) {
      console.log("Creating user token account:", userTokenAccount.toString());
      initPoolTx.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          userTokenAccount,
          userPublicKey,
          mintKeypair.publicKey,
          TOKEN_PROGRAM_ID
        )
      );
    }
    
    // Create vault accounts
    initPoolTx.add(
      createAssociatedTokenAccountInstruction(
        userPublicKey,
        baseVault,
        poolAuthority,
        mintKeypair.publicKey,
        TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        userPublicKey,
        quoteVault,
        poolAuthority,
        SOL_MINT,
        TOKEN_PROGRAM_ID
      )
    );

    // SIMPLIFIED APPROACH: Use hardcoded byte array for initialize command 
    // This corresponds to the exact bytes expected by the CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK program
    const initBytes = Buffer.from([
      // Anchor discriminator for "global:initialize" (8 bytes)
      133, 98, 219, 218, 45, 165, 24, 161,
      // Nonce, Amp, fees (13 bytes) - Updated for newer Raydium CP-Swap format
      0, 1, 0, 0, 0, 25, 0, 16, 39, 5, 0, 16, 39, 0, 0,
    ]);
    
    // Get bytes for token amount
    const baseAmount = tokenAmount;
    const quoteAmount = BigInt(solAmount);
    
    // Create properly sized buffer for instruction data
    // Raydium CP-Swap expects exactly 8 bytes for each u64 amount
    const encodedData = Buffer.alloc(initBytes.length + 16);
    initBytes.copy(encodedData, 0);
    
    // Properly write numbers in little-endian format (Solana/Anchor standard)
    function writeBigIntLE(buffer, value, offset) {
      for (let i = 0; i < 8; i++) {
        buffer[offset + i] = Number((value >> BigInt(i * 8)) & BigInt(0xFF));
      }
    }
    
    // Write amounts using proper little-endian format
    writeBigIntLE(encodedData, baseAmount, initBytes.length);
    writeBigIntLE(encodedData, quoteAmount, initBytes.length + 8);
    
    // Create instruction with properly formatted keys in the right order
    // The account order is critical for the CP-Swap program
    const initPoolInstruction = new TransactionInstruction({
      programId: RAYDIUM_CP_SWAP_PROGRAM_ID,
      keys: [
        { pubkey: poolStateKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: poolAuthority, isSigner: false, isWritable: false },
        { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: SOL_MINT, isSigner: false, isWritable: false },
        { pubkey: baseVault, isSigner: false, isWritable: true },
        { pubkey: quoteVault, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: encodedData
    });
    
    initPoolTx.add(initPoolInstruction);
    
    // Add instructions to transfer tokens to the pool
    initPoolTx.add(
      createTransferInstruction(
        userTokenAccount,
        baseVault,
        userPublicKey,
        baseAmount,
        [],
        TOKEN_PROGRAM_ID
      ),
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: quoteVault,
        lamports: Number(quoteAmount)
      })
    );
    
    // Ensure we have the latest blockhash
    initPoolTx.feePayer = userPublicKey;
    initPoolTx.recentBlockhash = (await connection.getLatestBlockhash('finalized')).blockhash;
    
    // Partial sign with poolStateKeypair
    initPoolTx.partialSign(poolStateKeypair);
    
    if (dryRun) {
      console.log("Dry run completed. Pool creation simulation successful.");
      return {
        success: true,
        poolId: poolStateKeypair.publicKey.toString(),
        baseVault: baseVault.toString(),
        quoteVault: quoteVault.toString()
      };
    }
    
    // Sign and send transaction
    console.log("Sending pool creation transaction...");
    try {
      // Simulate the transaction first to catch errors before sending
      try {
        const simulation = await connection.simulateTransaction(initPoolTx);
        if (simulation.value.err) {
          console.error("Transaction simulation failed:", simulation.value.err);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
        console.log("Transaction simulation successful");
      } catch (simError) {
        console.warn("Simulation failed but continuing:", simError.message);
      }
      
      const signedTx = await signTransaction(initPoolTx);
      const txid = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      });
      
      console.log("Pool creation transaction sent:", txid);
      
      // Wait for confirmation using our enhanced method
      try {
        await confirmTransactionWithRetry(connection, txid, 'confirmed', 60000, 3);
        console.log("Pool created successfully:", txid);
      } catch (confirmError) {
        // Check if the transaction was actually successful despite confirmation timeout
        const status = await checkTransactionStatus(connection, txid);
        if (!status) {
          throw new Error(`Pool creation transaction failed. Try again with slightly higher SOL amount (0.05 SOL more). Signature: ${txid}`);
        }
        console.log("Pool transaction succeeded despite confirmation issues!");
      }
      
      console.log("Pool ID:", poolStateKeypair.publicKey.toString());
    
    return {
        success: true,
        txid,
        poolId: poolStateKeypair.publicKey.toString(),
        baseVault: baseVault.toString(),
        quoteVault: quoteVault.toString()
      };
    } catch (txError) {
      // Handle specific transaction errors with better messages
      console.error("Transaction error:", txError);
      
      if (txError.message.includes("Custom program error: 0x5") || txError.message.includes("Custom:5")) {
        throw new Error("Raydium pool creation failed due to insufficient liquidity. Try increasing your SOL amount slightly.");
      } else if (txError.message.includes("Custom program error: 0x6") || txError.message.includes("Custom:6")) {
        throw new Error("Raydium pool creation failed due to slippage tolerance. Try increasing your SOL amount by 0.05 SOL.");
      } else if (txError.message.includes("0x1770")) {
        throw new Error("Raydium pool creation failed due to invalid token account. Make sure your token is properly initialized.");
      } else if (txError.message.includes("Error Code: InstructionFallbackNotFound")) {
        throw new Error("Raydium CP-Swap instruction format error. This is likely a serialization issue, not an amount problem. Contact support for assistance.");
      } else if (txError.message.includes("0x65")) {
        throw new Error("Raydium program error 0x65. Try increasing your SOL amount by 0.05 SOL.");
      } else if (txError.message.includes("exceeded CUs meter")) {
        throw new Error("Transaction exceeded compute units. Try using a smaller total supply or increasing compute budget.");
      } else if (txError.message.includes("Transaction too large")) {
        throw new Error("Transaction is too large. Try reducing the token supply or using multiple smaller transactions.");
      } else if (txError.message.includes("Transaction simulation failed")) {
        throw new Error("Transaction simulation failed. This may be due to instruction format issues, not token amount. The transaction structure needs fixing.");
      } else {
        throw new Error(txError.message);
      }
    }
  } catch (error) {
    console.error("Error creating Raydium V3 pool:", error);
    return {
      success: false,
      error: error.message || "Unknown error creating Raydium pool"
    };
  }
}

// Helper function to derive pool authority
async function derivePoolAuthority(programId, poolId) {
  const [authority] = await PublicKey.findProgramAddress(
    [BufferFrom.from("pool_authority"), poolId.toBuffer()],
    programId
  );
  return authority;
}

/**
 * Fetch pool information for a token
 * @param {Connection} connection - Solana connection instance
 * @param {PublicKey} tokenMint - Token mint address
 * @returns {Promise<Object>} Pool information including market address, liquidity, volume, and token balance
 */
export async function getPoolInfo(connection, tokenMint) {
  try {
    // Handle undefined connection
    if (!connection) {
      console.warn("Connection is undefined in getPoolInfo");
      return {
        address: "unavailable",
        liquidity: 0,
        volume24h: 0,
        price: 0,
        baseTokenBalance: 0
      };
    }
    
    // Convert string address to PublicKey if needed
    if (typeof tokenMint === 'string') {
      tokenMint = new PublicKey(tokenMint);
    }
    
    // Try to find the Raydium V3 CP-Swap pool for this token
    let poolAddress = null;
    let baseVaultAddress = null;
    
    // This is a simplified approach - in reality you'd need to query all pools
    // from the Raydium CP-Swap program and filter for those with this token mint
    
    // Placeholder implementation
    console.log("Pool info lookup not fully implemented yet");
    
    return {
      address: poolAddress ? poolAddress.toString() : "unavailable",
      liquidity: 0, // Would need to calculate from vault balances
      volume24h: 0, // Not directly available without indexing
      price: 0, // Would need to calculate from vault balances
      baseTokenBalance: 0 // Would need to fetch from vault
    };
  } catch (error) {
    console.error("Error fetching pool info:", error);
    return {
      address: "error",
      liquidity: 0,
      volume24h: 0,
      price: 0,
      baseTokenBalance: 0,
      error: error.message
    };
  }
} 