import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useExportarRelatorio } from '../../../hooks/useGestao';
import type { TipoRelatorioExportar, FormatoRelatorioExportar } from '../../../types/api';

export interface ModalExportacaoProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalExportacao: React.FC<ModalExportacaoProps> = ({
  isOpen,
  onClose,
}) => {
  const [tipo, setTipo] = useState<TipoRelatorioExportar>('faturamento');
  const [formato, setFormato] = useState<FormatoRelatorioExportar>('csv');
  const [de, setDe] = useState<string>('');
  const [ate, setAte] = useState<string>('');
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const exportarMut = useExportarRelatorio();

  const opcoesRelatorio: {
    id: TipoRelatorioExportar;
    titulo: string;
    descricao: string;
  }[] = [
    {
      id: 'faturamento',
      titulo: 'Faturamento e Fechamento',
      descricao: 'Histórico de receitas, comandas pagas, canceladas, gorjetas e formas de pagamento.',
    },
    {
      id: 'produtos',
      titulo: 'Curva ABC e Produtos',
      descricao: 'Ranking de vendas por receita, participação percentual e classificação A, B e C.',
    },
    {
      id: 'garcons',
      titulo: 'Desempenho de Garçons',
      descricao: 'Produtividade por colaborador, comandas atendidas, ticket médio e comissão de 10%.',
    },
    {
      id: 'alertas',
      titulo: 'Alertas de Estoque',
      descricao: 'Itens em estado crítico ou zerado, margem mínima e data do último movimento.',
    },
  ];

  const handleExportar = async () => {
    setMensagemSucesso(null);
    setMensagemErro(null);

    try {
      const res = await exportarMut.mutateAsync({
        tipo,
        formato,
        de: de.trim() || undefined,
        ate: ate.trim() || undefined,
      });

      setMensagemSucesso(`Arquivo "${res.filename}" gerado e descarregado com sucesso.`);
      setTimeout(() => {
        setMensagemSucesso(null);
        onClose();
      }, 2500);
    } catch (err) {
      setMensagemErro(err instanceof Error ? err.message : 'Falha ao exportar relatório.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Exportação de Relatórios Gerenciais (M15)"
      description="Gere arquivos tabulares para fechamento contábil, auditoria e BI."
      maxWidth="lg"
    >
      <div className="space-y-6 pt-2">
        {/* Feedback de Sucesso */}
        {mensagemSucesso && (
          <div className="p-3.5 rounded-[14px] bg-success-soft border border-success/30 flex items-center gap-2.5 text-xs text-success-text font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
            <span>{mensagemSucesso}</span>
          </div>
        )}

        {/* Feedback de Erro */}
        {mensagemErro && (
          <div className="p-3.5 rounded-[14px] bg-danger-soft border border-danger/30 flex items-center gap-2.5 text-xs text-danger-text font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
            <span>{mensagemErro}</span>
          </div>
        )}

        {/* 1. Seleção do Conjunto de Dados */}
        <div>
          <label className="text-xs font-bold text-text-2 mb-2 block uppercase tracking-wider">
            1. Selecione o Relatório
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {opcoesRelatorio.map((opc) => {
              const selecionado = tipo === opc.id;
              return (
                <div
                  key={opc.id}
                  onClick={() => setTipo(opc.id)}
                  className={`p-3.5 rounded-[16px] border cursor-pointer transition-all ${
                    selecionado
                      ? 'border-brand bg-brand-soft/30 shadow-soft'
                      : 'border-border bg-surface hover:border-brand/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-text">
                      {opc.titulo}
                    </span>
                    <input
                      type="radio"
                      name="tipo-relatorio"
                      checked={selecionado}
                      onChange={() => setTipo(opc.id)}
                      className="text-brand focus:ring-brand"
                    />
                  </div>
                  <p className="text-[11px] text-text-2 leading-relaxed">
                    {opc.descricao}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Formato do Arquivo (CSV vs JSON) */}
        <div>
          <label className="text-xs font-bold text-text-2 mb-2 block uppercase tracking-wider">
            2. Formato de Saída
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormato('csv')}
              aria-label="Exportar no formato CSV (Excel / RFC 4180)"
              className={`p-3 min-h-[44px] rounded-[14px] border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                formato === 'csv'
                  ? 'border-brand bg-brand text-on-brand shadow-soft'
                  : 'border-border bg-surface text-text hover:bg-surface-2'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>CSV (Excel / RFC 4180)</span>
            </button>

            <button
              type="button"
              onClick={() => setFormato('json')}
              aria-label="Exportar no formato JSON (Estruturado)"
              className={`p-3 min-h-[44px] rounded-[14px] border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                formato === 'json'
                  ? 'border-brand bg-brand text-on-brand shadow-soft'
                  : 'border-border bg-surface text-text hover:bg-surface-2'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>JSON (Estruturado)</span>
            </button>
          </div>
        </div>

        {/* 3. Filtro Opcional de Datas (de / até) para Faturamento */}
        {tipo === 'faturamento' && (
          <div>
            <label className="text-xs font-bold text-text-2 mb-2 block uppercase tracking-wider">
              3. Período (Opcional)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-text-2 mb-1 block">A partir de (de):</span>
                <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-[12px] px-3 py-2">
                  <Calendar className="w-4 h-4 text-text-2 shrink-0" />
                  <input
                    type="date"
                    value={de}
                    onChange={(e) => setDe(e.target.value)}
                    className="bg-transparent text-xs text-text w-full focus:outline-none"
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>

              <div>
                <span className="text-[11px] text-text-2 mb-1 block">Até a data (ate):</span>
                <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-[12px] px-3 py-2">
                  <Calendar className="w-4 h-4 text-text-2 shrink-0" />
                  <input
                    type="date"
                    value={ate}
                    onChange={(e) => setAte(e.target.value)}
                    className="bg-transparent text-xs text-text w-full focus:outline-none"
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose} disabled={exportarMut.isPending}>
            Cancelar
          </Button>

          <Button
            variant="primary"
            onClick={handleExportar}
            isLoading={exportarMut.isPending}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Gerar e Baixar Arquivo</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
