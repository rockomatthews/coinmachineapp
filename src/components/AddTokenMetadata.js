"use client";

import { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Alert,
  CircularProgress 
} from '@mui/material';
import { Connection, PublicKey } from '@solana/web3.js';
import * as web3 from '@solana/web3.js';
import * as splToken from '@solana/spl-token';

export default function AddTokenMetadata() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [mintAddress, setMintAddress] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenUri, setTokenUri] = useState(''); // Optional: URL to token JSON metadata

  const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

  const getMetadataAccount = async (mint) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )[0];
  };

  const createMetadataV2 = async (
    connection,
    wallet,
    mint,
    payer,
    name,
    symbol,
    uri
  ) => {
    // Get the metadata account address
    const metadataAccount = await getMetadataAccount(mint);
    console.log("Metadata account:", metadataAccount.toString());

    // Data for the transaction
    const data = Buffer.from(
      Uint8Array.of(
        16, // Create Metadata instruction
        ...Buffer.from(name.padEnd(32).slice(0, 32), "utf8"),
        ...Buffer.from(symbol.padEnd(10).slice(0, 10), "utf8"),
        ...Buffer.from(uri.padEnd(200).slice(0, 200), "utf8"),
        0, // Seller fee basis points
        0, // Whether or not the metadata is mutable
        0, // Whether or not there are creators
        0, // Whether or not the primary sale has happened
        0, // Whether or not the token has a max supply
        0, // Whether or not the collection is verified
        0, // Whether or not it uses a collection
        0  // Whether or not the token uses a rule set
      )
    );

    // Create the transaction
    const transaction = new web3.Transaction().add(
      new web3.TransactionInstruction({
        keys: [
          {
            pubkey: metadataAccount,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: mint,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: payer,
            isSigner: true,
            isWritable: false,
          },
          {
            pubkey: payer,
            isSigner: true,
            isWritable: false,
          },
          {
            pubkey: web3.SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: TOKEN_METADATA_PROGRAM_ID,
        data: data,
      })
    );

    // Set recent blockhash and fee payer
    transaction.feePayer = payer;
    transaction.recentBlockhash = (
      await connection.getRecentBlockhash()
    ).blockhash;

    return transaction;
  };

  const handleAddMetadata = async () => {
    if (!window.solana || !window.solana.isPhantom) {
      setError('Phantom wallet not found! Please install it.');
      return;
    }

    if (!mintAddress || !tokenName || !tokenSymbol) {
      setError('Please fill in the mint address, token name, and symbol.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Connect to the blockchain
      const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_ENDPOINT, 
        'confirmed'
      );
      
      // Request wallet connection
      const response = await window.solana.connect();
      const publicKey = response.publicKey;
      
      if (!publicKey) {
        throw new Error('Please connect your wallet first');
      }

      // Convert mint address string to PublicKey
      const mintPublicKey = new PublicKey(mintAddress);
      
      console.log("Creating metadata for:", {
        mint: mintAddress,
        name: tokenName,
        symbol: tokenSymbol,
        uri: tokenUri || ''
      });

      // Create the metadata transaction
      const transaction = await createMetadataV2(
        connection,
        window.solana,
        mintPublicKey,
        publicKey,
        tokenName,
        tokenSymbol,
        tokenUri || ''
      );
      
      // Sign and send the transaction
      console.log("Sending transaction...");
      const signedTx = await window.solana.signAndSendTransaction(transaction);
      console.log("Transaction signature:", signedTx.signature);
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signedTx.signature);
      console.log("Transaction confirmed:", confirmation);
      
      setSuccess(true);
    } catch (err) {
      console.error('Error adding metadata:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, backgroundColor: 'black', color: 'white', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, color: 'white' }}>
        Add Token Metadata
      </Typography>
      
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          required
          fullWidth
          label="Mint Address"
          value={mintAddress}
          onChange={(e) => setMintAddress(e.target.value)}
          variant="outlined"
          placeholder="Enter the mint address of your token"
          sx={{ 
            input: { color: 'white' }, 
            label: { color: 'rgba(255, 255, 255, 0.7)' },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
              '&.Mui-focused fieldset': { borderColor: 'lime' }
            }
          }}
        />
        
        <TextField
          required
          fullWidth
          label="Token Name"
          value={tokenName}
          onChange={(e) => setTokenName(e.target.value)}
          variant="outlined"
          placeholder="Enter token name"
          sx={{ 
            input: { color: 'white' }, 
            label: { color: 'rgba(255, 255, 255, 0.7)' },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
              '&.Mui-focused fieldset': { borderColor: 'lime' }
            }
          }}
        />
        
        <TextField
          required
          fullWidth
          label="Token Symbol"
          value={tokenSymbol}
          onChange={(e) => setTokenSymbol(e.target.value)}
          variant="outlined"
          placeholder="Enter token symbol"
          sx={{ 
            input: { color: 'white' }, 
            label: { color: 'rgba(255, 255, 255, 0.7)' },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
              '&.Mui-focused fieldset': { borderColor: 'lime' }
            }
          }}
        />
        
        <TextField
          fullWidth
          label="URI (Optional)"
          value={tokenUri}
          onChange={(e) => setTokenUri(e.target.value)}
          variant="outlined"
          placeholder="URL to token metadata JSON (optional)"
          sx={{ 
            input: { color: 'white' }, 
            label: { color: 'rgba(255, 255, 255, 0.7)' },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
              '&.Mui-focused fieldset': { borderColor: 'lime' }
            }
          }}
        />
        
        <Button
          variant="contained"
          onClick={handleAddMetadata}
          disabled={loading}
          sx={{ 
            mt: 2,
            backgroundColor: 'lime', 
            color: 'black',
            '&:hover': { backgroundColor: '#c0ff00' },
            '&.Mui-disabled': { backgroundColor: '#4c503c', color: 'rgba(0, 0, 0, 0.7)' }
          }}
          startIcon={loading && <CircularProgress size={20} color="inherit" />}
        >
          {loading ? 'Processing...' : 'Add Metadata'}
        </Button>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mt: 2, backgroundColor: '#1a3314', color: 'white' }}>
          Metadata added successfully! Your token should now display properly in Solscan and wallets.
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mt: 2, backgroundColor: '#331414', color: 'white' }}>
          {error}
        </Alert>
      )}
    </Box>
  );
} 