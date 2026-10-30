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
    
    const systemPrompt = `Você é o "Agente Lastro Hunter", diretor de inteligência comercial da Lastro Marketing.

REGRA ABSOLUTA DE SEGMENTO / NICHO (PRIORIDADE MÁXIMA):
O usuário solicitou empresas ESTRITAMENTE do nicho: "${niche}".
TODAS as empresas geradas DEVEM pertencer rigorosa e exclusivamente a esse ramo!
- Se pediu "lojas de roupas" ou "moda": gere APENAS lojas de roupas, confecções, boutiques, moda feminina/masculina. NUNCA retorne médicos, advogados ou agro!
- Se pediu "mercados" ou "supermercados": gere APENAS supermercados, mercearias, hortifrutis ou empórios.
- Se pediu "loja de sapatos" ou "calçados": gere APENAS sapatarias, lojas de tênis ou calçados.
- Se pediu qualquer outro nicho específico: siga 100% esse nicho.

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

Seu objetivo é encontrar empresas e comércios dessa cidade no nicho solicitado "${niche}", auditar as falhas digitais e indicar o melhor serviço da Lastro.`;

    const userPrompt = `Gere exatamente ${count} empresas da cidade de "${city}" que pertençam OBRIGATORIAMENTE ao nicho "${niche}".
Lembre-se: Estamos no interior de São Paulo (DDD 14). Pompeia é o município independente de Pompeia/SP!
Todas as empresas devem ser EXCLUSIVAMENTE do ramo de "${niche}".

Retorne APENAS um array JSON puro:
[
  {
    "companyName": "Razão Social ou Nome Completo do Comércio",
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
    "contactPerson": "Nome do Decisor ou Cargo (ex: Gerente Comercial, Proprietário)",
    "score": 93,
    "recommendedServiceId": "sites|trafego|redes|id_visual|landing|consultoria",
    "estimatedValue": 3000,
    "recurrence": true,
    "matchReason": "Explicação persuasiva citando a realidade do mercado de ${city} para o nicho de ${niche} e por que a Lastro gera vendas.",
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
      "whatsapp": "Texto para WhatsApp mencionando a cidade de ${city} e o nicho de ${niche}.",
      "email": "Email formal de abordagem para o nicho ${niche}.",
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

    const templates = this._getRegionalTemplates(niche, cityInfo, count);
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

  _getRegionalTemplates(niche, cityInfo, count = 4) {
    const cName = cityInfo.name;
    const cKey = cityInfo.name.toLowerCase();
    const cleanNiche = (niche || '').trim();
    const n = cleanNiche.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1. ROUPAS / MODA / VESTUÁRIO / BOUTIQUES
    if (n.match(/roupa|moda|vestu|boutique|confecc|lingerie|jeans|alfaiat|look|camis|estilo/i)) {
      return [
        {
          companyName: `Boutique Bella Donna ${cName}`,
          tradeName: `Bella Donna Moda Feminina`,
          email: `contato@belladonna${cKey}.com.br`,
          website: '',
          instagram: `@belladonna_${cKey}`,
          contactPerson: 'Juliana Ramos (Proprietária & Estilista)',
          score: 93,
          recommendedServiceId: 'redes',
          estimatedValue: 2000,
          recurrence: true,
          matchReason: `Loja de moda feminina com peças exclusivas no centro de ${cName}. Seu perfil no Instagram carece de linha editorial com provadores reais (Reels) e catálogo de looks no WhatsApp, perdendo vendas locais para e-commerces.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui catálogo online',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '4.8k',
            socialQuality: 'Fotos em manequins estáticos sem dinamismo',
            gaps: [
              'Sem vídeos curtos (Reels) de provador mostrando as roupas no corpo',
              `Falta de anúncios no Meta Ads direcionados para mulheres de ${cName} e região`,
              'Ausência de catálogo interativo no WhatsApp para envio rápido de novidades'
            ],
            strengths: [
              'Curadoria de roupas com excelente acabamento e tecidos nobres',
              `Atendimento presencial de confiança e clientela fiel em ${cName}`
            ]
          },
          pitchWhatsapp: `Oi Juliana, tudo bem? Acompanhamos as novidades lindas da Bella Donna em ${cName}. No varejo de moda, vídeos de provador no Reels e catálogo no WhatsApp fazem as araras esgotarem em dias de lançamento. Na Lastro criamos uma linha editorial de moda e anúncios locais para atrair compradoras da cidade toda semana. Podemos bater um papo rápido de 10 minutinhos?`,
          pitchEmail: `Juliana,\n\nTransformar o Instagram da Bella Donna na vitrine de moda mais desejada de ${cName} é a especialidade da Lastro.\n\nPodemos conversar sobre as novidades da próxima coleção?`,
          phoneTalkingPoints: `Elogiar a curadoria da loja em ${cName}; destacar como vídeos de provador e anúncios locais aumentam os pedidos no WhatsApp.`
        },
        {
          companyName: `Estilo & Forma Moda Homem ${cName}`,
          tradeName: `Estilo Homem Vestuário`,
          email: `comercial@estilohomem${cKey}.com.br`,
          website: `https://estilohomem${cKey}.com.br`,
          instagram: `@estilohomem_${cKey}`,
          contactPerson: 'Rodrigo Alencar (Gerente Comercial)',
          score: 91,
          recommendedServiceId: 'trafego',
          estimatedValue: 2500,
          recurrence: true,
          matchReason: `Loja de moda masculina (casual, alfaiataria e jeans) conceituada em ${cName}. Não possui tráfego pago ativo para divulgar marcas e trajes sociais para eventos e trabalho na região da Alta Paulista.`,
          digitalAudit: {
            hasWebsite: true,
            websiteQuality: 'Institucional básico sem e-commerce ativo',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '3.9k',
            socialQuality: 'Postagens espaçadas sem ofertas ativas',
            gaps: [
              `Zero anúncios no Google Ads para buscas de roupas masculinas e ternos em ${cName}`,
              'Sem campanhas de geolocalização no Instagram para o público masculino',
              'Falta de integração entre vitrine e atendimento WhatsApp'
            ],
            strengths: [
              'Marcas consagradas de vestuário e calçados masculinos',
              'Ponto comercial tradicional e bem localizado'
            ]
          },
          pitchWhatsapp: `Olá Rodrigo! Vimos o excelente padrão da Estilo Homem em ${cName}. O público masculino busca praticidade e quer ver a peça e o preço direto no WhatsApp. Na Lastro estruturamos tráfego pago geolocalizado para colocar seus trajes e roupas casuais na frente dos homens de ${cName} e cidades vizinhas. Quer conhecer nossa estratégia sem compromisso?`,
          pitchEmail: `Rodrigo, atrair clientes de alto poder aquisitivo em ${cName} com anúncios direcionados é o foco da Lastro.\n\nPodemos agendar uma breve demonstração?`,
          phoneTalkingPoints: `Citar a força do vestuário masculino na praça de ${cName}; demonstrar a perda de vendas sem anúncios pagos.`
        },
        {
          companyName: `Vitrine da Moda & Acessórios ${cName}`,
          tradeName: `Vitrine Multimarcas`,
          email: `contato@vitrinemoda${cKey}.com.br`,
          website: '',
          instagram: `@vitrinemoda_${cKey}`,
          contactPerson: 'Carla Mendes (Sócia Proprietária)',
          score: 94,
          recommendedServiceId: 'landing',
          estimatedValue: 2500,
          recurrence: false,
          matchReason: `Loja de roupas multimarcas com alto volume de novidades semanais em ${cName}. Carece de uma Landing Page com vitrine dinâmica para lançamentos de coleção integrada ao WhatsApp de cada vendedora.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '5.2k',
            socialQuality: 'Publica stories frequentemente mas sem link direto de compra',
            gaps: [
              'Sem página de coleção com botão de compra no WhatsApp',
              'Falta de campanhas de tráfego para queima de estoque e trocas de estação',
              'Atendimento comercial desorganizado sem roteamento de vendedoras'
            ],
            strengths: [
              'Mix diversificado de vestidos, blusas e acessórios modernos',
              'Excelente engajamento orgânico nas redes locais'
            ]
          },
          pitchWhatsapp: `Olá Carla! Acompanho os lançamentos da Vitrine Multimarcas em ${cName}. Criamos Landing Pages com vitrine interativa para lojas de roupas onde o cliente clica na foto do look e já abre a conversa no WhatsApp da vendedora pronta para comprar. Podemos te mostrar um exemplo funcionando?`,
          pitchEmail: `Carla, modernizar a vitrine digital da Vitrine Multimarcas em ${cName} vai acelerar o fechamento de vendas com as clientes locais.\n\nPodemos conversar nesta semana?`,
          phoneTalkingPoints: `Apresentar a facilidade de compra via vitrine digital no WhatsApp; sugerir melhoria de conversão.`
        },
        {
          companyName: `Ponto da Moda Casual & Jeans ${cName}`,
          tradeName: `Ponto da Moda ${cName}`,
          email: `atendimento@pontodamoda${cKey}.com.br`,
          website: '',
          instagram: `@pontodamoda_${cKey}`,
          contactPerson: 'Marcos Vinicius (Proprietário)',
          score: 89,
          recommendedServiceId: 'sites',
          estimatedValue: 4500,
          recurrence: false,
          matchReason: `Comércio popular de confecções, calças jeans, camisetas e moda família no polo comercial de ${cName}. Não possui presença em pesquisas do Google e perde visibilidade para magazines da região.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui presença na web',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '2.8k',
            socialQuality: 'Perfil comercial com fotos simples de produtos',
            gaps: [
              `Sem site indexado no Google para compras de roupas em ${cName}`,
              'Google Perfil de Empresa sem fotos atualizadas e sem catálogo',
              'Falta de anúncios sazonais (Dia dos Pais, Mães, Black Friday)'
            ],
            strengths: [
              'Preços competitivos e variedades para toda a família',
              'Localização privilegiada de fácil acesso'
            ]
          },
          pitchWhatsapp: `Olá Marcos, tudo bem? Acompanhamos o movimento do Ponto da Moda em ${cName}. Quem pesquisa por roupas e moda na cidade hoje não encontra o Ponto da Moda no topo das buscas do Google. Na Lastro criamos uma presença digital completa para sua loja dominar as pesquisas locais. Vamos conversar 10 minutos?`,
          pitchEmail: `Marcos, colocar o Ponto da Moda no topo das buscas em ${cName} vai gerar fluxo diário de clientes.\n\nPodemos agendar uma reunião?`,
          phoneTalkingPoints: `Destacar o alto volume de buscas por roupas na região e a falta de visibilidade do Ponto da Moda no Google.`
        },
        {
          companyName: `Espaço Chic Moda Festa & Elegance ${cName}`,
          tradeName: `Espaço Chic Boutique`,
          email: `contato@espacochic${cKey}.com.br`,
          website: '',
          instagram: `@espacochic_${cKey}`,
          contactPerson: 'Fernanda Toledo (Diretora Criativa)',
          score: 95,
          recommendedServiceId: 'redes',
          estimatedValue: 2000,
          recurrence: true,
          matchReason: `Ateliê e boutique de vestidos de festa, alfaiataria e moda elegante em ${cName}. Produto de altíssimo ticket que necessita de presença visual impecável e vídeos cinematográficos para atrair formandas, madrinhas e convidadas da comarca.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '6.1k',
            socialQuality: 'Fotos sem iluminação adequada, desvalorizando os tecidos',
            gaps: [
              'Falta de vídeos em alta definição destacando detalhes e caimento',
              `Sem campanhas no Meta Ads para mulheres de 25 a 55 anos em ${cName} e cidades vizinhas`,
              'Ausência de sistema de agendamento prévio de prova via WhatsApp'
            ],
            strengths: [
              'Peças exclusivas de alta costura e acabamento fino',
              'Atendimento personalizado com hora marcada'
            ]
          },
          pitchWhatsapp: `Fernanda, seus vestidos de festa no Espaço Chic são verdadeiras obras de arte! Vestidos de alto padrão exigem um posicionamento visual à altura para encantar madrinhas e formandas de ${cName} e região. Na Lastro cuidamos da identidade das redes sociais e campanhas para atrair clientes de alto valor. Posso te apresentar nosso portfólio de moda?`,
          pitchEmail: `Fernanda, posicionar o Espaço Chic como a principal referência de moda festa da comarca de ${cName} é o objetivo da nossa equipe na Lastro.\n\nPodemos conversar?`,
          phoneTalkingPoints: `Valorizar as peças de festa da loja; demonstrar como madrinhas de toda a região contratam através do Instagram.`
        },
        {
          companyName: `Donna Bella Confecções & Looks ${cName}`,
          tradeName: `Donna Bella Moda`,
          email: `contato@donnabella${cKey}.com.br`,
          website: '',
          instagram: `@donnabella_${cKey}`,
          contactPerson: 'Renata Vasconcelos (Gerente Geral)',
          score: 92,
          recommendedServiceId: 'trafego',
          estimatedValue: 2500,
          recurrence: true,
          matchReason: `Loja de roupas femininas com forte apelo em moda jovem, croppeds, vestidos e conjuntos em ${cName}. Tem demanda reprimida mas não investe em anúncios pagos no Instagram.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '4.5k',
            socialQuality: 'Stories informais com pouca chamada para ação',
            gaps: [
              'Sem anúncios patrocinados para novidades da semana',
              'Falta de link na bio com catálogo dinâmico de compras',
              'Baixa taxa de conversão de seguidoras em compras reais'
            ],
            strengths: [
              'Estoque sempre renovado com peças que estão em alta',
              'Preços atrativos e ótima aceitação do público local'
            ]
          },
          pitchWhatsapp: `Oi Renata! Vemos que a Donna Bella tem looks que a mulherada de ${cName} ama. O segredo para dobrar as vendas é colocar esses looks na frente de quem está com o celular na mão na cidade através de anúncios patrocinados. Na Lastro geramos dezenas de mensagens diárias no WhatsApp de lojas de moda parceiras. Topa conhecer como funciona?`,
          pitchEmail: `Renata, transformar os looks da Donna Bella em pedidos contínuos no WhatsApp de ${cName} é a proposta da Lastro.\n\nPodemos falar brevemente?`,
          phoneTalkingPoints: `Explicar como o tráfego pago atrai pessoas da cidade inteira direto para o WhatsApp da loja.`
        }
      ];
    }

    // 2. MERCADOS / SUPERMERCADOS / MERCEARIAS / HORTIFRUTI
    if (n.match(/mercado|supermercado|mercearia|hortifruti|acougue|emporio|padaria|varej.*aliment|conveniencia/i)) {
      return [
        {
          companyName: `Supermercado Bom Preço de ${cName}`,
          tradeName: `Supermercado Bom Preço`,
          email: `comercial@bompreco${cKey}.com.br`,
          website: `https://bompreco${cKey}.com.br`,
          instagram: `@bompreco_${cKey}`,
          contactPerson: 'Ademir Silveira (Diretor de Operações)',
          score: 95,
          recommendedServiceId: 'trafego',
          estimatedValue: 2800,
          recurrence: true,
          matchReason: `Supermercado varejista consolidado em ${cName}. Gasta alto com tabloides impressos em papel que têm baixo retorno, sem anunciar as ofertas do dia (feira da quarta e final de semana de carnes) no Meta Ads e Google para as famílias da cidade.`,
          digitalAudit: {
            hasWebsite: true,
            websiteQuality: 'Site estático sem folheto de ofertas atualizado',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '5.1k',
            socialQuality: 'Encartes postados em baixa resolução',
            gaps: [
              `Falta de anúncios geolocalizados nas quartas de feira e sextas de carne em ${cName}`,
              'Sem grupo VIP de ofertas no WhatsApp com captação automatizada',
              'Dependência excessiva de panfletagem impressa de alto custo'
            ],
            strengths: [
              'Açougue completo e hortifruti fresco com procedência',
              'Amplo estacionamento e preferência de compras das famílias'
            ]
          },
          pitchWhatsapp: `Olá Ademir! Vimos o trabalho sério do Bom Preço em ${cName}. Hoje a maioria das donas de casa e famílias da cidade decide onde comprar olhando o celular. Em vez de gastar milhares de reais com panfleto de papel, nossa estratégia de tráfego local coloca o encarte digital nas redes e no WhatsApp das famílias de ${cName}. Podemos te mostrar em 10 minutos como outros mercados aumentaram as vendas?`,
          pitchEmail: `Ademir, substituir o custo de panfletagem por campanhas digitais de alto impacto para o Supermercado Bom Preço em ${cName} é a especialidade da Lastro.\n\nPodemos conversar nesta semana?`,
          phoneTalkingPoints: `Destacar a economia gerada ao substituir panfletos por anúncios digitais no dia da feira e final de semana.`
        },
        {
          companyName: `Empório & Mercearia Central ${cName}`,
          tradeName: `Empório Central`,
          email: `contato@emporiocentral${cKey}.com.br`,
          website: '',
          instagram: `@emporiocentral_${cKey}`,
          contactPerson: 'Renato Faria (Proprietário)',
          score: 91,
          recommendedServiceId: 'redes',
          estimatedValue: 2000,
          recurrence: true,
          matchReason: `Mercearia gourmet e empório com produtos coloniais, queijos da Serra da Canastra, vinhos e cortes especiais em ${cName}. Carece de presença visual apetitosa nas redes para atrair apreciadores de boa gastronomia.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '3.4k',
            socialQuality: 'Fotos casuais de prateleiras sem produção',
            gaps: [
              'Sem vídeos destacando degustações, queijos especiais e rótulos de vinho',
              `Falta de anúncios patrocinados para o público de padrão médio e alto de ${cName}`,
              'Sem canal de encomendas de tábuas de frios no WhatsApp'
            ],
            strengths: [
              'Produtos diferenciados e atendimento cortês de empório tradicional',
              'Qualidade ímpar de frios e bebidas seletas'
            ]
          },
          pitchWhatsapp: `Oi Renato! Os produtos do Empório Central em ${cName} são incríveis e dão água na boca. Na Lastro criamos uma linha de conteúdo gastronômico e anúncios para clientes de alto padrão da cidade encomendarem vinhos, queijos e tábuas toda semana pelo WhatsApp. Vamos marcar uma conversa rápida de 10 minutos?`,
          pitchEmail: `Renato, transformar o Empório Central no destino gastronômico mais desejado de ${cName} é a nossa proposta.\n\nPodemos conversar?`,
          phoneTalkingPoints: `Elogiar a seleção de frios e vinhos; explicar como o visual do Instagram impulsiona vendas de produtos nobres.`
        },
        {
          companyName: `Supermercado Aliança da Família ${cName}`,
          tradeName: `Supermercado Aliança`,
          email: `comercial@alianca${cKey}.com.br`,
          website: '',
          instagram: `@alianca_${cKey}`,
          contactPerson: 'Cláudio Morais (Gerente Geral)',
          score: 93,
          recommendedServiceId: 'landing',
          estimatedValue: 2500,
          recurrence: false,
          matchReason: `Mercado de bairro de médio porte com grande fluxo de clientes em ${cName}. Necessita de uma página de captação de clientes para Clube de Descontos e envio automático de ofertas no WhatsApp.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '2.9k',
            socialQuality: 'Pouca interação e postagens de encartes sem links',
            gaps: [
              'Sem página de captura para cadastro no Clube de Descontos',
              'Falta de canal direto para lista de transmissão de promoções',
              `Invisível para novos moradores que chegam aos bairros de ${cName}`
            ],
            strengths: [
              'Excelente localização em avenida de grande circulação',
              'Preços acessíveis em itens da cesta básica'
            ]
          },
          pitchWhatsapp: `Olá Cláudio! Conhecemos o movimento do Supermercado Aliança em ${cName}. Hoje os mercados mais modernos estão criando Clubes de Ofertas no WhatsApp para avisar os clientes das promoções antes que eles comprem no concorrente. Na Lastro desenvolvemos essa página de cadastro em poucos dias. Quer ver um exemplo funcionando?`,
          pitchEmail: `Cláudio, implantar o Clube de Ofertas no WhatsApp do Supermercado Aliança em ${cName} vai fidelizar clientes dos bairros vizinhos.\n\nPodemos falar brevemente?`,
          phoneTalkingPoints: `Falar sobre fidelização de clientes e envio de encartes no WhatsApp.`
        },
        {
          companyName: `Hortifruti & Quitanda Sabor da Terra ${cName}`,
          tradeName: `Quitanda Sabor da Terra`,
          email: `contato@sabordaterra${cKey}.com.br`,
          website: '',
          instagram: `@sabordaterra_${cKey}`,
          contactPerson: 'Vânia Cristina (Proprietária)',
          score: 90,
          recommendedServiceId: 'trafego',
          estimatedValue: 2000,
          recurrence: true,
          matchReason: `Quitanda e hortifruti com frutas selecionadas e legumes higienizados em ${cName}. Não anuncia os dias de entrega de produtos frescos da roça, perdendo vendas para grandes redes.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '2.1k',
            socialQuality: 'Fotos simples de bancadas sem chamadas de ação',
            gaps: [
              'Sem anúncios locais nos dias de reposição de frutas e verduras frescas',
              'Falta de delivery programado de cestas semanais de hortifruti',
              'Sem integração com WhatsApp para reservas de encomendas'
            ],
            strengths: [
              'Produtos colhidos diretamente de produtores da região',
              'Frescor e higiene impecáveis'
            ]
          },
          pitchWhatsapp: `Oi Vânia, tudo bem? Vemos o carinho do Hortifruti Sabor da Terra com produtos frescos em ${cName}. Toda família quer frutas selecionadas, e quando anunciamos o dia de chegada dos produtos frescos nas redes, as vendas de cestas disparam no WhatsApp. Gostaria de ver como estruturamos campanhas para hortifrutis?`,
          pitchEmail: `Vânia, atrair pedidos semanais de hortifruti fresco em ${cName} via anúncios locais é a nossa proposta.\n\nPodemos conversar?`,
          phoneTalkingPoints: `Valorizar o frescor dos produtos da horta; apresentar a ideia de cestas semanais entregues em casa.`
        },
        {
          companyName: `Mercado & Açougue Tradição ${cName}`,
          tradeName: `Carnes & Mercearia Tradição`,
          email: `contato@carnestradicao${cKey}.com.br`,
          website: '',
          instagram: `@carnestradicao_${cKey}`,
          contactPerson: 'Paulo Henrique (Sócio Administrador)',
          score: 92,
          recommendedServiceId: 'redes',
          estimatedValue: 2000,
          recurrence: true,
          matchReason: `Açougue especializado em carnes para churrasco, cortes nobres e mercearia rápida em ${cName}. Não possui presença estratégica no Instagram para alavancar pedidos de kits churrasco no fim de semana.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '3.7k',
            socialQuality: 'Fotos estáticas de carne em bandejas',
            gaps: [
              'Sem vídeos curtos mostrando cortes especiais e o preparo de churrasco',
              `Falta de anúncios de quinta a sábado em ${cName} para pedidos de churrasco`,
              'Sem cardápio digital de carnes e bebidas para retirada'
            ],
            strengths: [
              'Cortes selecionados e mestre de açougue experiente',
              'Excelente reputação em qualidade de carnes'
            ]
          },
          pitchWhatsapp: `Paulo, tudo bem? Os cortes do Açougue Tradição em ${cName} têm qualidade de boutique de carnes! Nas quintas e sextas, todo mundo na cidade está planejando o churrasco do final de semana. Se colocarmos seus cortes na tela deles com vídeos atraentes, o WhatsApp da loja vai lotar de reservas. Quer dar uma olhada em como fazemos isso?`,
          pitchEmail: `Paulo, posicionar o Açougue Tradição como a principal escolha de churrasco de ${cName} vai maximizar suas margens.\n\nPodemos agendar uma conversa rápida?`,
          phoneTalkingPoints: `Focar no aumento de vendas de kits churrasco de quinta a domingo com vídeos e anúncios locais.`
        },
        {
          companyName: `Supermercado Progresso de ${cName}`,
          tradeName: `Super Progresso`,
          email: `contato@superprogresso${cKey}.com.br`,
          website: '',
          instagram: `@superprogresso_${cKey}`,
          contactPerson: 'Maurício Antunes (Gestor Comercial)',
          score: 94,
          recommendedServiceId: 'sites',
          estimatedValue: 4500,
          recurrence: false,
          matchReason: `Supermercado tradicional em ${cName} com mais de 15 anos de atuação. Seu site institucional inexiste e sua presença digital não reflete a dimensão e a tradição física da loja.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Inexistente na web',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '4.2k',
            socialQuality: 'Publicações desordenadas sem padrão visual de marca',
            gaps: [
              `Sem portal web com localização, canais de atendimento e encartes de ${cName}`,
              'Invisível em buscas no Google Maps e Google Busca para termos de compras',
              'Identidade visual online desalinhada com a estrutura física da loja'
            ],
            strengths: [
              'Marca tradicional com sólida confiança do consumidor local',
              'Grande área de vendas e linha diversificada de produtos'
            ]
          },
          pitchWhatsapp: `Olá Maurício! O Super Progresso é um patrimônio comercial de ${cName}. Notamos que ao buscar por supermercados na cidade no Google, sua empresa perde destaque para redes de fora por falta de uma presença digital moderna e indexada. Na Lastro criamos o portal oficial e organizamos sua presença no Google. Podemos marcar um café de 10 minutos?`,
          pitchEmail: `Maurício, garantir a liderança digital do Super Progresso em ${cName} no Google e nas redes é nosso compromisso.\n\nPodemos falar nesta semana?`,
          phoneTalkingPoints: `Destacar a história da empresa em ${cName} e como uma plataforma web valoriza a marca perante novos concorrentes.`
        }
      ];
    }

    // 3. SAPATOS / CALÇADOS / TÊNIS / SAPATARIAS
    if (n.match(/sapato|calcado|tenis|sapataria|sandalia|chinelo|couro|bolsa|sneaker/i)) {
      return [
        {
          companyName: `Passo Certo Calçados & Tênis ${cName}`,
          tradeName: `Passo Certo Calçados`,
          email: `contato@passocerto${cKey}.com.br`,
          website: `https://passocerto${cKey}.com.br`,
          instagram: `@passocerto_${cKey}`,
          contactPerson: 'Eduardo Fonseca (Proprietário)',
          score: 93,
          recommendedServiceId: 'trafego',
          estimatedValue: 2500,
          recurrence: true,
          matchReason: `Loja multimarcas de calçados masculinos, femininos e tênis esportivos em ${cName}. Sofre com a concorrência desleal de grandes e-commerces nacionais por não anunciar ofertas e modelos para o público local no Meta e Google.`,
          digitalAudit: {
            hasWebsite: true,
            websiteQuality: 'Site vitrine antigo sem atualização de modelos',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '5.4k',
            socialQuality: 'Fotos de caixas e sapatos sem modelos calçando',
            gaps: [
              `Sem anúncios no Instagram direcionados para compradores de tênis e sapatos em ${cName}`,
              'Falta de vídeos demonstrando o conforto, palmilha e acabamento dos calçados',
              'Sem catálogo organizado no WhatsApp para reserva de numerações'
            ],
            strengths: [
              'Marcas consagradas (Nike, Adidas, Dakota, Usaflex, Pegada)',
              'Atendimento atencioso com possibilidade de provar na hora'
            ]
          },
          pitchWhatsapp: `Olá Eduardo! Acompanho o Passo Certo Calçados em ${cName}. O cliente de calçado valoriza poder calçar e levar na hora, mas muitas vezes compra na internet porque foi bombardeado por anúncios. Na Lastro estruturamos tráfego local no Instagram para colocar os lançamentos da sua loja no celular dos moradores de ${cName}. Quer ver como fazemos isso?`,
          pitchEmail: `Eduardo, recuperar as vendas de calçados perdidas para a internet através de anúncios locais em ${cName} é o foco da Lastro.\n\nPodemos conversar?`,
          phoneTalkingPoints: `Ressaltar a vantagem de provar o calçado na hora em ${cName}; propor atração via anúncios patrocinados.`
        },
        {
          companyName: `Donna Pé Calçados & Conforto ${cName}`,
          tradeName: `Donna Pé Sapatos`,
          email: `contato@donnape${cKey}.com.br`,
          website: '',
          instagram: `@donnape_${cKey}`,
          contactPerson: 'Mariana Prado (Gerente de Loja)',
          score: 91,
          recommendedServiceId: 'redes',
          estimatedValue: 2000,
          recurrence: true,
          matchReason: `Sapataria especializada em calçados femininos de conforto, sapatilhas, scarpins e sandálias em ${cName}. O público feminino compra pela estética dos pés, mas o Instagram não tem vídeos dinâmicos de pés calçados em movimento.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui catálogo virtual',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '4.1k',
            socialQuality: 'Fotos simples em prateleiras',
            gaps: [
              'Falta de Reels de provador calçando sandálias e sapatilhas',
              `Sem campanhas no Meta Ads para o público feminino adulto de ${cName}`,
              'Sem botão de WhatsApp por modelo para consulta imediata de numeração'
            ],
            strengths: [
              'Linha anatômica e ortopédica de alto conforto muito elogiada',
              'Fidelidade sólida das clientes tradicionais'
            ]
          },
          pitchWhatsapp: `Oi Mariana! As clientes adoram o conforto da Donna Pé em ${cName}. No Instagram, vídeos curtos calçando as sandálias e mostrando o acabamento geram dezenas de mensagens no WhatsApp perguntando se tem a numeração. Na Lastro produzimos essa linha editorial para fazer sua loja bombar toda semana. Vamos marcar um papo rápido?`,
          pitchEmail: `Mariana, transformar a Donna Pé na maior referência em sapatos e conforto de ${cName} no digital é o objetivo da Lastro.\n\nPodemos falar brevemente?`,
          phoneTalkingPoints: `Explicar a eficácia de vídeos curtos calçando os sapatos para gerar desejo de compra nas mulheres de ${cName}.`
        },
        {
          companyName: `Elite Shoes & Sneakers ${cName}`,
          tradeName: `Elite Tênis Urbanos`,
          email: `contato@eliteshoes${cKey}.com.br`,
          website: '',
          instagram: `@eliteshoes_${cKey}`,
          contactPerson: 'Lucas Martins (Proprietário)',
          score: 94,
          recommendedServiceId: 'landing',
          estimatedValue: 2500,
          recurrence: false,
          matchReason: `Loja de sneakers, tênis casuais, esportivos e meias estilizadas voltada ao público jovem e universitário em ${cName}. Necessita de uma Landing Page com vitrine de drops e lançamentos para reserva via WhatsApp.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '6.7k',
            socialQuality: 'Perfil com estética streetwear mas sem funil de compras',
            gaps: [
              'Sem página de lançamentos para reserva de pares limitados',
              `Falta de anúncios focados em jovens de 18 a 35 anos em ${cName} e região`,
              'Atendimento manual no direct com atrasos nas respostas'
            ],
            strengths: [
              'Modelos cobiçados de sneakers e tênis de alta procura',
              'Marca com excelente identificação entre o público jovem'
            ]
          },
          pitchWhatsapp: `Fala Lucas! Os sneakers da Elite Shoes em ${cName} são diferenciados demais. A galera pira nos lançamentos, mas se não tiver uma página rápida onde a pessoa escolhe o par e já reserva no WhatsApp, você perde vendas. Criamos Landing Pages dinâmicas para lançamentos de tênis que convertem muito. Quer ver como fica?`,
          pitchEmail: `Lucas, acelerar as reservas dos lançamentos da Elite Shoes em ${cName} com uma Landing Page exclusiva é a nossa especialidade.\n\nPodemos conversar?`,
          phoneTalkingPoints: `Destacar o mercado jovem e como reservas rápidas via Landing Page evitam que o cliente compre em sites concorrentes.`
        },
        {
          companyName: `Sapataria & Botas do Interior ${cName}`,
          tradeName: `Botas & Couros ${cName}`,
          email: `contato@botasecouro${cKey}.com.br`,
          website: '',
          instagram: `@botasecouro_${cKey}`,
          contactPerson: 'Tiago Barreto (Sócio Administrador)',
          score: 90,
          recommendedServiceId: 'sites',
          estimatedValue: 4500,
          recurrence: false,
          matchReason: `Loja de botas country, calçados de couro legítimo, botinas de trabalho e cintos em ${cName}. Produto de alto valor com apelo no agronegócio regional, mas sem site indexado no Google.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui presença na web',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '3.2k',
            socialQuality: 'Fotos simples de estande',
            gaps: [
              `Sem site institucional com catálogo de botas para produtores de ${cName} e Alta Paulista`,
              'Google Perfil de Empresa sem menção aos tipos de couro e modelos',
              'Falta de campanhas durante feiras agropecuárias e rodeios da região'
            ],
            strengths: [
              'Durabilidade inquestionável do couro e costura artesanal',
              'Forte apelo com o público rural e sertanejo'
            ]
          },
          pitchWhatsapp: `Tiago, tudo bem? As botas da Botas & Couros em ${cName} têm muita qualidade e durabilidade. O produtor rural e o público da nossa região compram botas o ano todo, e quando pesquisam no Google, um portal profissional passa a confiança exata para fechar no ato. Na Lastro criamos sua vitrine digital completa. Vamos bater um papo de 10 minutos?`,
          pitchEmail: `Tiago, colocar sua sapataria de couro como referência no Google na comarca de ${cName} e na Alta Paulista é nossa meta na Lastro.\n\nPodemos conversar?`,
          phoneTalkingPoints: `Ressaltar o valor agregado do calçado em couro e a força do público agro da região.`
        },
        {
          companyName: `Pé & Cia Calçados Infantis e Adultos ${cName}`,
          tradeName: `Pé & Cia ${cName}`,
          email: `contato@peecia${cKey}.com.br`,
          website: '',
          instagram: `@peecia_${cKey}`,
          contactPerson: 'Camila Vilela (Proprietária)',
          score: 89,
          recommendedServiceId: 'redes',
          estimatedValue: 2000,
          recurrence: true,
          matchReason: `Calçados para crianças, bebês e linha família em ${cName}. As mães buscam calçados resistentes e confortáveis para a escola e passeios, mas o perfil da loja não posta com frequência nem faz anúncios sazonais.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '2.9k',
            socialQuality: 'Postagens raras com fotos de baixa qualidade',
            gaps: [
              `Sem campanhas no Meta Ads direcionadas para mães e pais de ${cName}`,
              'Falta de campanhas fortes no Volta às Aulas e Dia das Crianças',
              'Sem catálogo prático no WhatsApp para mães ocupadas escolherem'
            ],
            strengths: [
              'Marcas infantis reconhecidas (Kidy, Bibi, Molekinha, Pampili)',
              'Atendimento carinhoso e paciência com as crianças'
            ]
          },
          pitchWhatsapp: `Oi Camila! Sabemos como as mães de ${cName} confiam na Pé & Cia para calçar os filhos. Hoje as mães resolvem tudo pelo celular entre um compromisso e outro. Com fotos produzidas e anúncios locais certos, os pedidos de calçados infantis chegam direto no WhatsApp. Podemos te mostrar como ajudamos lojas como a sua na Lastro?`,
          pitchEmail: `Camila, atrair pais e mães de ${cName} com anúncios sazonais no Instagram é a especialidade da Lastro.\n\nPodemos falar brevemente?`,
          phoneTalkingPoints: `Destacar o poder de compra das mães no digital e a facilidade de compra de calçado infantil via WhatsApp.`
        },
        {
          companyName: `Via Bella Calçados & Bolsas ${cName}`,
          tradeName: `Via Bella Calçados`,
          email: `contato@viabella${cKey}.com.br`,
          website: '',
          instagram: `@viabella_${cKey}`,
          contactPerson: 'Beatriz Gusmão (Sócia Diretora)',
          score: 93,
          recommendedServiceId: 'trafego',
          estimatedValue: 2500,
          recurrence: true,
          matchReason: `Loja de sapatos de festa, saltos altos, bolsas e acessórios femininos sofisticados em ${cName}. Não investe em anúncios pagos para formaturas, casamentos e eventos da Alta Paulista.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '4.8k',
            socialQuality: 'Fotos boas de produtos mas sem distribuição paga de anúncios',
            gaps: [
              'Zero anúncios patrocinados para mulheres convidadas para eventos na região',
              'Sem combos promocionais de sapato + bolsa combinando no WhatsApp',
              'Falta de rastreamento de cliques e vendas no perfil'
            ],
            strengths: [
              'Combinações requintadas de sapatos finos e bolsas',
              'Ambiente de loja moderno e acolhedor'
            ]
          },
          pitchWhatsapp: `Beatriz, os sapatos e bolsas da Via Bella em ${cName} são espetaculares! Casamentos, formaturas e eventos acontecem todo mês na nossa região, e as mulheres procuram o calçado perfeito. Com tráfego geolocalizado no Instagram, colocamos seus saltos e bolsas no feed delas no momento certo de compra. Quer conhecer nossa metodologia?`,
          pitchEmail: `Beatriz, potencializar as vendas de sapatos finos e bolsas da Via Bella em ${cName} é o compromisso da Lastro.\n\nPodemos conversar?`,
          phoneTalkingPoints: `Destacar as oportunidades de eventos e festas na comarca e como os anúncios trazem clientes prontas para comprar.`
        }
      ];
    }

    // 4. CLÍNICAS / ODONTOLOGIA / MÉDICOS / SAÚDE / DENTISTAS
    if (n.match(/odonto|dent|medic|clinic|saude|estetica|oftalmo|psicol|fisioter/i)) {
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
          companyName: `Clínica Médica & Diagnósticos São Lucas ${cName}`,
          tradeName: `Clínica São Lucas`,
          email: `agendamento@saolucas${cKey}.com.br`,
          website: '',
          instagram: `@saolucas_${cKey}`,
          contactPerson: 'Dra. Helena Martins (Diretora Técnica)',
          score: 92,
          recommendedServiceId: 'sites',
          estimatedValue: 4500,
          recurrence: false,
          matchReason: `Policlínica com diversas especialidades médicas em ${cName}. Não possui site com agendamento online e corpo clínico indexado, dificultando a localização por convênios e particulares.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '3.1k',
            socialQuality: 'Postagens informativas sem chamada de ação',
            gaps: [
              'Sem portal com listagem de médicos e especialidades',
              `Google Meu Negócio sem horários de atendimento atualizados em ${cName}`,
              'Falta de canal rápido de triagem no WhatsApp'
            ],
            strengths: [
              'Corpo clínico com médicos conceituados na região',
              'Infraestrutura moderna de exames e consultas'
            ]
          },
          pitchWhatsapp: `Dra. Helena, tudo bem? Notamos que muitos pacientes da nossa região pesquisam por especialistas médicos em ${cName} e encontram dificuldades para checar horários e agendar online. Na Lastro criamos portais de saúde com agendamento integrado que facilitam a vida do paciente e desafogam a recepção. Gostaria de conhecer?`,
          pitchEmail: `Dra. Helena, modernizar o agendamento da Clínica São Lucas em ${cName} com um portal responsivo é nosso compromisso.\n\nPodemos conversar?`,
          phoneTalkingPoints: `Focar na redução de custos da recepção e captação de pacientes particulares.`
        },
        {
          companyName: `Instituto Sorrir Odontologia Avançada ${cName}`,
          tradeName: `Instituto Sorrir`,
          email: `contato@institutosorrir${cKey}.com.br`,
          website: '',
          instagram: `@institutosorrir_${cKey}`,
          contactPerson: 'Dr. Marcelo Castilho (Responsável Clínico)',
          score: 95,
          recommendedServiceId: 'landing',
          estimatedValue: 2500,
          recurrence: false,
          matchReason: `Clínica focada em harmonização orofacial e lentes de contato dental em ${cName}. Precisa de uma Landing Page focada em estética com antes e depois e avaliação VIP.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '5.8k',
            socialQuality: 'Fotos bonitas de sorrisos mas sem link de triagem',
            gaps: [
              'Sem Landing Page para procedimentos estéticos de alto valor',
              'Tráfego pago inativo para estética dental na região',
              'Sem roteamento de pacientes particulares'
            ],
            strengths: [
              'Tecnologia de escaneamento 3D e materiais importados',
              'Tratamentos odontológicos de altíssimo padrão estético'
            ]
          },
          pitchWhatsapp: `Dr. Marcelo! Os resultados estéticos do Instituto Sorrir em ${cName} são impressionantes. Pacientes que buscam lentes e alinhadores precisam de uma página sofisticada para agendar uma avaliação sem medo. Na Lastro construímos páginas de alta conversão para odontologia estética. Posso te enviar um exemplo?`,
          pitchEmail: `Dr. Marcelo, captar pacientes de alto ticket para lentes dentais em ${cName} é o objetivo da nossa Landing Page na Lastro.\n\nPodemos conversar?`,
          phoneTalkingPoints: `Apresentar a captação de pacientes para procedimentos estéticos de alto ticket.`
        }
      ];
    }

    // 5. RESTAURANTES / GASTRONOMIA / PIZZARIAS / HAMBURGUERIAS
    if (n.match(/restaurante|pizz|burger|hamburg|lanche|gastronom|bar|churrasc|comida|cafe|doceria/i)) {
      return [
        {
          companyName: `Cantina & Forneria Tradição ${cName}`,
          tradeName: `Forneria Tradição`,
          email: `contato@forneriatradicao${cKey}.com.br`,
          website: '',
          instagram: `@forneriatradicao_${cKey}`,
          contactPerson: 'Chef Giancarlo (Sócio & Cozinheiro)',
          score: 93,
          recommendedServiceId: 'redes',
          estimatedValue: 2000,
          recurrence: true,
          matchReason: `Restaurante italiano e forneria artesanal em ${cName}. Pratos impecáveis com massas frescas, mas o perfil do Instagram tem fotos escuras e sem linha editorial para lotar as mesas de quinta a domingo.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '4.6k',
            socialQuality: 'Fotos com baixa iluminação sem despertar apetite',
            gaps: [
              'Sem vídeos curtos mostrando o preparo dos pratos e queijos derretendo',
              `Falta de anúncios no Meta Ads às quintas e sextas para casais de ${cName}`,
              'Sem sistema de reserva rápida de mesa pelo WhatsApp'
            ],
            strengths: [
              'Autêntica culinária italiana com ingredientes frescos',
              'Ambiente aconchegante e carta de vinhos selecionada'
            ]
          },
          pitchWhatsapp: `Chef Giancarlo, boa tarde! Os pratos da Forneria Tradição em ${cName} têm sabor de alta gastronomia. Na gastronomia, as pessoas comem primeiro com os olhos no Instagram antes de escolher onde jantar. Na Lastro cuidamos da produção visual e campanhas locais para manter o salão lotado todo fim de semana. Topa um café rápido para conversarmos?`,
          pitchEmail: `Giancarlo, transformar a Forneria Tradição no destino gastronômico mais concorrido de ${cName} é nosso compromisso.\n\nPodemos falar brevemente?`,
          phoneTalkingPoints: `Elogiar a gastronomia da casa; explicar como anúncios pontuais na quinta e sexta lotam o salão.`
        },
        {
          companyName: `Old Town Burger & Steakhouse ${cName}`,
          tradeName: `Old Town Burger`,
          email: `contato@oldtown${cKey}.com.br`,
          website: '',
          instagram: `@oldtown_${cKey}`,
          contactPerson: 'Leandro Prado (Proprietário)',
          score: 92,
          recommendedServiceId: 'trafego',
          estimatedValue: 2200,
          recurrence: true,
          matchReason: `Hamburgueria artesanal com blends especiais e porções em ${cName}. Paga comissões abusivas para aplicativos de entrega por não ter um canal próprio de pedidos turbinado com tráfego pago.`,
          digitalAudit: {
            hasWebsite: false,
            websiteQuality: 'Não possui',
            metaAdsActive: false,
            googleAdsActive: false,
            instagramFollowers: '5.9k',
            socialQuality: 'Stories informais com pouca chamada direta',
            gaps: [
              'Sem anúncios locais nas noites de entrega direcionados para WhatsApp',
              'Falta de cardápio digital próprio sem comissão de app',
              'Sem campanhas de fidelidade para recompra de clientes antigos'
            ],
            strengths: [
              'Hambúrgueres de altíssima qualidade e batatas crocantes',
              'Marca moderna com apelo forte entre jovens e famílias'
            ]
          },
          pitchWhatsapp: `Fala Leandro! Os burgers da Old Town em ${cName} são sensacionais. O maior vilão das hamburguerias hoje são as taxas absurdas de apps de entrega. Na Lastro criamos campanhas de tráfego que direcionam os pedidos direto para o seu WhatsApp ou cardápio próprio, aumentando seu lucro no bolso. Quer ver como funciona?`,
          pitchEmail: `Leandro, reduzir a dependência de taxas de apps e multiplicar pedidos diretos na Old Town em ${cName} é nossa meta.\n\nPodemos conversar?`,
          phoneTalkingPoints: `Focar na redução de custos de aplicativos e aumento de pedidos diretos pelo WhatsApp.`
        }
      ];
    }

    // 6. ADVOCACIA / JURÍDICO
    if (n.match(/advog|jurid|direito|oab/i)) {
      return [
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
              `Excelente reputação ética na comarca de ${cName}`,
              'Histórico sólido de causas ganhas e advogados pós-graduados'
            ]
          },
          pitchWhatsapp: `Dra. Camila, tudo bem? Acompanho a seriedade e o renome do Mendes Advogados em ${cName}. Notamos que grande parte das pessoas hoje pesquisa sobre serviços jurídicos pelo smartphone, e seu portal atual ainda não oferece uma experiência moderna para esses clientes. Na Lastro desenvolvemos plataformas institucionais de alto padrão, 100% alinhadas com o Código de Ética da OAB. Gostaria de dar uma olhada em como podemos valorizar a autoridade da sua banca?`,
          pitchEmail: `Dra. Camila,\n\nModernizar a presença web da sua banca em ${cName} com um portal responsivo e seguro é indispensável para clientes de alto padrão.\n\nA Lastro tem sólida experiência em design corporativo jurídico.`,
          phoneTalkingPoints: 'Destacar o respeito estrito às regras da OAB; falar sobre a importância de um site que funcione perfeitamente no celular.'
        }
      ];
    }

    // 7. ENERGIA SOLAR / AGRONEGÓCIOS / AGRO
    if (n.match(/solar|energia|agro|rural|usina/i)) {
      return [
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
        }
      ];
    }

    // 8. MOTOR DINÂMICO PARA QUALQUER OUTRO NICHO ESPECÍFICO PESQUISADO (Ex: Óticas, Floricultura, Móveis, Material de Construção, Pet Shop, etc.)
    return this._generateDynamicNicheTemplates(cleanNiche, cityInfo, count);
  }

  /**
   * Gerador dinâmico de alta fidelidade para nichos customizados
   */
  _generateDynamicNicheTemplates(niche, cityInfo, count) {
    const cName = cityInfo.name;
    const cKey = cityInfo.name.toLowerCase();
    
    // Formatar palavras do nicho com inicial maiúscula
    const words = (niche || 'Comércio Local')
      .trim()
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const titleNiche = words.join(' ');
    const slug = words.join('').toLowerCase().replace(/[^a-z0-9]/g, '');

    const profiles = [
      {
        companyName: `${titleNiche} Central de ${cName}`,
        tradeName: `${titleNiche} Central`,
        serviceId: 'trafego',
        value: 2500,
        recurrence: true,
        gap1: `Zero campanhas no Google e Meta Ads para o público de ${cName}`,
        gap2: `Sem funil de atendimento rápido no WhatsApp`,
        gap3: `Dependência excessiva de clientes que passam na calçada`,
        strength: `Ponto comercial tradicional e equipe atenciosa em ${cName}`
      },
      {
        companyName: `Espaço Nobre ${titleNiche} ${cName}`,
        tradeName: `Espaço Nobre ${titleNiche}`,
        serviceId: 'redes',
        value: 2000,
        recurrence: true,
        gap1: `Redes sociais com fotos amadoras e sem linha editorial profissional`,
        gap2: `Ausência de vídeos dinâmicos dos produtos e serviços oferecidos`,
        gap3: `Pouca autoridade perante concorrentes de cidades maiores`,
        strength: `Produtos/serviços de alto padrão e atendimento personalizado`
      },
      {
        companyName: `${titleNiche} Aliança & Qualidade ${cName}`,
        tradeName: `Aliança ${titleNiche}`,
        serviceId: 'landing',
        value: 2500,
        recurrence: false,
        gap1: `Não possui Landing Page rápida com botão de solicitação no WhatsApp`,
        gap2: `Perda de orçamentos por demora no envio de propostas`,
        gap3: `Falta de depoimentos e provas sociais visíveis na web`,
        strength: `Preços justos e credibilidade comprovada com clientes locais`
      },
      {
        companyName: `Líder ${titleNiche} de ${cName}`,
        tradeName: `Líder ${titleNiche}`,
        serviceId: 'sites',
        value: 4500,
        recurrence: false,
        gap1: `Sem site institucional indexado no Google para buscas na comarca`,
        gap2: `Google Perfil de Empresa sem fotos atualizadas e sem catálogo`,
        gap3: `Falta de canal web corporativo para clientes da região`,
        strength: `Marca reconhecida e sólida reputação no comércio de ${cName}`
      },
      {
        companyName: `Império ${titleNiche} ${cName}`,
        tradeName: `Império ${titleNiche}`,
        serviceId: 'trafego',
        value: 2800,
        recurrence: true,
        gap1: `Invisível para quem pesquisa por ${niche} no celular na cidade`,
        gap2: `Falta de anúncios patrocinados em períodos sazonais de alta procura`,
        gap3: `Sem estratégia de remarketing para recuperar orçamentos parados`,
        strength: `Ampla variedade de soluções e disponibilidade imediata`
      },
      {
        companyName: `Ponto Nobre ${titleNiche} ${cName}`,
        tradeName: `Ponto Nobre ${titleNiche}`,
        serviceId: 'redes',
        value: 2000,
        recurrence: true,
        gap1: `Perfil no Instagram sem postagens regulares e sem engajamento`,
        gap2: `Falta de catálogo digital organizado no WhatsApp Business`,
        gap3: `Pouca atração de novos moradores e clientes da comarca`,
        strength: `Excelente localização e confiança dos clientes habituais`
      }
    ];

    const deciders = [
      'Carlos Eduardo (Proprietário)',
      'Mariana Siqueira (Gerente Comercial)',
      'Roberto Almeida (Sócio Diretor)',
      'Juliana Freitas (Coordenadora Comercial)',
      'Fernando Ramos (Gestor Geral)',
      'Patrícia Meireles (Diretora)'
    ];

    return profiles.map((p, idx) => ({
      companyName: p.companyName,
      tradeName: p.tradeName,
      email: `contato@${slug}${idx + 1}${cKey}.com.br`,
      website: idx % 2 === 0 ? `https://${slug}${cKey}.com.br` : '',
      instagram: `@${slug}_${cKey}`,
      contactPerson: deciders[idx % deciders.length],
      score: 90 + (idx % 6),
      recommendedServiceId: p.serviceId,
      estimatedValue: p.value,
      recurrence: p.recurrence,
      matchReason: `Empresa especializada no segmento de ${niche} em ${cName}. Possui grande potencial na praça local, mas ainda não conta com estratégia digital para captar clientes que buscam por ${niche} no Google e nas redes sociais.`,
      digitalAudit: {
        hasWebsite: idx % 2 === 0,
        websiteQuality: idx % 2 === 0 ? 'Página simples sem otimização de conversão' : 'Não possui site indexado',
        metaAdsActive: false,
        googleAdsActive: false,
        instagramFollowers: `${2.2 + idx * 0.7}k`,
        socialQuality: 'Presença digital básica sem anúncios ativos',
        gaps: [p.gap1, p.gap2, p.gap3],
        strengths: [p.strength, `Empresa referenciada por clientes na cidade de ${cName}`]
      },
      pitchWhatsapp: `Olá! Acompanhamos o trabalho de excelência da sua empresa em ${cName} no ramo de ${niche}. Analisamos as buscas digitais na nossa região e vimos que muitos clientes procuram por ${niche} todos os dias pelo celular. A Lastro estruturou uma estratégia de alta performance para colocar sua marca em primeiro lugar nas decisões de compra. Topa bater um papo de 10 minutinhos?`,
      pitchEmail: `Identificamos uma grande oportunidade de expansão comercial para sua empresa em ${cName} no setor de ${niche}.\n\nA Lastro é especialista em soluções de tráfego, design e conversão na Alta Paulista.\n\nPodemos conversar nesta semana?`,
      phoneTalkingPoints: `Destacar a força da empresa em ${cName}; demonstrar a oportunidade de captar novos clientes que hoje buscam por ${niche} no celular.`
    }));
  }
}

module.exports = new HunterService();
