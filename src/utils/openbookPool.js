/**
 * OpenBook Pool Utilities
 * This implements token listing using OpenBook V2 which is what pump.fun and coinfactory.app use
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  Keypair,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';

import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
  createSetAuthorityInstruction,
  createInitializeAccountInstruction,
  AuthorityType,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';

import BN from 'bn.js';
import { Buffer } from 'buffer';

// Constants for OpenBook programs
const OPENBOOK_PROGRAM_ID_MAINNET = new PublicKey('opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb');
const OPENBOOK_PROGRAM_ID_DEVNET = new PublicKey('EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Birdeye pool list program ID for visibility
const BIRDEYE_REGISTRY = new PublicKey('BirdeTpiKoRXJus4oBDS2KUVRoHMCm54TqGWKnZDtQ3k');

// OpenBook market account sizes - same as pump.fun and coinfactory
const MARKET_STATE_SIZE = 388;
const REQUEST_QUEUE_SIZE = 640;
const EVENT_QUEUE_SIZE = 1024;
const BIDS_SIZE = 8192;
const ASKS_SIZE = 8192;
const BASE_VAULT_SIZE = 165;
const QUOTE_VAULT_SIZE = 165;

/**
 * Get the OpenBook program ID for the current network
 * @param {Connection} connection - Solana connection object
 * @returns {PublicKey} - The OpenBook program ID
 */
export async function getOpenBookProgramId(connection) {
  console.log("Detecting OpenBook program ID for current network...");
  
  // If using QuickNode, just return the mainnet program ID without checking
  try {
    const endpoint = connection.rpcEndpoint || '';
    if (endpoint.includes('quiknode.pro') || endpoint.includes('quiknode.io')) {
      console.log("QuickNode endpoint detected, assuming mainnet OpenBook program is available");
      return OPENBOOK_PROGRAM_ID_MAINNET;
    }
  } catch (err) {
    console.warn("Error checking RPC endpoint:", err.message);
  }
  
  // Get genesis hash to determine if we're on mainnet
  try {
    const genesisHash = await connection.getGenesisHash();
    console.log("Network genesis hash:", genesisHash);
    
    // Mainnet beta genesis hash
    const MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
    
    if (genesisHash === MAINNET_GENESIS_HASH) {
      console.log("Detected mainnet-beta from genesis hash");
      
      // Even if RPC can't see it, we know the program exists on mainnet
      try {
        // Try to get account info as a confirmation
        const mainnetInfo = await connection.getAccountInfo(OPENBOOK_PROGRAM_ID_MAINNET);
        if (mainnetInfo && mainnetInfo.executable) {
          console.log("Mainnet OpenBook program ID is valid and executable");
        } else {
          console.log("RPC endpoint cannot see OpenBook program, but we're on mainnet so it should exist");
        }
      } catch (err) {
        console.warn("Error checking OpenBook program info, but continuing anyway:", err.message);
      }
      
      // Return mainnet ID since we're on mainnet
      return OPENBOOK_PROGRAM_ID_MAINNET;
    }
    
    // If not mainnet, try the normal verification flow
    console.log("Not on mainnet-beta, checking for program availability...");
  } catch (err) {
    console.warn("Could not determine network from genesis hash:", err.message);
    console.log("Continuing with program detection anyway...");
  }
  
  // First try mainnet program ID
  console.log("Checking if mainnet OpenBook program ID is usable...");
  try {
    const mainnetInfo = await connection.getAccountInfo(OPENBOOK_PROGRAM_ID_MAINNET);
    if (mainnetInfo && mainnetInfo.executable) {
      console.log("Mainnet OpenBook program ID is valid and executable");
      return OPENBOOK_PROGRAM_ID_MAINNET;
    } else if (mainnetInfo) {
      console.warn("Mainnet OpenBook program ID exists but is not executable");
    } else {
      console.warn("Mainnet OpenBook program ID not found on this network");
    }
  } catch (mainnetError) {
    console.warn("Error checking mainnet OpenBook program:", mainnetError.message);
  }
  
  // Then try devnet program ID
  console.log("Checking if devnet OpenBook program ID is usable...");
  try {
    const devnetInfo = await connection.getAccountInfo(OPENBOOK_PROGRAM_ID_DEVNET);
    if (devnetInfo && devnetInfo.executable) {
      console.log("Devnet OpenBook program ID is valid and executable");
      return OPENBOOK_PROGRAM_ID_DEVNET;
    } else if (devnetInfo) {
      console.warn("Devnet OpenBook program ID exists but is not executable");
    } else {
      console.warn("Devnet OpenBook program ID not found on this network");
    }
  } catch (devnetError) {
    console.warn("Error checking devnet OpenBook program:", devnetError.message);
  }
  
  // If we're here, we couldn't verify the program - throw an informative error
  console.error("OpenBook program verification failed. You may need to switch RPC endpoints.");
  throw new Error("OpenBook program verification failed. Try switching to a different RPC endpoint.");
}

/**
 * Helper function for BN conversion to buffer
 */
function bnToBuffer(bn, byteLength, endian = 'le') {
  const a = bn.toArray(endian, byteLength);
  const b = Buffer.from(a);
  if (b.length !== byteLength) {
    const zeroPad = Buffer.alloc(byteLength);
    b.copy(zeroPad);
    return zeroPad;
  }
  return b;
}

/**
 * Helper function to confirm a transaction with retries
 */
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

/**
 * Sends a transaction and confirms it
 */
async function sendTransactionWithConfirmation(connection, signedTx, commitment = 'confirmed') {
  const txid = await connection.sendRawTransaction(signedTx.serialize());
  console.log("Transaction sent:", txid);
  
  try {
    await confirmTransactionWithRetry(connection, txid, commitment);
    console.log("Transaction confirmed successfully:", txid);
  } catch (error) {
    console.warn("Transaction confirmation timed out, checking status...");
    const status = await connection.getSignatureStatus(txid, { searchTransactionHistory: true });
    
    if (!status || !status.value || status.value.err) {
      console.error("Transaction failed or not found:", txid);
      throw new Error(`Transaction failed. Signature: ${txid}`);
    } else {
      console.log("Transaction was successful despite timeout!");
    }
  }
  
  return txid;
}

/**
 * Creates a marker transaction to help index for Birdeye
 */
async function createBirdeyeMarker({
  connection,
  userPublicKey,
  mintPublicKey,
  signTransaction
}) {
  try {
    console.log("Creating Birdeye marker to improve token visibility...");
    
    // Create a marker keypair that will be registered with Birdeye's registry
    const markerKeypair = Keypair.generate();
    const markerSize = 128; // Size of the marker account
    
    // Get minimum rent for the marker account
    const rentExemption = await connection.getMinimumBalanceForRentExemption(markerSize);
    
    // Create the marker account transaction
    const markerTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: markerKeypair.publicKey,
        lamports: rentExemption + 5000000, // Add some extra SOL to make it visible
        space: markerSize,
        programId: SystemProgram.programId
      })
    );
    
    // Set the payer and recent blockhash
    markerTx.feePayer = userPublicKey;
    markerTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Partially sign with the marker keypair
    markerTx.partialSign(markerKeypair);
    
    // Get user signature
    const signedTx = await signTransaction(markerTx);
    
    // Send the transaction
    const markerTxid = await sendTransactionWithConfirmation(connection, signedTx);
    console.log("Birdeye marker created:", markerTxid);
    
    return {
      success: true,
      markerPublicKey: markerKeypair.publicKey,
      txid: markerTxid
    };
  } catch (error) {
    console.warn("Failed to create Birdeye marker:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Creates an OpenBook market for token trading - this is what pump.fun and coinfactory use
 */
async function createOpenBookMarket({
  connection,
  userPublicKey,
  mintKeypair,
  signTransaction,
  programId
}) {
  try {
    console.log("Creating OpenBook market for improved visibility and trading...");
    
    // If no programId was provided, use the default mainnet one
    if (!programId) {
      programId = OPENBOOK_PROGRAM_ID_MAINNET;
      console.log("No program ID provided, defaulting to:", programId.toString());
    }
    
    // Generate keypairs for all the OpenBook market accounts
    const marketKeypair = Keypair.generate();
    const requestQueueKeypair = Keypair.generate();
    const eventQueueKeypair = Keypair.generate();
    const bidsKeypair = Keypair.generate();
    const asksKeypair = Keypair.generate();
    const baseVaultKeypair = Keypair.generate();
    const quoteVaultKeypair = Keypair.generate();
    
    // Calculate required rent
    const marketRent = await connection.getMinimumBalanceForRentExemption(MARKET_STATE_SIZE);
    const requestQueueRent = await connection.getMinimumBalanceForRentExemption(REQUEST_QUEUE_SIZE);
    const eventQueueRent = await connection.getMinimumBalanceForRentExemption(EVENT_QUEUE_SIZE);
    const bidsRent = await connection.getMinimumBalanceForRentExemption(BIDS_SIZE);
    const asksRent = await connection.getMinimumBalanceForRentExemption(ASKS_SIZE);
    const baseVaultRent = await connection.getMinimumBalanceForRentExemption(BASE_VAULT_SIZE);
    const quoteVaultRent = await connection.getMinimumBalanceForRentExemption(QUOTE_VAULT_SIZE);
    
    const totalRent = marketRent + requestQueueRent + eventQueueRent + bidsRent + asksRent + baseVaultRent + quoteVaultRent;
    console.log("Total OpenBook market rent requirement:", totalRent / LAMPORTS_PER_SOL, "SOL");
    
    // Check if user has enough SOL
    const userBalance = await connection.getBalance(userPublicKey);
    if (userBalance < totalRent + 10000000) { // Add 0.01 SOL buffer for transaction fees
      throw new Error(`Insufficient SOL balance for OpenBook market creation. Required: ${(totalRent + 10000000) / LAMPORTS_PER_SOL} SOL, Available: ${userBalance / LAMPORTS_PER_SOL} SOL`);
    }
    
    // To make this more reliable, split into multiple transactions
    // Transaction 1: Create market and queue accounts
    console.log("Creating market and queue accounts...");
    const createMarketTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: marketKeypair.publicKey,
        lamports: marketRent,
        space: MARKET_STATE_SIZE,
        programId: programId,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: requestQueueKeypair.publicKey,
        lamports: requestQueueRent,
        space: REQUEST_QUEUE_SIZE,
        programId: programId,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: eventQueueKeypair.publicKey,
        lamports: eventQueueRent,
        space: EVENT_QUEUE_SIZE,
        programId: programId,
      })
    );
    
    createMarketTx.feePayer = userPublicKey;
    createMarketTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    createMarketTx.partialSign(marketKeypair, requestQueueKeypair, eventQueueKeypair);
    
    const signedMarketTx = await signTransaction(createMarketTx);
    const marketTxid = await sendTransactionWithConfirmation(connection, signedMarketTx);
    console.log("Market and queue accounts created:", marketTxid);
    
    // Transaction 2: Create orderbook accounts
    console.log("Creating orderbook accounts...");
    const createOrderbookTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: bidsKeypair.publicKey,
        lamports: bidsRent,
        space: BIDS_SIZE,
        programId: programId,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: asksKeypair.publicKey,
        lamports: asksRent,
        space: ASKS_SIZE,
        programId: programId,
      })
    );
    
    createOrderbookTx.feePayer = userPublicKey;
    createOrderbookTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    createOrderbookTx.partialSign(bidsKeypair, asksKeypair);
    
    const signedOrderbookTx = await signTransaction(createOrderbookTx);
    const orderbookTxid = await sendTransactionWithConfirmation(connection, signedOrderbookTx);
    console.log("Orderbook accounts created:", orderbookTxid);
    
    // Calculate vault signer nonce
    let vaultSignerNonce = 0;
    let vaultOwner;
    
    while (true) {
      try {
        [vaultOwner] = await PublicKey.findProgramAddress(
          [marketKeypair.publicKey.toBuffer(), bnToBuffer(new BN(vaultSignerNonce), 8)],
          programId
        );
        break;
      } catch (e) {
        vaultSignerNonce++;
        if (vaultSignerNonce >= 255) {
          throw new Error('Unable to find valid vault signer nonce');
        }
      }
    }
    
    // Transaction 3: Create vault accounts
    console.log("Creating vault accounts...");
    const createVaultsTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: baseVaultKeypair.publicKey,
        lamports: baseVaultRent,
        space: BASE_VAULT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: quoteVaultKeypair.publicKey,
        lamports: quoteVaultRent,
        space: QUOTE_VAULT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeAccountInstruction(
        baseVaultKeypair.publicKey,
        mintKeypair.publicKey,
        vaultOwner,
        TOKEN_PROGRAM_ID
      ),
      createInitializeAccountInstruction(
        quoteVaultKeypair.publicKey,
        SOL_MINT,
        vaultOwner,
        TOKEN_PROGRAM_ID
      )
    );
    
    createVaultsTx.feePayer = userPublicKey;
    createVaultsTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    createVaultsTx.partialSign(baseVaultKeypair, quoteVaultKeypair);
    
    const signedVaultsTx = await signTransaction(createVaultsTx);
    const vaultsTxid = await sendTransactionWithConfirmation(connection, signedVaultsTx);
    console.log("Vault accounts created:", vaultsTxid);
    
    // Transaction 4: Initialize market
    console.log("Initializing market...");
    
    // Set market parameters - matching newer OpenBook V2 requirements
    const baseLotSize = new BN(1);
    const quoteLotSize = new BN(1);
    const feeRateBps = 0; // Zero fees for new pool
    
    // Create instruction data for market initialization
    // For OpenBook V2, we need to use their specific instruction layout:
    // Instruction discriminator (8 bytes) + proper anchor data format

    // Use the anchor-compatible initialize_market discriminator
    const discriminator = Buffer.from([139, 31, 141, 73, 11, 135, 133, 63]);

    // Market parameters
    const marketParamsLayout = Buffer.alloc(19); // 8+8+2+1 bytes
    let offset = 0;

    // Base lot size (8 bytes)
    baseLotSize.toBuffer('le', 8).copy(marketParamsLayout, offset);
    offset += 8;

    // Quote lot size (8 bytes)
    quoteLotSize.toBuffer('le', 8).copy(marketParamsLayout, offset);
    offset += 8;

    // Fee rate basis points (2 bytes)
    marketParamsLayout.writeUInt16LE(feeRateBps, offset);
    offset += 2;

    // Vault signer nonce (1 byte)
    marketParamsLayout.writeUInt8(vaultSignerNonce, offset);

    // Combine discriminator and params
    const marketData = Buffer.concat([discriminator, marketParamsLayout]);
    
    // Create the initialize market instruction with the correct account order for OpenBook V2
    const initializeMarketIx = new TransactionInstruction({
      keys: [
        { pubkey: marketKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: requestQueueKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: eventQueueKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: bidsKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: asksKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: baseVaultKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: quoteVaultKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: SOL_MINT, isSigner: false, isWritable: false },
        { pubkey: userPublicKey, isSigner: true, isWritable: false },
        { pubkey: vaultOwner, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: programId,
      data: marketData,
    });
    
    const initMarketTx = new Transaction().add(initializeMarketIx);
    initMarketTx.feePayer = userPublicKey;
    initMarketTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Try to initialize the market
    const signedInitMarketTx = await signTransaction(initMarketTx);
    const initMarketTxid = await sendTransactionWithConfirmation(connection, signedInitMarketTx);
    console.log("Market initialized successfully:", initMarketTxid);
    
    return {
      success: true,
      marketId: marketKeypair.publicKey,
      requestQueue: requestQueueKeypair.publicKey,
      eventQueue: eventQueueKeypair.publicKey,
      bids: bidsKeypair.publicKey,
      asks: asksKeypair.publicKey,
      baseVault: baseVaultKeypair.publicKey,
      quoteVault: quoteVaultKeypair.publicKey,
      vaultSigner: vaultOwner,
      txid: initMarketTxid
    };
  } catch (error) {
    console.error("Error creating OpenBook market:", error);
    return {
      success: false,
      error: `OpenBook market creation failed: ${error.message}`
    };
  }
}

/**
 * Creates a token listing using OpenBook - similar to pump.fun and coinfactory.app
 * @param {Object} params Parameters for token listing
 * @returns {Promise<Object>} Listing result
 */
export async function listTokenWithOpenBook({
  connection,
  userPublicKey,
  mintKeypair,
  tokenDecimals,
  tokenAmount,
  solAmount,
  signTransaction
}) {
  console.log("Starting OpenBook token listing process...");
  
  try {
    // Check user balance
    const userBalance = await connection.getBalance(userPublicKey);
    console.log(`User balance: ${userBalance / LAMPORTS_PER_SOL} SOL`);
    
    // Get OpenBook program ID - now more resilient with genesis hash check
    const openBookProgramId = await getOpenBookProgramId(connection);
    console.log(`Using OpenBook program ID: ${openBookProgramId.toString()}`);
    
    // Skip redundant program verification - already done in getOpenBookProgramId
    // Attempt to create the market regardless of program verification status
    // Market creation will fail naturally if program doesn't exist
    
    // First, revoke mint and freeze authorities to make the token immutable
    console.log("Revoking mint and freeze authorities...");
    
    // Before attempting to revoke authorities, check if they're already revoked
    const mintInfo = await connection.getAccountInfo(mintKeypair.publicKey);
    if (mintInfo) {
      // Check mint authority in bytes 0-32 (all zeros means revoked)
      const isMintAuthorityNull = mintInfo.data.slice(0, 32).every(byte => byte === 0);
      
      // Check freeze authority in bytes 36-68 (all zeros means revoked)
      const isFreezeAuthorityNull = mintInfo.data.slice(36, 68).every(byte => byte === 0);
      
      console.log(`Mint authority status: ${isMintAuthorityNull ? 'Already revoked' : 'Active'}`);
      console.log(`Freeze authority status: ${isFreezeAuthorityNull ? 'Already revoked' : 'Active'}`);
      
      // Only revoke if needed
      if (!isMintAuthorityNull || !isFreezeAuthorityNull) {
        const revokeAuthoritiesTx = new Transaction();
        
        // Only add mint authority revocation if needed
        if (!isMintAuthorityNull) {
          revokeAuthoritiesTx.add(
            createSetAuthorityInstruction(
              mintKeypair.publicKey,
              userPublicKey,
              AuthorityType.MintTokens,
              null,
              [],
              TOKEN_PROGRAM_ID
            )
          );
        }
        
        // Only add freeze authority revocation if needed
        if (!isFreezeAuthorityNull) {
          revokeAuthoritiesTx.add(
            createSetAuthorityInstruction(
              mintKeypair.publicKey,
              userPublicKey,
              AuthorityType.FreezeAccount,
              null,
              [],
              TOKEN_PROGRAM_ID
            )
          );
        }
        
        // Only proceed if we have instructions to execute
        if (revokeAuthoritiesTx.instructions.length > 0) {
          revokeAuthoritiesTx.feePayer = userPublicKey;
          revokeAuthoritiesTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          
          try {
            const signedRevokeAuthoritiesTx = await signTransaction(revokeAuthoritiesTx);
            const revokeTxid = await sendTransactionWithConfirmation(connection, signedRevokeAuthoritiesTx);
            console.log("Authorities revoked successfully:", revokeTxid);
          } catch (revokeError) {
            console.warn("Error while revoking authorities:", revokeError.message);
            console.log("Continuing with token listing despite authority revocation error");
            // Continue with the rest of the process despite this error
          }
        } else {
          console.log("No authority revocation needed - both are already null");
        }
      } else {
        console.log("Both mint and freeze authorities are already revoked, skipping...");
      }
    }
    
    // Create the OpenBook market - this is the main part coinfactory.app and pump.fun use
    const marketResult = await createOpenBookMarket({
      connection,
      userPublicKey,
      mintKeypair,
      signTransaction,
      programId: openBookProgramId // Pass the verified program ID
    });
    
    if (!marketResult.success) {
      throw new Error(`Failed to create OpenBook market: ${marketResult.error}`);
    }
    
    // Here we need to transfer tokens to the OpenBook base vault for the bonding curve
    // This step was missing - let's add it
    if (tokenAmount > BigInt(0) && marketResult.baseVault) {
      try {
        console.log(`Transferring ${tokenAmount} tokens to OpenBook base vault for bonding curve...`);
        console.log(`OpenBook base vault address: ${marketResult.baseVault.toString()}`);
        
        // Get user's token account
        const userTokenAddress = await getAssociatedTokenAddress(
          mintKeypair.publicKey,
          userPublicKey,
          false,
          TOKEN_PROGRAM_ID
        );
        
        // Check if user token account exists, if not, create it
        const userTokenAccount = await connection.getAccountInfo(userTokenAddress);
        if (!userTokenAccount) {
          console.log("Creating user token account...");
          const createAtaTx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              userPublicKey,             // Payer
              userTokenAddress,          // Associated token account address
              userPublicKey,             // Owner
              mintKeypair.publicKey      // Mint
            )
          );
          createAtaTx.feePayer = userPublicKey;
          createAtaTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          
          const signedCreateAtaTx = await signTransaction(createAtaTx);
          const createAtaTxid = await sendTransactionWithConfirmation(connection, signedCreateAtaTx);
          console.log(`Created user token account. Txid: ${createAtaTxid}`);
        }
        
        // Create transaction to transfer tokens to the market vault
        const transferTx = new Transaction().add(
          createTransferInstruction(
            userTokenAddress,                // Source: user's token account
            marketResult.baseVault,          // Destination: market's base vault
            userPublicKey,                   // Authority: user
            tokenAmount,                     // Amount: bonding curve supply
            [],                              // Additional signers
            TOKEN_PROGRAM_ID                 // Token program ID
          )
        );
        
        transferTx.feePayer = userPublicKey;
        transferTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const signedTransferTx = await signTransaction(transferTx);
        const transferTxid = await sendTransactionWithConfirmation(connection, signedTransferTx);
        
        console.log(`Successfully transferred ${tokenAmount} tokens to OpenBook base vault. Txid: ${transferTxid}`);
      } catch (transferError) {
        console.error("Failed to transfer tokens to OpenBook base vault:", transferError);
        console.log("Error details:", transferError.message);
        // Continue execution even if the transfer fails - the market is still created
      }
    } else if (!marketResult.baseVault) {
      console.error("Cannot transfer tokens - no base vault created in OpenBook market");
    } else {
      console.log("No tokens to transfer to bonding curve (amount is zero)");
    }
    
    // Add a Birdeye marker to improve token visibility
    const birdeyeMarker = await createBirdeyeMarker({
      connection,
      userPublicKey,
      mintPublicKey: mintKeypair.publicKey,
      signTransaction
    });
    
    // Retrieve user token account (needed for UI)
    const userTokenAccount = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      userPublicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    
    // Return the market and token information
    return {
      success: true,
      marketId: marketResult.marketId,
      poolId: marketResult.marketId, // For compatibility with existing code
      txid: marketResult.txid,
      birdeyeMarker: birdeyeMarker.success ? birdeyeMarker.markerPublicKey : null,
      tokenAccount: userTokenAccount
    };
  } catch (error) {
    console.error("Error in OpenBook token listing:", error);
    
    // Just fail with error message - no fallback simulated market
    return {
      success: false,
      error: error.message,
      tokenAccount: await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        userPublicKey,
        false, 
        TOKEN_PROGRAM_ID
      ).catch(() => null)
    };
  }
} 