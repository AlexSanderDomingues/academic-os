// Exemplo de função serverless (Vercel/AWS Lambda style) que age como proxy para um LLM (OpenAI)
// Não inclua sua chave no código. Defina a variável de ambiente OPENAI_API_KEY no provedor de hosting.

// Note: this file is a serverless example for Vercel/AWS. It avoids framework-specific types to keep it portable.

async function callOpenAI(prompt: string) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY não configurada. Defina a variável de ambiente no seu provedor (Vercel, Netlify, etc).')

  const body = {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Você é um assistente de estudos que responde de forma clara e objetiva.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 800,
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI request failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || JSON.stringify(data)
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { mode, payload } = req.body || {}
  try {
    let prompt = ''
    switch (mode) {
      case 'analyzeBottlenecks':
        prompt = `Analise estas disciplinas e indique possíveis gargalos ou pré-requisitos que precisam de atenção. Retorne em texto curto. Dados: ${JSON.stringify(payload.subjects || payload)} `
        break
      case 'generateQuestions':
        prompt = `Gere 3 questões de múltipla escolha a partir do texto a seguir e forneça as alternativas e a resposta correta. Texto: ${String(payload.text || '')}`
        break
      case 'explain':
        prompt = `Explique de forma simples (como para uma criança de 10 anos): ${String(payload.text || '')}`
        break
      case 'prioritize':
        prompt = `Dada esta lista de tarefas e currículo, gere uma priorização curta com justificativas. Tarefas: ${JSON.stringify(payload.tasks || [])} Subjects: ${JSON.stringify(payload.subjects || [])}`
        break
      default:
        prompt = `Modo desconhecido. payload: ${JSON.stringify(payload)}`
    }

    const result = await callOpenAI(prompt)
    return res.status(200).json({ result })
  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) })
  }
}
