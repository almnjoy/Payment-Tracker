import fs from "fs";
import path from "path";
import { pool } from "./db";

// Split SQL into individual executable statements, correctly handling:
//   - Dollar-quoted strings: $$ ... $$ and $tag$ ... $tag$
//   - Line comments:  -- ...
//   - Block comments: /* ... */
// BEGIN / COMMIT / ROLLBACK are dropped because the runner manages its own
// transaction.  Every other semicolon-terminated statement is kept intact.
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  let inDollarQuote = false;
  let dollarTag = "";

  while (i < sql.length) {
    if (inDollarQuote) {
      // Look for the matching closing dollar-quote tag
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        inDollarQuote = false;
        dollarTag = "";
      } else {
        current += sql[i++];
      }
      continue;
    }

    // Line comment — skip to end of line
    if (sql[i] === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }

    // Block comment — skip to */
    if (sql[i] === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    // Dollar-quote open: $tag$ where tag is zero or more non-$ chars
    const dollarMatch = sql.slice(i).match(/^(\$[^$]*\$)/);
    if (dollarMatch) {
      dollarTag = dollarMatch[1];
      inDollarQuote = true;
      current += dollarTag;
      i += dollarTag.length;
      continue;
    }

    // Statement terminator
    if (sql[i] === ";") {
      const stmt = current.trim();
      if (stmt.length > 0 && !/^(BEGIN|COMMIT|ROLLBACK)$/i.test(stmt)) {
        statements.push(stmt);
      }
      current = "";
      i++;
      continue;
    }

    current += sql[i++];
  }

  // Trailing statement without a semicolon
  const last = current.trim();
  if (last.length > 0 && !/^(BEGIN|COMMIT|ROLLBACK)$/i.test(last)) {
    statements.push(last);
  }

  return statements;
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
