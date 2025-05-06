#!/usr/bin/env node
/**
 * CLI utility to test token creation without using the UI
 * Usage: node scripts/test-token-creation.js [wallet-address]
 * 
 * This script helps verify that our token creation process works correctly
 * by showing the expected parameters that would be used in the UI.
 */

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { MINT_SIZE } = require('@solana/spl-token');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Get wallet address from command line args
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error('❌ Error: Please provide a wallet address as an argument');
  console.log('Usage: node scripts/test-token-creation.js [wallet-address]');
  process.exit(1);
}

async function generateTestTokenParams() {
  try {
    // Verify the wallet address is valid
    const userPublicKey = new PublicKey(walletAddress);
    console.log(`✅ Using wallet: ${userPublicKey.toString()}`);

    // Generate a test token with fixed parameters for quick testing
    const name = `Test Token ${new Date().toISOString().slice(0, 19)}`;
    const symbol = 'TEST';
    const supply = 1000000;
    const creatorRetention = 200000; // 20%
    const bondingCurveSupply = supply - creatorRetention;

    // Generate a new token mint keypair
    const mintKeypair = Keypair.generate();
    console.log(`✅ Generated mint: ${mintKeypair.publicKey.toString()}`);

    // Create a dummy IPFS URI for metadata
    const metadataUri = `https://arweave.net/placeholder_metadata_uri`;

    // Print test parameters that would be sent to the form
    console.log('\n==== TOKEN CREATION TEST PARAMETERS ====');
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Total Supply: ${supply.toLocaleString()}`);
    console.log(`Creator Retention: ${creatorRetention.toLocaleString()} (${(creatorRetention / supply * 100).toFixed(1)}%)`);
    console.log(`Bonding Curve Supply: ${bondingCurveSupply.toLocaleString()} (${(bondingCurveSupply / supply * 100).toFixed(1)}%)`);
    console.log(`Mint Address: ${mintKeypair.publicKey.toString()}`);
    console.log(`Metadata URI: ${metadataUri}`);
    console.log('======================================');

    // Write parameters to a file for easy access
    const testParams = {
      name,
      symbol,
      supply,
      creatorRetention,
      bondingCurveSupply,
      mintAddress: mintKeypair.publicKey.toString(),
      metadataUri,
      createdAt: new Date().toISOString()
    };

    const outputPath = path.join(__dirname, 'test-token-params.json');
    fs.writeFileSync(outputPath, JSON.stringify(testParams, null, 2));
    console.log(`\n✅ Test parameters saved to: ${outputPath}`);
    
    console.log('\n📝 Instructions:');
    console.log('1. To test the token creation in the UI:');
    console.log('   - Visit http://localhost:3000/test-token');
    console.log('   - Connect your wallet');
    console.log('   - Click "Generate Test Token Parameters"');
    console.log('   - Click "Continue to Create Coin Form"');
    console.log('2. The form will be pre-filled with test parameters');
    console.log('3. Click "Mint Token" to create the test token');
    console.log('4. Check your wallet to verify the token was created correctly');
    console.log('5. The token should show both your retained supply and the tokens sent to the OpenBook market');

  } catch (error) {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  }
}

// Run the test
generateTestTokenParams(); 