import fs from "fs";
import path from "path";
import { pool } from "./db";

// Strip SQL comments and split into individual executable statements.
// Removes -- line comments and /* */ block comments, then splits on
// semicolons. BEGIN / COMMIT / ROLLBACK are stripped because the runner
// manages its own transaction.
function splitStatements(sql: string): string[] {
  const noLineComments = sql.replace(/--[^\n]*/g, "");
  const noBlockComments = noLineComments.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlockComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(BEGIN|COMMIT|ROLLBACK)$/i.test(s));
}

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  try {
    // Tracking table — created once, never dropped
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL      PRIMARY KEY,
        filename   TEXT        NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await client.query<{ filename: string }>(
      "SELECT filename FROM _migrations ORDER BY filename"
    );
    const applied = new Set(rows.map((r) => r.filename));

    // migrations/ lives at project root in both dev and production
    const migrationsDir = path.resolve(process.cwd(), "migrations");

    if (!fs.existsSync(migrationsDir)) {
      console.log("[migrations] No migrations directory found — skipping.");
      return;
    }

    const pending = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort() // alphabetical order == chronological with NNN_ naming scheme
      .filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log("[migrations] All migrations up to date.");
      return;
    }

    for (const filename of pending) {
      const filepath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(filepath, "utf8");
      const statements = splitStatements(sql);

      console.log(
        `[migrations] Applying ${filename} (${statements.length} statements)…`
      );

      await client.query("BEGIN");
      try {
        for (const stmt of statements) {
          await client.query(stmt);
        }

        // Record as applied inside the same transaction so that
        // a partial failure rolls back both the schema change and
        // the tracking record atomically.
        await client.query(
          "INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
          [filename]
        );

        await client.query("COMMIT");
        console.log(`[migrations] ✓ ${filename}`);
      } catch (err) {
        await client.query("ROLLBACK");
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(`[migrations] ✗ ${filename} failed — ${detail}`);
      }
    }
  } finally {
    client.release();
  }
}
