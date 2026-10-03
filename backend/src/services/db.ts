import { redactSecrets } from './redact';
import { Pool } from 'pg';

// Minimal query interface so tests can inject an in-memory Postgres.
export interface Db {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}

let db: Db | null = null;

export function setDb(custom: Db) {
  db = custom;
}

export function getDb(): Db {
  if (!db) throw new Error('Database not initialised. Call connectDB() first.');
  return db;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS vedai_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  question_types TEXT[] NOT NULL DEFAULT '{}',
  number_of_questions INTEGER NOT NULL CHECK (number_of_questions >= 1),
  total_marks INTEGER NOT NULL CHECK (total_marks >= 1),
  difficulty TEXT NOT NULL DEFAULT 'mixed' CHECK (difficulty IN ('easy','medium','hard','mixed')),
  additional_instructions TEXT,
  file_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  job_id TEXT,
  client_id TEXT,
  output JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE vedai_assignments ADD COLUMN IF NOT EXISTS question_plan JSONB;
ALTER TABLE vedai_assignments ADD COLUMN IF NOT EXISTS owner_id TEXT;
CREATE INDEX IF NOT EXISTS vedai_assignments_owner_idx ON vedai_assignments (owner_id);
CREATE TABLE IF NOT EXISTS vedai_users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vedai_students (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  assignment_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  student_code TEXT NOT NULL,
  name TEXT,
  access_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vedai_students_access_hash_idx ON vedai_students (access_hash);
CREATE UNIQUE INDEX IF NOT EXISTS vedai_students_code_idx ON vedai_students (assignment_id, lower(student_code));
CREATE TABLE IF NOT EXISTS vedai_submissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_row_id TEXT NOT NULL UNIQUE,
  assignment_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  answers JSONB NOT NULL,
  late BOOLEAN NOT NULL DEFAULT false,
  marks JSONB NOT NULL DEFAULT '{}'::jsonb,
  released BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE vedai_students ADD COLUMN IF NOT EXISTS age_group TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE vedai_students ADD COLUMN IF NOT EXISTS ai_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vedai_submissions ADD COLUMN IF NOT EXISTS draft JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS vedai_assignments_created_at_idx ON vedai_assignments (created_at DESC);
`;

export async function connectDB() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is not set (use the Neon connection string)');
    process.exit(1);
  }
  try {
    const pool = new Pool({
      connectionString: url,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true },
      max: 5,
      idleTimeoutMillis: 30_000,
    });
    db = pool;
    await pool.query(SCHEMA_SQL);
    console.log('✅ Postgres connected');
  } catch (err) {
    console.error('❌ Postgres connection error:', redactSecrets(err));
    process.exit(1);
  }
}

export async function initSchema(custom: Db) {
  await custom.query(SCHEMA_SQL);
}
