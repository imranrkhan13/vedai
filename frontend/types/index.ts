export type Difficulty = 'easy' | 'medium' | 'hard';
export type AssignmentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Question {
  id: string;
  text: string;
  difficulty: Difficulty;
  marks: number;
  type: string;
}

export interface Section {
  title: string;
  instruction: string;
  questions: Question[];
  totalMarks: number;
}

export interface GeneratedOutput {
  schoolName?: string;
  subject: string;
  grade?: string;
  totalMarks: number;
  duration?: string;
  sections: Section[];
  generatedAt: string;
}

export interface Assignment {
  _id: string;
  title: string;
  subject: string;
  dueDate: string;
  questionTypes: string[];
  numberOfQuestions: number;
  totalMarks: number;
  difficulty: Difficulty | 'mixed';
  additionalInstructions?: string;
  status: AssignmentStatus;
  jobId?: string;
  output?: GeneratedOutput;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentInput {
  title: string;
  subject: string;
  dueDate: string;
  questionTypes: string[];
  numberOfQuestions: number;
  totalMarks: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  additionalInstructions?: string;
  fileContent?: string;
  clientId?: string;
}

export interface WSMessage {
  type: 'connected' | 'job:progress' | 'job:completed' | 'job:failed';
  assignmentId?: string;
  status?: string;
  message?: string;
  progress?: number;
  clientId?: string;
}
