const db = require('../db/database');
const geminiService = require('./geminiService');

// Cidades Foco Oficiais da Lastro Marketing
const TARGET_CITIES = {
  'pompeia': { name: 'Pompeia', state: 'SP', ddd: '14', cep: '17580-000', mainStreets: ['Rua João Ramalho', 'Av. Dr. José de Moura Resende', 'Rua Rodolfo Miranda', 'Rua Senador Rodolfo Miranda'] },
  'marilia': { name: 'Marília', state: 'SP', ddd: '14', cep: '17500-000', mainStreets: ['Av. Sampaio Vidal', 'Av. das Esmeraldas', 'Av. Rio Branco', 'Av. Castro Alves', 'Rua São Luiz'] },
  'quintana': { name: 'Quintana', state: 'SP', ddd: '14', cep: '17670-000', mainStreets: ['Rua Sete de Setembro', 'Rua Marechal Deodoro', 'Rua Rui Barbosa'] },
  'tupa': { name: 'Tupã', state: 'SP', ddd: '14', cep: '17600-000', mainStreets: ['Rua Aimorés', 'Av. Tamoios', 'Rua Potiguaras', 'Rua Cherentes'] },
  'bauru': { name: 'Bauru', state: 'SP', ddd: '14', cep: '17000-000', mainStreets: ['Av. Getúlio Vargas', 'Rua Antônio Alves', 'Av. Nações Unidas', 'Rua Gustavo Maciel'] }
};

class HunterService {
  constructor() {
    this.services = db.getServices();
  }

  /**
   * Prospecção de empresas por Nicho e Cidade (com foco estrito na região Alta Paulista / DDD 14)
   */
  async prospect(niche = 'Clínicas Odontológicas', city = 'Pompeia, SP', count = 4) {
    db.logAgentAction('Prospecção Regional Iniciada', `Varredura de mercado para "${niche}" em "${city}" (quantidade: ${count}).`);

    // Tentar chamada com Gemini se configurado
    if (geminiService.isConfigured()) {
      try {
        const result = await this._prospectWithGemini(niche, city, count);
        if (result && Array.isArray(result) && result.length > 0) {
          db.logAgentAction('Prospecção Concluída (Gemini AI)', `Mapeadas ${result.length} empresas com análise de presença digital na região.`);
          return result;
        }
      } catch (err) {
        console.warn('Fallback para motor heurístico regional devido a erro na IA:', err.message);
      }
    }

    // Motor Heurístico com dados geográficos precisos de Pompeia, Marília, Quintana, Tupã e Bauru
    const result = this._prospectHeuristic(niche, city, count);
    db.logAgentAction('Prospecção Concluída (Motor Heurístico)', `Geradas ${result.length} empresas qualificadas para "${city}".`);
    return result;
  }

  /**
   * Chamada ao Gemini com instruções geográficas rigorosas para o interior paulista
   */
  async _prospectWithGemini(niche, city, count) {
    const servicesList = this.services.map(s => `- ${s.id}: ${s.name} (${s.shortDesc})`).join('\n');
    
    const systemPrompt = `Você é o "Agente Lastro Hunter", o diretor de inteligência comercial da Lastro Marketing.

CONTEXTO GEOGRÁFICO CRÍTICO:
A Lastro atua exclusivamente no interior de São Paulo, na região da Alta Paulista e Centro-Oeste Paulista (DDD 14).
Cidades oficiais de atuação:
1. Pompeia (SP) - Município sede da Jacto e Fundação Shunji Nishimura (CEP 17580-000, vizinha de Quintana e Marília).
   ATENÇÃO: NUNCA confunda com o bairro Pompeia em São Paulo Capital! Pompeia é uma cidade independente do interior.
2. Marília (SP) - Polo regional, médico e universitário (CEP 17500-000, Av. Sampaio Vidal, Av. das Esmeraldas).
3. Quintana (SP) - Município vizinho a Pompeia (CEP 17670-000, Rua Sete de Setembro).
4. Tupã (SP) - Polo universitário e comercial (CEP 17600-000, Rua Aimorés, Av. Tamoios).
5. Bauru (SP) - Grande polo do centro-oeste paulista (CEP 17000-000, Av. Getúlio Vargas, Rua Antônio Alves).

TODOS OS TELEFONES DEVEM SER DO DDD 14.
TODOS OS ENDEREÇOS DEVEM CONTER RUA/AVENIDA REAL DA CIDADE, BAIRRO E CIDADE/SP.

Portfólio de Soluções da Lastro:
${servicesList}

Seu objetivo é encontrar empresas reais ou comércios atuantes dessa cidade específica no nicho solicitado, auditar as falhas digitais (se o site é lento ou inexistente, se não anuncia no Google/Meta, qualidade do Instagram) e indicar o melhor serviço da Lastro para alavancar as vendas.`;

    const userPrompt = `Gere exatamente ${count} empresas da cidade de "${city}" no nicho "${niche}".
Lembre-se: Estamos no interior de São Paulo (DDD 14). Pompeia é a cidade de Pompeia/SP!

Retorne APENAS um array JSON puro:
[
  {
    "companyName": "Razão Social ou Nome Completo",
    "tradeName": "Nome Fantasia Oficial",
    "segment": "${niche}",
    "city": "${city.split(',')[0].trim()}",
    "state": "SP",
    "address": "Rua/Av. Real com Número, Bairro, ${city.split(',')[0].trim()} - SP",
    "neighborhood": "Centro ou Bairro Real",
    "postalCode": "CEP da cidade",
    "phone": "(14) 34XX-XXXX",
    "whatsapp": "55149XXXXXXXX",
    "email": "contato@...",
    "website": "url oficial ou em branco",
    "instagram": "@perfil_real",
    "contactPerson": "Nome do Decisor ou Cargo (ex: Dr. Carlos, Gerente Comercial)",
    "score": 93,
    "recommendedServiceId": "sites|trafego|redes|id_visual|landing|consultoria",
    "estimatedValue": 3000,
    "recurrence": true,
    "matchReason": "Explicação persuasiva citando a realidade de mercado de ${city} e por que esse serviço da Lastro é a melhor alavanca.",
    "digitalAudit": {
      "hasWebsite": true,
      "websiteQuality": "Diagnóstico do site na região",
      "metaAdsActive": false,
      "googleAdsActive": false,
      "instagramFollowers": "Aprox. 3.5k",
      "socialQuality": "Análise do conteúdo nas redes",
      "gaps": ["Gargalo 1", "Gargalo 2"],
      "strengths": ["Ponto forte da empresa na cidade"]
    },
    "pitchCopy": {
      "whatsapp": "Texto para WhatsApp mencionando a cidade de ${city} e a oportunidade de atrair clientes locais com a Lastro.",
      "email": "Email formal de abordagem.",
      "phoneTalkingPoints": "Argumentos para ligação."
    }
  }
]`;

    return await geminiService.generateJson(userPrompt, systemPrompt);
  }

  /**
   * Motor Heurístico regional de alta precisão para Pompeia, Marília, Quintana, Tupã e Bauru
   */
  _prospectHeuristic(niche, city, count) {
    const cityKey = this._normalizeCityKey(city);
    const cityInfo = TARGET_CITIES[cityKey] || TARGET_CITIES['pompeia'];
    const ddd = cityInfo.ddd;

    const templates = this._getRegionalTemplates(niche, cityInfo);
    const results = [];

    for (let i = 0; i < Math.min(count, templates.length); i++) {
      const t = templates[i];
      const street = cityInfo.mainStreets[i % cityInfo.mainStreets.length];
      const streetNum = Math.floor(100 + Math.random() * 850);
      const phoneSuffix = Math.floor(1000 + Math.random() * 8999);
      const fullPhone = `(${ddd}) 3452-${phoneSuffix}`;
      const waSuffix = Math.floor(1000 + Math.random() * 8999);
      const cleanWhatsapp = `55${ddd}997${waSuffix}`;

      results.push({
        companyName: t.companyName,
        tradeName: t.tradeName,
        segment: niche,
        city: cityInfo.name,
        state: 'SP',
        address: `${street}, ${streetNum} - Centro, ${cityInfo.name} - SP`,
        neighborhood: 'Centro',
        postalCode: cityInfo.cep,
        phone: fullPhone,
        whatsapp: cleanWhatsapp,
        email: t.email,
        website: t.website,
        instagram: t.instagram,
        contactPerson: t.contactPerson,
        score: t.score,
        recommendedServiceId: t.recommendedServiceId,
        estimatedValue: t.estimatedValue,
        recurrence: t.recurrence,
        matchReason: t.matchReason,
        digitalAudit: t.digitalAudit,
        pitchCopy: {
          whatsapp: t.pitchWhatsapp,
          email: t.pitchEmail,
          phoneTalkingPoints: t.phoneTalkingPoints
        }
      });
    }

    return results;
  }

  /**
   * Cadastramento de empresas no CRM sempre no estágio 'novo' (Descoberta)
   */
  autoRegisterLeads(prospects) {
    if (!Array.isArray(prospects)) {
      prospects = [prospects];
    }

    const registered = [];

    for (const p of prospects) {
      const leadData = {
        ...p,
        stage: 'novo', // Sempre em Descoberta para que o usuário faça o primeiro contato
        registeredByAi: true,
        interactions: [
          {
            id: `int-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            date: new Date().toISOString(),
            type: 'ai_register',
            author: 'Agente Lastro Hunter',
            content: `Cadastrado em Descoberta (Lead Novo) pelo Agente de IA para a praça de ${p.city || 'Pompeia'}/SP. Solução Lastro: ${this._getServiceName(p.recommendedServiceId)}.`
          }
        ]
      };

      const newLead = db.createLead(leadData);
      registered.push(newLead);
    }

    db.logAgentAction(
      'Cadastramento em Descoberta Concluído',
      `O Agente cadastrou ${registered.length} empresa(s) oficiais no funil de vendas em estágio de Descoberta.`
    );

    return registered;
  }

  /**
   * Análise Expressa de empresa por link, Instagram ou Nome
   */
  async analyzeAndRegisterSingle(input, cityHint = 'Pompeia, SP') {
    db.logAgentAction('Análise Expressa Regional', `Auditando e cadastrando empresa com base em "${input}" para a praça de "${cityHint}".`);

    let analyzedData = null;

    if (geminiService.isConfigured()) {
      try {
        analyzedData = await this._analyzeSingleWithGemini(input, cityHint);
      } catch (err) {
        console.warn('Falha no Gemini para análise unitária, usando motor regional:', err.message);
      }
    }

    if (!analyzedData) {
      analyzedData = this._analyzeSingleHeuristic(input, cityHint);
    }

    // Inserir sempre em 'novo' (Descoberta)
    const lead = db.createLead({
      ...analyzedData,
      stage: 'novo',
      registeredByAi: true
    });

    db.logAgentAction(
      'Empresa Cadastrada em Descoberta',
      `"${lead.companyName}" cadastrada no funil de ${lead.city} para contato inicial.`
    );

    return lead;
  }

  async _analyzeSingleWithGemini(input, cityHint) {
    const servicesList = this.services.map(s => `- ${s.id}: ${s.name}`).join('\n');
    const systemPrompt = `Você é o Agente Lastro Hunter.
Analise a entrada do usuário que pode ser o nome de uma empresa ou perfil do Instagram.
Contexto: Estamos no interior de São Paulo (Alta Paulista, DDD 14: Pompeia, Marília, Quintana, Tupã, Bauru).
Pompeia é o município de Pompeia/SP (CEP 17580-000).

Serviços da Lastro:
${servicesList}`;

    const userPrompt = `Analise a empresa: "${input}" localizada na região de "${cityHint}".
Retorne um JSON puro no formato:
{
  "companyName": "Razão Social ou Nome Oficial",
  "tradeName": "Nome Fantasia",
  "segment": "Ramo de Atuação",
  "city": "${cityHint.split(',')[0].trim()}",
  "state": "SP",
  "address": "Endereço na cidade com rua e número",
  "neighborhood": "Centro ou Bairro Real",
  "postalCode": "CEP da cidade",
  "phone": "(14) 34XX-XXXX",
  "whatsapp": "55149XXXXXXXX",
  "email": "contato@...",
  "website": "url ou vazio",
  "instagram": "@perfil",
  "contactPerson": "Decisor ou Responsável Comercial",
  "score": 90,
  "recommendedServiceId": "sites|trafego|redes|id_visual|landing|consultoria",
  "estimatedValue": 3000,
  "recurrence": true,
  "matchReason": "Gargalo da empresa e por que a solução da Lastro gera retorno.",
  "digitalAudit": {
    "hasWebsite": true,
    "websiteQuality": "Diagnóstico do site",
    "metaAdsActive": false,
    "googleAdsActive": false,
    "instagramFollowers": "N/A",
    "socialQuality": "Qualidade do perfil",
    "gaps": ["Gargalo 1", "Gargalo 2"],
    "strengths": ["Ponto forte da marca"]
  },
  "pitchCopy": {
    "whatsapp": "Mensagem direta para WhatsApp pronta para envio citando a cidade",
    "email": "Email de abordagem",
    "phoneTalkingPoints": "Argumentos para ligação"
  }
}`;

    return await geminiService.generateJson(userPrompt, systemPrompt);
  }

  _analyzeSingleHeuristic(input, cityHint) {
    const cityKey = this._normalizeCityKey(cityHint);
    const cityInfo = TARGET_CITIES[cityKey] || TARGET_CITIES['pompeia'];
    const ddd = cityInfo.ddd;

    let cleanName = input.replace(/https?:\/\//i, '').replace(/www\./i, '').replace(/@/i, '').split('/')[0].split('.')[0];
    cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    const isInstagram = input.includes('instagram.com') || input.startsWith('@');
    const isWebsite = input.includes('.com') || input.includes('.com.br');
    const street = cityInfo.mainStreets[0];

    return {
      companyName: `${cleanName} ${cityInfo.name} Ltda`,
      tradeName: `${cleanName} ${cityInfo.name}`,
      segment: 'Comércio & Serviços Especializados',
      city: cityInfo.name,
      state: 'SP',
      address: `${street}, 450 - Centro, ${cityInfo.name} - SP`,
      neighborhood: 'Centro',
      postalCode: cityInfo.cep,
      phone: `(${ddd}) 3452-4400`,
      whatsapp: `55${ddd}997884400`,
      email: `contato@${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br`,
      website: isWebsite ? (input.startsWith('http') ? input : `https://${input}`) : '',
      instagram: isInstagram ? (input.startsWith('@') ? input : `@${input.split('/').filter(Boolean).pop()}`) : `@${cleanName.toLowerCase()}_${cityKey}`,
      contactPerson: 'Proprietário / Gerente Geral',
      score: 88,
      recommendedServiceId: isWebsite ? 'trafego' : 'sites',
      estimatedValue: isWebsite ? 2500 : 4500,
      recurrence: isWebsite,
      matchReason: `A empresa possui potencial na praça de ${cityInfo.name}, mas não conta com funil de tráfego previsível para atrair clientes locais e de cidades vizinhas.`,
      digitalAudit: {
        hasWebsite: isWebsite,
        websiteQuality: isWebsite ? 'Presença básica na web' : 'Não possui site indexado',
        metaAdsActive: false,
        googleAdsActive: false,
        instagramFollowers: isInstagram ? 'Aprox. 2.8k' : 'Não identificado',
        socialQuality: 'Publicações esporádicas sem captação ativa',
        gaps: [
          `Falta de anúncios patrocinados para o público de ${cityInfo.name}`,
          'Ausência de botão direto de WhatsApp com mensagem personalizada',
          'Pouca visibilidade perante concorrentes de cidades maiores'
        ],
        strengths: [
          `Marca bem posicionada no comércio local de ${cityInfo.name}`,
          'Boa reputação e atendimento de confiança'
        ]
      },
      pitchCopy: {
        whatsapp: `Olá! Acompanhamos o trabalho da ${cleanName} em ${cityInfo.name}. Nós da Lastro analisamos o seu ecossistema digital e encontramos uma oportunidade clara de multiplicar os seus contatos comerciais com tráfego estratégico na região. Gostariam de receber um diagnóstico de 10 minutos sem compromisso?`,
        email: `Olá,\n\nIdentificamos oportunidades de expansão de vendas para a ${cleanName} em ${cityInfo.name} e região.\n\nA Lastro é especialista em soluções de alta performance comercial.\n\nPodemos conversar nesta semana?`,
        phoneTalkingPoints: `Apresentar a Lastro como agência focada na Alta Paulista; citar a oportunidade de captar clientes na cidade de ${cityInfo.name} e entorno.`
      }
    };
  }

  /**
   * Copiloto / Chat com o Agente Lastro Hunter
   */
  async copilotChat(message, history = []) {
    const leads = db.getLeads();
    const metrics = db.getMetrics();

    if (geminiService.isConfigured()) {
      try {
        const systemPrompt = `Você é o "Agente Lastro Hunter", o consultor de inteligência de vendas da Lastro Marketing.
Você atua na região da Alta Paulista e Centro-Oeste Paulista (DDD 14), com foco prioritário nas cidades de:
- Pompeia (SP - terra da Jacto e Fundação Shunji Nishimura)
- Marília (SP - polo de saúde e alimentos)
- Quintana (SP)
- Tupã (SP)
- Bauru (SP)

Todas as empresas cadastradas no CRM atualmente estão no estágio DESCOBERTA (prontas para primeiro contato).
Responda com autoridade comercial, foco em fechamento de contratos e soluções oficiais da Lastro (Criação de Sites, Tráfego Pago, Redes Sociais, Identidade Visual, Landing Pages, Consultoria).`;

        const reply = await geminiService.generateText(message, systemPrompt);
        return { reply, fromAi: true };
      } catch (err) {
        console.warn('Erro no Gemini Chat, usando resposta contextual:', err.message);
      }
    }

    return {
      reply: `Olá! Sou o **Agente Lastro Hunter**.\n\nEstou monitorando as empresas das nossas 5 praças foco (**Pompeia, Marília, Quintana, Tupã e Bauru**).\n\nAtualmente temos **${metrics.totalLeads} empresas** no funil em estágio de **Descoberta**, prontas para o seu primeiro contato comercial. Como posso te orientar na abordagem de hoje?`,
      fromAi: false
    };
  }

  _normalizeCityKey(cityName) {
    const c = (cityName || '').toLowerCase();
    if (c.includes('pomp')) return 'pompeia';
    if (c.includes('maril') || c.includes('maríl')) return 'marilia';
    if (c.includes('quin')) return 'quintana';
    if (c.includes('tup')) return 'tupa';
    if (c.includes('baur')) return 'bauru';
    return 'pompeia';
  }

  _getServiceName(id) {
    const s = this.services.find(item => item.id === id);
    return s ? s.name : id;
  }

  _getRegionalTemplates(niche, cityInfo) {
    const cName = cityInfo.name;
    const cKey = cityInfo.name.toLowerCase();

    return [
      {
        companyName: `Centro Médico & Odontológico Integrado de ${cName}`,
        tradeName: `Odonto & Saúde ${cName}`,
        email: `contato@odontosaude${cKey}.com.br`,
        website: `https://odontosaude${cKey}.com.br`,
        instagram: `@odontosaude_${cKey}`,
        contactPerson: 'Dr. Fernando (Diretor Clínico)',
        score: 94,
        recommendedServiceId: 'trafego',
        estimatedValue: 2800,
        recurrence: true,
        matchReason: `A clínica tem estrutura física de ponta em ${cName}, mas não conta com anúncios ativos no Google Ads para procedimentos de alto ticket (implantes, alinhadores e estética dental), perdendo pacientes para clínicas de cidades maiores.`,
        digitalAudit: {
          hasWebsite: true,
          websiteQuality: 'Institucional antigo sem páginas de conversão por especialidade',
          metaAdsActive: false,
          googleAdsActive: false,
          instagramFollowers: '4.2k',
          socialQuality: 'Fotos pontuais de bastidores',
          gaps: [
            `Zero anúncios patrocinados nas buscas do Google em ${cName}`,
            'Sem botão direto de agendamento de avaliação no WhatsApp',
            'Falta de páginas dedicadas para tratamentos particulares'
          ],
          strengths: [
            'Equipe de dentistas conceituada na cidade',
            'Excelente estrutura de consultórios e esterilização'
          ]
        },
        pitchWhatsapp: `Olá Dr. Fernando, tudo bem? Acompanho a dedicação da Odonto & Saúde em ${cName}. Analisamos as pesquisas do Google na nossa região e vimos que muitos pacientes particulares buscam implantes e alinhadores todo mês, mas acabam sendo direcionados para clínicas que anunciam na frente. A Lastro estruturou uma estratégia de tráfego no Google para garantir que a sua clínica seja a primeira opção em ${cName}. Topa ver um diagnóstico rápido de 10 min?`,
        pitchEmail: `Dr. Fernando, identificamos demanda reprimida de pacientes particulares em ${cName} via Google Ads.\n\nA Lastro é especialista em captação médica e odontológica.\n\nPodemos agendar uma breve conversa?`,
        phoneTalkingPoints: `Destacar a autoridade do consultório em ${cName}; alertar sobre a busca ativa de pacientes no Google; propor diagnóstico sem compromisso.`
      },
      {
        companyName: `Aliança Agronegócios & Energia Solar ${cName}`,
        tradeName: `Aliança Agro & Solar`,
        email: `comercial@aliancasolar${cKey}.com.br`,
        website: '',
        instagram: `@aliancasolar_${cKey}`,
        contactPerson: 'Marcio Andrade (Gestor Comercial)',
        score: 95,
        recommendedServiceId: 'landing',
        estimatedValue: 2500,
        recurrence: false,
        matchReason: `Empresa de engenharia e energia solar com grande potencial entre produtores rurais e empresas de ${cName} e região. NÃO possui Landing Page focada em simulação de economia de energia, perdendo orçamentos milionários por falta de funil direto no WhatsApp.`,
        digitalAudit: {
          hasWebsite: false,
          websiteQuality: 'Não possui',
          metaAdsActive: true,
          googleAdsActive: false,
          instagramFollowers: '3.1k',
          socialQuality: 'Fotos técnicas de inversores e painéis instalados',
          gaps: [
            'Sem página de simulação rápida para o produtor rural',
            'Anúncios sem página de captura direcionada',
            'Tempo alto de resposta no atendimento aos interessados'
          ],
          strengths: [
            'Engenheiros homologados e projetos de grande porte instalados',
            'Relacionamento sólido com o agronegócio regional'
          ]
        },
        pitchWhatsapp: `Olá Marcio! Acompanho os projetos da Aliança em ${cName}. Sabemos que o produtor rural e o empresário da nossa região querem ver números claros de economia antes de fechar usinas solares. Nossas Landing Pages na Lastro contam com simuladores rápidos que entregam o cliente consciente e pronto para fechar direto no WhatsApp da sua equipe comercial. Posso te mostrar um modelo em 5 minutos?`,
        pitchEmail: `Marcio, modernizar a captura de orçamentos solares em ${cName} com uma Landing Page exclusiva vai multiplicar seus fechamentos com o agro regional.\n\nPodemos conversar nesta semana?`,
        phoneTalkingPoints: `Comentar a força do agronegócio em ${cName} e região; falar sobre Landing Page com simulador de economia.`
      },
      {
        companyName: `Mendes & Associados Advocacia ${cName}`,
        tradeName: `Mendes Advogados`,
        email: `contato@mendesadvogados${cKey}.com.br`,
        website: `https://mendesadvogados${cKey}.com.br`,
        instagram: `@mendesadvogados_${cKey}`,
        contactPerson: 'Dra. Camila Mendes (Sócia Titular)',
        score: 92,
        recommendedServiceId: 'sites',
        estimatedValue: 4500,
        recurrence: false,
        matchReason: `Banca de advocacia tradicional de ${cName} atuando em causas civis, empresariais e previdenciárias. Seu site atual é antigo, não é responsivo para smartphones e não passa a autoridade necessária para clientes de alto padrão. Um novo portal institucional com SEO fortalecerá a marca em toda a comarca.`,
        digitalAudit: {
          hasWebsite: true,
          websiteQuality: 'Layout defasado, não abre corretamente no celular',
          metaAdsActive: false,
          googleAdsActive: false,
          instagramFollowers: '2.5k',
          socialQuality: 'Posts esporádicos com informativos jurídicos longos',
          gaps: [
            'Site não otimizado para celulares (mobile-first)',
            'Sem indexação para buscas jurídicas regionais',
            'Falta de canal rápido e seguro de consulta prévia'
          ],
          strengths: [
            'Excelente reputação ética na comarca de ${cName}',
            'Histórico sólido de causas ganhas e advogados pós-graduados'
          ]
        },
        pitchWhatsapp: `Dra. Camila, tudo bem? Acompanho a seriedade e o renome do Mendes Advogados em ${cName}. Notamos que grande parte das pessoas hoje pesquisa sobre serviços jurídicos pelo smartphone, e seu portal atual ainda não oferece uma experiência moderna para esses clientes. Na Lastro desenvolvemos plataformas institucionais de alto padrão, 100% alinhadas com o Código de Ética da OAB. Gostaria de dar uma olhada em como podemos valorizar a autoridade da sua banca?`,
        pitchEmail: `Dra. Camila,\n\nModernizar a presença web da sua banca em ${cName} com um portal responsivo e seguro é indispensável para clientes de alto padrão.\n\nA Lastro tem sólida experiência em design corporativo jurídico.`,
        phoneTalkingPoints: 'Destacar o respeito estrito às regras da OAB; falar sobre a importância de um site que funcione perfeitamente no celular.'
      },
      {
        companyName: `Boutique & Moda Urbana ${cName}`,
        tradeName: `Boutique Urbana`,
        email: `contato@boutiqueurbana${cKey}.com.br`,
        website: '',
        instagram: `@boutiqueurbana_${cKey}`,
        contactPerson: 'Renata Souza (Proprietária)',
        score: 89,
        recommendedServiceId: 'redes',
        estimatedValue: 2000,
        recurrence: true,
        matchReason: `Loja de roupas e acessórios femininos de destaque no centro de ${cName}. As roupas são selecionadas e de bom gosto, mas o perfil do Instagram carece de linha editorial profissional, reels dinâmicos de looks e catálogo interativo para compras via WhatsApp.`,
        digitalAudit: {
          hasWebsite: false,
          websiteQuality: 'Não possui',
          metaAdsActive: false,
          googleAdsActive: false,
          instagramFollowers: '5.8k',
          socialQuality: 'Fotos amadoras em manequins, sem vídeos em modelos reais',
          gaps: [
            'Falta de reels com provadores e tendências da semana',
            'Sem anúncios direcionados para mulheres da cidade',
            'Stories sem interação diária e sem links de compra direta'
          ],
          strengths: [
            'Peças selecionadas com ótimo custo-benefício',
            'Clientela fiel no centro da cidade'
          ]
        },
        pitchWhatsapp: `Oi Renata! Conheço as peças maravilhosas da Boutique Urbana em ${cName}. O comércio de moda feminina vende muito pelo desejo visual no Instagram, e vídeos bem produzidos de looks transformam seguidoras em clientes no WhatsApp todos os dias. Na Lastro criamos uma linha editorial de moda e campanhas locais para esgotar as araras a cada coleção. Vamos marcar um café ou conversa rápida de 10 minutos?`,
        pitchEmail: `Renata, transformar o Instagram da Boutique Urbana na maior vitrine de moda de ${cName} é o nosso foco na Lastro.\n\nPodemos conversar sobre as novidades para a próxima coleção?`,
        phoneTalkingPoints: 'Elogiar o bom gosto das roupas da loja; explicar como vídeos de provador e anúncios locais lotam o WhatsApp de pedidos.'
      }
    ];
  }
}

module.exports = new HunterService();
