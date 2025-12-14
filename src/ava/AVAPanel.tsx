import { useState } from 'react'
import type { Subject, Task } from '../data'
import assistant from './assistant'

function AVAPanel({ subjects, tasks, notes }: { subjects: Subject[], tasks: Task[], notes: any[] }) {
  const [useServerless, setUseServerless] = useState(false)
  const [output, setOutput] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [selectedNote, setSelectedNote] = useState<string>('')
  const [noteText, setNoteText] = useState<string>('')

  const callServerless = async (mode: string, payload: any) => {
    setLoading(true)
    try {
      const res = await fetch('/api/ava', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, payload }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro na função serverless')
      setOutput(String(data.result || JSON.stringify(data)))
    } catch (e: any) {
      setOutput('Erro: ' + (e.message || String(e)))
    } finally { setLoading(false) }
  }

  const doAnalyze = async () => {
    setOutput('')
    if (useServerless) {
      await callServerless('analyzeBottlenecks', { subjects })
      return
    }
    const r = assistant.analyzeBottlenecks(subjects)
    setOutput(r)
  }

  const doGenerateQuestions = async () => {
    setOutput('')
    const text = noteText
    if (!text || text.trim() === '') { setOutput('Forneça texto ou selecione uma nota.'); return }
    if (useServerless) {
      await callServerless('generateQuestions', { text, type: 'mcq' })
      return
    }
    const r = assistant.generateQuestionsFromNote(text, 'mcq')
    setOutput(JSON.stringify(r, null, 2))
  }

  const doExplain = async () => {
    setOutput('')
    const text = noteText
    if (!text || text.trim() === '') { setOutput('Forneça texto ou selecione uma nota.'); return }
    if (useServerless) { await callServerless('explain', { text }); return }
    setOutput(assistant.explainLikeImTen(text))
  }

  const doPrioritize = async () => {
    setOutput('')
    if (useServerless) { await callServerless('prioritize', { tasks, subjects }); return }
    const r = assistant.prioritizeTasks(tasks, subjects)
    setOutput(JSON.stringify(r.slice(0,10), null, 2))
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold mb-3">AVA — Assistente Virtual de Aprendizado</h2>
      <div className="mb-3 flex items-center gap-4">
        <label className="flex items-center gap-2"><input type="checkbox" checked={useServerless} onChange={e => setUseServerless(e.target.checked)} />Usar Serverless LLM</label>
        <div>
          <label className="text-sm text-slate-400">Fonte:</label>
          <select value={selectedNote} onChange={e => {
            const val = e.target.value
            setSelectedNote(val)
            const note = notes.find(n => n.id === val)
            setNoteText(note ? (note.content || note.title || '') : '')
          }} className="bg-[#07101a] p-2 rounded ml-2 text-sm min-w-[220px]">
            <option value="">-- Selecionar anotação --</option>
            {notes.length === 0 && <option value="" disabled>Sem anotações salvas</option>}
            {notes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="text-sm text-slate-300">Texto de entrada (cole ou selecione uma nota acima):</label>
        <textarea value={noteText} onChange={e => setNoteText(e.target.value)} className="w-full mt-2 p-2 bg-[#07101a] rounded min-h-[120px]" />
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={doAnalyze} className="px-3 py-2 bg-purple-600 text-white rounded">Detectar Bloqueios</button>
        <button onClick={doGenerateQuestions} className="px-3 py-2 bg-white/5 text-slate-200 rounded">Gerar Questões (MCQ)</button>
        <button onClick={doExplain} className="px-3 py-2 bg-white/5 text-slate-200 rounded">Explicar (como p/ 10 anos)</button>
        <button onClick={doPrioritize} className="px-3 py-2 bg-white/5 text-slate-200 rounded">Priorizar Tarefas</button>
      </div>

      <div className="bg-[#081018] p-4 rounded min-h-[120px]">
        {loading ? <div>Carregando...</div> : <pre className="whitespace-pre-wrap text-sm">{output || 'Resultados aparecerão aqui.'}</pre>}
      </div>
    </div>
  )
}

export default AVAPanel
