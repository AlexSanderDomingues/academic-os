import React, { useState, useEffect } from 'react'
import { 
  BookOpen, Calendar, LayoutDashboard, Calculator, CheckCircle, Search, 
  GraduationCap, X, Plus, CheckSquare, Clock, Circle, Trash2, Save, List, Edit, FileText,BarChart, TrendingUp,
  ChevronDown, GraduationCap as CapIcon 
} from 'lucide-react'
import { initialSubjects, initialTasks } from './data'
import { idbGet, idbSet } from './idbStorage'
import type { Subject, Task, Attempt } from './data'

// Definindo a interface para um Horário (ScheduleItem)
export interface ScheduleItem {
    id: string;
 
    day: 'Seg' | 'Ter' | 'Qua' | 'Qui' | 'Sex' | 'Sáb';
    startTime: string; // Ex: '08:00'
    endTime: string; // Ex: '10:00'
    title: string;
    type: 'Aula' | 'Trabalho' | 'Compromisso';
    subjectId?: string; // ID da matéria para vincular
}

// Dados iniciais (adicionados para teste)
const initialSchedule: ScheduleItem[] = [
    { id: 'h1', day: 'Seg', startTime: '08:00', endTime: '10:00', title: 'Cálculo I', type: 'Aula', subjectId: '1' },
    { id: 'h2', day: 'Qua', startTime: '19:00', endTime: '22:00', title: 'Algoritmos', type: 'Aula', subjectId: '4' },
];

// =================================================================
// --- POMODORO: Tipos e Componente Simples ---
// =================================================================
export interface PomodoroSession {
  id: string;
  type: 'work' | 'short_break' | 'long_break';
  start: string; // ISO
  end: string; // ISO
  durationMinutes: number;
}

// --- Notes (Anotações) ---
export interface Note {
  id: string;
  title: string;
  content?: string;
  date: string; // ISO date (YYYY-MM-DD)
  subjectId?: string; // vinculo opcional com disciplina
  tags?: string[];
}

function PomodoroPanel({
  isRunning,
  modeLabel,
  secondsLeft,
  onStartPause,
  onReset,
  workMinutes
}: {
  isRunning: boolean;
  modeLabel: string;
  secondsLeft: number;
  onStartPause: () => void;
  onReset: () => void;
  workMinutes: number;
}) {
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4 mb-6 max-w-sm">
      <h4 className="text-sm text-slate-300 font-medium">Pomodoro</h4>
      <div className="flex items-center justify-between mt-2">
        <div>
          <div className="text-3xl font-mono text-white">{mm}:{ss}</div>
          <div className="text-xs text-slate-500 mt-1">{modeLabel} • {workMinutes} min</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button onClick={onStartPause} className="px-3 py-2 bg-purple-600 rounded text-white text-sm">{isRunning ? 'Pausar' : 'Iniciar'}</button>
          <button onClick={onReset} className="px-3 py-2 bg-white/5 rounded text-slate-200 text-sm">Resetar</button>
        </div>
      </div>
    </div>
  )
}

// statusConfig global removido (configurações locais são definidas onde necessário)

// =================================================================
// --- FUNÇÃO AUXILIAR PARA VERIFICAÇÃO DE FORMATO DE PERÍODO ---
// =================================================================

/**
 * Verifica se o valor é um Período Letivo no formato YYYY/S (ex: 2025/1).
 */
function isAcademicPeriod(semesterValue: string | number | undefined): boolean {
  if (semesterValue === undefined || semesterValue === null) return false;
  // Regex para validar se tem 4 dígitos, uma barra, e 1 ou 2 (Ano/Semestre)
  return /^\d{4}\/[12]$/.test(String(semesterValue));
}
// =================================================================
// --- LÓGICA DE PERÍODO LETIVO ATUAL (EXCLUSIVA DO DESEMPENHO) ---
// =================================================================

/**
 * Calcula o Período Letivo atual no formato YYYY/S (ex: 2025/1).
 */
function getCurrentAcademicPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // Mês é 0-baseado
    
    // Se o mês for Julho (7) ou posterior, é o 2º semestre.
    const semester = month >= 7 ? 2 : 1; 
    
    return `${year}/${semester}`;
}

function App() {
  const [activeTab, setActiveTab] = useState('matriz') 
  const [isTaskModalOpen, setIsTaskModal] = useState(false)
  const [isScheduleModalOpen, setIsScheduleModal] = useState(false)
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)

  // --- POMODORO: estado e persistência (IndexedDB) ---
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const [pomodoroLoaded, setPomodoroLoaded] = useState(false);

  // Load pomodoro sessions from IndexedDB on mount
  useEffect(() => {
    let mounted = true
    idbGet('academic-pomodoro').then(saved => {
      if (!mounted) return
      if (saved) {
        try { setPomodoroSessions(JSON.parse(saved)) } catch { /* ignore */ }
      }
    }).catch(() => {})
    return () => { mounted = false }
  }, [])

  // Persist pomodoro sessions to IndexedDB
  useEffect(() => {
    idbSet('academic-pomodoro', JSON.stringify(pomodoroSessions)).catch(() => {})
  }, [pomodoroSessions]);

  // Timer básico do Pomodoro
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [pomodoroMode] = useState<'work'|'short_break'|'long_break'>('work');
  const [workMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60);
  const [pomodoroStart, setPomodoroStart] = useState<string | null>(null);

  useEffect(() => {
    setSecondsLeft(workMinutes * 60);
  }, [workMinutes]);

  useEffect(() => {
    if (!isPomodoroRunning) return;
    const t = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          // sessão terminou
          setIsPomodoroRunning(false);
          // registra sessão usando o timestamp de início real (se disponível)
          const now = new Date();
          const end = now.toISOString();
          const startIso = pomodoroStart || new Date(now.getTime() - workMinutes * 60000).toISOString();
          const durationMinutes = Math.max(1, Math.round((Date.parse(end) - Date.parse(startIso)) / 60000));
          setPomodoroSessions(prev => [...prev, { id: Date.now().toString(), type: pomodoroMode, start: startIso, end, durationMinutes }]);
          setPomodoroStart(null);
          return 0;
        }
        return s - 1;
      })
    }, 1000);
    return () => clearInterval(t);
  }, [isPomodoroRunning, pomodoroMode, workMinutes]);

  const togglePomodoro = () => {
    setIsPomodoroRunning(running => {
      const next = !running;
      if (next) {
        setPomodoroStart(new Date().toISOString());
      }
      return next;
    });
  };

  const resetPomodoro = () => { setIsPomodoroRunning(false); setSecondsLeft(workMinutes * 60); setPomodoroStart(null); }

  // --- NOTAS (Anotações) ---
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);

  useEffect(() => {
    let mounted = true
    idbGet('academic-notes').then(saved => {
      if (!mounted) return
      if (saved) {
        try { setNotes(JSON.parse(saved)) } catch { }
      }
    }).catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    idbSet('academic-notes', JSON.stringify(notes)).catch(() => {})
  }, [notes]);

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const handleOpenNoteModal = (note: Note | null = null) => {
    if (note) setEditingNote(note);
    else setEditingNote({ id: 'new', title: 'Nova Nota', content: '', date: new Date().toISOString().slice(0,10), tags: [] });
    setIsNoteModalOpen(true);
  }

  const handleSaveNote = (noteData: Note) => {
    if (noteData.id === 'new') {
      const newNote = { ...noteData, id: Date.now().toString() };
      setNotes(prev => [newNote, ...prev]);
    } else {
      setNotes(prev => prev.map(n => n.id === noteData.id ? noteData : n));
    }
    setIsNoteModalOpen(false);
    setEditingNote(null);
  }

  const handleDeleteNote = (id: string) => {
    if (!confirm('Excluir anotação?')) return;
    setNotes(prev => prev.filter(n => n.id !== id));
  }


  // --- PERSISTÊNCIA (IndexedDB) ---
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects)
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);

  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [tasksLoaded, setTasksLoaded] = useState(false);

  // --- Função utilitária: Restaurar dados iniciais (reset localStorage)
  const handleResetData = () => {
    if (!confirm('Restaurar dados iniciais? Isso substituirá os dados salvos localmente.')) return;
    idbSet('academic-subjects', JSON.stringify(initialSubjects)).catch(() => {})
    idbSet('academic-tasks', JSON.stringify(initialTasks)).catch(() => {})
    setSubjects(initialSubjects);
    setTasks(initialTasks);
    alert('Dados restaurados para os valores iniciais.');
  }
  
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialSchedule)

  // Load subjects, tasks and schedule from IndexedDB on mount
  useEffect(() => {
    // One-time migration: perform atomically and create backups before overwriting.
    const migrate = async () => {
      try {
        const keys = ['academic-subjects','academic-tasks','academic-schedule','academic-pomodoro','academic-notes']
        const ts = Date.now()
        for (const k of keys) {
          try {
            const v = localStorage.getItem(k)
            if (v) {
              // create a backup copy in IDB in case migration goes wrong
              await idbSet(`academic-backup-${k}-${ts}`, v)
              await idbSet(k, v)
              // only remove from localStorage after successful write
              try { localStorage.removeItem(k) } catch(e) { /* noop */ }
            }
          } catch(e) {
            // skip individual key errors
          }
        }
      } catch(e) {
        // migration best-effort
      }

      let mounted = true

      // Subjects
      try {
        const saved = await idbGet('academic-subjects')
        if (mounted) {
          if (saved) {
            try { setSubjects(JSON.parse(saved)) } catch { }
          }
          setSubjectsLoaded(true)
        }
      } catch { setSubjectsLoaded(true) }

      // Tasks
      try {
        const saved = await idbGet('academic-tasks')
        if (mounted) {
          if (saved) {
            try { setTasks(JSON.parse(saved)) } catch { }
          }
          setTasksLoaded(true)
        }
      } catch { setTasksLoaded(true) }

      // Schedule
      try {
        const saved = await idbGet('academic-schedule')
        if (mounted) {
          if (saved) {
            try { setSchedule(JSON.parse(saved)) } catch { }
          }
        }
      } catch { }

      // Pomodoro
      try {
        const saved = await idbGet('academic-pomodoro')
        if (mounted) {
          if (saved) {
            try { setPomodoroSessions(JSON.parse(saved)) } catch { }
          }
          setPomodoroLoaded(true)
        }
      } catch { setPomodoroLoaded(true) }

      // Notes
      try {
        const saved = await idbGet('academic-notes')
        if (mounted) {
          if (saved) {
            try { setNotes(JSON.parse(saved)) } catch { }
          }
          setNotesLoaded(true)
        }
      } catch { setNotesLoaded(true) }

      return () => { mounted = false }
    }

    migrate()
    // no cleanup function required here
  }, [])

  // Persist subjects only after initial load completed
  useEffect(() => {
    if (!subjectsLoaded) return
    idbSet('academic-subjects', JSON.stringify(subjects)).catch(() => {})
  }, [subjects, subjectsLoaded])

  useEffect(() => {
    if (!tasksLoaded) return
    idbSet('academic-tasks', JSON.stringify(tasks)).catch(() => {})
  }, [tasks, tasksLoaded])

  useEffect(() => {
    // schedule doesn't have explicit loaded flag; avoid overwriting by only writing
    // if DB already loaded or if user has interacted (simple heuristic: subjectsLoaded)
    if (!subjectsLoaded) return
    idbSet('academic-schedule', JSON.stringify(schedule)).catch(() => {})
  }, [schedule, subjectsLoaded])

  // Persist pomodoro and notes only after they were loaded
  useEffect(() => {
    if (!pomodoroLoaded) return
    idbSet('academic-pomodoro', JSON.stringify(pomodoroSessions)).catch(() => {})
  }, [pomodoroSessions, pomodoroLoaded]);

  useEffect(() => {
    if (!notesLoaded) return
    idbSet('academic-notes', JSON.stringify(notes)).catch(() => {})
  }, [notes, notesLoaded]);
  
  // -----------------------------------


  // --- CRUD GERAL (Matéria) ---
  
  // Função unificada para salvar disciplina (usada na Calculadora // --- DENTRO DE function App() ---

const handleSaveSubject = (updatedSubject: Subject) => {
  let subjectsToUpdate = [...subjects];

  // Normaliza o status com base na nota
  const subjectToSave: Subject = {
    ...updatedSubject,
    status: updatedSubject.grade !== undefined && updatedSubject.grade >= 6 ? 'done' : updatedSubject.status 
  };

  // ...existing code...


  const isRepeat = subjectToSave.id.startsWith('new') && !!subjectToSave.parentId;

  if (isRepeat) {
    // Repetição detectada: parentId aponta para a disciplina original
    const previousId = subjectToSave.parentId as string;

    subjectsToUpdate = subjectsToUpdate.map(sub => {
      if (sub.id === previousId) {
        // Registra tentativa falha no histórico da matéria anterior
        const failedAttempt: Attempt = {
          academic_period: sub.academic_period || getCurrentAcademicPeriod(),
          grade: sub.grade,
          status: 'failed'
        };

        return { 
          ...sub, 
          is_current_attempt: false, 
          status: 'failed',
          attempts: [...(sub.attempts || []), failedAttempt]
        };
      }
      return sub;
    });

    // Adiciona a nova tentativa (sucessora) como ativa na Matriz (is_current_attempt = true)
    const newAttempt = { 
      ...subjectToSave, 
      id: Date.now().toString(),
      is_current_attempt: true,
      parentId: previousId
    } as Subject;

    subjectsToUpdate = [...subjectsToUpdate, newAttempt];
    console.log('DISCIPLINA REPETIDA ADICIONADA:', newAttempt.name);

  } else if (subjectToSave.id.startsWith('new')) {
    // Criação de nova disciplina normal
    const newSubject = { 
      ...subjectToSave, 
      id: Date.now().toString(),
      is_current_attempt: true
    } as Subject;

    subjectsToUpdate = [...subjectsToUpdate, newSubject];
    console.log('DISCIPLINA CADASTRADA:', newSubject.name);

  } else {
    // Atualização de disciplina existente
    subjectsToUpdate = subjectsToUpdate.map(sub => 
      sub.id === subjectToSave.id ? subjectToSave : sub
    );
    console.log('DISCIPLINA ATUALIZADA:', subjectToSave.name);
  }

  setSubjects(subjectsToUpdate);
  setIsSubjectModalOpen(false);
  setEditingSubject(null);
}

  // Função simplificada para atualizar nota (usada pela Calculadora)
  const handleUpdateGrade = (id: string, newGrade: number) => {
    const updated = subjects.map(sub => {
      if (sub.id === id) {
        return { 
          ...sub, 
          grade: newGrade, 
          status: newGrade >= 6 ? 'done' : 'doing' 
        } as Subject
      }
      return sub
    })
    setSubjects(updated)
  }

  // --- SUBSTITUA ESTA FUNÇÃO DENTRO DE function App() ---

const handleOpenSubjectModal = (subject: Subject | null = null) => {
    
    // 1. Evita abrir se já estiver aberto
    if (isSubjectModalOpen) return; 

    if (subject) {
        // Modo Edição: Abre a disciplina existente
        setEditingSubject(subject);
    } else {
        // Modo Criação: Cria um objeto Subject vazio para uma nova disciplina
        setEditingSubject({
            id: 'new' + Date.now(), // ID temporário único
            name: 'Nova Disciplina',
            code: 'COD000',
            credits: 60,
            semester: '1º Semestre', // Padrão que a Matriz Curricular espera para exibir
            status: 'pending',
            grade: undefined,
            finalNote: ''
        } as Subject); // Garantindo o tipo Subject
    }
    
    // 2. Abre o modal
    setIsSubjectModalOpen(true);
}


  const handleAddSubjects = (newSubjects: Subject[]) => {
      const existingCodes = new Set(subjects.map(s => s.code));
      const filteredNewSubjects = newSubjects.filter(s => !existingCodes.has(s.code));

      setSubjects([...subjects, ...filteredNewSubjects]);
      setActiveTab('matriz'); 
      alert(`Importação concluída. ${filteredNewSubjects.length} novas disciplinas adicionadas.`);
  }

  const handleDeleteSubject = (id: string) => {
    if (confirm('Apagar matéria e notas?')) {
      setSubjects(subjects.filter(s => s.id !== id))
    }
  }
  

// =================================================================
// --- LÓGICA DE DADOS DO DASHBOARD ---
// =================================================================

// Função que calcula todos os dados de resumo necessários
// =================================================================
// --- LÓGICA DE DADOS DO DASHBOARD (FILTRADA PARA IGNORAR YYYY/S) ---
// =================================================================

// Garanta que esta função auxiliar esteja definida no escopo (Bloco 1 anterior)
// function isAcademicPeriod(semesterValue: string | undefined): boolean { ... }

function useDashboardData(subjects: Subject[], pomodoroSessions?: PomodoroSession[]) {
    const totalSubjects = subjects.length;
    const concludedSubjects = subjects.filter(s => s.status === 'done' && s.grade && s.grade >= 6);
    const doingSubjects = subjects.filter(s => s.status === 'doing' || (s.status !== 'done' && s.grade && s.grade < 6));

  // Cálculo do CR: soma (nota * créditos) / soma(créditos) apenas para disciplinas concluídas
  let sumGradesXCredits = concludedSubjects.reduce((acc, sub) => {
    const grade = Number(sub.grade) || 0;
    const credits = Number(sub.credits) || 0;
    return acc + grade * credits;
  }, 0);

  let sumTotalCredits = concludedSubjects.reduce((acc, sub) => acc + (Number(sub.credits) || 0), 0);

  const globalCR = sumTotalCredits > 0 ? (sumGradesXCredits / sumTotalCredits) : 0;
  // totalCredits representa os créditos contabilizados nas disciplinas concluídas
  const totalCredits = sumTotalCredits;
    const totalConcluded = concludedSubjects.length;
    const totalDoing = doingSubjects.length;
    const totalPending = totalSubjects - totalConcluded - totalDoing;
    const progressPercentage = totalSubjects > 0 ? Math.round((totalConcluded / totalSubjects) * 100) : 0;
    // ...

    // ---------------------------------------------------
    // NOVO FILTRO CRÍTICO: Agrupamento por Semestre (Sequencial)
    // ---------------------------------------------------
    const subjectsBySemester = subjects.reduce((acc, sub) => {
        
        // 🛑 IGNORA MATÉRIAS COM FORMATO DE DESEMPENHO (2024/2, etc.)
        if (isAcademicPeriod(sub.semester)) {
            return acc;
        }

        const semester = sub.semester || 'Sem Semestre';
    acc[semester] = acc[semester] || { total: 0, concluded: 0 };
    // Contabiliza o total por semestre, mas NÃO conta tentativas antigas (repetições)
    // que não são a tentativa atual (is_current_attempt === false), a menos que
    // a disciplina já esteja concluída (aprovada). Isso evita que uma reprovação
    // antiga aumente o denominador (ex: 6/7 -> deveria ser 6/6).
    const countedInTotal = (sub.is_current_attempt !== false) || (sub.status === 'done' && sub.grade !== undefined && sub.grade >= 6);
    if (countedInTotal) {
      acc[semester].total += 1;
    }
    if (sub.status === 'done' && sub.grade && sub.grade >= 6) {
      acc[semester].concluded += 1;
    }
        return acc;
    }, {} as Record<string, { total: number, concluded: number }>);
    
    // Ordenar semestres numericamente (Ex: '1º Semestre', '2º Semestre', ...)
    const sortedSemesters = Object.keys(subjectsBySemester).sort((a, b) => {
        const numA = parseInt(a.replace('º Semestre', '').replace('º', '')) || 99;
        const numB = parseInt(b.replace('º Semestre', '').replace('º', '')) || 99;
        return numA - numB;
    });

    const progressBySemester = sortedSemesters.map(semester => ({
        semester: semester,
        ...subjectsBySemester[semester],
        percentage: subjectsBySemester[semester].total > 0 
            ? Math.round((subjectsBySemester[semester].concluded / subjectsBySemester[semester].total) * 100) 
            : 0
    }));

  const totalPomodoros = pomodoroSessions ? pomodoroSessions.filter(s => s.type === 'work').length : 0;
  const todayKey = new Date().toISOString().slice(0,10);
  const todayPomodoros = pomodoroSessions ? pomodoroSessions.filter(s => s.type === 'work' && s.start.slice(0,10) === todayKey).length : 0;
  const totalPomodoroMinutes = pomodoroSessions ? pomodoroSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0) : 0;

  return {
        totalSubjects,
        totalConcluded,
        totalDoing,
        totalPending,
        progressPercentage,
        progressBySemester,
        totalCredits,
    globalCR,
    totalPomodoros,
    todayPomodoros,
    totalPomodoroMinutes
    };
}
// =================================================================
// --- COMPONENTE VISUAL: DASHBOARD VIEW ---
// =================================================================

function DashboardView({ subjects, tasks, pomodoroSessions, isPomodoroRunning, secondsLeft, onStartPause, onReset, workMinutes, pomodoroMode }: { subjects: Subject[], tasks: Task[], pomodoroSessions?: PomodoroSession[], isPomodoroRunning?: boolean, secondsLeft?: number, onStartPause?: () => void, onReset?: () => void, workMinutes?: number, pomodoroMode?: 'work'|'short_break'|'long_break' }) {
    
  const data = useDashboardData(subjects, pomodoroSessions);
    const pendingTasks = tasks.filter(t => t.status !== 'done').length;

  const formattedCR = data.globalCR.toFixed(2);
  const crDisplay = data.totalCredits === 0 ? 'N/A' : formattedCR;

    return (
        <div className="max-w-7xl mx-auto min-h-full flex flex-col">
            <header className="mb-8 flex justify-between items-end">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                    <LayoutDashboard className="text-purple-400" /> Dashboard
                </h2>
                <p className="text-slate-500 flex items-center gap-2 text-sm">
                    <Clock size={16} /> Atualizado agora
                </p>
            </header>

            {/* BLOCO DE ESTATÍSTICAS PRINCIPAIS (Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                
                {/* CR Global (Coeficiente de Rendimento) */}
        <div>
          <StatsCard 
            title="CR Global" 
            // VALOR ATUALIZADO
            value={crDisplay} 
            subtitle="Coeficiente de Rendimento" 
            icon={<GraduationCap size={32} className="text-orange-400" />}
            color="text-orange-400"
          />

          {/* Painel do Pomodoro encaixado abaixo do CR Global */}
          <div className="mt-4">
            <PomodoroPanel
              isRunning={!!isPomodoroRunning}
              modeLabel={pomodoroMode === 'work' ? 'Trabalho' : pomodoroMode === 'short_break' ? 'Descanso curto' : 'Descanso longo'}
              secondsLeft={typeof secondsLeft === 'number' ? secondsLeft : (workMinutes || 25) * 60}
              onStartPause={onStartPause || (() => {})}
              onReset={onReset || (() => {})}
              workMinutes={workMinutes || 25}
            />
          </div>
        </div>

                {/* Disciplinas Concluídas */}
                <StatsCard 
                    title="Disciplinas" 
                    value={`${data.totalConcluded}/${data.totalSubjects}`} 
                    subtitle="Concluídas" 
                    icon={<BookOpen size={32} className="text-emerald-400" />}
                    color="text-emerald-400"
                />

                {/* Créditos/Horas */}
                <StatsCard 
                    title="Créditos" 
                    value={`${data.totalCredits}`} 
                    subtitle="Horas completas" 
                    icon={<Calculator size={32} className="text-blue-400" />}
                    color="text-blue-400"
                />

                {/* Tarefas Pendentes */}
                <StatsCard 
                    title="Tarefas" 
                    value={pendingTasks.toString()} 
                    subtitle="Pendentes" 
                    icon={<CheckSquare size={32} className="text-red-400" />}
                    color="text-red-400"
                />
            </div>

        {/* Estatísticas do Pomodoro */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="Pomodoros"
            value={`${data.todayPomodoros}/${data.totalPomodoros}`}
            subtitle={`Hoje / Total (${data.totalPomodoroMinutes} min)`}
            icon={<Clock size={32} className="text-pink-400" />}
            color="text-pink-400"
          />
        </div>

            {/* PROGRESSO DO CURSO E PROGRESSO POR SEMESTRE (2 COLUNAS) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Progresso do Curso (Gráfico Donut) */}
                <div className="lg:col-span-1 bg-[#1A1D24] border border-white/5 p-6 rounded-2xl shadow-lg flex flex-col items-center">
                    <h3 className="text-lg font-bold text-white mb-6 w-full">Progresso do Curso</h3>
                    
                    {/* Placeholder para o Gráfico Donut (simulado via CSS para Tailwind) */}
                    <div className="relative w-40 h-40 flex items-center justify-center mb-6">
                        <div 
                            className="w-full h-full rounded-full" 
                            style={{ 
                                background: `conic-gradient(#8b5cf6 0% ${data.progressPercentage}%, #1f2937 ${data.progressPercentage}% 100%)`
                            }}
                        ></div>
                        <div className="absolute inset-4 bg-[#1D1D24] rounded-full flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-purple-400">{data.progressPercentage}%</span>
                            <span className="text-xs text-slate-500 mt-1">Concluído</span>
                        </div>
                    </div>
                    
                    <span className="text-base text-slate-400 mb-6">
                        {data.totalConcluded} de {data.totalSubjects}
                    </span>
                    
                    <div className="grid grid-cols-3 w-full text-center border-t border-white/5 pt-4 gap-4">
                        <div>
                            <span className="text-xl font-bold text-emerald-400">{data.totalConcluded}</span>
                            <p className="text-xs text-slate-500">FEITAS</p>
                        </div>
                        <div>
                            <span className="text-xl font-bold text-orange-400">{data.totalDoing}</span>
                            <p className="text-xs text-slate-500">CURSANDO</p>
                        </div>
                        <div>
                            <span className="text-xl font-bold text-red-400">{data.totalPending}</span>
                            <p className="text-xs text-slate-500">RESTANTES</p>
                        </div>
                    </div>
                </div>

                {/* 2. Progresso por Semestre (Barras) */}
                <div className="lg:col-span-2 bg-[#1A1D24] border border-white/5 p-6 rounded-2xl shadow-lg">
                    <h3 className="text-lg font-bold text-white mb-6">Progresso por Semestre</h3>
                    
                    <div className="space-y-4">
                        {data.progressBySemester.map((p, index) => (
                            <SemesterProgress key={index} 
                                semester={p.semester} 
                                concluded={p.concluded}
                                total={p.total}
                                percentage={p.percentage}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}



// --- Componente Auxiliar para Cards de Estatísticas ---
function StatsCard({ title, value, subtitle, icon, color }: { title: string, value: string, subtitle: string, icon: React.ReactElement, color: string }) {
    return (
        <div className="bg-[#1D1F24] border border-white/5 p-6 rounded-2xl shadow-lg flex items-start gap-4">
        <div className={`p-3 rounded-full ${color.replace('text-', 'bg-')}/10`}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 24, className: color }) : icon}
      </div>
            <div>
                <p className="text-sm font-medium text-slate-400">{title}</p>
                <h3 className="text-3xl font-bold text-white mt-1">{value}</h3>
                <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
            </div>
        </div>
    );
}

// --- Componente Auxiliar para Barras de Progresso por Semestre ---
function SemesterProgress({ semester, concluded, total, percentage }: { semester: string, concluded: number, total: number, percentage: number }) {
    
    // Define a cor da barra baseada na porcentagem
    const barColor = percentage === 100 ? 'bg-emerald-600' : 
                     percentage > 0 ? 'bg-orange-600' : 'bg-slate-700';

    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <span className="text-slate-300 font-medium">{semester}</span>
                <span className="text-sm text-slate-400">{concluded}/{total} concluídas</span>
            </div>
            <div className="w-full bg-[#16181D] rounded-full h-2.5">
                <div 
                    className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`} 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
}




  // --- LÓGICA DE TAREFAS ---
  const handleOpenTaskModal = (task: Task | null = null) => {
    if (task) { 
        setEditingTask(task) 
    } else { 
        setEditingTask({ 
            id: 'new', 
            title: '', 
            status: 'todo', 
            priority: 'medium',
            description: '',
            dueDate: ''
        } as unknown as Task) 
    }
    setIsTaskModal(true)
  }

  const handleSaveTask = (taskData: Task) => {
    if (taskData.id === 'new') {
      const newTask = { ...taskData, id: Date.now().toString() }
      setTasks([...tasks, newTask])
    } else {
      setTasks(tasks.map(t => t.id === taskData.id ? taskData : t))
    }
    setIsTaskModal(false)
    setEditingTask(null)
  }

  const handleDeleteTask = (id: string) => {
    if (confirm('Excluir tarefa?')) {
      setTasks(tasks.filter(t => t.id !== id))
    }
  }

  const moveTask = (id: string, newStatus: 'todo' | 'doing' | 'done') => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t))
  }

  // --- LÓGICA DE HORÁRIOS ---
  const handleOpenScheduleModal = (day: ScheduleItem['day'] | null, startTime: string | null = null, item: ScheduleItem | null = null) => {
    if (item) {
        setEditingSchedule(item);
    } else {
        setEditingSchedule({
            id: 'new',
            day: day || 'Seg',
            startTime: startTime || '08:00',
            endTime: '09:00',
            title: '',
            type: 'Aula',
        } as ScheduleItem);
    }
    setIsScheduleModal(true);
  };
  
  const handleSaveSchedule = (scheduleData: ScheduleItem) => {
    if (scheduleData.id === 'new') {
      const newSchedule = { ...scheduleData, id: Date.now().toString() }
      setSchedule([...schedule, newSchedule])
    } else {
      setSchedule(schedule.map(s => s.id === scheduleData.id ? scheduleData : s))
    }
    setIsScheduleModal(false)
    setEditingSchedule(null)
  }

  const handleDeleteSchedule = (id: string) => {
    if (confirm('Excluir este horário?')) {
      setSchedule(schedule.filter(s => s.id !== id))
    }
  }

  // Componente local para itens da sidebar (definido dentro de App para garantir escopo)
  function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
    return (
      <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all ${active ? 'bg-purple-600/10 text-purple-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
        {icon} <span className="font-medium text-sm">{label}</span>
      </button>
    )
  }


  return (
    <div className="flex h-screen w-full bg-[#0F1115] text-slate-50 font-sans selection:bg-purple-500/30">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0F1115] border-r border-white/5 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold flex items-center gap-2 text-white">
            <div className="bg-purple-600 p-1.5 rounded-lg">
              <GraduationCap size={20} className="text-white" />
            </div>
            Academic OS
          </h1>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={<BookOpen size={20} />} label="Matriz Curricular" active={activeTab === 'matriz'} onClick={() => setActiveTab('matriz')} />
          <SidebarItem icon={<Calculator size={20} />} label="Calculadora" active={activeTab === 'calculadora'} onClick={() => setActiveTab('calculadora')} />
          <SidebarItem icon={<Calendar size={20} />} label="Horários" active={activeTab === 'horarios'} onClick={() => setActiveTab('horarios')} />
          <SidebarItem icon={<CheckSquare size={20} />} label="Tarefas" active={activeTab === 'tarefas'} onClick={() => setActiveTab('tarefas')} />
          <SidebarItem icon={<BarChart size={20} />} label="Desempenho" active={activeTab === 'desempenho'} onClick={() => setActiveTab('desempenho')} />
          <SidebarItem icon={<FileText size={20} />} label="Anotações" active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} />
          {/* ...existing sidebar items... */}
           {/* NOVO ITEM NA SIDEBAR */}
           <SidebarItem icon={<FileText size={20} />} label="Importar PPC" active={activeTab === 'import-ppc'} onClick={() => setActiveTab('import-ppc')} />
          
          {/* Botão de reset de dados (útil se localStorage foi sobrescrito) */}
          <button onClick={handleResetData} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all text-slate-400 hover:bg-white/5 hover:text-slate-200`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 101.5-5.5L3 7"/></svg>
            <span className="font-medium text-sm">Restaurar Dados</span>
          </button>
        </nav>
      </aside>
      
      {/* ÁREA PRINCIPAL */}
        
      <main className="flex-1 p-8 overflow-auto">
        

        {activeTab === 'desempenho' && (
            <PerformanceView subjects={subjects} />
        )}

        {activeTab === 'notes' && (
            <NotesView 
              notes={notes}
              subjects={subjects}
              onOpenModal={handleOpenNoteModal}
              onDeleteNote={handleDeleteNote}
            />
        )}

        {/* AVA removido */}

        {/* NOVO BLOCO: CHAMADA PARA O DASHBOARD */}
        {activeTab === 'dashboard' && ( 
            <>
              
              <DashboardView 
                subjects={subjects} 
                tasks={tasks} 
                pomodoroSessions={pomodoroSessions} 
                isPomodoroRunning={isPomodoroRunning}
                secondsLeft={secondsLeft}
                onStartPause={togglePomodoro}
                onReset={resetPomodoro}
                workMinutes={workMinutes}
                pomodoroMode={pomodoroMode}
              />
            </>
        )}

        {activeTab === 'tarefas' && (
          <TasksView 
            tasks={tasks} 
            onOpenModal={handleOpenTaskModal} 
            onMoveTask={moveTask} 
            onDeleteTask={handleDeleteTask} 
          />
        )}
        
        {activeTab === 'calculadora' && (
          <CalculatorReferenceView subjects={subjects} onSave={handleUpdateGrade} />
        )}

        {/* NOVA MATRIZ CURRICULAR */}
        {activeTab === 'matriz' && (
          <MatrixAdvancedView 
            subjects={subjects} 
            onDelete={handleDeleteSubject} 
            onOpenModal={handleOpenSubjectModal}
          />
        )}
        
        {activeTab === 'horarios' && (
          <ScheduleView 
            schedule={schedule} 
            onOpenModal={handleOpenScheduleModal}
          />
        )}

        

        {activeTab === 'import-ppc' && (
            <ImportPPCView 
                onImportSubjects={handleAddSubjects} 
            />
        )}

        {!['tarefas', 'calculadora', 'matriz', 'horarios', 'import-ppc', 'dashboard'].includes(activeTab) && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <LayoutDashboard size={48} className="mb-4 opacity-20" />
            <p>Em construção...</p>
          </div>
        )}
      </main>

      {/* Modais */}
      {isTaskModalOpen && editingTask && (
        <TaskModal 
          task={editingTask} 
          subjects={subjects} 
          onSave={handleSaveTask} 
          onClose={() => setIsTaskModal(false)}
        />
      )}
      {isScheduleModalOpen && editingSchedule && (
        <ScheduleModal 
          item={editingSchedule} 
          subjects={subjects} 
          onSave={handleSaveSchedule} 
          onDelete={editingSchedule.id !== 'new' ? handleDeleteSchedule : undefined}
          onClose={() => setIsScheduleModal(false)}
        />
      )}
      {/* NOVO MODAL DE DISCIPLINA */}
      {isSubjectModalOpen && editingSubject && (
        <SubjectDetailModal
            subject={editingSubject}
            subjects={subjects} // PASSA A LISTA COMPLETA DE DISCIPLINAS
            onSave={handleSaveSubject}
            onDelete={handleDeleteSubject}
            onClose={() => setIsSubjectModalOpen(false)}
        />
      )}
      {isNoteModalOpen && editingNote && (
        <NoteModal 
          note={editingNote} 
          subjects={subjects}
          onSave={handleSaveNote} 
          onClose={() => { setIsNoteModalOpen(false); setEditingNote(null); }} 
        />
      )}
    </div>
  )
}

// =================================================================
// --- COMPONENTES AUXILIARES GERAIS ---
// =================================================================
// =================================================================
// --- LÓGICA DE DADOS DE DESEMPENHO ---
// =================================================================

// =================================================================
// --- LÓGICA DE DADOS DE DESEMPENHO POR PERÍODO LETIVO (FINAL) ---
// =================================================================

// =================================================================
// --- LÓGICA DE DADOS DE DESEMPENHO POR PERÍODO LETIVO (FINAL) ---
// =================================================================

// =================================================================
// --- LÓGICA DE DADOS DE DESEMPENHO ATUALIZADA (COM REPROVADOS) ---
// =================================================================

// =================================================================
// --- LÓGICA DE DADOS DE DESEMPENHO ATUALIZADA (COM CHECK DE NULL) ---
// =================================================================

function usePerformanceData(subjects: Subject[]) {
    
    // 🛑 CORREÇÃO CRÍTICA: Garante que subjects seja um array mesmo se undefined/null.
    const validSubjects = subjects || []; 
    
    const currentPeriod = getCurrentAcademicPeriod();
    const isValidPeriodFormat = (value: string) => /^\d{4}\/[12]$/.test(value);

    // 1. Agrupar e Calcular Métricas por Período Letivo (YYYY/S)
    const performanceByPeriod = validSubjects.reduce((acc, sub) => {
        
        let period: string | null = null;
        
    if (sub.academic_period && isValidPeriodFormat(sub.academic_period)) {
      period = sub.academic_period;
    } 
    else if (sub.semester && isValidPeriodFormat(String(sub.semester))) {
      period = String(sub.semester);
        }
        else if (sub.status === 'doing' || sub.status === 'pending') {
            period = currentPeriod;
        } 
        else {
            return acc; 
        }
        
        if (!period) return acc;
        
        acc[period] = acc[period] || { total: 0, concluded: 0, doing: 0, failed: 0 }; 
        
        acc[period].total += 1;
        
        const isApproved = sub.status === 'done' && sub.grade && sub.grade >= 6;
        const isDoing = sub.status === 'doing';
        const isFailed = sub.status === 'failed' || (sub.grade !== undefined && sub.grade < 6 && sub.status !== 'doing');

        if (isApproved) {
            acc[period].concluded += 1;
        } 
        
        if (isDoing) {
            acc[period].doing += 1;
        } 
        
        if (isFailed) {
            acc[period].failed += 1;
        }
        
        return acc;
    }, {} as Record<string, { total: number, concluded: number, doing: number, failed: number }>);

    // 2. Calcular Porcentagem de Desempenho e Ordenar
    // Esta linha agora está segura, pois performanceByPeriod será sempre um objeto ({})
    const sortedPerformance = Object.keys(performanceByPeriod).sort((a, b) => {
        if (a > b) return 1;
        if (a < b) return -1;
        return 0;
    }).map(period => {
        const data = performanceByPeriod[period];
        
        const totalEvaluated = data.concluded + data.failed;
        const successRate = totalEvaluated > 0 ? (data.concluded / totalEvaluated) * 100 : 0;
        
        return {
            period: period, 
            total: data.total,
            concluded: data.concluded,
            doing: data.doing,
            failed: data.failed,
            successPercentage: Math.round(successRate),
            totalEvaluated: totalEvaluated,
            isCurrent: period === currentPeriod 
        };
    });

    return sortedPerformance;
}

// =================================================================
// --- COMPONENTE VISUAL: PERFORMANCE VIEW (A FUNÇÃO PRINCIPAL QUE FALTAVA) ---
// =================================================================

// --- Componente Auxiliar para Exibir o Desempenho por Período ---
// IMPORTANTE: Use este nome, e não SemesterPerformanceCard
// --- Componente Auxiliar para Exibir o Desempenho por Período ---
function PeriodPerformanceCard({ data }: { data: ReturnType<typeof usePerformanceData>[0] }) {
    
    const performanceColor = data.successPercentage >= 80 ? 'text-emerald-400' : 
                             data.successPercentage >= 50 ? 'text-yellow-400' : 'text-red-400';

    const barColor = data.successPercentage >= 80 ? 'bg-emerald-600' : 
                     data.successPercentage >= 50 ? 'bg-yellow-600' : 'bg-red-600';
    
    const totalEvaluated = data.totalEvaluated; 

    return (
        <div className="bg-[#1D1F24] border border-white/5 p-6 rounded-2xl shadow-lg">
            <h3 className="text-xl font-bold text-white border-b border-white/5 pb-3 mb-4 flex items-center justify-between">
                
                <span className="flex items-center gap-3">
                    {data.period} 
                    {data.isCurrent && (
                        <span className="text-xs px-3 py-1 bg-purple-600/30 text-purple-400 rounded-full font-medium">
                            Período Atual
                        </span>
                    )}
                </span>

                <span className={`text-2xl font-extrabold flex items-center gap-2 ${performanceColor}`}>
                    <TrendingUp size={24} /> {data.successPercentage}%
                </span>
            </h3>

            {/* Barras de Progresso */}
            <div className="mb-4">
                <div className="w-full bg-[#0F1115] rounded-full h-2.5">
                    <div 
                        className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`} 
                        style={{ width: `${data.successPercentage}%` }}
                    ></div>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                    Taxa de Sucesso ({data.concluded} aprovadas de {totalEvaluated} avaliadas)
                </p>
            </div>

            {/* Métricas Detalhadas (AGORA COM 3 COLUNAS) */}
            <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-4">
                <PerformanceMetric icon={<CheckCircle size={20} className="text-emerald-400" />} label="Aprovadas" value={data.concluded} />
                <PerformanceMetric icon={<Clock size={20} className="text-orange-400" />} label="Cursando" value={data.doing} />
                {/* NOVO: Reprovados */}
                <PerformanceMetric icon={<X size={20} className="text-red-400" />} label="Reprovados" value={data.failed} />
            </div>
        </div>
    );
}

// --- Componente Principal (PerformanceView) ---
// Ele DEVE usar o PeriodPerformanceCard, e não SemesterPerformanceCard
function PerformanceView({ subjects }: { subjects: Subject[] }) {
    
    const semesterData = usePerformanceData(subjects);
    
    return (
        <div className="max-w-6xl mx-auto">
            <header className="mb-8 flex items-center gap-3">
                <div className="bg-purple-500/10 p-3 rounded-xl"><BarChart className="text-purple-400" size={32} /></div>
                <div><h2 className="text-3xl font-bold text-white">Desempenho Acadêmico</h2></div>
            </header>
            
            <p className="text-slate-400 mb-6">Métricas detalhadas por período letivo (Ano/Semestre).</p>

            <div className="space-y-6">
                {semesterData.map((data, index) => (
                    <PeriodPerformanceCard key={index} data={data} /> // <--- CORREÇÃO: USANDO PeriodPerformanceCard
                ))}
            </div>

            {semesterData.length === 0 && (
                <div className="text-center py-16 text-slate-500 bg-[#16181D] rounded-xl">
                    Nenhuma disciplina cadastrada para calcular o desempenho.
                </div>
            )}
        </div>
    );
}

// Componente Auxiliar
function PerformanceMetric({ icon, label, value }: { icon: React.ReactNode, label: string, value: number }) {
  return (
    <div className="flex flex-col items-center p-3 bg-[#0F1115] rounded-lg">
      {icon}
      <span className="text-xl font-bold text-white mt-1">{value}</span>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

// --- MODAL DE CRIAÇÃO/EDIÇÃO DE HORÁRIO ---
function ScheduleModal({ item, subjects, onSave, onDelete, onClose }: { item: ScheduleItem, subjects: Subject[], onSave: (data: ScheduleItem) => void, onDelete?: (id: string) => void, onClose: () => void }) {
    const isNew = item.id === 'new';
    const [scheduleData, setScheduleData] = useState<ScheduleItem>(item);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setScheduleData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!scheduleData.title.trim() || !scheduleData.startTime || !scheduleData.endTime) {
            alert("Título, hora de início e hora de fim são obrigatórios.");
            return;
        }
        onSave(scheduleData);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1A1D24] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">{isNew ? 'Novo Horário' : 'Editar Horário'}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* TÍTULO */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Título</label>
                        <input
                            type="text"
                            name="title"
                            value={scheduleData.title}
                            onChange={handleChange}
                            placeholder="Ex: Cálculo I (Aula Teórica)"
                            className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* TIPO */}
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Tipo</label>
                            <select
                                name="type"
                                value={scheduleData.type}
                                onChange={handleChange}
                                className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                            >
                                <option value="Aula">Aula</option>
                                <option value="Trabalho">Trabalho/Estudo</option>
                                <option value="Compromisso">Compromisso</option>
                            </select>
                        </div>
                        
                        {/* DIA DA SEMANA */}
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Dia</label>
                            <select
                                name="day"
                                value={scheduleData.day}
                                onChange={handleChange}
                                className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                            >
                                {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* START TIME */}
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Início</label>
                            <input
                                type="time"
                                name="startTime"
                                value={scheduleData.startTime}
                                onChange={handleChange}
                                className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                required
                            />
                        </div>
                        
                        {/* END TIME */}
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Fim</label>
                            <input
                                type="time"
                                name="endTime"
                                value={scheduleData.endTime}
                                onChange={handleChange}
                                className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                required
                            />
                        </div>
                    </div>
                    
                    {/* DISCIPLINA (Opcional - ÚNICA SELEÇÃO) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Vincular Disciplina (Opcional)</label>
                        <select
                            name="subjectId"
                            value={scheduleData.subjectId || ''}
                            onChange={(e) => setScheduleData(prev => ({ ...prev, subjectId: e.target.value || undefined }))}
                            className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                        >
                            <option value="">(Nenhuma)</option>
                            {subjects.map(sub => (
                                <option key={sub.id} value={sub.id}>{sub.code} - {sub.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                        {onDelete && !isNew ? (
                            <button
                                type="button"
                                onClick={() => {
                                    onDelete(item.id);
                                    onClose(); // Fecha o modal após deletar
                                }}
                                className="text-red-400 hover:text-red-300 p-2 transition-colors flex items-center gap-1"
                            >
                                <Trash2 size={18} /> Excluir
                            </button>
                        ) : (
                            <div/>
                        )}
                        <button
                            type="submit"
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
                        >
                            <Save size={18} /> {isNew ? 'Criar Horário' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}


// --- COMPONENTES AUXILIARES DE TAREFAS ---
function TasksView({ tasks, onOpenModal, onMoveTask, onDeleteTask }: any) {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Filtragem
  const filteredTasks = tasks
    .filter((t: Task) => priorityFilter === 'all' || t.priority === priorityFilter)
    .filter((t: Task) => t.title.toLowerCase().includes(searchTerm.toLowerCase()))

  // Sumário
  const summary = `${tasks.filter((t: Task) => t.status === 'todo').length} a fazer . ${tasks.filter((t: Task) => t.status === 'doing').length} em progresso . ${tasks.filter((t: Task) => t.status === 'done').length} concluído`

  const todo = filteredTasks.filter((t: Task) => t.status === 'todo')
  const doing = filteredTasks.filter((t: Task) => t.status === 'doing')
  const done = filteredTasks.filter((t: Task) => t.status === 'done')

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <CheckSquare className="text-purple-400" /> Tarefas
          </h2>
          <p className="text-slate-400 mt-1">{summary}</p> 
        </div>
        <button onClick={() => onOpenModal(null)} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20">
          <Plus size={18} /> Nova Tarefa
        </button>
      </header>
      
      {/* Barra de Controles */}
      <div className="flex justify-between items-center mb-6 bg-[#16181D] border border-white/5 rounded-xl p-4">
        {/* Busca por Tarefa */}
        <div className="relative w-1/3 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por título..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full bg-[#0F1115] border border-white/5 rounded-lg py-2 pl-10 pr-4 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500" 
          />
        </div>

        {/* Filtros de Prioridade */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 hidden sm:block">Prioridade:</span>
          {['all', 'low', 'medium', 'high'].map(p => (
            <FilterButton key={p} 
              active={priorityFilter === p} 
              onClick={() => setPriorityFilter(p as any)}
              label={p === 'all' ? 'Todas' : p.charAt(0).toUpperCase() + p.slice(1)}
              color={p === 'all' ? 'slate' : p === 'high' ? 'red' : p === 'medium' ? 'yellow' : 'blue'}
            />
          ))}
        </div>

        {/* Alternância de Visualização */}
        <div className="flex gap-2 text-slate-400">
          <button onClick={() => setViewMode('kanban')} className={`p-2 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-purple-600 text-white' : 'hover:bg-white/5'}`} title="Kanban">
            <LayoutDashboard size={18} />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'hover:bg-white/5'}`} title="Lista">
            <List size={18} />
          </button>
        </div>
      </div>
      
      {/* Conteúdo da Visualização */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
          <KanbanColumn 
            title="A Fazer" count={todo.length} icon={<Circle size={18} />} color="text-slate-400"
            tasks={todo} onMove={onMoveTask} onDelete={onDeleteTask} onOpenModal={onOpenModal}
          />
          <KanbanColumn 
            title="Fazendo" count={doing.length} icon={<Clock size={18} />} color="text-orange-400"
            tasks={doing} onMove={onMoveTask} onDelete={onDeleteTask} onOpenModal={onOpenModal}
          />
          <KanbanColumn 
            title="Concluído" count={done.length} icon={<CheckCircle size={18} />} color="text-emerald-400"
            tasks={done} onMove={onMoveTask} onDelete={onDeleteTask} onOpenModal={onOpenModal}
          />
        </div>
      ) : (
        <ListView 
          tasks={filteredTasks} 
          onMoveTask={onMoveTask} 
          onDeleteTask={onDeleteTask} 
          onOpenModal={onOpenModal}
        />
      )}
    </div>
  )
}

function KanbanColumn({ title, count, icon, color, tasks, onMove, onDelete, onOpenModal }: any) {
  return (
    <div className="bg-[#16181D] border border-white/5 rounded-xl flex flex-col h-full">
      <div className="p-3 border-b border-white/5 flex justify-between items-center">
        <div className={`flex items-center gap-2 font-medium text-sm ${color}`}>
          {icon} <span>{title}</span>
          <span className="bg-[#1A1D24] text-slate-400 px-2 py-0.5 rounded-full text-xs">{count}</span>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col gap-2 overflow-y-auto">
        {tasks.map((task: Task) => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onMove={onMove} 
            onDelete={onDelete} 
            onOpenModal={onOpenModal}
          />
        ))}
        {tasks.length === 0 && (
          <p className="text-center text-slate-600 text-sm italic py-4">Nenhuma tarefa aqui.</p>
        )}
      </div>
    </div>
  )
}

function TaskCard({ task, onMove, onDelete, onOpenModal }: any) {
  
  const getPriorityColor = (priority: Task['priority']) => {
    if (priority === 'high') return 'bg-red-500' 
    if (priority === 'medium') return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  return (
    <div className="bg-[#1D1F24] p-3 rounded-lg border border-white/5 hover:border-purple-500/30 group relative transition-all shadow-sm">
      <div className="flex justify-between items-start mb-1">
        
        {/* Título (Apenas Leitura, Clicar no ícone de edição) */}
        <h4 className="text-slate-200 font-medium text-sm pr-6 break-words">
          {task.title || "(Sem Título)"}
        </h4>

        {/* Bolinha de Prioridade (Não Clicável Aqui) */}
        <div 
          className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${getPriorityColor(task.priority)}`} 
          title={`Prioridade: ${task.priority}`}
        />
      </div>
      
      {/* Botões de Ação no Canto */}
      <div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => onOpenModal(task)}
          className="p-1 text-slate-500 hover:text-purple-400 hover:bg-purple-900/20 rounded-md"
          title="Editar Tarefa"
        >
          <Edit size={12} />
        </button>
        <button 
          onClick={() => onDelete(task.id)}
          className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-md"
          title="Excluir"
        >
          <Trash2 size={12} />
        </button>
      </div>


      {/* Botões de Movimentação */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
        {task.status !== 'todo' && <button onClick={() => onMove(task.id, 'todo')} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded hover:text-white">To Do</button>}
        {task.status !== 'doing' && <button onClick={() => onMove(task.id, 'doing')} className="text-[10px] bg-slate-800 text-orange-400 px-2 py-0.5 rounded hover:text-white">Doing</button>}
        {task.status !== 'done' && <button onClick={() => onMove(task.id, 'done')} className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded hover:text-white">Done</button>}
      </div>
    </div>
  )
}

function ListView({ tasks, onMoveTask, onDeleteTask, onOpenModal }: any) {
  const sortedTasks = [...tasks].sort((a: Task, b: Task) => {
    const statusOrder = { 'todo': 1, 'doing': 2, 'done': 3 }
    const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 }
    
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status]
    }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  const getStatusIcon = (status: Task['status']) => {
    if (status === 'done') return <CheckCircle size={16} className="text-emerald-400" />
    if (status === 'doing') return <Clock size={16} className="text-orange-400" />
    return <Circle size={16} className="text-slate-400" />
  }

  const getPriorityColor = (priority: Task['priority']) => {
    if (priority === 'high') return 'bg-red-500 shadow-md shadow-red-900/50'
    if (priority === 'medium') return 'bg-yellow-500 shadow-md shadow-yellow-900/50'
    return 'bg-blue-500 shadow-md shadow-blue-900/50'
  }

  return (
    <div className="bg-[#16181D] border border-white/5 rounded-xl overflow-hidden shadow-lg min-h-full">
      <table className="w-full text-left">
        <thead className="bg-[#0F1115] text-slate-400 border-b border-white/5">
          <tr>
            <th className="p-4 w-[10%]">Status</th>
            <th className="p-4 w-[10%]">Prioridade</th>
            <th className="p-4 w-[60%]">Título</th>
            <th className="p-4 w-[20%] text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {sortedTasks.map((task: Task) => (
            <tr key={task.id} className="hover:bg-white/5 transition-colors">
              <td className="p-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(task.status)}
                  <span className="text-sm capitalize text-slate-300">{task.status === 'todo' ? 'A fazer' : task.status === 'doing' ? 'Fazendo' : 'Concluído'}</span>
                </div>
              </td>
              <td className="p-4">
                <button 
                  onClick={() => onOpenModal(task)}
                  className={`w-3 h-3 rounded-full cursor-pointer hover:scale-125 transition-transform ${getPriorityColor(task.priority)}`} 
                  title={`Prioridade: ${task.priority} (Clique para editar)`}
                />
              </td>
              <td className="p-4">
                 <button onClick={() => onOpenModal(task)} className="text-slate-200 text-sm hover:text-purple-300 transition-colors w-full text-left">{task.title}</button>
              </td>
              <td className="p-4 text-right">
                <div className="flex justify-end gap-2">
                  {task.status !== 'todo' && <button onClick={() => onMoveTask(task.id, 'todo')} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded hover:text-white">To Do</button>}
                  {task.status !== 'doing' && <button onClick={() => onMoveTask(task.id, 'doing')} className="text-[10px] bg-slate-800 text-orange-400 px-2 py-1 rounded hover:text-white">Doing</button>}
                  {task.status !== 'done' && <button onClick={() => onMoveTask(task.id, 'done')} className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-1 rounded hover:text-white">Done</button>}
                  <button onClick={() => onDeleteTask(task.id)} className="p-1 ml-2 text-slate-600 hover:text-red-400"><Trash2 size={16} /></button>
                </div>
              </td>
            </tr>
          ))}
          {sortedTasks.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center text-slate-500 py-8">Nenhuma tarefa encontrada com os filtros atuais.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function FilterButton({ active, onClick, label, color }: { active: boolean, onClick: () => void, label: string, color: 'slate' | 'red' | 'yellow' | 'blue' }) {
  const baseClasses = "text-xs px-3 py-1.5 rounded-full font-medium transition-all"
  const activeClasses = {
    'slate': 'bg-slate-700 text-white',
    'red': 'bg-red-900/40 text-red-300 border border-red-500/30',
    'yellow': 'bg-yellow-900/40 text-yellow-300 border border-yellow-500/30',
    'blue': 'bg-blue-900/40 text-blue-300 border border-blue-500/30',
  }[color]
  const inactiveClasses = "bg-slate-800 text-slate-400 hover:bg-slate-700/50"

  return (
    <button onClick={onClick} className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}>
      {label}
    </button>
  )
}

// Componente simples de filtro dropdown usado na Matriz Curricular
function DropdownFilter({ label, options, onSelect }: { label: string, options: string[], onSelect: (v: string) => void }) {
  return (
    <div className="">
      <select
        value={label}
        onChange={(e) => onSelect(e.target.value)}
        className="bg-[#1D2430] border border-white/5 text-slate-200 rounded-xl py-3 px-4 focus:outline-none"
      >
        {options.map(opt => (
          <option key={opt} value={opt} className="text-slate-800">{opt}</option>
        ))}
      </select>
    </div>
  )
}

// =================================================================
// --- TELA MATRIZ CURRICULAR AVANÇADA ---
// =================================================================

// ----------------------------------------------------------------
// --- TELA MATRIZ CURRICULAR AVANÇADA ---
// ----------------------------------------------------------------

function MatrixAdvancedView({ subjects, onDelete: _onDelete, onOpenModal }: { subjects: Subject[], onDelete: (id: string) => void, onOpenModal: (sub: Subject | null) => void }) {
    const [searchTerm, setSearchTerm] = useState('')
    const [filterSemester, setFilterSemester] = useState('Todos Semestres')
    const [filterStatus, setFilterStatus] = useState('Todos Status')
    // NOVO ESTADO: Controla a sub-aba ativa ('grade' ou 'dependencias')
    const [subView, setSubView] = useState<'grade' | 'dependencias'>('grade'); 

  // 1. Agrupar por Semestre (mantendo a ordem original, se possível)
  const semesters = Array.from(new Set(subjects.map(s => String(s.semester)))).sort()

  // Mostrar repetições (por padrão false) — Option B: repetições ficam ocultas até o usuário pedir
  const [showRepetitions, setShowRepetitions] = useState(false);

  // 2. Filtragem
  const filteredSubjects = subjects
    // Filtra repetições por padrão (se is_current_attempt === false é considerado repetição/oculto)
    // Mas garante que disciplinas aprovadas (status === 'done') sempre apareçam
    .filter(sub => showRepetitions ? true : (sub.is_current_attempt !== false || sub.status === 'done'))
    .filter(sub => 
      (filterSemester === 'Todos Semestres' || String(sub.semester) === filterSemester)
    )
        .filter(sub => 
            (filterStatus === 'Todos Status' || sub.status === (filterStatus === 'Em Curso' ? 'doing' : filterStatus === 'Concluída' ? 'done' : 'pending'))
        )
        .filter(sub => 
            sub.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            sub.code.toLowerCase().includes(searchTerm.toLowerCase())
        )
    
    // 3. Agrupamento final por semestre (para o display)
// --- DENTRO DE function MatrixAdvancedView(...) > Agrupamento Final ---

// --- DENTRO DE function MatrixAdvancedView(...) > Agrupamento Final ---
const groupedSubjects = filteredSubjects.reduce((acc, sub) => {
  // 🛑 FILTRO DE DESEMPENHO (isAcademicPeriod) FOI REMOVIDO DAQUI!
    
  // Matriz Curricular usa apenas o campo 'semester' (1º Semestre, etc.) — normaliza para string
  const semesterStr = String(sub.semester || '').trim();
  const semesterKey = semesterStr !== '' ? semesterStr : 'Sem Semestre';
    
  acc[semesterKey] = acc[semesterKey] || [];
  acc[semesterKey].push(sub);
  return acc;
}, {} as Record<string, Subject[]>);
    // Ordenar os grupos pelo número do semestre (1º, 2º, 3º, etc.)
    const sortedGroups = Object.keys(groupedSubjects).sort((a, b) => {
        // Extrai o número do semestre (ex: '1º Semestre' -> 1)
        const numA = parseInt(a.replace('º Semestre', '').replace('º', '')) || 0;
        const numB = parseInt(b.replace('º Semestre', '').replace('º', '')) || 0;
        return numA - numB;
    });

    return (
        <div className="max-w-7xl mx-auto min-h-full flex flex-col">
            <header className="mb-6">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                    <BookOpen className="text-purple-400" /> Matriz Curricular
                </h2>
                <p className="text-slate-400 mt-1">{subjects.length} disciplinas cadastradas</p>
            </header>

            {/* BARRA DE FILTROS E BUSCA */}
           

          {/* BARRA DE FILTROS E BUSCA (Corrigido) */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
              
              {/* Busca */}
              <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input 
                      type="text" 
                      placeholder="Buscar disciplina..." 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                      className="w-full bg-[#1D2430] border border-white/5 rounded-xl py-3 pl-12 pr-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50" 
                  />
              </div>

              {/* Filtro Semestre */}
              <DropdownFilter 
                  label={filterSemester}
                  options={['Todos Semestres', ...semesters]}
                  onSelect={setFilterSemester}
              />

              {/* Filtro Status */}
              <DropdownFilter 
                  label={filterStatus}
                  options={['Todos Status', 'Concluída', 'Em Curso', 'Pendente']}
                  onSelect={setFilterStatus}
              />
              
              {/* Botão Nova Disciplina (Corrigido o alinhamento) */}
              <button 
                  onClick={() => onOpenModal(null)}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-3 rounded-xl font-medium flex items-center gap-2 transition-all"
              >
                  <Plus size={18} /> Nova Disciplina
              </button>
              
        {/* Toggle para mostrar repetições (Option B) */}
        <div className="flex items-center gap-2 ml-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={showRepetitions} onChange={() => setShowRepetitions(!showRepetitions)} className="w-4 h-4" />
            <span>Mostrar repetições</span>
          </label>
        </div>
          </div>

          {/* SWITCH TABS (Grade / Dependências) */}
          <div className="flex gap-4 mb-8 border-b border-white/5">
              <button 
                  onClick={() => setSubView('grade')} 
                  className={`px-4 py-2 font-bold transition-colors ${subView === 'grade' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-slate-400 hover:text-slate-200'}`}
              >
                  Grade
              </button>
              <button 
                  onClick={() => setSubView('dependencias')} 
                  className={`px-4 py-2 font-bold transition-colors ${subView === 'dependencias' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-slate-400 hover:text-slate-200'}`}
              >
                  Dependências
              </button>
          </div>

{/* ... (restante da MatrixAdvancedView) ... */}
            
            {/* CONTEÚDO (Condicional baseado na subView) */}
            {subView === 'grade' ? (
                <div className="space-y-10 pb-10">
                    {sortedGroups.length > 0 ? (
                        sortedGroups.map(semester => (
                            <div key={semester}>
                                <h3 className="text-xl font-bold text-slate-300 mb-4 flex items-center gap-2">
                                    {semester} <span className="text-sm text-slate-500">({groupedSubjects[semester].length})</span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {groupedSubjects[semester].map(sub => (
                                        <SubjectCard 
                                            key={sub.id} 
                                            subject={sub} 
                                            onClick={() => onOpenModal(sub)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-16 text-slate-500">
                            Nenhuma disciplina encontrada com os filtros e busca atuais.
                        </div>
                    )}
                </div>
            ) : (
                <DependenciesContent subjects={subjects} />
            )}
        </div>
    );
}

// --- CARD DE DISCIPLINA ---
// --- CARD DE DISCIPLINA ---
function SubjectCard({ subject, onClick }: { subject: Subject, onClick: () => void }) {
    
    // Configuração de Status (Garanta que 'statusConfig' esteja definido no topo do arquivo)
    const statusConfig: any = {
      todo: { 
        label: 'A FAZER',
        color: 'text-slate-400',
        bg: 'bg-slate-700/30',
        border: 'border-slate-700'
      },
      doing: { 
        label: 'EM CURSO',
        color: 'text-orange-400',
        bg: 'bg-orange-700/30',
        border: 'border-orange-700'
      },
      done: { 
        label: 'CONCLUÍDA',
        color: 'text-emerald-400',
        bg: 'bg-emerald-700/30',
        border: 'border-emerald-700'
      },
      pending: { 
        label: 'PENDENTE',
        color: 'text-slate-400',
        bg: 'bg-slate-700/30',
        border: 'border-slate-700'
      },
      failed: { 
        label: 'REPROVADA',
        color: 'text-red-400',
        bg: 'bg-red-700/30',
        border: 'border-red-700'
      }
    };
    
    const getStatusConfig = (status: Subject['status']) => {
        // Tenta pegar a config exata, senão usa pending como fallback
        return statusConfig[status] || statusConfig.pending; 
    };

    const currentStatus = subject.grade !== undefined && subject.grade >= 6 ? 'done' : subject.status;
    const config = getStatusConfig(currentStatus);


    return (
        <div 
            onClick={onClick}
            className="bg-[#16181D] border border-white/5 rounded-xl p-4 shadow-lg flex flex-col hover:border-purple-500/30 transition-all cursor-pointer"
        >
            
            {/* Status e Código */}
            <div className="flex justify-between items-center mb-3">
                {/* APLICA AS CORES DO OBJETO CONFIG */}
                <span className={`text-xs font-bold px-2 py-1 rounded-full border ${config.bg} ${config.color} ${config.border.replace('border-', 'border-')}`}>
                    {config.label}
                </span>
                <span className="text-sm text-slate-500 font-medium">{subject.code}</span>
            </div>

            {/* Conteúdo Principal */}
            <div className="flex-grow">
                <h4 className="text-slate-200 font-bold text-lg leading-tight">{subject.name}</h4>
                <p className="text-sm text-slate-500 mt-1">{subject.credits}h</p>
            </div>
            
            {/* Footer: Semestre e Nota */}
          <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
        <div className="text-sm text-slate-400">
          <span className="font-bold">{String(subject.semester).replace('Semestre', 'Sem')}</span>
        </div>
                <div className="text-sm text-slate-400">
                    Nota: <span className={`font-bold ${currentStatus === 'done' ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {subject.grade ? subject.grade.toFixed(1) : '-'}
                    </span>
                </div>
            </div>
        </div>
    );
}
// =================================================================
// --- MODAIS DETALHADOS E OUTRAS VIEWS ---
// =================================================================

// --- MODAL DE DETALHES DA DISCIPLINA ---
// NOTA: Certifique-se de que a função getCurrentAcademicPeriod() esteja definida no topo do seu App.tsx

// --- SUBSTITUA A FUNÇÃO SubjectDetailModal INTEIRA ---
function SubjectDetailModal({ subject, subjects, onSave, onDelete, onClose }: { subject: Subject, subjects: Subject[], onSave: (data: Subject) => void, onDelete: (id: string) => void, onClose: () => void }) {
    const [data, setData] = useState<Subject>(subject);
    const [isEditing, setIsEditing] = useState(true); // Se você deixou o default como true
    const [showPrerequisites, setShowPrerequisites] = useState(false); 

    // --- DENTRO DE function SubjectDetailModal(...)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let newValue: any = value;

        if (name === 'grade') {
            newValue = parseFloat(value) || undefined;
        }
        
        // 🛑 CORREÇÃO CRÍTICA: Removendo o .trim() para os campos de texto.
        // O trim() deve ser aplicado apenas em 'semester' para garantir consistência.
        if (name === 'semester') {
            newValue = value.trim(); 
        } else if (name === 'name' || name === 'code') {
            // Para 'name' e 'code', usamos o valor literal (permitindo espaços internos)
            newValue = value; 
        }

        setData(prev => ({ ...prev, [name]: newValue }));
    };

    const handlePrereqChange = (newPrereqs: string) => {
        setData(prev => ({ ...prev, finalNote: newPrereqs }));
    };
    
    const handleStatusChange = (status: Subject['status']) => {
        let newGrade = data.grade;

        if (status === 'done' && (newGrade === undefined || newGrade < 6)) {
             newGrade = 10; 
        } else if (status !== 'done' && newGrade !== undefined && newGrade >= 6) {
             newGrade = undefined; 
        }

        setData(prev => ({ 
            ...prev, 
            status: status, 
            grade: newGrade 
        }));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(data);
        setIsEditing(false);
    };

  const handleRepeatAttempt = () => {
    // Marca a tentativa atual como reprovada (adiciona ao histórico) e cria uma nova tentativa
    const previousId = data.id;

    // Nova tentativa sucessora: id com prefix 'new' + previousId para o App reconhecer como repetição
    const newAttempt: Subject = {
      ...data,
      id: 'new' + previousId,
      parentId: previousId,
      // reset
      attempts: [],
      academic_period: getCurrentAcademicPeriod(),
      grade: undefined,
      status: 'doing',
      // Para a opção B, mantemos a nova tentativa fora da Matriz por padrão
      is_current_attempt: false,
    };

    // Chamamos onSave com a nova tentativa; handleSaveSubject fará a lógica de deslocar a anterior para o histórico
    onSave(newAttempt);
    onClose();
  };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1A1D24] border border-white/10 w-full max-w-2xl rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                
                {/* CABEÇALHO (Agora mais simples) */}
                <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <CapIcon className="text-purple-400" size={32} />
                        {/* Removemos o nome e o código daqui para colocá-los como inputs abaixo */}
                        <div>
                            <h2 className="text-2xl font-bold text-white">{data.name}</h2>
                            <p className="text-sm text-slate-400">{data.code} • {data.semester}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* NOVO BLOCO: NOME E CÓDIGO EDITÁVEIS */}
                    <div className="grid grid-cols-3 gap-4">
                        {/* Nome da Disciplina */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-400 mb-1">Nome da Disciplina</label>
                            <input
                                type="text"
                                name="name"
                                value={data.name}
                                onChange={handleChange}
                                placeholder="Nome Completo"
                                className="w-full bg-academic-dark border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                disabled={!isEditing}
                                required
                            />
                        </div>
                        {/* Código */}
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Código</label>
                            <input
                                type="text"
                                name="code"
                                value={data.code}
                                onChange={handleChange}
                                placeholder="Ex: EC301"
                                className="w-full bg-[#1D2430] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                disabled={!isEditing}
                                required
                            />
                        </div>
                    </div>
                    
                    {/* BLOCO DE STATUS, PERÍODO LETIVO E NOTA (Fixos) */}
                      <div className="grid grid-cols-3 gap-4 bg-[#0F1115] p-4 rounded-xl border border-white/5">
                          
                          {/* 1. Status */}
                          <div>
                              <label className="block text-sm font-medium text-purple-400 mb-1">Status</label>
                              <select
                                  name="status"
                                  value={data.status}
                                  onChange={(e) => handleStatusChange(e.target.value as Subject['status'])}
                                  className="w-full bg-[#1D2430] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                  disabled={!isEditing}
                              >
                                  <option value="done">Concluída (Aprovada)</option>
                                  <option value="doing">Em Curso</option>
                                  <option value="pending">Pendente</option> 
                                  <option value="failed">Reprovada</option> 
                              </select>
                          </div>
                          
                          {/* 2. NOVO CAMPO: Período Letivo (academic_period) */}
                          <div>
                              <label className="block text-sm font-medium text-purple-400 mb-1">Período Letivo (Desempenho)</label>
                              <input
                                  type="text"
                                  name="academic_period" // <-- NOVO CAMPO
                                  value={data.academic_period || ''}
                                  onChange={handleChange}
                                  placeholder={typeof getCurrentAcademicPeriod === 'function' ? getCurrentAcademicPeriod() : 'Ex: 2025/1'}
                                  className="w-full bg-[#1D2430] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                  disabled={!isEditing}
                              />
                              <p className="text-xs text-slate-500 mt-1">Para o Dashboard de Desempenho (YYYY/S)</p>
                          </div>


                          {/* 3. Nota Final */}
                          <div>
                              <label className="block text-sm font-medium text-purple-400 mb-1">Nota Final (0.0 - 10.0)</label>
                              <input
                                  type="number"
                                  name="grade"
                                  value={data.grade !== undefined ? data.grade : ''}
                                  onChange={handleChange}
                                  placeholder="Ex: 8.5"
                                  step="0.1"
                                  min="0"
                                  max="10"
                                  className="w-full bg-[#1D2430] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                  disabled={!isEditing}
                              />
                          </div>
                      </div>

                      {/* NOVO INPUT: O CAMPO SEMESTRE ORIGINAL (Matriz Curricular) precisa ser re-adicionado se você o removeu. 
                          Se você o tem em outro lugar, pode ignorar este bloco. */}
                      <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-1">
                              <label className="block text-sm font-medium text-slate-400 mb-1">Semestre Matriz (1º, 2º, etc.)</label>
                              <input
                                  type="text"
                                  name="semester" // <-- CAMPO ORIGINAL
                                  value={data.semester}
                                  onChange={handleChange}
                                  placeholder="Ex: 1º Semestre"
                                  className="w-full bg-[#1D2430] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                  disabled={!isEditing}
                              />
                          </div>
                          {/* Carga Horária e Créditos aqui (ou mantidos como somente leitura mais abaixo) */}
                      </div>
                    
                    {/* BOTÃO TOGGLE PARA PRÉ-REQUISITOS */}
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                        <button 
                            type="button"
                            onClick={() => setShowPrerequisites(!showPrerequisites)}
                            className="w-full bg-[#16181D] hover:bg-[#1A1D24] p-4 text-left flex justify-between items-center text-slate-300 font-bold transition-colors"
                        >
                            <span>
                                Pré-requisitos ({data.finalNote ? data.finalNote.split(';').filter(c => c.trim().length > 0).length : 0})
                            </span>
                            <ChevronDown size={18} className={`transition-transform ${showPrerequisites ? 'rotate-180' : 'rotate-0'}`} />
                        </button>

                        {/* SEÇÃO EXPANSÍVEL */}
                        {showPrerequisites && (
                             <div className="bg-[#0F1115] p-4">
                                <label className="block text-sm font-medium text-slate-400 mb-2">
                                    Selecione as disciplinas que são pré-requisitos:
                                </label>
                                <PrerequisiteListBox
                                    currentPrereqs={data.finalNote || ''}
                                    allSubjects={subjects} 
                                    onChange={handlePrereqChange}
                                    disabled={!isEditing}
                                    currentSubjectCode={data.code} 
                                />
                            </div>
                        )}
                    </div>
                    
                    {/* Carga Horária e Créditos (Somente Leitura) */}
                    <div className="flex justify-between text-sm text-slate-500 pt-2 border-t border-white/5">
                        <span>Carga Horária: **{data.credits}h**</span>
                        <span>Créditos: **{data.credits / 15}**</span>
                    </div>

          {/* AÇÕES */}
          <div className="pt-4 flex justify-between items-center">
                        <button
                            type="button"
                            onClick={() => {
                                if (isEditing) {
                                    if (confirm('Descartar alterações?')) {
                                        setData(subject); // Volta aos dados originais
                                        setIsEditing(false);
                                    }
                                } else {
                                    onDelete(subject.id);
                                    onClose();
                                }
                            }}
                            className={`p-2 transition-colors flex items-center gap-1 ${isEditing ? 'text-slate-400 hover:text-white' : 'text-red-400 hover:text-red-300'}`}
                        >
                            <Trash2 size={18} /> {isEditing ? 'Cancelar Edição' : 'Excluir Disciplina'}
                        </button>

            {/* 🎯 NOVO BOTÃO DE REPETIÇÃO (Condicional) */}
            {(data.status === 'failed' && isEditing) && (
              <button
                type="button"
                onClick={handleRepeatAttempt}
                className="bg-red-700/50 hover:bg-red-600/70 text-red-300 px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition-all mr-auto"
              >
                <X size={18} /> Registrar Reprovação e Repetir
              </button>
            )}

                        {!isEditing ? (
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
                            >
                                <Edit size={18} /> Editar Detalhes
                            </button>
                        ) : (
                            <button
                                type="submit"
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
                            >
                                <Save size={18} /> Salvar Alterações
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

function DependenciesContent({ subjects }: { subjects: Subject[] }) {
    
    // Objeto statusConfig (repetido aqui para garantir o contexto, mas deve estar fora da função)
    const statusConfig: any = {
        todo: { icon: Circle, label: 'A Fazer', color: 'text-slate-400', bg: 'bg-slate-700/30', border: 'border-slate-700' },
        doing: { icon: Clock, label: 'Em Curso', color: 'text-orange-400', bg: 'bg-orange-700/30', border: 'border-orange-700' },
        done: { icon: CheckCircle, label: 'Concluída', color: 'text-emerald-400', bg: 'bg-emerald-700/30', border: 'border-emerald-700' },
        pending: { icon: Circle, label: 'Pendente', color: 'text-slate-400', bg: 'bg-slate-700/30', border: 'border-slate-700' },
        failed: { icon: X, label: 'Reprovada', color: 'text-red-400', bg: 'bg-red-700/30', border: 'border-red-700' }
    };

    // 1. Mapeamento de Dependências
    const dependencyFlow = subjects.flatMap(sub => {
        if (!sub.finalNote) return [];
        
        const prerequisites = sub.finalNote.split(';').map(p => p.trim()).filter(p => p.length > 0);

    return prerequisites.map(reqCode => {
      // Caso possa haver múltiplas entradas com o mesmo código (tentativas/repetições),
      // preferimos a tentativa atual (is_current_attempt !== false) ou uma disciplina aprovada.
      const matches = subjects.filter(s => s.code === reqCode);
      let reqSubject = undefined as Subject | undefined;
      if (matches.length === 1) reqSubject = matches[0];
      else if (matches.length > 1) {
        reqSubject = matches.find(s => s.is_current_attempt !== false) || matches.find(s => (s.grade !== undefined && s.grade >= 6)) || matches[0];
      }

      return {
        prerequisite: reqSubject,
        subject: sub,
        reqCode: reqCode
      };
    });
    });

    // 2. Função de Status Visual (AGORA MAIS INTELIGENTE)
    const getStatusVisual = (sub?: Subject) => {
        if (!sub) {
            // Se o pré-requisito for inválido/removido, consideramos 'Bloqueado'
            return { status: 'Inválido', color: statusConfig.failed.color, bg: statusConfig.failed.bg, text: statusConfig.failed.color, icon: X, key: 'invalid' };
        }
        
        const currentStatus = sub.grade !== undefined && sub.grade >= 6 ? 'done' : sub.status;
        const config = statusConfig[currentStatus] || statusConfig.pending;
        
        // Customização para a View de Dependências (para corresponder à imagem):
        let visualStatus = { ...config, status: config.label };

        if (currentStatus === 'done') {
             // Mantém esmeralda e forte para concluída
             visualStatus.color = 'text-xs font-bold px-2 py-1 rounded-full border bg-emerald-700/30 text-emerald-400 border-emerald-700"text-emerald-300';
             visualStatus.bg = 'bg-emerald-700'; // Cor de fundo mais escura/sólida
        }  else if (currentStatus === 'doing') {
             // Usa roxo para Em Curso (conforme referência da imagem)
             visualStatus.color = 'text-xs font-bold px-2 py-1 rounded-full border bg-orange-700/30 text-orange-400 border-orange-700';
             visualStatus.bg = 'bg-orange-650';
        } else {
             // PENDENTE/REPROVADA = BLOQUEADA (Vermelho na referência)
             visualStatus.status = 'Bloqueada';
             visualStatus.color = 'text-xs font-bold px-2 py-1 rounded-full border bg-red-700/30 text-red-400 border-red-700';
             visualStatus.bg = 'bg-red-700';
             visualStatus.icon = X;
        }

        return visualStatus;
    };

    // 3. Componente Bloco de Disciplina (para Pré-requisito ou Requerente)
    // ATUALIZADO: Usando as classes de BG e TEXTO da configuração
    const SubjectBlock = ({ sub, reqCode }: { sub?: Subject, reqCode: string }) => {
        const visual = getStatusVisual(sub);
        
        const label = sub ? `${sub.code} - ${sub.name.substring(0, 15)}...` : `${reqCode} (Inválido)`;
        const IconComponent = visual.icon; 
        
        return (
            <div className={`p-3 rounded-xl flex items-center gap-2 font-medium shadow-lg transition-colors 
                            ${visual.bg} ${visual.color} border border-white/10 w-full`}>
                {IconComponent && <IconComponent size={12} className={`flex-shrink-0 ${visual.color.replace('text-', 'text-')}`} />}
                <span className="truncate">{label}</span>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mt-4 mb-6">Grafo de Dependências</h3>

            {dependencyFlow.length === 0 && (
                <div className="text-center py-16 text-slate-500 bg-[#16181D] rounded-xl">
                    Nenhuma dependência cadastrada para as disciplinas atuais.
                </div>
            )}

            {/* Renderiza o Fluxo de Dependência (Pré-requisito -> Disciplina) */}
            {dependencyFlow.map((flow, index) => {
                const reqStatus = getStatusVisual(flow.prerequisite);
                
                return (
                    <div key={index} className="flex items-center space-x-4">
                        {/* Bloco do Pré-requisito (o que precisa ser feito) */}
                        <div className="w-1/2">
                            <SubjectBlock sub={flow.prerequisite} reqCode={flow.reqCode} />
                        </div>
                        
                        {/* Seta (Cor da seta baseada no status do Pré-requisito) */}
                        <div className={`flex-shrink-0 ${reqStatus.color}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
                            </svg>
                        </div>

                        {/* Bloco da Disciplina (o que está bloqueado/desbloqueado) */}
                        <div className="w-1/2">
                            <SubjectBlock sub={flow.subject} reqCode={flow.subject.code} />
                        </div>
                    </div>
                );
            })}
            
            {/* Legenda (ATUALIZADA) */}
            <div className="pt-8 text-sm text-slate-400 border-t border-white/5 space-y-2">
                <p>Status da Matéria:</p>
                <div className="flex gap-4 flex-wrap">
                    <span className="flex items-center gap-1 text-emerald-300"><CheckCircle size={14} /> Concluída</span>
                    <span className="flex items-center gap-1 text-purple-300"><Clock size={14} /> Em Curso</span>
                    <span className="flex items-center gap-1 text-red-300"><X size={14} /> Bloqueada</span>
                    <span className="flex items-center gap-1 text-slate-400"><Circle size={14} /> Pendente</span>
                </div>
            </div>
        </div>
    );
}


// --- TELA DE IMPORTAÇÃO PPC ---
function ImportPPCView({ onImportSubjects }: { onImportSubjects: (subjects: Subject[]) => void }) {
    const [rawText, setRawText] = useState('');
    const [parsedResults, setParsedResults] = useState<Omit<Subject, 'id' | 'grade' | 'status'>[]>([]);

    // Exemplo de texto adaptado para o formato que você forneceu
    const exampleText = `
        1º SEMESTRE
        EC101 – Elementos de Matemática – 60h

        2º SEMESTRE
        EC201 – Cálculo A – 60h (Pré-requisito: EC101; EC102)
        EC202 – Álgebra Linear e Geometria Analítica – 60h
        
        3º SEMESTRE
        EC301 – Cálculo B – 60h (Pré-requisito: EC201; EC202; EC203; EC204)
        EC302 – Estatística Básica – 30h
    `;

    // Função Principal de Parsed
    const processText = () => {
        const lines = rawText.split('\n');
        const results: Omit<Subject, 'id' | 'grade' | 'status'>[] = [];
        let currentSemester = '1º Semestre'; 

        const semesterPattern = /^(\d+º?\s*SEMESTRE)/i;
        
        // Captura 1: Código
        // Captura 2: Nome da Disciplina
        // Captura 3: Carga Horária
        const subjectPattern = /([A-Z0-9]{3,})\s*–\s*(.*?)\s*–\s*(\d+)\s*h/i;

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;

            // 1. Tenta detectar o cabeçalho do semestre
            const semesterMatch = trimmedLine.match(semesterPattern);
            if (semesterMatch) {
                currentSemester = semesterMatch[1].replace('SEMESTRE', 'Semestre').trim();
                return;
            }

            // 2. Tenta detectar a linha da disciplina
            const subjectMatch = trimmedLine.match(subjectPattern);
            if (subjectMatch) {
                const code = subjectMatch[1].trim();
                const nameAndPrereq = subjectMatch[2].trim();
                const credits = parseInt(subjectMatch[3]) || 60; 
                
                // Remove o bloco de pré-requisitos para ter apenas o nome
                const name = nameAndPrereq.split('(')[0].trim(); 
                
                // Tenta extrair pré-requisitos brutos (opcional, para pré-população)
                const prereqMatch = nameAndPrereq.match(/\((.*?)\)/);
                const prereqs = prereqMatch ? prereqMatch[1].replace(/pré-requisito:\s*/i, '').trim() : undefined;


        results.push({
          name: name,
          code: code,
          credits: credits,
          semester: currentSemester,
          finalNote: prereqs // Usa finalNote para guardar os pré-requisitos
        });
                return;
            }
        });

        setParsedResults(results);

        if (results.length > 0) {
            const finalSubjects: Subject[] = results.map(res => ({
                ...res,
                id: res.code,
                status: 'pending',
                grade: undefined,
            }));
            
            onImportSubjects(finalSubjects);
        } else {
             alert('Nenhuma disciplina foi reconhecida no formato esperado.');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <header className="mb-8 flex items-center gap-3">
                <div className="bg-purple-500/10 p-3 rounded-xl"><FileText className="text-purple-400" size={32} /></div>
                <div><h2 className="text-3xl font-bold text-white">Importar PPC</h2></div>
            </header>
            
            <p className="text-slate-400 mb-6">Cole o texto bruto do seu Projeto Pedagógico do Curso. O sistema tentará extrair as disciplinas, códigos e carga horária.</p>

            <div className="bg-[#16181D] border border-white/5 rounded-xl p-6 mb-8">
                <h3 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
                    <CheckCircle size={20} /> Parser Inteligente
                </h3>
                <p className="text-slate-300">O sistema reconhece automaticamente o padrão de Semestre seguido por linhas de disciplina como:</p>
                <blockquote className="bg-[#0F1115] p-3 mt-3 rounded text-sm text-yellow-300 border-l-4 border-yellow-500">
                    1º SEMESTRE <br />
                    CÓDIGO – Nome da Disciplina – 60h (e tenta extrair pré-requisitos entre parênteses)
                </blockquote>
            </div>

            <div className="mb-6">
                <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-medium text-slate-400">Texto Bruto</label>
                    <button 
                        type="button" 
                        onClick={() => setRawText(exampleText.trim())}
                        className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
                    >
                        <FileText size={16} /> Carregar Exemplo
                    </button>
                </div>
                <textarea
                    rows={15}
                    placeholder="Cole aqui o conteúdo do PPC/matriz curricular..."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full bg-[#1D2430] border border-white/5 rounded-xl p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y"
                />
            </div>

            <button 
                onClick={processText}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg shadow-purple-900/20"
            >
                <FileText size={18} /> Processar Texto
            </button>

            {/* Visualização dos Resultados (Opcional) */}
            {parsedResults.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-xl font-bold text-white mb-4">{parsedResults.length} Disciplinas Encontradas (Prontas para Importar)</h3>
                    <div className="bg-[#16181D] border border-white/5 rounded-xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-[#0F1115] text-slate-400">
                                <tr>
                                    <th className="p-3">Semestre</th>
                                    <th className="p-3">Código</th>
                                    <th className="p-3">Nome</th>
                                    <th className="p-3">Pré-req.</th>
                                    <th className="p-3">Créditos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {parsedResults.map((res, index) => (
                                    <tr key={index}>
                                        <td className="p-3 text-slate-300">{res.semester}</td>
                                        <td className="p-3 text-slate-300">{res.code}</td>
                                        <td className="p-3 text-slate-300">{res.name}</td>
                                        <td className="p-3 text-slate-500 text-xs italic">{res.finalNote || '-'}</td>
                                        <td className="p-3 text-slate-300">{res.credits}h</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}


// --- TELA DA CALCULADORA ---

function CalculatorReferenceView({ subjects, onSave }: { subjects: Subject[], onSave: (id: string, n: number) => void }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const filteredSubjects = subjects.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8 flex items-center gap-3">
        <div className="bg-purple-500/10 p-3 rounded-xl"><Calculator className="text-purple-400" size={32} /></div>
        <div><h2 className="text-3xl font-bold text-white">Calculadora de Notas</h2></div>
      </header>
      
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#1D2430] border border-white/5 rounded-xl py-4 pl-12 pr-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubjects.map(sub => (
          <div key={sub.id} onClick={() => setSelectedSubject(sub)} className="bg-[#16181D] border border-white/5 p-5 rounded-xl hover:border-purple-500/30 group cursor-pointer">
            <h3 className="font-bold text-slate-200 mb-2">{sub.code} – {sub.name}</h3>
            <div className="flex justify-between items-center pt-2 border-t border-white/5">
              <span className="text-xs text-slate-500">Média</span>
              <span className={`font-bold ${sub.grade && sub.grade >= 6 ? 'text-emerald-400' : 'text-slate-400'}`}>{sub.grade ? sub.grade.toFixed(1) : '--'}</span>
            </div>
          </div>
        ))}
      </div>

      {selectedSubject && <ModalCalculator subject={selectedSubject} onClose={() => setSelectedSubject(null)} onSave={onSave} />}
    </div>
  )
}

function ModalCalculator({ subject, onClose, onSave }: any) {
  const [method, setMethod] = useState<'aritmetica' | 'ponderada' | 'soma'>('aritmetica')
  const [grades, setGrades] = useState([{ val: '', weight: '' }, { val: '', weight: '' }])

  const calculate = () => {
    const valid = grades.map(g => ({ v: parseFloat(g.val) || 0, w: parseFloat(g.weight) || 1 }))
    if (valid.length === 0) return 0
    if (method === 'soma') return valid.reduce((acc, curr) => acc + curr.v, 0)
    if (method === 'aritmetica') return valid.reduce((acc, curr) => acc + curr.v, 0) / valid.length
    const totalW = valid.reduce((acc, curr) => acc + curr.w, 0)
    return totalW > 0 ? valid.reduce((acc, curr) => acc + (curr.v * curr.w), 0) / totalW : 0
  }

  const result = calculate()

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1D24] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        
        <div className="flex justify-between mb-6">
          <div><h3 className="text-xl font-bold text-white">{subject.code}</h3><p className="text-slate-400 text-sm">{subject.name}</p></div>
          <button onClick={onClose}><X className="text-slate-500 hover:text-white" /></button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6 bg-black/20 p-1 rounded-lg">
          {['aritmetica', 'ponderada', 'soma'].map(m => (
            <button key={m} onClick={() => setMethod(m as any)} className={`text-sm py-2 rounded capitalize transition-all ${method === m ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{m}</button>
          ))}
        </div>

        <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto">
          {grades.map((g, i) => (
            <div key={i} className="flex gap-2">
              <input placeholder={`Nota ${i+1}`} type="number" className="flex-1 bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                value={g.val} onChange={e => { const newG = [...grades]; newG[i].val = e.target.value; setGrades(newG) }} />
              {method === 'ponderada' && (<input placeholder="Peso" type="number" className="w-20 bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                  value={g.weight} onChange={e => { const newG = [...grades]; newG[i].weight = e.target.value; setGrades(newG) }} />)}
              {grades.length > 1 && (<button onClick={() => setGrades(grades.filter((_, idx) => idx !== i))} className="p-3 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg"><Trash2 size={16} /></button>)}
            </div>
          ))}
          <button onClick={() => setGrades([...grades, { val: '', weight: '' }])} className="text-xs text-purple-400 flex items-center gap-1 hover:underline mt-2"><Plus size={14} /> Adicionar nota</button>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-white/10">
          <div><p className="text-xs text-slate-500 uppercase">Média Final</p><p className={`text-3xl font-bold ${result >= 6 ? 'text-emerald-400' : 'text-slate-200'}`}>{result.toFixed(2)}</p></div>
          <button onClick={() => { onSave(subject.id, result); onClose() }} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold flex gap-2"><Save size={18} /> Salvar</button>
        </div>
      </div>
    </div>
  )
}


// --- TELA DE HORÁRIOS (GRADE COMPLETA) ---

const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => {
    const hour = i + 7; // Começa às 07:00, termina em 22:00 (último slot é 22:00)
    return `${hour.toString().padStart(2, '0')}:00`;
});

const DAYS: ScheduleItem['day'][] = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function ScheduleView({ schedule, onOpenModal }: { schedule: ScheduleItem[], onOpenModal: (day: ScheduleItem['day'] | null, startTime?: string | null, item?: ScheduleItem | null) => void }) {
    
    // Cálculo do total de horas
    const totalHours = schedule.reduce((acc, item) => {
        const start = item.startTime.split(':').map(Number);
        const end = item.endTime.split(':').map(Number);
        const startMinutes = start[0] * 60 + start[1];
        const endMinutes = end[0] * 60 + end[1];
        return acc + (endMinutes - startMinutes) / 60;
    }, 0);

    // Mapeia eventos para facilitar o acesso (Dia -> Hora de início)
    const eventsMap = schedule.reduce((acc, item) => {
        acc[item.day] = acc[item.day] || {};
        acc[item.day][item.startTime] = item;
        return acc;
    }, {} as Record<ScheduleItem['day'], Record<string, ScheduleItem>>);


    return (
        <div className="max-w-full mx-auto">
            <header className="mb-6 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Calendar className="text-purple-400" /> Grade Horária
                    </h2>
                    <p className="text-slate-400 mt-1">Organize sua semana de aulas e compromissos.</p>
                </div>
                <button 
                    onClick={() => onOpenModal('Seg', '08:00')} 
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20"
                >
                    <Plus size={18} /> Novo Horário
                </button>
            </header>

            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-[#1A1D24] border border-white/5 p-6 rounded-xl">
                    <p className="text-sm text-slate-400">Horas/Semana</p>
                    <h3 className="text-4xl font-bold mt-1 text-purple-400">{totalHours.toFixed(1)}h</h3>
                </div>
                <div className="bg-[#1A1D24] border border-white/5 p-6 rounded-xl">
                    <p className="text-sm text-slate-400">Total de Aulas</p>
                    <h3 className="text-4xl font-bold mt-1 text-white">{schedule.length}</h3>
                </div>
            </div>

            {/* Grade Horária */}
            <div className="overflow-x-auto">
                <div className="grid border border-white/5 rounded-xl overflow-hidden bg-[#16181D]" style={{ gridTemplateColumns: `50px repeat(${DAYS.length}, 1fr)` }}>
                    
                    {/* Linha de Dias da Semana (Header) */}
                    <div className="bg-[#0F1115]"></div> {/* Canto superior esquerdo */}
                    {DAYS.map(day => (
                        <div key={day} className="text-center font-bold p-3 border-l border-white/5 bg-[#0F1115] text-slate-300">
                            {day}
                        </div>
                    ))}

                    {/* Corpo da Grade */}
                    {TIME_SLOTS.map(time => (
                        <React.Fragment key={time}>
                            {/* Coluna de Horário */}
                            <div className="text-xs text-slate-500 text-right pr-2 pt-2 border-t border-white/5 bg-[#16181D]">
                                {time}
                            </div>
                            
                            {/* Células de Dias */}
                            {DAYS.map(day => {
                                const event = eventsMap[day]?.[time];
                                const isFilled = event ? true : false;

                                return (
                                    <div 
                                        key={day}
                                        className={`h-12 border-l border-t border-white/5 relative group ${isFilled ? 'hover:bg-purple-500/20' : 'hover:bg-white/5'}`}
                                        onClick={() => !isFilled && onOpenModal(day, time)} // Interatividade: Abre modal ao clicar em espaço vazio
                                    >
                                        {event && (
                                            <div 
                                                className={`absolute inset-0 p-1 text-white text-xs font-medium rounded-md cursor-pointer overflow-hidden transition-all duration-150 shadow-md ${
                                                    event.type === 'Aula' ? 'bg-purple-700 hover:bg-purple-600' : 'bg-emerald-700 hover:bg-emerald-600'
                                                }`}
                                                style={{ 
                                                    height: 'auto', 
                                                    zIndex: 10,
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Previne o clique da célula pai
                                                    onOpenModal(null, null, event); // Abre modal para edição
                                                }}
                                            >
                                                {event.title}
                                                <div className="text-[10px] opacity-70 mt-0.5">{event.startTime} - {event.endTime}</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                    {/* Linha para o horário final (23:00) */}
                    <div className="text-xs text-slate-500 text-right pr-2 pt-2 border-t border-white/5 bg-[#16181D]">
                        23:00
                    </div>
                    {DAYS.map(day => (
                        <div key={day} className="h-12 border-l border-t border-white/5 bg-[#16181D]"></div>
                    ))}

                </div>
            </div>
        </div>
    );
}


// --- COMPONENTE AUXILIAR: MODAL DE NOTAS ---
function NotesView({ notes, subjects, onOpenModal, onDeleteNote }: { notes: Note[], subjects: Subject[], onOpenModal: (n: Note | null) => void, onDeleteNote: (id: string) => void }) {
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState('')

  const filtered = notes.filter(n => {
    if (search && !((n.title || '').toLowerCase().includes(search.toLowerCase()) || (n.content || '').toLowerCase().includes(search.toLowerCase()))) return false
    if (filterSubject && n.subjectId !== filterSubject) return false
    return true
  }).sort((a,b) => (b.date || '').localeCompare(a.date || ''))

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Anotações</h2>
          
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar notas..." className="bg-[#0F1115] border border-white/5 rounded-xl py-2 px-3 text-slate-200" />
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="bg-[#0F1115] border border-white/5 rounded-xl py-2 px-3 text-slate-200">
            <option value="">Todas disciplinas</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
          </select>
          <button onClick={() => onOpenModal(null)} className="px-6 py-2 bg-purple-600 rounded text-white flex items-center gap-2"><Plus size={14}/>Nova</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="text-slate-400 p-6">Nenhuma anotação encontrada.</div>
        )}
        {filtered.map(note => {
          const subj = subjects.find(s => s.id === note.subjectId)
          return (
            <div key={note.id} className="bg-[#13151A] border border-white/5 rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{note.title}</h3>
                  <div className="text-xs text-slate-400">{note.date?.slice(0,10)} {subj ? `• ${subj.code}` : ''}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onOpenModal(note)} className="text-slate-400 hover:text-slate-200"><Edit size={16} /></button>
                  <button onClick={() => onDeleteNote(note.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="text-sm text-slate-300 mt-3">{note.content ? (note.content.length > 200 ? note.content.slice(0,200) + '...' : note.content) : <span className="text-slate-500">(Sem conteúdo)</span>}</div>
              {(note.tags && note.tags.length > 0) && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {note.tags.map(t => <span key={t} className="text-xs bg-white/5 text-slate-200 px-2 py-1 rounded">#{t}</span>)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
// Modal simples para criar/editar tarefas
function TaskModal({ task, subjects, onSave, onClose }: { task: Task, subjects: Subject[], onSave: (data: Task) => void, onClose: () => void }) {
  const [data, setData] = useState<Task>(task);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(data);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1D24] border border-white/10 w-full max-w-lg rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">{task.id === 'new' ? 'Nova Tarefa' : 'Editar Tarefa'}</h3>
          <button onClick={onClose} className="text-slate-400">Fechar</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400">Título</label>
            <input value={data.title} onChange={e => setData({ ...data, title: e.target.value })} className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white" />
          </div>
          <div>
            <label className="text-sm text-slate-400">Disciplina (opcional)</label>
            <select value={data.subjectId || ''} onChange={e => setData({ ...data, subjectId: e.target.value || undefined })} className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white">
              <option value="">(Nenhuma)</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-white/5 text-slate-200">Cancelar</button>
            <button type="submit" className="px-4 py-2 rounded bg-purple-600 text-white">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Componente simples para seleção de pré-requisitos
function PrerequisiteListBox({ currentPrereqs, allSubjects, onChange, disabled, currentSubjectCode }: { currentPrereqs: string, allSubjects: Subject[], onChange: (v: string) => void, disabled?: boolean, currentSubjectCode?: string }) {
  const [search, setSearch] = useState('')
  const selected = currentPrereqs ? currentPrereqs.split(';').map(s => s.trim()).filter(Boolean) : [];

  // Build a unique list by code (shows each discipline once even if multiple attempts exist)
  const map = allSubjects.reduce((acc: Record<string, { code: string; name: string; count: number; examples: string[] }>, s) => {
    if (s.code === currentSubjectCode) return acc; // don't list the current editing subject as its own prereq
    const key = s.code || s.name || s.id
    if (!acc[key]) acc[key] = { code: s.code, name: s.name || s.code, count: 0, examples: [] }
    acc[key].count += 1
    acc[key].examples.push(s.id)
    return acc
  }, {})

  const entries = Object.values(map).sort((a, b) => a.code.localeCompare(b.code))

  const filtered = entries.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return e.code.toLowerCase().includes(q) || (e.name || '').toLowerCase().includes(q)
  })

  const toggle = (code: string) => {
    const next = selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code];
    onChange(next.join(';'));
  }

  return (
    <div>
      <div className="mb-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pré-requisito..." className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-2 text-slate-200" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-auto">
        {filtered.length === 0 && <div className="text-slate-500 p-2">Nenhuma disciplina encontrada.</div>}
        {filtered.map(e => (
          <label key={e.code} className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-60' : ''}`}>
            <input type="checkbox" checked={selected.includes(e.code)} disabled={disabled} onChange={() => toggle(e.code)} />
            <div className="flex flex-col">
              <span className="text-slate-300">{e.code} - {e.name}</span>
              {e.count > 1 && <span className="text-xs text-slate-500">{e.count} tentativa(s)</span>}
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

function NoteModal({ note, subjects, onSave, onClose }: { note: Note, subjects: Subject[], onSave: (data: Note) => void, onClose: () => void }) {
  const [noteData, setNoteData] = useState<Note>(note);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(noteData);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1D24] border border-white/10 w-full max-w-2xl rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">{note.id === 'new' ? 'Nova Nota' : 'Editar Nota'}</h3>
          <button onClick={onClose} className="text-slate-400">Fechar</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400">Título</label>
            <input value={noteData.title} onChange={e => setNoteData({ ...noteData, title: e.target.value })} className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white" />
          </div>
          <div>
            <label className="text-sm text-slate-400">Data</label>
            <input type="date" value={noteData.date.slice(0, 10)} onChange={e => setNoteData({ ...noteData, date: e.target.value + 'T00:00:00' })} className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white" />
          </div>
          <div>
            <label className="text-sm text-slate-400">Vincular a disciplina (opcional)</label>
            <select value={noteData.subjectId || ''} onChange={e => setNoteData({ ...noteData, subjectId: e.target.value || undefined })} className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white">
              <option value="">(Nenhuma)</option>
              {subjects.map((s: Subject) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400">Tags (separadas por vírgula)</label>
            <input value={(noteData.tags || []).join(', ')} onChange={e => setNoteData({ ...noteData, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t.length > 0) })} className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white" />
          </div>
          <div>
            <label className="text-sm text-slate-400">Conteúdo</label>
            <textarea value={noteData.content} onChange={e => setNoteData({ ...noteData, content: e.target.value })} rows={8} className="w-full bg-[#0F1115] border border-white/10 rounded-lg p-3 text-white" />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-white/5 text-slate-200">Cancelar</button>
            <button type="submit" className="px-4 py-2 rounded bg-purple-600 text-white">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  )

}

// --- END Notes components ---

export default App;
