import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Comanda } from '../../../types/api';
import { ReciboPaperView } from './ReciboPaperView';

export interface ParcelaPagamento {
  id: string;
  forma: 'dinheiro' | 'pix' | 'cartao';
  subtipo?: 'credito' | 'debito';
  valorCentavos: number;
  valorRecebidoCentavos?: number;
  trocoCentavos?: number;
}

export interface ComprovanteVendaProps {
  comanda: Comanda;
  parcelas: ParcelaPagamento[];
  nomeOperador?: string;
  documentoCliente?: string;
  onNovaVenda: () => void;
}

/**
 * Componente C12 - Comprovante de Venda Concluída
 * Exibe o marco de sucesso, integra o ReciboPaperView (.paper) e botões de ação final.
 */
export const ComprovanteVenda: React.FC<ComprovanteVendaProps> = ({
  comanda,
  parcelas,
  nomeOperador = 'Caixa 01',
  documentoCliente,
  onNovaVenda,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-2 text-text animate-fadeIn">
      {/* Marco de Sucesso */}
      <div className="flex flex-col items-center text-center mb-4">
        <div className="w-16 h-16 rounded-full bg-success-soft text-success flex items-center justify-center mb-2 shadow-soft">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-text">Venda Concluída!</h2>
        <p className="text-xs text-text-2 mt-0.5">
          Comanda #{comanda.id} (Mesa {comanda.mesa}) quitada com sucesso e estoque baixado.
        </p>
      </div>

      {/* Recibo Térmico Operacional .paper */}
      <ReciboPaperView
        comanda={comanda}
        parcelas={parcelas}
        nomeOperador={nomeOperador}
        documentoCliente={documentoCliente}
        onNovaVenda={onNovaVenda}
        exibirAcoes={true}
      />
    </div>
  );
};
