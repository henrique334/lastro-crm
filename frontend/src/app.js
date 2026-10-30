// Lastro CRM & Hunter AI - Aplicação Frontend SPA
const API_BASE = '/api';

// Etapas Oficiais do Funil de Vendas da Lastro
const PIPELINE_STAGES = [
  { id: 'novo', name: 'Descoberta' },
  { id: 'qualificado', name: 'Qualificado (IA)' },
  { id: 'contato', name: 'Contato Feito' },
  { id: 'diagnostico', name: 'Diagnóstico' },
  { id: 'proposta', name: 'Proposta' },
  { id: 'negociacao', name: 'Negociação' },
  { id: 'ganho', name: 'Fechado / Ganho' }
];

// Estado Global
let state = {
  leads: [],
  services: [],
  metrics: {},
  settings: {},
  currentLead: null,
  prospectResults: [],
  activeServiceFilter: '',
  activeCityFilter: '',
  searchQuery: '',
  activeTab: 'kanban',
  copilotChatOpen: false,
  copilotHistory: []
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialData();
  setupEventListeners();
});

async function loadInitialData() {
  try {
    const [servicesRes, leadsRes, metricsRes, settingsRes] = await Promise.all([
      fetch(`${API_BASE}/services`),
      fetch(`${API_BASE}/leads`),
      fetch(`${API_BASE}/metrics`),
      fetch(`${API_BASE}/settings`)
    ]);

    const servicesData = await servicesRes.json();
    const leadsData = await leadsRes.json();
    const metricsData = await metricsRes.json();
    const settingsData = await settingsRes.json();

    if (servicesData.success) state.services = servicesData.data;
    if (leadsData.success) state.leads = leadsData.data;
    if (metricsData.success) state.metrics = metricsData.data;
    if (settingsData.success) state.settings = settingsData.data;

    renderKPIs();
    renderKanban();
    renderTableLeads();
    renderMetricsTab();
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
    showToast('Erro de Conexão', 'Não foi possível carregar os dados do CRM.', 'error');
  }
}

function setupEventListeners() {
  // Fechar modais ao clicar no backdrop
  document.querySelectorAll('[id^="modal-"]').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  // Fechar dropdown de etapas do modal ao clicar fora
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#btn-modal-stage-selector') && !e.target.closest('#modal-stage-dropdown-menu')) {
      const menu = document.getElementById('modal-stage-dropdown-menu');
      if (menu) menu.classList.add('hidden');
    }
  });
}

// ==========================================
// RENDERIZAÇÃO DE KPIS & MÉTRICAS
// ==========================================
function renderKPIs() {
  const m = state.metrics;
  if (!m) return;

  const totalEl = document.getElementById('kpi-total-leads');
  const pipelineEl = document.getElementById('kpi-pipeline-value');
  const qualEl = document.getElementById('kpi-qualified');
  const wonEl = document.getElementById('kpi-won');
  const scoreEl = document.getElementById('kpi-score');

  if (totalEl) totalEl.textContent = m.totalLeads || 0;
  if (pipelineEl) pipelineEl.textContent = `R$ ${(m.totalPipelineValue || 0).toLocaleString('pt-BR')}`;
  if (qualEl) qualEl.textContent = m.stageCounts?.qualificado || 0;
  if (wonEl) wonEl.textContent = `${m.stageCounts?.ganho || 0} (${m.conversionRate || 0}%)`;
  if (scoreEl) scoreEl.textContent = `${m.averageScore || 0}%`;
}

// ==========================================
// KANBAN & DRAG AND DROP
// ==========================================
function getFilteredLeads() {
  return state.leads.filter(lead => {
    // Filtro por Praça / Cidade
    if (state.activeCityFilter) {
      const c = state.activeCityFilter.toLowerCase();
      if (!lead.city || !lead.city.toLowerCase().includes(c)) {
        return false;
      }
    }
    // Filtro por Serviço
    if (state.activeServiceFilter && lead.recommendedServiceId !== state.activeServiceFilter) {
      return false;
    }
    // Filtro por Busca
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const matchName = lead.companyName && lead.companyName.toLowerCase().includes(q);
      const matchTrade = lead.tradeName && lead.tradeName.toLowerCase().includes(q);
      const matchCity = lead.city && lead.city.toLowerCase().includes(q);
      const matchSeg = lead.segment && lead.segment.toLowerCase().includes(q);
      const matchAddr = lead.address && lead.address.toLowerCase().includes(q);
      if (!matchName && !matchTrade && !matchCity && !matchSeg && !matchAddr) return false;
    }
    return true;
  });
}

function renderKanban() {
  const stages = ['novo', 'qualificado', 'contato', 'diagnostico', 'proposta', 'negociacao', 'ganho'];
  const filtered = getFilteredLeads();

  // Limpar colunas e zerar contadores visuais
  stages.forEach(stage => {
    const col = document.querySelector(`.kanban-column[data-stage="${stage}"]`);
    const countBadge = document.querySelector(`.stage-count[data-stage="${stage}"]`);
    if (col) col.innerHTML = '';
    
    const stageLeads = filtered.filter(l => l.stage === stage);
    if (countBadge) countBadge.textContent = stageLeads.length;

    if (col) {
      if (stageLeads.length === 0) {
        col.innerHTML = `
          <div class="h-28 border border-dashed border-surface_border/80 rounded-xl p-3 flex flex-col items-center justify-center text-center text-gray-500 text-[10px]">
            <i class="fa-solid fa-inbox text-gray-600 text-sm mb-1"></i>
            <span>Nenhum lead nesta etapa</span>
          </div>
        `;
      } else {
        stageLeads.forEach(lead => {
          col.appendChild(createLeadCardElement(lead));
        });
      }
    }
  });
}

function createLeadCardElement(lead) {
  const card = document.createElement('div');
  card.className = 'lead-card bg-card/95 hover:bg-card border border-surface_border hover:border-brand-blue/50 rounded-xl p-2.5 space-y-2 relative select-none shadow-md transition-all';
  card.setAttribute('draggable', 'true');
  card.setAttribute('data-id', lead.id);

  // Eventos de arrastar
  card.addEventListener('dragstart', (e) => onDragStart(e, lead.id));
  card.addEventListener('dragend', onDragEnd);
  
  // Clique para abrir detalhes
  card.addEventListener('click', (e) => {
    // Evitar abrir modal se clicou no botão de WhatsApp ou controles de etapa
    if (e.target.closest('.btn-wa-direct') || e.target.closest('.card-stage-control')) return;
    openLeadModal(lead.id);
  });

  const service = getServiceInfo(lead.recommendedServiceId);
  const serviceBadgeClass = `badge-service-${lead.recommendedServiceId || 'trafego'}`;

  // WhatsApp link formatado
  const waClean = (lead.whatsapp || '').replace(/\D/g, '');
  const pitchText = lead.pitchCopy?.whatsapp || `Olá! Entro em contato da Lastro Marketing para falar com ${lead.contactPerson || 'o responsável'}.`;
  const waUrl = waClean ? `https://wa.me/${waClean}?text=${encodeURIComponent(pitchText)}` : null;

  const currentStageId = lead.stage || 'novo';
  const stageIdx = PIPELINE_STAGES.findIndex(s => s.id === currentStageId);
  const prevStage = stageIdx > 0 ? PIPELINE_STAGES[stageIdx - 1] : null;
  const nextStage = stageIdx >= 0 && stageIdx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[stageIdx + 1] : null;

  card.innerHTML = `
    <!-- Topo do Card: Nicho & Score -->
    <div class="flex items-center justify-between text-[10px]">
      <span class="text-gray-400 font-medium truncate max-w-[100px]" title="${lead.segment || 'Geral'}">${lead.segment || 'Geral'}</span>
      <span class="px-1.5 py-0.5 rounded font-bold text-[9px] ${getScoreBadgeStyle(lead.score)}">
        ${lead.score || 85}% Fit
      </span>
    </div>

    <!-- Nome da Empresa & Localização -->
    <div>
      <h4 class="font-heading font-bold text-white text-xs hover:text-brand-light transition truncate" title="${lead.companyName}">
        ${lead.tradeName || lead.companyName}
      </h4>
      <p class="text-[10px] text-gray-400 font-medium flex items-center gap-1 mt-0.5 truncate" title="${lead.address || (lead.city + ' - SP')}">
        <i class="fa-solid fa-location-dot text-[9px] text-brand-light flex-shrink-0"></i>
        <span class="truncate">${lead.city || 'SP'}</span>
      </p>
    </div>

    <!-- Solução Lastro Recomendada -->
    <div>
      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${serviceBadgeClass} truncate max-w-full">
        <i class="fa-solid ${service.icon} text-[8px]"></i>
        <span class="truncate">${service.name}</span>
      </span>
    </div>

    <!-- Rodapé: Valor & Botão WhatsApp Direto -->
    <div class="pt-1.5 border-t border-surface_border/70 flex items-center justify-between">
      <span class="text-[11px] font-heading font-bold text-white">
        R$ ${(lead.estimatedValue || 2500).toLocaleString('pt-BR')}
      </span>

      ${waUrl ? `
        <a href="${waUrl}" target="_blank" title="Abrir WhatsApp com Copy da IA" class="btn-wa-direct w-6 h-6 rounded bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white border border-green-500/20 flex items-center justify-center transition cursor-pointer">
          <i class="fa-brands fa-whatsapp text-xs"></i>
        </a>
      ` : `
        <span class="text-[9px] text-gray-600">Sem WA</span>
      `}
    </div>

    <!-- Controle Rápido de Mudança de Etapa no Card -->
    <div class="card-stage-control pt-1.5 border-t border-surface_border/50 flex items-center justify-between gap-1 text-[10px]" onclick="event.stopPropagation()">
      ${prevStage ? `
        <button type="button" onclick="advanceLeadStage('${lead.id}', '${prevStage.id}', event)" title="Voltar para: ${prevStage.name}" class="h-5 px-1.5 rounded bg-surface hover:bg-surface_border border border-surface_border text-gray-400 hover:text-white flex items-center gap-0.5 transition text-[9px] cursor-pointer">
          <i class="fa-solid fa-chevron-left text-[7px]"></i>
          <span class="hidden sm:inline">Voltar</span>
        </button>
      ` : '<div class="w-3"></div>'}

      <span class="text-[9px] text-gray-400 font-semibold truncate px-1" title="Etapa atual: ${getStageName(currentStageId)}">
        ${getStageName(currentStageId)}
      </span>

      ${nextStage ? `
        <button type="button" onclick="advanceLeadStage('${lead.id}', '${nextStage.id}', event)" title="Avançar para: ${nextStage.name}" class="h-5 px-2 rounded bg-brand-blue/20 hover:bg-brand-blue border border-brand-blue/40 text-brand-light hover:text-white font-bold transition flex items-center gap-1 text-[9px] cursor-pointer">
          <span>Avançar</span>
          <i class="fa-solid fa-chevron-right text-[7px]"></i>
        </button>
      ` : `
        <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[9px] border border-emerald-500/30">
          ✓ Ganho
        </span>
      `}
    </div>
  `;

  return card;
}

function getScoreBadgeStyle(score) {
  if (score >= 90) return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
  if (score >= 80) return 'bg-blue-500/20 text-brand-light border border-blue-500/30';
  return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
}

function getServiceInfo(serviceId) {
  const s = state.services.find(item => item.id === serviceId);
  return s || { name: 'Tráfego Pago', icon: 'fa-chart-line' };
}

// Drag & Drop Handlers
let draggedLeadId = null;

function onDragStart(e, leadId) {
  draggedLeadId = leadId;
  e.dataTransfer.setData('text/plain', leadId);
  e.dataTransfer.effectAllowed = 'move';
  e.target.classList.add('dragging');
}

function onDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
}

function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function onDrop(e, targetStage) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  if (!draggedLeadId) return;

  const lead = state.leads.find(l => l.id === draggedLeadId);
  if (!lead || lead.stage === targetStage) return;

  // Atualização otimista
  const previousStage = lead.stage;
  lead.stage = targetStage;
  renderKanban();

  try {
    const res = await fetch(`${API_BASE}/leads/${draggedLeadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: targetStage })
    });

    if (!res.ok) throw new Error('Falha ao atualizar etapa');
    
    // Adicionar interação
    await fetch(`${API_BASE}/leads/${draggedLeadId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'stage_change',
        author: 'Usuário',
        content: `Lead movido para a etapa: ${getStageName(targetStage)}.`
      })
    });

    showToast('Etapa Atualizada', `Lead movido para "${getStageName(targetStage)}".`, 'success');
    refreshMetrics();
  } catch (err) {
    lead.stage = previousStage;
    renderKanban();
    showToast('Erro', 'Não foi possível atualizar a etapa.', 'error');
  }
}

function getStageName(stage) {
  const map = {
    novo: 'Descoberta',
    qualificado: 'Qualificado pela IA',
    contato: 'Contato Feito',
    diagnostico: 'Diagnóstico',
    proposta: 'Proposta',
    negociacao: 'Negociação',
    ganho: 'Fechado / Ganho',
    perdido: 'Perdido'
  };
  return map[stage] || stage;
}

// ==========================================
// RADAR DO AGENTE HUNTER (PROSPECÇÃO)
// ==========================================
function setQuickNiche(niche, city) {
  const nicheInput = document.getElementById('hunter-niche');
  const cityInput = document.getElementById('hunter-city');
  if (nicheInput) nicheInput.value = niche;
  if (cityInput) cityInput.value = city;
}

async function runProspector() {
  const niche = document.getElementById('hunter-niche').value.trim();
  const city = document.getElementById('hunter-city').value.trim();
  const count = parseInt(document.getElementById('hunter-count').value, 10) || 4;

  if (!niche || !city) {
    showToast('Atenção', 'Informe o nicho e a cidade para a varredura.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-run-prospect');
  const loading = document.getElementById('hunter-loading');
  const resultsContainer = document.getElementById('hunter-results');
  const batchActions = document.getElementById('hunter-batch-actions');

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Varrendo Mercado...</span>`;
  loading.classList.remove('hidden');
  resultsContainer.innerHTML = '';
  if (batchActions) batchActions.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/hunter/prospect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, city, count })
    });

    const data = await res.json();
    loading.classList.add('hidden');
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-crosshairs"></i><span>Disparar Varredura</span>`;

    if (!data.success || !data.data || data.data.length === 0) {
      resultsContainer.innerHTML = `
        <div class="col-span-full text-center py-12 text-gray-500">
          Nenhuma empresa qualificada encontrada para os critérios informados.
        </div>
      `;
      return;
    }

    state.prospectResults = data.data;
    renderProspectResults();
    if (batchActions) batchActions.classList.remove('hidden');

    showToast('Varredura Concluída!', `${data.data.length} empresas com análise de presença digital e dores mapeadas.`, 'success');
  } catch (err) {
    loading.classList.add('hidden');
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-crosshairs"></i><span>Disparar Varredura</span>`;
    showToast('Erro', 'Falha ao executar a prospecção da IA.', 'error');
  }
}

function renderProspectResults() {
  const container = document.getElementById('hunter-results');
  if (!container) return;

  container.innerHTML = '';

  state.prospectResults.forEach((prospect, index) => {
    const service = getServiceInfo(prospect.recommendedServiceId);
    const serviceBadgeClass = `badge-service-${prospect.recommendedServiceId || 'trafego'}`;

    const card = document.createElement('div');
    card.className = 'glass-panel rounded-3xl p-6 border border-surface_border flex flex-col justify-between space-y-5 relative overflow-hidden transition-all duration-300 hover:border-brand-blue/50';

    card.innerHTML = `
      <div>
        <!-- Topo: Score & Nicho -->
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-gray-400 font-medium">${prospect.segment}</span>
          <span class="px-2.5 py-0.5 rounded-full font-bold text-xs ${getScoreBadgeStyle(prospect.score)}">
            ${prospect.score}% Fit Lastro
          </span>
        </div>

        <!-- Nome e Localização -->
        <h3 class="text-xl font-heading font-bold text-white mb-1">${prospect.companyName}</h3>
        <p class="text-xs text-gray-300 flex items-center gap-1.5 font-medium mb-1">
          <i class="fa-solid fa-location-dot text-brand-light flex-shrink-0"></i>
          <span>${prospect.address || (prospect.city + ' - SP')}</span>
        </p>
        <p class="text-[11px] text-gray-400 flex flex-wrap items-center gap-3 mb-4">
          <span><i class="fa-solid fa-phone text-[10px] text-gray-500 mr-1"></i>${prospect.phone || '(14) 3452-0000'}</span>
          ${prospect.instagram ? `<span><i class="fa-brands fa-instagram text-[10px] text-pink-400 mr-1"></i>${prospect.instagram}</span>` : ''}
          ${prospect.contactPerson ? `<span><i class="fa-solid fa-user-tie text-[10px] text-gray-500 mr-1"></i>${prospect.contactPerson}</span>` : ''}
        </p>

        <!-- Solução Recomendada Lastro -->
        <div class="p-3.5 rounded-2xl bg-dark/70 border border-surface_border mb-4">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Solução Lastro Ideal:</span>
            <span class="px-2 py-0.5 rounded-md text-[11px] font-bold ${serviceBadgeClass}">
              <i class="fa-solid ${service.icon} text-[10px] mr-1"></i> ${service.name}
            </span>
          </div>
          <p class="text-xs text-gray-300 leading-relaxed">${prospect.matchReason}</p>
        </div>

        <!-- Diagnóstico Digital Rápido -->
        <div class="space-y-1.5 text-xs text-gray-400">
          <div class="flex items-center gap-2">
            <i class="fa-solid ${prospect.digitalAudit?.hasWebsite ? 'fa-check text-green-400' : 'fa-xmark text-red-400'} text-xs"></i>
            <span>Site: ${prospect.digitalAudit?.hasWebsite ? 'Possui (necessita melhorias)' : 'Não possui site indexado'}</span>
          </div>
          <div class="flex items-center gap-2">
            <i class="fa-solid ${prospect.digitalAudit?.googleAdsActive ? 'fa-check text-green-400' : 'fa-xmark text-amber-400'} text-xs"></i>
            <span>Google Ads: ${prospect.digitalAudit?.googleAdsActive ? 'Ativo' : 'Inativo nas pesquisas da região'}</span>
          </div>
          <div class="flex items-center gap-2">
            <i class="fa-solid ${prospect.digitalAudit?.metaAdsActive ? 'fa-check text-green-400' : 'fa-xmark text-amber-400'} text-xs"></i>
            <span>Meta Ads: ${prospect.digitalAudit?.metaAdsActive ? 'Ativo' : 'Sem anúncios na biblioteca'}</span>
          </div>
        </div>

        <!-- Prévia do Pitch Comercial -->
        <div class="mt-4 pt-3 border-t border-surface_border">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            <i class="fa-brands fa-whatsapp text-green-400 mr-1"></i> Abordagem Personalizada (IA):
          </span>
          <p class="text-[11px] text-gray-300 bg-surface/80 p-2.5 rounded-xl border border-surface_border leading-relaxed line-clamp-3">
            "${prospect.pitchCopy?.whatsapp}"
          </p>
        </div>
      </div>

      <!-- Ação de Cadastramento -->
      <div class="pt-4 border-t border-surface_border flex items-center justify-between gap-3">
        <span class="text-xs font-heading font-bold text-white">
          Ticket: R$ ${(prospect.estimatedValue || 2500).toLocaleString('pt-BR')}
        </span>

        <button id="btn-register-${index}" onclick="registerSingleProspect(${index})" class="px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-brand-blue/20">
          <i class="fa-solid fa-plus text-xs"></i> Cadastrar no CRM
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

async function registerSingleProspect(index) {
  const prospect = state.prospectResults[index];
  if (!prospect) return;

  const btn = document.getElementById(`btn-register-${index}`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i> Cadastrando...`;
  }

  try {
    const res = await fetch(`${API_BASE}/hunter/auto-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospects: [prospect] })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const newLead = data.data[0];
    state.leads.unshift(newLead);

    if (btn) {
      btn.className = 'px-4 py-2 bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl text-xs cursor-default flex items-center gap-1.5';
      btn.innerHTML = `<i class="fa-solid fa-check text-xs"></i> Cadastrado!`;
    }

    renderKanban();
    renderTableLeads();
    refreshMetrics();
    showToast('Empresa Cadastrada!', `"${prospect.companyName}" foi adicionada ao funil do CRM com sucesso.`, 'success');
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-plus text-xs"></i> Tentar Novamente`;
    }
    showToast('Erro', 'Falha ao cadastrar empresa.', 'error');
  }
}

async function registerAllProspects() {
  if (!state.prospectResults || state.prospectResults.length === 0) return;

  const btn = document.querySelector('#hunter-batch-actions button');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Cadastrando Todos...`;
  }

  try {
    const res = await fetch(`${API_BASE}/hunter/auto-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospects: state.prospectResults })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    data.data.forEach(lead => state.leads.unshift(lead));

    renderKanban();
    renderTableLeads();
    refreshMetrics();

    // Atualizar botões dos cards
    state.prospectResults.forEach((_, idx) => {
      const b = document.getElementById(`btn-register-${idx}`);
      if (b) {
        b.className = 'px-4 py-2 bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl text-xs cursor-default flex items-center gap-1.5';
        b.innerHTML = `<i class="fa-solid fa-check text-xs"></i> Cadastrado!`;
        b.disabled = true;
      }
    });

    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-check"></i> Todas as Empresas Cadastradas!`;
    }

    showToast('Sucesso!', `${data.data.length} empresas foram cadastradas no CRM pelo Agente Hunter.`, 'success');
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-check-double"></i> Cadastrar Todos no CRM`;
    }
    showToast('Erro', 'Falha ao cadastrar lote de empresas.', 'error');
  }
}

// ==========================================
// CADASTRO EXPRESSO VIA IA (LINK / NOME)
// ==========================================
function openAiRegisterModal() {
  document.getElementById('ai-register-input').value = '';
  openModal('modal-ai-register');
}

async function submitAiRegister() {
  const input = document.getElementById('ai-register-input').value.trim();
  const cityHint = document.getElementById('ai-register-city').value.trim() || 'Bauru, SP';

  if (!input) {
    showToast('Atenção', 'Informe o Instagram, link ou nome da empresa.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-submit-ai-register');
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Agente Auditando & Cadastrando...`;

  try {
    const res = await fetch(`${API_BASE}/hunter/analyze-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, cityHint })
    });

    const data = await res.json();
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-bolt"></i> Analisar & Cadastrar no CRM`;

    if (!data.success) throw new Error(data.error);

    const lead = data.data;
    state.leads.unshift(lead);

    closeModal('modal-ai-register');
    renderKanban();
    renderTableLeads();
    refreshMetrics();

    showToast('Cadastrado com IA!', `"${lead.companyName}" foi analisada e cadastrada no funil.`, 'success');
    openLeadModal(lead.id);
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-bolt"></i> Analisar & Cadastrar no CRM`;
    showToast('Erro', 'Falha ao analisar e cadastrar a empresa.', 'error');
  }
}

// ==========================================
// CADASTRO MANUAL
// ==========================================
function openManualLeadModal() {
  document.getElementById('form-manual-lead').reset();
  openModal('modal-manual-lead');
}

async function submitManualLead(e) {
  e.preventDefault();

  const name = document.getElementById('manual-name').value.trim();
  const segment = document.getElementById('manual-segment').value.trim();
  const whatsapp = document.getElementById('manual-whatsapp').value.trim();
  const contact = document.getElementById('manual-contact').value.trim();
  const city = document.getElementById('manual-city').value.trim();
  const stateVal = document.getElementById('manual-state').value.trim();
  const service = document.getElementById('manual-service').value;
  const value = parseFloat(document.getElementById('manual-value').value) || 2500;

  try {
    const res = await fetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: name,
        tradeName: name,
        segment: segment || 'Geral',
        whatsapp,
        contactPerson: contact,
        city,
        state: stateVal,
        recommendedServiceId: service,
        estimatedValue: value,
        stage: 'novo',
        score: 80,
        registeredByAi: false
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    state.leads.unshift(data.data);
    closeModal('modal-manual-lead');
    renderKanban();
    renderTableLeads();
    refreshMetrics();

    showToast('Lead Criado', `"${name}" adicionado com sucesso.`, 'success');
  } catch (err) {
    showToast('Erro', 'Não foi possível criar o lead.', 'error');
  }
}

// ==========================================
// MODAL DE DETALHES DO LEAD & PITCH
// ==========================================
function openLeadModal(leadId) {
  const lead = state.leads.find(l => l.id === leadId);
  if (!lead) return;

  state.currentLead = lead;

  // Cabeçalho
  document.getElementById('modal-lead-segment').textContent = lead.segment || 'Geral';
  document.getElementById('modal-lead-location').textContent = `${lead.city || 'SP'}${lead.state ? `, ${lead.state}` : ''}`;
  document.getElementById('modal-lead-title').textContent = lead.companyName;
  document.getElementById('modal-lead-contact').textContent = `Contato: ${lead.contactPerson || 'Não informado'} • ${lead.phone || lead.whatsapp || ''}`;
  document.getElementById('modal-lead-score').textContent = `${lead.score || 85}%`;

  // Select de Etapa
  const stageSelect = document.getElementById('modal-lead-stage-select');
  if (stageSelect) stageSelect.value = lead.stage || 'novo';

  // Tab 1: Diagnóstico e Localização
  const service = getServiceInfo(lead.recommendedServiceId);
  document.getElementById('modal-recommended-service-title').textContent = `${service.name} (Valor: R$ ${(lead.estimatedValue || 2500).toLocaleString('pt-BR')})`;
  document.getElementById('modal-recommended-service-reason').textContent = lead.matchReason || 'Oportunidade identificada de crescimento.';

  // Localização & Contatos Verificados
  const addrEl = document.getElementById('modal-lead-address');
  if (addrEl) {
    addrEl.textContent = lead.address || `${lead.neighborhood ? lead.neighborhood + ', ' : ''}${lead.city} - SP`;
  }
  const phonesEl = document.getElementById('modal-lead-phones');
  if (phonesEl) {
    phonesEl.textContent = `${lead.phone || '(14) 3452-0000'}${lead.whatsapp ? ' • WA: ' + lead.whatsapp : ''}`;
  }
  const instaEl = document.getElementById('modal-lead-instagram');
  if (instaEl) {
    instaEl.textContent = lead.instagram || 'Não possui perfil oficial';
  }
  const webEl = document.getElementById('modal-lead-website');
  if (webEl) {
    webEl.innerHTML = lead.website 
      ? `<a href="${lead.website}" target="_blank" class="underline hover:text-white">${lead.website}</a>`
      : 'Não possui site institucional';
  }

  const auditWeb = document.getElementById('modal-audit-website');
  if (auditWeb) {
    auditWeb.innerHTML = lead.digitalAudit?.hasWebsite 
      ? `<span class="text-green-400 font-bold">✓ Ativo:</span> ${lead.website || lead.digitalAudit?.websiteQuality || 'Site no ar'}`
      : `<span class="text-red-400 font-bold">✗ Sem site próprio:</span> Concorrentes no topo do Google`;
  }

  const auditAds = document.getElementById('modal-audit-ads');
  if (auditAds) {
    const metaText = lead.digitalAudit?.metaAdsActive ? 'Meta: Ativo' : 'Meta: Inativo';
    const googleText = lead.digitalAudit?.googleAdsActive ? 'Google: Ativo' : 'Google: Inativo';
    auditAds.textContent = `${metaText} • ${googleText}`;
  }

  const gapsList = document.getElementById('modal-audit-gaps');
  if (gapsList) {
    gapsList.innerHTML = '';
    const gaps = lead.digitalAudit?.gaps || ['Falta de funil previsível de vendas'];
    gaps.forEach(gap => {
      const li = document.createElement('li');
      li.className = 'flex items-center gap-1.5';
      li.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-400 text-xs"></i> <span>${gap}</span>`;
      gapsList.appendChild(li);
    });
  }

  // Tab 2: Pitch Comercial
  const waPitch = lead.pitchCopy?.whatsapp || `Olá ${lead.contactPerson || ''}! Vimos que a ${lead.tradeName || lead.companyName} tem grande potencial de escala com as soluções da Lastro.`;
  document.getElementById('modal-pitch-whatsapp').textContent = waPitch;
  document.getElementById('modal-pitch-email').textContent = lead.pitchCopy?.email || 'Apresentação comercial da Lastro.';
  document.getElementById('modal-pitch-phone').textContent = lead.pitchCopy?.phoneTalkingPoints || 'Apresentar diferenciais e cases de sucesso da Lastro.';

  // Botão WhatsApp direto no modal
  const btnWa = document.getElementById('btn-modal-open-whatsapp');
  const cleanWa = (lead.whatsapp || '').replace(/\D/g, '');
  if (cleanWa) {
    btnWa.href = `https://wa.me/${cleanWa}?text=${encodeURIComponent(waPitch)}`;
    btnWa.classList.remove('hidden');
  } else {
    btnWa.classList.add('hidden');
  }

  // Tab 3: Timeline & Interações
  renderModalInteractions(lead.interactions || []);

  renderModalStageStepper();
  renderModalStageFooter();
  switchLeadModalTab('audit');
  openModal('modal-lead-details');
}

function switchLeadModalTab(tab) {
  ['audit', 'pitch', 'history'].forEach(t => {
    const btn = document.getElementById(`modal-tab-${t}`);
    const content = document.getElementById(`modal-content-${t}`);
    if (t === tab) {
      if (btn) btn.className = 'modal-tab-btn py-3.5 px-2 border-b-2 border-brand-blue text-white bg-brand-blue/10 flex items-center justify-center gap-2 transition font-bold whitespace-nowrap';
      if (content) content.classList.remove('hidden');
    } else {
      if (btn) btn.className = 'modal-tab-btn py-3.5 px-2 border-b-2 border-transparent text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-center gap-2 transition whitespace-nowrap';
      if (content) content.classList.add('hidden');
    }
  });
}

function renderModalStageStepper() {
  const container = document.getElementById('modal-stage-stepper');
  if (!container || !state.currentLead) return;

  const currentStage = state.currentLead.stage || 'novo';
  const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === currentStage);

  container.innerHTML = PIPELINE_STAGES.map((st, idx) => {
    const isActive = st.id === currentStage;
    const isPast = currentIdx > idx;

    let btnClasses = 'px-2.5 py-1.5 rounded-xl font-semibold text-[11px] flex items-center gap-1.5 transition cursor-pointer ';
    if (isActive) {
      btnClasses += 'bg-brand-blue text-white shadow-md shadow-brand-blue/30 border border-brand-light/40 font-bold';
    } else if (isPast) {
      btnClasses += 'bg-surface border border-emerald-500/30 text-emerald-400 hover:text-white hover:bg-emerald-500/10';
    } else {
      btnClasses += 'bg-surface border border-surface_border text-gray-400 hover:text-white hover:border-brand-blue/40';
    }

    const icon = isActive 
      ? '<i class="fa-solid fa-circle-check text-white"></i>'
      : (isPast ? '<i class="fa-solid fa-check text-emerald-400 text-[10px]"></i>' : `<span class="w-4 h-4 rounded-full bg-dark/80 flex items-center justify-center text-[9px] text-gray-400 font-bold">${idx + 1}</span>`);

    return `
      <button type="button" onclick="advanceLeadStage('${state.currentLead.id}', '${st.id}', event)" class="${btnClasses}" title="Definir etapa: ${st.name}">
        ${icon}
        <span>${st.name}</span>
      </button>
    `;
  }).join('');
}

function toggleModalStageDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('modal-stage-dropdown-menu');
  if (menu) menu.classList.toggle('hidden');
}

function renderModalStageFooter() {
  if (!state.currentLead) return;

  const currentStage = state.currentLead.stage || 'novo';
  const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === currentStage);
  const currentStageObj = PIPELINE_STAGES[currentIdx] || { name: 'Descoberta' };

  // Atualizar label do botão principal
  const label = document.getElementById('modal-stage-selector-label');
  if (label) {
    label.textContent = `${currentIdx + 1}. ${currentStageObj.name}`;
  }

  // Preencher itens do menu suspenso flutuante
  const menu = document.getElementById('modal-stage-dropdown-menu');
  if (menu) {
    menu.innerHTML = PIPELINE_STAGES.map((st, idx) => {
      const isActive = st.id === currentStage;
      return `
        <button type="button" onclick="selectModalStage('${st.id}', event)" class="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${isActive ? 'bg-brand-blue text-white font-bold shadow-md shadow-brand-blue/30' : 'text-gray-300 hover:bg-white/10 hover:text-white'}">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full ${isActive ? 'bg-white text-brand-blue font-bold' : 'bg-dark text-gray-400'} flex items-center justify-center text-[10px]">${idx + 1}</span>
            <span>${st.name}</span>
          </div>
          ${isActive ? '<i class="fa-solid fa-circle-check text-white text-xs"></i>' : ''}
        </button>
      `;
    }).join('');
  }

  // Atualizar botão de avanço rápido
  const nextStage = currentIdx >= 0 && currentIdx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[currentIdx + 1] : null;
  const quickBtn = document.getElementById('btn-modal-quick-advance');
  const quickText = document.getElementById('modal-quick-advance-text');
  if (quickBtn && quickText) {
    if (nextStage) {
      quickBtn.classList.remove('hidden');
      quickText.textContent = `Avançar para: ${nextStage.name}`;
    } else {
      quickBtn.classList.add('hidden');
    }
  }
}

function selectModalStage(targetStage, e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('modal-stage-dropdown-menu');
  if (menu) menu.classList.add('hidden');
  if (!state.currentLead) return;
  advanceLeadStage(state.currentLead.id, targetStage, e);
}

function advanceCurrentLeadToNextStage(e) {
  if (e) e.stopPropagation();
  if (!state.currentLead) return;

  const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === (state.currentLead.stage || 'novo'));
  if (currentIdx >= 0 && currentIdx < PIPELINE_STAGES.length - 1) {
    const nextStage = PIPELINE_STAGES[currentIdx + 1];
    advanceLeadStage(state.currentLead.id, nextStage.id, e);
  }
}

async function advanceLeadStage(leadId, targetStage, event) {
  if (event) {
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }

  const lead = state.leads.find(l => l.id === leadId);
  if (!lead) return;
  if (lead.stage === targetStage) return;

  const previousStage = lead.stage;

  // Atualização otimista no estado local (leads e currentLead)
  lead.stage = targetStage;
  if (state.currentLead && state.currentLead.id === leadId) {
    state.currentLead.stage = targetStage;
    renderModalStageStepper();
    renderModalStageFooter();
  }

  // Renderizar o Kanban e a Tabela imediatamente
  renderKanban();
  renderTableLeads();
  refreshMetrics();

  try {
    const res = await fetch(`${API_BASE}/leads/${leadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: targetStage })
    });

    if (!res.ok) throw new Error('Falha ao atualizar etapa');

    // Registrar interação
    await fetch(`${API_BASE}/leads/${leadId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'stage_change',
        author: 'Usuário',
        content: `Lead movido para a etapa: ${getStageName(targetStage)}.`
      })
    });

    if (state.currentLead && state.currentLead.id === leadId) {
      if (!state.currentLead.interactions) state.currentLead.interactions = [];
      state.currentLead.interactions.unshift({
        type: 'stage_change',
        author: 'Usuário',
        content: `Lead movido para a etapa: ${getStageName(targetStage)}.`,
        date: new Date().toISOString()
      });
      renderModalInteractions(state.currentLead.interactions);
    }

    showToast('Etapa Atualizada', `Lead movido para "${getStageName(targetStage)}".`, 'success');
  } catch (err) {
    console.error('Erro ao atualizar etapa:', err);
    lead.stage = previousStage;
    if (state.currentLead && state.currentLead.id === leadId) {
      state.currentLead.stage = previousStage;
      renderModalStageStepper();
      renderModalStageFooter();
    }
    renderKanban();
    renderTableLeads();
    refreshMetrics();
    showToast('Erro', 'Não foi possível atualizar a etapa.', 'error');
  }
}

function renderModalInteractions(interactions) {
  const container = document.getElementById('modal-interactions-list');
  if (!container) return;

  container.innerHTML = '';
  if (interactions.length === 0) {
    container.innerHTML = `<p class="text-xs text-gray-500">Nenhuma interação registrada ainda.</p>`;
    return;
  }

  interactions.forEach(int => {
    const div = document.createElement('div');
    div.className = 'p-3 rounded-xl bg-card border border-surface_border text-xs';
    const dateFormatted = new Date(int.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
      <div class="flex justify-between items-center text-gray-400 text-[10px] mb-1">
        <span class="font-bold text-brand-light">${int.author || 'Sistema'}</span>
        <span>${dateFormatted}</span>
      </div>
      <p class="text-gray-200">${int.content}</p>
    `;
    container.appendChild(div);
  });
}

async function addLeadInteraction() {
  const input = document.getElementById('input-new-interaction');
  const text = input.value.trim();
  if (!text || !state.currentLead) return;

  try {
    const res = await fetch(`${API_BASE}/leads/${state.currentLead.id}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'user_note',
        author: 'Usuário',
        content: text
      })
    });

    const data = await res.json();
    if (data.success) {
      if (!state.currentLead.interactions) state.currentLead.interactions = [];
      state.currentLead.interactions.unshift(data.data);
      renderModalInteractions(state.currentLead.interactions);
      input.value = '';
      showToast('Nota Salva', 'Histórico atualizado.', 'success');
    }
  } catch (err) {
    showToast('Erro', 'Não foi possível salvar a nota.', 'error');
  }
}

async function changeLeadStageFromModal(e) {
  const newStage = e.target.value;
  if (!state.currentLead || state.currentLead.stage === newStage) return;
  await advanceLeadStage(state.currentLead.id, newStage, e);
}

async function deleteCurrentLead() {
  if (!state.currentLead) return;
  if (!confirm(`Tem certeza que deseja excluir o lead "${state.currentLead.companyName}"?`)) return;

  const leadId = state.currentLead.id;

  try {
    const res = await fetch(`${API_BASE}/leads/${leadId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();

    state.leads = state.leads.filter(l => l.id !== leadId);
    closeModal('modal-lead-details');
    renderKanban();
    renderTableLeads();
    refreshMetrics();

    showToast('Lead Removido', 'Empresa excluída do CRM.', 'info');
  } catch (err) {
    showToast('Erro', 'Não foi possível remover o lead.', 'error');
  }
}

function copyModalPitch(type) {
  const elementId = type === 'whatsapp' ? 'modal-pitch-whatsapp' : 'modal-pitch-email';
  const text = document.getElementById(elementId).textContent.trim();
  navigator.clipboard.writeText(text);
  showToast('Copiado!', `Texto de ${type} copiado para a área de transferência.`, 'info');
}

// ==========================================
// BASE DE EMPRESAS (TABELA)
// ==========================================
function renderTableLeads() {
  const tbody = document.getElementById('table-leads-body');
  if (!tbody) return;

  const filtered = getFilteredLeads();
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-gray-500 text-xs">
          Nenhuma empresa encontrada com os filtros selecionados.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(lead => {
    const service = getServiceInfo(lead.recommendedServiceId);
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface/60 transition cursor-pointer';
    tr.onclick = (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      openLeadModal(lead.id);
    };

    tr.innerHTML = `
      <td class="py-3 px-4">
        <span class="font-bold text-white block">${lead.tradeName || lead.companyName}</span>
        <span class="text-[11px] text-gray-400">${lead.contactPerson || 'Decisor não informado'}</span>
      </td>
      <td class="py-3 px-4">
        <span class="text-gray-300 block font-medium">${lead.segment || 'Geral'}</span>
        <span class="text-[11px] text-gray-400 block truncate max-w-[200px]" title="${lead.address || (lead.city + ', ' + lead.state)}">
          <i class="fa-solid fa-location-dot text-brand-light mr-1"></i>${lead.address || (lead.city + ', ' + lead.state)}
        </span>
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold badge-service-${lead.recommendedServiceId || 'trafego'}">
          <i class="fa-solid ${service.icon}"></i> ${service.name}
        </span>
      </td>
      <td class="py-3 px-4 text-center">
        <span class="font-bold text-xs ${getScoreBadgeStyle(lead.score)} px-2 py-0.5 rounded-full">
          ${lead.score || 85}%
        </span>
      </td>
      <td class="py-3 px-4">
        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface border border-surface_border text-gray-300">
          ${getStageName(lead.stage)}
        </span>
      </td>
      <td class="py-3 px-4 font-bold text-white">
        R$ ${(lead.estimatedValue || 2500).toLocaleString('pt-BR')}
      </td>
      <td class="py-3 px-4 text-right">
        <button onclick="openLeadModal('${lead.id}')" class="px-3 py-1 bg-surface hover:bg-surface_border border border-surface_border rounded-lg text-xs text-brand-light font-semibold transition">
          Ver Ficha
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function exportCsv() {
  const leads = state.leads;
  if (leads.length === 0) {
    showToast('Atenção', 'Nenhum lead para exportar.', 'warning');
    return;
  }

  const headers = ['ID', 'Empresa', 'Contato', 'WhatsApp', 'Email', 'Cidade', 'UF', 'Segmento', 'ServicoLastro', 'Etapa', 'Valor', 'Score'];
  const rows = leads.map(l => [
    l.id,
    `"${l.companyName || ''}"`,
    `"${l.contactPerson || ''}"`,
    `"${l.whatsapp || ''}"`,
    `"${l.email || ''}"`,
    `"${l.city || ''}"`,
    `"${l.state || ''}"`,
    `"${l.segment || ''}"`,
    `"${l.recommendedServiceId || ''}"`,
    `"${l.stage || ''}"`,
    l.estimatedValue || 0,
    l.score || 0
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `lastro_crm_leads_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==========================================
// ABA DE MÉTRICAS & LOGS
// ==========================================
async function renderMetricsTab() {
  const container = document.getElementById('metrics-service-breakdown');
  const logsContainer = document.getElementById('agent-activity-logs');

  if (container && state.metrics?.serviceCounts) {
    container.innerHTML = '';
    const counts = state.metrics.serviceCounts;
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

    state.services.forEach(svc => {
      const count = counts[svc.id] || 0;
      const pct = Math.round((count / total) * 100);

      const bar = document.createElement('div');
      bar.className = 'space-y-1.5';
      bar.innerHTML = `
        <div class="flex justify-between items-center text-xs">
          <span class="font-bold text-white flex items-center gap-1.5">
            <i class="fa-solid ${svc.icon} text-brand-light"></i> ${svc.name}
          </span>
          <span class="text-gray-400 font-medium">${count} empresas (${pct}%)</span>
        </div>
        <div class="w-full h-2 rounded-full bg-dark border border-surface_border overflow-hidden">
          <div class="h-full bg-gradient-to-r from-brand-blue to-blue-500 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      `;
      container.appendChild(bar);
    });
  }

  // Logs do Agente
  if (logsContainer) {
    try {
      const res = await fetch(`${API_BASE}/hunter/logs`);
      const data = await res.json();
      if (data.success && data.data) {
        logsContainer.innerHTML = '';
        data.data.forEach(log => {
          const div = document.createElement('div');
          div.className = 'p-2.5 rounded-xl bg-card border border-surface_border text-[11px]';
          const time = new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          div.innerHTML = `
            <div class="flex justify-between items-center text-gray-400 mb-0.5">
              <span class="font-bold text-brand-light">${log.action}</span>
              <span class="text-[10px]">${time}</span>
            </div>
            <p class="text-gray-300 leading-snug">${log.details}</p>
          `;
          logsContainer.appendChild(div);
        });
      }
    } catch (e) {
      console.warn('Erro ao carregar logs do agente:', e);
    }
  }
}

// ==========================================
// COPILOTO LASTRO HUNTER (CHAT)
// ==========================================
function toggleCopilotChat() {
  const chatWindow = document.getElementById('copilot-chat-window');
  state.copilotChatOpen = !state.copilotChatOpen;
  if (state.copilotChatOpen) {
    chatWindow.classList.remove('hidden');
    document.getElementById('copilot-input').focus();
  } else {
    chatWindow.classList.add('hidden');
  }
}

function handleCopilotKeyDown(e) {
  if (e.key === 'Enter') {
    sendCopilotMessage();
  }
}

async function sendCopilotMessage() {
  const input = document.getElementById('copilot-input');
  const msg = input.value.trim();
  if (!msg) return;

  const messagesContainer = document.getElementById('copilot-messages');
  
  // Renderizar bolha do usuário
  const userBubble = document.createElement('div');
  userBubble.className = 'flex justify-end gap-2.5';
  userBubble.innerHTML = `
    <div class="bg-brand-blue text-white p-3 rounded-2xl rounded-tr-none text-gray-100 max-w-[85%]">
      ${msg}
    </div>
  `;
  messagesContainer.appendChild(userBubble);
  input.value = '';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Renderizar indicador de digitação
  const typingIndicator = document.createElement('div');
  typingIndicator.id = 'copilot-typing';
  typingIndicator.className = 'flex gap-2.5';
  typingIndicator.innerHTML = `
    <div class="w-6 h-6 rounded-full bg-brand-blue flex-shrink-0 flex items-center justify-center text-[10px] text-white">
      <i class="fa-solid fa-robot"></i>
    </div>
    <div class="bg-card border border-surface_border p-3 rounded-2xl rounded-tl-none text-gray-400 flex items-center gap-1.5">
      <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"></span>
      <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 0.2s"></span>
      <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 0.4s"></span>
    </div>
  `;
  messagesContainer.appendChild(typingIndicator);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const res = await fetch(`${API_BASE}/hunter/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: state.copilotHistory })
    });

    const data = await res.json();
    typingIndicator.remove();

    if (data.success && data.data) {
      const botBubble = document.createElement('div');
      botBubble.className = 'flex gap-2.5';
      botBubble.innerHTML = `
        <div class="w-6 h-6 rounded-full bg-brand-blue flex-shrink-0 flex items-center justify-center text-[10px] text-white">
          <i class="fa-solid fa-robot"></i>
        </div>
        <div class="bg-card border border-surface_border p-3 rounded-2xl rounded-tl-none text-gray-300 leading-relaxed max-w-[85%] whitespace-pre-line">
          ${formatMarkdown(data.data.reply)}
        </div>
      `;
      messagesContainer.appendChild(botBubble);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      state.copilotHistory.push({ role: 'user', content: msg });
      state.copilotHistory.push({ role: 'assistant', content: data.data.reply });
    }
  } catch (err) {
    typingIndicator.remove();
    showToast('Erro no Chat', 'Não foi possível obter resposta do agente.', 'error');
  }
}

function formatMarkdown(text) {
  // Conversor simples para negrito e quebras
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

// ==========================================
// CONFIGURAÇÕES
// ==========================================
function openSettingsModal() {
  const keyInput = document.getElementById('settings-gemini-key');
  const cityInput = document.getElementById('settings-default-city');

  if (state.settings) {
    if (keyInput && state.settings.hasGeminiKey) {
      keyInput.placeholder = 'Chave ativa (••••••••••••••)';
    }
    if (cityInput && state.settings.defaultCity) {
      cityInput.value = state.settings.defaultCity;
    }
  }

  openModal('modal-settings');
}

async function saveSettings() {
  const key = document.getElementById('settings-gemini-key').value.trim();
  const city = document.getElementById('settings-default-city').value.trim();

  const payload = {};
  if (key) payload.geminiApiKey = key;
  if (city) payload.defaultCity = city;

  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      state.settings = data.data;
      closeModal('modal-settings');
      showToast('Configurações Salvas', 'Parâmetros atualizados com sucesso.', 'success');
    }
  } catch (err) {
    showToast('Erro', 'Falha ao salvar configurações.', 'error');
  }
}

// ==========================================
// UTILITÁRIOS, NAVEGAÇÃO & TOASTS
// ==========================================
function switchTab(tabId) {
  state.activeTab = tabId;

  // Atualizar botões do header
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.className = 'tab-btn px-4 py-1.5 rounded-full text-gray-400 hover:text-white transition flex items-center gap-2';
  });
  const activeBtn = document.getElementById(`tab-${tabId}`);
  if (activeBtn) {
    activeBtn.className = 'tab-btn px-4 py-1.5 rounded-full text-white bg-brand-blue transition flex items-center gap-2';
  }

  // Atualizar visibilidade das seções
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.add('hidden');
    section.classList.remove('block');
  });
  const activeSection = document.getElementById(`view-${tabId}`);
  if (activeSection) {
    activeSection.classList.remove('hidden');
    activeSection.classList.add('block');
  }

  if (tabId === 'metrics') {
    renderMetricsTab();
  }
}

function setCityFilter(cityKey) {
  state.activeCityFilter = cityKey;

  document.querySelectorAll('.city-filter-btn').forEach(btn => {
    const btnCity = btn.getAttribute('data-city');
    if (btnCity === cityKey) {
      btn.className = 'city-filter-btn px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-blue text-white transition whitespace-nowrap';
    } else {
      btn.className = 'city-filter-btn px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface border border-surface_border text-gray-400 hover:text-white transition whitespace-nowrap';
    }
  });

  renderKanban();
  renderTableLeads();
}

function setServiceFilter(serviceId) {
  state.activeServiceFilter = serviceId;

  document.querySelectorAll('.service-filter-btn').forEach(btn => {
    const btnService = btn.getAttribute('data-service');
    if (btnService === serviceId) {
      btn.className = 'service-filter-btn px-3 py-1 rounded-lg text-xs font-semibold bg-brand-blue text-white transition whitespace-nowrap';
    } else {
      btn.className = 'service-filter-btn px-3 py-1 rounded-lg text-xs font-semibold bg-surface border border-surface_border text-gray-400 hover:text-white transition whitespace-nowrap';
    }
  });

  renderKanban();
  renderTableLeads();
}

function handleSearchInput(e) {
  state.searchQuery = e.target.value.trim();
  renderKanban();
  renderTableLeads();
}

async function refreshMetrics() {
  try {
    const res = await fetch(`${API_BASE}/metrics`);
    const data = await res.json();
    if (data.success) {
      state.metrics = data.data;
      renderKPIs();
      renderMetricsTab();
    }
  } catch (e) {
    console.warn('Erro ao atualizar métricas:', e);
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    success: 'border-emerald-500/50 bg-emerald-950/90 text-emerald-200',
    error: 'border-red-500/50 bg-red-950/90 text-red-200',
    warning: 'border-amber-500/50 bg-amber-950/90 text-amber-200',
    info: 'border-brand-blue/50 bg-blue-950/90 text-blue-200'
  };

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-triangle-exclamation',
    warning: 'fa-circle-exclamation',
    info: 'fa-circle-info'
  };

  toast.className = `p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-start gap-3 pointer-events-auto transition-all duration-300 transform translate-y-4 opacity-0 max-w-sm ${typeStyles[type] || typeStyles.info}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} mt-0.5 text-base"></i>
    <div class="flex-1 text-xs">
      <strong class="block font-bold">${title}</strong>
      <span class="opacity-90 leading-relaxed">${message}</span>
    </div>
  `;

  container.appendChild(toast);

  // Animar entrada
  setTimeout(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  }, 10);

  // Remover após 4 segundos
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
