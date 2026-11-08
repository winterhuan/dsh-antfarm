/** SQLite business schema from snarktank/antfarm 0.5.1; see NOTICE. */
import type { DatabaseSync } from 'node:sqlite'

/**
 * Create original business tables and apply their additive compatibility columns.
 * @param db - Open Antfarm database.
 */
export function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      context TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      step_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      input_template TEXT NOT NULL,
      expects TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      output TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 2,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      story_index INTEGER NOT NULL,
      story_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      acceptance_criteria TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      output TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 2,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  // Add columns to steps table for backwards compat
  const cols = db.prepare('PRAGMA table_info(steps)').all() as Array<{ name: string }>
  const colNames = new Set(cols.map((c) => c.name))

  if (!colNames.has('type')) {
    db.exec("ALTER TABLE steps ADD COLUMN type TEXT NOT NULL DEFAULT 'single'")
  }
  if (!colNames.has('loop_config')) {
    db.exec('ALTER TABLE steps ADD COLUMN loop_config TEXT')
  }
  if (!colNames.has('current_story_id')) {
    db.exec('ALTER TABLE steps ADD COLUMN current_story_id TEXT')
  }
  if (!colNames.has('abandoned_count')) {
    db.exec('ALTER TABLE steps ADD COLUMN abandoned_count INTEGER DEFAULT 0')
  }

  // Add columns to runs table for backwards compat
  const runCols = db.prepare('PRAGMA table_info(runs)').all() as Array<{ name: string }>
  const runColNames = new Set(runCols.map((c) => c.name))
  if (!runColNames.has('notify_url')) {
    db.exec('ALTER TABLE runs ADD COLUMN notify_url TEXT')
  }
  if (!runColNames.has('run_number')) {
    db.exec('ALTER TABLE runs ADD COLUMN run_number INTEGER')
    // Backfill existing runs with sequential numbers based on creation order
    db.exec(`
      UPDATE runs SET run_number = (
        SELECT COUNT(*) FROM runs r2 WHERE r2.created_at <= runs.created_at
      ) WHERE run_number IS NULL
    `)
  }
}
