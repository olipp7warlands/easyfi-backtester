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
import { Button, SegmentedControl } from '@/components/ui';
import StrategyConfigurator from '@/components/StrategyConfigurator';
import AuthModal from '@/components/auth/AuthModal';
import BacktestHistory from '@/components/BacktestHistory';
import { useBacktest } from '@/hooks/useBacktest';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseSync } from '@/hooks/useSupabaseSync';

export default function Home() {
  const [tab, setTab] = useState<'config' | 'results' | 'wizard'>('wizard');
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
  } = useBacktest();

  const { user, isConfigured } = useAuth();
  const { saveBacktest } = useSupabaseSync(user);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // First-visit: set tab to Configurador and show welcome banner
  useEffect(() => {
    const visited = localStorage.getItem('easyfi_visited');
    if (!visited) {
      setTab('wizard');
      setShowBanner(true);
      localStorage.setItem('easyfi_visited', 'true');
    }
  }, []);

  async function handleRun() {
    await run();
    setTab('results');
  }

  async function handleSave() {
    if (!user || results.length === 0) return;
    setSaveStatus('saving');
    const { error: saveErr } = await saveBacktest(
      params, results, entryPrice, currentPrice,
      `${params.symbol} · ${params.days}d`,
    );
    setSaveStatus(saveErr ? 'error' : 'saved');
    setTimeout(() => setSaveStatus('idle'), 3000);
  }

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

      {/* ── Welcome banner (first visit only) ── */}
      {showBanner && (
        <div
          className="px-6 py-3 flex items-center gap-4 border-b"
          style={{
            backgroundColor: '#0d1a00',
            borderColor: '#c8f13533',
            borderBottomWidth: 1,
          }}
        >
          <div className="flex-1">
            <span className="text-xs font-mono text-[#c8f135] font-bold mr-2">
              👋 Bienvenido a EasyFi Backtester
            </span>
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
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="text-xs font-mono text-[#555] hover:text-[#888] transition-colors flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <SegmentedControl
            value={tab}
            onChange={(v) => setTab(v as 'config' | 'results' | 'wizard')}
            options={[
              { value: 'wizard',  label: 'Configurador' },
              { value: 'config',  label: 'Configuración' },
              { value: 'results', label: `Resultados${results.length > 0 ? ` (${results.length})` : ''}` },
            ]}
            className="w-96"
          />

          <Button
            variant="primary"
            size="lg"
            onClick={handleRun}
            disabled={isLoading || strategies.length === 0}
          >
            {isLoading ? '⏳ Running…' : '▶ Run Backtest'}
          </Button>

          {/* Save button — only when results exist and user is signed in */}
          {results.length > 0 && isConfigured && (
            user ? (
              <Button
                variant="secondary"
                size="lg"
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? '⏳ Guardando…'
                  : saveStatus === 'saved' ? '✓ Guardado'
                  : saveStatus === 'error' ? '✗ Error'
                  : '↑ Guardar'}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setShowAuthModal(true)}
              >
                ↑ Guardar (inicia sesión)
              </Button>
            )
          )}

          {error && (
            <span className="text-xs font-mono text-[#ff5252]">✗ {error}</span>
          )}
        </div>

        {/* ── WIZARD TAB ── */}
        {tab === 'wizard' && (
          <StrategyConfigurator
            params={params}
            onAddStrategy={addStrategy}
            onRunBacktest={async (strategy) => {
              addStrategy(strategy);
              await run([...strategies, strategy]);
              setTab('results');
            }}
            onGoToConfig={() => setTab('config')}
          />
        )}

        {/* ── CONFIG TAB ── */}
        {tab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlobalParams params={params} onUpdate={updateParams} />
            <StrategyBuilder
              strategies={strategies}
              onAdd={addStrategy}
              onUpdate={updateStrategy}
              onRemove={removeStrategy}
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
                  No results yet. Configure parameters and run the backtest.
                </div>
                <Button variant="primary" onClick={() => setTab('config')}>
                  Go to Configuration
                </Button>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <section>
                  <SectionTitle>Summary</SectionTitle>
                  <SummaryCards results={results} candles={candles} capital={params.capital} />
                </section>

                {/* Price chart — full width, before table */}
                <section>
                  <PriceChart
                    results={results}
                    entryPrice={entryPrice}
                    currentPrice={currentPrice}
                  />
                </section>

                {/* Table */}
                <section>
                  <SectionTitle>Detailed Results</SectionTitle>
                  <ResultsTable
                    results={results}
                    entryPrice={entryPrice}
                    currentPrice={currentPrice}
                    capital={params.capital}
                  />
                </section>

                {/* Charts 2×2 */}
                <section>
                  <SectionTitle>Charts</SectionTitle>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                    <PerfChart results={results} />
                    <FeesChart results={results} />
                    <ILChart results={results} />
                    <ComparisonBarChart results={results} />
                  </div>
                  {/* Full-width */}
                  <div className="flex flex-col gap-4">
                    <PriceRangeChart
                      results={results}
                      entryPrice={entryPrice}
                      currentPrice={currentPrice}
                    />
                    <PnlChart results={results} capital={params.capital} />
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {showHistory && user && (
        <BacktestHistory user={user} onClose={() => setShowHistory(false)} />
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
