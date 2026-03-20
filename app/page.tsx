'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import GlobalParams from '@/components/GlobalParams';
import StrategyBuilder from '@/components/StrategyBuilder';
import SummaryCards from '@/components/SummaryCards';
import ResultsTable from '@/components/ResultsTable';
import {
  PriceChart,
  PerfChart,
  FeesChart,
  ILChart,
  ComparisonBarChart,
  PriceRangeChart,
  PnlChart,
} from '@/components/charts';
import { Button, SegmentedControl, Input, FieldLabel } from '@/components/ui';
import StrategyConfigurator from '@/components/StrategyConfigurator';
import AuthModal from '@/components/auth/AuthModal';
import BacktestHistory from '@/components/BacktestHistory';
import BacktestDashboard from '@/components/BacktestDashboard';
import { useBacktest } from '@/hooks/useBacktest';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseSync } from '@/hooks/useSupabaseSync';
import type { BacktestParams } from '@/types';

type Tab = 'config' | 'results' | 'wizard' | 'history';

export default function Home() {
  const [tab, setTab] = useState<Tab>('wizard');
  const {
    params,
    strategies,
    results,
    candles,
    entryPrice,
    currentPrice,
    isLoading,
    error,
    run,
    addStrategy,
    updateStrategy,
    removeStrategy,
    updateParams,
    resetParams,
  } = useBacktest();

  const { user, loading, needsOnboarding, updateProfile, isConfigured } = useAuth();
  const { saveBacktest, saveStrategy } = useSupabaseSync(user);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Auto-show AuthModal for unauthenticated users (when Supabase is configured)
  useEffect(() => {
    if (!loading && !user && isConfigured) {
      setShowAuthModal(true);
    }
  }, [loading, user, isConfigured]);

  // Auto-close AuthModal when user authenticates
  useEffect(() => {
    if (user) setShowAuthModal(false);
  }, [user]);

  // Set tab based on onboarding/auth status
  useEffect(() => {
    if (loading) return;
    if (needsOnboarding) {
      setTab('wizard');
      setShowBanner(true);
    } else if (user) {
      setTab((prev) => (prev === 'wizard' ? 'config' : prev));
      setShowBanner(false);
    }
  }, [loading, user, needsOnboarding]);

  // First-visit welcome banner (non-authenticated / Supabase not configured)
  useEffect(() => {
    if (!isConfigured && !loading) {
      const visited = localStorage.getItem('easyfi_visited');
      if (!visited) {
        setTab('wizard');
        setShowBanner(true);
        localStorage.setItem('easyfi_visited', 'true');
      }
    }
  }, [isConfigured, loading]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function handleRun() {
    const hasEmptyName = strategies.some((s) => s.name.trim().length === 0);
    if (hasEmptyName) {
      setNameError(true);
      setTab('config');
      setTimeout(() => setNameError(false), 3000);
      return;
    }
    setNameError(false);
    await run();
    setTab('results');
  }

  async function handleSave(name: string) {
    if (!user || results.length === 0) return;
    setSaveStatus('saving');
    try {
      const { error: saveErr } = await saveBacktest(
        params, results, entryPrice, currentPrice, name,
      );
      setSaveStatus(saveErr ? 'error' : 'saved');
      if (!saveErr) showToast('✓ Backtest guardado');
    } catch (e) {
      console.error('handleSave threw:', e);
      setSaveStatus('error');
    }
    setTimeout(() => setSaveStatus('idle'), 3000);
    setShowSaveModal(false);
  }

  function handleLoadBacktest(loaded: BacktestParams) {
    updateParams(loaded);
    setTab('config');
    showToast('✓ Backtest cargado — ajusta y re-ejecuta');
  }

  const isOnboarding = isConfigured && needsOnboarding;
  const bannerIsOnboarding = isOnboarding && showBanner;

  const tabOptions = [
    { value: 'wizard', label: 'Configurador' },
    { value: 'config', label: 'Configuración' },
    { value: 'results', label: `Resultados${results.length > 0 ? ` (${results.length})` : ''}` },
    ...(user && isConfigured ? [{ value: 'history', label: '📊 Mis Backtests' }] : []),
  ];

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-[#ccc]"
      style={{ fontFamily: 'Courier New, monospace' }}
    >
      <Header
        user={user}
        onSignIn={isConfigured ? () => setShowAuthModal(true) : undefined}
        onOpenHistory={() => setShowHistory(true)}
      />

      {/* ── Welcome / Onboarding banner ── */}
      {showBanner && (
        <div
          className="px-6 py-3 flex items-center gap-4 border-b"
          style={{ backgroundColor: '#0d1a00', borderColor: '#c8f13533', borderBottomWidth: 1 }}
        >
          <div className="flex-1">
            <span className="text-xs font-mono text-[#c8f135] font-bold mr-2">
              {bannerIsOnboarding ? '🚀 Bienvenido a EasyFi' : '👋 Bienvenido a EasyFi Backtester'}
            </span>
            {bannerIsOnboarding ? (
              <span className="text-xs font-mono text-[#666]">
                Completa el configurador para ejecutar tu primer backtest.
                Se guardará automáticamente en tu cuenta.
              </span>
            ) : (
              <span className="text-xs font-mono text-[#666]">
                Usa el{' '}
                <button
                  className="text-[#c8f135] underline underline-offset-2"
                  onClick={() => { setTab('wizard'); setShowBanner(false); }}
                >
                  Configurador
                </button>{' '}
                para obtener recomendaciones personalizadas, o{' '}
                <button
                  className="text-[#888] underline underline-offset-2"
                  onClick={() => { setTab('config'); setShowBanner(false); }}
                >
                  Configuración
                </button>{' '}
                si ya sabes lo que quieres.
              </span>
            )}
          </div>
          {!bannerIsOnboarding && (
            <button
              onClick={() => setShowBanner(false)}
              className="text-xs font-mono text-[#555] hover:text-[#888] transition-colors flex-shrink-0"
            >
              ✕
            </button>
          )}
        </div>
      )}

      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <SegmentedControl
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={tabOptions}
            className="w-auto"
          />

          <Button
            variant="primary"
            size="lg"
            onClick={handleRun}
            disabled={isLoading || strategies.length === 0}
          >
            {isLoading ? '⏳ Ejecutando…' : '▶ Ejecutar backtest'}
          </Button>

          {/* Save button */}
          {results.length > 0 && isConfigured && (
            user ? (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setSaveName(`${params.symbol} · ${params.days}d`);
                  setShowSaveModal(true);
                }}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? '⏳ Guardando…'
                  : saveStatus === 'saved' ? '✓ Guardado'
                  : saveStatus === 'error' ? '✗ Error'
                  : '💾 Guardar backtest'}
              </Button>
            ) : (
              <Button variant="ghost" size="lg" onClick={() => setShowAuthModal(true)}>
                💾 Guardar (inicia sesión)
              </Button>
            )
          )}

          {error && (
            <span className="text-xs font-mono text-[#ff5252]">✗ {error}</span>
          )}
          {nameError && (
            <span className="text-xs font-mono text-[#ff5252]">
              ✗ Por favor asigna un nombre a todas las estrategias
            </span>
          )}
        </div>

        {/* ── WIZARD TAB ── */}
        {tab === 'wizard' && (
          <StrategyConfigurator
            params={params}
            onAddStrategy={addStrategy}
            isOnboarding={isOnboarding}
            onRunBacktest={async (strategy) => {
              addStrategy(strategy);
              const runResult = await run([...strategies, strategy]);
              setTab('results');
              if (isOnboarding && runResult && user) {
                const { error: saveErr } = await saveBacktest(
                  params,
                  runResult.results,
                  runResult.entryPrice,
                  runResult.currentPrice,
                  `${params.symbol} · ${params.days}d`,
                );
                if (!saveErr) showToast('✓ Backtest guardado automáticamente');
                await updateProfile({ onboarding_completed: true });
              }
            }}
            onGoToConfig={() => setTab('config')}
          />
        )}

        {/* ── CONFIG TAB ── */}
        {tab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlobalParams params={params} onUpdate={updateParams} onReset={resetParams} />
            <StrategyBuilder
              strategies={strategies}
              onAdd={addStrategy}
              onUpdate={updateStrategy}
              onRemove={removeStrategy}
              onSaveStrategy={saveStrategy}
              user={user}
              isConfigured={isConfigured}
              highlightEmptyNames={nameError}
            />
          </div>
        )}

        {/* ── RESULTS TAB ── */}
        {tab === 'results' && (
          <div className="flex flex-col gap-6">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="text-5xl mb-4 opacity-20">◎</div>
                <div className="text-[#444] font-mono text-sm mb-4">
                  Sin resultados. Configura los parámetros y ejecuta el backtest.
                </div>
                <Button variant="primary" onClick={() => setTab('config')}>
                  Ir a Configuración
                </Button>
              </div>
            ) : (
              <>
                <section>
                  <SectionTitle>Resumen</SectionTitle>
                  <SummaryCards results={results} candles={candles} capital={params.capital} />
                </section>

                <section>
                  <PriceChart results={results} entryPrice={entryPrice} currentPrice={currentPrice} />
                </section>

                <section>
                  <SectionTitle>Resultados detallados</SectionTitle>
                  <ResultsTable
                    results={results}
                    entryPrice={entryPrice}
                    currentPrice={currentPrice}
                    capital={params.capital}
                  />
                </section>

                <section>
                  <SectionTitle>Gráficas</SectionTitle>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                    <PerfChart results={results} />
                    <FeesChart results={results} />
                    <ILChart results={results} />
                    <ComparisonBarChart results={results} />
                  </div>
                  <div className="flex flex-col gap-4">
                    <PriceRangeChart results={results} entryPrice={entryPrice} currentPrice={currentPrice} />
                    <PnlChart results={results} capital={params.capital} />
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && user && (
          <BacktestDashboard
            user={user}
            onLoadBacktest={handleLoadBacktest}
            onNewTest={() => setTab('config')}
          />
        )}
      </main>

      {/* ── Modals ── */}
      {showAuthModal && (
        <AuthModal closeable onClose={() => setShowAuthModal(false)} />
      )}

      {/* Save backtest modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[#111] border border-[#222] rounded-lg p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono font-bold text-sm text-[#c8f135] uppercase tracking-wider">
                Guardar backtest
              </h2>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-[#555] hover:text-[#ccc] transition-colors font-mono text-sm"
              >
                ✕
              </button>
            </div>
            <div className="mb-4">
              <FieldLabel>Nombre</FieldLabel>
              <Input value={saveName} onChange={setSaveName} placeholder="Mi backtest ETH" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSave(saveName)}
                disabled={saveStatus === 'saving' || !saveName.trim()}
                className="flex-1 font-mono rounded transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm"
                style={{ backgroundColor: '#c8f135', color: '#000' }}
              >
                {saveStatus === 'saving' ? '⏳ Guardando…' : '💾 Guardar'}
              </button>
              <Button variant="ghost" size="sm" onClick={() => setShowSaveModal(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {showHistory && user && (
        <BacktestHistory user={user} onClose={() => setShowHistory(false)} />
      )}

      {/* ── Toast ── */}
      {toastMsg && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg font-mono text-xs"
          style={{ backgroundColor: '#0d1a00', color: '#c8f135', border: '1px solid #2d3a0f' }}
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-mono font-bold text-[#444] uppercase tracking-widest mb-3">
      {children}
    </h2>
  );
}
