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
import { 
  Connection, 
  PublicKey, 
  Transaction,
  TransactionInstruction 
} from '@solana/web3.js';

export default function TokenMetadata() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [mintAddress, setMintAddress] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenUri, setTokenUri] = useState(''); // Optional: URL to token JSON metadata

  const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

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
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL, 
        'confirmed'
      );
      
      // Request wallet connection
      const { publicKey } = await window.solana.connect();
      
      if (!publicKey) {
        throw new Error('Please connect your wallet first');
      }

      // Convert mint address string to PublicKey
      const mintPublicKey = new PublicKey(mintAddress);
      
      // Find metadata account address (PDA)
      const [metadataAddress] = await PublicKey.findProgramAddress(
        [
          Buffer.from('metadata'),
          METADATA_PROGRAM_ID.toBuffer(),
          mintPublicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );
      
      console.log("Metadata address:", metadataAddress.toString());

      // Build the metadata
      const data = {
        name: tokenName,
        symbol: tokenSymbol,
        uri: tokenUri || '',
        sellerFeeBasisPoints: 0,
        creators: null,
      };

      // Serialize the data according to Metaplex format
      const dataBuffer = Buffer.from(JSON.stringify(data));
      
      // Create the instruction to create metadata
      const createMetadataInstruction = new TransactionInstruction({
        keys: [
          { pubkey: metadataAddress, isSigner: false, isWritable: true },
          { pubkey: mintPublicKey, isSigner: false, isWritable: false },
          { pubkey: publicKey, isSigner: true, isWritable: false },
          { pubkey: publicKey, isSigner: true, isWritable: false },
          { pubkey: PublicKey.default, isSigner: false, isWritable: false },
        ],
        programId: METADATA_PROGRAM_ID,
        data: Buffer.concat([
          Buffer.from([0]), // Create instruction
          dataBuffer,
        ]),
      });

      // Create and send the transaction
      const transaction = new Transaction().add(createMetadataInstruction);
      transaction.feePayer = publicKey;
      transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
      
      // Sign and send the transaction
      const signed = await window.solana.signAndSendTransaction(transaction);
      
      // Wait for confirmation
      await connection.confirmTransaction(signed.signature);
      
      setSuccess(true);
      console.log("Metadata added successfully!", signed.signature);
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