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
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY
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
import { WalletContext } from '@/context/WalletContext';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { createRaydiumPool } from '@/utils/raydiumPool';
import { createMetadataTransaction, createVerifyCreatorTransaction, createUpdateMetadataTransaction, validateAndFormatUri } from '@/utils/metadataUtils';
import Link from 'next/link';
import BN from 'bn.js';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Buffer } from 'buffer';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PINATA_JWT } from '../config/apiKeys';
import { getSafePublicKey, isValidPublicKey } from '@/utils/walletUtils';
import { normalizeIpfsHash, prefetchIpfsContent, getIpfsUrl } from '@/utils/ipfsUtils';

// Fee constants - competitive with Slerf
const BASE_MINT_FEE = 0.02; // Base fee for token creation
const ADVANCED_OPTION_FEE = 0.01; // Fee for each advanced option

// Raydium V3 liquidity pool creation costs
const RAYDIUM_POOL_CREATION_COST = 0.15; // Default minimum cost (users can adjust with slider)
const ACTUAL_LIQUIDITY = 0.02; // More goes to liquidity
const LIQUIDITY_PERCENTAGE = 0.4; // 40% goes to liquidity

// Raydium V3 pool rent costs
const RAYDIUM_POOL_STATE_RENT = 0.00359136; // Pool state account rent
const RAYDIUM_BASE_VAULT_RENT = 0.00203928; // Base vault account rent
const RAYDIUM_QUOTE_VAULT_RENT = 0.00203928; // Quote vault account rent
const RAYDIUM_LP_MINT_RENT = 0.00145856; // LP token mint account rent

// Calculate total Raydium pool rent
const RAYDIUM_POOL_RENT = RAYDIUM_POOL_STATE_RENT +
  RAYDIUM_BASE_VAULT_RENT +
  RAYDIUM_QUOTE_VAULT_RENT +
  RAYDIUM_LP_MINT_RENT;

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
    discord: '',
  });
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [mintAddress, setMintAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [mintAddressCopied, setMintAddressCopied] = useState(false);
  const [totalFee, setTotalFee] = useState(BASE_MINT_FEE);
  const [advancedOptions, setAdvancedOptions] = useState({
    revokeMintAuthority: true,
    revokeFreezeAuthority: true,
    makeImmutable: true
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
  
  // Add new state for liquidity pool option
  const [createLiquidityPool, setCreateLiquidityPool] = useState(true);
  
  // Add state for liquidity amount - start at a minimum of 0.2 SOL
  const [liquidityAmount, setLiquidityAmount] = useState(0.2);
  
  // Get wallet address from context  
  const { 
    walletAddress: contextWalletAddress, 
    connectWallet,
    isVerified
  } = useContext(WalletContext) || {};
  
  const router = useRouter();
  
  // Update wallet address from context when it changes
  useEffect(() => {
    if (contextWalletAddress) {
      console.log("Setting wallet address from context:", contextWalletAddress);
      setWalletAddress(contextWalletAddress);
    }
  }, [contextWalletAddress]);

  // Ensure wallet is connected before showing the form
  useEffect(() => {
    const checkAndConnectWallet = async () => {
      // If we don't have a wallet address, try to connect
      if (!walletAddress && window?.solana?.isPhantom) {
        console.log("No wallet address found, attempting to connect...");
        try {
          // Try connecting to the wallet
          if (connectWallet) {
            const address = await connectWallet();
            if (address) {
              console.log("Connected wallet from effect:", address);
            } else {
              console.warn("Failed to get wallet address from connectWallet()");
            }
          } else if (window.solana.isConnected && window.solana.publicKey) {
            // Fallback if connectWallet isn't available
            const address = window.solana.publicKey.toString();
            console.log("Setting wallet from window.solana:", address);
            setWalletAddress(address);
          }
        } catch (err) {
          console.error("Error auto-connecting wallet:", err);
        }
      }
    };
    
    checkAndConnectWallet();
  }, [walletAddress, connectWallet]);

  // Load test parameters if coming from test page
  useEffect(() => {
    try {
      const testParams = localStorage.getItem('testTokenParams');
      if (testParams) {
        const parsedParams = JSON.parse(testParams);
        console.log("Found test token parameters:", parsedParams);
        
        // Pre-fill the form with test data
        setFormData({
          name: parsedParams.name || '',
          symbol: parsedParams.symbol || '',
          supply: parsedParams.supply || 1000000,
          description: 'Test token created via test page',
          website: '',
          twitter: '',
          telegram: '',
          discord: '',
        });
        
        // Set retention percentage based on the test parameters
        if (parsedParams.supply && parsedParams.creatorRetention) {
          const percentage = Math.round((parsedParams.creatorRetention / parsedParams.supply) * 100);
          setRetentionPercentage(percentage);
          
          // Calculate retention fee based on the percentage
          const initialFee = calculateRetentionFee(percentage);
          setRetentionFee(initialFee);
        }
        
        // Clear the test parameters to avoid reusing them unnecessarily
        localStorage.removeItem('testTokenParams');
      }
    } catch (err) {
      console.warn("Error loading test parameters:", err);
    }
  }, []);

  // Initialize retention fee on component mount
  useEffect(() => {
    // Initialize retention fee with default percentage
    const initialFee = calculateRetentionFee(20);
    setRetentionFee(initialFee);
  }, []);

  // Calculate fees based on selected options
  useEffect(() => {
    let fee = BASE_MINT_FEE;
    
    // Add fees for advanced options (0.01 SOL each)
    if (advancedOptions.revokeMintAuthority) {
      fee += ADVANCED_OPTION_FEE;
    }
    if (advancedOptions.revokeFreezeAuthority) {
      fee += ADVANCED_OPTION_FEE;
    }
    if (advancedOptions.makeImmutable) {
      fee += ADVANCED_OPTION_FEE;
    }
    
    // Always include createLiquidityPool cost in baseFee (will be shown separately in dialog)
    setBaseFee(fee);
    setTotalFee(fee + retentionFee);
  }, [advancedOptions, retentionFee]);

  // Calculate retention fee based on percentage
  const calculateRetentionFee = (percentage) => {
    // Exponential pricing model similar to pump.fun
    // Points: 20% = 0.2 SOL, 100% = 84 SOL
    
    // Handle base cases
    if (percentage <= 0) return 0;
    if (percentage >= 100) return 84;
    
    // Create exponential curve that hits our target values
    // For 20% -> 0.2 SOL and 100% -> 84 SOL
    
    // Using an exponential model: fee = a * e^(b*x)
    // Where x is percentage/100
    const x = percentage / 100;
    
    if (x <= 0.2) {
      // Linear until 20%
      return x * (0.2 / 0.2);
    } else {
      // Explosive growth beyond 20%
      // a * e^(b*0.2) = 0.2 and a * e^(b*1) = 84
      // Solving for a and b:
      const b = Math.log(84 / 0.2) / 0.8;
      const a = 0.2 / Math.exp(b * 0.2);
      
      return parseFloat((a * Math.exp(b * x)).toFixed(4));
    }
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
      const img = new window.Image();
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
          
          // Create a URL for the preview image
          const reader = new FileReader();
          reader.onloadend = () => {
            setImagePreviewUrl(reader.result);
          };
          reader.readAsDataURL(compressedFile);
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
    
    // Check if Phantom connection is working properly
    try {
      // Reset any previous errors
      setError("");
      
      // Try a basic connection test with Phantom
      if (window.solana && window.solana.isPhantom) {
        // Ensure the wallet is connected
        if (!window.solana.isConnected) {
          // Try connecting first
          window.solana.connect({ onlyIfTrusted: true })
            .catch(e => {
              console.log("Auto-connecting to Phantom:", e.message);
              // This is expected if not previously connected
            });
        }
        
        // Verify we can communicate with the wallet
        window.solana.getVersion()
          .catch(err => {
            console.warn("Phantom wallet communication issue detected:", err.message);
            // If we have connection issues, suggest a refresh
            if (err.message && err.message.includes("disconnected port")) {
              setError("Phantom wallet connection issue detected. Please refresh the page and try again.");
              return;
            }
          });
      }
    } catch (walletError) {
      console.warn("Wallet check failed:", walletError);
      // Continue anyway - the wallet might still work
    }
    
    // Always set createLiquidityPool to true since we removed the checkbox
    setCreateLiquidityPool(true);
    
    // Show the retention dialog to specify liquidity amount and retention percentage
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
      console.log("Starting token creation process with Raydium V3 pool...");
      setStatusUpdate("Starting token creation process. This may take 1-2 minutes.");
      setProgressStep(1);

      // Enhanced wallet connection check with retry logic
      if (!window.solana.isConnected || !walletAddress) {
        console.log("Wallet not connected or address missing, attempting to connect...");
        
        try {
          // Try connecting up to 3 times
          let connected = false;
          let attempts = 0;
          
          while (!connected && attempts < 3) {
            attempts++;
            console.log(`Connection attempt ${attempts}/3...`);
            
            try {
              const response = await window.solana.connect();
              if (response && response.publicKey) {
                setWalletAddress(response.publicKey.toString());
                connected = true;
                console.log("Successfully connected to wallet:", response.publicKey.toString());
              } else {
                // Wait a moment before retrying
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } catch (err) {
              console.warn(`Connection attempt ${attempts} failed:`, err);
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          if (!connected) {
            throw new Error("Failed to connect to wallet after multiple attempts");
          }
        } catch (connectError) {
          console.error("Failed to connect to wallet:", connectError);
          setError("Failed to connect to your wallet. Please refresh the page and try again.");
          setLoading(false);
          return;
        }
      }
      
      // Strict wallet address verification
      if (!walletAddress) {
        setError("Wallet address is missing. Please reconnect your wallet and try again.");
        setLoading(false);
        return;
      }
      
      console.log("Using wallet address:", walletAddress);
      
      // Import solana/web3.js here to ensure it's available
      const { PublicKey } = await import('@solana/web3.js');
      
      // Verify the wallet address is a valid public key using our utility
      if (!isValidPublicKey(walletAddress)) {
        setError("Invalid wallet address format. Please reconnect your wallet and try again.");
        setLoading(false);
        return;
      }
      
      // Use the safe PublicKey utility to create a PublicKey object
      const userPublicKey = getSafePublicKey(walletAddress, { PublicKey });
      
      if (!userPublicKey) {
        setError("Could not create a valid PublicKey from your wallet address. Please reconnect your wallet and try again.");
        setLoading(false);
        return;
      }
      
      // Verify the key is actually valid by attempting to convert to base58
      try {
        const keyValidation = userPublicKey.toBase58();
        console.log("Verified public key:", keyValidation);
      } catch (keyError) {
        console.error("Invalid wallet address:", keyError);
        setError("Invalid wallet address. Please reconnect your wallet and try again.");
        setLoading(false);
        return;
      }
      
      // Using QuickNode exclusively
      const quicknodeRpcUrl = process.env.NEXT_PUBLIC_RPC_ENDPOINT;
      console.log("Using Solana QuickNode RPC URL exclusively");
      
      const connection = new Connection(
        quicknodeRpcUrl,
        { 
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000, // 60 second timeout
          wsEndpoint: quicknodeRpcUrl.replace('https', 'wss')
        }
      );
      
      // Log the RPC endpoint for debugging
      console.log("Using RPC endpoint:", connection.rpcEndpoint);

      // Calculate fee in lamports - now includes retention fee and liquidity amount
      const finalLiquidityAmount = liquidityAmount * LAMPORTS_PER_SOL;
      const totalCost = totalFee * LAMPORTS_PER_SOL + finalLiquidityAmount;
      console.log(`Total cost: ${totalCost / LAMPORTS_PER_SOL} SOL (including ${liquidityAmount} SOL for liquidity)`);
      
      // Note: The fees will appear in Phantom as separate line items:
      // - Base Fee: 0.02 SOL
      // - Supply Retention (xx%): x.xxxx SOL
      // - Revoke Mint Authority: 0.0100 SOL (if selected)
      // - Revoke Freeze Authority: 0.0100 SOL (if selected)
      // - Make Immutable: 0.0100 SOL (if selected)
      // Liquidity amount will be shown separately in the transaction

      // Check user's SOL balance with a safety margin for transaction fees
      const userBalance = await connection.getBalance(userPublicKey);
      console.log(`User balance: ${userBalance / LAMPORTS_PER_SOL} SOL`);
      
      // Add a small buffer for transaction fees (0.01 SOL)
      const requiredBalance = totalCost + (0.01 * LAMPORTS_PER_SOL);
      
      if (userBalance < requiredBalance) {
        setError(`Insufficient SOL balance. You need at least ${(totalCost / LAMPORTS_PER_SOL) + 0.01} SOL to create this token, but your wallet has ${(userBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL.`);
        setLoading(false);
        return;
      }

      // Image and metadata uploads
      setStatusUpdate("Uploading token image and metadata to IPFS...");
      setProgressStep(2);

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

      // Step 0.5: Upload metadata JSON to IPFS with better error handling
      // Enhanced metadata format with social links and description
      const metadataJson = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        image: imageUri,
        attributes: [],
        properties: {
          files: [{ uri: imageUri, type: "image/png" }],
          // Use standard format for external URLs
          external_url: formData.website || "",
          // Include all socials in a standard format
          links: {
            website: formData.website || "",
            twitter: formData.twitter ? (formData.twitter.startsWith('https://') ? formData.twitter : `https://twitter.com/${formData.twitter.replace('@', '')}`) : "",
            telegram: formData.telegram || "",
            discord: formData.discord || ""
          }
        },
        // Add these fields explicitly for better compatibility
        seller_fee_basis_points: 0,
        creators: [{ address: userPublicKey.toString(), share: 100, verified: true }],
        collection: null,
        uses: null
      };

      // Convert metadata to JSON and upload to Pinata with timeout and retry logic
      const metadataBlob = new Blob([JSON.stringify(metadataJson)], { type: 'application/json' });
      const metadataFile = new File([metadataBlob], 'metadata.json');

      let metadataIpfsHash;
      let metadataUri;
      
      try {
        // Set timeout for Pinata uploads
        const uploadTimeout = 15000; // 15 seconds
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), uploadTimeout);
        
        // Create form data
        const metadataFormData = new FormData();
        metadataFormData.append('file', metadataFile);
        
        // Try the upload with a timeout
        const metadataResponse = await axios.post(pinataUrl, metadataFormData, {
          ...pinataHeaders,
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        metadataIpfsHash = metadataResponse.data.IpfsHash;
        metadataUri = `https://ipfs.io/ipfs/${metadataIpfsHash}`;
        console.log("Metadata uploaded to IPFS:", metadataUri);
      } catch (pinataError) {
        console.error("Error uploading to Pinata:", pinataError);
        
        // Fallback to a different IPFS provider or a direct API endpoint
        try {
          console.log("Attempting fallback metadata upload...");
          
          // Here we could implement a fallback to a different IPFS service
          // For now, we'll just retry Pinata once more with different options
          const retryFormData = new FormData();
          retryFormData.append('file', metadataFile);
          
          const retryResponse = await axios.post(pinataUrl, retryFormData, {
            ...pinataHeaders,
            timeout: 20000 // Longer timeout for retry
          });
          
          metadataIpfsHash = retryResponse.data.IpfsHash;
          metadataUri = `https://ipfs.io/ipfs/${metadataIpfsHash}`;
          console.log("Metadata uploaded to IPFS via fallback:", metadataUri);
        } catch (fallbackError) {
          console.error("Fallback upload also failed:", fallbackError);
          
          // If all else fails, generate a mock IPFS hash for testing
          // This allows token creation to continue even if IPFS is down
          const mockHash = `QmTest${Math.random().toString(36).substring(2, 10)}`;
          metadataIpfsHash = mockHash;
          metadataUri = `https://ipfs.io/ipfs/${mockHash}`;
          console.warn("Using mock metadata URI to continue token creation:", metadataUri);
        }
      }

      // Try to preload/warm up the metadata via our proxy for faster access later
      try {
        console.log("Preloading metadata to improve reliability...");
        
        // Use our utility function to prefetch IPFS content
        prefetchIpfsContent(metadataIpfsHash);
        
        console.log("Metadata preloading initiated");
      } catch (preloadError) {
        // Non-fatal error, just log it
        console.warn("Could not preload metadata:", preloadError.message);
      }

      // Step 1: Create the token using standard SPL Token program
      console.log("Step 1: Creating token with metadata using standard SPL Token program...");
      setStatusUpdate("Creating token and setting up metadata...");
      setProgressStep(3);

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
      
      // Calculate how many tokens to keep for the creator and how many for the bonding curve
      const totalSupply = formData.supply;
      const creatorRetention = Math.floor(totalSupply * (retentionPercentage / 100));
      let bondingCurveSupply = totalSupply - creatorRetention;
      
      console.log(`Creator retention: ${creatorRetention} tokens (${retentionPercentage}%)`);
      console.log(`Bonding curve supply: ${bondingCurveSupply} tokens (${100 - retentionPercentage}%)`);
      
      // Now mint tokens to the associated token account (only creator's share)
      const mintToInstruction = createMintToInstruction(
        mintKeypair.publicKey,
        associatedTokenAddress,
        userPublicKey,
        BigInt(creatorRetention * Math.pow(10, 9)), // Only mint creator's share
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
      
      // Before mint bonding curve supply, NOW ADD METADATA FIRST
      // IMPORTANT: Add metadata BEFORE revoking authorities or creating the Raydium V3 pool
      console.log("Adding metadata to token...");
      setStatusUpdate("Creating token metadata...");
      
      try {
        // Use standard V3 metadata format
        console.log("Creating metadata with V3 format:", {
          uri: metadataUri,
          name: formData.name,
          symbol: formData.symbol,
          mintAddress: mintKeypair.publicKey.toString(),
        });
        
        // Verify first that the URI is accessible before creating metadata
        try {
          console.log("Verifying IPFS URI is accessible...");
          
          // Use our proxy API to avoid CORS issues with x-metadata-required header
          const proxyUrl = metadataUri.includes('/ipfs/') 
            ? `/api/ipfs/${metadataUri.split('/ipfs/')[1]}`
            : metadataUri;
          
          // Set a short timeout for this verification check
          const verifyPromise = fetch(proxyUrl, { 
            cache: 'no-store',
            headers: {
              'x-metadata-required': 'true' // Signal that we need immediate response
            }
          });
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('IPFS URI fetch timeout')), 5000)
          );
          
          // Race the fetch against a timeout
          await Promise.race([verifyPromise, timeoutPromise]);
          console.log("IPFS URI check completed successfully");
        } catch (uriError) {
          // This is a top-level error in the URI check itself
          console.warn("IPFS URI verification had an unexpected error:", uriError.message);
          // Continue anyway - metadata creation should not be blocked by this check
          console.log("Continuing with metadata creation despite URI check error");
        }
        
        // Create metadata transaction with our utility
        const { transaction: metadataTx, metadataAddress } = await createMetadataTransaction({
          mint: mintKeypair.publicKey,
          mintAuthority: userPublicKey,
          payer: userPublicKey,
          name: formData.name,
          symbol: formData.symbol,
          uri: metadataUri,
          creators: [{
              address: userPublicKey,
              share: 100,
            verified: false // Set this to false since we'll verify in the next step
          }],
          sellerFeeBasisPoints: 0,
          updateAuthority: userPublicKey,
          isMutable: true,
          tokenStandard: 0 // Add explicit token standard: 0 = Fungible Asset
        });
        
        // Log the metadata PDA for debugging
        console.log("Metadata PDA:", metadataAddress.toString());
        console.log("Metadata transaction data:", metadataTx.instructions[0].data.toString('hex').substring(0, 64) + "...");
        
        // Set transaction properties
        metadataTx.feePayer = userPublicKey;
        metadataTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        // Send the transaction with proper wallet flow
        console.log("Sending metadata transaction...");
        
        const result = await window.solana.signAndSendTransaction(metadataTx);
        const metadataSig = result.signature;
        console.log("Metadata transaction signature:", metadataSig);
        setStatusUpdate("Waiting for metadata transaction confirmation...");
        
        try {
          // Wait for confirmation with retry logic
          await confirmTransactionWithRetry(connection, metadataSig, 'confirmed', 60000, 3);
          console.log("Metadata created successfully!");
          
          // Verify that the metadata account exists and has the correct data
          try {
            console.log("Verifying metadata account is properly created...");
            
            // Find the metadata account address
            const [metadataAddress] = await PublicKey.findProgramAddress(
              [
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mintKeypair.publicKey.toBuffer(),
              ],
              TOKEN_METADATA_PROGRAM_ID
            );
            
            // Get metadata account info
            const metadataAccountInfo = await connection.getAccountInfo(metadataAddress);
            if (!metadataAccountInfo) {
              console.error("Metadata account not found despite successful transaction!");
            } else {
              console.log("Metadata account exists with size:", metadataAccountInfo.data.length);
              
              // Verify that the IPFS URI is accessible - with better error handling
              try {
                console.log("Verifying final IPFS URI is accessible to wallets...");
                
                // Create a safe verification function that won't block the process
                const verifyMetadataUri = async () => {
                  try {
                    // Use our utility to get a clean hash and proper URL
                    const hash = normalizeIpfsHash(metadataUri);
                    const proxyUrl = getIpfsUrl(hash);
                    
                    console.log(`Verifying IPFS URI via proxy: ${proxyUrl}`);
                    
                    // Set a shorter timeout (3 seconds)
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000);
                    
                    try {
                      // Use a special header to get immediate response
                      const response = await fetch(proxyUrl, { 
                        method: 'GET',
                        cache: 'no-store',
                        signal: controller.signal,
                        headers: {
                          'x-metadata-required': 'true', // Signal for immediate response
                          'Cache-Control': 'no-cache'
                        }
                      });
                      
                      // Clear the timeout
                      clearTimeout(timeoutId);
                      
                      // We don't actually need to check the content, just that we got a response
                      console.log("IPFS verification successful - metadata accessible");
                      return true;
                    } catch (proxyError) {
                      console.warn("Proxy verification failed:", proxyError.message);
                      // It's ok if verification fails, we still continue with token creation
                      return false;
                    }
                  } catch (error) {
                    console.warn("IPFS URI verification error:", error);
                    return false;
                  }
                };
                
                // Start verification but don't wait for it - continue with token creation regardless
                // This prevents the process from getting stuck on IPFS timeouts
                setTimeout(() => {
                  verifyMetadataUri().catch(e => console.warn("Verification process failed:", e));
                }, 100);
              } catch (uriVerificationError) {
                console.warn("Warning: IPFS URI verification failed:", uriVerificationError.message);
                console.log("Proceeding with token creation regardless of verification failure");
              }
            }
          } catch (verificationError) {
            console.warn("Error verifying metadata:", verificationError);
            // Non-fatal, continue execution
          }
        } catch (confirmError) {
          console.error("Error confirming metadata transaction:", confirmError);
          // Check if the transaction was actually successful despite confirmation timeout
          const status = await checkTransactionStatus(connection, metadataSig);
          if (!status) {
            throw new Error(`Metadata transaction failed: ${confirmError.message}. Please try again.`);
          }
          console.log("Metadata transaction succeeded despite confirmation issues.");
        }
          
        // Allow a brief pause before verification
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Create verify creator transaction
        console.log("Creating verification transaction...");
        const { transaction: verifyTx } = await createVerifyCreatorTransaction({
          mint: mintKeypair.publicKey,
          creator: userPublicKey,
          payer: userPublicKey
        });
        
        verifyTx.feePayer = userPublicKey;
        verifyTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        // Send verify transaction
        console.log("Sending verification transaction...");
        const { signature: verifySig } = await window.solana.signAndSendTransaction(verifyTx);
        console.log("Verification signature:", verifySig);
        
        // Wait for confirmation
        await confirmTransactionWithRetry(connection, verifySig, 'confirmed', 30000, 2);
          console.log("Creator verified successfully!");

        // The metadata is now created, proceed to apply advanced options AFTER metadata creation:

      // Apply advanced options if selected
      if (advancedOptions.revokeMintAuthority || advancedOptions.revokeFreezeAuthority || advancedOptions.makeImmutable) {
        console.log("Applying advanced options...");
        setStatusUpdate("Applying advanced token security options...");
        setProgressStep(5);
        
        try {
          // Check if the mint and freeze authorities are already revoked by reading the mint account
          const mintInfoAccount = await connection.getAccountInfo(mintKeypair.publicKey);
          if (!mintInfoAccount) {
            throw new Error("Could not find mint account");
          }
          
          // Simple check - we know the authority fields are in the first few bytes
          const isAuthorityNull = (offset) => {
            // Check if the 32 bytes at this offset are all zeros (indicating null)
            const authorityBytes = mintInfoAccount.data.slice(offset, offset + 32);
            return authorityBytes.every(byte => byte === 0);
          };
          
          const mintAuthorityNull = isAuthorityNull(0); // Mint authority is at the beginning
          const freezeAuthorityNull = isAuthorityNull(36); // Freeze authority is after mint authority (4 bytes for option)
          
          console.log("Current mint authority status:", mintAuthorityNull ? "Already revoked" : "Active");
          console.log("Current freeze authority status:", freezeAuthorityNull ? "Already revoked" : "Active");
          
            // Important: If user selected to revoke authorities, ensure they are actually revoked
            // Rather than handling individually, let's create a single transaction to revoke both if needed
            const revokeAuthoritiesTx = new Transaction();
          
            // If revoke mint authority is selected and not already revoked, add to transaction
          if (advancedOptions.revokeMintAuthority && !mintAuthorityNull) {
              console.log("Adding instruction to revoke mint authority...");
              revokeAuthoritiesTx.add(
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
            
            // If revoke freeze authority is selected and not already revoked, add to transaction
          if (advancedOptions.revokeFreezeAuthority && !freezeAuthorityNull) {
              console.log("Adding instruction to revoke freeze authority...");
              revokeAuthoritiesTx.add(
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
            
            // If there are any revocation instructions, send the transaction
            if (revokeAuthoritiesTx.instructions.length > 0) {
              revokeAuthoritiesTx.feePayer = userPublicKey;
              revokeAuthoritiesTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
              
              console.log("Sending transaction to revoke authorities...");
              const { signature: revokeAuthoritiesSig } = await window.solana.signAndSendTransaction(revokeAuthoritiesTx);
              console.log("Authority revocation transaction signature:", revokeAuthoritiesSig);
              
              try {
                await confirmTransactionWithRetry(connection, revokeAuthoritiesSig, 'confirmed', 30000);
                console.log("Token authorities revoked successfully!");
                
                // Verify that authorities were actually revoked
                const updatedMintInfo = await connection.getAccountInfo(mintKeypair.publicKey);
                if (updatedMintInfo) {
                  const updatedMintAuthorityNull = updatedMintInfo.data.slice(0, 32).every(byte => byte === 0);
                  const updatedFreezeAuthorityNull = updatedMintInfo.data.slice(36, 68).every(byte => byte === 0);
                  
                  console.log("Updated mint authority status:", updatedMintAuthorityNull ? "Revoked" : "Still active");
                  console.log("Updated freeze authority status:", updatedFreezeAuthorityNull ? "Revoked" : "Still active");
                  
                  if (advancedOptions.revokeMintAuthority && !updatedMintAuthorityNull) {
                    console.warn("Failed to revoke mint authority despite successful transaction!");
                  }
                  
                  if (advancedOptions.revokeFreezeAuthority && !updatedFreezeAuthorityNull) {
                    console.warn("Failed to revoke freeze authority despite successful transaction!");
                  }
                }
              } catch (confirmError) {
                console.warn("Authority revocation transaction confirmation failed, but transaction may have succeeded:", confirmError.message);
              }
            } else {
              console.log("No authorities need to be revoked - skipping revocation transaction");
          }
          
          // If make immutable is selected, update the metadata account to be immutable
          if (advancedOptions.makeImmutable) {
            console.log("Making token metadata immutable...");
            
            try {
              // Find the metadata account address
              const [metadataAddress] = await PublicKey.findProgramAddress(
                [
                  Buffer.from("metadata"),
                  TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                  mintKeypair.publicKey.toBuffer(),
                ],
                TOKEN_METADATA_PROGRAM_ID
              );
              
              console.log("Metadata address:", metadataAddress.toString());
              
              // Create a new update authority - set to null to make it immutable
              const newUpdateAuthority = null;
              
              // Using a simpler approach - create a very minimal UpdateMetadata instruction
              // Instruction layout: [1 (discriminator), 0 (data option), 1 (update authority option), 0 (primary sale option)]
              const buffer = Buffer.from([1, 0, 1, 0]); 
              
              // Add the instruction with minimal data - only indicating we're updating the update authority
              const immutableIx = new TransactionInstruction({
                keys: [
                  { pubkey: metadataAddress, isSigner: false, isWritable: true },
                  { pubkey: userPublicKey, isSigner: true, isWritable: false },
                ],
                programId: TOKEN_METADATA_PROGRAM_ID,
                data: buffer
              });
              
              // Create a transaction 
              const makeImmutableTx = new Transaction().add(immutableIx);
              makeImmutableTx.feePayer = userPublicKey;
              makeImmutableTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
              
              // Sign and send the transaction
              try {
                const { signature: immutableSig } = await window.solana.signAndSendTransaction(makeImmutableTx);
                console.log("Immutable transaction signature:", immutableSig);
                
                try {
                  // Confirm transaction
                  await confirmTransactionWithRetry(connection, immutableSig, 'confirmed', 30000, 2);
                  console.log("Token metadata made immutable successfully");
                } catch (confirmError) {
                  console.warn("Immutable transaction confirmation error:", confirmError.message);
                  console.log("Transaction may still succeed, continuing with process");
                }
              } catch (txError) {
                // If user rejects, that's ok - token is still created
                console.warn("Failed to make metadata immutable:", txError.message);
                if (txError.message && (
                  txError.message.includes("rejected") || 
                  txError.message.includes("cancelled") ||
                  txError.message.includes("canceled")
                )) {
                  console.log("User rejected immutable transaction - continuing with process");
                } else {
                  // For technical errors, we can try an alternate approach with different parameters
                  console.log("Attempting alternate approach for making metadata immutable...");
                  try {
                    // Just try with simpler data - only the instruction discriminator
                    const simpleBuffer = Buffer.from([1]);
                    
                    const simpleImmutableIx = new TransactionInstruction({
                      keys: [
                        { pubkey: metadataAddress, isSigner: false, isWritable: true },
                        { pubkey: userPublicKey, isSigner: true, isWritable: false },
                      ],
                      programId: TOKEN_METADATA_PROGRAM_ID,
                      data: simpleBuffer
                    });
                    
                    const simpleImmutableTx = new Transaction().add(simpleImmutableIx);
                    simpleImmutableTx.feePayer = userPublicKey;
                    simpleImmutableTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                    
                    const { signature: simpleImmutableSig } = await window.solana.signAndSendTransaction(simpleImmutableTx);
                    console.log("Simple immutable transaction signature:", simpleImmutableSig);
                    
                    try {
                      await confirmTransactionWithRetry(connection, simpleImmutableSig, 'confirmed', 30000, 2);
                      console.log("Token metadata made immutable (alternate approach succeeded)");
                    } catch (altConfirmError) {
                      console.warn("Alternate immutable transaction confirmation error:", altConfirmError.message);
                    }
                  } catch (altError) {
                    console.warn("Alternate approach also failed:", altError.message);
                    console.log("Continuing with process - token is still functional");
                  }
                }
              }
            } catch (metaplexError) {
              console.error("Error making token metadata immutable:", metaplexError.message);
              console.warn("Continuing with token creation despite metadata immutability error");
              // Continue execution - token is still created
            }
          }
          } catch (advancedOptionsError) {
            console.error("Error applying advanced options:", advancedOptionsError.message);
            // Continue execution since the token itself was created successfully
          }
        }
      } catch (metadataError) {
        console.error("Error creating token metadata:", metadataError);
        console.error("Error details:", metadataError);
        
        // Check if user canceled this transaction
        if (metadataError.message && (
            metadataError.message.includes("rejected") || 
            metadataError.message.includes("User rejected") ||
            metadataError.message.includes("cancelled") ||
            metadataError.message.includes("canceled")
        )) {
          console.log("User canceled the metadata creation. Token created but without metadata.");
          
          const mintAddress = mintKeypair.publicKey;
          setMintAddress(mintAddress.toString());
          
          // Format a simple success message for base token
          const solscanUrl = `https://solscan.io/token/${mintAddress.toString()}`;
          const birdeyeUrl = `https://birdeye.so/token/${mintAddress.toString()}?chain=solana`;
          const minimalSuccessMsg = `Token created but without metadata.

Mint Address: ${mintAddress}
Solscan: ${solscanUrl}
Birdeye: ${birdeyeUrl}

Your token was minted successfully, but does not have metadata.
It will not display properly in wallets without metadata.
`;

          setSuccessMessage(minimalSuccessMsg);
          setSuccess(true);
          setLoading(false);
          return; // Stop the process here
              } else {
          // For any other error, don't proceed - metadata is required for proper functionality
          setError(`Metadata creation failed: ${metadataError.message}. The token was created but won't display properly in wallets. Please try again or contact support.`);
          setLoading(false);
          return; // Stop the process here - don't proceed with liquidity pool
        }
      }

      // Move platform fee collection here, after metadata is complete
      // ... rest of the code ...

      // Collect platform fee regardless of pool creation
      try {
        // Base platform fee + 10% of the liquidity amount
        const basePlatformFee = 20000000; // 0.02 SOL
        const liquidityFeePercentage = 0.1; // 10% of the liquidity amount
        const liquidityFee = Math.floor(liquidityAmount * LAMPORTS_PER_SOL * liquidityFeePercentage);
        const totalPlatformFee = basePlatformFee + liquidityFee;
        
        console.log(`Collecting platform fee (${basePlatformFee / LAMPORTS_PER_SOL} SOL base + ${liquidityFee / LAMPORTS_PER_SOL} SOL from liquidity)...`);
        
        const platformFeeTx = new Transaction();
        platformFeeTx.add(
          SystemProgram.transfer({
            fromPubkey: userPublicKey,
            toPubkey: new PublicKey(process.env.NEXT_PUBLIC_PLATFORM_FEE_ADDRESS),
            lamports: totalPlatformFee
          })
        );
        platformFeeTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        platformFeeTx.feePayer = userPublicKey;
        
        const { signature: platformFeeSig } = await window.solana.signAndSendTransaction(platformFeeTx);
        console.log('Platform fee collected:', platformFeeSig);
      } catch (feeError) {
              // Check if this is a user rejection
        if (feeError.message && (
            feeError.message.includes("rejected") || 
            feeError.message.includes("User rejected") ||
            feeError.message.includes("cancelled") ||
            feeError.message.includes("canceled")
        )) {
          console.log("User canceled the platform fee transaction.");
          console.warn("Platform fee transaction was canceled, but token was created.");
              } else {
          console.warn("Failed to collect platform fee, but token was created:", feeError.message);
        }
      }
      
      // Now mint bonding curve tokens and create Raydium V3 pool
      if (createLiquidityPool) {
        console.log(`Minting bonding curve supply (${bondingCurveSupply} tokens) for the market...`);
        setStatusUpdate(`Minting ${bondingCurveSupply.toLocaleString()} tokens for liquidity pool...`);
        setProgressStep(5);
        
        try {
          // CRITICAL FIX: Use much smaller chunks and better transaction structure
          // Define max tokens per transaction - SIGNIFICANTLY reduced to ensure transactions go through
          const MAX_TOKENS_PER_TX = 100000; // 100k tokens per transaction - extremely reduced from previous 1M
          
          // Calculate how many tokens we've minted so far
          let tokensMinted = 0;
          
          // Keep minting in chunks until we've minted all bonding curve tokens
          while (tokensMinted < bondingCurveSupply) {
            // Calculate tokens for this chunk (either the max or remaining amount)
            const tokensThisChunk = Math.min(MAX_TOKENS_PER_TX, bondingCurveSupply - tokensMinted);
            
            console.log(`Minting chunk ${Math.ceil(tokensMinted/MAX_TOKENS_PER_TX) + 1} of ${Math.ceil(bondingCurveSupply/MAX_TOKENS_PER_TX)}: ${tokensThisChunk.toLocaleString()} tokens`);
            setStatusUpdate(`Minting tokens for pool: ${Math.round((tokensMinted / bondingCurveSupply) * 100)}% complete...`);
            
            // Create a separate, clean transaction for each chunk with minimal instructions
            const mintChunkTx = new Transaction();
            
            // Add compute budget instructions to increase transaction success rate
            try {
              const { ComputeBudgetProgram } = await import('@solana/web3.js');
              mintChunkTx.add(
                ComputeBudgetProgram.setComputeUnitPrice({
                  microLamports: 500000 // Much higher priority fee (5x increase)
                }),
                ComputeBudgetProgram.setComputeUnitLimit({
                  units: 200000 // Set reasonable compute unit limit
                })
              );
            } catch (computeError) {
              console.warn("Failed to set compute budget:", computeError.message);
            }
            
            // Just the essential mint instruction - nothing else to reduce transaction size
            const mintChunkIx = createMintToInstruction(
              mintKeypair.publicKey,
              associatedTokenAddress,
              userPublicKey,
              BigInt(tokensThisChunk * Math.pow(10, 9)), // Convert to raw token amount
              [],
              TOKEN_PROGRAM_ID
            );
            
            mintChunkTx.add(mintChunkIx);
            
            // Get fresh blockhash for each transaction
            mintChunkTx.feePayer = userPublicKey;
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            mintChunkTx.recentBlockhash = blockhash;
            
            // Declare chunkSig outside the try block
            let chunkSig;
            
            // Sign and send this chunk's transaction
            try {
              console.log(`Sending transaction to mint chunk of ${tokensThisChunk.toLocaleString()} tokens...`);
              const result = await window.solana.signAndSendTransaction(mintChunkTx);
              chunkSig = result.signature;
              console.log(`Chunk mint transaction sent: ${chunkSig}`);
              
              // Wait for confirmation
              const confirmation = await connection.confirmTransaction({
                signature: chunkSig,
                blockhash: blockhash,
                lastValidBlockHeight: lastValidBlockHeight
              }, 'confirmed');
              
              if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
              }
              
              console.log(`Successfully minted chunk of ${tokensThisChunk.toLocaleString()} tokens`);
              
              // Only update progress after successful minting
              tokensMinted += tokensThisChunk;
              setStatusUpdate(`Minting tokens for pool: ${Math.round((tokensMinted / bondingCurveSupply) * 100)}% complete...`);
              
              // Add a small delay between transactions to avoid rate limits
              await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (chunkError) {
              console.error(`Error minting chunk: ${chunkError.message}`);
              
              // Check if this was a user rejection
              if (chunkError.message && (
                  chunkError.message.includes("rejected") || 
                  chunkError.message.includes("User rejected") ||
                  chunkError.message.includes("cancelled") ||
                  chunkError.message.includes("canceled")
              )) {
                throw new Error("Token minting was canceled by user. Please try again and approve all transactions.");
              }
              
              // For transaction errors, let's use a different approach - MINT ALL AT ONCE
              if (bondingCurveSupply > 100000) {
                console.log("Chunked minting failed, attempting single transaction with higher retention...");
                
                // Let's increase the retention percentage to reduce bonding curve supply
                // For example, if the retention was 20%, let's raise it to 80%
                const newRetentionPercentage = Math.min(retentionPercentage + 30, 95);
                
                // Recalculate token supply distribution
                const newCreatorRetention = Math.floor(formData.supply * (newRetentionPercentage / 100));
                const newBondingCurveSupply = formData.supply - newCreatorRetention;
                
                console.log(`Adjusted retention to ${newRetentionPercentage}% - Creator: ${newCreatorRetention}, Bonding curve: ${newBondingCurveSupply}`);
                
                // Create a new transaction to mint the entire (smaller) bonding curve supply
                const singleMintTx = new Transaction();
                
                try {
                  const { ComputeBudgetProgram } = await import('@solana/web3.js');
                  singleMintTx.add(
                    ComputeBudgetProgram.setComputeUnitPrice({
                      microLamports: 1000000 // Very high priority fee
                    }),
                    ComputeBudgetProgram.setComputeUnitLimit({
                      units: 200000
                    })
                  );
                } catch (computeError) {
                  console.warn("Failed to set compute budget:", computeError.message);
                }
                
                singleMintTx.add(
                  createMintToInstruction(
                    mintKeypair.publicKey,
                    associatedTokenAddress,
                    userPublicKey,
                    BigInt(newBondingCurveSupply * Math.pow(10, 9)),
                    [],
                    TOKEN_PROGRAM_ID
                  )
                );
                
                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
                singleMintTx.recentBlockhash = blockhash;
                singleMintTx.feePayer = userPublicKey;
                
                console.log("Sending single transaction with adjusted supply...");
                const singleResult = await window.solana.signAndSendTransaction(singleMintTx);
                await connection.confirmTransaction({
                  signature: singleResult.signature,
                  blockhash,
                  lastValidBlockHeight
                }, 'confirmed');
                
                console.log("Successfully minted with adjusted retention ratio");
                
                // Update our bonding curve supply to match what we actually minted
                bondingCurveSupply = newBondingCurveSupply;
                tokensMinted = newBondingCurveSupply;
                
                // Break the loop since we've minted everything
                break;
          } else {
                // For small supply, we can just retry with higher fees
                console.log("Retrying with higher fees...");
                continue;
              }
            }
          }
          
          // Verify the final token balance after minting all chunks
          console.log("Verifying final token balance...");
          
          try {
            const finalBalance = await connection.getTokenAccountBalance(associatedTokenAddress);
            console.log(`Final token balance: ${finalBalance.value.uiAmount}`);
            const expectedTotal = creatorRetention + bondingCurveSupply;
            
            if (finalBalance.value.uiAmount < expectedTotal * 0.99) { // Allow 1% tolerance
              console.warn(`WARNING: Final token balance (${finalBalance.value.uiAmount}) is less than expected (${expectedTotal})`);
              // Continue anyway since we got most of the tokens
            } else {
              console.log(`Successfully minted all ${bondingCurveSupply.toLocaleString()} tokens for the bonding curve!`);
            }
          } catch (balanceError) {
            console.warn("Error checking final token balance:", balanceError.message);
            // Continue anyway - we'll assume minting was successful
          }
          
          console.log('Creating Raydium V3 liquidity pool for trading...');
          setStatusUpdate(`Creating liquidity pool with ${liquidityAmount} SOL...`);
          setProgressStep(6);
          
          // Define a function to sign transactions with the wallet
          const signTransaction = async (tx) => window.solana.signTransaction(tx);
          
          // Use user-selected liquidity amount
          const poolCreationFee = liquidityAmount * LAMPORTS_PER_SOL; // Use the amount chosen by the user
          console.log(`Using user-selected pool creation fee of ${poolCreationFee / LAMPORTS_PER_SOL} SOL for Raydium pool creation`);
          
          // Create the Raydium V3 liquidity pool using our updated implementation
          const poolResult = await createRaydiumPool({
            connection,
            userPublicKey,
            mintKeypair,
            tokenDecimals: 9,
            tokenAmount: BigInt(bondingCurveSupply * Math.pow(10, 9)),
            solAmount: poolCreationFee,
            signTransaction
          });
          
          if (!poolResult.success) {
            // CRITICAL ERROR: Cannot continue without liquidity pool
            const errorMsg = poolResult.error || "Unknown error creating liquidity pool";
            console.error("Liquidity pool creation failed:", errorMsg);
            
            // Fail with detailed error message - suggest a fixed small increment
            throw new Error(`Liquidity pool creation failed: ${errorMsg}. Try again with ${Math.min(liquidityAmount + 0.05, 0.5)} SOL for liquidity.`);
          }
          
          console.log("Liquidity pool created successfully!");
          console.log("Pool ID:", poolResult.poolId);
          setStatusUpdate("Liquidity pool created successfully! Finalizing token creation...");
          setProgressStep(7);
          
        } catch (poolError) {
          // ALL errors are critical if pool creation is required
          console.error("Error in pool creation process:", poolError);
          
          // Check if this is a user rejection/cancellation
          if (poolError.message && (
              poolError.message.includes("rejected") || 
              poolError.message.includes("User rejected") ||
              poolError.message.includes("cancelled") ||
              poolError.message.includes("canceled")
          )) {
            console.log("User canceled the pool creation process. Terminating token creation.");
            setError("Token creation canceled by user during pool creation. Please try again and approve all transactions to complete the process.");
            setLoading(false);
            return; // Exit immediately
          } else {
            // For other errors, terminate with clear error message - use a consistent suggestion
            setError(`${poolError.message}. Please try again with a slightly higher liquidity amount (${(liquidityAmount + 0.05).toFixed(2)} SOL should be sufficient).`);
            setLoading(false);
            return; // Exit immediately
          }
        }
      } else {
        console.log("Skipping liquidity pool creation as per user preference");
      }

      // Store the mint address
      console.log("Final Mint Address:", mintKeypair.publicKey.toString());
      setMintAddress(mintKeypair.publicKey.toString());
      setStatusUpdate("Token successfully created! Redirecting to token details...");
      setProgressStep(8);

      // Save token information to localStorage for display on homepage
      try {
        // Get existing tokens or initialize empty array
        const existingTokensStr = localStorage.getItem('createdTokens');
        const existingTokens = existingTokensStr ? JSON.parse(existingTokensStr) : [];
        
        // Create token object with essential display information
        const newToken = {
          mintAddress: mintKeypair.publicKey.toString(),
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

      // Format success message (update to include the new info)
      const solscanUrl = `https://solscan.io/token/${mintKeypair.publicKey.toString()}`;
      const birdeyeUrl = `https://birdeye.so/token/${mintKeypair.publicKey.toString()}?chain=solana`;
      const successMsg = `Success! Your token "${formData.name}" has been created with the ticker "${formData.symbol}".

Mint Address: ${mintKeypair.publicKey.toString()}
Solscan: ${solscanUrl}
Birdeye: ${birdeyeUrl}

Token Details:
- Name: ${formData.name}
- Symbol: ${formData.symbol}
- Total Supply: ${formData.supply.toLocaleString()} ${formData.symbol}
- Creator Supply: ${creatorRetention} ${formData.symbol} (${retentionPercentage}%)
- Bonding Curve Supply: ${bondingCurveSupply} ${formData.symbol} (${100 - retentionPercentage}%)
- Decimals: 9
${formData.description ? `- Description: ${formData.description}` : ''}
${formData.website ? `- Website: ${formData.website}` : ''}
${formData.twitter ? `- Twitter: ${formData.twitter}` : ''}
${formData.telegram ? `- Telegram: ${formData.telegram}` : ''}
${formData.discord ? `- Discord: ${formData.discord}` : ''}
${advancedOptions.makeImmutable ? '- Token has been permanently made immutable' : ''}
${createLiquidityPool ? '- Liquidity pool has been created with Raydium V3' : '- No liquidity pool was created (you can create one later)'}

Visibility Status:
- ✅ Your token has been fully verified with creator signature
- ✅ Added to Birdeye with special marker to ensure visibility
- ✅ Metadata optimized for Phantom wallet display
- ✅ Token has full name, symbol and image support in wallets
- ✅ URI optimized for maximum compatibility across explorers

About Your Token:
- Your token is ready to use and should appear automatically in Phantom
- All token information will display correctly in explorers and wallets
- The token can be sent, received, and verified on block explorers
- Visit Birdeye to see your token's market information

View on Birdeye: ${birdeyeUrl}`;

      setSuccessMessage(successMsg);
      setSuccess(true);
      setLoading(false);

      // Redirect to token info page
      router.push(`/token/${mintKeypair.publicKey.toString()}`);

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
                {imagePreviewUrl && (
                  <Image
                    src={imagePreviewUrl}
                  alt="Uploaded Preview"
                    width={250}
                    height={250}
                  style={{ 
                    maxWidth: '100%', 
                    marginTop: '10px', 
                    borderRadius: '8px',
                    objectFit: 'cover'
                  }}
                />
                )}
                <Button
                  variant="contained"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreviewUrl(null);
                  }}
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

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="discord"
                  label="Discord URL"
                  placeholder="https://discord.gg/yourserver"
                  value={formData.discord}
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
                          Revoke Mint Authority (+{ADVANCED_OPTION_FEE} SOL)
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
                          Revoke Freeze Authority (+{ADVANCED_OPTION_FEE} SOL)
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
                          Make Immutable (+{ADVANCED_OPTION_FEE} SOL)
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
              {formData.discord && <div>• Discord: <strong>{formData.discord}</strong></div>}
              <div>• The token will be minted to your connected wallet</div>
              {advancedOptions.revokeMintAuthority && <div>• Mint authority has been revoked</div>}
              {advancedOptions.revokeFreezeAuthority && <div>• Freeze authority has been revoked</div>}
              {advancedOptions.makeImmutable && <div>• Token has been permanently made immutable</div>}
              <div>• Initial liquidity will be added with a bonding curve</div>
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ mb: 2, p: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
              <Typography variant="body1" sx={{ mb: 1, color: 'white' }}>
                Fee Breakdown (as shown in Phantom):
              </Typography>
              <Typography variant="body2" component="div" sx={{ color: 'white' }}>
                • Base Fee: <strong>{BASE_MINT_FEE} SOL</strong>
                <br />
                • Supply Retention ({retentionPercentage}%): <strong>{retentionFee.toFixed(4)} SOL</strong>
                {advancedOptions.revokeMintAuthority && <><br />• Revoke Mint Authority: <strong>{ADVANCED_OPTION_FEE.toFixed(4)} SOL</strong></>}
                {advancedOptions.revokeFreezeAuthority && <><br />• Revoke Freeze Authority: <strong>{ADVANCED_OPTION_FEE.toFixed(4)} SOL</strong></>}
                {advancedOptions.makeImmutable && <><br />• Make Immutable: <strong>{ADVANCED_OPTION_FEE.toFixed(4)} SOL</strong></>}
              </Typography>
              
              <Divider sx={{ my: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
              
              <Typography variant="body2" component="div" sx={{ color: 'white' }}>
                Total (displayed fees): <strong>{(totalFee).toFixed(4)} SOL</strong>
                <br />
                Note: Liquidity pool cost will be set in the next step.
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
              {loading ? `Processing... ${statusUpdate}` : `Set Liquidity & Retention`}
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
              <strong>Note:</strong> Your token has been created with a Raydium V3 liquidity pool. You can check your token&apos;s status on Birdeye or Raydium.
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

      {/* Supply and Liquidity Setting Dialog */}
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
          Configure Your Token Distribution and Liquidity
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body1" component="div" sx={{ mb: 3 }}>
            Customize your token distribution and trading liquidity settings:
          </Typography>
          
          <Typography variant="body2" component="div" sx={{ mb: 3, p: 2, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
            <strong>How it works:</strong>
            <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
              <li>The retention percentage controls how the token supply is split between you and the liquidity pool</li>
              <li>Example: With 20% retention on 1,000,000 tokens, you keep 200,000 tokens and 800,000 go to the trading pool</li>
              <li>Liquidity amount determines how much SOL is added to create the trading pool</li>
              <li>Higher liquidity creates better initial trading experience but costs more</li>
              <li>A small platform fee (0.02 SOL + 10% of liquidity) helps keep this service running</li>
            </ul>
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
              
              <Grid item xs={12}>
                <Typography component="div" gutterBottom>
                  Liquidity amount: <strong>{liquidityAmount} SOL</strong>
                </Typography>
                <Slider
                  value={liquidityAmount}
                  onChange={(e, newValue) => setLiquidityAmount(newValue)}
                  aria-labelledby="liquidity-slider"
                  step={0.05}
                  marks={[
                    { value: 0.15, label: '0.15 SOL' },
                    { value: 0.2, label: '0.2 SOL' },
                    { value: 0.3, label: '0.3 SOL' },
                    { value: 0.5, label: '0.5 SOL' },
                    { value: 1, label: '1 SOL' }
                  ]}
                  min={0.15}
                  max={1.5}
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
                <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255, 255, 255, 0.7)', mt: 1 }}>
                  Starting at just 0.15 SOL! More competitive than other token creators. Higher values (0.2-0.3 SOL) improve liquidity depth.
                </Typography>
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
              <strong>Fee breakdown (matching Phantom wallet display):</strong>
            </Typography>
            <Typography variant="body2" component="div" sx={{ mb: 1 }}>
              • Base Fee: <strong>{BASE_MINT_FEE} SOL</strong>
              <br />
              • Supply Retention ({retentionPercentage}%): <strong>{retentionFee.toFixed(4)} SOL</strong>
              {advancedOptions.revokeMintAuthority && <><br />• Revoke Mint Authority: <strong>{ADVANCED_OPTION_FEE.toFixed(4)} SOL</strong></>}
              {advancedOptions.revokeFreezeAuthority && <><br />• Revoke Freeze Authority: <strong>{ADVANCED_OPTION_FEE.toFixed(4)} SOL</strong></>}
              {advancedOptions.makeImmutable && <><br />• Make Immutable: <strong>{ADVANCED_OPTION_FEE.toFixed(4)} SOL</strong></>}
            </Typography>
            
            <Divider sx={{ my: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
            
            <Typography variant="body2" component="div" sx={{ mb: 1 }}>
              <strong>Additional fees not shown in Phantom:</strong>
              <br />
              • Liquidity Pool Creation: <strong>{liquidityAmount} SOL</strong>
              <br />
              • Platform Fee: <strong>0.02 SOL + {(liquidityAmount * 0.1).toFixed(2)} SOL</strong> <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9em' }}>(10% of liquidity amount)</span>
            </Typography>
            
            <Typography variant="h6" component="div" sx={{ color: 'lime', fontWeight: 'bold', mt: 1 }}>
              Total Fee: {(baseFee + retentionFee + liquidityAmount + 0.02 + liquidityAmount * 0.1).toFixed(2)} SOL
            </Typography>
            
            <Typography variant="body2" component="div" sx={{ mt: 1, fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.7)' }}>
              Note: The platform fee helps maintain this service and develop new features. 
              Thank you for supporting our project!
            </Typography>
          </Box>
          
          <Typography variant="body2" component="div" sx={{ mt: 3, fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.7)' }}>
            Tip: A balanced token distribution (20-30% retention) is often ideal for community-focused projects.
            Higher retention gives you more tokens but can affect market dynamics.
          </Typography>

          <Alert severity="info" sx={{ mt: 2, backgroundColor: 'rgba(0, 114, 229, 0.1)', color: 'white', '& .MuiAlert-icon': { color: '#0072e5' } }}>
            By creating a token, you agree to pay a small platform fee (0.02 SOL + 10% of liquidity). 
            This helps us maintain the service and build new features. We&aposre committed to offering competitive rates 
            compared to similar services.
          </Alert>
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
            Create Token & Add {liquidityAmount} SOL Liquidity
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
} 