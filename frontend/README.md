# VaptPDV — Frontend Web/PWA

Interface operacional Web/PWA do ecossistema **VaptPDV** (Ponto de Venda, Atendimento de Salão, Cozinha/Bar, Frente de Caixa e Gestão Executiva) para bares e lanchonetes.

## Stack Tecnológica

- **React 19** + **TypeScript**
- **Vite** + `vite-plugin-pwa` (suporte PWA e proxy de desenvolvimento para os serviços `:3000`–`:3003`)
- **Tailwind CSS** (identidade visual *Mostarda `#F2A81D`, Café `#2B2019` e Creme `#FBF7F1`*, sem neon e sem emoji, alvos de toque `>= 44x44px`, WCAG 2.2 AA)
- **TanStack Query v5** (sincronização e cache de estado servidor)
- **Zustand** (estado local de sessão e UI)
- **lucide-react** (iconografia operacional)

## Modos Operacionais

| Rota | Modo | Perfil(is) | Integração Principal |
| :--- | :--- | :--- | :--- |
| `/login` | Autenticação Operacional | Todos | `vapt-pdv-core` (`:3000`) |
| `/garcom` | Atendimento de Salão PWA (Mobile) | `garcom`, `gerente` | `vapt-pdv-core` (`:3000`) |
| `/kds` | Painel TV da Cozinha / Bar (KDS) | `cozinha`, `gerente` | `kds-service` (`:3001`) |
| `/caixa` | Frente de Caixa, Split Payment e Recibo `.paper` (Desktop) | `caixa`, `gerente` | `vapt-pdv-core` (`:3000`) + `caixa-service` (`:3002`) |
| `/gestao` | Portal Gerencial, Analytics/OLAP, Cardápio, Estoque e Equipe | `gerente` | `vapt-pdv-core` (`:3000`) + `gestao-service` (`:3003`) |

## Comandos

Execute dentro de `frontend/`:

```bash
npm install        # Instala dependências
npm run dev        # Servidor Vite (porta 5173 com proxy para :3000–:3003)
npm run typecheck  # Verificação estática TypeScript
npm run lint       # Verificação Oxlint
npm run build      # Compila bundle de produção (integrado ao backend/public/ no deploy)
npm test           # Executa a suíte Vitest (131 testes automatizados)
```

## Referências de Design e UX

- [`../docs/DESIGN.md`](../docs/DESIGN.md) — Sistema visual, tokens de cor, tipografia e padrões de acessibilidade.
- [`../docs/engenharia/08-ux-e-experiencia-frontend.md`](../docs/engenharia/08-ux-e-experiencia-frontend.md) — Especificação de UX, jornadas e catálogo das telas.
