'use client';

import { useState } from 'react';
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
import { useBacktest } from '@/hooks/useBacktest';

export default function Home() {
  const [tab, setTab] = useState<'config' | 'results' | 'wizard'>('config');
  const {
    params,
    strategies,
    results,
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

  async function handleRun() {
    await run();
    setTab('results');
  }

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-[#ccc]"
      style={{ fontFamily: 'Courier New, monospace' }}
    >
      <Header />

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

          {error && (
            <span className="text-xs font-mono text-[#ff5252]">✗ {error}</span>
          )}
        </div>

        {/* ── WIZARD TAB ── */}
        {tab === 'wizard' && (
          <StrategyConfigurator
            params={params}
            onAddStrategy={addStrategy}
            onRunBacktest={async () => { await run(); setTab('results'); }}
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
                  <SummaryCards results={results} />
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
