export type StatusFichaKds = 'recebido' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado';

export type SetorKds = 'cozinha' | 'bar';

export type SlaStatus = 'normal' | 'atencao' | 'atrasado';

export type EstacaoFiltro = 'todas' | 'cozinha' | 'bar';

export interface FichaKds {
  id: number;
  item_comanda_id: number;
  comanda_id: number;
  mesa: number;
  nome_produto: string;
  quantidade: number;
  setor: SetorKds;
  status: StatusFichaKds;
  garcom_nome?: string | null;
  observacao?: string | null;
  recebido_em: string;
  iniciado_em?: string | null;
  pronto_em?: string | null;
  entregue_em?: string | null;
  tempo_decorrido_segundos?: number;
  sla_status?: SlaStatus;
}

export interface FilaKdsResposta {
  fichas: FichaKds[];
  resumo: {
    total?: number;
    recebido?: number;
    em_preparo?: number;
    pronto?: number;
    entregue?: number;
    atrasadas?: number;
    [key: string]: number | undefined;
  };
}

export interface PendenciaItemKds {
  ficha_id: number;
  item_comanda_id: number;
  nome_produto: string;
  quantidade: number;
  setor: SetorKds;
  status: StatusFichaKds;
  tempo_espera_minutos: number;
}

export interface RespostaPendenciasKds {
  comanda_id: number;
  possui_pendencias: boolean;
  total_pendencias: number;
  itens: PendenciaItemKds[];
}
