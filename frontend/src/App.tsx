import { LoginPage } from './features/auth/LoginPage';
import { ModoGarcomPage } from './features/garcom/ModoGarcomPage';
import { ModoCaixaPage } from './features/caixa/ModoCaixaPage';
import { ModoGestaoPage } from './features/gestao/ModoGestaoPage';
import { ModoKdsPage } from './features/kds/ModoKdsPage';
import { useSessionStore } from './stores/useSessionStore';

export function App() {
  const { modo } = useSessionStore();

  if (modo === 'garcom') {
    return <ModoGarcomPage />;
  }

  if (modo === 'caixa') {
    return <ModoCaixaPage />;
  }

  if (modo === 'gestao') {
    return <ModoGestaoPage />;
  }

  if (modo === 'kds') {
    return <ModoKdsPage />;
  }

  // Padrão: tela de seleção de operador / login
  return <LoginPage />;
}

export default App;
