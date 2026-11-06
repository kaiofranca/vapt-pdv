import React, { useState, useMemo } from 'react';
import { AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { KdsHeader } from './components/KdsHeader';
import { FichaCard } from './components/FichaCard';
import { useKdsFichas, useAtualizarStatusFicha } from './hooks/useKdsFichas';
import type { EstacaoFiltro, StatusFichaKds } from './types';

export const ModoKdsPage: React.FC = () => {
  const [estacaoAtiva, setEstacaoAtiva] = useState<EstacaoFiltro>('todas');
  const { data, isLoading, isError, isFetching, refetch } = useKdsFichas(estacaoAtiva);
  const atualizarStatusMut = useAtualizarStatusFicha();

  // Fichas ativas filtradas
  const fichas = data?.fichas || [];
  const resumo = data?.resumo || {};

  // Contadores para o cabeçalho
  const contadoresResumo = useMemo(() => {
    let recebido = 0;
    let em_preparo = 0;
    let pronto = 0;
    let atrasadas = 0;

    fichas.forEach((f) => {
      if (f.status === 'recebido') recebido += 1;
      if (f.status === 'em_preparo') em_preparo += 1;
      if (f.status === 'pronto') pronto += 1;

      const recebidoEm = new Date(f.recebido_em).getTime();
      const segundos = Math.max(0, Math.floor((Date.now() - recebidoEm) / 1000));
      if (segundos >= 900) atrasadas += 1;
    });

    return {
      recebido: resumo.recebido ?? recebido,
      em_preparo: resumo.em_preparo ?? em_preparo,
      pronto: resumo.pronto ?? pronto,
      atrasadas: resumo.atrasadas ?? atrasadas,
    };
  }, [fichas, resumo]);

  const handleAtualizarStatus = (id: number, novoStatus: StatusFichaKds) => {
    atualizarStatusMut.mutate({ id, status: novoStatus });
  };

  return (
    <div className="min-h-screen bg-[#1B140F] text-[#FAF3EB] flex flex-col font-sans selection:bg-amber-500 selection:text-[#1B140F]">
      {/* Cabeçalho da TV KDS */}
      <KdsHeader
        estacaoAtiva={estacaoAtiva}
        onSelecionarEstacao={setEstacaoAtiva}
        resumo={contadoresResumo}
      />

      {/* Banner de Reconexão se o satélite estiver temporariamente inacessível (EARS-KDSUI-11) */}
      {isError && (
        <div className="bg-rose-500/20 border-b border-rose-500/40 px-6 py-2.5 flex items-center justify-between text-xs font-bold text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Reconectando à cozinha... (Tentando novamente em 5 segundos)</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/30 hover:bg-rose-500/40 text-rose-100 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Tentar agora</span>
          </button>
        </div>
      )}

      {/* Grid Principal de Fichas (Visualização Otimizada para TV 1920x1080) */}
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {isLoading && fichas.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold text-[#A89887]">
              Sincronizando fila de preparo com a cozinha...
            </p>
          </div>
        ) : fichas.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-[#3D2D23] rounded-[32px] max-w-2xl mx-auto my-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20 shadow-soft">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white">Tudo em dia na Cozinha!</h2>
            <p className="text-sm text-[#A89887] max-w-md mt-2">
              Nenhum pedido pendente na fila de preparo para a estação{' '}
              <strong className="text-amber-400 capitalize">{estacaoAtiva}</strong>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {fichas.map((ficha) => (
              <FichaCard
                key={ficha.id}
                ficha={ficha}
                onAtualizarStatus={handleAtualizarStatus}
                isLoading={atualizarStatusMut.isPending}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
