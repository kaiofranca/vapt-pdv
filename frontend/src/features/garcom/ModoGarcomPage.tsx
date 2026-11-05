import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Receipt,
  User,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Users,
} from 'lucide-react';
import { MesasGrid } from './components/MesasGrid';
import { ModalAbrirMesa } from './components/ModalAbrirMesa';
import { ComandaMesaView } from './components/ComandaMesaView';
import { useComandasSalao } from '../../hooks/useComandas';
import { useGarconsAtivos } from '../../hooks/useUsuarios';
import { useSessionStore } from '../../stores/useSessionStore';
import { useComandaStore } from '../../stores/useComandaStore';
import { formatCurrency, formatElapsedTime } from '../../lib/utils';
import type { Comanda } from '../../types/api';

export const ModoGarcomPage: React.FC = () => {
  const { usuarioAtivoId, nomeOperador, setUsuarioAtivo, logout, setModo } = useSessionStore();
  const { comandaAtivaId, setComandaAtivaId, setMesaAtiva } = useComandaStore();

  // Abas da barra inferior: 'salao' | 'comandas' | 'perfil'
  const [abaInferior, setAbaInferior] = useState<'salao' | 'comandas' | 'perfil'>('salao');

  // Controle de exibição da comanda ativa detalhada
  const [visualizandoComanda, setVisualizandoComanda] = useState<boolean>(false);

  // Modal para abrir mesa
  const [isModalAbrirOpen, setIsModalAbrirOpen] = useState(false);
  const [mesaParaAbrir, setMesaParaAbrir] = useState<string>('');

  // Filtro na aba Comandas (G07): 'minhas' | 'todas'
  const [filtroComandas, setFiltroComandas] = useState<'minhas' | 'todas'>('minhas');

  // Feedback Toast
  const [toast, setToast] = useState<{
    tipo: 'sucesso' | 'erro';
    mensagem: string;
  } | null>(null);

  const showToast = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 4000);
  };

  // Queries TanStack Query reais
  const { data: comandas = [], refetch: refetchComandas } = useComandasSalao();
  const { data: garcons = [] } = useGarconsAtivos();

  // Seleciona automaticamente o garçom logado se necessário
  useEffect(() => {
    if (!usuarioAtivoId && garcons.length > 0) {
      setUsuarioAtivo(garcons[0].id, garcons[0].nome, 'garcom');
    }
  }, [usuarioAtivoId, garcons, setUsuarioAtivo]);

  // Abertura de Mesa
  const handleAbrirMesa = (numeroMesa: string) => {
    setMesaParaAbrir(numeroMesa);
    setIsModalAbrirOpen(true);
  };

  // Ao abrir mesa com sucesso na API Fastify
  const handleMesaAbertaComSucesso = (novaComanda: Comanda) => {
    setIsModalAbrirOpen(false);
    setMesaAtiva(String(novaComanda.mesa));
    setComandaAtivaId(novaComanda.id);
    setVisualizandoComanda(true);
    refetchComandas();
    showToast('sucesso', `Mesa ${novaComanda.mesa} aberta com sucesso!`);
  };

  // Ao clicar em uma mesa com comanda aberta
  const handleVerComanda = (comanda: Comanda) => {
    setMesaAtiva(String(comanda.mesa));
    setComandaAtivaId(comanda.id);
    setVisualizandoComanda(true);
  };

  // Comandas ativas filtradas para a aba "Comandas" (G07)
  const comandasAtivas = comandas.filter(
    (c) => c.status === 'aberta' || c.status === 'fechada',
  );

  const comandasExibidas = comandasAtivas.filter((c) => {
    if (filtroComandas === 'todas') return true;
    if (usuarioAtivoId) return c.garcom_id === usuarioAtivoId;
    return true;
  });

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans selection:bg-brand selection:text-on-brand pb-16">
      {/* Toast Flutuante de Feedback */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 animate-bounce max-w-sm">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-[16px] shadow-modal border text-xs font-bold ${
              toast.tipo === 'sucesso'
                ? 'bg-success text-white border-success'
                : 'bg-danger text-white border-danger'
            }`}
          >
            {toast.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.mensagem}</span>
          </div>
        </div>
      )}

      {/* Conteúdo Principal (Container Mobile 390-440px centralizado em telas maiores) */}
      <main className="flex-1 w-full max-w-md mx-auto p-4 sm:p-5">
        {/* Caso 1: Comanda Aberta Específica (Cardápio / Itens Enviados / Pedir a Conta) */}
        {visualizandoComanda && comandaAtivaId ? (
          <ComandaMesaView
            comandaId={comandaAtivaId}
            garcomNome={nomeOperador}
            onVoltar={() => {
              setVisualizandoComanda(false);
              refetchComandas();
            }}
            onToast={showToast}
          />
        ) : (
          <>
            {/* Caso 2A: Aba Salão (Grade de Mesas - Fiel a G01) */}
            {abaInferior === 'salao' && (
              <MesasGrid
                comandas={comandas}
                nomeGarcom={nomeOperador}
                garcomLogadoId={usuarioAtivoId}
                garcons={garcons}
                onAbrirMesa={handleAbrirMesa}
                onVerComanda={handleVerComanda}
              />
            )}

            {/* Caso 2B: Aba Comandas (Fiel a G07 Comandas.png) */}
            {abaInferior === 'comandas' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-black text-text tracking-tight">Comandas</h1>
                  <span className="text-xs font-bold text-text-2">
                    {comandasAtivas.length} ativas
                  </span>
                </div>

                {/* Pill Switcher "Minhas" vs "Todas" */}
                <div className="flex p-1 bg-surface-2 border border-border rounded-full select-none">
                  <button
                    type="button"
                    onClick={() => setFiltroComandas('minhas')}
                    className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${
                      filtroComandas === 'minhas'
                        ? 'bg-surface text-text shadow-soft'
                        : 'text-text-2 hover:text-text'
                    }`}
                  >
                    Minhas ({comandasAtivas.filter((c) => c.garcom_id === usuarioAtivoId).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroComandas('todas')}
                    className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${
                      filtroComandas === 'todas'
                        ? 'bg-surface text-text shadow-soft'
                        : 'text-text-2 hover:text-text'
                    }`}
                  >
                    Todas ({comandasAtivas.length})
                  </button>
                </div>

                {/* Lista de Comandas Ativas */}
                {comandasExibidas.length === 0 ? (
                  <div className="py-12 text-center bg-surface border border-border rounded-[20px] p-6 shadow-soft">
                    <Receipt className="w-8 h-8 text-border mx-auto mb-2" />
                    <p className="text-sm font-bold text-text">Nenhuma comanda ativa encontrada.</p>
                    <p className="text-xs text-text-2 mt-1">
                      Abra uma nova mesa no salão para iniciar um atendimento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comandasExibidas.map((cmd) => {
                      const isConta = cmd.status === 'fechada';
                      const tempo = formatElapsedTime(cmd.aberta_em);

                      return (
                        <div
                          key={cmd.id}
                          onClick={() => handleVerComanda(cmd)}
                          className={`bg-surface rounded-[20px] p-4 flex items-center justify-between border cursor-pointer shadow-soft hover:shadow-card transition-all active:scale-[0.99] ${
                            isConta ? 'border-2 border-danger' : 'border-border'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-black text-base text-text">Mesa {cmd.mesa}</h3>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isConta
                                    ? 'bg-danger-soft text-danger'
                                    : 'bg-brand-soft text-brand-text'
                                }`}
                              >
                                {isConta ? 'Conta pedida' : 'Aberta'}
                              </span>
                            </div>
                            <p className="text-xs text-text-2 mt-0.5">
                              {cmd.nome_cliente || 'Salão'} · {tempo || 'recente'}
                            </p>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-black text-text">
                              {formatCurrency(cmd.total || cmd.subtotal || '0.00')}
                            </div>
                            <div className="text-[11px] text-text-2">
                              {(cmd.itens || []).length} itens
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Caso 2C: Aba Perfil (Fiel a G09 Perfil.png) */}
            {abaInferior === 'perfil' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-black text-text tracking-tight">Perfil</h1>

                {/* Card do Operador */}
                <div className="bg-surface border border-border rounded-[24px] p-5 flex items-center gap-4 shadow-soft">
                  <div className="w-14 h-14 rounded-full bg-brand-soft text-brand-text font-black text-lg flex items-center justify-center shrink-0 shadow-soft">
                    {nomeOperador.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-black text-base text-text">{nomeOperador}</h2>
                    <p className="text-xs text-text-2 mt-0.5">Garçom · Turno operacional ativo</p>
                  </div>
                </div>

                {/* Botão Trocar Operador */}
                <button
                  type="button"
                  onClick={() => setModo('login')}
                  className="w-full h-13 py-3.5 rounded-[18px] border border-border bg-surface hover:bg-surface-2 font-bold text-xs text-text shadow-soft transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Users className="w-4 h-4 text-text-2" />
                  <span>Trocar operador</span>
                </button>

                {/* Botão Sair do Turno (Logout) */}
                <button
                  type="button"
                  onClick={logout}
                  className="w-full h-13 py-3.5 rounded-[18px] border border-danger/30 bg-danger-soft hover:bg-danger/20 font-bold text-xs text-danger transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair do turno</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal Deslizante "Abrir Mesa" (Fiel a G02) */}
      <ModalAbrirMesa
        isOpen={isModalAbrirOpen}
        mesaPredefinida={mesaParaAbrir}
        garcomPadraoId={usuarioAtivoId}
        onClose={() => setIsModalAbrirOpen(false)}
        onMesaAberta={handleMesaAbertaComSucesso}
        onErrorToast={(msg) => showToast('erro', msg)}
      />

      {/* ─────────────────────────────────────────────────────────────
          BARRA DE NAVEGAÇÃO INFERIOR FIXA (Fiel a G01, G07, G09)
          ───────────────────────────────────────────────────────────── */}
      {!visualizandoComanda && (
        <nav
          className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-border z-40 select-none shadow-modal"
          aria-label="Navegação do Garçom"
        >
          <div className="max-w-md mx-auto grid grid-cols-3 h-16">
            {/* 1. Salão */}
            <button
              type="button"
              onClick={() => setAbaInferior('salao')}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors ${
                abaInferior === 'salao'
                  ? 'text-brand-text border-t-2 border-brand bg-brand-soft/20'
                  : 'text-text-2 hover:text-text'
              }`}
            >
              <LayoutGrid className="w-5 h-5" />
              <span>Salão</span>
            </button>

            {/* 2. Comandas */}
            <button
              type="button"
              onClick={() => setAbaInferior('comandas')}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors ${
                abaInferior === 'comandas'
                  ? 'text-brand-text border-t-2 border-brand bg-brand-soft/20'
                  : 'text-text-2 hover:text-text'
              }`}
            >
              <Receipt className="w-5 h-5" />
              <span>Comandas</span>
            </button>

            {/* 3. Perfil */}
            <button
              type="button"
              onClick={() => setAbaInferior('perfil')}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors ${
                abaInferior === 'perfil'
                  ? 'text-brand-text border-t-2 border-brand bg-brand-soft/20'
                  : 'text-text-2 hover:text-text'
              }`}
            >
              <User className="w-5 h-5" />
              <span>Perfil</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};
