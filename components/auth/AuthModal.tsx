'use client';

import { useState } from 'react';
import { Button, Input, FieldLabel } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  onClose: () => void;
}

export default function AuthModal({ onClose }: Props) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    const err =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password);

    setLoading(false);

    if (err) {
      setError(err.message);
    } else if (mode === 'signup') {
      setDone(true);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#111] border border-[#222] rounded-lg p-6 w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-mono font-bold text-sm text-[#c8f135] uppercase tracking-wider">
            {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h2>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-[#ccc] transition-colors font-mono text-sm"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="text-xs font-mono text-[#888] leading-relaxed">
            <p className="text-[#c8f135] mb-2">✓ Cuenta creada</p>
            <p>Revisa tu email para confirmar tu cuenta y luego inicia sesión.</p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4 w-full"
              onClick={() => { setMode('signin'); setDone(false); }}
            >
              Ir a Iniciar sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                value={email}
                onChange={setEmail}
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <FieldLabel>Contraseña</FieldLabel>
              <Input
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs font-mono text-[#ff5252]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-1 font-mono rounded transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm"
              style={{ backgroundColor: '#c8f135', color: '#000' }}
            >
              {loading
                ? '⏳ Procesando…'
                : mode === 'signin'
                ? 'Entrar'
                : 'Crear cuenta'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
                className="text-xs font-mono text-[#555] hover:text-[#888] transition-colors"
              >
                {mode === 'signin'
                  ? '¿Sin cuenta? Crear una →'
                  : '¿Ya tienes cuenta? Iniciar sesión →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
