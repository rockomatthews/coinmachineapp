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
  Alert,
  Container,
  FormControlLabel,
  Checkbox,
  Divider,
  Tooltip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  InputAdornment,
  IconButton,
  LinearProgress
} from '@mui/material';
import { 
  Connection, 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
  getMintLen,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createSetAuthorityInstruction,
  AuthorityType
} from '@solana/spl-token';
import { Metaplex } from '@metaplex-foundation/js';
import { WalletContext } from '@/context/WalletContext';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { createSimplifiedPool, createRaydiumPool } from '@/utils/raydiumPool';
import Link from 'next/link';
import BN from 'bn.js';
import dynamic from 'next/dynamic';

// Fee constants - similar to pump.fun model
const BASE_MINT_FEE = 0.1; // 0.1 SOL base fee
const LIQUIDITY_PERCENTAGE = 0.9; // 90% of fees go to liquidity
const ADVANCED_OPTION_FEE = 0.1; // 0.1 SOL per advanced option
// Add the approximate cost for Raydium pool creation (rent exemption for all accounts)
const RAYDIUM_POOL_CREATION_COST = 1.9; // 1.9 SOL to cover all rent exemption costs

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Define constants locally since they're not exported
const TYPE_SIZE = 1; // Size of the type discriminator
const LENGTH_SIZE = 4; // Size of the length prefix
// Standard mint size for Token Program (not Token-2022)
// const MINT_SIZE = 82; // Fixed size for a mint account in the standard token program

// Raydium constants
const RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
const RAYDIUM_MARKET_PROGRAM_ID = new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX');

// Define a No-SSR wrapper to prevent server-side rendering of this component
const CreateCoinFormNoSSR = dynamic(() => Promise.resolve(CreateCoinForm), {
  ssr: false
});

export default function CreateCoinFormWrapper() {
  return <CreateCoinFormNoSSR />;
}

// The actual component (renamed to avoid export conflicts)
function CreateCoinForm() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    supply: 1000000,
    description: '',
    website: '',
    twitter: '',
    telegram: '',
  });
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [mintAddress, setMintAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [mintAddressCopied, setMintAddressCopied] = useState(false);
  const [totalFee, setTotalFee] = useState(BASE_MINT_FEE);
  const [advancedOptions, setAdvancedOptions] = useState({
    revokeMintAuthority: false,
    revokeFreezeAuthority: false,
    makeImmutable: false,
  });
  
  // New state variables for supply retention dialog
  const [showRetentionDialog, setShowRetentionDialog] = useState(false);
  const [retentionPercentage, setRetentionPercentage] = useState(20);
  const [retentionFee, setRetentionFee] = useState(0);
  const [baseFee, setBaseFee] = useState(BASE_MINT_FEE);
  
  // Add status updates for progress tracking
  const [statusUpdate, setStatusUpdate] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const totalProgressSteps = 5; // Total steps in the process
  
  const { walletAddress: contextWalletAddress } = useContext(WalletContext) || {};
  
  useEffect(() => {
    if (contextWalletAddress) {
      setWalletAddress(contextWalletAddress);
    }
  }, [contextWalletAddress]);

  // Initialize retention fee on component mount
  useEffect(() => {
    // Initialize retention fee with default percentage
    const initialFee = calculateRetentionFee(20);
    setRetentionFee(initialFee);
  }, []);

  // Calculate fees based on selected options
  useEffect(() => {
    let fee = BASE_MINT_FEE;
    
    // Add fees for advanced options (0.1 SOL each)
    if (advancedOptions.revokeMintAuthority) {
      fee += ADVANCED_OPTION_FEE;
    }
    if (advancedOptions.revokeFreezeAuthority) {
      fee += ADVANCED_OPTION_FEE;
    }
    if (advancedOptions.makeImmutable) {
      fee += ADVANCED_OPTION_FEE;
    }
    
    // Include Raydium pool creation cost
    fee += RAYDIUM_POOL_CREATION_COST;
    
    setBaseFee(fee);
    setTotalFee(fee + retentionFee);
  }, [advancedOptions, retentionFee]);

  // Calculate retention fee based on percentage
  const calculateRetentionFee = (percentage) => {
    // Non-linear pricing model - exponential growth
    // At 50% retention, fee should be ~8 SOL
    // Using an exponential function: f(x) = a * e^(b*x) where x is percentage/100
    // Solving for a and b to get f(0.5) = 8:
    // 8 = a * e^(0.5*b)
    // We can set a = 0.1 (base fee) and solve for b:
    // 8 = 0.1 * e^(0.5*b)
    // 80 = e^(0.5*b)
    // ln(80) = 0.5*b
    // b = ln(80)/0.5 ≈ 8.77

    const a = 0.1; // Base fee
    const b = 8.77; // Exponential factor
    const x = percentage / 100;
    
    // Exponential growth function
    const fee = a * Math.exp(b * x) - a; // Subtract a to make it start at 0
    
    return parseFloat(fee.toFixed(2));
  };

  // Handler for retention percentage changes
  const handleRetentionChange = (event, newValue) => {
    setRetentionPercentage(newValue);
    const newFee = calculateRetentionFee(newValue);
    setRetentionFee(newFee);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'supply' ? Number(value) : value
    });
  };

  const handleImageUpload = async (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];

      // Check if the image is square
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = async () => {
        const { width, height } = img;

        if (width !== height) {
          alert("Please upload a square image. The image will be cropped to a square.");
        }

        // Compress and resize the image to 250x250
        const options = {
          maxWidthOrHeight: 250,
          useWebWorker: true,
          fileType: 'image/jpeg',
          initialQuality: 0.8,
        };

        try {
          const compressedFile = await imageCompression(file, options);
          setImageFile(compressedFile);
        } catch (error) {
          console.error("Error compressing image:", error);
          setError("Failed to process the image. Please try again.");
        }
      };
    }
  };

  // Initialize token creation process
  const initializeTokenCreation = () => {
    if (!window.solana) {
      setError("Please install a Solana wallet like Phantom!");
      return;
    }
    
    // Show the retention dialog instead of immediately starting token creation
    setShowRetentionDialog(true);
  };

  // Close the dialog and proceed with token creation
  const handleProceedWithCreation = () => {
    setShowRetentionDialog(false);
    handleMintToken();
  };

  // Close the dialog and cancel token creation
  const handleCancelCreation = () => {
    setShowRetentionDialog(false);
    setRetentionPercentage(20); // Reset to default
    setRetentionFee(calculateRetentionFee(20));
  };

  const handleMintToken = async () => {
    if (!window.solana) {
      setError("Please install a Solana wallet like Phantom!");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");
    setProgressStep(0);
    setStatusUpdate("Initializing...");

    try {
      console.log("Starting token creation process with automatic Raydium pool...");
      setStatusUpdate("Starting token creation process. This may take up to 2 minutes.");
      console.log("This process may take up to 2 minutes to complete. Please be patient and keep the wallet window open.");
      
      // Add pre-flight verification
      if (!window.solana.isConnected) {
        try {
          await window.solana.connect();
          console.log("Reconnected to wallet");
        } catch (connectError) {
          console.error("Failed to reconnect to wallet:", connectError);
          setError("Failed to connect to your wallet. Please refresh and try again.");
          setLoading(false);
          return;
        }
      }
      
      const userPublicKey = new PublicKey(walletAddress);
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
        { 
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000 // 60 second timeout
        }
      );

      // Calculate fee in lamports - now includes retention fee
      const feeInLamports = totalFee * LAMPORTS_PER_SOL;
      console.log(`Collecting fee: ${totalFee} SOL (${feeInLamports} lamports)`);
      console.log(`Retention fee: ${retentionFee} SOL for keeping ${retentionPercentage}% of supply`);

      // Check user's SOL balance with a safety margin for transaction fees
      const userBalance = await connection.getBalance(userPublicKey);
      console.log(`User balance: ${userBalance / LAMPORTS_PER_SOL} SOL`);
      
      // Add a small buffer for transaction fees (0.01 SOL)
      const requiredBalance = feeInLamports + (0.01 * LAMPORTS_PER_SOL);
      
      if (userBalance < requiredBalance) {
        setError(`Insufficient SOL balance. You need at least ${totalFee + 0.01} SOL to create this token, but your wallet has ${(userBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL. The Raydium pool creation requires ${RAYDIUM_POOL_CREATION_COST} SOL for account rent.`);
        setLoading(false);
        return;
      }

      // Define Pinata API endpoint and headers
      const pinataUrl = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
      const pinataHeaders = {
        headers: {
          'Content-Type': 'multipart/form-data',
          pinata_api_key: process.env.NEXT_PUBLIC_PINATA_API_KEY,
          pinata_secret_api_key: process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY,
        },
      };

      // Step 0: Upload image to IPFS using Pinata (if provided)
      let imageUri = '';
      if (imageFile) {
        console.log("Step 0: Uploading image to IPFS using Pinata...");
        setStatusUpdate("Uploading image to IPFS...");
        setProgressStep(1);

        const formData = new FormData();
        formData.append('file', imageFile);

        const imageResponse = await axios.post(pinataUrl, formData, pinataHeaders);
        const imageIpfsHash = imageResponse.data.IpfsHash;
        imageUri = `https://ipfs.io/ipfs/${imageIpfsHash}`;
        console.log("Image uploaded to IPFS:", imageUri);
      }

      // Step 0.5: Upload metadata JSON to IPFS
      // Enhanced metadata format with social links and description
      const metadata = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description || `${formData.name} Token`,
        image: imageUri,
        external_url: formData.website || "",
        attributes: [
          {
            trait_type: "Token Type", 
            value: "Fungible"
          }
        ],
        seller_fee_basis_points: 0,
        properties: {
          files: [
            {
              uri: imageUri,
              type: "image/jpeg"
            }
          ],
          category: "image",
          creators: [
            {
              address: userPublicKey.toString(),
              share: 100,
              verified: true
            }
          ],
          links: {
            website: formData.website || "",
            twitter: formData.twitter || "",
            telegram: formData.telegram || ""
          }
        }
      };

      // Convert metadata to JSON and upload to Pinata
      const metadataJson = JSON.stringify(metadata);
      const metadataBlob = new Blob([metadataJson], { type: 'application/json' });
      const metadataFile = new File([metadataBlob], 'metadata.json');

      const metadataFormData = new FormData();
      metadataFormData.append('file', metadataFile);

      const metadataResponse = await axios.post(pinataUrl, metadataFormData, pinataHeaders);
      const metadataIpfsHash = metadataResponse.data.IpfsHash;
      const metadataUri = `https://ipfs.io/ipfs/${metadataIpfsHash}`;
      console.log("Metadata uploaded to IPFS:", metadataUri);

      // Step 1: Create the token using Metaplex
      console.log("Step 1: Creating token with metadata using Metaplex...");
      setStatusUpdate("Creating token and minting initial supply...");
      setProgressStep(Math.min(progressStep + 1, 3));

      // Initialize Metaplex
      const metaplex = Metaplex.make(connection);

      // Create a wallet adapter for the Metaplex SDK
      const walletAdapter = {
        publicKey: userPublicKey,
        signTransaction: async (tx) => {
          return await window.solana.signTransaction(tx);
        },
        signAllTransactions: async (txs) => {
          return await window.solana.signAllTransactions(txs);
        }
      };

      // Set the wallet adapter in Metaplex
      metaplex.use({
        install(metaplex) {
          metaplex.identity().setDriver({
            publicKey: walletAdapter.publicKey,
            signTransaction: walletAdapter.signTransaction,
            signAllTransactions: walletAdapter.signAllTransactions,
          });
        }
      });

      // Generate a keypair for the mint
      const mintKeypair = Keypair.generate();
      
      // Log for debugging
      console.log("Generated mint keypair with public key:", mintKeypair.publicKey.toString());
      
      // Following pump.fun's approach: Create a token with the standard Token Program first
      const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
      const createMintAccountInstruction = SystemProgram.createAccount({
        fromPubkey: userPublicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      });
      
      // Initialize mint instruction
      const initializeMintInstruction = createInitializeMintInstruction(
        mintKeypair.publicKey,
        9, // decimals
        userPublicKey,
        userPublicKey,
        TOKEN_PROGRAM_ID
      );
      
      // Create associated token account for the user
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        userPublicKey,
        false,
        TOKEN_PROGRAM_ID
      );
      
      const createATAInstruction = createAssociatedTokenAccountInstruction(
        userPublicKey,
        associatedTokenAddress,
        userPublicKey,
        mintKeypair.publicKey,
        TOKEN_PROGRAM_ID
      );
      
      // Modify the token supply distribution based on the retention percentage
      // Calculate how many tokens to keep for the creator and how many for the bonding curve
      const totalSupply = Number(formData.supply);
      const creatorRetention = Math.floor(totalSupply * (retentionPercentage / 100));
      const bondingCurveSupply = totalSupply - creatorRetention;
      
      console.log(`Creator retention: ${creatorRetention} tokens (${retentionPercentage}%)`);
      console.log(`Bonding curve supply: ${bondingCurveSupply} tokens (${100 - retentionPercentage}%)`);
      
      // Mint tokens to the associated token account
      const mintToInstruction = createMintToInstruction(
        mintKeypair.publicKey,
        associatedTokenAddress,
        userPublicKey,
        BigInt(Number(formData.supply) * Math.pow(10, 9)),
        [],
        TOKEN_PROGRAM_ID
      );
      
      // Create transaction with mint setup instructions
      const setupTx = new Transaction().add(
        createMintAccountInstruction,
        initializeMintInstruction,
        createATAInstruction,
        mintToInstruction
      );
      
      setupTx.feePayer = userPublicKey;
      setupTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      
      // Need to partially sign with the mint keypair
      setupTx.partialSign(mintKeypair);
      
      // Send transaction to set up the token
      console.log("Sending transaction to create token and mint supply...");
      const { signature: setupSig } = await window.solana.signAndSendTransaction(setupTx);
      console.log("Token setup transaction signature:", setupSig);
      
      // Add longer timeout and retry logic for confirmations
      console.log("Confirming transaction with extended timeout...");
      try {
        // First try with longer timeout
        await confirmTransactionWithRetry(connection, setupSig, 'confirmed', 60000);
      } catch (confirmError) {
        console.warn("Initial confirmation timed out, checking transaction status...");
        
        // If initial confirmation fails, check if the transaction actually succeeded
        const status = await checkTransactionStatus(connection, setupSig);
        if (!status) {
          console.error("Transaction failed or not found:", setupSig);
          throw new Error(`Token creation transaction failed. Please check signature ${setupSig} on Solana Explorer.`);
        } else {
          console.log("Transaction was actually successful despite timeout!");
        }
      }
      
      console.log("Token created and supply minted successfully!");
      
      // Verify that the mint account exists and is initialized correctly
      try {
        const mintInfo = await connection.getAccountInfo(mintKeypair.publicKey);
        console.log("Mint account exists:", !!mintInfo);
        if (mintInfo) {
          console.log("Mint account size:", mintInfo.data.length);
        }
        
        // Verify that the token account exists
        const tokenAccountInfo = await connection.getAccountInfo(associatedTokenAddress);
        console.log("Token account exists:", !!tokenAccountInfo);
        if (tokenAccountInfo) {
          console.log("Token account data size:", tokenAccountInfo.data.length);
        }
      } catch (verificationError) {
        console.error("Error verifying accounts:", verificationError);
      }
      
      // Now add metadata using Metaplex (this is what makes it show up properly in wallets)
      console.log("Adding metadata to token...");
      
      try {
        // Using Metaplex to create metadata for the token (this connects to the Token Metadata Program)
        console.log("Creating metadata with the following parameters:", {
          uri: metadataUri,
          name: formData.name,
          symbol: formData.symbol,
          mintAddress: mintKeypair.publicKey.toString(),
        });
        
        // Use createSft method which is better for fungible tokens
        const { nft } = await metaplex.nfts().createSft({
          uri: metadataUri,
          name: formData.name,
          symbol: formData.symbol,
          sellerFeeBasisPoints: 0, // No royalties
          useExistingMint: mintKeypair.publicKey,
          creators: [
            {
              address: userPublicKey,
              share: 100,
              verified: true,
            }
          ],
          isMutable: true,
          decimals: 9, // Make sure this matches what was created earlier
        });

        console.log("Metadata added successfully!", nft);
        
        // Try to verify the creator to ensure the token appears properly in wallets
        try {
          console.log("Verifying creator...");
          await metaplex.nfts().verifyCreator({
            mintAddress: mintKeypair.publicKey,
            creator: metaplex.identity(),
          });
          console.log("Creator verified successfully!");
        } catch (verifyError) {
          console.log("Error verifying creator (but metadata was created):", verifyError.message);
          // This error is expected in some cases, so we don't need to throw
        }
      } catch (metadataError) {
        console.error("Error adding metadata (but token was created):", {
          message: metadataError.message,
          stack: metadataError.stack,
          cause: metadataError.cause
        });
        // Continue execution since the token itself was created successfully
      }

      // Create a real Raydium pool - no fallback to simplified pool
      const signTransaction = async (tx) => window.solana.signTransaction(tx);
      
      console.log("Creating real Raydium pool...");
      setStatusUpdate("Creating Raydium liquidity pool for automatic DEX listing...");
      setProgressStep(4);
      console.log(`Creating pool with ${Math.floor(feeInLamports * LIQUIDITY_PERCENTAGE)} SOL and tokens`);
      
      // Calculate token distribution based on retention percentage
      const totalSupplyBN = new BN(Number(formData.supply));
      const creatorRetentionBN = totalSupplyBN.muln(retentionPercentage).divn(100);
      const bondingCurveSupplyBN = totalSupplyBN.sub(creatorRetentionBN);
      const liquidityAmount = Math.floor(feeInLamports * LIQUIDITY_PERCENTAGE);
      const platformFee = Math.floor(feeInLamports - liquidityAmount);
      
      // First send the platform fee separately
      if (platformFee > 0) {
        // Create a platform fee address (your company wallet)
        const platformFeeAddress = new PublicKey('314ExQUzPDpVwU5sSCwFUWyHfwN53Dxgsj7iUiJ9pbXr');
        
        const platformFeeTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: userPublicKey,
            toPubkey: platformFeeAddress,
            lamports: platformFee,
          })
        );
        
        platformFeeTx.feePayer = userPublicKey;
        platformFeeTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        console.log("Sending platform fee transaction...");
        const { signature: platformFeeTxSig } = await window.solana.signAndSendTransaction(platformFeeTx);
        console.log("Platform fee transaction signature:", platformFeeTxSig);
        
        try {
          await confirmTransactionWithRetry(connection, platformFeeTxSig, 'confirmed', 60000);
        } catch (confirmError) {
          console.warn("Platform fee confirmation timed out, checking transaction status...");
          
          // If confirmation fails, check if the transaction actually succeeded
          const status = await checkTransactionStatus(connection, platformFeeTxSig);
          if (!status) {
            console.error("Platform fee transaction failed:", platformFeeTxSig);
            // Continue with token creation even if platform fee fails
            console.log("Continuing with token creation despite platform fee failure");
          } else {
            console.log("Platform fee transaction was successful despite timeout!");
          }
        }
      }

      let poolDetails = {};
      
      try {
        const poolResult = await createRaydiumPool({
          connection,
          userPublicKey,
          mintKeypair, // We need the full keypair
          tokenDecimals: 9,
          tokenAmount: BigInt(bondingCurveSupplyBN.mul(new BN(10).pow(new BN(9))).toString()),
          solAmount: Math.floor(liquidityAmount),
          signTransaction
        });
        
        console.log("Raydium pool created successfully!");
        console.log("Market ID:", poolResult.marketId.toString());
        console.log("AMM ID:", poolResult.ammId.toString());
        console.log("LP Mint:", poolResult.lpMint.toString());
        
        poolDetails = {
          marketId: poolResult.marketId.toString(),
          ammId: poolResult.ammId.toString(),
          lpMint: poolResult.lpMint.toString()
        };
      } catch (error) {
        console.error("Error creating Raydium pool:", error);
        
        // Don't fail silently - this is important for testing
        setError(`Error creating Raydium pool: ${error.message}. Check console for details.`);
        setLoading(false);
        
        // Re-throw the error to prevent continuing with token creation
        throw error;
      }

      // Store the mint address
      const mintAddress = mintKeypair.publicKey;
      console.log("Final Mint Address:", mintAddress.toString());
      setMintAddress(mintAddress.toString());

      // Save token information to localStorage for display on homepage
      try {
        // Get existing tokens or initialize empty array
        const existingTokensStr = localStorage.getItem('createdTokens');
        const existingTokens = existingTokensStr ? JSON.parse(existingTokensStr) : [];
        
        // Create token object with essential display information
        const newToken = {
          mintAddress: mintAddress.toString(),
          name: formData.name,
          symbol: formData.symbol,
          imageUri: imageUri,
          totalSupply: formData.supply,
          createdAt: new Date().toISOString(),
        };
        
        // Add the new token to the beginning of the array (newest first)
        const updatedTokens = [newToken, ...existingTokens];
        
        // Save back to localStorage
        localStorage.setItem('createdTokens', JSON.stringify(updatedTokens));
        console.log("Token saved to localStorage for homepage display");
      } catch (localStorageError) {
        console.error("Non-critical error saving token to localStorage:", localStorageError);
        // Don't fail the process if localStorage fails
      }

      // Apply advanced options if selected
      if (advancedOptions.revokeMintAuthority || advancedOptions.revokeFreezeAuthority || advancedOptions.makeImmutable) {
        console.log("Applying advanced options...");
        setStatusUpdate("Applying advanced token security options...");
        setProgressStep(5);
        
        try {
          const advancedOptionsTx = new Transaction();
          
          // If revoke mint authority is selected, update the mint authority to null
          if (advancedOptions.revokeMintAuthority) {
            console.log("Revoking mint authority...");
            
            advancedOptionsTx.add(
              createSetAuthorityInstruction(
                mintKeypair.publicKey,
                userPublicKey,
                AuthorityType.MintTokens,
                null, // Setting to null revokes the authority
                [],
                TOKEN_PROGRAM_ID
              )
            );
          }
          
          // If revoke freeze authority is selected, update the freeze authority to null
          if (advancedOptions.revokeFreezeAuthority) {
            console.log("Revoking freeze authority...");
            
            advancedOptionsTx.add(
              createSetAuthorityInstruction(
                mintKeypair.publicKey,
                userPublicKey,
                AuthorityType.FreezeAccount,
                null, // Setting to null revokes the authority
                [],
                TOKEN_PROGRAM_ID
              )
            );
          }
          
          // If make immutable is selected, update the token metadata to be immutable
          // This requires using the Metaplex SDK
          if (advancedOptions.makeImmutable) {
            console.log("Making token metadata immutable...");
            
            try {
              // First find the NFT object from the mint
              const nft = await metaplex.nfts().findByMint({ mintAddress: mintKeypair.publicKey });
              
              // Then update it to be immutable
              await metaplex.nfts().update({
                nftOrSft: nft,
                isMutable: false
              });
              
              console.log("Token metadata made immutable");
            } catch (immutableError) {
              console.error("Error making token immutable:", immutableError);
              setSuccessMessage(prev => prev + "\n\nNote: There was an error making your token immutable: " + immutableError.message);
            }
          }
          
          // If we have any authority revocation instructions, send them
          if (advancedOptionsTx.instructions.length > 0) {
            advancedOptionsTx.feePayer = userPublicKey;
            advancedOptionsTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            
            console.log("Sending advanced options transaction...");
            const { signature: advancedOptionsTxSig } = await window.solana.signAndSendTransaction(advancedOptionsTx);
            console.log("Advanced options transaction signature:", advancedOptionsTxSig);
            
            try {
              await confirmTransactionWithRetry(connection, advancedOptionsTxSig, 'confirmed', 60000);
              console.log("Advanced options successfully applied");
            } catch (confirmError) {
              console.warn("Advanced options confirmation timed out, checking transaction status...");
              
              // If confirmation fails, check if the transaction actually succeeded
              const status = await checkTransactionStatus(connection, advancedOptionsTxSig);
              if (!status) {
                console.error("Advanced options transaction failed:", advancedOptionsTxSig);
                throw new Error("Failed to apply advanced options. Please check transaction status.");
              } else {
                console.log("Advanced options transaction was successful despite timeout!");
              }
            }
          }
        } catch (advancedOptionsError) {
          console.error("Error applying advanced options:", advancedOptionsError);
          
          // For production, show this error to the user but don't fail the whole process
          setSuccessMessage(prev => prev + "\n\nNote: There was an error applying some advanced options: " + advancedOptionsError.message);
        }
      }

      // Format success message (update to include the new liquidity info)
      const solscanUrl = `https://solscan.io/token/${mintAddress.toString()}`;
      const successMsg = `Success! Your token "${formData.name}" has been created with the ticker "${formData.symbol}".

Mint Address: ${mintAddress}
${solscanUrl ? `View on Solscan: ${solscanUrl}` : ''}

Token Details:
- Name: ${formData.name}
- Symbol: ${formData.symbol}
- Total Supply: ${formData.supply.toLocaleString()} ${formData.symbol}
- Creator Supply: ${creatorRetentionBN.toString(10)} ${formData.symbol} (${retentionPercentage}%)
- Bonding Curve Supply: ${bondingCurveSupplyBN.toString(10)} ${formData.symbol} (${100 - retentionPercentage}%)
- Decimals: 9
${formData.description ? `- Description: ${formData.description}` : ''}
${formData.website ? `- Website: ${formData.website}` : ''}
${formData.twitter ? `- Twitter: ${formData.twitter}` : ''}
${formData.image ? `- Logo: Uploaded custom image` : ''}
${advancedOptions.makeImmutable ? '- Token has been permanently made immutable' : ''}

Liquidity Pool Details:
- A real Raydium pool was created with ${(totalFee * LIQUIDITY_PERCENTAGE).toFixed(3)} SOL
- Your token should be tradable on Birdeye and other Solana DEXes shortly
- Market ID: ${poolDetails.marketId}
- AMM ID: ${poolDetails.ammId}
- LP Mint: ${poolDetails.lpMint}

About Your Token:
- This token has a real Raydium liquidity pool and should be tradable on DEXes
- The token has been minted to your wallet and should appear automatically
- ${LIQUIDITY_PERCENTAGE * 100}% of your payment (${(totalFee * LIQUIDITY_PERCENTAGE).toFixed(3)} SOL) was added as liquidity
- The token can be traded on any Solana DEX that supports Raydium pools
- It may take a few minutes for the token to appear on DEX listings

View on Solscan: ${solscanUrl}`;

      setSuccessMessage(successMsg);
      setSuccess(true);
      setLoading(false);

    } catch (error) {
      console.error("Error creating token:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      });
      
      // Handle different types of errors with more useful messages
      let errorMessage = error.message;
      
      if (error.name === 'WalletConnectionError') {
        errorMessage = 'Wallet connection error. Please make sure your wallet is unlocked and try again.';
      } else if (error.name === 'TransactionExpiredTimeoutError' || error.message.includes('timeout')) {
        errorMessage = 'Transaction timed out. The network might be congested. Your transaction might still complete - check your wallet for updates.';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = `Insufficient SOL balance to complete this transaction. Please make sure you have at least ${totalFee + 0.01} SOL in your wallet.`;
      } else if (error.message.includes('rejected')) {
        errorMessage = 'Transaction was rejected by your wallet. Please try again and approve the transaction.';
      } else if (error.message.includes('simulation failed')) {
        errorMessage = 'Transaction simulation failed. This might be due to a network issue or insufficient funds for fees.';
      }
      
      setError(`Error creating token: ${errorMessage}`);
      
      // Set a recovery state to allow users to retry
      setStatusUpdate("Failed to complete the process. You can try again or check your wallet for details.");
      setLoading(false);
    }
  };

  // Function to copy mint address to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setMintAddressCopied(true);
        setTimeout(() => setMintAddressCopied(false), 2000); // Reset after 2 seconds
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  const handleAdvancedOptionChange = (option) => {
    setAdvancedOptions({
      ...advancedOptions,
      [option]: !advancedOptions[option]
    });
  };

  // Helper function to confirm transaction with retries
  const confirmTransactionWithRetry = async (connection, signature, commitment, timeoutMs = 60000, retries = 3) => {
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
  };
  
  // Helper function to check if a transaction succeeded even if confirmation timed out
  const checkTransactionStatus = async (connection, signature) => {
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
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ 
        p: 4, 
        backgroundColor: 'black', 
        color: 'white', 
        borderRadius: '8px', 
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.25)'
      }}>
        <Typography variant="h4" component="div" gutterBottom sx={{ mb: 3, color: 'white', fontWeight: 'bold' }}>
          Create a New Token
        </Typography>
        
        <Typography variant="body2" component="div" sx={{ color: 'gray.300', mb: 3 }}>
          Create a new token on Solana in just a few clicks. Your token will be minted with a bonding curve and appear in wallets immediately.
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3, backgroundColor: 'rgba(0, 114, 229, 0.1)', color: 'white', '& .MuiAlert-icon': { color: '#0072e5' } }}>
          New! Your token will be automatically listed on Birdeye and other DEXes - no extra steps required!
        </Alert>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="body1" component="div" sx={{ color: 'white', mb: 2 }}>
                Please upload a square image (e.g., 250x250 pixels).
              </Typography>
              <Button
                variant="contained"
                component="label"
                fullWidth
                sx={{ 
                  backgroundColor: 'lime', 
                  color: 'black',
                  py: 1.5,
                  '&:hover': { backgroundColor: '#c0ff00' }
                }}
              >
                Upload Image
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </Button>
            </Box>
            {imageFile && (
              <Box sx={{ mt: 2, position: 'relative' }}>
                <Typography variant="body2" component="div" sx={{ color: 'white', mb: 1 }}>
                  Selected: {imageFile.name}
                </Typography>
                <img
                  src={URL.createObjectURL(imageFile)}
                  alt="Uploaded Preview"
                  style={{ 
                    maxWidth: '100%', 
                    marginTop: '10px', 
                    borderRadius: '8px',
                    aspectRatio: '1/1',
                    objectFit: 'cover'
                  }}
                />
                <Button
                  variant="contained"
                  onClick={() => setImageFile(null)}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'red',
                    color: 'white',
                    minWidth: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'darkred' }
                  }}
                >
                  X
                </Button>
              </Box>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <Grid container spacing={2}>
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
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  name="description"
                  label="Description"
                  value={formData.description}
                  onChange={handleChange}
                  variant="outlined"
                  sx={{ 
                    input: { color: 'white' }, 
                    label: { color: 'rgba(255, 255, 255, 0.7)' },
                    '.MuiInputBase-input': { color: 'white' },
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
                  name="website"
                  label="Website URL"
                  placeholder="https://example.com"
                  value={formData.website}
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
                  name="twitter"
                  label="Twitter URL"
                  placeholder="https://twitter.com/yourusername"
                  value={formData.twitter}
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
                  name="telegram"
                  label="Telegram URL"
                  placeholder="https://t.me/yourgroupname"
                  value={formData.telegram}
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
            </Grid>
          </Grid>

          <Grid item xs={12} sx={{ mb: 2 }}>
            <Divider sx={{ my: 2, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
            
            <Typography variant="h6" component="div" sx={{ color: 'white', mb: 2 }}>
              Advanced Options
            </Typography>
            
            <Alert severity="warning" sx={{ mb: 2, backgroundColor: 'rgba(237, 108, 2, 0.1)', color: 'white', '& .MuiAlert-icon': { color: '#ed6c02' } }}>
              These options permanently modify your token&apos;s properties and cannot be reversed once applied!
            </Alert>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                  <FormControlLabel
                    control={
                      <Checkbox 
                        checked={advancedOptions.revokeMintAuthority}
                        onChange={() => handleAdvancedOptionChange('revokeMintAuthority')}
                        sx={{ 
                          color: 'lime',
                          '&.Mui-checked': { color: 'lime' }
                        }}
                      />
                    }
                    label={
                      <Tooltip title="This will prevent new tokens from being minted in the future, permanently fixing the token supply">
                        <Typography component="div" sx={{ color: 'white' }}>
                          Revoke Mint Authority (+0.1 SOL)
                        </Typography>
                      </Tooltip>
                    }
                  />
                </Paper>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                  <FormControlLabel
                    control={
                      <Checkbox 
                        checked={advancedOptions.revokeFreezeAuthority}
                        onChange={() => handleAdvancedOptionChange('revokeFreezeAuthority')}
                        sx={{ 
                          color: 'lime',
                          '&.Mui-checked': { color: 'lime' }
                        }}
                      />
                    }
                    label={
                      <Tooltip title="This will prevent tokens from being frozen, permanently fixing the token freeze authority">
                        <Typography component="div" sx={{ color: 'white' }}>
                          Revoke Freeze Authority (+0.1 SOL)
                        </Typography>
                      </Tooltip>
                    }
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                  <FormControlLabel
                    control={
                      <Checkbox 
                        checked={advancedOptions.makeImmutable}
                        onChange={() => handleAdvancedOptionChange('makeImmutable')}
                        sx={{ 
                          color: 'lime',
                          '&.Mui-checked': { color: 'lime' }
                        }}
                      />
                    }
                    label={
                      <Tooltip title="This will prevent the token from being updated, permanently fixing the token metadata">
                        <Typography component="div" sx={{ color: 'white' }}>
                          Make Immutable (+0.1 SOL)
                        </Typography>
                      </Tooltip>
                    }
                  />
                </Paper>
              </Grid>
            </Grid>
            
            <Divider sx={{ my: 2, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
            
            <Typography variant="body2" component="div" sx={{ color: 'white', mb: 2, fontStyle: 'italic' }}>
              You will mint a Fungible Asset token that will display in Phantom Wallet with:
              {formData.name && <div>• Name: <strong>{formData.name}</strong></div>}
              {formData.symbol && <div>• Symbol: <strong>{formData.symbol}</strong></div>}
              {formData.supply && <div>• Supply: <strong>{formData.supply}</strong> tokens</div>}
              {imageFile && <div>• Image: The uploaded image will be shown in your wallet</div>}
              {formData.description && <div>• Description: <strong>{formData.description}</strong></div>}
              {formData.website && <div>• Website: <strong>{formData.website}</strong></div>}
              {formData.twitter && <div>• Twitter: <strong>{formData.twitter}</strong></div>}
              {formData.telegram && <div>• Telegram: <strong>{formData.telegram}</strong></div>}
              <div>• The token will be minted to your connected wallet</div>
              <div>• Initial liquidity will be added with a bonding curve</div>
              {advancedOptions.revokeMintAuthority && <div>• Mint authority has been revoked</div>}
              {advancedOptions.revokeFreezeAuthority && <div>• Freeze authority has been revoked</div>}
              {advancedOptions.makeImmutable && <div>• Token has been permanently made immutable</div>}
              <div>• <strong>{LIQUIDITY_PERCENTAGE * 100}%</strong> of the fee goes directly to your token&apos;s liquidity</div>
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ mb: 2, p: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
              <Typography variant="body1" sx={{ mb: 1, color: 'white' }}>
                Fee Breakdown:
              </Typography>
              <Typography variant="body2" component="div" sx={{ color: 'white' }}>
                • Base Fee: <strong>{BASE_MINT_FEE} SOL</strong>
                <br />
                • Raydium Pool Creation: <strong>{RAYDIUM_POOL_CREATION_COST} SOL</strong> <span style={{ fontSize: '0.85em', fontStyle: 'italic' }}>(required for account rent)</span>
                <br />
                • Supply Retention ({retentionPercentage}%): <strong>{retentionFee} SOL</strong>
                {advancedOptions.revokeMintAuthority && <><br />• Revoke Mint Authority: <strong>0.1 SOL</strong></>}
                {advancedOptions.revokeFreezeAuthority && <><br />• Revoke Freeze Authority: <strong>0.1 SOL</strong></>}
                {advancedOptions.makeImmutable && <><br />• Make Immutable: <strong>0.1 SOL</strong></>}
              </Typography>
              
              <Divider sx={{ my: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
              
              <Typography variant="body2" component="div" sx={{ color: 'white' }}>
                • Total: <strong>{totalFee} SOL</strong>
                <div>• Added to Liquidity Pool: <strong>{(totalFee * LIQUIDITY_PERCENTAGE).toFixed(3)} SOL</strong></div>
              </Typography>
            </Box>
            
            <Button
              variant="contained"
              onClick={initializeTokenCreation}
              disabled={loading || !formData.name || !formData.symbol || !formData.supply}
              fullWidth
              sx={{ 
                backgroundColor: 'lime', 
                color: 'black',
                py: 1.5,
                '&:hover': { backgroundColor: '#c0ff00' },
                '&.Mui-disabled': { backgroundColor: '#4c503c', color: 'rgba(0, 0, 0, 0.7)' }
              }}
              startIcon={loading && <CircularProgress size={20} color="inherit" />}
            >
              {loading ? `Processing... ${statusUpdate}` : `Mint Token (Total: ${totalFee.toFixed(2)} SOL)`}
            </Button>
            {loading && (
              <Box sx={{ width: '100%', mt: 2 }}>
                <LinearProgress variant="determinate" value={(progressStep / totalProgressSteps) * 100} 
                  sx={{ 
                    height: 10, 
                    borderRadius: 5,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: 'lime',
                    }
                  }} 
                />
                <Typography variant="body2" color="white" sx={{ mt: 1, textAlign: 'center' }}>
                  {statusUpdate}
                </Typography>
              </Box>
            )}
          </Grid>
        </Grid>

        {success && (
          <Box sx={{ mt: 4, mb: 4, p: 3, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#f5f5f5' }}>
            <Typography variant="h6" color="primary" gutterBottom>
              🎉 Token Created Successfully!
            </Typography>
            <Typography variant="body1" paragraph>
              Your token has been created and should be visible in compatible Solana wallets.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Note:</strong> Your token has a real Raydium liquidity pool and should be tradable on DEXes like Birdeye shortly. You can check your token&apos;s status on Birdeye or Raydium.
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body1" sx={{ mr: 1 }}>
                <strong>Mint Address:</strong> {mintAddress}
              </Typography>
              <IconButton 
                size="small" 
                onClick={() => {
                  copyToClipboard(mintAddress);
                  setSuccessMessage('Address copied to clipboard!');
                  setTimeout(() => setSuccessMessage(''), 3000);
                }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
            
            {successMessage && (
              <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                {successMessage}
              </Typography>
            )}
            
            <Typography variant="body1" sx={{ mt: 2, mb: 1 }}>
              <strong>Add to your wallet:</strong>
            </Typography>
            
            <Typography variant="body2" component="div" sx={{ mb: 2 }}>
              <ol style={{ paddingLeft: '20px', margin: 0 }}>
                <li>Click on the &ldquo;+&rdquo; icon to add a token</li>
                <li>Select &ldquo;Import Token&rdquo;</li>
                <li>Paste your mint address</li>
                <li>Click &ldquo;Import&rdquo;</li>
              </ol>
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 2 }}>
              If you don&apos;t see your token in your wallet immediately, try refreshing or restarting your wallet application.
            </Typography>
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mt: 3, backgroundColor: '#331414', color: 'white' }}>
            {error}
          </Alert>
        )}
      </Box>

      {/* Supply Retention Dialog */}
      <Dialog 
        open={showRetentionDialog} 
        onClose={handleCancelCreation}
        PaperProps={{
          style: {
            backgroundColor: '#121212',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            maxWidth: '600px',
            width: '100%'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'lime' }}>
          Choose How Much Supply To Keep
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body1" component="div" sx={{ mb: 3 }}>
            Decide how much of the token supply you want to keep for yourself.
            The rest will be allocated to the bonding curve for trading.
          </Typography>
          
          <Box sx={{ px: 2, py: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography component="div" gutterBottom>
                  Percentage of supply to keep: <strong>{retentionPercentage}%</strong>
                </Typography>
                <Slider
                  value={retentionPercentage}
                  onChange={handleRetentionChange}
                  aria-labelledby="retention-slider"
                  step={1}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 25, label: '25%' },
                    { value: 50, label: '50%' },
                    { value: 75, label: '75%' },
                    { value: 100, label: '100%' }
                  ]}
                  min={0}
                  max={100}
                  sx={{
                    color: 'lime',
                    '& .MuiSlider-thumb': {
                      backgroundColor: 'lime',
                    },
                    '& .MuiSlider-track': {
                      backgroundColor: 'lime',
                    },
                    '& .MuiSlider-rail': {
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '& .MuiSlider-mark': {
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '& .MuiSlider-markLabel': {
                      color: 'white',
                    },
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="You Keep"
                  value={Math.floor(formData.supply * (retentionPercentage / 100)).toLocaleString()}
                  InputProps={{
                    readOnly: true,
                    endAdornment: <InputAdornment position="end">{formData.symbol || 'tokens'}</InputAdornment>,
                    style: { color: 'white' }
                  }}
                  fullWidth
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
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Bonding Curve Gets"
                  value={Math.floor(formData.supply * ((100 - retentionPercentage) / 100)).toLocaleString()}
                  InputProps={{
                    readOnly: true,
                    endAdornment: <InputAdornment position="end">{formData.symbol || 'tokens'}</InputAdornment>,
                    style: { color: 'white' }
                  }}
                  fullWidth
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
            </Grid>
          </Box>
          
          <Box sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', p: 2, mt: 2, borderRadius: '4px' }}>
            <Typography variant="body2" component="div" sx={{ mb: 1 }}>
              Fee breakdown:
            </Typography>
            <Typography variant="body2" component="div" sx={{ mb: 1 }}>
              • Base Fee: {BASE_MINT_FEE} SOL
              <br />
              • Raydium Pool Creation: {RAYDIUM_POOL_CREATION_COST} SOL
              <br />
              • Supply Retention ({retentionPercentage}%): {retentionFee} SOL
              {advancedOptions.revokeMintAuthority && <><br />• Revoke Mint Authority: 0.1 SOL</>}
              {advancedOptions.revokeFreezeAuthority && <><br />• Revoke Freeze Authority: 0.1 SOL</>}
              {advancedOptions.makeImmutable && <><br />• Make Immutable: 0.1 SOL</>}
            </Typography>
            <Typography variant="h6" component="div" sx={{ color: 'lime', fontWeight: 'bold', mt: 1 }}>
              Total Fee: {(baseFee + retentionFee).toFixed(2)} SOL
            </Typography>
            <Typography variant="body2" component="div" sx={{ mt: 1 }}>
              ({LIQUIDITY_PERCENTAGE * 100}% goes to your token&apos;s liquidity pool)
            </Typography>
          </Box>
          
          <Typography variant="body2" component="div" sx={{ mt: 3, fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.7)' }}>
            Tip: A balanced token distribution (20-30% retention) is often ideal for community-focused projects.
            Higher retention gives you more tokens but can affect market dynamics.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', p: 2 }}>
          <Button 
            onClick={handleCancelCreation} 
            sx={{ color: 'white' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleProceedWithCreation}
            variant="contained"
            sx={{ 
              backgroundColor: 'lime', 
              color: 'black',
              '&:hover': { backgroundColor: '#c0ff00' }
            }}
          >
            Mint Token (Total: {(baseFee + retentionFee).toFixed(2)} SOL)
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
} 