-- ============================================================
-- Migration: 0001_add_multi_tenancy.sql
-- Purpose:   Add multi-tenancy org isolation (additive only)
-- Safe:      Fully idempotent. All ADD CONSTRAINT calls wrapped
--            in DO $$ ... EXCEPTION WHEN duplicate_object $$ so
--            re-running after a partial apply is always safe.
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
-- STEP 2: Seed default organization (idempotent via ON CONFLICT)
-- ============================================================
INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES (1, 'Quick IT Projects', 'quick-it-projects', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

SELECT setval(
    pg_get_serial_sequence('organizations', 'id'),
    GREATEST(1, (SELECT MAX(id) FROM organizations))
);

-- ============================================================
-- STEP 3: Add org_id to core business tables
-- ============================================================

-- ----- clients -----
ALTER TABLE clients ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE clients SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE clients ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE clients ADD CONSTRAINT fk_clients_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON clients(org_id);

-- ----- leases -----
ALTER TABLE leases ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE leases SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE leases ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE leases ADD CONSTRAINT fk_leases_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_leases_org_id ON leases(org_id);

-- ----- invoices -----
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE invoices SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE invoices ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT fk_invoices_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(org_id);

-- ----- payments -----
ALTER TABLE payments ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE payments SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE payments ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE payments ADD CONSTRAINT fk_payments_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(org_id);

-- ----- documents -----
ALTER TABLE documents ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE documents SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE documents ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE documents ADD CONSTRAINT fk_documents_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(org_id);

-- ----- invite_codes -----
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE invite_codes SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE invite_codes ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE invite_codes ADD CONSTRAINT fk_invite_codes_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_invite_codes_org_id ON invite_codes(org_id);

-- ----- invoice_settings -----
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE invoice_settings SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE invoice_settings ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE invoice_settings ADD CONSTRAINT fk_invoice_settings_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_invoice_settings_org_id ON invoice_settings(org_id);

-- ----- payment_settings -----
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE payment_settings SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE payment_settings ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE payment_settings ADD CONSTRAINT fk_payment_settings_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_payment_settings_org_id ON payment_settings(org_id);

-- ----- automation_settings -----
ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE automation_settings SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE automation_settings ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE automation_settings ADD CONSTRAINT fk_automation_settings_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_automation_settings_org_id ON automation_settings(org_id);

-- ----- finance_entries -----
ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE finance_entries SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE finance_entries ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE finance_entries ADD CONSTRAINT fk_finance_entries_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_finance_entries_org_id ON finance_entries(org_id);

-- ----- client_billing_items -----
ALTER TABLE client_billing_items ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE client_billing_items SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE client_billing_items ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE client_billing_items ADD CONSTRAINT fk_client_billing_items_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_client_billing_items_org_id ON client_billing_items(org_id);

-- ============================================================
-- STEP 4: Add org_id to users_profile
-- ============================================================
ALTER TABLE users_profile ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE users_profile SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE users_profile ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE users_profile ADD CONSTRAINT fk_users_profile_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_users_profile_org_id ON users_profile(org_id);

-- ============================================================
-- STEP 5: Add org_id to Plaid tables
-- ============================================================

-- ----- plaid_items -----
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE plaid_items SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE plaid_items ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE plaid_items ADD CONSTRAINT fk_plaid_items_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_plaid_items_org_id ON plaid_items(org_id);

-- ----- plaid_accounts -----
ALTER TABLE plaid_accounts ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE plaid_accounts SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE plaid_accounts ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE plaid_accounts ADD CONSTRAINT fk_plaid_accounts_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_org_id ON plaid_accounts(org_id);

-- ----- plaid_transactions -----
ALTER TABLE plaid_transactions ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE plaid_transactions SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE plaid_transactions ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE plaid_transactions ADD CONSTRAINT fk_plaid_transactions_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_plaid_transactions_org_id ON plaid_transactions(org_id);

-- ----- plaid_cursors -----
ALTER TABLE plaid_cursors ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE plaid_cursors SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE plaid_cursors ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE plaid_cursors ADD CONSTRAINT fk_plaid_cursors_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_plaid_cursors_org_id ON plaid_cursors(org_id);

-- ----- plaid_recurring_groups -----
ALTER TABLE plaid_recurring_groups ADD COLUMN IF NOT EXISTS org_id INTEGER;
UPDATE plaid_recurring_groups SET org_id = 1 WHERE org_id IS NULL;
ALTER TABLE plaid_recurring_groups ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE plaid_recurring_groups ADD CONSTRAINT fk_plaid_recurring_groups_org_id
      FOREIGN KEY (org_id) REFERENCES organizations(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_plaid_recurring_groups_org_id ON plaid_recurring_groups(org_id);

COMMIT;

-- ============================================================
-- TABLES NOT ORG-SCOPED (and why)
-- ============================================================
--   sessions            Replit Auth session store. Not app-scoped.
--   users               Replit Auth user identity. Not org-scoped.
--   external_accounts   Scoped by createdByUserId. Add in follow-up.
--   mobile_refresh_tokens / mobile_revoked_jtis
--                       Auth tokens scoped to userId; org access
--                       validated via users_profile at route level.
-- ============================================================
