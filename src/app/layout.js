import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopBar from "@/components/TopBar";
import { WalletProvider } from '@/context/WalletContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "The Coin Agency",
  description: "Create, manage, and stake your memecoins",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <WalletProvider>
          <TopBar />
          <main style={{ paddingTop: '64px' }}>
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}
