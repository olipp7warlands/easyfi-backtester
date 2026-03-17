'use client';

import { useState, useRef, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';

interface Props {
  user: User;
  onOpenSaved?: () => void;
}

export default function UserMenu({ user, onOpenSaved }: Props) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = (user.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-colors"
        style={{
          backgroundColor: '#c8f13522',
          color: '#c8f135',
          border: '1px solid #c8f13544',
        }}
        title={user.email}
      >
        {initials}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-40 w-52 bg-[#111] border border-[#222] rounded-lg shadow-xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[#1a1a1a]">
            <div className="text-xs font-mono text-[#555] truncate">{user.email}</div>
          </div>

          {onOpenSaved && (
            <button
              onClick={() => { onOpenSaved(); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-xs font-mono text-[#888] hover:text-[#ccc] hover:bg-[#1a1a1a] transition-colors"
            >
              Backtests guardados
            </button>
          )}

          <div className="px-3 py-2 border-t border-[#1a1a1a]">
            <Button
              variant="danger"
              size="sm"
              className="w-full"
              onClick={() => { signOut(); setOpen(false); }}
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
