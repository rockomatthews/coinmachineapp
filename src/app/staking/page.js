'use client';

import { useState, useEffect, useContext } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Paper, 
  Button, 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Grid,
  Tabs,
  Tab,
  Alert
} from '@mui/material';
import { WalletContext } from '@/context/WalletContext';
import { Connection, PublicKey } from '@solana/web3.js';

export default function StakingPage() {
  const { walletAddress } = useContext(WalletContext);
  const [activeTab, setActiveTab] = useState(0);
  const [userTokens, setUserTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState('');
  const [stakingConfig, setStakingConfig] = useState({
    rewardRate: '',
    lockupPeriod: '',
    minimumStake: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch user's created tokens
  useEffect(() => {
    const fetchUserTokens = async () => {
      if (!walletAddress) return;
      
      try {
        setLoading(true);
        // TODO: Implement token fetching logic
        // This should fetch tokens where the user is the mint authority
        const tokens = []; // Placeholder for actual token fetching
        setUserTokens(tokens);
      } catch (err) {
        setError('Failed to fetch tokens');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserTokens();
  }, [walletAddress]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleConfigureStaking = async () => {
    try {
      setLoading(true);
      setError('');

      // Validate inputs
      if (!selectedToken) {
        throw new Error('Please select a token');
      }
      if (!stakingConfig.rewardRate || !stakingConfig.lockupPeriod || !stakingConfig.minimumStake) {
        throw new Error('Please fill in all staking parameters');
      }

      // TODO: Implement staking configuration
      // 1. Create staking pool
      // 2. Set reward rate
      // 3. Set lockup period
      // 4. Initialize staking contract

      // Placeholder for success message
      console.log('Staking configured successfully');
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const ConfigureStakingTab = () => (
    <Paper sx={{ p: 4, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Configure Staking for Your Token
      </Typography>
      
      <FormControl fullWidth sx={{ mt: 2 }}>
        <InputLabel>Select Token</InputLabel>
        <Select
          value={selectedToken}
          onChange={(e) => setSelectedToken(e.target.value)}
          label="Select Token"
        >
          {userTokens.map((token) => (
            <MenuItem key={token.address} value={token.address}>
              {token.name} ({token.symbol})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label="Reward Rate (% APY)"
        type="number"
        value={stakingConfig.rewardRate}
        onChange={(e) => setStakingConfig({ ...stakingConfig, rewardRate: e.target.value })}
        sx={{ mt: 2 }}
      />

      <TextField
        fullWidth
        label="Lockup Period (days)"
        type="number"
        value={stakingConfig.lockupPeriod}
        onChange={(e) => setStakingConfig({ ...stakingConfig, lockupPeriod: e.target.value })}
        sx={{ mt: 2 }}
      />

      <TextField
        fullWidth
        label="Minimum Stake Amount"
        type="number"
        value={stakingConfig.minimumStake}
        onChange={(e) => setStakingConfig({ ...stakingConfig, minimumStake: e.target.value })}
        sx={{ mt: 2 }}
      />

      <Button
        variant="contained"
        onClick={handleConfigureStaking}
        disabled={loading || !walletAddress}
        sx={{ 
          mt: 3,
          backgroundColor: '#FFD700',
          color: 'black',
          '&:hover': {
            backgroundColor: '#FFCD00'
          }
        }}
      >
        {loading ? 'Configuring...' : 'Configure Staking'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Paper>
  );

  const StakeTokensTab = () => (
    <Paper sx={{ p: 4, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Stake Your Tokens
      </Typography>
      {/* TODO: Implement staking interface for token holders */}
      <Alert severity="info">
        Staking interface coming soon. You'll be able to:
        <ul>
          <li>View available tokens for staking</li>
          <li>See current APY rates</li>
          <li>Stake and unstake tokens</li>
          <li>Track rewards</li>
        </ul>
      </Alert>
    </Paper>
  );

  if (!walletAddress) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Alert severity="warning">
            Please connect your wallet to access staking features
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ textAlign: 'center' }}>
          Token Staking
        </Typography>
        
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          centered
          sx={{ mb: 3 }}
        >
          <Tab label="Configure Staking" />
          <Tab label="Stake Tokens" />
        </Tabs>

        {activeTab === 0 ? <ConfigureStakingTab /> : <StakeTokensTab />}
      </Box>
    </Container>
  );
} 