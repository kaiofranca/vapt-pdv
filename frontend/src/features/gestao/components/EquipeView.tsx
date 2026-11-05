import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  X,
  Pencil,
  UserX,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Utensils,
  Receipt,
  ChefHat,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useUsuarios } from '../../../hooks/useUsuarios';
import { UsuarioModal } from './UsuarioModal';
import { InativarUsuarioDialog } from './InativarUsuarioDialog';
import type { Usuario, PerfilUsuario, FiltroPerfilEquipe, FiltroStatusEquipe } from '../types';

export const EquipeView: React.FC = () => {
  const { data: usuarios = [], isLoading, isError, error, refetch } = useUsuarios();

  // Estados de Filtros e Busca
  const [busca, setBusca] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState<FiltroPerfilEquipe>('todos');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusEquipe>('todos');

  // Estados dos Modais
  const [isModalUsuarioAberto, setIsModalUsuarioAberto] = useState(false);
  const [usuarioParaEditar, setUsuarioParaEditar] = useState<Usuario | null>(null);
  const [usuarioParaInativar, setUsuarioParaInativar] = useState<Usuario | null>(null);

  // Estado de Toast / Notificação
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);

  const exibirToast = (msg: string) => {
    setToastMensagem(msg);
    setTimeout(() => {
      setToastMensagem(null);
    }, 4000);
  };

  // Contadores analíticos
  const contadores = useMemo(() => {
    const total = usuarios.length;
    const garcons = usuarios.filter((u) => u.perfil === 'garcom').length;
    const caixas = usuarios.filter((u) => u.perfil === 'caixa').length;
    const cozinhas = usuarios.filter((u) => u.perfil === 'cozinha').length;
    const gerentes = usuarios.filter((u) => u.perfil === 'gerente').length;
    const ativos = usuarios.filter((u) => u.ativo).length;
    const inativos = total - ativos;

    return { total, garcons, caixas, cozinhas, gerentes, ativos, inativos };
  }, [usuarios]);

  // Filtragem dos colaboradores em memória
  const colaboradoresFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      // 1. Busca por nome ou ID
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const bateNome = u.nome.toLowerCase().includes(termo);
        const bateId = String(u.id).includes(termo);
        if (!bateNome && !bateId) return false;
      }

      // 2. Filtro por Perfil
      if (filtroPerfil !== 'todos' && u.perfil !== filtroPerfil) {
        return false;
      }

      // 3. Filtro por Status
      if (filtroStatus === 'ativo' && !u.ativo) return false;
      if (filtroStatus === 'inativo' && u.ativo) return false;

      return true;
    });
  }, [usuarios, busca, filtroPerfil, filtroStatus]);

  // Iniciais do Colaborador
  const obterIniciais = (nome: string): string => {
    if (!nome) return '??';
    const partes = nome.trim().split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return partes[0].slice(0, 2).toUpperCase();
  };

  // Cores do avatar por perfil
  const getAvatarBadge = (perfil: PerfilUsuario) => {
    switch (perfil) {
      case 'gerente':
        return 'bg-brand/20 text-brand-coffee border-brand/40';
      case 'garcom':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300';
      case 'caixa':
        return 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300';
      case 'cozinha':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300';
    }
  };

  // Rótulo amigável do perfil
  const getPerfilLabel = (perfil: PerfilUsuario) => {
    switch (perfil) {
      case 'gerente':
        return { label: 'Gerente', icone: ShieldCheck };
      case 'garcom':
        return { label: 'Garçom', icone: Utensils };
      case 'caixa':
        return { label: 'Caixa', icone: Receipt };
      case 'cozinha':
        return { label: 'Cozinha', icone: ChefHat };
    }
  };

  const handleAbrirCriacao = () => {
    setUsuarioParaEditar(null);
    setIsModalUsuarioAberto(true);
  };

  const handleAbrirEdicao = (u: Usuario) => {
    setUsuarioParaEditar(u);
    setIsModalUsuarioAberto(true);
  };

  const handleAbrirInativacao = (u: Usuario) => {
    setUsuarioParaInativar(u);
  };

  const handleSalvoComSucesso = (u: Usuario, modo: 'criado' | 'atualizado') => {
    exibirToast(
      modo === 'criado'
        ? `Colaborador "${u.nome}" cadastrado com sucesso!`
        : `Colaborador "${u.nome}" atualizado com sucesso!`
    );
  };

  const handleInativadoComSucesso = (u: Usuario) => {
    exibirToast(`Colaborador "${u.nome}" inativado com sucesso (RN14).`);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      {toastMensagem && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-success text-white shadow-soft font-semibold text-sm animate-slideDown"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMensagem}</span>
          <button
            onClick={() => setToastMensagem(null)}
            className="ml-2 hover:opacity-80 p-0.5"
            aria-label="Fechar notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand/10 text-brand-coffee dark:text-amber-300">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-text tracking-tight">
                Gestão de Equipe (M12)
              </h1>
              <p className="text-sm text-text-2">
                Controle de colaboradores, permissões operacionais e perfis de acesso
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleAbrirCriacao}
          leftIcon={<UserPlus className="w-5 h-5" />}
          className="shadow-soft"
        >
          Novo Colaborador (M13)
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-text-2 uppercase tracking-wide">
            Total
          </span>
          <span className="text-2xl font-black text-text mt-1">
            {contadores.total}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
            Garçons
          </span>
          <span className="text-2xl font-black text-text mt-1">
            {contadores.garcons}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wide">
            Caixas
          </span>
          <span className="text-2xl font-black text-text mt-1">
            {contadores.caixas}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
            Cozinha
          </span>
          <span className="text-2xl font-black text-text mt-1">
            {contadores.cozinhas}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-brand-coffee dark:text-amber-200 uppercase tracking-wide">
            Gerentes
          </span>
          <span className="text-2xl font-black text-text mt-1">
            {contadores.gerentes}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Inativos
          </span>
          <span className="text-2xl font-black text-text-2 mt-1">
            {contadores.inativos}
          </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-xl bg-surface border border-border shadow-sm">
        {/* Campo de Busca Textual */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome ou ID..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full min-h-[42px] pl-10 pr-9 py-2 rounded-lg bg-surface-2 border border-border text-sm text-text placeholder:text-text-2/60 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-2 hover:text-text p-1"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros por Perfil e Status */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Grupo de Perfis */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-2 border border-border" role="group" aria-label="Filtrar por Perfil">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'garcom', label: 'Garçom' },
                { id: 'caixa', label: 'Caixa' },
                { id: 'cozinha', label: 'Cozinha' },
                { id: 'gerente', label: 'Gerente' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFiltroPerfil(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all select-none ${
                  filtroPerfil === item.id
                    ? 'bg-brand text-on-brand shadow-sm font-bold'
                    : 'text-text-2 hover:text-text hover:bg-surface'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Grupo de Status */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-2 border border-border" role="group" aria-label="Filtrar por Status">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'ativo', label: 'Ativos' },
                { id: 'inativo', label: 'Inativos' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFiltroStatus(item.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all select-none ${
                  filtroStatus === item.id
                    ? 'bg-text text-surface font-bold shadow-sm'
                    : 'text-text-2 hover:text-text hover:bg-surface'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 flex flex-col items-center justify-center gap-3 rounded-xl bg-surface border border-border">
          <RefreshCw className="w-8 h-8 animate-spin text-brand" />
          <p className="text-sm text-text-2">Carregando colaboradores da equipe...</p>
        </div>
      ) : isError ? (
        <div className="p-8 flex flex-col items-center justify-center gap-4 rounded-xl bg-danger/5 border border-danger/20 text-center">
          <AlertCircle className="w-10 h-10 text-danger" />
          <div>
            <h3 className="text-base font-bold text-text">Falha ao carregar equipe</h3>
            <p className="text-xs text-text-2 mt-1 max-w-md">
              {error instanceof Error ? error.message : 'Não foi possível consultar os usuários no PDV Core.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} leftIcon={<RefreshCw className="w-4 h-4" />}>
            Tentar Novamente
          </Button>
        </div>
      ) : colaboradoresFiltrados.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3 rounded-xl bg-surface border border-border text-center">
          <div className="p-4 rounded-full bg-surface-2 text-text-2">
            <Filter className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-text">Nenhum colaborador encontrado</h3>
          <p className="text-xs text-text-2 max-w-sm">
            Não encontramos nenhum membro da equipe correspondente aos filtros de busca aplicados.
          </p>
          {(busca || filtroPerfil !== 'todos' || filtroStatus !== 'todos') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBusca('');
                setFiltroPerfil('todos');
                setFiltroStatus('todos');
              }}
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" aria-label="Tabela de Colaboradores">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-xs font-bold text-text-2 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Colaborador</th>
                  <th className="py-3.5 px-4">Perfil Operacional</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Cadastrado em</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {colaboradoresFiltrados.map((u) => {
                  const perfilInfo = getPerfilLabel(u.perfil);
                  const IconePerfil = perfilInfo.icone;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-surface-2/40 transition-colors ${
                        !u.ativo ? 'opacity-60 bg-surface-2/20' : ''
                      }`}
                    >
                      {/* Colaborador: Avatar + Nome + ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarBadge(
                              u.perfil
                            )}`}
                          >
                            {obterIniciais(u.nome)}
                          </div>
                          <div>
                            <div className="font-bold text-text flex items-center gap-1.5">
                              <span>{u.nome}</span>
                              <span className="text-xs text-text-2 font-normal">
                                #{u.id}
                              </span>
                            </div>
                            <span className="text-xs text-text-2 md:hidden">
                              {perfilInfo.label}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Perfil Operacional */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold">
                          <IconePerfil className="w-3.5 h-3.5" />
                          <span>{perfilInfo.label}</span>
                        </div>
                      </td>

                      {/* Status: Ativo / Inativo */}
                      <td className="py-3.5 px-4">
                        {u.ativo ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 text-xs font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 text-xs font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            Inativo
                          </span>
                        )}
                      </td>

                      {/* Data de Cadastro */}
                      <td className="py-3.5 px-4 text-text-2 text-xs hidden md:table-cell">
                        {u.criado_em
                          ? new Date(u.criado_em).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* Botão Editar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAbrirEdicao(u)}
                            aria-label={`Editar ${u.nome}`}
                            disabled={!u.ativo}
                            title={u.ativo ? 'Editar colaborador' : 'Colaborador inativo não editável'}
                            className="h-8 px-2.5 text-xs text-text-2 hover:text-text"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Editar
                          </Button>

                          {/* Botão Inativar (só para ativos) */}
                          {u.ativo ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAbrirInativacao(u)}
                              aria-label={`Inativar ${u.nome}`}
                              title="Inativar logicamente"
                              className="h-8 px-2.5 text-xs text-danger hover:bg-danger/10"
                            >
                              <UserX className="w-3.5 h-3.5 mr-1" />
                              Inativar
                            </Button>
                          ) : (
                            <span className="text-xs text-text-2 italic px-2">
                              Inativo
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <UsuarioModal
        isOpen={isModalUsuarioAberto}
        onClose={() => setIsModalUsuarioAberto(false)}
        usuarioParaEditar={usuarioParaEditar}
        onSalvoComSucesso={handleSalvoComSucesso}
      />

      <InativarUsuarioDialog
        isOpen={Boolean(usuarioParaInativar)}
        onClose={() => setUsuarioParaInativar(null)}
        usuarioParaInativar={usuarioParaInativar}
        onInativadoComSucesso={handleInativadoComSucesso}
      />
    </div>
  );
};

export default EquipeView;
