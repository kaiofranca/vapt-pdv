import React, { useState } from 'react';
import { SideNavGestao, type AbaNavegacaoGestao } from './components/SideNavGestao';
import { VisaoGeralView } from './components/VisaoGeralView';
import { CurvaAbcView } from './components/CurvaAbcView';
import { DesempenhoGarconsView } from './components/DesempenhoGarconsView';
import { EstoqueAlertasView } from './components/EstoqueAlertasView';
import { ModalExportacao } from './components/ModalExportacao';
import { useAlertasEstoque } from '../../hooks/useGestao';

export const ModoGestaoPage: React.FC = () => {
  const [abaAtiva, setAbaAtiva] = useState<AbaNavegacaoGestao>('visao-geral');
  const [isModalExportacaoOpen, setIsModalExportacaoOpen] = useState<boolean>(false);

  // Consulta de alertas para exibir badge de contagem crítica na SideNav
  const { data: alertasData } = useAlertasEstoque({ apenas_ativos: true });
  const totalAlertas = alertasData?.alertas?.length ?? 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text font-sans selection:bg-brand selection:text-on-brand">
      {/* ─────────────────────────────────────────────────────────────
          BARRA LATERAL ESCURA FIXA (#3A2A21)
          ───────────────────────────────────────────────────────────── */}
      <SideNavGestao
        abaAtiva={abaAtiva}
        onAbaChange={setAbaAtiva}
        onAbrirExportacao={() => setIsModalExportacaoOpen(true)}
        totalAlertasEstoque={totalAlertas}
      />

      {/* ─────────────────────────────────────────────────────────────
          ÁREA PRINCIPAL DE CONTEÚDO ANALÍTICO
          ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 h-full overflow-y-auto px-6 py-6 lg:px-10 lg:py-8">
        <div className="max-w-7xl mx-auto">
          {abaAtiva === 'visao-geral' && (
            <VisaoGeralView
              onNavegarAba={setAbaAtiva}
              onAbrirExportacao={() => setIsModalExportacaoOpen(true)}
            />
          )}

          {abaAtiva === 'curva-abc' && <CurvaAbcView />}

          {abaAtiva === 'garcons' && <DesempenhoGarconsView />}

          {abaAtiva === 'estoque' && <EstoqueAlertasView />}
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          MODAL DE EXPORTAÇÃO DE RELATÓRIOS (M15)
          ───────────────────────────────────────────────────────────── */}
      <ModalExportacao
        isOpen={isModalExportacaoOpen}
        onClose={() => setIsModalExportacaoOpen(false)}
      />
    </div>
  );
};

export default ModoGestaoPage;
