import { NextRequest, NextResponse } from 'next/server';
import { 
  Connection, 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { 
  getMintLen,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
} from '@solana/spl-token';
import { Buffer } from 'buffer';

// Token metadata program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Creates metadata for an existing token
async function createMetadataTransaction({
  mint,
  mintAuthority,
  payer,
  name,
  symbol,
  uri,
  creators = null,
  sellerFeeBasisPoints = 0,
  updateAuthority = null,
  isMutable = true,
}) {
  // If updateAuthority is not provided, default to mintAuthority
  if (!updateAuthority) {
    updateAuthority = mintAuthority;
  }

  // Find the metadata account address (PDA)
  const [metadataAddress] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  // Create data buffer for the instruction
  const buffer = Buffer.alloc(1000);
  let offset = 0;

  // Using CreateMetadataAccountV3 (instruction 33)
  buffer.writeUInt8(33, offset);
  offset += 1;

  // Write metadata name
  const nameBuffer = Buffer.from(name.slice(0, 32));
  buffer.writeUInt32LE(nameBuffer.length, offset);
  offset += 4;
  nameBuffer.copy(buffer, offset);
  offset += nameBuffer.length;

  // Write metadata symbol
  const symbolBuffer = Buffer.from(symbol.slice(0, 10));
  buffer.writeUInt32LE(symbolBuffer.length, offset);
  offset += 4;
  symbolBuffer.copy(buffer, offset);
  offset += symbolBuffer.length;

  // Write metadata URI
  const uriBuffer = Buffer.from(uri.slice(0, 200));
  buffer.writeUInt32LE(uriBuffer.length, offset);
  offset += 4;
  uriBuffer.copy(buffer, offset);
  offset += uriBuffer.length;

  // Write seller fee basis points
  buffer.writeUInt16LE(sellerFeeBasisPoints, offset);
  offset += 2;

  // Write creators
  if (creators && creators.length > 0) {
    buffer.writeUInt8(1, offset); // Option<Vec<Creator>> = Some
    offset += 1;
    
    buffer.writeUInt32LE(creators.length, offset);
    offset += 4;
    
    for (const creator of creators) {
      creator.address.toBuffer().copy(buffer, offset);
      offset += 32;
      
      buffer.writeUInt8(creator.verified ? 1 : 0, offset);
      offset += 1;
      
      buffer.writeUInt8(creator.share, offset);
      offset += 1;
    }
  } else {
    buffer.writeUInt8(0, offset); // Option<Vec<Creator>> = None
    offset += 1;
  }

  // Write collection field
  buffer.writeUInt8(0, offset); // Collection Option = None 
  offset += 1;

  // Write uses
  buffer.writeUInt8(0, offset); // Option<Uses> = None
  offset += 1;

  // Write is mutable
  buffer.writeUInt8(isMutable ? 1 : 0, offset);
  offset += 1;

  // Write collection details
  buffer.writeUInt8(0, offset); // Option<CollectionDetails> = None
  offset += 1;

  // Create a transaction instruction
  const instruction = {
    keys: [
      {
        pubkey: metadataAddress,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: mint,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: mintAuthority,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: payer,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: updateAuthority,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'),
        isSigner: false,
        isWritable: false,
      },
    ],
    programId: TOKEN_METADATA_PROGRAM_ID,
    data: buffer.slice(0, offset),
  };

  return {
    instruction,
    metadataAddress,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get wallet address from query params
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('wallet');
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }
    
    // Generate a test token with fixed parameters for quick testing
    const userPublicKey = new PublicKey(walletAddress);
    const name = `Test Token ${new Date().toISOString().slice(0, 19)}`;
    const symbol = 'TEST';
    const supply = 1000000;
    const creatorRetention = 200000; // 20%
    const bondingCurveSupply = supply - creatorRetention;
    
    // Setup connection to a public RPC endpoint
    const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    
    // Generate a new token mint keypair
    const mintKeypair = Keypair.generate();
    console.log('Generated mint:', mintKeypair.publicKey.toString());
    
    // Calculate the creation instructions
    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    
    // Create a dummy IPFS URI for metadata
    const metadataUri = `https://arweave.net/placeholder_metadata_uri`;
    
    return NextResponse.json({
      success: true,
      message: 'Test token parameters generated',
      testToken: {
        name,
        symbol,
        supply,
        creatorRetention,
        bondingCurveSupply,
        mintAddress: mintKeypair.publicKey.toString(),
        metadataUri,
      },
      instructions: [
        `To create this token, send these transactions. This is for testing/debugging purposes only.`,
        `1. First create a new mint account for the token`,
        `2. Initialize the mint with decimals = 9`,
        `3. Create an Associated Token Account (ATA) for the wallet`,
        `4. Mint ${creatorRetention} tokens to the creator's wallet`,
        `5. Mint ${bondingCurveSupply} tokens to be sent to the OpenBook market`,
        `6. Create token metadata with the name, symbol, and URI`,
        `7. Verify the creator to finalize the token`
      ]
    });
  } catch (error) {
    console.error('Error in test-create-token:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

// POST endpoint to actually create the token (full test implementation)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, name, symbol, supply, creatorRetention, bondingCurveSupply } = body;
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }
    
    // Note: This would be implemented with the full token creation logic,
    // but would require server-side signing which is not secure without proper key management.
    // In a real implementation, this would use a secure signer service or keystore.
    
    return NextResponse.json({
      success: false,
      message: 'This endpoint is for testing parameters only. Actual token creation requires client-side wallet signing.'
    });
  } catch (error) {
    console.error('Error in test-create-token POST:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
} 