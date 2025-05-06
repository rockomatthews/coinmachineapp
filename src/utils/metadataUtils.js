import { 
  Transaction, 
  PublicKey, 
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';

// Token metadata program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

/**
 * Creates metadata for an existing token - using the format that works with Phantom
 */
export async function createMetadataTransaction({
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

  // Create data buffer for the instruction - this is the EXACT format that works
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

  // Write is collection primary sale happened
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
  const instruction = new TransactionInstruction({
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
        isSigner: false, // Don't require signing for V3
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: SYSVAR_RENT_PUBKEY,
        isSigner: false,
        isWritable: false,
      },
    ],
    programId: TOKEN_METADATA_PROGRAM_ID,
    data: buffer.slice(0, offset),
  });

  // Create a new transaction with the instruction
  const transaction = new Transaction().add(instruction);

  return {
    transaction,
    metadataAddress,
  };
}

/**
 * Create a transaction to verify the creator - using V2 format that pump.fun uses
 */
export async function createVerifyCreatorTransaction({
  mint,
  creator,
  payer
}) {
  // Find the metadata account address (PDA)
  const [metadataAddress] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  // Create a verify creator instruction
  const buffer = Buffer.alloc(10);
  buffer.writeUInt8(7, 0); // Instruction discriminator for verify (7) - standard value for Metaplex V2
  
  const instruction = new TransactionInstruction({
    keys: [
      {
        pubkey: metadataAddress,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: creator,
        isSigner: true,
        isWritable: false,
      },
    ],
    programId: TOKEN_METADATA_PROGRAM_ID,
    data: buffer.slice(0, 1),
  });

  // Create a new transaction with the instruction
  const transaction = new Transaction().add(instruction);

  return {
    transaction,
  };
}

/**
 * Create a transaction to update metadata to make it immutable - using V2 format
 */
export async function createUpdateMetadataTransaction({
  mint,
  payer,
  updateAuthority = null,
  newUpdateAuthority = null,
  primarySaleHappened = null,
  isMutable = false // Setting to false makes immutable
}) {
  // Find the metadata account address (PDA)
  const [metadataAddress] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  // Create a buffer for the update instruction
  const buffer = Buffer.alloc(100);
  let offset = 0;

  // UpdateMetadataAccountV2 instruction discriminator - correct for V2
  buffer.writeUInt8(15, offset);
  offset += 1;

  // Update authority option (null means keep current)
  if (newUpdateAuthority) {
    buffer.writeUInt8(1, offset); // Option::Some
    offset += 1;
    const addressBuffer = newUpdateAuthority.toBuffer();
    addressBuffer.copy(buffer, offset);
    offset += 32;
  } else {
    buffer.writeUInt8(0, offset); // Option::None
    offset += 1;
  }

  // Primary sale happened (optional)
  if (primarySaleHappened !== null) {
    buffer.writeUInt8(1, offset); // Option::Some
    offset += 1;
    buffer.writeUInt8(primarySaleHappened ? 1 : 0, offset);
    offset += 1;
  } else {
    buffer.writeUInt8(0, offset); // Option::None
    offset += 1;
  }

  // Is mutable (optional)
  buffer.writeUInt8(1, offset); // Option::Some
  offset += 1;
  buffer.writeUInt8(isMutable ? 1 : 0, offset);
  offset += 1;

  // Create a transaction instruction
  const instruction = new TransactionInstruction({
    keys: [
      {
        pubkey: metadataAddress,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: updateAuthority || payer,
        isSigner: true,
        isWritable: false,
      },
    ],
    programId: TOKEN_METADATA_PROGRAM_ID,
    data: buffer.slice(0, offset),
  });

  // Create a new transaction with the instruction
  const transaction = new Transaction().add(instruction);

  return {
    transaction,
    metadataAddress,
  };
}

/**
 * Validates and ensures URI is formatted correctly for wallets
 */
export function validateAndFormatUri(uri) {
  if (!uri) return '';
  
  // Check if the URI is already a valid URL
  try {
    const url = new URL(uri);
    
    // If it's an IPFS URL, replace it with our proxy
    if (url.hostname === 'ipfs.io' || 
        url.hostname === 'gateway.ipfs.io' || 
        url.hostname === 'cloudflare-ipfs.com' ||
        url.hostname === 'ipfs.fleek.co' ||
        url.hostname.includes('dweb.link')) {
      
      // Extract the IPFS path
      const ipfsPath = url.pathname.replace('/ipfs/', '');
      return `/api/ipfs/${ipfsPath}`;
    }
    
    return url.toString();
  } catch (e) {
    // If it's not a valid URL, assume it's an IPFS hash
    if (uri.startsWith('ipfs://')) {
      // Use our proxy instead of ipfs.io
      return uri.replace('ipfs://', '/api/ipfs/');
    } else if (uri.startsWith('Qm') && uri.length >= 46) {
      // Use our proxy for raw IPFS CIDs
      return `/api/ipfs/${uri}`;
    } else {
      return uri;
    }
  }
}