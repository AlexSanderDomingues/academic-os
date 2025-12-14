import type { Subject, Task } from '../data'

// Simple local assistant (mock) — deterministic, runs entirely client-side.
export function detectBlockers(subjects: Subject[]): string {
  if (!subjects || subjects.length === 0) return 'Sem disciplinas para analisar.'
  const low = subjects.filter(s => s.grade !== undefined && s.grade < 6)
  if (low.length === 0) return 'Nenhum bloqueio identificado nas médias das disciplinas.'
  const entries = low.map(s => `${s.code || s.name} — nota ${s.grade}`).join('; ')
  return `Bloqueios detectados: ${entries}. Considere priorizar recuperação dessas disciplinas.`
}

export function generateQuestionsFromText(text: string, max = 3) {
  if (!text || text.trim() === '') return []
  // Heurística local melhorada para gerar questões + exemplos sem IA remota.
  const sentences = text.split(/[\.\n]+/).map(s => s.trim()).filter(Boolean)
  const qs = sentences.slice(0, max).map((s, i) => {
    const short = s.length > 120 ? s.slice(0,120) + '...' : s
    // tenta extrair um 'tópico' simples (primeira frase / primeira cláusula)
    const topic = (s.split(/[,:;-]/)[0] || short).trim()

    // Gera uma alternativa correta (resumo curto) e distratores simples
    const correct = topic.length > 60 ? topic.slice(0,60) + '...' : topic
    const distractors = [
      `Relacionado a ${topic.split(' ').slice(1,3).join(' ') || 'outro tema'}`,
      `Uma visão oposta sobre ${topic.split(' ').slice(0,2).join(' ') || 'tema'}`,
      `Exemplo prático envolvendo ${topic.split(' ').slice(-1)[0] || 'aplicação'}`
    ]

    const choices = [correct, ...distractors].slice(0,4)

    const example = `Exemplo: ${topic}. Por exemplo, aplique isso resolvendo um exercício simples ou reescrevendo o conceito com suas próprias palavras.`

    return {
      id: `q${i}`,
      question: `Sobre: ${short} — qual é a ideia principal?`,
      choices,
      answer: correct,
      example
    }
  })
  return qs
}

export function explainLikeImTen(text: string) {
  if (!text) return 'Nada para explicar.'
  const short = text.split(/[\.\n]+/).slice(0,2).join('. ')
  return `Explicação simples: ${short}. Imagine que é um passo a passo com exemplos.`
}

export function prioritizeTasks(tasks: Task[], subjects: Subject[]) {
  const subjWeight = new Map(subjects.map(s => [s.id, s.status === 'doing' ? 2 : 1]))
  return tasks
    .map(t => ({ ...t, score: (t.dueDate ? 2 : 0) + (t.subjectId ? (subjWeight.get(t.subjectId) || 1) : 1) }))
    .sort((a,b) => (b as any).score - (a as any).score)
}

export function suggestTimeBlocks(subjects: Subject[]) {
  const targets = subjects.filter(s => s.status === 'doing' || (s.grade !== undefined && s.grade < 6))
  return targets.slice(0,4).map((s) => ({ subject: s.name, blocks: 2, minutes: 60 }))
}

export function makeFlashcards(text: string, max = 6) {
  if (!text) return []
  const terms = Array.from(new Set(text.split(/\s+/).filter(Boolean))).slice(0, max)
  return terms.map((t,i) => ({ id: `f${i}`, front: t, back: `Definição de ${t}` }))
}

export default { detectBlockers, generateQuestionsFromText, explainLikeImTen, prioritizeTasks, suggestTimeBlocks, makeFlashcards }
// AI integration removed. This file intentionally left blank to revert previous changes.
export {}
