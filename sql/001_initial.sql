BEGIN;
CREATE TABLE IF NOT EXISTS schema_versions(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, username text NOT NULL UNIQUE, name text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','penguji')), password_hash text NOT NULL,
 active boolean NOT NULL DEFAULT true, must_change boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), csrf text NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS login_limits(key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, started_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS programs (
 id uuid PRIMARY KEY, name text NOT NULL UNIQUE, faculty text NOT NULL,
 aliases jsonb NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS periods (
 id uuid PRIMARY KEY, name text NOT NULL, academic_year text NOT NULL,
 wave text NOT NULL, pathway text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed','archived')),
 settings jsonb NOT NULL DEFAULT '{"weights":{"BAHASA":30,"SIGNIFIKANSI":30,"PROPOSAL":40},"passing":70,"rubrics":{"BAHASA":"Kemampuan berkomunikasi, pemahaman, dan argumentasi dalam bahasa Arab dan Inggris.","SIGNIFIKANSI":"Motivasi, kesiapan akademik, kontribusi keilmuan, dan kesesuaian bidang studi.","PROPOSAL":"Kebaruan, rumusan masalah, kerangka teori, metode, dan kelayakan penelitian."}}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS enrollments (
 id uuid PRIMARY KEY, period_id uuid NOT NULL REFERENCES periods(id),
 applicant_number text NOT NULL, participant_number text NOT NULL,
 name text NOT NULL, program_id uuid NOT NULL REFERENCES programs(id),
 profile jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(period_id,applicant_number), UNIQUE(period_id,participant_number)
);
CREATE TABLE IF NOT EXISTS exam_sessions (
 id uuid PRIMARY KEY, period_id uuid NOT NULL REFERENCES periods(id), name text NOT NULL,
 component text NOT NULL CHECK(component IN ('BAHASA','SIGNIFIKANSI','PROPOSAL')),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 room text NOT NULL, meeting_url text NOT NULL DEFAULT '', capacity integer NOT NULL CHECK(capacity>0),
 CHECK(ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS assignments (
 id uuid PRIMARY KEY, enrollment_id uuid NOT NULL REFERENCES enrollments(id),
 examiner_id uuid NOT NULL REFERENCES users(id),
 component text NOT NULL CHECK(component IN ('BAHASA','SIGNIFIKANSI','PROPOSAL')),
 session_id uuid NOT NULL REFERENCES exam_sessions(id),
 UNIQUE(enrollment_id,examiner_id,component)
);
CREATE TABLE IF NOT EXISTS scores (
 assignment_id uuid PRIMARY KEY REFERENCES assignments(id) ON DELETE RESTRICT,
 values jsonb NOT NULL DEFAULT '{}', notes text NOT NULL DEFAULT '',
 attendance text NOT NULL DEFAULT 'unknown' CHECK(attendance IN ('unknown','present','absent')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','final')),
 version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
 finalized_at timestamptz
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL,
 entity_id text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS import_batches (
 id uuid PRIMARY KEY, period_id uuid NOT NULL REFERENCES periods(id), actor_id uuid NOT NULL REFERENCES users(id),
 filename text NOT NULL, row_count integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enrollment_period_idx ON enrollments(period_id);
CREATE INDEX IF NOT EXISTS assignment_examiner_idx ON assignments(examiner_id);
CREATE INDEX IF NOT EXISTS session_period_idx ON exam_sessions(period_id);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs(created_at);
INSERT INTO schema_versions(version) VALUES('001') ON CONFLICT DO NOTHING;
COMMIT;
