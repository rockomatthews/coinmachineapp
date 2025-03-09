"use client";

import { useState, useContext, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Grid, 
  Avatar,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  Connection, 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  Transaction
} from '@solana/web3.js';
import { 
  getMintLen,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  ExtensionType
} from '@solana/spl-token';
import { WalletContext } from '@/context/WalletContext';

const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

export default function CreateCoinForm() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    supply: 1000000
  });
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  
  const { walletAddress: contextWalletAddress } = useContext(WalletContext) || {};
  
  useEffect(() => {
    if (contextWalletAddress) {
      setWalletAddress(contextWalletAddress);
    }
  }, [contextWalletAddress]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'supply' ? Number(value) : value
    });
  };

  const handleImageUpload = (e) => {
    if (e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleMintToken = async () => {
    if (!window.solana) {
      setError("Please install a Solana wallet like Phantom!");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccessMessage("");
    
    try {
      const userPublicKey = new PublicKey(walletAddress);
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL, 
        'confirmed'
      );
      
      const mintKeypair = Keypair.generate();
      
      // Calculate space for mint account with metadata extension
      const mintLen = getMintLen([ExtensionType.MetadataPointer]);
      const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: userPublicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: mintLen,
          lamports,
          programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeMetadataPointerInstruction(
          mintKeypair.publicKey,
          userPublicKey, // Update authority
          mintKeypair.publicKey, // Metadata address (points to itself)
          TOKEN_2022_PROGRAM_ID
        ),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          9, // decimals
          userPublicKey, // mint authority
          userPublicKey, // freeze authority
          TOKEN_2022_PROGRAM_ID
        )
      );

      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        userPublicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      transaction.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,
          associatedTokenAddress,
          userPublicKey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID
        ),
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedTokenAddress,
          userPublicKey,
          BigInt(Number(formData.supply) * Math.pow(10, 9)),
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );

      transaction.feePayer = userPublicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.sign(mintKeypair);

      const { signature } = await window.solana.signAndSendTransaction(transaction);
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      const successMsg = `Token created successfully!
        Mint Address: ${mintKeypair.publicKey.toString()}
        Name: ${formData.name}
        Symbol: ${formData.symbol}
        Supply: ${formData.supply} ${formData.symbol}`;
      
      setSuccessMessage(successMsg);
      setSuccess(true);
      setLoading(false);
      
    } catch (error) {
      console.error("Error creating token:", error);
      setError(`Error creating token: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, backgroundColor: 'black', color: 'white', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, color: 'white' }}>
        Create a New Token
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            name="name"
            label="Token Name"
            value={formData.name}
            onChange={handleChange}
            variant="outlined"
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
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            name="symbol"
            label="Token Symbol"
            value={formData.symbol}
            onChange={handleChange}
            variant="outlined"
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
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            name="description"
            label="Description"
            value={formData.description}
            onChange={handleChange}
            multiline
            rows={4}
            variant="outlined"
            sx={{ 
              textarea: { color: 'white' }, 
              label: { color: 'rgba(255, 255, 255, 0.7)' },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                '&.Mui-focused fieldset': { borderColor: 'lime' }
              }
            }}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            name="supply"
            label="Initial Supply"
            type="number"
            value={formData.supply}
            onChange={handleChange}
            variant="outlined"
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
        </Grid>
        
        <Grid item xs={12}>
          <Button
            variant="contained"
            onClick={handleMintToken}
            disabled={loading || !formData.name || !formData.symbol || !formData.supply}
            sx={{ 
              backgroundColor: 'lime', 
              color: 'black',
              '&:hover': { backgroundColor: '#c0ff00' },
              '&.Mui-disabled': { backgroundColor: '#4c503c', color: 'rgba(0, 0, 0, 0.7)' }
            }}
            startIcon={loading && <CircularProgress size={20} color="inherit" />}
          >
            {loading ? 'Processing...' : 'Mint Token'}
          </Button>
        </Grid>
      </Grid>

      {success && (
        <Alert severity="success" sx={{ mt: 2, mb: 2, backgroundColor: 'rgba(46, 125, 50, 0.2)', color: 'lightgreen' }}>
          <Typography variant="h6" component="div" sx={{ mb: 1, color: 'lightgreen' }}>
            Token Created Successfully!
          </Typography>
          <Typography sx={{ whiteSpace: 'pre-line' }}>
            {successMessage}
          </Typography>
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