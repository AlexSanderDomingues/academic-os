export interface Subject {
  id: string
  code: string
  name: string
  credits: number
  // Pode ser número (ex: 1) ou string (ex: '1º Semestre' ou '2025/1')
  semester: string | number
  // Status ampliado para incluir estados usados no App
  status: 'todo' | 'doing' | 'done' | 'pending' | 'failed'
  grade?: number
  academic_period?: string;
  finalNote?: string; // Campo usado para armazenar pré-requisitos em formato "COD1; COD2"
  
  attempts?: Attempt[]; // Histórico de tentativas
  is_current_attempt?: boolean; // Flag para Matriz Curricular
  parentId?: string; // Se for uma tentativa sucessora, referencia a matéria original
}

export interface Attempt {
  academic_period: string;
  grade?: number;
  status: 'done' | 'failed' | 'doing';
}

export interface Task {
  id: string
  title: string
  status: 'todo' | 'doing' | 'done'
  priority: 'low' | 'medium' | 'high'
  subjectId?: string // Para vincular a uma matéria (opcional)
  dueDate?: string;
  description?: string;
}

export const initialSubjects: Subject[] = [
  { id: '1', code: 'MAT001', name: 'Cálculo Diferencial e Integral I', credits: 4, semester: 1, status: 'done', grade: 7.5 },
  { id: '2', code: 'FIS001', name: 'Física I', credits: 4, semester: 1, status: 'done', grade: 6.0 },
  { id: '3', code: 'ALG001', name: 'Geometria Analítica', credits: 3, semester: 1, status: 'doing' },
  { id: '4', code: 'PROG01', name: 'Algoritmos e Programação', credits: 4, semester: 1, status: 'doing' },
  { id: '5', code: 'MAT002', name: 'Cálculo II', credits: 4, semester: 2, status: 'todo' },
  { id: '6', code: 'FIS002', name: 'Física II', credits: 4, semester: 2, status: 'todo' },
]

// Começa com algumas tarefas de exemplo ou vazia
export const initialTasks: Task[] = [
  { id: '1', title: 'Lista de Exercícios 01', status: 'todo', priority: 'high', subjectId: '1' },
  { id: '2', title: 'Estudar para a P1', status: 'doing', priority: 'medium', subjectId: '3' },
]