import { getDb } from '../services/db';

// Postgres text/JSONB cannot store NUL (0x00); MongoDB could. PDFs/uploads often contain it.
export function stripNul<T>(v: T): T {
  if (typeof v === 'string') return v.replace(/\u0000/g, '') as unknown as T;
  if (Array.isArray(v)) return v.map(stripNul) as unknown as T;
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [stripNul(k), stripNul(x)])) as T;
  }
  return v;
}

export interface IQuestion {
  id: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
  type: string;
  options?: string[];
  answer?: string;
  concept?: string;
}

export interface ISection {
  title: string;
  instruction: string;
  questions: IQuestion[];
  totalMarks: number;
}

export interface IGeneratedOutput {
  schoolName?: string;
  subject: string;
  grade?: string;
  totalMarks: number;
  duration?: string;
  sections: ISection[];
  generatedAt: Date;
}

export type AssignmentStatus = 'pending' | 'processing' | 'completed' | 'failed';

// API shape is unchanged from the MongoDB version (frontend reads `_id`).
export interface QuestionPlanRow { type: string; qty: number; marks: number }

export interface IAssignment {
  _id: string;
  title: string;
  subject: string;
  dueDate: Date;
  questionTypes: string[];
  questionPlan?: QuestionPlanRow[];
  numberOfQuestions: number;
  totalMarks: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  additionalInstructions?: string;
  fileContent?: string;
  status: AssignmentStatus;
  jobId?: string;
  clientId?: string;
  output?: IGeneratedOutput;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewAssignment {
  title: string;
  subject: string;
  dueDate: Date;
  questionTypes: string[];
  questionPlan?: QuestionPlanRow[];
  numberOfQuestions: number;
  totalMarks: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  additionalInstructions?: string;
  fileContent?: string;
  clientId?: string;
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

function rowToAssignment(r: any, withHeavy = true): IAssignment {
  const a: IAssignment = {
    _id: r.id,
    title: r.title,
    subject: r.subject,
    dueDate: r.due_date,
    questionTypes: r.question_types || [],
    numberOfQuestions: r.number_of_questions,
    totalMarks: r.total_marks,
    difficulty: r.difficulty,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  if (r.question_plan != null) a.questionPlan = r.question_plan;
  if (r.additional_instructions != null) a.additionalInstructions = r.additional_instructions;
  if (r.job_id != null) a.jobId = r.job_id;
  if (r.client_id != null) a.clientId = r.client_id;
  if (r.error != null) a.error = r.error;
  if (withHeavy) {
    if (r.file_content != null) a.fileContent = r.file_content;
    if (r.output != null) a.output = r.output;
  }
  return a;
}

export const Assignment = {
  async create(rawInput: NewAssignment): Promise<IAssignment> {
    const input = stripNul(rawInput);
    const { rows } = await getDb().query(
      `INSERT INTO vedai_assignments (title, subject, due_date, question_types, number_of_questions, total_marks,
         difficulty, additional_instructions, file_content, client_id, question_plan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [input.title, input.subject, input.dueDate, input.questionTypes, input.numberOfQuestions, input.totalMarks,
       input.difficulty, input.additionalInstructions ?? null, input.fileContent ?? null, input.clientId ?? null, input.questionPlan ? JSON.stringify(input.questionPlan) : null]
    );
    return rowToAssignment(rows[0]);
  },

  async findById(id: string): Promise<IAssignment | null> {
    if (!UUID_RE.test(id)) return null;
    const { rows } = await getDb().query('SELECT * FROM vedai_assignments WHERE id = $1', [id]);
    return rows[0] ? rowToAssignment(rows[0]) : null;
  },

  // List view: no output / fileContent, newest first, max 50 (same as before).
  async list(): Promise<IAssignment[]> {
    const { rows } = await getDb().query(
      'SELECT id,title,subject,due_date,question_types,number_of_questions,total_marks,difficulty,additional_instructions,status,job_id,client_id,error,created_at,updated_at FROM vedai_assignments ORDER BY created_at DESC LIMIT 50'
    );
    return rows.map((r) => rowToAssignment(r, false));
  },

  async setJobId(id: string, jobId: string | undefined) {
    await getDb().query('UPDATE vedai_assignments SET job_id=$2, updated_at=now() WHERE id=$1', [id, jobId ?? null]);
  },

  async setProcessing(id: string) {
    await getDb().query("UPDATE vedai_assignments SET status='processing', updated_at=now() WHERE id=$1", [id]);
  },

  async setCompleted(id: string, output: IGeneratedOutput) {
    await getDb().query(
      "UPDATE vedai_assignments SET status='completed', output=$2::jsonb, error=NULL, updated_at=now() WHERE id=$1",
      [id, JSON.stringify(stripNul(output))]
    );
  },

  async setFailed(id: string, error: string) {
    if (!UUID_RE.test(id)) return;
    await getDb().query("UPDATE vedai_assignments SET status='failed', error=$2, updated_at=now() WHERE id=$1", [id, stripNul(error)]);
  },

  async resetForRegenerate(id: string) {
    await getDb().query(
      "UPDATE vedai_assignments SET status='pending', output=NULL, error=NULL, updated_at=now() WHERE id=$1",
      [id]
    );
  },

  async deleteById(id: string) {
    if (!UUID_RE.test(id)) return;
    await getDb().query('DELETE FROM vedai_assignments WHERE id=$1', [id]);
  },
};
