import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EasyFi Backtester | Uniswap v3 LP Strategies',
  description: 'Backtest Uniswap v3 liquidity providing strategies with historical data',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
