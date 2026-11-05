import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Receipt,
  ChefHat,
  ShieldCheck,
  AlertCircle,
  UserPlus,
  Pencil,
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useCriarUsuario, useAtualizarUsuario } from '../../../hooks/useUsuarios';
import type { Usuario, PerfilUsuario } from '../types';

export interface UsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  usuarioParaEditar?: Usuario | null;
  onSalvoComSucesso?: (usuario: Usuario, modo: 'criado' | 'atualizado') => void;
}

interface PerfilOpcao {
  id: PerfilUsuario;
  titulo: string;
  descricao: string;
  icone: React.ElementType;
  badgeCor: string;
}

const PERFIS_DISPONIVEIS: PerfilOpcao[] = [
  {
    id: 'garcom',
    titulo: 'Garçom / Atendente',
    descricao: 'Abertura de comandas e lançamento de pedidos no salão',
    icone: Utensils,
    badgeCor: 'border-emerald-300 text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  {
    id: 'caixa',
    titulo: 'Operador de Caixa',
    descricao: 'Fechamento de contas, split payment e recebimentos',
    icone: Receipt,
    badgeCor: 'border-sky-300 text-sky-800 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300',
  },
  {
    id: 'cozinha',
    titulo: 'Cozinha & Bar (KDS)',
    descricao: 'Visualização de pedidos e controle da fila de preparo',
    icone: ChefHat,
    badgeCor: 'border-amber-300 text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300',
  },
  {
    id: 'gerente',
    titulo: 'Gerente Geral',
    descricao: 'Gestão executiva, cadastro de equipe, cardápio e relatórios',
    icone: ShieldCheck,
    badgeCor: 'border-brand/40 text-brand-coffee bg-brand/10 dark:text-amber-200 dark:bg-amber-950/30',
  },
];

export const UsuarioModal: React.FC<UsuarioModalProps> = ({
  isOpen,
  onClose,
  usuarioParaEditar,
  onSalvoComSucesso,
}) => {
  const isEdicao = Boolean(usuarioParaEditar);
  const criarUsuarioMut = useCriarUsuario();
  const atualizarUsuarioMut = useAtualizarUsuario();

  const [nome, setNome] = useState('');
  const [perfil, setPerfil] = useState<PerfilUsuario>('garcom');
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroApi, setErroApi] = useState<string | null>(null);

  // Sincroniza formulário com o usuário recebido ou reseta para criação
  useEffect(() => {
    if (isOpen) {
      if (usuarioParaEditar) {
        setNome(usuarioParaEditar.nome);
        setPerfil(usuarioParaEditar.perfil);
      } else {
        setNome('');
        setPerfil('garcom');
      }
      setErroNome(null);
      setErroApi(null);
    }
  }, [isOpen, usuarioParaEditar]);

  const validarFormulario = (): boolean => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErroNome('O nome do colaborador é obrigatório.');
      return false;
    }
    if (nomeLimpo.length < 2) {
      setErroNome('O nome deve conter pelo menos 2 caracteres.');
      return false;
    }
    setErroNome(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroApi(null);

    if (!validarFormulario()) {
      return;
    }

    try {
      if (isEdicao && usuarioParaEditar) {
        const usuarioAtualizado = await atualizarUsuarioMut.mutateAsync({
          id: usuarioParaEditar.id,
          dto: {
            nome: nome.trim(),
            perfil,
          },
        });
        onSalvoComSucesso?.(usuarioAtualizado, 'atualizado');
      } else {
        const novoUsuario = await criarUsuarioMut.mutateAsync({
          nome: nome.trim(),
          perfil,
        });
        onSalvoComSucesso?.(novoUsuario, 'criado');
      }
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErroApi(err.message);
      } else {
        setErroApi('Não foi possível salvar os dados do colaborador. Verifique a conexão.');
      }
    }
  };

  const isSalvando = criarUsuarioMut.isPending || atualizarUsuarioMut.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdicao ? 'Editar Colaborador (M13)' : 'Novo Colaborador (M13)'}
      description={
        isEdicao
          ? 'Atualize as informações cadastrais e o perfil de acesso do colaborador.'
          : 'Cadastre um novo membro da equipe para liberar acesso às estações operacionais.'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 pt-2">
        {/* Banner de Erro da API */}
        {erroApi && (
          <div
            role="alert"
            className="flex items-start gap-3 p-3.5 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Erro ao salvar colaborador:</span>
              <span>{erroApi}</span>
            </div>
          </div>
        )}

        {/* Campo Nome */}
        <div>
          <Input
            id="nome-colaborador-input"
            label="Nome Completo *"
            placeholder="Ex.: Carlos da Silva"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              if (erroNome) setErroNome(null);
            }}
            error={erroNome || undefined}
            disabled={isSalvando}
            autoFocus
          />
        </div>

        {/* Seletor de Perfil de Acesso */}
        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-semibold text-text-2 tracking-wide uppercase">
            Perfil de Operação *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Perfil de Operação">
            {PERFIS_DISPONIVEIS.map((opcao) => {
              const Icone = opcao.icone;
              const isSelecionado = perfil === opcao.id;

              return (
                <button
                  key={opcao.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelecionado}
                  onClick={() => setPerfil(opcao.id)}
                  disabled={isSalvando}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all select-none min-h-[92px] ${
                    isSelecionado
                      ? 'border-brand bg-brand/10 ring-2 ring-brand/30 shadow-sm'
                      : 'border-border bg-surface hover:bg-surface-2'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded-lg border flex items-center justify-center ${opcao.badgeCor}`}
                      >
                        <Icone className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-text">
                        {opcao.titulo}
                      </span>
                    </div>
                    {isSelecionado && (
                      <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                    )}
                  </div>
                  <p className="text-xs text-text-2 leading-relaxed">
                    {opcao.descricao}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSalvando}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSalvando}
            leftIcon={isEdicao ? <Pencil className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          >
            {isEdicao ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
