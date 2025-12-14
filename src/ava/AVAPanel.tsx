import { useState } from 'react'
import type { Subject, Task } from '../data'
import { detectBlockers, generateQuestionsFromText, explainLikeImTen, prioritizeTasks, suggestTimeBlocks, makeFlashcards } from './assistant'

export default function AVAPanel({ subjects = [], tasks = [] }: { subjects?: Subject[]; tasks?: Task[] }) {
	const [input, setInput] = useState('')
	const [output, setOutput] = useState<any>(null)
	const [loading, setLoading] = useState(false)

	const runAction = (action: string) => {
		setLoading(true)
		try {
			if (action === 'blocks') {
				const res = detectBlockers(subjects)
				setOutput(res)
			} else if (action === 'questions') {
				const res = generateQuestionsFromText(input || subjects.map(s => s.name).join('. '), 5)
				setOutput(res)
			} else if (action === 'explain') {
				const res = explainLikeImTen(input || subjects.map(s => s.name).join('. '))
				setOutput(res)
			} else if (action === 'prioritize') {
				const res = prioritizeTasks(tasks || [], subjects || [])
				setOutput(res)
			} else if (action === 'blocks-suggest') {
				const res = suggestTimeBlocks(subjects || [])
				setOutput(res)
			} else if (action === 'flashcards') {
				const res = makeFlashcards(input || subjects.map(s => s.name).join(' '), 10)
				setOutput(res)
			}
		} catch (e) {
			setOutput('Erro ao executar ação')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="max-w-4xl mx-auto">
			<div className="bg-[#13151A] border border-white/5 rounded-2xl p-6 mb-6">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-bold text-white">AVA — Assistente Local</h3>
					<p className="text-sm text-slate-400">Local-first • sem envio de dados</p>
				</div>

				<p className="text-sm text-slate-400 mt-3">Escolha uma ação rápida ou cole texto/anotações abaixo para gerar saídas úteis.</p>

				<textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Cole uma nota, texto ou tópico aqui (opcional)" className="w-full mt-4 bg-[#0F1115] border border-white/5 rounded p-3 text-sm text-slate-100 resize-none h-28" />

				<div className="flex flex-wrap gap-2 mt-4">
					<button onClick={() => runAction('blocks')} className="px-3 py-2 bg-purple-600 rounded text-white text-sm">Detectar Bloqueios</button>
					<button onClick={() => runAction('questions')} className="px-3 py-2 bg-white/5 rounded text-slate-200 text-sm">Gerar Questões (MCQ)</button>
					<button onClick={() => runAction('explain')} className="px-3 py-2 bg-white/5 rounded text-slate-200 text-sm">Explicar Simples</button>
					<button onClick={() => runAction('prioritize')} className="px-3 py-2 bg-white/5 rounded text-slate-200 text-sm">Priorizar Tarefas</button>
					<button onClick={() => runAction('blocks-suggest')} className="px-3 py-2 bg-white/5 rounded text-slate-200 text-sm">Sugerir Blocos</button>
					<button onClick={() => runAction('flashcards')} className="px-3 py-2 bg-white/5 rounded text-slate-200 text-sm">Gerar Flashcards</button>
					<button onClick={() => { setInput(''); setOutput(null) }} className="ml-auto px-3 py-2 bg-white/5 rounded text-slate-200 text-sm">Limpar</button>
				</div>

				<div className="mt-6">
					<h4 className="text-sm text-slate-400">Resultado</h4>
					<div className="mt-2 bg-[#0F1115] border border-white/5 rounded p-4 min-h-[120px] text-sm text-slate-200">
						{loading ? <em>Processando...</em> : (
							output === null ? <span className="text-slate-500">Sem saída ainda.</span> : (
								typeof output === 'string' ? <div>{output}</div> : (
									<pre className="whitespace-pre-wrap text-xs">{JSON.stringify(output, null, 2)}</pre>
								)
							)
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
