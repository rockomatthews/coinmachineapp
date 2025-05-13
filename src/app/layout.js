import { Inter } from 'next/font/google'
import "./globals.css";
import TopBar from "@/components/TopBar";
import { WalletProvider } from '@/context/WalletContext';

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: "CoinBull.app",
  description: "Create, manage, and stake your Solana tokens",
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
