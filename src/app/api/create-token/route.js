import { NextResponse } from 'next/server';
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import { 
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  MINT_SIZE
} from '@solana/spl-token';

// METADATA_PROGRAM_ID for token metadata
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Helper function to validate input
function validateInput(data) {
  if (!data.walletAddress) return 'Wallet address is required';
  if (!data.name) return 'Token name is required';
  if (!data.symbol) return 'Token symbol is required';
  if (!data.supply || isNaN(Number(data.supply))) return 'Valid supply is required';
  return null;
}

// Helper to get metadata account address
function getMetadataAddress(mint) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  )[0];
}

// Function to create a token with metadata before minting
export async function POST(request) {
  try {
    // Parse form data
    const formData = await request.formData();
    
    // Extract and validate data
    const data = {
      walletAddress: formData.get('walletAddress'),
      name: formData.get('name'),
      symbol: formData.get('symbol'),
      description: formData.get('description') || '',
      supply: formData.get('supply'),
      signature: formData.get('signature')
    };
    
    // Get image file if it exists
    const imageFile = formData.get('image');
    
    // Validate inputs
    const validationError = validateInput(data);
    if (validationError) {
      return NextResponse.json({ success: false, message: validationError }, { status: 400 });
    }
    
    console.log('Processing token creation with metadata:', {
      name: data.name,
      symbol: data.symbol,
      supply: data.supply,
      recipient: data.walletAddress
    });
    
    try {
      // Connect to Solana
      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT, 'confirmed');
      const userPublicKey = new PublicKey(data.walletAddress);
      
      // Generate keypair for the mint
      const mintKeypair = Keypair.generate();
      const mintPubkey = mintKeypair.publicKey;
      
      console.log('Created mint keypair:', mintPubkey.toString());
      
      // For now, just skip metadata creation and focus on creating the token
      // We'll simply create token without metadata in a single transaction
      
      const instructions = [];
      
      // 1. Create account for the mint
      const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
      
      instructions.push(
        SystemProgram.createAccount({
          fromPubkey: userPublicKey,
          newAccountPubkey: mintPubkey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        })
      );
      
      // 2. Initialize the mint
      instructions.push(
        createInitializeMintInstruction(
          mintPubkey,
          9, // 9 decimals is standard for Solana tokens
          userPublicKey,
          userPublicKey,
          TOKEN_PROGRAM_ID
        )
      );
      
      // 3. Get the associated token account for the recipient
      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        userPublicKey
      );
      
      // 4. Create the associated token account if it doesn't exist
      instructions.push(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          associatedTokenAccount,
          userPublicKey,
          mintPubkey
        )
      );
      
      // 5. Mint tokens to the recipient's associated token account
      const mintAmount = BigInt(Number(data.supply) * Math.pow(10, 9));
      
      instructions.push(
        createMintToInstruction(
          mintPubkey,
          associatedTokenAccount,
          userPublicKey,
          mintAmount
        )
      );
      
      // Create a transaction
      const blockhash = await connection.getLatestBlockhash();
      const transaction = new Transaction({
        feePayer: userPublicKey,
        recentBlockhash: blockhash.blockhash,
      });
      
      // Add all instructions to the transaction
      instructions.forEach(instruction => transaction.add(instruction));
      
      // Partially sign the transaction with the mint keypair
      transaction.partialSign(mintKeypair);
      
      // Serialize the transaction for client-side signing
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      
      // Return the serialized transaction and other details to the frontend
      return NextResponse.json({
        success: true,
        mintAddress: mintPubkey.toString(),
        associatedTokenAccount: associatedTokenAccount.toString(),
        tokenName: data.name,
        tokenSymbol: data.symbol,
        transaction: Buffer.from(serializedTransaction).toString('base64'),
        message: 'Token transaction prepared. This will create a token without on-chain metadata.',
        note: 'After token creation, we recommend using Solana CLI to add metadata.'
      });
      
    } catch (error) {
      console.error('Error creating token:', error);
      
      return NextResponse.json({
        success: false,
        message: `Error creating token: ${error.message}`,
        details: error.stack
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({
      success: false,
      message: `Server error: ${error.message}`
    }, { status: 500 });
  }
} 