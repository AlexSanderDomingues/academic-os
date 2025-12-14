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

// AI serverless removed. This endpoint is intentionally disabled.
export default async function handler(req: any, res: any) {
  return res.status(404).json({ error: 'Not Found - AI integration removed' })
}
