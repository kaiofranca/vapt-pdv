import { useState, useEffect, useMemo } from 'react';
import {
  Utensils,
  Monitor,
  BarChart3,
  ChevronRight,
  UserPlus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useUsuariosAtivos, useCriarUsuario } from '../../hooks/useUsuarios';
import { useSessionStore } from '../../stores/useSessionStore';
import type { Usuario } from '../../types/api';
import { Button } from '../../components/ui/Button';
import { Logo, LogoMark } from '../../components/ui/Logo';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const STORAGE_KEY_ULTIMO_ACESSO = 'vapt_pdv_ultimo_acesso';

interface UltimoAcessoStorage {
  id: number;
  nome: string;
  perfil: string;
  timestamp: string;
}

export function LoginPage() {
  const { login } = useSessionStore();
  const { data: usuarios = [], isLoading, isError, refetch } = useUsuariosAtivos();
  const criarUsuarioMut = useCriarUsuario();
  const [isSeeding, setIsSeeding] = useState(false);
  const [ultimoAcesso, setUltimoAcesso] = useState<UltimoAcessoStorage | null>(null);

  // Carrega o último colaborador que acessou nesta máquina
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY_ULTIMO_ACESSO);
      if (salvo) {
        setUltimoAcesso(JSON.parse(salvo));
      }
    } catch {
      // Ignora erro de parsing do localStorage
    }
  }, []);

  // Extrai as 2 primeiras letras do nome (ex: Lucas -> LU, Ana -> AN, Marina -> MA)
  const obterIniciais = (nome: string): string => {
    if (!nome) return '??';
    const partes = nome.trim().split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return partes[0].slice(0, 2).toUpperCase();
  };

  // Formata o texto amigável do último acesso (ex: "hoje às 18:02")
  const formatarDataAcesso = (isoString?: string): string => {
    if (!isoString) return 'recentemente';
    const data = new Date(isoString);
    if (isNaN(data.getTime())) return 'recentemente';

    const hoje = new Date();
    const mesmoDia =
      data.getDate() === hoje.getDate() &&
      data.getMonth() === hoje.getMonth() &&
      data.getFullYear() === hoje.getFullYear();

    const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return mesmoDia ? `hoje às ${hora}` : `${data.toLocaleDateString('pt-BR')} às ${hora}`;
  };

  // Agrupamento dos colaboradores ativos por perfil real vindo do banco
  const garcons = useMemo(() => usuarios.filter((u) => u.perfil === 'garcom'), [usuarios]);
  const caixas = useMemo(() => usuarios.filter((u) => u.perfil === 'caixa'), [usuarios]);
  const gerentes = useMemo(() => usuarios.filter((u) => u.perfil === 'gerente'), [usuarios]);

  // Colaborador em destaque para "Último acesso"
  const operadorDestaque = useMemo(() => {
    if (ultimoAcesso) {
      const match = usuarios.find((u) => u.id === ultimoAcesso.id);
      if (match) {
        return {
          usuario: match,
          tempoTexto: formatarDataAcesso(ultimoAcesso.timestamp),
        };
      }
    }
    if (garcons.length > 0) {
      return {
        usuario: garcons[0],
        tempoTexto: 'turno disponível',
      };
    }
    if (caixas.length > 0) {
      return {
        usuario: caixas[0],
        tempoTexto: 'turno disponível',
      };
    }
    if (gerentes.length > 0) {
      return {
        usuario: gerentes[0],
        tempoTexto: 'turno disponível',
      };
    }
    return null;
  }, [ultimoAcesso, usuarios, garcons, caixas, gerentes]);

  const handleEntrarComUsuario = (usuario: Usuario) => {
    try {
      const registro: UltimoAcessoStorage = {
        id: usuario.id,
        nome: usuario.nome,
        perfil: usuario.perfil,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY_ULTIMO_ACESSO, JSON.stringify(registro));
    } catch {
      // Ignora erro de gravação
    }
    login(usuario);
  };

  // Criação inicial no PostgreSQL caso o banco esteja vazio
  const handleCriarOperadoresIniciais = async () => {
    setIsSeeding(true);
    try {
      await criarUsuarioMut.mutateAsync({ nome: 'Lucas', perfil: 'garcom' });
      await criarUsuarioMut.mutateAsync({ nome: 'Ana', perfil: 'garcom' });
      await criarUsuarioMut.mutateAsync({ nome: 'Rodrigo', perfil: 'garcom' });
      await criarUsuarioMut.mutateAsync({ nome: 'Marina', perfil: 'caixa' });
      await criarUsuarioMut.mutateAsync({ nome: 'Carlos', perfil: 'gerente' });
      await refetch();
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col md:flex-row font-sans selection:bg-brand selection:text-on-brand">
      {/* ─────────────────────────────────────────────────────────────
          SIDEBAR ESQUERDA (DESKTOP) — Fiel a X01 Login operacional.png
          ───────────────────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-[340px] lg:w-[380px] bg-nav text-white flex-col justify-between p-8 lg:p-10 shrink-0 select-none border-r border-[#43342A]">
        <div>
          <Logo size={52} comNome fundo="escuro" />

          <h1 className="text-white font-extrabold text-xl lg:text-2xl tracking-tight mt-6 mb-2">
            Bar &amp; Restaurante
          </h1>
          <p className="text-[#C9B8A6] text-xs lg:text-sm leading-relaxed mb-10">
            Salão, caixa, cozinha e gestão executiva no mesmo ritmo.
          </p>

          {/* Lista de Recursos com Ícones Lineares */}
          <div className="space-y-4 text-xs lg:text-sm text-[#F6EEE4] font-medium">
            <div className="flex items-center gap-3">
              <Utensils className="w-4 h-4 text-[#C9B8A6] shrink-0" />
              <span>Garçom no celular</span>
            </div>
            <div className="flex items-center gap-3">
              <Monitor className="w-4 h-4 text-[#C9B8A6] shrink-0" />
              <span>Caixa no balcão</span>
            </div>
            <div className="flex items-center gap-3">
              <BarChart3 className="w-4 h-4 text-[#C9B8A6] shrink-0" />
              <span>Gestão e Analytics BI</span>
            </div>
          </div>
        </div>

        {/* Rodapé da Sidebar */}
        <div className="text-[11px] text-[#C9B8A6]/70 border-t border-[#43342A] pt-4">
          <span>VaptPDV · Sistemas Distribuídos</span>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          HEADER COMPACTO (MOBILE) — Fiel a X01 Login (celular).png
          ───────────────────────────────────────────────────────────── */}
      <header className="md:hidden flex items-center gap-3 p-5 pb-2">
        <LogoMark size={44} className="shrink-0" />
        <div className="flex-1">
          <h1 className="font-black text-lg text-text tracking-tight leading-tight">
            Vapt<span className="text-brand">PDV</span>
          </h1>
          <p className="text-xs text-text-2">Acesso Operacional</p>
        </div>
        <ThemeToggle variante="icon" />
      </header>

      {/* ─────────────────────────────────────────────────────────────
          ÁREA PRINCIPAL DIREITA — Seleção de Operador
          ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 bg-bg p-5 sm:p-8 lg:p-12 overflow-y-auto flex flex-col justify-between">
        <div className="max-w-4xl w-full">
          {/* Título da Tela */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
              Quem está entrando?
            </h2>
            <p className="text-xs sm:text-sm text-text-2 mt-1">
              Escolha seu perfil para abrir o turno de trabalho.
            </p>
          </div>

          {/* Estado de Carregamento Skeleton */}
          {isLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 w-28 bg-surface-2 rounded" />
              <div className="h-20 bg-surface rounded-[20px] border border-border" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                <div className="h-16 bg-surface rounded-[16px] border border-border" />
                <div className="h-16 bg-surface rounded-[16px] border border-border" />
                <div className="h-16 bg-surface rounded-[16px] border border-border" />
              </div>
            </div>
          )}

          {/* Erro de Conexão com a API */}
          {isError && !isLoading && (
            <div className="p-6 rounded-[20px] bg-danger-soft border border-danger/30 text-center mb-6">
              <AlertCircle className="w-8 h-8 text-danger mx-auto mb-2" />
              <h3 className="font-bold text-sm text-danger-text">
                Não foi possível conectar ao servidor
              </h3>
              <p className="text-xs text-danger-text/80 mt-1 mb-4">
                Verifique se o backend Fastify e o PostgreSQL estão em execução na porta 3000.
              </p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Banco Vazio: Convite para Criar Operadores Iniciais */}
          {!isLoading && !isError && usuarios.length === 0 && (
            <div className="p-8 rounded-[20px] bg-surface border border-border text-center shadow-soft my-6">
              <div className="w-12 h-12 rounded-full bg-brand-soft text-brand-text flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-text">
                Nenhum colaborador cadastrado no banco
              </h3>
              <p className="text-xs text-text-2 max-w-md mx-auto mt-1 mb-6">
                Para começar a operar o restaurante, cadastre os colaboradores da equipe no banco de
                dados PostgreSQL com um clique.
              </p>
              <Button
                variant="primary"
                onClick={handleCriarOperadoresIniciais}
                disabled={isSeeding}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {isSeeding ? 'Gravando no banco PostgreSQL...' : 'Criar Operadores Iniciais no Banco'}
              </Button>
            </div>
          )}

          {/* Conteúdo Real com Colaboradores */}
          {!isLoading && !isError && usuarios.length > 0 && (
            <div className="space-y-8">
              {/* Card Herói: Último Acesso (com borda mostarda #F2A81D) */}
              {operadorDestaque && (
                <div>
                  <div className="text-xs font-bold text-text-2 mb-2">Último acesso</div>
                  <div
                    onClick={() => handleEntrarComUsuario(operadorDestaque.usuario)}
                    className="group bg-surface border-2 border-brand rounded-[20px] p-4 sm:p-5 flex items-center justify-between shadow-soft hover:shadow-card transition-all cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                      {/* Avatar Circular com Iniciais */}
                      <div className="w-12 h-12 rounded-full bg-brand-soft text-brand-text font-black text-base flex items-center justify-center shrink-0 shadow-soft">
                        {obterIniciais(operadorDestaque.usuario.nome)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-base text-text group-hover:text-brand-text transition-colors truncate">
                          {operadorDestaque.usuario.nome}
                        </div>
                        <div className="text-xs text-text-2 mt-0.5 capitalize">
                          {operadorDestaque.usuario.perfil} · {operadorDestaque.tempoTexto}
                        </div>
                      </div>
                    </div>

                    {/* Botão Entrar > (Desktop) ou Chevron (Mobile) */}
                    <div className="shrink-0 ml-3">
                      <div className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand hover:bg-brand-hover text-on-brand font-extrabold text-xs shadow-soft transition-all group-hover:scale-105">
                        <span>Entrar</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-text-2 group-hover:text-brand-text sm:hidden transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              )}

              {/* Seções por Perfil Real do Banco */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Coluna 1: Garçons */}
                {garcons.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-text-2 mb-3">Garçons</div>
                    <div className="space-y-2.5">
                      {garcons.map((garcom) => (
                        <button
                          key={garcom.id}
                          type="button"
                          onClick={() => handleEntrarComUsuario(garcom)}
                          className="w-full bg-surface border border-border hover:border-brand rounded-[16px] p-3.5 flex items-center justify-between shadow-soft hover:shadow-card transition-all text-left group active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-brand-soft text-brand-text font-black text-xs flex items-center justify-center shrink-0">
                              {obterIniciais(garcom.nome)}
                            </div>
                            <span className="font-bold text-sm text-text truncate group-hover:text-brand-text transition-colors">
                              {garcom.nome}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-text-2 group-hover:text-brand-text group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coluna 2: Caixa */}
                {caixas.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-text-2 mb-3">Caixa</div>
                    <div className="space-y-2.5">
                      {caixas.map((caixa) => (
                        <button
                          key={caixa.id}
                          type="button"
                          onClick={() => handleEntrarComUsuario(caixa)}
                          className="w-full bg-surface border border-border hover:border-brand rounded-[16px] p-3.5 flex items-center justify-between shadow-soft hover:shadow-card transition-all text-left group active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-brand-soft text-brand-text font-black text-xs flex items-center justify-center shrink-0">
                              {obterIniciais(caixa.nome)}
                            </div>
                            <span className="font-bold text-sm text-text truncate group-hover:text-brand-text transition-colors">
                              {caixa.nome}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-text-2 group-hover:text-brand-text group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coluna 3: Gestão & Gerência */}
                {gerentes.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-text-2 mb-3">Gestão &amp; BI</div>
                    <div className="space-y-2.5">
                      {gerentes.map((gerente) => (
                        <button
                          key={gerente.id}
                          type="button"
                          onClick={() => handleEntrarComUsuario(gerente)}
                          className="w-full bg-surface border border-border hover:border-brand rounded-[16px] p-3.5 flex items-center justify-between shadow-soft hover:shadow-card transition-all text-left group active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-brand text-on-brand font-black text-xs flex items-center justify-center shrink-0 shadow-soft">
                              {obterIniciais(gerente.nome)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-sm text-text truncate group-hover:text-brand-text transition-colors block">
                                {gerente.nome}
                              </span>
                              <span className="text-[11px] text-text-2">Gerência</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-text-2 group-hover:text-brand-text group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Barra Inferior com Botão Tema — alterna entre claro e escuro */}
        <div className="pt-8 hidden md:flex justify-end">
          <ThemeToggle />
        </div>
      </main>
    </div>
  );
}
