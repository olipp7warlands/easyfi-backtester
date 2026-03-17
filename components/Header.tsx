'use client';

import type { User } from '@supabase/supabase-js';
import UserMenu from './auth/UserMenu';

interface Props {
  user?: User | null;
  onSignIn?: () => void;
  onOpenHistory?: () => void;
}

export default function Header({ user, onSignIn, onOpenHistory }: Props) {
  return (
    <header className="border-b border-[#222] px-6 py-4 bg-[#0a0a0a]">
      <div className="max-w-screen-2xl mx-auto flex items-center gap-3">
        <div className="flex items-baseline gap-0">
          <span
            className="font-mono font-bold text-2xl tracking-tight"
            style={{ color: '#c8f135' }}
          >
            Easy
          </span>
          <span
            className="font-mono font-bold text-2xl tracking-tight"
            style={{ color: '#e066ff' }}
          >
            Fi
          </span>
        </div>
        <span className="text-[#333] font-mono text-lg">|</span>
        <span className="text-[#555] font-mono text-sm">
          Uniswap v3 LP Backtester
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{
              backgroundColor: '#c8f13522',
              color: '#c8f135',
              border: '1px solid #c8f13544',
            }}
          >
            v3
          </span>
          <span className="text-xs font-mono text-[#444]">v0.1.0</span>

          {user ? (
            <UserMenu user={user} onOpenSaved={onOpenHistory} />
          ) : onSignIn ? (
            <button
              onClick={onSignIn}
              className="text-xs font-mono px-3 py-1 rounded transition-colors"
              style={{
                backgroundColor: '#1a1a1a',
                color: '#888',
                border: '1px solid #2a2a2a',
              }}
            >
              Sign in
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
