# DESIGN.md — VaptPDV

Sistema de PDV, KDS e gestão para restaurantes, lanchonetes e bares (multi-segmento, configurável por estabelecimento). Este documento é a fonte única de verdade visual, funcional e de conteúdo: use exatamente estes tokens, formas, fluxos e regras.

**Como ler.** As seções 1 a 5 são o contrato visual puro (cor, tipografia, forma, espaço). A seção 6 é o **catálogo de componentes**: peças reutilizáveis, nunca telas completas. A seção 7 é o **inventário de telas**: toda tela real do produto, com ID, propósito e layout. A seção 8 traz os fluxos ponta a ponta. As seções 9–11 cobrem estados, acessibilidade e conteúdo. A seção 12 tem o `tokens.css` pronto para copiar. As seções 13–16 cobrem ícones, responsividade, impressão e o que está dentro ou fora da v1.
**Precedência.** Em conflito, vale nesta ordem: spec da tela (`telas/*.md`) > este documento > bom senso. Quando a spec cita um token, ele existe aqui com o mesmo nome.

### Telas vs. componentes — a distinção que este documento mantém sempre

Dois tipos de conteúdo aparecem lado a lado neste arquivo e no canvas de protótipos, e cada um tem uma regra de leitura diferente:

- **Tela (screen).** Um estado completo e navegável do produto, com ID formal (`G01`, `C07`, `K02`, `M05`, `X03`...), tamanho de viewport fixo e lugar definido no mapa de navegação (§7 e §8). Uma tela é o que o usuário realmente vê ao abrir o app numa etapa do trabalho dele. Toda tela é construída **compondo componentes do §6** — uma tela nunca introduz um estilo novo que não exista no catálogo.
- **Componente (component).** Uma peça de interface reutilizável — botão, pill, card de mesa, ticket do KDS, campo, modal — documentada uma vez no §6, com todos os seus estados (padrão, hover, foco, pressionado, desabilitado, carregando, erro). Um componente **não é uma tela**: ele não tem ID de navegação, não aparece sozinho no mapa do produto e seu propósito é ser citado por várias telas diferentes. Quando a spec de uma tela diz "usa `StatusPill`" ou "usa `Stepper`", ela está apontando para a definição única no §6, não redefinindo o componente ali.

Regra prática: se você está descrevendo "o que a pessoa vê quando abre X", é tela (vai para §7). Se está descrevendo "como esse botão/card/campo se comporta em qualquer lugar que ele apareça", é componente (vai para §6). Nenhuma informação de comportamento de componente deve ser duplicada dentro do inventário de telas — o inventário só diz **quais** componentes a tela usa e **como eles se organizam no layout**.

## 1. Direção

- **Personalidade:** acolhedora, rápida, confiável. Visual limpo, cantos arredondados, cores de alimentos (mostarda, café, creme, manjericão, tomate).
- **Assinatura visual (o que torna o VaptPDV reconhecível):** (1) o **tile tintado** de produto, um quadrado arredondado com a cor da categoria e um ícone linear; (2) a **faixa lateral de estado** (10 px no ticket do KDS, 4 px em "Minha mesa", 6 px no toast); (3) a **mostarda só em ação**: se algo é mostarda, dá para tocar ou está selecionado. O resto fica quieto, em creme, café e branco.
- **Proibido:** emojis, cores neon, gradientes decorativos, sombras pesadas, ícones coloridos aleatórios, cartão dentro de cartão, ícone sozinho em ação ambígua.
- **Prioridade:** velocidade e clareza na operação (pico de movimento) acima de ornamento. Poucos toques por venda (meta do Garçom: lançar um item em até 3 toques), layout estável, sem saltos de conteúdo.
- **Temas:** claro e escuro em todos os módulos, com modo Automático. KDS abre em escuro por padrão (leitura à distância); perfil `cozinha` entra em escuro mesmo com tema global claro.
- **Idioma:** pt-BR. Moeda `R$ 1.234,56`, datas `24/10/2026`, hora 24 h (`19:42`).
- **Usuários e contexto:** garçom em pé, uma mão, celular 360–430 px, pressa, luz variável; caixa em balcão, mouse, teclado e toque, turnos longos; cozinha a 2–3 m de uma TV, mãos sujas, pouco ou nenhum toque; gerente em desktop analisando o dia. Sem senha de operador na v1 (login por escolha de pessoa).
- **Escopo da v1** (as telas só prometem o que existe): sem fila offline de vendas, sem NFC-e, sem desconto, sem transferência de mesa, sem impressora real, sem foto de produto, sem resgate de cashback. Ver §16.

## 2. Cores (tokens semânticos)

### 2.1 Tokens

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| bg (Creme) | #FBF7F1 | #17120F | fundo de tela |
| surface | #FFFFFF | #221A15 | cards, painéis, campos |
| surface-raised | #FFFFFF | #2A2019 | modal, drawer, sheet, toast, popover (no escuro é mais claro que surface: elevação por tom) |
| surface-2 | #F3ECE1 | #2D231C | campos desabilitados, steppers, trilhos, cabeçalho de tabela, hover de linha |
| border | #E5DACB | #43342A | bordas decorativas e divisores (não identifica controle sozinho) |
| border-strong | #8C7A68 | #8F7B69 | borda de controle (campo, chip inativo, switch desligado, checkbox, mesa livre tracejada); ≥ 3:1 |
| text (Café) | #2B2019 | #F6EEE4 | texto principal |
| text-2 | #6A5849 | #C2B1A0 | texto de apoio, placeholder, ícone de tile |
| brand (Mostarda) | #F2A81D | #F5B335 | fundo de ação primária e item ativo |
| brand-hover | #E39A0B | #F8BF52 | primário em hover (só ponteiro fino) |
| brand-press | #C98400 | #E0A024 | primário pressionado |
| on-brand | #2B2019 | #2B2019 | texto e ícone sobre brand |
| brand-soft | #FDF0D2 | #3D2E14 | seleção, atenção, "ocupada" e "em preparo" |
| brand-text | #8A5200 | #F5C766 | texto sobre brand-soft ou sobre superfície; contorno de gráfico |
| brand-edge | #A86400 | #F5B335 | **linha ou ícone** de seleção (borda 2 px de item em pedido, marcador "Minha", ponto de badge); no claro a mostarda pura não chega a 3:1, por isso existe este token |
| nav | #3A2A21 | #0F0B09 | rail e sidebar |
| nav-active-bg | #523C2E | #2A201A | item ativo da navegação |
| nav-text | #F6EEE4 | #F6EEE4 | texto e ícone da navegação |
| nav-text-2 | #C9B8A6 | #BBAA98 | item inativo da navegação |
| success (Manjericão) | #2F7D4F | #5FC083 | livre, pronto, ligado (switch), barra de pagamento |
| success-soft | #DDF0E4 | #1D3326 | fundo de sucesso |
| success-text | #1F6B3E | #7FD39D | texto sobre success-soft |
| danger (Tomate) | #C4391D | #F07A60 | erro, atraso, destrutivo, conta pedida |
| danger-soft | #FBE3DC | #3D1E17 | fundo de erro |
| danger-text | #A52E15 | #FF9C85 | texto sobre danger-soft |
| on-danger | #FFFFFF | #2B2019 | texto sobre `danger` sólido (só em diálogo de confirmação) |
| focus | #2B2019 | #F6EEE4 | anel de foco (igual ao texto) |
| scrim | rgba(43,32,25,.5) | rgba(0,0,0,.62) | fundo de modal e drawer (`--color-scrim`) |
| chart-bar | #F2A81D | #F5B335 | preenchimento de barras |
| chart-bar-stroke | #8A5200 | #F5C766 | contorno de barras e de HBar |
| tint-1 mostarda | #FBE6B8 | #4A3815 | tile de produto |
| tint-2 manjericão | #E4EFD5 | #27382A | tile de produto |
| tint-3 tomate | #F8D9CC | #4A2A20 | tile de produto |
| tint-4 cappuccino | #EBDDCB | #3A2E25 | tile de produto |

### 2.2 Regras de uso

- Texto normal ≥ 4,5:1; texto grande, componentes, linhas de controle e foco ≥ 3:1 (tabela 2.4).
- **Mostarda é cor de ação**, nunca de erro. No tema claro ela é **preenchimento** (botão, chip ativo, FAB) com `on-brand` por cima; como linha ou ícone solto use `brand-edge`, e como texto use `brand-text`.
- Estado nunca depende só de cor: sempre texto ou ícone junto. A faixa lateral colorida do ticket vem com o texto "Atenção" ou "Atrasado".
- Cor de feedback usa o trio `soft` (fundo) + `text` (texto) + cor cheia (faixa, borda ou ícone). Não misture trios.
- `danger` cheio como fundo só no botão `destructive-solid` dentro de diálogo de confirmação.
- Fundos brancos fixos só em dois lugares: QR Code (também no tema escuro) e impressão do recibo.
- Gráficos usam uma cor (mostarda) com rótulos diretos; nada de arco-íris.

### 2.3 Mapa de status (rótulos oficiais)

Toda pill de status é o componente `StatusPill` (§6.3) com texto sempre visível.

| Domínio | Valor da API | Rótulo | Fundo / texto | Ícone |
|---|---|---|---|---|
| Mesa | sem comanda | Livre | success-soft / success-text | `circle-check` |
| Mesa | `aberta` | Aberta | brand-soft / brand-text | `utensils` |
| Mesa | `fechada` ou conta pedida | Conta pedida | danger-soft / danger-text (+ borda 2 px `danger` no card) | `receipt` |
| Mesa | `garcom_id` = operador | Minha (marcador `brand-edge` de 4 px na lateral do card, além da pill de status normal) | — | `user` |
| Comanda | `aberta` | Aberta | brand-soft / brand-text | `clock` |
| Comanda | `fechada` | Aguardando pagamento | danger-soft / danger-text | `receipt` |
| Comanda | `paga` | Paga | success-soft / success-text | `circle-check` |
| Comanda | `cancelada` | Cancelada | surface-2 / text-2 | `circle-x` |
| Ficha | `recebido` | Aguardando / Na fila | surface-2 / text-2 | `hourglass` |
| Ficha | `em_preparo` | Em preparo / Preparando | brand-soft / brand-text | `flame` |
| Ficha | `pronto` | Pronto | success-soft / success-text | `bell` / `circle-check` |
| Ficha | `entregue` | Entregue | surface-2 / text-2 | `check` |
| Ficha | `cancelado` | Cancelado | surface-2 / text-2, nome riscado | `circle-x` |
| SLA do ticket | dentro / atenção / atraso | `mm:ss` · `mm:ss · Atenção` · `mm:ss · Atrasado` | success / brand / danger (soft + text) | `clock` / `hourglass` / `alert-triangle` |
| Sistema | sincronizado / degradado / sem conexão | Conectado · Reconectando · Sem conexão | success / brand / danger (soft + text) | `circle-check` / `refresh-cw` / `wifi-off` |
| Estoque | 0 | Esgotado | danger-soft / danger-text | — |
| Estoque | abaixo do mínimo | Baixo | danger-soft / danger-text | `triangle-alert` |
| Cadastro | `ativo=false` | Inativo | surface-2 / text-2 | — |
| Login | último operador | Último acesso | — (card com borda de seleção `brand-edge`) | — |

### 2.4 Contrastes verificados (WCAG 2.2 AA)

Calculados com a fórmula de luminância relativa; todos passam nos dois temas.

| Par | Claro | Escuro | Mínimo |
|---|---|---|---|
| text em bg / surface | 14,9 / 15,9 | 16,2 / 14,9 | 4,5 |
| text-2 em surface / surface-2 | 6,8 / 5,8 | 8,2 / 7,4 | 4,5 |
| on-brand em brand | 7,9 | 8,6 | 4,5 |
| brand-text em brand-soft | 5,7 | 8,3 | 4,5 |
| success-text em success-soft | 5,5 | 7,5 | 4,5 |
| danger-text em danger-soft | 5,7 | 7,4 | 4,5 |
| on-danger em danger | 5,3 | 5,8 | 4,5 |
| nav-text em nav / nav-active-bg | 11,9 / 8,9 | 17,0 / 13,8 | 4,5 |
| nav-text-2 em nav | 7,1 | 8,7 | 4,5 |
| border-strong em surface | 4,1 | 4,2 | 3 |
| focus em bg | 14,9 | 16,2 | 3 |
| brand-edge em surface | 4,7 | 9,3 | 3 |
| success e danger (linhas, ícones) em surface | 5,0 / 5,3 | 7,6 / 6,2 | 3 |
| **brand (mostarda) como linha em surface** | **2,0 — não usar** | 9,3 | 3 |

### 2.5 Tiles por categoria

O tile do produto tem a tint da categoria e o ícone linear em `text-2` (contraste do ícone sobre a tint ≥ 5:1 nos dois temas). Categoria desconhecida cicla as quatro tints pelo hash do nome. Este é um **componente** (`ProductTile`, §6.3), não um tipo de tela.

| Categoria | Tint | Ícone |
|---|---|---|
| Lanches | tint-1 mostarda | `sandwich` |
| Porções | tint-2 manjericão | `drumstick` |
| Sobremesas | tint-3 tomate | `ice-cream-cone` |
| Bebidas | tint-4 cappuccino | `cup-soda` |
| Combos | tint-1 mostarda | `package` |
| Outras | por hash | `utensils` |

## 3. Tipografia

- Família: **Plus Jakarta Sans** (500–800), `woff2`/Google Fonts; fallback `system-ui`. Números com `font-variant-numeric: tabular-nums` em preços, tabelas, relógios e cronômetros.
- **Escala base (px/peso):** `fs-kpi` 30–38/800 · `fs-title` 24–26/800 · `fs-section` 16–20/700–800 · `fs-body` 14–15/600–700 · `fs-caption` 13/600–700 · `fs-micro` 12/700 (mínimo absoluto).
- Altura de linha: 1,4 no corpo, 1,15–1,2 em títulos e números grandes. Nenhum rótulo de botão quebra linha (`white-space: nowrap`).
- Quando o texto é longo, limite a 70 caracteres por linha (ajudas, avisos; o recibo é exceção por ser cupom).
- **Tokens de uso recorrente:** número da mesa 24–38/800 (depende da densidade da grade) · total do pedido 26–38/800 · título de modal 20/800 · rótulo de campo 13/700 · ajuda e erro 13/600 · preço de card 14–16/700–800 · nome de produto 14–15/700 · navegação 13/700 (rail e bottom) e 15/700 (sidebar) · valor do campo de dinheiro no pagamento 24–32/800 · troco 26–30/800.
- **KDS (leitura a 2–3 m):**

| Token | Px/peso | Onde |
|---|---|---|
| `--fs-kds-place` | 40/800 | local do pedido ("Mesa 6", "Balcão 0483") |
| `--fs-kds-qty` | 32/800 | "2×" (coluna fixa de 72 px) |
| `--fs-kds-item` | 30/700 | nome do item |
| `--fs-kds-note` | 22/700 | observação (`brand-text`) |
| `--fs-kds-allergy` | 28/800 | bloco de alergia (`danger-text`, fundo `danger-soft`) |
| `--fs-kds-button` | 26/800 | botão do ticket (72 px) |
| `--fs-kds-timer` | 22–24/800 | cronômetro em pill |
| `--fs-kds-header` | 32/800 | título do cabeçalho ("Cozinha e bar") |
| `--fs-kds-clock` | 32/800 | relógio do cabeçalho |

  A escala compacta (a partir de 5 tickets na coluna) reduz estes valores proporcionalmente. Abaixo de 1280 px de largura as fontes escalam, e as colunas permanecem.
- **Rótulos de botão:** verbo + objeto ("Enviar ao preparo", "Cobrar", "Confirmar e avisar o caixa"). Sem caixa-alta corrida; frases em *sentence case*.

## 4. Forma, espaço, elevação, movimento

### 4.1 Raios
| Token | Valor | Uso |
|---|---|---|
| `--radius-xs` | 6 | `kbd`, barras de gráfico (topo), ícone de badge interno |
| `--radius-control` | 14 | botões md/lg, campos, linhas de lista, toasts, banners, tiles de produto, chips (quando não são pill) |
| `--radius-card` | 20 | cards de produto, item de lista em card, modal pequeno |
| `--radius-card-lg` | 24 | mesa, ticket do KDS, cardl (painéis grandes), modal médio |
| `--radius-btn-lg` | 18 | botões xl, xxl e KDS |
| `--radius-sheet` | 28 | topo do bottom sheet |
| `--radius-pill` | 999 | chips, pills, switch, FAB, avatar, segmented control |

Uma lógica só: o raio cresce com o tamanho do elemento. Não misturar raios dentro de um mesmo componente.

### 4.2 Espaço
Múltiplos de 4: 4, 8, 12, 16, 24, 32, 48. Margem lateral do celular 16–20; gap de grade 12 (mesas) e 16 (produtos/cards de gestão); padding de card 12–24; margem e gap do KDS 32–40.

### 4.3 Elevação
Borda de 1 px + sombra muito leve. `--shadow-1`: `0 1px 2px rgba(43,32,25,.06)`. `--shadow-float` (FAB, modal, drawer, sheet, toast): `0 6px 16px rgba(43,32,25,.16)`. No escuro, sem sombra: a elevação vem do tom (`surface` < `surface-raised`).

### 4.4 Movimento
- Só para feedback: rápido (~100 ms) para toque/press, base (~160 ms) para troca de coluna e entrada de ticket, lento (~240 ms) para modal (fade + leve deslocamento vertical) e drawer (slide lateral).
- Anime só `transform` e `opacity`. Skeleton com *shimmer* suave.
- Um único movimento espontâneo permitido: a borda do ticket do KDS pulsa **uma vez** quando chega um pedido novo (sem piscar acima de 3 Hz).
- `prefers-reduced-motion: reduce` remove shimmer, pulse e deslizes; fica só a troca de estado.

### 4.5 Camadas (z-index)
Ordem crescente: conteúdo normal → elemento fixo (barra inferior, rodapé fixo) → FAB → scrim/drawer → modal → toast (sempre no topo de tudo).

### 4.6 Alvos e alturas
Alvo mínimo 44×44 (celular e caixa touch); KDS 56–72. Altura de botão: md 44 · lg 52 · xl 60 · xxl 68 (ex.: "Cobrar") · kds 72. Campo 48–52. Chip 44. Linha de tabela 56 (compacta 44).

## 5. Princípios de interação (regras transversais a todos os componentes)

Todo controle interativo tem até 6 estados possíveis, nem todos aplicáveis a todo componente: **padrão, hover** (só com ponteiro fino, nunca a única pista), **foco** (anel visível sempre), **pressionado, desabilitado** (com o motivo escrito, nunca silencioso) **e carregando** (`aria-busy`, rótulo mantido, sem mudar de largura).

- **Desabilitado sempre explica por quê**: um botão apagado sem texto é uma UX quebrada. Ex.: "Cobrar · Faltam R$ 84,98", "Enviar ao preparo · sem conexão", "Transferir mesa · disponível em breve".
- **Nunca "Sim/Não" ou "OK"** em diálogos — o rótulo do botão sempre nomeia a ação ("Cancelar comanda", "Manter comanda").
- **Preferir Desfazer a confirmar**: ações reversíveis (remover item, avançar ficha do KDS) usam uma janela curta de desfazer; ações irreversíveis ou de alto impacto (cancelar comanda, remover pagamento, inativar produto) pedem confirmação explícita (§8.6).
- **Toda cor de estado vem acompanhada de texto ou ícone** — nunca só cor.

## 6. Catálogo de componentes

> Esta seção documenta **peças reutilizáveis**, não telas. Nenhum componente aqui tem ID de navegação nem aparece sozinho no mapa do produto (§7); cada um é citado por várias telas diferentes, que combinam componentes para formar um layout completo. Quando um nome aparece em negrito pela primeira vez, é o nome oficial do componente — use-o nas specs de tela em vez de redescrever o comportamento.

### 6.1 Botões e ações

- **Botão primário** (`.btn`): fundo mostarda, texto `on-brand`, peso 800; um por região de tela (nunca dois botões primários competindo na mesma área visível).
- **Botão secundário** (`.btn.s`): fundo `surface`, borda `border-strong`, texto `text`. Para a ação alternativa ao lado do primário ("Cancelar", "Voltar").
- **Botão terciário** (`.btn.t`): só texto, sem fundo nem borda. Para ações de baixo compromisso dentro de um toast ou card ("Desfazer", "Ver").
- **Botão destrutivo** (`.btn.d`): texto `danger-text`, fundo `surface`, borda `border-strong`. Usado fora de diálogo, quando a ação ainda não é definitiva (ex.: "Excluir produto" num formulário, que abre confirmação).
- **Botão destrutivo sólido** (`.btn.ds`): fundo `danger`, texto `on-danger`. Só dentro de `ConfirmDialog`, nunca solto numa tela.
- **Botão de sucesso contornado** (`.btn.so`): fundo `success-soft`, borda 2 px `success`, texto `success-text`. Para confirmar uma entrega ou conclusão sem ser o CTA principal da tela (ex.: "Marcar como entregue" no KDS).
- **Botão desabilitado** (`.btn.dis`): fundo `surface-2`, texto `text-2`, ícone de cadeado opcional, e sempre uma segunda linha pequena com o motivo.
- **Tamanhos:** md (44) padrão em listas e formulários · lg (52) em cards e modais · xl (60) no CTA principal de uma tela de celular ("Enviar ao preparo") · xxl (68) no CTA mais crítico de um fluxo de dinheiro ("Cobrar", "Continuar para pagamento") · kds (72) exclusivo dos tickets do painel de cozinha.
- **Botão de ícone** (`.ib`): quadrado 44×44 arredondado, com ou sem contorno/fundo suave. Para ações auxiliares de cabeçalho (voltar, fechar, mais opções) — sempre com `aria-label` quando não tem texto visível.
- **FAB** (botão de ação flutuante): pill flutuante no canto inferior direito do celular, só para a ação mais frequente da tela ("+ Abrir mesa"). Nunca mais de um por tela.

### 6.2 Seleção, filtro e navegação de conteúdo

- **Chip/aba** (`.chip`): pill de 44 px; ativo = fundo mostarda (categorias) ou café (filtros neutros sobre fundo escuro), inativo = `surface` + `border-strong`; contador numérico opcional em pill interna (`.ct`). Linha de chips rola horizontalmente.
- **Segmented control** (`.seg`): grupo de opções mutuamente exclusivas dentro de uma pill de fundo `surface-2`, com a opção ativa destacada em `surface` + borda. Usado para alternar período (Hoje/7 dias/30 dias), tema (Claro/Escuro/Sistema) ou modo de visão.
- **Radio** (`.rad`): círculo de seleção única, usado em listas de escolha (motivo de cancelamento, forma de pagamento, perfil de usuário).
- **Checkbox** (`.cb`): quadrado de seleção múltipla.
- **Switch** (`.sw`): trilho de 44×26, `role="switch"`; ligado = fundo `success` com polegar claro, desligado = `surface-2` + `border-strong`. Rótulo sempre à esquerda, nunca só o controle sozinho.
- **Stepper** (`.stp`): `[−] n [+]` em largura fixa, fundo `surface-2` (ou `brand-soft` quando o item está selecionado/no pedido). O `−` em 1 vira ação de remover.

### 6.3 Exibição de conteúdo

- **StatusPill**: pill de 26–44 px com ícone opcional + texto, nas cores do trio semântico (ver mapa completo em §2.3). É o único componente autorizado a comunicar status — nunca pintar um card inteiro para indicar estado sem também ter uma StatusPill.
- **ProductTile**: quadrado tintado pela categoria (ver §2.5) com ícone linear central. Tamanhos: 40–56 (lista/linha), 96–100% da largura da célula (grade de produtos no Caixa).
- **Avatar** (`.av`): círculo com iniciais, cor `brand-soft`/`brand-text`. Tamanhos 32 (compacto em cabeçalho), 44 (padrão), 56–72 (destaque em perfil/login).
- **Card genérico** (`.card`/`.cardl`): contêiner de superfície com borda sutil e raio padrão; a unidade básica de agrupamento visual em todo o produto (produto, item de pedido, linha de configuração, KPI).
- **Mesa (card)** (`.mesa`): número grande, pill de status, pessoas/tempo/valor quando ocupada. Livre = borda tracejada; Ocupada = borda sólida sutil; **Conta pedida = borda 2 px `danger`** (classe dedicada, nunca reaproveitar uma classe de texto auxiliar para essa borda); Minha = faixa lateral 4 px `brand-edge` adicional.
- **Ticket do KDS** (`.tk`): card grande de cozinha com faixa lateral de 10 px (cor de SLA), local do pedido em fonte gigante, lista de itens com quantidade, observação, bloco de alergia destacado (quando houver) e um botão de 72 px.
- **KPI** (`.kpi`/card de métrica): rótulo pequeno em `text-2`, valor grande 30–38/800, variação opcional com StatusPill de tendência.
- **Gráfico de barras**: barras mostarda com contorno `chart-bar-stroke`; a barra de maior valor (pico) ganha contorno reforçado. Sem eixo decorado, rótulos diretos.
- **HBarList**: lista com rótulo à esquerda, trilho horizontal preenchido e valor/percentual à direita — usado em "mais vendidos" e "por forma de pagamento".
- **Tabela** (`.tb`): cabeçalho em `surface-2`, linhas com altura fixa, sem zebra, coluna numérica alinhada à direita. Em telas estreitas vira lista de cards.
- **Recibo/comprovante** (`.paper`): bloco de papel simulado, fundo branco fixo mesmo no tema escuro, fonte tabular, usado só na tela de venda concluída e na impressão.
- **QR** (`.qr`): grade de módulos preto sobre branco fixo (também no escuro), para pagamento Pix.
- **`kbd`**: tecla de atalho de teclado, só no módulo Caixa.
- **Skeleton** (`.sk`): placeholder cinza com a mesma forma e contagem do conteúdo final, nunca um spinner genérico cobrindo a tela inteira.

### 6.4 Campos e formulários

- **Campo de texto** (`.inp`): rótulo sempre visível acima, borda `border-strong`; foco = borda 2 px `focus`; erro = borda `danger` + ícone + texto `danger-text` abaixo do campo (`.erm`).
- **Campo de dinheiro** (`.inp.mny`): alinhado à direita, prefixo "R$", fonte tabular grande nos fluxos de pagamento.
- **Área de texto** (`.ta`): para observações e descrições longas.
- **Textarea + chips de sugestão**: combinação usada em observação de item (ex.: "Sem cebola", "Bem passado") — os chips preenchem o texto, não o substituem.

### 6.5 Camadas de sobreposição

- **Modal** (`.modal`): centralizado, com scrim por trás; tamanhos pequeno (confirmações, ~480) e médio (formulários curtos, ~640). Foco preso dentro, `Esc` fecha, foco volta ao gatilho ao fechar.
- **Drawer** (`.drawer`): painel lateral direito, para detalhe de registro sem sair do contexto da lista (detalhe de comanda, cliente e fidelidade, novo usuário).
- **Sheet** (`.sheet`): painel que sobe do rodapé no celular, substitui o modal em telas estreitas.
- **ConfirmDialog**: um modal pequeno com título em forma de pergunta nomeando o objeto, 1–2 frases de consequência, botão seguro (foco inicial, nunca o destrutivo) e botão destrutivo nomeado com o verbo da ação.
- **Toast**: faixa flutuante com faixa lateral de 6 px da cor semântica, ícone + texto + ação opcional ("Desfazer", "Ver"), empilhável.
- **Banner**: faixa de largura total, abaixo do cabeçalho, para um estado persistente que precisa de atenção mas não bloqueia a tela (reconectando, impressora indisponível, conexão restabelecida).
- **Faixa inline de erro**: texto + ícone junto ao campo que falhou.

### 6.6 Navegação de módulo

- **BottomNav** (`.bnav`): barra inferior fixa de 4 destinos no celular (Garçom), com badge numérico opcional sobre um ícone (ex.: itens prontos aguardando).
- **RailNav** (`.rail`): coluna estreita de ícones no Caixa.
- **SideNav** (`.side`): coluna larga com rótulos de texto na Gestão.
- **TopBar** (`.top`): cabeçalho horizontal com título da tela, busca, pill de conexão e avatar do operador (Caixa e Gestão).

## 7. Inventário de telas

Toda tela listada aqui tem ID formal, propósito de uma linha e tamanho de viewport fixo. "Composição" lista os componentes do §6 que a tela combina — não repete a definição deles. IDs sem tela publicada hoje (M04, M08) não existem no mapa de navegação atual; não assuma funcionalidade a partir do número ausente.

### 7.0 Transversais (todos os módulos) — viewport variável conforme o contexto

| ID | Tela | Propósito | Composição principal |
|---|---|---|---|
| X01 (desktop) | Login operacional | Escolher "quem está operando" sem senha | Cards de operador agrupados por perfil, StatusPill de conexão, botão de tema |
| X01 (celular) | Login operacional (Garçom) | Mesma escolha, em coluna única e retrato | Lista de cards de operador, "Último acesso" em destaque |
| X02 | Trocar operador | Trocar quem está logado sem sair do app | Modal com lista de radios por pessoa, aviso de que comandas abertas continuam com quem as abriu |
| X03/X04 | Status de conexão · Toasts | Referência visual dos estados de conexão e dos toasts de resultado de ação | StatusPill, banners por severidade, toasts de sucesso/atenção/erro |
| X05 | Confirmações | Referência dos três padrões de ConfirmDialog (destrutivo, de atenção, neutro) | ConfirmDialog em 3 variações lado a lado |
| X06 | Telas de erro | Sem conexão, sem permissão, não encontrado, erro inesperado | 4 estados de erro de página inteira, cada um com ação de recuperação |
| X07 | Estados de lista | Referência de carregando, vazio, sem resultado, erro e "recurso fora da v1" | Skeleton, EmptyState, ErrorState, botão desabilitado com motivo |
| X08/X09 | Instalar app (PWA) · Tema | Instalar o PWA, atualizar versão, escolher tema claro/escuro | Card de instalação, toast persistente de atualização, SegmentedControl de tema com pré-visualização |

### 7.1 Garçom (celular 390×844, retrato, uma mão)

| ID | Tela | Propósito | Composição principal |
|---|---|---|---|
| G01 | Salão | Ver todas as mesas e seu estado para decidir a próxima ação | Chips de filtro com contagem, grade 2 colunas de cards de Mesa, FAB "Abrir mesa", BottomNav |
| G02 | Abrir mesa | Registrar quantas pessoas sentaram e abrir a comanda | Sheet com contador de pessoas, campo de nome opcional, botão xl |
| G03 | Comanda | Montar o pedido de uma mesa aberta | Busca, chips de categoria, lista de produtos com Stepper, rodapé fixo com total e "Enviar ao preparo" |
| G04 | Observação e alergia | Anotar um pedido especial ou alergia num item | Sheet com textarea, chips de sugestão, switch de alergia com campo próprio |
| G05 | Itens enviados | Acompanhar o status de preparo dos itens já enviados | Abas Enviados/Novos, cards com StatusPill de ficha, rodapé com total e "Pedir a conta" |
| G06 | Pedir a conta | Revisar o pedido final e avisar o caixa | Resumo de itens e totais, switch de gorjeta, aviso de bloqueio, CTA xl |
| G07 | Comandas | Ver todas as comandas sob responsabilidade do garçom (ou de todos) | Segmented "Minhas/Todas", lista de cards de comanda com StatusPill |
| G08 | Cozinha | Ver o progresso de preparo dos próprios pedidos | Chips de filtro por status, cards de ficha com ProgressBar, botão "Marcar como entregue" |
| G09 | Perfil | Configurações pessoais e fim de turno | Avatar grande, SegmentedControl de tema, switches de notificação/conexão, "Trocar operador", "Sair do turno" |
| G10 | Aviso de item pronto | Notificar, sobre o Salão, que um item ficou pronto | Toast persistente com borda reforçada, sobreposto ao G01 |
| G11 | Conta aguardando | Mostrar que a conta foi pedida e a comanda está travada para novos itens | StatusPill "Conta pedida", resumo somente leitura, CTA desabilitado com motivo |

### 7.2 Caixa (desktop 1440×900, mouse/teclado/touch; mínimo 1024)

| ID | Tela | Propósito | Composição principal |
|---|---|---|---|
| C01 | Venda | Montar um pedido (mesa ou balcão) a partir do cardápio | RailNav, TopBar com busca, grade de ProductTile por categoria, painel de pedido com Stepper e total, CTA "Cobrar" |
| C02 | Mesas | Visão geral de todas as mesas, versão larga da grade do Garçom | Chips de filtro com contagem, grade de cards de Mesa (6 colunas) |
| C03 | Pedidos | Listar e filtrar todos os pedidos do período | Chips de status, tabela com busca por número/mesa |
| C04 | Receber | Fila de contas que precisam ser fechadas e recebidas | Banner de "conta pedida", cards de destaque para contas urgentes, lista de recebidos no dia |
| C05 | Detalhe da comanda | Ver e agir sobre uma comanda específica sem sair da lista | Drawer com itens, StatusPill de ficha por item, totais, ações (cancelar, adicionar itens, fechar conta) |
| C06 | Fechar conta | Revisar itens, decidir gorjeta/divisão/cliente e escolher forma de pagamento | Lista de itens, switches de gorjeta e divisão, seleção de forma de pagamento (radio), CTA xxl |
| C07 | Pagamento (dinheiro) | Registrar valores recebidos em dinheiro até fechar o saldo | ProgressBar com "falta pagar", campo de dinheiro com teclado numérico próprio, chips de valores sugeridos, cálculo de troco |
| C10 | Pagamento (Pix) | Mostrar o QR e aguardar a confirmação do pagamento | QR, StatusPill "Aguardando pagamento" com cronômetro, botão de copiar código |
| C11 | Dividir a conta | Dividir o total entre pessoas ou por item e receber de cada uma | SegmentedControl por pessoa/por item, contador de pessoas, lista de parcelas com status individual |
| C12 | Venda concluída | Confirmar que o pagamento foi recebido e oferecer próxima ação | Ícone de sucesso grande, total, ações "Nova venda"/"Imprimir", recibo (`.paper`) ao lado |
| C13 | Cancelar comanda | Confirmar o cancelamento de uma comanda com itens já enviados | ConfirmDialog com aviso de itens em preparo, seleção de motivo (radio) |
| C14 | Cliente e fidelidade | Vincular um cliente cadastrado à venda em andamento | Drawer com busca de cliente, card de nível de fidelidade com ProgressBar, cadastro rápido |
| C15 | Observação e alergia | Mesma função do G04, adaptada ao layout de modal do desktop | Modal com textarea, chips de sugestão, switch de alergia |
| C16 | Ajustes do Caixa | Preferências do turno e do terminal | Card de operador, tema, gorjeta sugerida, aviso sonoro, placeholder de impressora |
| C17 | Atalhos | Referência dos atalhos de teclado disponíveis no módulo | Modal com lista de `kbd` por categoria (navegação, venda) |

### 7.3 KDS (TV/monitor 1920×1080, tema escuro, pouco ou nenhum toque)

| ID | Tela | Propósito | Composição principal |
|---|---|---|---|
| K01 | Painel de cozinha e bar | Visão principal de todos os tickets ativos | Cabeçalho com SegmentedControl de estação e relógio, grade de tickets (`.tk`) com faixa de SLA |
| K02 | Tickets e SLA | Referência visual das três faixas de tempo e da anatomia de um ticket | 3 tickets lado a lado (dentro do prazo, atenção, atrasado), legenda de cada faixa |
| K03 | Ajustes do KDS | Configurar estação visível, tema e limites de tempo do SLA | Drawer com SegmentedControl de estação/tema, switch de som, campos de limite de SLA |
| K04 | Estados do KDS | Referência de fila vazia, sem conexão e carregando | EmptyState, banner de erro/sucesso, skeleton em escala de ticket |

### 7.4 Gestão e BI (desktop 1440×900)

| ID | Tela | Propósito | Composição principal |
|---|---|---|---|
| M01 | Visão geral | Resumo do dia para decisão rápida do gerente | SegmentedControl de período, 4 KPIs, gráfico de barras por hora, HBarList de mais vendidos |
| M02 | Cardápio | Listar e gerenciar os produtos à venda | Chips de categoria com contagem, tabela com switch "no cardápio" por linha |
| M03 | Produto | Criar/editar um produto do cardápio | Formulário em coluna (nome, descrição, categoria, estação, preço, código), painel lateral de visual e disponibilidade |
| M05 | Estoque | Acompanhar níveis de insumos e identificar faltas | Banner de itens abaixo do mínimo, tabela com barra de nível e StatusPill |
| M06 | Repor estoque | Registrar uma entrada de insumo | Modal com Stepper de quantidade, campo de observação, cálculo do novo saldo |
| M07 | Vendas · Comandas | Listar todas as comandas do período com detalhe de pagamento | KPIs de resumo, tabela completa com forma de pagamento e status |
| M09 | Faturamento | Evolução do faturamento e sua composição por forma de pagamento | KPIs, gráfico de barras por dia, HBarList por forma de pagamento |
| M10 | Curva ABC | Classificar produtos por participação no faturamento | Cards de resumo por classe (A/B/C), tabela ordenada com participação acumulada |
| M11 | Desempenho de garçons | Comparar resultado de cada garçom no período | Cards de destaque por garçom (medalha de posição), tabela com ticket médio e tempo de mesa |
| M12 | Equipe | Gerenciar os usuários do sistema | Chips de filtro por perfil, tabela com switch de usuário ativo |
| M13 | Usuário | Criar/editar um usuário e seu perfil de acesso | Drawer com campo de nome, seleção de perfil (radio com descrição), PIN, switch ativo |
| M14 | Fiscal | Mostrar os dados fiscais do estabelecimento e o que está fora da v1 | Banner explicando a ausência de NFC-e, campos somente leitura, ações desabilitadas com motivo |
| M15 | Exportar dados | Gerar um arquivo de dados de um período | Modal com seleção do conjunto de dados (radio), intervalo de datas, formato (CSV/XLSX) |

**Observação sobre numeração:** os IDs M04 e M08 não correspondem a telas publicadas; não foram atribuídos neste ciclo porque o documento de origem `telas/40-gestao.md` com a especificação completa de M01–M15 ainda não foi fornecido ao design. As 14 telas acima foram inferidas do mapa de telas (`02-mapa-de-telas-e-fluxos.md`), do catálogo de componentes (`04-componentes.md`) e da §7.4 anterior deste documento — revise quando a spec completa chegar.

## 8. Fluxos ponta a ponta

Sequências reais de telas, para já nascerem coerentes com a navegação.

### 8.1 Garçom — atender uma mesa
`G01 Salão` → toca mesa livre → `G02 Abrir mesa` (pessoas, nome opcional) → `G03 Comanda` (monta o pedido, pode abrir `G04 Observação` por item) → "Enviar ao preparo" → `G05 Itens enviados` (acompanha status; recebe `G10 Aviso de item pronto` quando algo fica pronto) → cliente pede a conta → `G06 Pedir a conta` → confirma → `G11 Conta aguardando` (travada, só o caixa resolve) até o caixa fechar o pagamento.

### 8.2 Caixa — receber uma conta
`C04 Receber` (ou `C02 Mesas`/`C03 Pedidos`) → abre a comanda → `C05 Detalhe da comanda` → "Fechar conta" → `C06 Fechar conta` (gorjeta, divisão opcional em `C11`, cliente opcional em `C14`) → escolhe forma de pagamento → `C07 Pagamento (dinheiro)` ou `C10 Pagamento (Pix)` → saldo chega a zero → `C12 Venda concluída`.

### 8.3 Caixa — cancelar uma comanda
A partir de `C05 Detalhe da comanda` ou de `C02/C03`: "Cancelar" → `C13 Cancelar comanda` (motivo obrigatório, aviso se há itens já em preparo) → confirma → comanda sai da lista ativa.

### 8.4 Cozinha/bar — ciclo de um ticket
Pedido enviado do Garçom ou Caixa aparece em `K01 Painel` na coluna de novos → equipe toca "Iniciar preparo" → ticket move para em preparo (cor de SLA conforme tempo, ver `K02`) → "Marcar como pronto" → coluna de prontos, Garçom recebe `G10` → equipe ou garçom confirma entrega → ticket sai do painel.

### 8.5 Gestão — investigar uma queda de estoque
`M01 Visão geral` (alerta "precisa de atenção") → `M05 Estoque` (item abaixo do mínimo) → `M06 Repor estoque` → confirma → volta para `M05` com saldo atualizado.

### 8.6 Quando confirmar em vez de desfazer
Pedem `ConfirmDialog` (não há como desfazer com um toque, ou o efeito é alto): cancelar comanda (`C13`), remover pagamento já lançado, cancelar cobrança Pix, sair do pagamento com valores lançados, inativar produto ou usuário, descartar alterações de formulário, pedir a conta (`G06`), limpar um rascunho de pedido. Preferem **Desfazer** (janela curta): remover item do pedido, avançar/recuar uma ficha do KDS.

## 9. Estados obrigatórios (todas as telas)

| Estado | Regra visual |
|---|---|
| Carregando | skeleton com **a mesma quantidade e dimensões** do conteúdo final |
| Vazio (nada ainda) | ícone linear, título curto, ação seguinte ("Abra uma mesa para começar") |
| Vazio (filtro/busca) | "Nada para «termo»" + ação de limpar |
| Erro | ErrorState com ação "Tentar de novo" |
| Sucesso | toast discreto de poucos segundos; marcos importantes (pagamento) ganham tela própria |
| Sem conexão | banner persistente, ações de gravação desabilitadas com o motivo "Sem conexão". **Não há fila de vendas na v1** |
| Degradado | pill/banner "Reconectando"; o fluxo crítico nunca é bloqueado |
| Item esgotado | opacidade reduzida + pill "Esgotado", não clicável |
| Sem permissão | tela de erro X06 explicando o motivo, ou controle desabilitado com motivo |
| Recurso fora da v1 | botão desabilitado com "disponível em breve", nunca some sem explicação |
| Modo leitura | faixa explicando por que a tela está travada para edição |
| Rascunho pendente | aviso de que há itens não enviados ainda salvos localmente |

## 10. Acessibilidade e operação

- Contraste conforme §2.4. Foco sempre visível, anel reforçado (4 px) no KDS.
- Controles reais (`button`, `a`, `input` com `label`); ícone sem texto com `aria-label`; um título principal por tela; landmarks de cabeçalho/navegação/conteúdo; tabelas com legenda para leitor de tela.
- Modal, drawer e sheet: foco preso dentro, `Esc` fecha, foco volta ao gatilho que abriu.
- Valores que mudam sozinhos (total, "falta pagar") anunciados de forma discreta; erros anunciados de forma mais assertiva; só "sem conexão" interrompe. Cronômetros não anunciam a cada segundo, só a mudança de faixa de SLA.
- Preferência de movimento reduzido e de tema do sistema respeitadas. Zoom a 200% sem perder função; sem rolagem horizontal da página inteira.
- Nada depende de hover nem de gesto. Atalhos de teclado nunca são o único caminho para uma ação.

## 11. Conteúdo

- Frases curtas, verbo + objeto, voz ativa, sem jargão, *sentence case*. Um termo por conceito: **Mesa, Comanda, Pedido, Ticket (KDS)**. Pedido aparece como "Pedido 0482" (4 dígitos); local como "Mesa 6", "Balcão 0483".
- **Erros** dizem o que houve e como resolver, sem culpar o usuário. Não pedem desculpa nem mostram código técnico solto na tela.
- **Vazios** indicam a próxima ação. **Sucessos** repetem o verbo do botão que disparou a ação.
- **Degradação** explica o que continua funcionando enquanto algo está fora do ar.
- **Formatos:** CPF `000.000.000-00` (mascarado após vincular), telefone `(84) 99999-9999`, tempo "12 min", "1 h 12", cronômetro `18:05`.
- **Honestidade de escopo:** funções fora da v1 aparecem desabilitadas com motivo, nunca somem sem explicação nem fingem funcionar. O QR Pix é de demonstração.
- Textos de interface ocupam até 30% mais que em inglês: nada de largura fixa em rótulo.

## 12. `tokens.css` (copiar para `design-tokens/tokens.css`)

Hex só aqui; o resto do código usa `var(--…)`.

```css
:root {
  color-scheme: light;
  /* cor */
  --color-bg:#FBF7F1; --color-surface:#FFFFFF; --color-surface-raised:#FFFFFF; --color-surface-2:#F3ECE1;
  --color-border:#E5DACB; --color-border-strong:#8C7A68;
  --color-text:#2B2019; --color-text-2:#6A5849;
  --color-brand:#F2A81D; --color-brand-hover:#E39A0B; --color-brand-press:#C98400; --color-on-brand:#2B2019;
  --color-brand-soft:#FDF0D2; --color-brand-text:#8A5200; --color-brand-edge:#A86400;
  --color-nav:#3A2A21; --color-nav-active-bg:#523C2E; --color-nav-text:#F6EEE4; --color-nav-text-2:#C9B8A6;
  --color-success:#2F7D4F; --color-success-soft:#DDF0E4; --color-success-text:#1F6B3E;
  --color-danger:#C4391D; --color-danger-soft:#FBE3DC; --color-danger-text:#A52E15; --color-on-danger:#FFFFFF;
  --color-focus:#2B2019; --color-scrim:rgba(43,32,25,.5);
  --color-chart-bar:#F2A81D; --color-chart-bar-stroke:#8A5200;
  --color-tint-1:#FBE6B8; --color-tint-2:#E4EFD5; --color-tint-3:#F8D9CC; --color-tint-4:#EBDDCB;
  /* tipografia */
  --font-sans:"Plus Jakarta Sans", system-ui, sans-serif;
  --fs-kpi:30px; --fs-title:24px; --fs-section:18px; --fs-body:15px; --fs-caption:13px; --fs-micro:12px;
  --fs-kds-place:40px; --fs-kds-qty:32px; --fs-kds-item:30px; --fs-kds-note:22px;
  --fs-kds-allergy:28px; --fs-kds-button:26px; --fs-kds-timer:24px; --fs-kds-header:32px; --fs-kds-clock:32px;
  /* forma */
  --radius-xs:6px; --radius-control:14px; --radius-card:20px; --radius-card-lg:24px;
  --radius-btn-lg:18px; --radius-sheet:28px; --radius-pill:999px;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px; --space-8:32px; --space-12:48px;
  --shadow-1:0 1px 2px rgba(43,32,25,.06); --shadow-float:0 6px 16px rgba(43,32,25,.16);
  --target-min:44px; --focus-width:2px; --focus-offset:2px;
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --color-bg:#17120F; --color-surface:#221A15; --color-surface-raised:#2A2019; --color-surface-2:#2D231C;
  --color-border:#43342A; --color-border-strong:#8F7B69;
  --color-text:#F6EEE4; --color-text-2:#C2B1A0;
  --color-brand:#F5B335; --color-brand-hover:#F8BF52; --color-brand-press:#E0A024; --color-on-brand:#2B2019;
  --color-brand-soft:#3D2E14; --color-brand-text:#F5C766; --color-brand-edge:#F5B335;
  --color-nav:#0F0B09; --color-nav-active-bg:#2A201A; --color-nav-text:#F6EEE4; --color-nav-text-2:#BBAA98;
  --color-success:#5FC083; --color-success-soft:#1D3326; --color-success-text:#7FD39D;
  --color-danger:#F07A60; --color-danger-soft:#3D1E17; --color-danger-text:#FF9C85; --color-on-danger:#2B2019;
  --color-focus:#F6EEE4; --color-scrim:rgba(0,0,0,.62);
  --color-chart-bar:#F5B335; --color-chart-bar-stroke:#F5C766;
  --color-tint-1:#4A3815; --color-tint-2:#27382A; --color-tint-3:#4A2A20; --color-tint-4:#3A2E25;
  --shadow-1:none; --shadow-float:none;
}
:root[data-surface="kds"] { --focus-width:4px; --focus-offset:4px; --target-min:56px; }
body { font-family:var(--font-sans); background:var(--color-bg); color:var(--color-text); font-variant-numeric:tabular-nums; }
:focus-visible { outline:var(--focus-width) solid var(--color-focus); outline-offset:var(--focus-offset); }
@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation:none !important; transition:none !important; } }
```

## 13. Ícones e imagens

- **Ícones:** traço fino uniforme, importados individualmente. Tamanhos: 14–16 (pill), 20 (botão), 24 (navegação), 28–32 (tile de pagamento/categoria), 40–64 (estados vazios, venda concluída). Cor herdada do texto do contexto; nunca decorativos coloridos.
- **Navegação:** Venda `carrinho` · Mesas `grade` · Pedidos `prancheta` · Receber `carteira` · Ajustes `engrenagem` · Gestão: Visão geral `painel`, Cardápio `livro`, Estoque `caixa`, Vendas `barras`, Equipe `pessoas`, Fiscal `documento`.
- **Ações e estados:** observação `balão de texto` · alergia `escudo de alerta` · remover `lixeira` · erro `alerta circular` · atenção `triângulo de alerta` · busca `lupa` · tema `sol`/`lua` · pagamento: Dinheiro `nota`, Cartão `cartão`, Pix `QR`.
- **Imagem de produto:** não existe na v1; o tile tintado é a identidade do produto (§2.5, `ProductTile`).
- **Logo:** quadrado "V" em mostarda com `on-brand`.

## 14. Responsividade, densidade e impressão

| Faixa | Largura | Comportamento |
|---|---|---|
| Compacta | < 600 | Garçom; login em lista de cards; drawer vira sheet |
| Média | 600–1023 | Garçom em tablet (mais colunas na grade); Caixa abaixo de 1024 com rail estreito e painel de pedido como drawer |
| Grande | 1024–1279 | Caixa com grade de produtos reduzida; tabelas ainda em modo tabela |
| Expandida | ≥ 1280 | Caixa e Gestão em layout completo (grade cheia, drawers largos) |

- Mobile first no Garçom; desktop first no Caixa e na Gestão (com fallback usável). KDS é 16:9, mas nada se perde em telas menores.
- Tabelas com menos de 1024 px viram lista de cards; formulários em coluna única; teclado virtual nunca cobre o botão primário de um sheet.
- **Impressão:** só o recibo, preto sobre branco, sem sombra, fonte tabular; todo o resto fica oculto na impressão.
- **PWA:** cor de tema mostarda, fundo creme; Garçom prefere retrato.

## 15. Escopo da v1

**Fora da v1** (a interface mostra desabilitado com motivo ou omite): fila offline de vendas e sincronização posterior, NFC-e e contingência fiscal, desconto, transferência de mesa, impressora térmica real, leitor de código de barras, resgate de cashback, estações do KDS além de Cozinha e Bar, foto de produto, abertura e fechamento formal de turno de caixa.

## 16. Decisões registradas neste documento

- `brand-edge`: a mostarda pura no tema claro dá só 2:1 como linha (§2.4); por isso bordas de seleção e o marcador "Minha" usam este token à parte. Botão e chip continuam mostarda cheia.
- A borda de 2 px que marca "Conta pedida" no card de Mesa usa uma classe própria (`pay`/equivalente), nunca reaproveita uma classe utilitária de texto pequeno — um erro desse tipo quebra visualmente o card inteiro (fonte, cor e espaçamento somem juntos).
- Qualquer reset de estilo de base (ex.: zerar aparência padrão de `button`) deve ter prioridade **menor** que as classes de componente do §6, para que um `<button>` usado como Mesa, Card ou Chip sempre receba o visual do componente, não o reset puro.
- Status "Aguardando pagamento" e "Conta pedida" usam a mesma cor (`danger`), porque representam a mesma situação vista da comanda e da mesa.
- Toast do Garçom aparece no topo do celular, para não cobrir o rodapé fixo com o CTA principal.

**A validar com usuários reais:** legibilidade do KDS a 3 m com luz de cozinha; tamanho dos alvos do Garçom com luva ou mão molhada; se "Aguardando pagamento" em vermelho gera alarme demais no Caixa em horário de pico; conteúdo completo das telas M04 e M08 quando a spec `telas/40-gestao.md` for fornecida.
- Logo: selo mostarda (`brand`) de cantos arredondados com um "V" em traço único (`#2B2019`) e uma "moeda" no canto superior direito (alusão ao ponto de venda). Componente `Logo`/`LogoMark` em `frontend/src/components/ui/Logo.tsx`; favicon em `frontend/public/favicon.svg`. O nome é escrito "Vapt" + "PDV" (em mostarda). O selo mantém as mesmas cores nos dois temas.
- Tema claro/escuro: alternado pelo `ThemeToggle` (Login, Salão do Garçom e topo do Caixa), persistido em `localStorage` (`vapt_pdv_tema`) e aplicado pela classe `dark` no `<html>`. Os tokens do §12 viram variáveis CSS em canais RGB (`--c-*`, em `frontend/src/index.css`) e o Tailwind os consome com suporte a opacidade (`bg-brand/20`). A sidebar `nav` continua escura nos dois temas.
- Cancelamento de comanda exige dupla validação: modal em que o operador digita "cancelar comanda" para liberar o botão (Garçom e Caixa).
- Indicadores técnicos ("API conectada", "Estação", versão do sistema, resolução do terminal) não aparecem nas telas operacionais; falha de comunicação é tratada por estados de erro/toast no ponto da ação.
- O painel da comanda no Caixa (Venda) é recolhível para um trilho de 72 px (mesa, itens e total).

