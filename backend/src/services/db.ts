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
CREATE TABLE IF NOT EXISTS vedai_classroom_students (
 id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
 assignment_id TEXT NOT NULL REFERENCES vedai_assignments(id) ON DELETE CASCADE,
 student_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', code_hash TEXT NOT NULL,
 age_group TEXT NOT NULL DEFAULT 'unknown', ai_consent BOOLEAN NOT NULL DEFAULT false,
 answers JSONB NOT NULL DEFAULT '{}', drafts JSONB NOT NULL DEFAULT '{}', marks JSONB NOT NULL DEFAULT '{}',
 submitted_at TIMESTAMPTZ, released BOOLEAN NOT NULL DEFAULT false,
 session_version INTEGER NOT NULL DEFAULT 1, grading_error TEXT,
 UNIQUE (assignment_id, student_id)
);
CREATE TABLE IF NOT EXISTS vedai_schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
DO $migration$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM vedai_schema_migrations WHERE name='classroom-v1') THEN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vedai_students' AND column_name='student_id' AND table_schema='public') THEN
   EXECUTE 'INSERT INTO vedai_classroom_students SELECT * FROM vedai_students ON CONFLICT DO NOTHING';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vedai_students' AND column_name='student_code' AND table_schema='public') THEN
   EXECUTE 'INSERT INTO vedai_classroom_students (id,assignment_id,student_id,name,code_hash,age_group,ai_consent,answers,marks,submitted_at,released)
    SELECT s.id,s.assignment_id,s.student_code,coalesce(s.name,'''') ,''legacy-hmac$'' || s.access_hash,s.age_group,s.ai_consent,
     coalesce(b.answers,''{}''::jsonb),coalesce(b.marks,''{}''::jsonb),b.submitted_at,coalesce(b.released,false)
    FROM vedai_students s JOIN vedai_assignments a ON a.id=s.assignment_id AND a.owner_id=s.owner_id
    LEFT JOIN vedai_submissions b ON b.student_row_id=s.id AND b.assignment_id=s.assignment_id AND b.owner_id=s.owner_id
    ON CONFLICT DO NOTHING';
  END IF;
  INSERT INTO vedai_schema_migrations (name) VALUES ('classroom-v1') ON CONFLICT DO NOTHING;
 END IF;
END $migration$;
CREATE INDEX IF NOT EXISTS vedai_assignments_created_at_idx ON vedai_assignments (created_at DESC);
CREATE TABLE IF NOT EXISTS vedai_jobs (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, data JSONB NOT NULL,
 state TEXT NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting','active','completed','failed')),
 progress INTEGER NOT NULL DEFAULT 0, attempts_made INTEGER NOT NULL DEFAULT 0,
 max_attempts INTEGER NOT NULL DEFAULT 3, failed_reason TEXT,
 available_at TIMESTAMPTZ NOT NULL DEFAULT now(), lease_token TEXT, lease_until TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vedai_jobs_due_idx ON vedai_jobs (available_at) WHERE state IN ('waiting','active');
DO $queue_migration$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM vedai_schema_migrations WHERE name='postgres-queue-v1') THEN
  INSERT INTO vedai_jobs (id,name,data)
   SELECT 'recovered-' || id,'generate',jsonb_build_object('assignmentId',id)
   FROM vedai_assignments WHERE status IN ('pending','processing') ON CONFLICT DO NOTHING;
  INSERT INTO vedai_schema_migrations (name) VALUES ('postgres-queue-v1') ON CONFLICT DO NOTHING;
 END IF;
END $queue_migration$;
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
