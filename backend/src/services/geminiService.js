const db = require('../db/database');

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-pro',
  'gemini-3.5-flash'
];

class GeminiService {
  /**
   * Obtém a chave de API configurada no banco ou no ambiente
   */
  getApiKey() {
    const settings = db.getSettings();
    return settings.geminiApiKey || process.env.GEMINI_API_KEY || '';
  }

  /**
   * Verifica se a API do Gemini está habilitada com chave válida
   */
  isConfigured() {
    return Boolean(this.getApiKey().trim());
  }

  /**
   * Executa chamada à API oficial do Gemini com fallback automático entre modelos
   */
  async generateText(prompt, systemInstruction = '', preferredModel = 'gemini-2.5-flash') {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Chave de API Gemini não configurada.');
    }

    const modelsToTry = [preferredModel, ...FALLBACK_MODELS.filter(m => m !== preferredModel)];
    let lastError = null;

    for (const model of modelsToTry) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95
        }
      };

      if (systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro API Gemini (${response.status} com ${model}): ${errorText}`);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('Resposta vazia da API do Gemini.');
        }

        return text;
      } catch (err) {
        lastError = err;
        console.warn(`Tentativa com modelo ${model} falhou:`, err.message);
        // Continuar para o próximo modelo da lista
      }
    }

    throw lastError || new Error('Todos os modelos Gemini falharam temporariamente.');
  }

  /**
   * Executa geração estruturada em JSON usando Gemini
   */
  async generateJson(prompt, systemInstruction = '', model = 'gemini-2.5-flash') {
    const fullPrompt = `${prompt}\n\nIMPORTANTE: Retorne APENAS um objeto JSON válido, sem blocos de markdown ou explicações externas.`;
    const text = await this.generateText(fullPrompt, systemInstruction, model);
    
    // Limpar possíveis crases de markdown ```json ... ```
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    return JSON.parse(cleaned);
  }
}

module.exports = new GeminiService();
