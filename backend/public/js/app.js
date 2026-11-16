(function () {
  'use strict';

  const state = {
    mode: 'garcom',
    usuarios: [],
    garcomAtivoId: null,
    produtos: [],
    comandas: [],
    mesaSelecionada: null,
    comandaAtiva: null,
    novoPedidoItens: {},
    filtroMesaStatus: 'todas',
    filtroCategoriaGarcom: 'todas',
    filtroCategoriaCaixa: 'todas',
    taxaServicoAtiva: true,
    formaPagamentoSelecionada: 'pix',
  };

  const dom = {
    apiStatus: document.getElementById('api-status'),
    btnModeGarcom: document.getElementById('btn-mode-garcom'),
    btnModeCaixa: document.getElementById('btn-mode-caixa'),
    viewGarcom: document.getElementById('view-garcom'),
    viewCaixa: document.getElementById('view-caixa'),
    selectGarcomAtivo: document.getElementById('select-garcom-ativo'),
    btnAbrirCadastros: document.getElementById('btn-abrir-cadastros'),

    garcomSalaoSubview: document.getElementById('garcom-salao-subview'),
    garcomComandaSubview: document.getElementById('garcom-comanda-subview'),
    gridMesas: document.getElementById('grid-mesas'),
    filtroMesasChips: document.getElementById('filtro-mesas-chips'),
    fabAbrirMesa: document.getElementById('fab-abrir-mesa'),

    btnVoltarSalao: document.getElementById('btn-voltar-salao'),
    detalheComandaMesa: document.getElementById('detalhe-comanda-mesa'),
    detalheComandaMeta: document.getElementById('detalhe-comanda-meta'),
    btnPedirContaTopo: document.getElementById('btn-pedir-conta-topo'),
    bannerItensConfirmados: document.getElementById('banner-itens-confirmados'),
    bannerItensQtd: document.getElementById('banner-itens-qtd'),
    bannerItensSubtotal: document.getElementById('banner-itens-subtotal'),
    btnVerItensComanda: document.getElementById('btn-ver-itens-comanda'),
    categoriasCardapioGarcom: document.getElementById('categorias-cardapio-garcom'),
    listaCardapioGarcom: document.getElementById('lista-cardapio-garcom'),
    badgeNovosItens: document.getElementById('badge-novos-itens'),
    valorNovosItens: document.getElementById('valor-novos-itens'),
    btnEnviarCozinha: document.getElementById('btn-enviar-cozinha'),

    inputBuscaCaixa: document.getElementById('input-busca-caixa'),
    tabsCaixaNav: document.getElementById('tabs-caixa-nav'),
    caixaSubCardapio: document.getElementById('caixa-sub-cardapio'),
    caixaSubMesas: document.getElementById('caixa-sub-mesas'),
    categoriasCaixa: document.getElementById('categorias-caixa'),
    gridProdutosCaixa: document.getElementById('grid-produtos-caixa'),
    gridMesasCaixa: document.getElementById('grid-mesas-caixa'),
    caixaComandaTag: document.getElementById('caixa-comanda-tag'),
    caixaComandaTitulo: document.getElementById('caixa-comanda-titulo'),
    caixaComandaItens: document.getElementById('caixa-comanda-itens'),
    btnCaixaTrocarMesa: document.getElementById('btn-caixa-trocar-mesa'),
    caixaSubtotal: document.getElementById('caixa-subtotal'),
    caixaValorTaxa: document.getElementById('caixa-valor-taxa'),
    switchTaxaServico: document.getElementById('switch-taxa-servico'),
    caixaTotal: document.getElementById('caixa-total'),
    btnCancelarComanda: document.getElementById('btn-cancelar-comanda'),
    btnAbrirPagamento: document.getElementById('btn-abrir-pagamento'),

    modalAbrirMesa: document.getElementById('modal-abrir-mesa'),
    formAbrirComanda: document.getElementById('form-abrir-comanda'),
    inputMesaNumero: document.getElementById('input-mesa-numero'),
    selectMesaGarcom: document.getElementById('select-mesa-garcom'),
    inputMesaCliente: document.getElementById('input-mesa-cliente'),

    modalPagamento: document.getElementById('modal-pagamento'),
    paymentItemsList: document.getElementById('payment-items-list'),
    paySubtotal: document.getElementById('pay-subtotal'),
    payTaxa: document.getElementById('pay-taxa'),
    payTotal: document.getElementById('pay-total'),
    paymentTabs: document.getElementById('payment-tabs'),
    methodPixBox: document.getElementById('method-pix-box'),
    methodDinheiroBox: document.getElementById('method-dinheiro-box'),
    methodCartaoBox: document.getElementById('method-cartao-box'),
    inputDinheiroRecebido: document.getElementById('input-dinheiro-recebido'),
    valorTrocoCalculado: document.getElementById('valor-troco-calculado'),
    btnConcluirPagamento: document.getElementById('btn-concluir-pagamento'),

    modalCadastros: document.getElementById('modal-cadastros'),
    formCadProduto: document.getElementById('form-cad-produto'),
    formCadUsuario: document.getElementById('form-cad-usuario'),
    tabelaProdutosBody: document.querySelector('#tabela-produtos tbody'),
    tabelaUsuariosBody: document.querySelector('#tabela-usuarios tbody'),

    modalVerComanda: document.getElementById('modal-ver-comanda'),
    listaItensComandaModal: document.getElementById('lista-itens-comanda-modal'),
    toastContainer: document.getElementById('toast-container'),
  };

  async function apiRequest(endpoint, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
    };

    if (config.body && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(endpoint, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const mensagem = data?.erro?.mensagem || `Erro na requisição (${response.status})`;
        const codigo = data?.erro?.codigo || 'ERRO_DESCONHECIDO';
        const error = new Error(mensagem);
        error.codigo = codigo;
        error.detalhes = data?.erro?.detalhes || {};
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        showToast('Servidor offline ou sem conectividade.', 'error');
      }
      throw err;
    }
  }

  function showToast(mensagem, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.textContent = mensagem;

    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function formatMoney(valor) {
    if (valor === null || valor === undefined) return 'R$ 0,00';
    const numero = typeof valor === 'number' ? valor : parseFloat(valor);
    if (isNaN(numero)) return 'R$ 0,00';
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  async function init() {
    setupEventListeners();
    setupShortcuts();

    try {
      await verificarSaude();
      await carregarUsuarios();
      await carregarProdutos();
      await carregarComandas();

      setInterval(verificarSaude, 10000);
      setInterval(carregarComandas, 6000);
    } catch (e) {
      console.warn('Inicialização com dados parciais:', e);
    }
  }

  async function verificarSaude() {
    try {
      const saude = await apiRequest('/health');
      if (saude && saude.status === 'ok') {
        dom.apiStatus.querySelector('.status-dot').style.backgroundColor = 'var(--success)';
        dom.apiStatus.querySelector('.status-label').textContent = 'Online';
      }
    } catch {
      dom.apiStatus.querySelector('.status-dot').style.backgroundColor = 'var(--danger)';
      dom.apiStatus.querySelector('.status-label').textContent = 'Desconectado';
    }
  }

  async function carregarUsuarios() {
    try {
      const usuarios = await apiRequest('/usuarios?ativo=true');
      state.usuarios = Array.isArray(usuarios) ? usuarios : [];
      popularSelectsUsuarios();
      renderizarTabelaUsuarios();
    } catch (e) {
      console.error('Falha ao carregar usuários:', e);
    }
  }

  function popularSelectsUsuarios() {
    dom.selectGarcomAtivo.innerHTML = '';
    dom.selectMesaGarcom.innerHTML = '';

    const garcons = state.usuarios.filter((u) => u.perfil === 'garcom' && u.ativo);

    if (garcons.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Nenhum garçom cadastrado';
      dom.selectGarcomAtivo.appendChild(opt);
      dom.selectMesaGarcom.appendChild(opt.cloneNode(true));
      state.garcomAtivoId = null;
      return;
    }

    garcons.forEach((g) => {
      const opt1 = document.createElement('option');
      opt1.value = g.id;
      opt1.textContent = `${g.nome} (Garçom)`;
      dom.selectGarcomAtivo.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = g.id;
      opt2.textContent = g.nome;
      dom.selectMesaGarcom.appendChild(opt2);
    });

    if (!state.garcomAtivoId && garcons[0]) {
      state.garcomAtivoId = garcons[0].id;
    }
    dom.selectGarcomAtivo.value = state.garcomAtivoId;
  }

  async function carregarProdutos() {
    try {
      const produtos = await apiRequest('/produtos');
      state.produtos = Array.isArray(produtos) ? produtos : [];
      renderizarCardapioGarcom();
      renderizarProdutosCaixa();
      renderizarTabelaProdutos();
    } catch (e) {
      console.error('Falha ao carregar produtos:', e);
    }
  }

  async function carregarComandas() {
    try {
      const comandas = await apiRequest('/comandas');
      state.comandas = Array.isArray(comandas) ? comandas : [];
      renderizarMesasGarcom();
      renderizarMesasCaixa();

      if (state.comandaAtiva) {
        const atual = state.comandas.find((c) => c.id === state.comandaAtiva.id);
        if (atual) {
          state.comandaAtiva = atual;
          renderizarPainelComandaCaixa();
          atualizarBannerComandaGarcom();
        }
      }
    } catch (e) {
      console.error('Falha ao sincronizar comandas:', e);
    }
  }

  function renderizarMesasGarcom() {
    dom.gridMesas.innerHTML = '';

    const totalMesas = 12;
    const cards = [];

    for (let i = 1; i <= totalMesas; i++) {
      const numeroMesa = i < 10 ? `0${i}` : `${i}`;
      const comanda = state.comandas.find(
        (c) => (c.status === 'aberta' || c.status === 'fechada') && c.mesa.replace(/\D/g, '') === `${i}`,
      );

      const card = document.createElement('div');
      card.className = 'mesa-card';

      if (!comanda) {
        card.classList.add('livre');
        card.innerHTML = `
          <div class="mesa-card-top">
            <span class="mesa-num">Mesa ${numeroMesa}</span>
            <span class="mesa-badge livre">Livre</span>
          </div>
          <div class="mesa-card-body">
            <span class="mesa-cliente">Toque para abrir</span>
          </div>
        `;
        card.addEventListener('click', () => abrirModalMesa(numeroMesa));
      } else {
        const isConta = comanda.status === 'fechada';
        card.classList.add(isConta ? 'conta-pedida' : 'ocupada');
        card.innerHTML = `
          <div class="mesa-card-top">
            <span class="mesa-num">Mesa ${numeroMesa}</span>
            <span class="mesa-badge ${isConta ? 'conta-pedida' : 'ocupada'}">
              ${isConta ? 'Conta pedida' : 'Ocupada'}
            </span>
          </div>
          <div class="mesa-card-body">
            <span class="mesa-cliente">${comanda.cliente || 'Sem identificação'}</span>
            <span class="mesa-price">${formatMoney(comanda.subtotal || comanda.total || '0.00')}</span>
            <span class="mesa-time">${comanda.itens?.length || 0} itens lançados</span>
          </div>
        `;
        card.addEventListener('click', () => selecionarComandaGarcom(comanda));
      }

      cards.push({ card, status: comanda ? (comanda.status === 'fechada' ? 'conta' : 'ocupadas') : 'livres' });
    }

    cards.forEach(({ card, status }) => {
      if (state.filtroMesaStatus === 'todas' || state.filtroMesaStatus === status) {
        dom.gridMesas.appendChild(card);
      }
    });

    if (dom.gridMesas.children.length === 0) {
      dom.gridMesas.innerHTML = `<div class="empty-state">Nenhuma mesa encontrada com o filtro selecionado.</div>`;
    }
  }

  function selecionarComandaGarcom(comanda) {
    state.comandaAtiva = comanda;
    state.novoPedidoItens = {};

    dom.detalheComandaMesa.textContent = `Mesa ${comanda.mesa}`;
    dom.detalheComandaMeta.textContent = `Comanda #${comanda.id} · Garçom ID: ${comanda.garcom_id}`;

    atualizarBannerComandaGarcom();
    atualizarResumoNovoPedidoGarcom();
    renderizarCardapioGarcom();

    dom.garcomSalaoSubview.classList.remove('active');
    dom.garcomComandaSubview.classList.add('active');
  }

  function atualizarBannerComandaGarcom() {
    if (!state.comandaAtiva) return;
    const qtd = state.comandaAtiva.itens?.length || 0;
    const total = state.comandaAtiva.subtotal || state.comandaAtiva.total || '0.00';

    dom.bannerItensQtd.textContent = `${qtd} itens confirmados na comanda`;
    dom.bannerItensSubtotal.textContent = `Subtotal atual: ${formatMoney(total)}`;
  }

  function renderizarCardapioGarcom() {
    dom.listaCardapioGarcom.innerHTML = '';

    const produtosFiltrados = state.produtos.filter((p) => {
      if (!p.ativo) return false;
      if (state.filtroCategoriaGarcom === 'todas') return true;
      return p.categoria.toLowerCase() === state.filtroCategoriaGarcom.toLowerCase();
    });

    if (produtosFiltrados.length === 0) {
      dom.listaCardapioGarcom.innerHTML = `<div class="empty-state">Nenhum produto ativo nesta categoria.</div>`;
      return;
    }

    produtosFiltrados.forEach((prod) => {
      const row = document.createElement('div');
      row.className = 'product-row';
      const esgotado = prod.estoque <= 0;
      if (esgotado) row.classList.add('esgotado');

      const qtdAtual = state.novoPedidoItens[prod.id] || 0;

      row.innerHTML = `
        <div class="product-info">
          <div class="product-title">${prod.nome}</div>
          <div class="product-meta">
            <span class="product-price">${formatMoney(prod.preco)}</span>
            <span class="product-stock">Estoque: ${prod.estoque}</span>
            ${esgotado ? '<span class="badge-esgotado">Esgotado</span>' : ''}
          </div>
        </div>
        <div class="stepper">
          <button type="button" class="btn-step btn-minus" data-id="${prod.id}" ${qtdAtual === 0 || esgotado ? 'disabled' : ''}>-</button>
          <span class="step-value" id="step-garcom-${prod.id}">${qtdAtual}</span>
          <button type="button" class="btn-step btn-plus" data-id="${prod.id}" ${esgotado || qtdAtual >= prod.estoque ? 'disabled' : ''}>+</button>
        </div>
      `;

      dom.listaCardapioGarcom.appendChild(row);
    });

    dom.listaCardapioGarcom.querySelectorAll('.btn-plus').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        ajustarQtdNovoPedido(id, 1);
      });
    });

    dom.listaCardapioGarcom.querySelectorAll('.btn-minus').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        ajustarQtdNovoPedido(id, -1);
      });
    });
  }

  function ajustarQtdNovoPedido(produtoId, delta) {
    const prod = state.produtos.find((p) => p.id === produtoId);
    if (!prod) return;

    const atual = state.novoPedidoItens[produtoId] || 0;
    const novo = Math.max(0, atual + delta);

    if (novo > prod.estoque) {
      showToast(`Estoque insuficiente! Restam apenas ${prod.estoque} unidades.`, 'error');
      return;
    }

    if (novo === 0) {
      delete state.novoPedidoItens[produtoId];
    } else {
      state.novoPedidoItens[produtoId] = novo;
    }

    const span = document.getElementById(`step-garcom-${produtoId}`);
    if (span) span.textContent = novo;

    renderizarCardapioGarcom();
    atualizarResumoNovoPedidoGarcom();
  }

  function atualizarResumoNovoPedidoGarcom() {
    let totalItens = 0;
    let valorTotal = 0;

    Object.entries(state.novoPedidoItens).forEach(([idStr, qtd]) => {
      const prod = state.produtos.find((p) => p.id === parseInt(idStr, 10));
      if (prod && qtd > 0) {
        totalItens += qtd;
        valorTotal += parseFloat(prod.preco) * qtd;
      }
    });

    dom.badgeNovosItens.textContent = `${totalItens} novos itens selecionados`;
    dom.valorNovosItens.textContent = formatMoney(valorTotal);
    dom.btnEnviarCozinha.disabled = totalItens === 0;
  }

  async function enviarPedidoParaCozinha() {
    if (!state.comandaAtiva) return;

    const itensParaEnviar = Object.entries(state.novoPedidoItens).filter(([_, qtd]) => qtd > 0);
    if (itensParaEnviar.length === 0) return;

    dom.btnEnviarCozinha.disabled = true;
    dom.btnEnviarCozinha.textContent = 'Enviando...';

    try {
      for (const [idStr, qtd] of itensParaEnviar) {
        await apiRequest(`/comandas/${state.comandaAtiva.id}/itens`, {
          method: 'POST',
          body: {
            produto_id: parseInt(idStr, 10),
            quantidade: qtd,
          },
        });
      }

      showToast('Pedido enviado com sucesso para a cozinha!', 'success');
      state.novoPedidoItens = {};
      atualizarResumoNovoPedidoGarcom();

      const comandaAtualizada = await apiRequest(`/comandas/${state.comandaAtiva.id}`);
      state.comandaAtiva = comandaAtualizada;

      await carregarProdutos();
      await carregarComandas();
      atualizarBannerComandaGarcom();
    } catch (err) {
      showToast(err.message || 'Erro ao lançar itens na comanda.', 'error');
    } finally {
      dom.btnEnviarCozinha.disabled = false;
      dom.btnEnviarCozinha.textContent = 'Enviar para a cozinha';
    }
  }

  async function pedirContaMesaGarcom() {
    if (!state.comandaAtiva) return;

    try {
      await apiRequest(`/comandas/${state.comandaAtiva.id}/fechar`, {
        method: 'POST',
        body: { aplicar_taxa_servico: true },
      });

      showToast(`Conta da Mesa ${state.comandaAtiva.mesa} solicitada com sucesso!`, 'success');
      await carregarComandas();
      dom.garcomComandaSubview.classList.remove('active');
      dom.garcomSalaoSubview.classList.add('active');
    } catch (err) {
      showToast(err.message || 'Erro ao pedir a conta da mesa.', 'error');
    }
  }

  function renderizarProdutosCaixa() {
    dom.gridProdutosCaixa.innerHTML = '';
    const busca = dom.inputBuscaCaixa.value.trim().toLowerCase();

    const filtrados = state.produtos.filter((p) => {
      if (!p.ativo) return false;
      const matchCat =
        state.filtroCategoriaCaixa === 'todas' ||
        p.categoria.toLowerCase() === state.filtroCategoriaCaixa.toLowerCase();
      const matchBusca = !busca || p.nome.toLowerCase().includes(busca);
      return matchCat && matchBusca;
    });

    if (filtrados.length === 0) {
      dom.gridProdutosCaixa.innerHTML = `<div class="empty-state">Nenhum produto encontrado no catálogo.</div>`;
      return;
    }

    filtrados.forEach((prod) => {
      const card = document.createElement('div');
      card.className = 'caixa-product-card';
      const esgotado = prod.estoque <= 0;
      if (esgotado) card.classList.add('esgotado');

      card.innerHTML = `
        <div class="caixa-card-title">${prod.nome}</div>
        <div class="caixa-card-bottom">
          <span class="caixa-card-price">${formatMoney(prod.preco)}</span>
          <span class="caixa-card-stock">${esgotado ? 'Esgotado' : `Estoque: ${prod.estoque}`}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        if (esgotado) {
          showToast('Produto esgotado no estoque!', 'error');
          return;
        }
        adicionarItemDiretoCaixa(prod);
      });

      dom.gridProdutosCaixa.appendChild(card);
    });
  }

  async function adicionarItemDiretoCaixa(produto) {
    if (!state.comandaAtiva) {
      showToast('Selecione ou abra uma mesa antes de lançar produtos!', 'error');
      return;
    }

    if (state.comandaAtiva.status !== 'aberta') {
      showToast('Esta comanda já foi fechada. Reabra-a ou abra uma nova mesa.', 'error');
      return;
    }

    try {
      await apiRequest(`/comandas/${state.comandaAtiva.id}/itens`, {
        method: 'POST',
        body: {
          produto_id: produto.id,
          quantidade: 1,
        },
      });

      showToast(`+1 ${produto.nome} lançado na Mesa ${state.comandaAtiva.mesa}`, 'success');
      const atualizada = await apiRequest(`/comandas/${state.comandaAtiva.id}`);
      state.comandaAtiva = atualizada;
      await carregarProdutos();
      await carregarComandas();
      renderizarPainelComandaCaixa();
    } catch (err) {
      showToast(err.message || 'Erro ao lançar item.', 'error');
    }
  }

  function renderizarMesasCaixa() {
    dom.gridMesasCaixa.innerHTML = '';
    const abertas = state.comandas.filter((c) => c.status === 'aberta' || c.status === 'fechada');

    if (abertas.length === 0) {
      dom.gridMesasCaixa.innerHTML = `<div class="empty-state">Nenhuma mesa aberta no salão no momento.</div>`;
      return;
    }

    abertas.forEach((comanda) => {
      const card = document.createElement('div');
      card.className = `mesa-card ${comanda.status === 'fechada' ? 'conta-pedida' : 'ocupada'}`;
      card.innerHTML = `
        <div class="mesa-card-top">
          <span class="mesa-num">Mesa ${comanda.mesa}</span>
          <span class="mesa-badge ${comanda.status === 'fechada' ? 'conta-pedida' : 'ocupada'}">
            ${comanda.status === 'fechada' ? 'Conta pedida' : 'Ocupada'}
          </span>
        </div>
        <div class="mesa-card-body">
          <span class="mesa-cliente">${comanda.cliente || 'Sem identificação'}</span>
          <span class="mesa-price">${formatMoney(comanda.subtotal || comanda.total || '0.00')}</span>
          <span class="mesa-time">${comanda.itens?.length || 0} itens</span>
        </div>
      `;

      card.addEventListener('click', () => {
        state.comandaAtiva = comanda;
        renderizarPainelComandaCaixa();
        dom.tabsCaixaNav.querySelector('[data-view="cardapio"]').click();
      });

      dom.gridMesasCaixa.appendChild(card);
    });
  }

  function renderizarPainelComandaCaixa() {
    const c = state.comandaAtiva;
    if (!c) {
      dom.caixaComandaTag.textContent = 'Nenhuma comanda';
      dom.caixaComandaTitulo.textContent = 'Selecione uma mesa';
      dom.caixaComandaItens.innerHTML = `
        <div class="empty-state">Selecione uma mesa aberta no salão para conferir itens ou cobrar.</div>
      `;
      dom.caixaSubtotal.textContent = 'R$ 0,00';
      dom.caixaValorTaxa.textContent = 'R$ 0,00';
      dom.caixaTotal.textContent = 'R$ 0,00';
      dom.btnCancelarComanda.disabled = true;
      dom.btnAbrirPagamento.disabled = true;
      return;
    }

    dom.caixaComandaTag.textContent = c.status === 'fechada' ? 'CONTA PEDIDA' : 'COMANDA ABERTA';
    dom.caixaComandaTitulo.textContent = `Mesa ${c.mesa} ${c.cliente ? `· ${c.cliente}` : ''}`;

    dom.caixaComandaItens.innerHTML = '';
    const itens = c.itens || [];

    if (itens.length === 0) {
      dom.caixaComandaItens.innerHTML = `<div class="empty-state">Comanda sem itens lançados.</div>`;
    } else {
      itens.forEach((it) => {
        const row = document.createElement('div');
        row.className = 'comanda-item-row';
        const subtotalLinha = parseFloat(it.preco_copiado) * it.quantidade;

        row.innerHTML = `
          <div class="item-left">
            <span class="item-name">${it.quantidade}x ${it.nome_copiado}</span>
            <span class="item-unit-price">${formatMoney(it.preco_copiado)} un</span>
          </div>
          <div class="item-right">
            <span class="item-total">${formatMoney(subtotalLinha)}</span>
            ${
              c.status === 'aberta'
                ? `<button type="button" class="btn-remove-item" data-id="${it.id}" title="Remover item">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>`
                : ''
            }
          </div>
        `;

        if (c.status === 'aberta') {
          row.querySelector('.btn-remove-item').addEventListener('click', (e) => {
            e.stopPropagation();
            removerItemComandaCaixa(it.id);
          });
        }

        dom.caixaComandaItens.appendChild(row);
      });
    }

    const subtotal = parseFloat(c.subtotal || calcularSubtotalItens(c.itens) || '0.00');
    const taxa = state.taxaServicoAtiva ? subtotal * 0.1 : 0.0;
    const total = subtotal + taxa;

    dom.caixaSubtotal.textContent = formatMoney(subtotal);
    dom.caixaValorTaxa.textContent = formatMoney(taxa);
    dom.caixaTotal.textContent = formatMoney(total);

    dom.btnCancelarComanda.disabled = c.status !== 'aberta';
    dom.btnAbrirPagamento.disabled = itens.length === 0;
  }

  function calcularSubtotalItens(itens) {
    if (!Array.isArray(itens)) return 0;
    return itens.reduce((acc, it) => acc + parseFloat(it.preco_copiado) * it.quantidade, 0);
  }

  async function removerItemComandaCaixa(itemId) {
    if (!state.comandaAtiva) return;
    try {
      await apiRequest(`/comandas/${state.comandaAtiva.id}/itens/${itemId}`, {
        method: 'DELETE',
      });
      showToast('Item removido da comanda.', 'success');
      const atualizada = await apiRequest(`/comandas/${state.comandaAtiva.id}`);
      state.comandaAtiva = atualizada;
      await carregarProdutos();
      await carregarComandas();
      renderizarPainelComandaCaixa();
    } catch (err) {
      showToast(err.message || 'Erro ao remover item.', 'error');
    }
  }

  async function alternarTaxaServico() {
    state.taxaServicoAtiva = dom.switchTaxaServico.checked;
    renderizarPainelComandaCaixa();
  }

  async function cancelarComandaAtiva() {
    if (!state.comandaAtiva) return;
    if (!confirm(`Deseja realmente cancelar a comanda da Mesa ${state.comandaAtiva.mesa}?`)) return;

    try {
      await apiRequest(`/comandas/${state.comandaAtiva.id}/cancelar`, {
        method: 'POST',
      });
      showToast(`Comanda da Mesa ${state.comandaAtiva.mesa} cancelada.`, 'success');
      state.comandaAtiva = null;
      await carregarComandas();
      renderizarPainelComandaCaixa();
    } catch (err) {
      showToast(err.message || 'Erro ao cancelar comanda.', 'error');
    }
  }

  async function abrirModalPagamento() {
    const c = state.comandaAtiva;
    if (!c) return;

    try {
      if (c.status === 'aberta') {
        const fechada = await apiRequest(`/comandas/${c.id}/fechar`, {
          method: 'POST',
          body: { aplicar_taxa_servico: state.taxaServicoAtiva },
        });
        state.comandaAtiva = fechada;
      }
    } catch (err) {
      showToast(err.message || 'Erro ao fechar comanda para pagamento.', 'error');
      return;
    }

    const comandaPronta = state.comandaAtiva;
    dom.paySubtotal.textContent = formatMoney(comandaPronta.subtotal);
    dom.payTaxa.textContent = formatMoney(comandaPronta.taxa_servico || '0.00');
    dom.payTotal.textContent = formatMoney(comandaPronta.total);

    dom.paymentItemsList.innerHTML = '';
    (comandaPronta.itens || []).forEach((it) => {
      const line = document.createElement('div');
      line.className = 'pay-item-line';
      line.innerHTML = `
        <span>${it.quantidade}x ${it.nome_copiado}</span>
        <span>${formatMoney(parseFloat(it.preco_copiado) * it.quantidade)}</span>
      `;
      dom.paymentItemsList.appendChild(line);
    });

    dom.modalPagamento.classList.add('active');
  }

  async function concluirPagamento() {
    const c = state.comandaAtiva;
    if (!c) return;

    dom.btnConcluirPagamento.disabled = true;
    dom.btnConcluirPagamento.textContent = 'Processando quitação...';

    try {
      await apiRequest(`/comandas/${c.id}/pagar`, {
        method: 'POST',
        body: {
          forma_pagamento: state.formaPagamentoSelecionada,
        },
      });

      showToast(`Venda concluída com sucesso! Mesa ${c.mesa} liberada.`, 'success');
      dom.modalPagamento.classList.remove('active');
      state.comandaAtiva = null;

      await carregarProdutos();
      await carregarComandas();
      renderizarPainelComandaCaixa();
    } catch (err) {
      showToast(err.message || 'Erro ao registrar pagamento.', 'error');
    } finally {
      dom.btnConcluirPagamento.disabled = false;
      dom.btnConcluirPagamento.textContent = 'Concluir Venda & Liberar Mesa';
    }
  }

  function abrirModalMesa(numeroMesa) {
    dom.inputMesaNumero.value = numeroMesa || '';
    dom.inputMesaCliente.value = '';
    dom.modalAbrirMesa.classList.add('active');
  }

  async function submeterAbrirComanda(e) {
    e.preventDefault();
    const mesa = dom.inputMesaNumero.value.trim();
    const garcomId = parseInt(dom.selectMesaGarcom.value, 10);
    const cliente = dom.inputMesaCliente.value.trim() || undefined;

    if (!mesa || !garcomId) {
      showToast('Preencha os campos obrigatórios.', 'error');
      return;
    }

    try {
      const novaComanda = await apiRequest('/comandas', {
        method: 'POST',
        body: {
          mesa,
          garcom_id: garcomId,
          cliente,
        },
      });

      showToast(`Comanda aberta com sucesso para a Mesa ${mesa}!`, 'success');
      dom.modalAbrirMesa.classList.remove('active');
      await carregarComandas();

      if (state.mode === 'garcom') {
        selecionarComandaGarcom(novaComanda);
      }
    } catch (err) {
      showToast(err.message || 'Erro ao abrir comanda.', 'error');
    }
  }

  async function cadastrarNovoProduto(e) {
    e.preventDefault();
    const nome = document.getElementById('cad-prod-nome').value.trim();
    const categoria = document.getElementById('cad-prod-categoria').value;
    const preco = document.getElementById('cad-prod-preco').value.trim();
    const estoque = parseInt(document.getElementById('cad-prod-estoque').value, 10);
    const estoqueMin = parseInt(document.getElementById('cad-prod-estoque-min').value, 10) || 0;

    try {
      await apiRequest('/produtos', {
        method: 'POST',
        body: {
          nome,
          categoria,
          preco,
          estoque,
          estoque_minimo: estoqueMin,
        },
      });

      showToast(`Produto "${nome}" cadastrado com sucesso!`, 'success');
      dom.formCadProduto.reset();
      await carregarProdutos();
    } catch (err) {
      showToast(err.message || 'Erro ao cadastrar produto.', 'error');
    }
  }

  async function cadastrarNovoUsuario(e) {
    e.preventDefault();
    const nome = document.getElementById('cad-user-nome').value.trim();
    const perfil = document.getElementById('cad-user-perfil').value;

    try {
      await apiRequest('/usuarios', {
        method: 'POST',
        body: { nome, perfil },
      });

      showToast(`Usuário "${nome}" cadastrado com sucesso!`, 'success');
      dom.formCadUsuario.reset();
      await carregarUsuarios();
    } catch (err) {
      showToast(err.message || 'Erro ao cadastrar usuário.', 'error');
    }
  }

  function renderizarTabelaProdutos() {
    dom.tabelaProdutosBody.innerHTML = '';
    state.produtos.forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.id}</td>
        <td><strong>${p.nome}</strong></td>
        <td>${p.categoria}</td>
        <td>${formatMoney(p.preco)}</td>
        <td>${p.estoque}</td>
        <td>${p.ativo ? '<span class="status-dot"></span> Ativo' : 'Inativo'}</td>
        <td>
          ${
            p.ativo
              ? `<button type="button" class="btn-danger-outline" style="padding:4px 8px;font-size:11px;" data-inativar-prod="${p.id}">Inativar</button>`
              : '—'
          }
        </td>
      `;

      if (p.ativo) {
        tr.querySelector('[data-inativar-prod]').addEventListener('click', async () => {
          if (confirm(`Inativar o produto ${p.nome}?`)) {
            await apiRequest(`/produtos/${p.id}/inativar`, { method: 'POST' });
            showToast('Produto inativado.', 'success');
            await carregarProdutos();
          }
        });
      }

      dom.tabelaProdutosBody.appendChild(tr);
    });
  }

  function renderizarTabelaUsuarios() {
    dom.tabelaUsuariosBody.innerHTML = '';
    state.usuarios.forEach((u) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.id}</td>
        <td><strong>${u.nome}</strong></td>
        <td>${u.perfil}</td>
        <td>${u.ativo ? '<span class="status-dot"></span> Ativo' : 'Inativo'}</td>
        <td>
          ${
            u.ativo
              ? `<button type="button" class="btn-danger-outline" style="padding:4px 8px;font-size:11px;" data-inativar-user="${u.id}">Inativar</button>`
              : '—'
          }
        </td>
      `;

      if (u.ativo) {
        tr.querySelector('[data-inativar-user]').addEventListener('click', async () => {
          if (confirm(`Inativar usuário ${u.nome}?`)) {
            await apiRequest(`/usuarios/${u.id}/inativar`, { method: 'POST' });
            showToast('Usuário inativado.', 'success');
            await carregarUsuarios();
          }
        });
      }

      dom.tabelaUsuariosBody.appendChild(tr);
    });
  }

  function setupEventListeners() {
    dom.btnModeGarcom.addEventListener('click', () => setMode('garcom'));
    dom.btnModeCaixa.addEventListener('click', () => setMode('caixa'));

    dom.filtroMesasChips.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        dom.filtroMesasChips.querySelector('.active')?.classList.remove('active');
        btn.classList.add('active');
        state.filtroMesaStatus = btn.dataset.status;
        renderizarMesasGarcom();
      });
    });

    dom.categoriasCardapioGarcom.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        dom.categoriasCardapioGarcom.querySelector('.active')?.classList.remove('active');
        btn.classList.add('active');
        state.filtroCategoriaGarcom = btn.dataset.cat;
        renderizarCardapioGarcom();
      });
    });

    dom.categoriasCaixa.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        dom.categoriasCaixa.querySelector('.active')?.classList.remove('active');
        btn.classList.add('active');
        state.filtroCategoriaCaixa = btn.dataset.cat;
        renderizarProdutosCaixa();
      });
    });

    dom.fabAbrirMesa.addEventListener('click', () => abrirModalMesa(''));
    dom.btnVoltarSalao.addEventListener('click', () => {
      dom.garcomComandaSubview.classList.remove('active');
      dom.garcomSalaoSubview.classList.add('active');
      state.novoPedidoItens = {};
      atualizarResumoNovoPedidoGarcom();
    });
    dom.btnEnviarCozinha.addEventListener('click', enviarPedidoParaCozinha);
    dom.btnPedirContaTopo.addEventListener('click', pedirContaMesaGarcom);

    dom.btnVerItensComanda.addEventListener('click', () => {
      if (!state.comandaAtiva) return;
      dom.listaItensComandaModal.innerHTML = '';
      (state.comandaAtiva.itens || []).forEach((it) => {
        const div = document.createElement('div');
        div.className = 'pay-item-line';
        div.innerHTML = `
          <span>${it.quantidade}x ${it.nome_copiado}</span>
          <span>${formatMoney(parseFloat(it.preco_copiado) * it.quantidade)}</span>
        `;
        dom.listaItensComandaModal.appendChild(div);
      });
      dom.modalVerComanda.classList.add('active');
    });

    dom.inputBuscaCaixa.addEventListener('input', renderizarProdutosCaixa);
    dom.tabsCaixaNav.querySelectorAll('.caixa-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        dom.tabsCaixaNav.querySelector('.active')?.classList.remove('active');
        tab.classList.add('active');
        const view = tab.dataset.view;
        if (view === 'cardapio') {
          dom.caixaSubMesas.classList.remove('active');
          dom.caixaSubCardapio.classList.add('active');
        } else {
          dom.caixaSubCardapio.classList.remove('active');
          dom.caixaSubMesas.classList.add('active');
        }
      });
    });

    dom.switchTaxaServico.checked = state.taxaServicoAtiva;
    dom.switchTaxaServico.addEventListener('change', alternarTaxaServico);
    dom.btnCancelarComanda.addEventListener('click', cancelarComandaAtiva);
    dom.btnAbrirPagamento.addEventListener('click', abrirModalPagamento);
    dom.btnConcluirPagamento.addEventListener('click', concluirPagamento);

    dom.paymentTabs.querySelectorAll('.pay-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        dom.paymentTabs.querySelector('.active')?.classList.remove('active');
        tab.classList.add('active');
        state.formaPagamentoSelecionada = tab.dataset.forma;

        dom.methodPixBox.classList.remove('active');
        dom.methodDinheiroBox.classList.remove('active');
        dom.methodCartaoBox.classList.remove('active');

        if (state.formaPagamentoSelecionada === 'pix') {
          dom.methodPixBox.classList.add('active');
        } else if (state.formaPagamentoSelecionada === 'dinheiro') {
          dom.methodDinheiroBox.classList.add('active');
        } else {
          dom.methodCartaoBox.classList.add('active');
        }
      });
    });

    dom.inputDinheiroRecebido.addEventListener('input', () => {
      const total = parseFloat(state.comandaAtiva?.total || '0');
      const entregue = parseFloat(dom.inputDinheiroRecebido.value.replace(',', '.') || '0');
      const troco = Math.max(0, entregue - total);
      dom.valorTrocoCalculado.textContent = formatMoney(troco);
    });

    dom.formAbrirComanda.addEventListener('submit', submeterAbrirComanda);
    dom.formCadProduto.addEventListener('submit', cadastrarNovoProduto);
    dom.formCadUsuario.addEventListener('submit', cadastrarNovoUsuario);

    dom.btnAbrirCadastros.addEventListener('click', () => {
      dom.modalCadastros.classList.add('active');
    });

    document.querySelectorAll('.admin-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelector('.admin-tab.active')?.classList.remove('active');
        document.querySelector('.admin-tab-content.active')?.classList.remove('active');

        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });

    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modal = document.getElementById(btn.dataset.close);
        if (modal) modal.classList.remove('active');
      });
    });

    dom.selectGarcomAtivo.addEventListener('change', (e) => {
      state.garcomAtivoId = parseInt(e.target.value, 10);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode === 'garcom') {
      dom.btnModeGarcom.classList.add('active');
      dom.btnModeCaixa.classList.remove('active');
      dom.viewGarcom.classList.add('active');
      dom.viewCaixa.classList.remove('active');
    } else {
      dom.btnModeCaixa.classList.add('active');
      dom.btnModeGarcom.classList.remove('active');
      dom.viewCaixa.classList.add('active');
      dom.viewGarcom.classList.remove('active');
      renderizarPainelComandaCaixa();
    }
  }

  function setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setMode('caixa');
        dom.inputBuscaCaixa.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        abrirModalMesa('');
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (state.comandaAtiva && !dom.btnAbrirPagamento.disabled) {
          abrirModalPagamento();
        }
      } else if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach((m) => m.classList.remove('active'));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
