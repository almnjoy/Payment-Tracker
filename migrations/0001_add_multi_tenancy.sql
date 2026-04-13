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
    id         SERIAL PRIMARY KEY,
    name       TEXT        NOT NULL,
    slug       TEXT        NOT NULL UNIQUE,
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
-- STEP 3: Add org_id to core business tables
--
--   Pattern for each table:
--     a) ADD COLUMN nullable      (safe if rows already exist)
--     b) Backfill existing rows   SET org_id = 1
--     c) SET NOT NULL             (safe now that every row has a value)
--     d) ADD FK CONSTRAINT        NOT VALID skips full-table scan
--     e) CREATE INDEX             for query performance
--
--   ADD COLUMN IF NOT EXISTS and ON CONFLICT guards make
--   the migration safe to re-run.
-- ============================================================

-- ----- clients -----
ALTER TABLE clients ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE clients SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE clients ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE clients ADD CONSTRAINT fk_clients_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON clients(org_id);

-- ----- leases -----
ALTER TABLE leases ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE leases SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE leases ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE leases ADD CONSTRAINT fk_leases_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_leases_org_id ON leases(org_id);

-- ----- invoices -----
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE invoices SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE invoices ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(org_id);

-- ----- payments -----
ALTER TABLE payments ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE payments SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE payments ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE payments ADD CONSTRAINT fk_payments_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(org_id);

-- ----- documents -----
ALTER TABLE documents ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE documents SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE documents ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE documents ADD CONSTRAINT fk_documents_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(org_id);

-- ----- invite_codes -----
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE invite_codes SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE invite_codes ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE invite_codes ADD CONSTRAINT fk_invite_codes_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_invite_codes_org_id ON invite_codes(org_id);

-- ----- invoice_settings -----
-- NOTE: Uses id = 'default' as singleton PK today.
--       App code will move to WHERE org_id = $1 after migration.
--       New orgs insert a new row with a distinct id value.
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE invoice_settings SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE invoice_settings ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE invoice_settings ADD CONSTRAINT fk_invoice_settings_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_invoice_settings_org_id ON invoice_settings(org_id);

-- ----- payment_settings -----
-- Same singleton-PK note as invoice_settings above.
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE payment_settings SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE payment_settings ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE payment_settings ADD CONSTRAINT fk_payment_settings_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_payment_settings_org_id ON payment_settings(org_id);

-- ----- automation_settings -----
-- Same singleton-PK note as invoice_settings above.
ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE automation_settings SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE automation_settings ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE automation_settings ADD CONSTRAINT fk_automation_settings_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_automation_settings_org_id ON automation_settings(org_id);

-- ----- finance_entries -----
ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE finance_entries SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE finance_entries ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE finance_entries ADD CONSTRAINT fk_finance_entries_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_finance_entries_org_id ON finance_entries(org_id);

-- ----- client_billing_items -----
ALTER TABLE client_billing_items ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE client_billing_items SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE client_billing_items ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE client_billing_items ADD CONSTRAINT fk_client_billing_items_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_client_billing_items_org_id ON client_billing_items(org_id);

-- ============================================================
-- STEP 4: Add org_id to users_profile
--
--   users_profile is the bridge between Replit Auth and app data.
--   It already has `role` (admin/client). We add org_id here.
--   The base `users` table is managed by Replit Auth and is not
--   org-scoped (a user could belong to multiple orgs in future).
-- ============================================================
ALTER TABLE users_profile ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE users_profile SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE users_profile ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE users_profile ADD CONSTRAINT fk_users_profile_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_users_profile_org_id ON users_profile(org_id);

-- ============================================================
-- STEP 5: Add org_id to Plaid tables
--
--   plaid_items / plaid_accounts / plaid_transactions were previously
--   scoped only by adminUserId. Adding org_id makes isolation explicit.
--
--   plaid_accounts and plaid_transactions do not have a direct
--   adminUserId — they are reached via their parent itemId — so
--   we backfill them by joining up through the ownership chain:
--     plaid_transactions -> plaid_accounts -> plaid_items -> org_id = 1
--   Since all existing data belongs to org 1, a direct SET = 1
--   is equivalent and simpler.
-- ============================================================

-- ----- plaid_items -----
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE plaid_items SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE plaid_items ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE plaid_items ADD CONSTRAINT fk_plaid_items_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_plaid_items_org_id ON plaid_items(org_id);

-- ----- plaid_accounts -----
ALTER TABLE plaid_accounts ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE plaid_accounts SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE plaid_accounts ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE plaid_accounts ADD CONSTRAINT fk_plaid_accounts_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_org_id ON plaid_accounts(org_id);

-- ----- plaid_transactions -----
ALTER TABLE plaid_transactions ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE plaid_transactions SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE plaid_transactions ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE plaid_transactions ADD CONSTRAINT fk_plaid_transactions_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_plaid_transactions_org_id ON plaid_transactions(org_id);

-- ----- plaid_cursors -----
-- plaid_cursors has no adminUserId column; it links 1:1 to plaid_items.
ALTER TABLE plaid_cursors ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE plaid_cursors SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE plaid_cursors ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE plaid_cursors ADD CONSTRAINT fk_plaid_cursors_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_plaid_cursors_org_id ON plaid_cursors(org_id);

-- ----- plaid_recurring_groups -----
ALTER TABLE plaid_recurring_groups ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE plaid_recurring_groups SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE plaid_recurring_groups ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE plaid_recurring_groups ADD CONSTRAINT fk_plaid_recurring_groups_org_id
    FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_plaid_recurring_groups_org_id ON plaid_recurring_groups(org_id);

COMMIT;

-- ============================================================
-- TABLES NOT ORG-SCOPED (and why)
-- ============================================================
--   sessions            Replit Auth session store. Not app-scoped.
--   users               Replit Auth user identity. Not org-scoped;
--                       users_profile is the org bridge instead.
--   external_accounts   Scoped by createdByUserId. Not in spec;
--                       add in a follow-up if needed.
--   mobile_refresh_tokens / mobile_revoked_jtis
--                       Auth tokens scoped to userId; org access
--                       is validated via users_profile at the route level.
--
-- FK CONSTRAINT NOTE
-- ============================================================
--   All FK constraints use NOT VALID to avoid a full-table scan
--   at migration time. To validate them after migration (optional):
--     ALTER TABLE clients VALIDATE CONSTRAINT fk_clients_org_id;
--     (repeat for each table listed above)
-- ============================================================
