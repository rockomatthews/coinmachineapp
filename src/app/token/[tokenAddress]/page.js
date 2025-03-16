'use client';

import React from 'react';
import { Container } from '@mui/material';
import CoinInfo from '../../../components/CoinInfo';

export default function TokenPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <CoinInfo />
    </Container>
  );
} 