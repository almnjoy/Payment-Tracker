-- ============================================================
-- Migration: 0001_add_multi_tenancy.sql
-- Purpose:   Add multi-tenancy org isolation (additive only)
-- Safe:      No data dropped. All existing rows migrated to org_id = 1.
-- Run with:  psql $DATABASE_URL -f migrations/0001_add_multi_tenancy.sql
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Create organizations table
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
    id      SERIAL PRIMARY KEY,
    name    TEXT        NOT NULL,
    slug    TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STEP 2: Seed default organization (org_id = 1 = Quick IT Projects)
--   ON CONFLICT DO NOTHING so re-running is safe.
-- ============================================================
INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES (1, 'Quick IT Projects', 'quick-it-projects', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Advance sequence past 1 so the next auto-generated org gets id >= 2
SELECT setval(
    pg_get_serial_sequence('organizations', 'id'),
    GREATEST(1, (SELECT MAX(id) FROM organizations))
);

-- ============================================================
-- STEP 3: Add org_id to all affected tables
--
--   Pattern for each table:
--     a) ADD COLUMN nullable (safe if rows already exist)
--     b) Backfill existing rows to org_id = 1
--     c) SET NOT NULL (safe now that every row has a value)
--     d) ADD FK CONSTRAINT referencing organizations(id)
--
--   Using ADD COLUMN IF NOT EXISTS so re-running is safe.
-- ============================================================

-- ----- clients -----
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS org_id INTEGER;

UPDATE clients
    SET org_id = 1
    WHERE org_id IS NULL;

ALTER TABLE clients
    ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE clients
    ADD CONSTRAINT fk_clients_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id)
    NOT VALID;   -- NOT VALID skips full-table scan; validate separately if desired


-- ----- leases -----
ALTER TABLE leases
    ADD COLUMN IF NOT EXISTS org_id INTEGER;

UPDATE leases
    SET org_id = 1
    WHERE org_id IS NULL;

ALTER TABLE leases
    ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE leases
    ADD CONSTRAINT fk_leases_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id)
    NOT VALID;


-- ----- invoices -----
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS org_id INTEGER;

UPDATE invoices
    SET org_id = 1
    WHERE org_id IS NULL;

ALTER TABLE invoices
    ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE invoices
    ADD CONSTRAINT fk_invoices_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id)
    NOT VALID;


-- ----- payments -----
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS org_id INTEGER;

UPDATE payments
    SET org_id = 1
    WHERE org_id IS NULL;

ALTER TABLE payments
    ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE payments
    ADD CONSTRAINT fk_payments_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id)
    NOT VALID;


-- ----- documents -----
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS org_id INTEGER;

UPDATE documents
    SET org_id = 1
    WHERE org_id IS NULL;

ALTER TABLE documents
    ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE documents
    ADD CONSTRAINT fk_documents_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id)
    NOT VALID;


-- ----- invite_codes -----
ALTER TABLE invite_codes
    ADD COLUMN IF NOT EXISTS org_id INTEGER;

UPDATE invite_codes
    SET org_id = 1
    WHERE org_id IS NULL;

ALTER TABLE invite_codes
    ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE invite_codes
    ADD CONSTRAINT fk_invite_codes_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id)
    NOT VALID;


-- ----- invoice_settings -----
-- NOTE: This table uses id = 'default' as a singleton PK.
--       After this migration the app must query by org_id instead of id = 'default'.
--       New orgs will insert rows with a distinct id (e.g. 'org-2').
ALTER TABLE invoice_settings
    ADD COLUMN IF NOT EXISTS org_id INTEGER;

UPDATE invoice_settings
    SET org_id = 1
    WHERE org_id IS NULL;

ALTER TABLE invoice_settings
    ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE invoice_settings
    ADD CONSTRAINT fk_invoice_settings_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id)
    NOT VALID;


-- ----- payment_settings -----
-- Same singleton-PK note as invoice_settings above.
ALTER TABLE payment_settings
    ADD COLUMN IF NOT EXISTS org_id INTEGER;

UPDATE payment_settings
    SET org_id = 1
    WHERE org_id IS NULL;

ALTER TABLE payment_settings
    ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE payment_settings
    ADD CONSTRAINT fk_payment_settings_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id)
    NOT VALID;


-- ----- automation_settings -----
-- Same singleton-PK note as invoice_settings above.
ALTER TABLE automation_settings
    ADD COLUMN IF NOT EXISTS org_id INTEGER;

UPDATE automation_settings
    SET org_id = 1
    WHERE org_id IS NULL;

ALTER TABLE automation_settings
    ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE automation_settings
    ADD CONSTRAINT fk_automation_settings_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id)
    NOT VALID;


-- ----- finance_entries -----
ALTER TABLE finance_entries
    ADD COLUMN IF NOT EXISTS org_id INTEGER;

UPDATE finance_entries
    SET org_id = 1
    WHERE org_id IS NULL;

ALTER TABLE finance_entries
    ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE finance_entries
    ADD CONSTRAINT fk_finance_entries_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id)
    NOT VALID;


-- ============================================================
-- STEP 4: Add org_id to users_profile
--
--   users_profile is the bridge between Replit Auth and app data.
--   It already has `role` (admin/client). We add org_id here.
--   The base `users` table is managed by Replit Auth and should
--   not be org-scoped (a Replit user account could theoretically
--   belong to multiple orgs in the future).
-- ============================================================
ALTER TABLE users_profile
    ADD COLUMN IF NOT EXISTS org_id INTEGER;

UPDATE users_profile
    SET org_id = 1
    WHERE org_id IS NULL;

ALTER TABLE users_profile
    ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE users_profile
    ADD CONSTRAINT fk_users_profile_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id)
    NOT VALID;


-- ============================================================
-- STEP 5: Performance indexes on every new org_id column
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_org_id            ON clients(org_id);
CREATE INDEX IF NOT EXISTS idx_leases_org_id              ON leases(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id            ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_id            ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_id           ON documents(org_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_org_id        ON invite_codes(org_id);
CREATE INDEX IF NOT EXISTS idx_invoice_settings_org_id   ON invoice_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_settings_org_id   ON payment_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_settings_org_id ON automation_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_org_id     ON finance_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_users_profile_org_id       ON users_profile(org_id);

COMMIT;

-- ============================================================
-- POST-MIGRATION NOTES FOR REVIEWER
-- ============================================================
--
-- Tables in spec that are NOT org-scoped (and why):
--   - plaid_items / plaid_accounts / plaid_transactions / plaid_cursors / plaid_recurring_groups
--       These are currently scoped by adminUserId. They represent the
--       admin's personal bank connections. If you want org-level
--       Plaid isolation, add org_id here in a follow-up.
--   - client_billing_items
--       Not listed in the spec, but it references clients(client_id).
--       Since clients are org-scoped, billing items are implicitly
--       scoped. If you want an explicit org_id column here, add one
--       in a follow-up.
--   - external_accounts
--       Scoped by createdByUserId. Same situation as plaid tables.
--   - sessions / users (auth)
--       Managed by Replit Auth. Not org-scoped by design.
--       users_profile is the app-side org bridge.
--   - mobile_refresh_tokens / mobile_revoked_jtis
--       Mobile auth tokens. Not org-scoped; access is validated
--       against users_profile.org_id at the route level.
--
-- Settings table singleton PK concern:
--   invoice_settings, payment_settings, automation_settings all use
--   id = 'default' as a primary key (single row per app currently).
--   After this migration, the app will query these by org_id.
--   New orgs will need a new id value per row — the application
--   code must be updated to use a unique id per org (e.g.
--   'org-{org_id}-invoice-settings') when creating settings for
--   new organizations.
--
-- FK constraints use NOT VALID intentionally:
--   This avoids a full-table scan on large tables at migration time.
--   To validate them (optional), run after migration:
--     ALTER TABLE clients VALIDATE CONSTRAINT fk_clients_org_id;
--     (repeat for each table)
-- ============================================================
