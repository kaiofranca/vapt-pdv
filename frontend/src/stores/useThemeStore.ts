import { create } from 'zustand';

export type Tema = 'claro' | 'escuro';

const STORAGE_KEY = 'vapt_pdv_tema';

function obterTemaInicial(): Tema {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo === 'claro' || salvo === 'escuro') return salvo;
  } catch {
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'escuro';
  }
  return 'claro';
}

function aplicarTema(tema: Tema) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', tema === 'escuro');
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', tema === 'escuro' ? '#17120F' : '#2B2019');
}

interface ThemeState {
  tema: Tema;
  alternarTema: () => void;
  definirTema: (tema: Tema) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  tema: obterTemaInicial(),
  definirTema: (tema) => {
    try {
      localStorage.setItem(STORAGE_KEY, tema);
    } catch {
    }
    aplicarTema(tema);
    set({ tema });
  },
  alternarTema: () => get().definirTema(get().tema === 'claro' ? 'escuro' : 'claro'),
}));

if (typeof window !== 'undefined') {
  aplicarTema(useThemeStore.getState().tema);

  try {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', (e) => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) {
          useThemeStore.getState().definirTema(e.matches ? 'escuro' : 'claro');
        }
      } catch {
      }
    });
  } catch {
  }
}
