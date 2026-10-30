const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const crmController = require('./controllers/crmController');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Desativar cache para sempre refletir as alterações no navegador imediatamente
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Servir frontend estático
const frontendDir = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendDir, { etag: false, maxAge: 0 }));

// --- ROTAS DA API ---

// Serviços Lastro
app.get('/api/services', (req, res) => crmController.getServices(req, res));

// Leads / Funil
app.get('/api/leads', (req, res) => crmController.getLeads(req, res));
app.get('/api/leads/:id', (req, res) => crmController.getLeadById(req, res));
app.post('/api/leads', (req, res) => crmController.createLead(req, res));
app.put('/api/leads/:id', (req, res) => crmController.updateLead(req, res));
app.delete('/api/leads/:id', (req, res) => crmController.deleteLead(req, res));
app.post('/api/leads/:id/interactions', (req, res) => crmController.addInteraction(req, res));

// Métricas & Dashboard
app.get('/api/metrics', (req, res) => crmController.getMetrics(req, res));

// Configurações
app.get('/api/settings', (req, res) => crmController.getSettings(req, res));
app.post('/api/settings', (req, res) => crmController.updateSettings(req, res));

// Agente Lastro Hunter
app.post('/api/hunter/prospect', (req, res) => crmController.prospect(req, res));
app.post('/api/hunter/auto-register', (req, res) => crmController.autoRegister(req, res));
app.post('/api/hunter/analyze-single', (req, res) => crmController.analyzeSingle(req, res));
app.post('/api/hunter/chat', (req, res) => crmController.chatWithCopilot(req, res));
app.get('/api/hunter/logs', (req, res) => crmController.getAgentLogs(req, res));

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Inicialização
app.listen(PORT, () => {
  console.log(`
  ======================================================
  🚀 LASTRO CRM & AGENTE HUNTER INICIALIZADO COM SUCESSO!
  ======================================================
  🌐 Painel do CRM: http://localhost:${PORT}
  📡 API Backend:   http://localhost:${PORT}/api/leads
  🤖 Agente Hunter: Ativo e pronto para prospecção
  ======================================================
  `);
});
