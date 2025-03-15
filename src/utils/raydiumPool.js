/**
 * Raydium Liquidity Pool Utilities
 * This file contains functions for creating Raydium liquidity pools and markets
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  TransactionInstruction,
  Keypair,
  sendAndConfirmTransaction
} from '@solana/web3.js';

import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
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

// Raydium program IDs
const RAYDIUM_LIQUIDITY_PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
const SERUM_PROGRAM_ID = new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');

// Constants
const OPENBOOK_PROGRAM_ID = new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Add a helper function for BN conversion to buffer for browser compatibility
function bnToBuffer(bn, byteLength, endian = 'le') {
  const a = bn.toArray(endian, byteLength);
  const b = BufferFrom.from(a);
  if (b.length !== byteLength) {
    const zeroPad = BufferFrom.alloc(byteLength);
    b.copy(zeroPad);
    return zeroPad;
  }
  return b;
}

// Helper function to confirm transaction with retries
async function confirmTransactionWithRetry(connection, signature, commitment, timeoutMs = 60000, retries = 3) {
  let retryCount = 0;
  
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
      retryCount++;
      
      if (retryCount >= retries) {
        throw error;
      }
      
      // Add exponential backoff
      await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retryCount)));
    }
  }
}

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

/**
 * Creates a Raydium liquidity pool for a token with SOL pair
 * @param {Object} params Parameters for creating a liquidity pool
 * @param {Connection} params.connection - Solana connection
 * @param {PublicKey} params.userPublicKey - User wallet public key
 * @param {Keypair} params.mintKeypair - Token mint keypair
 * @param {number} params.tokenDecimals - Token decimals
 * @param {BigInt} params.tokenAmount - Token amount to add to the pool (in raw units)
 * @param {number} params.solAmount - SOL amount to add to the pool (in lamports)
 * @param {Function} params.signTransaction - Function to sign transactions
 * @returns {Promise<Object>} Pool creation result
 */
export async function createRaydiumPool({
  connection,
  userPublicKey,
  mintKeypair,
  tokenDecimals,
  tokenAmount,
  solAmount,
  signTransaction
}) {
  console.log('Starting Raydium pool creation process...');
  
  try {
    // Step 1: Create a market on OpenBook DEX
    console.log('Step 1: Creating OpenBook market...');
    const marketResult = await createOpenBookMarket({
      connection,
      userPublicKey,
      mintKeypair,
      tokenDecimals,
      signTransaction
    });
    
    console.log('OpenBook market created:', marketResult.marketId.toString());
    
    // Step 2: Create Raydium AMM accounts
    console.log('Step 2: Creating Raydium AMM accounts...');
    const ammResult = await createRaydiumAmmAccounts({
      connection,
      userPublicKey,
      mintKeypair,
      marketId: marketResult.marketId,
      signTransaction
    });
    
    console.log('Raydium AMM accounts created:', ammResult.ammId.toString());
    
    // Step 3: Initialize the AMM with liquidity
    console.log('Step 3: Initializing AMM with liquidity...');
    const initResult = await initializeRaydiumAmm({
      connection,
      userPublicKey,
      userTokenAccount: marketResult.userTokenAccount,
      marketId: marketResult.marketId,
      ammId: ammResult.ammId,
      lpMint: ammResult.lpMint,
      ammAuthority: ammResult.ammAuthority,
      ammOpenOrders: ammResult.ammOpenOrders,
      ammTargetOrders: ammResult.ammTargetOrders,
      lpVault: ammResult.lpVault,
      ammBaseVault: ammResult.ammBaseVault,
      ammQuoteVault: ammResult.ammQuoteVault,
      userLpTokenAccount: ammResult.userLpTokenAccount,
      tokenAmount,
      solAmount,
      nonce: ammResult.nonce,
      signTransaction
    });
    
    console.log('AMM initialized with liquidity!');
    
    return {
      success: true,
      marketId: marketResult.marketId,
      ammId: ammResult.ammId,
      lpMint: ammResult.lpMint,
      userLpTokenAccount: ammResult.userLpTokenAccount,
      tokenAmount,
      solAmount
    };
  } catch (error) {
    console.error('Error creating Raydium pool:', error);
    throw error;
  }
}

// Properly define the Market object with static methods for browser compatibility
const Market = {
  getLayout: (programId) => {
    // Return a reasonable size for market state
    return { span: 5000 };
  },
  
  // Define makeCreateMarketInstruction as a static method
  makeCreateMarketInstruction: (
    programId,
    marketPublicKey,
    requestQueue,
    eventQueue,
    bids,
    asks,
    baseVault,
    quoteVault,
    authority,
    baseMint,
    quoteMint,
    baseLotSize,
    quoteLotSize,
    feeRateBps,
    vaultSignerNonce,
    quoteDustThreshold
  ) => {
    // Create instruction manually
    const dataLayout = BufferLayout.struct([
      BufferLayout.u8('version'),
      BufferLayout.u8('instruction'),
      BufferLayoutExt.u64('baseLotSize'),
      BufferLayoutExt.u64('quoteLotSize'),
      BufferLayout.u16('feeRateBps'),
      BufferLayoutExt.u64('vaultSignerNonce'),
      BufferLayoutExt.u64('quoteDustThreshold'),
    ]);
    
    const data = BufferFrom.alloc(dataLayout.span);
    dataLayout.encode(
      {
        version: 0,
        instruction: 0, // Initialize market
        baseLotSize: bnToBuffer(baseLotSize, 8),
        quoteLotSize: bnToBuffer(quoteLotSize, 8),
        feeRateBps,
        vaultSignerNonce: bnToBuffer(new BN(vaultSignerNonce), 8),
        quoteDustThreshold: bnToBuffer(new BN(quoteDustThreshold || 0), 8),
      },
      data
    );
    
    return new TransactionInstruction({
      keys: [
        { pubkey: marketPublicKey, isSigner: false, isWritable: true },
        { pubkey: requestQueue, isSigner: false, isWritable: true },
        { pubkey: eventQueue, isSigner: false, isWritable: true },
        { pubkey: bids, isSigner: false, isWritable: true },
        { pubkey: asks, isSigner: false, isWritable: true },
        { pubkey: baseVault, isSigner: false, isWritable: true },
        { pubkey: quoteVault, isSigner: false, isWritable: true },
        { pubkey: baseMint, isSigner: false, isWritable: false },
        { pubkey: quoteMint, isSigner: false, isWritable: false },
        { pubkey: authority, isSigner: false, isWritable: false },
      ],
      programId,
      data,
    });
  }
};

/**
 * Creates an OpenBook market for a token with SOL pair
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} Market creation result
 */
async function createOpenBookMarket({
  connection,
  userPublicKey,
  mintKeypair,
  tokenDecimals,
  signTransaction
}) {
  try {
    // We're using our predefined Market object instead of trying to import
    // This avoids issues with Node.js modules in the browser
    console.log("Using predefined Market implementation");
    
    // Generate keypairs for market accounts
    const marketKeypair = Keypair.generate();
    const requestQueueKeypair = Keypair.generate();
    const eventQueueKeypair = Keypair.generate();
    const bidsKeypair = Keypair.generate();
    const asksKeypair = Keypair.generate();
    const baseVaultKeypair = Keypair.generate();
    const quoteVaultKeypair = Keypair.generate();
    
    // Calculate account sizes
    const MARKET_STATE_LAYOUT_V2_SIZE = Market.getLayout(OPENBOOK_PROGRAM_ID).span;
    
    // Calculate minimum balances for rent exemption
    const marketRent = await connection.getMinimumBalanceForRentExemption(MARKET_STATE_LAYOUT_V2_SIZE);
    const requestQueueRent = await connection.getMinimumBalanceForRentExemption(5120 + 12);
    const eventQueueRent = await connection.getMinimumBalanceForRentExemption(262144 + 12);
    const bidsRent = await connection.getMinimumBalanceForRentExemption(65536 + 12);
    const asksRent = await connection.getMinimumBalanceForRentExemption(65536 + 12);
    const baseVaultRent = await connection.getMinimumBalanceForRentExemption(165);
    const quoteVaultRent = await connection.getMinimumBalanceForRentExemption(165);
    
    // Set market parameters
    const baseLotSize = new BN(10).pow(new BN(tokenDecimals - 4)); // Adjust based on token decimals
    const quoteLotSize = new BN(10).pow(new BN(6)); // SOL has 9 decimals, but we use 10^6 for precision
    const feeRateBps = 0; // No fees for new pool
    
    // SPLIT TRANSACTIONS - Transaction 1: Create market account and request queue
    console.log("Creating market account and request queue...");
    const marketTx1 = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: marketKeypair.publicKey,
        lamports: marketRent,
        space: MARKET_STATE_LAYOUT_V2_SIZE,
        programId: OPENBOOK_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: requestQueueKeypair.publicKey,
        lamports: requestQueueRent,
        space: 5120 + 12,
        programId: OPENBOOK_PROGRAM_ID,
      })
    );
    
    marketTx1.feePayer = userPublicKey;
    marketTx1.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    marketTx1.partialSign(marketKeypair, requestQueueKeypair);
    
    // Send transaction 1
    const signedTx1 = await signTransaction(marketTx1);
    const txid1 = await sendTransactionWithConfirmation(connection, signedTx1);
    console.log("Created market account and request queue:", txid1);
    
    // SPLIT TRANSACTIONS - Transaction 2: Create event queue and order books
    console.log("Creating event queue and order books...");
    const marketTx2 = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: eventQueueKeypair.publicKey,
        lamports: eventQueueRent,
        space: 262144 + 12,
        programId: OPENBOOK_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: bidsKeypair.publicKey,
        lamports: bidsRent,
        space: 65536 + 12,
        programId: OPENBOOK_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: asksKeypair.publicKey,
        lamports: asksRent,
        space: 65536 + 12,
        programId: OPENBOOK_PROGRAM_ID,
      })
    );
    
    marketTx2.feePayer = userPublicKey;
    marketTx2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    marketTx2.partialSign(eventQueueKeypair, bidsKeypair, asksKeypair);
    
    // Send transaction 2
    const signedTx2 = await signTransaction(marketTx2);
    const txid2 = await sendTransactionWithConfirmation(connection, signedTx2);
    console.log("Created event queue and order books:", txid2);
    
    // SPLIT TRANSACTIONS - Transaction 3: Create token vaults
    console.log("Creating token vaults...");
    const marketTx3 = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: baseVaultKeypair.publicKey,
        lamports: baseVaultRent,
        space: 165,
        programId: TOKEN_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: quoteVaultKeypair.publicKey,
        lamports: quoteVaultRent,
        space: 165,
        programId: TOKEN_PROGRAM_ID,
      })
    );
    
    marketTx3.feePayer = userPublicKey;
    marketTx3.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    marketTx3.partialSign(baseVaultKeypair, quoteVaultKeypair);
    
    // Send transaction 3
    const signedTx3 = await signTransaction(marketTx3);
    const txid3 = await sendTransactionWithConfirmation(connection, signedTx3);
    console.log("Created token vaults:", txid3);
    
    // Get the user's token account (for the new token)
    const userTokenAccount = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      userPublicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    
    // SPLIT TRANSACTIONS - Transaction 4: Initialize the market
    console.log("Initializing market...");
    const marketInitInstruction = Market.makeCreateMarketInstruction(
      OPENBOOK_PROGRAM_ID,
      marketKeypair.publicKey,
      requestQueueKeypair.publicKey,
      eventQueueKeypair.publicKey,
      bidsKeypair.publicKey,
      asksKeypair.publicKey,
      baseVaultKeypair.publicKey,
      quoteVaultKeypair.publicKey,
      userPublicKey, // market authority
      mintKeypair.publicKey, // base mint
      SOL_MINT, // quote mint
      baseLotSize, // base lot size
      quoteLotSize, // quote lot size
      feeRateBps, // fee rate basis points
      0, // vault signer nonce
      tokenDecimals // base decimals
    );
    
    const marketTx4 = new Transaction().add(marketInitInstruction);
    
    marketTx4.feePayer = userPublicKey;
    marketTx4.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Send transaction 4
    const signedTx4 = await signTransaction(marketTx4);
    const txid4 = await sendTransactionWithConfirmation(connection, signedTx4);
    console.log("Market initialization complete:", txid4);
    
    return {
      marketId: marketKeypair.publicKey,
      baseVault: baseVaultKeypair.publicKey,
      quoteVault: quoteVaultKeypair.publicKey,
      bids: bidsKeypair.publicKey,
      asks: asksKeypair.publicKey,
      requestQueue: requestQueueKeypair.publicKey,
      eventQueue: eventQueueKeypair.publicKey,
      userTokenAccount
    };
  } catch (error) {
    console.error('Error creating OpenBook market:', error);
    throw error;
  }
}

/**
 * Creates Raydium AMM accounts for a token pair
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} AMM accounts
 */
async function createRaydiumAmmAccounts({
  connection,
  userPublicKey,
  mintKeypair,
  marketId,
  signTransaction
}) {
  try {
    // Generate AMM keypairs
    const ammIdKeypair = Keypair.generate();
    const ammAuthority = await PublicKey.findProgramAddress(
      [marketId.toBuffer()],
      RAYDIUM_LIQUIDITY_PROGRAM_ID
    );
    const ammOpenOrdersKeypair = Keypair.generate();
    const lpMintKeypair = Keypair.generate();
    const ammTargetOrdersKeypair = Keypair.generate();
    const ammBaseVaultKeypair = Keypair.generate();
    const ammQuoteVaultKeypair = Keypair.generate();
    const lpVaultKeypair = Keypair.generate();
    
    // Calculate account sizes and rent
    const ammIdRent = await connection.getMinimumBalanceForRentExemption(752);
    const ammOpenOrdersRent = await connection.getMinimumBalanceForRentExemption(5000);
    const lpMintRent = await connection.getMinimumBalanceForRentExemption(82);
    const ammTargetOrdersRent = await connection.getMinimumBalanceForRentExemption(5000);
    const vaultRent = await connection.getMinimumBalanceForRentExemption(165);
    
    // SPLIT TRANSACTIONS - Transaction 1: Create first set of AMM accounts
    console.log("Creating AMM accounts (part 1)...");
    const ammTx1 = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: ammIdKeypair.publicKey,
        lamports: ammIdRent,
        space: 752,
        programId: RAYDIUM_LIQUIDITY_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: ammOpenOrdersKeypair.publicKey,
        lamports: ammOpenOrdersRent,
        space: 5000,
        programId: OPENBOOK_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: lpMintKeypair.publicKey,
        lamports: lpMintRent,
        space: 82,
        programId: TOKEN_PROGRAM_ID,
      })
    );
    
    ammTx1.feePayer = userPublicKey;
    ammTx1.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    ammTx1.partialSign(ammIdKeypair, ammOpenOrdersKeypair, lpMintKeypair);
    
    // Send transaction 1
    const signedAmmTx1 = await signTransaction(ammTx1);
    const ammTxid1 = await sendTransactionWithConfirmation(connection, signedAmmTx1);
    console.log("Created AMM accounts (part 1):", ammTxid1);
    
    // SPLIT TRANSACTIONS - Transaction 2: Create second set of AMM accounts
    console.log("Creating AMM accounts (part 2)...");
    const ammTx2 = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: ammTargetOrdersKeypair.publicKey,
        lamports: ammTargetOrdersRent,
        space: 5000,
        programId: OPENBOOK_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: ammBaseVaultKeypair.publicKey,
        lamports: vaultRent,
        space: 165,
        programId: TOKEN_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: ammQuoteVaultKeypair.publicKey,
        lamports: vaultRent,
        space: 165,
        programId: TOKEN_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: lpVaultKeypair.publicKey,
        lamports: vaultRent,
        space: 165,
        programId: TOKEN_PROGRAM_ID,
      })
    );
    
    ammTx2.feePayer = userPublicKey;
    ammTx2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    ammTx2.partialSign(ammTargetOrdersKeypair, ammBaseVaultKeypair, ammQuoteVaultKeypair, lpVaultKeypair);
    
    // Send transaction 2
    const signedAmmTx2 = await signTransaction(ammTx2);
    const ammTxid2 = await sendTransactionWithConfirmation(connection, signedAmmTx2);
    console.log("Created AMM accounts (part 2):", ammTxid2);
    
    // SPLIT TRANSACTIONS - Transaction 3: Initialize token mints and accounts
    console.log("Initializing LP tokens and token accounts...");
    
    // Get instructions for creating and initializing token accounts
    const tokenMintInstruction = await import('@solana/spl-token').then(({ createInitMintInstruction }) => {
      return createInitMintInstruction(
        TOKEN_PROGRAM_ID,
        lpMintKeypair.publicKey,
        9, // LP token decimals
        ammAuthority[0],
        null
      );
    });
    
    const { createInitAccountInstruction } = await import('@solana/spl-token');
    
    const ammTx3 = new Transaction().add(
      tokenMintInstruction,
      createInitAccountInstruction(
        TOKEN_PROGRAM_ID,
        mintKeypair.publicKey,
        ammBaseVaultKeypair.publicKey,
        ammAuthority[0]
      ),
      createInitAccountInstruction(
        TOKEN_PROGRAM_ID,
        SOL_MINT,
        ammQuoteVaultKeypair.publicKey,
        ammAuthority[0]
      ),
      createInitAccountInstruction(
        TOKEN_PROGRAM_ID,
        lpMintKeypair.publicKey,
        lpVaultKeypair.publicKey,
        ammAuthority[0]
      )
    );
    
    ammTx3.feePayer = userPublicKey;
    ammTx3.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Send transaction 3
    const signedAmmTx3 = await signTransaction(ammTx3);
    const ammTxid3 = await sendTransactionWithConfirmation(connection, signedAmmTx3);
    console.log("Initialized LP tokens and token accounts:", ammTxid3);
    
    // SPLIT TRANSACTIONS - Transaction 4: Create user's LP token account
    console.log("Creating user's LP token account...");
    
    // Create user's LP token account
    const userLpTokenAccount = await getAssociatedTokenAddress(
      lpMintKeypair.publicKey,
      userPublicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    
    const ammTx4 = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        userPublicKey,
        userLpTokenAccount,
        userPublicKey,
        lpMintKeypair.publicKey,
        TOKEN_PROGRAM_ID
      )
    );
    
    ammTx4.feePayer = userPublicKey;
    ammTx4.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Send transaction 4
    const signedAmmTx4 = await signTransaction(ammTx4);
    const ammTxid4 = await sendTransactionWithConfirmation(connection, signedAmmTx4);
    console.log("Created user's LP token account:", ammTxid4);
    
    return {
      ammId: ammIdKeypair.publicKey,
      ammAuthority: ammAuthority[0],
      nonce: ammAuthority[1],
      ammOpenOrders: ammOpenOrdersKeypair.publicKey,
      lpMint: lpMintKeypair.publicKey,
      ammTargetOrders: ammTargetOrdersKeypair.publicKey,
      ammBaseVault: ammBaseVaultKeypair.publicKey,
      ammQuoteVault: ammQuoteVaultKeypair.publicKey,
      lpVault: lpVaultKeypair.publicKey,
      userLpTokenAccount
    };
  } catch (error) {
    console.error('Error creating Raydium AMM accounts:', error);
    throw error;
  }
}

/**
 * Initializes a Raydium AMM with liquidity
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} Initialization result
 */
async function initializeRaydiumAmm({
  connection,
  userPublicKey,
  userTokenAccount,
  marketId,
  ammId,
  lpMint,
  ammAuthority,
  ammOpenOrders,
  ammTargetOrders,
  lpVault,
  ammBaseVault,
  ammQuoteVault,
  userLpTokenAccount,
  tokenAmount,
  solAmount,
  nonce,
  signTransaction
}) {
  try {
    // SPLIT TRANSACTIONS - Transaction 1: Transfer tokens to vaults
    console.log("Transferring tokens to liquidity pool vaults...");
    const transferTx = new Transaction();
    
    // Transfer tokens to base vault
    transferTx.add(
      createTransferInstruction(
        userTokenAccount,
        ammBaseVault,
        userPublicKey,
        tokenAmount
      )
    );
    
    // Transfer SOL to quote vault
    transferTx.add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: ammQuoteVault,
        lamports: solAmount,
      })
    );
    
    transferTx.feePayer = userPublicKey;
    transferTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Sign and send transaction 1
    const signedTransferTx = await signTransaction(transferTx);
    const transferTxid = await sendTransactionWithConfirmation(connection, signedTransferTx);
    console.log("Transferred tokens to liquidity pool vaults:", transferTxid);
    
    // SPLIT TRANSACTIONS - Transaction 2: Initialize the AMM
    console.log("Initializing the AMM...");
    
    // Create initialize instruction
    const dataLayout = BufferLayout.struct([
      BufferLayout.u8('instruction'),
      BufferLayout.u8('nonce'),
      BufferLayoutExt.nu64('initialLpAmount'),
    ]);
    
    const initialLpAmount = 1000000000; // Initial LP tokens (1 token)
    const data = BufferFrom.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 1, // Initialize instruction
        nonce,
        initialLpAmount: new BN(initialLpAmount),
      },
      data
    );
    
    // Create the instruction
    const initInstruction = new TransactionInstruction({
      keys: [
        { pubkey: ammId, isSigner: false, isWritable: true },
        { pubkey: ammAuthority, isSigner: false, isWritable: false },
        { pubkey: ammOpenOrders, isSigner: false, isWritable: true },
        { pubkey: lpMint, isSigner: false, isWritable: true },
        { pubkey: lpVault, isSigner: false, isWritable: true },
        { pubkey: ammBaseVault, isSigner: false, isWritable: true },
        { pubkey: ammQuoteVault, isSigner: false, isWritable: true },
        { pubkey: ammTargetOrders, isSigner: false, isWritable: true },
        { pubkey: marketId, isSigner: false, isWritable: false },
        { pubkey: userPublicKey, isSigner: true, isWritable: false },
        { pubkey: userLpTokenAccount, isSigner: false, isWritable: true },
        { pubkey: OPENBOOK_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: RAYDIUM_LIQUIDITY_PROGRAM_ID,
      data,
    });
    
    const initTx = new Transaction().add(initInstruction);
    
    // Prepare transaction for sending
    initTx.feePayer = userPublicKey;
    initTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Sign and send transaction 2
    const signedInitTx = await signTransaction(initTx);
    const initTxid = await sendTransactionWithConfirmation(connection, signedInitTx);
    console.log("AMM initialization complete:", initTxid);
    
    return {
      transferTxid,
      initTxid,
      ammId,
      lpMint,
      userLpTokenAccount,
      initialLpAmount
    };
  } catch (error) {
    console.error('Error initializing Raydium AMM:', error);
    throw error;
  }
}

/**
 * Creates a simplified "pool" by transferring SOL to a derived address
 * 
 * IMPORTANT: This is NOT a real Raydium pool and the token will NOT be tradable on DEXes
 * This is just to help the token visibility in some wallets and to simulate the process
 * 
 * @param {Object} params Pool creation parameters
 * @param {Connection} params.connection Solana connection object
 * @param {PublicKey} params.userPublicKey User wallet public key
 * @param {PublicKey} params.mintPublicKey Token mint public key
 * @param {number} params.solAmount Amount of SOL (in lamports) to add to the pool
 * @param {Function} params.signTransaction Function to sign a transaction
 * @returns {Promise<{poolAddress: PublicKey, txid: string}>} Pool address and transaction ID
 */
export async function createSimplifiedPool({
  connection,
  userPublicKey,
  mintPublicKey,
  solAmount,
  signTransaction
}) {
  try {
    // Create unique pool seed based on the token mint
    const poolSeed = Buffer.from(`pool:${mintPublicKey.toString().slice(0, 20)}`);
    
    // Derive a deterministic pool address
    const [poolAddress] = await PublicKey.findProgramAddress(
      [poolSeed, mintPublicKey.toBuffer()],
      TOKEN_PROGRAM_ID
    );
    
    // Create transaction to transfer SOL to the pool address
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: poolAddress,
        lamports: solAmount,
      })
    );
    
    transaction.feePayer = userPublicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Sign the transaction
    const signedTx = await signTransaction(transaction);
    
    // Send the transaction
    const txid = await sendTransactionWithConfirmation(connection, signedTx);
    
    return {
      poolAddress,
      txid
    };
  } catch (error) {
    console.error("Error creating simplified pool:", error);
    throw error;
  }
} 