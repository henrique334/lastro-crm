const db = require('../db/database');
const hunterService = require('../services/hunterService');

class CrmController {
  // Serviços da Lastro
  getServices(req, res) {
    try {
      const services = db.getServices();
      res.json({ success: true, data: services });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Listagem de Leads
  getLeads(req, res) {
    try {
      const { stage, serviceId, search, sortBy } = req.query;
      const leads = db.getLeads({ stage, serviceId, search, sortBy });
      res.json({ success: true, count: leads.length, data: leads });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Detalhe de um Lead
  getLeadById(req, res) {
    try {
      const lead = db.getLeadById(req.params.id);
      if (!lead) {
        return res.status(404).json({ success: false, error: 'Lead não encontrado.' });
      }
      res.json({ success: true, data: lead });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Criar Lead Manual
  createLead(req, res) {
    try {
      const newLead = db.createLead(req.body);
      res.status(201).json({ success: true, data: newLead });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Atualizar Lead (etapa, notas, valores)
  updateLead(req, res) {
    try {
      const updated = db.updateLead(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Lead não encontrado para atualização.' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Deletar Lead
  deleteLead(req, res) {
    try {
      const success = db.deleteLead(req.params.id);
      if (!success) {
        return res.status(404).json({ success: false, error: 'Lead não encontrado.' });
      }
      res.json({ success: true, message: 'Lead removido com sucesso.' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Adicionar Interação / Histórico
  addInteraction(req, res) {
    try {
      const interaction = db.addInteraction(req.params.id, req.body);
      if (!interaction) {
        return res.status(404).json({ success: false, error: 'Lead não encontrado.' });
      }
      res.status(201).json({ success: true, data: interaction });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Métricas do Dashboard
  getMetrics(req, res) {
    try {
      const metrics = db.getMetrics();
      res.json({ success: true, data: metrics });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Configurações
  getSettings(req, res) {
    try {
      const settings = db.getSettings();
      // Ocultar parcialmente chave se existir por segurança
      const safeSettings = {
        ...settings,
        hasGeminiKey: Boolean(settings.geminiApiKey || process.env.GEMINI_API_KEY)
      };
      res.json({ success: true, data: safeSettings });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  updateSettings(req, res) {
    try {
      const updated = db.updateSettings(req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // --- AGENTE LASTRO HUNTER ---

  // Disparar varredura de prospecção
  async prospect(req, res) {
    try {
      const { niche, city, count } = req.body;
      const candidates = await hunterService.prospect(niche, city, count || 4);
      res.json({ success: true, count: candidates.length, data: candidates });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Cadastrar automaticamente candidatos selecionados ou em lote
  autoRegister(req, res) {
    try {
      const { prospects } = req.body;
      if (!prospects) {
        return res.status(400).json({ success: false, error: 'Lista de prospects é obrigatória.' });
      }
      const registered = hunterService.autoRegisterLeads(prospects);
      res.status(201).json({ success: true, count: registered.length, data: registered });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Análise expressa de 1 empresa por Link ou Nome
  async analyzeSingle(req, res) {
    try {
      const { input, cityHint } = req.body;
      if (!input) {
        return res.status(400).json({ success: false, error: 'Link ou nome da empresa é obrigatório.' });
      }
      const lead = await hunterService.analyzeAndRegisterSingle(input, cityHint);
      res.status(201).json({ success: true, data: lead });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Chat com o Copiloto do Agente
  async chatWithCopilot(req, res) {
    try {
      const { message, history } = req.body;
      if (!message) {
        return res.status(400).json({ success: false, error: 'Mensagem vazia.' });
      }
      const response = await hunterService.copilotChat(message, history);
      res.json({ success: true, data: response });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Logs do Agente
  getAgentLogs(req, res) {
    try {
      const logs = db.getAgentLogs(30);
      res.json({ success: true, data: logs });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new CrmController();
