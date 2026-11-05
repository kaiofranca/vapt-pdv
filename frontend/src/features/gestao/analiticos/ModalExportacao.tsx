import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  FileCode,
  TrendingUp,
  Layers,
  Users,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  exportarRelatorio,
  acionarDownloadNavegador,
} from '../../../services/gestao';
import type {
  TipoRelatorioExportar,
  FormatoRelatorioExportar,
} from '../../../types/api';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';

export interface ModalExportacaoProps {
  isOpen: boolean;
  onClose: () => void;
  tipoInicial?: TipoRelatorioExportar;
}

interface OpcaoTipoRelatorio {
  id: TipoRelatorioExportar;
  titulo: string;
  descricao: string;
  icone: React.ElementType;
}

const OPCOES_TIPO: OpcaoTipoRelatorio[] = [
  {
    id: 'faturamento',
    titulo: 'Faturamento Diário',
    descricao: 'Totais de vendas, faturamento líquido, taxa de serviço e divisão por Pix, Cartão e Dinheiro.',
    icone: TrendingUp,
  },
  {
    id: 'produtos',
    titulo: 'Curva ABC de Produtos',
    descricao: 'Ranking Pareto de produtos, quantidades vendidas, faturamento gerado e classes A/B/C.',
    icone: Layers,
  },
  {
    id: 'garcons',
    titulo: 'Desempenho de Garçons',
    descricao: 'Produtividade por atendente, comandas finalizadas, ticket médio e comissão de 10%.',
    icone: Users,
  },
  {
    id: 'alertas',
    titulo: 'Alertas de Estoque',
    descricao: 'Itens em nível crítico ou zerado para auditoria e reposição com fornecedores.',
    icone: AlertTriangle,
  },
];

export const ModalExportacao: React.FC<ModalExportacaoProps> = ({
  isOpen,
  onClose,
  tipoInicial = 'faturamento',
}) => {
  const [tipo, setTipo] = useState<TipoRelatorioExportar>(tipoInicial);
  const [formato, setFormato] = useState<FormatoRelatorioExportar>('csv');
  const [dataDe, setDataDe] = useState<string>('');
  const [dataAte, setDataAte] = useState<string>('');

  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [erroMensagem, setErroMensagem] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<boolean>(false);

  // Sincroniza tipo inicial quando reaberto
  useEffect(() => {
    if (isOpen) {
      setTipo(tipoInicial);
      setErroMensagem(null);
      setSucesso(false);
    }
  }, [isOpen, tipoInicial]);

  // Fechar com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDownloading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isDownloading]);

  if (!isOpen) return null;

  const handleExportar = async () => {
    setIsDownloading(true);
    setErroMensagem(null);
    setSucesso(false);

    try {
      const { blob, filename } = await exportarRelatorio({
        tipo,
        formato,
        de: dataDe || undefined,
        ate: dataAte || undefined,
      });

      acionarDownloadNavegador(blob, filename);
      setSucesso(true);

      // Fecha automaticamente após 1.5s após sucesso
      setTimeout(() => {
        setIsDownloading(false);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Ocorreu uma falha ao gerar o arquivo de exportação.';
      setErroMensagem(msg);
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop escuro com blur */}
      <div
        className="fixed inset-0 bg-text/50 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!isDownloading) onClose();
        }}
        aria-hidden="true"
      />

      {/* Caixa do Diálogo Modal sobre surface-raised */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-exportacao-titulo"
        className="relative w-full max-w-xl rounded-card-lg bg-surface-raised border border-border shadow-modal p-6 text-left z-10 transition-all space-y-6"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b border-border/70 pb-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-card bg-brand-soft text-brand-text">
              <Download className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h3
                id="modal-exportacao-titulo"
                className="text-lg font-black text-text tracking-tight"
              >
                Exportar Dados Gerenciais
              </h3>
              <p className="text-xs text-text-2 mt-0.5">
                Gere arquivos estruturados para contabilidade, planilhas externas ou auditoria (M15).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isDownloading}
            aria-label="Fechar modal"
            className="w-9 h-9 rounded-full flex items-center justify-center text-text-2 hover:text-text hover:bg-surface-2 transition-colors min-h-[36px]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Seleção do Tipo de Relatório */}
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-text uppercase tracking-wider">
            1. Selecione o Relatório
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {OPCOES_TIPO.map((opcao) => {
              const selecionado = tipo === opcao.id;
              const Icone = opcao.icone;

              return (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => setTipo(opcao.id)}
                  disabled={isDownloading}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-card text-left transition-all border min-h-[72px]',
                    selecionado
                      ? 'bg-brand/10 border-brand text-text shadow-soft ring-1 ring-brand'
                      : 'bg-surface border-border/80 hover:border-text-2/40 text-text-2 hover:text-text'
                  )}
                >
                  <span
                    className={cn(
                      'p-2 rounded-lg shrink-0 mt-0.5',
                      selecionado
                        ? 'bg-brand text-on-brand'
                        : 'bg-surface-2 text-text-2'
                    )}
                  >
                    <Icone className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-text">
                      {opcao.titulo}
                    </div>
                    <div className="text-[11px] text-text-2 leading-tight mt-0.5 line-clamp-2">
                      {opcao.descricao}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Seleção de Formato */}
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-text uppercase tracking-wider">
            2. Formato do Arquivo
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormato('csv')}
              disabled={isDownloading}
              className={cn(
                'flex items-center gap-3 p-3 rounded-card border transition-all min-h-[48px]',
                formato === 'csv'
                  ? 'bg-brand/10 border-brand text-text ring-1 ring-brand font-bold'
                  : 'bg-surface border-border text-text-2 hover:text-text hover:bg-surface-2'
              )}
            >
              <FileSpreadsheet
                className={cn(
                  'w-5 h-5 shrink-0',
                  formato === 'csv' ? 'text-brand-text' : 'text-text-2'
                )}
              />
              <div className="text-left">
                <div className="text-xs font-bold text-text">CSV (.csv)</div>
                <div className="text-[11px] text-text-2">Excel, Sheets, Calc</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormato('json')}
              disabled={isDownloading}
              className={cn(
                'flex items-center gap-3 p-3 rounded-card border transition-all min-h-[48px]',
                formato === 'json'
                  ? 'bg-brand/10 border-brand text-text ring-1 ring-brand font-bold'
                  : 'bg-surface border-border text-text-2 hover:text-text hover:bg-surface-2'
              )}
            >
              <FileCode
                className={cn(
                  'w-5 h-5 shrink-0',
                  formato === 'json' ? 'text-brand-text' : 'text-text-2'
                )}
              />
              <div className="text-left">
                <div className="text-xs font-bold text-text">JSON (.json)</div>
                <div className="text-[11px] text-text-2">Bruto / Integrações</div>
              </div>
            </button>
          </div>
        </div>

        {/* 3. Filtro Opcional de Período */}
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-text uppercase tracking-wider">
            3. Intervalo de Datas <span className="font-normal text-text-2 lowercase">(opcional)</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] text-text-2 mb-1">De (Data inicial):</span>
              <div className="relative">
                <Calendar className="w-4 h-4 text-text-2 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={dataDe}
                  onChange={(e) => setDataDe(e.target.value)}
                  disabled={isDownloading}
                  className="w-full h-11 pl-9 pr-3 rounded-input bg-surface border border-border text-xs text-text focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            <div>
              <span className="block text-[11px] text-text-2 mb-1">Até (Data final):</span>
              <div className="relative">
                <Calendar className="w-4 h-4 text-text-2 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={dataAte}
                  onChange={(e) => setDataAte(e.target.value)}
                  disabled={isDownloading}
                  className="w-full h-11 pl-9 pr-3 rounded-input bg-surface border border-border text-xs text-text focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Feedback de Erro ou Sucesso */}
        {erroMensagem && (
          <div className="p-3.5 rounded-card bg-danger-soft border border-danger/30 text-danger-text text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
            <span>{erroMensagem}</span>
          </div>
        )}

        {sucesso && (
          <div className="p-3.5 rounded-card bg-success-soft border border-success/30 text-success-text text-xs flex items-center gap-2.5 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
            <span>Arquivo gerado com sucesso! O download foi iniciado no navegador.</span>
          </div>
        )}

        {/* Rodapé de Ações */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-border/70">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isDownloading}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleExportar}
            isLoading={isDownloading}
            disabled={isDownloading}
            className="w-full sm:w-auto min-w-[160px]"
            leftIcon={
              isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )
            }
          >
            {isDownloading ? 'Gerando arquivo...' : 'Baixar Relatório'}
          </Button>
        </div>
      </div>
    </div>
  );
};
