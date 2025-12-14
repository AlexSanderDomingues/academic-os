// Mock assistant functions (prova de conceito local)
import type { Subject, Task } from '../data'

export function analyzeBottlenecks(subjects: Subject[]): string {
  // Identifica matérias com status não feito e que possam bloquear progresso curricular.
  // Prova de conceito: matérias com nota < 6 ou status 'doing'/'todo'
  const lowGrades = subjects.filter(s => s.grade !== undefined && s.grade < 6)
  if (lowGrades.length === 0) return 'Nenhum bloqueio óbvio detectado nas suas notas.'

  // Estima impacto contando quantas matérias dependem delas (heurística: count by code matching in prerequisites)
  // Como não temos uma estrutura de dependências explícita aqui, apenas lista as disciplinas com baixa nota.
  const list = lowGrades.map(s => `${s.name} (${s.code}) nota ${s.grade}`).join('; ')
  return `Possíveis bloqueios detectados: ${list}. Considere priorizar recuperação dessas disciplinas.`
}

export function generateQuestionsFromNote(noteText: string, type: 'mcq' | 'discursive' = 'mcq') {
  // Gera questões simples a partir do texto (mock).
  if (!noteText || noteText.trim() === '') return { questions: [] }
  const sentences = noteText.split(/[\.\n]+/).map(s => s.trim()).filter(Boolean)
  const q = sentences.slice(0,3).map((s, i) => {
    if (type === 'mcq') {
      return {
        id: `q${i}`,
        type: 'mcq',
        question: `Sobre: ${s.slice(0,80)}... Qual é a ideia principal?`,
        choices: ['Resposta A', 'Resposta B', 'Resposta C', 'Resposta D'],
        answer: 0
      }
    }
    return { id: `q${i}`, type: 'discursive', question: `Explique: ${s}`, sampleAnswer: `Resposta-síntese sobre ${s.slice(0,60)}...` }
  })
  return { questions: q }
}

export function explainLikeImTen(text: string) {
  if (!text) return 'Nada para explicar.'
  // Simplificação heurística: reduzir sentenças e substituir termos complexos
  let t = text.replace(/\b\w{12,}\b/g, w => w.slice(0,8) + '...')
  t = t.split(/\.|\n/).slice(0,3).join('. ')
  return `Explicação simples: ${t}. Imagine que é um passo-a-passo pequeno.`
}

export function prioritizeTasks(tasks: Task[], subjects: Subject[]) {
  // Score: prazo (tasks with dueDate get higher) + subject importance (mock: subjects with status 'doing' get more weight)
  const subjectImportance = new Map<string, number>()
  subjects.forEach(s => subjectImportance.set(s.id, s.status === 'doing' ? 2 : 1))

  const scored = tasks.map(t => {
    const dueScore = t.dueDate ? 2 : 0
    const subjScore = t.subjectId ? (subjectImportance.get(t.subjectId) || 1) : 1
    const score = dueScore + subjScore
    return { ...t, score }
  }).sort((a,b) => b.score - a.score)

  return scored
}

export function suggestTimeBlocks(subjects: Subject[]) {
  // Sugere blocos de estudo para as matérias com status 'doing' ou nota baixa
  const targets = subjects.filter(s => s.status === 'doing' || (s.grade !== undefined && s.grade < 6))
  if (targets.length === 0) return []
  return targets.slice(0,3).map((s, i) => ({ subject: s.name, blocks: 3 - i, minutesPerBlock: 90 }))
}

export default { analyzeBottlenecks, generateQuestionsFromNote, explainLikeImTen, prioritizeTasks, suggestTimeBlocks }
