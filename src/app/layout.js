import { Inter } from 'next/font/google'
import "./globals.css";
import TopBar from "@/components/TopBar";
import { WalletProvider } from '@/context/WalletContext';
import Head from 'next/head';

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: "CoinBull.app",
  description: "Create, manage, and stake your Solana tokens",
  metadataBase: new URL('https://coinbull.app'),
  applicationName: 'CoinBull',
  manifest: '/phantom-app.json',
  icons: {
    icon: '/images/logo.png',
  },
  other: {
    'phantom-domain-verification': '05232024',
    'phantom-app': 'coinbull.app'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletProvider>
          <TopBar />
          <main style={{ padding: '24px' }}>
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}
