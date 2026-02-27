-- Multi-tenant organizations rollout
CREATE TABLE IF NOT EXISTS organizations (
  organization_id varchar PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  primary_color text,
  accent_color text,
  logo_url text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

INSERT INTO organizations (organization_id, name, slug, status)
VALUES ('org-default', 'Default Organization', 'default', 'active')
ON CONFLICT (organization_id) DO NOTHING;

ALTER TABLE users_profile ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE client_billing_items ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE plaid_accounts ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE plaid_transactions ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE plaid_recurring_groups ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS organization_id varchar;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS organization_id varchar;

UPDATE users_profile SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE clients SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE leases SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE invoices SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE payments SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE documents SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE invite_codes SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE client_billing_items SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE finance_entries SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE plaid_items SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE plaid_accounts SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE plaid_transactions SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE plaid_recurring_groups SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE payment_settings SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE automation_settings SET organization_id = 'org-default' WHERE organization_id IS NULL;
UPDATE invoice_settings SET organization_id = 'org-default' WHERE organization_id IS NULL;

ALTER TABLE users_profile ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE clients ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE leases ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE documents ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE invite_codes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE client_billing_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE finance_entries ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE plaid_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE plaid_accounts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE plaid_transactions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE plaid_recurring_groups ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE payment_settings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE automation_settings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE invoice_settings ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS users_profile_organization_id_idx ON users_profile (organization_id);
CREATE INDEX IF NOT EXISTS clients_organization_id_idx ON clients (organization_id);
CREATE INDEX IF NOT EXISTS leases_organization_id_idx ON leases (organization_id);
CREATE INDEX IF NOT EXISTS payments_organization_id_idx ON payments (organization_id);
CREATE INDEX IF NOT EXISTS documents_organization_id_idx ON documents (organization_id);
CREATE INDEX IF NOT EXISTS invite_codes_organization_id_idx ON invite_codes (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_org_invoice_number_unique_idx ON invoices (organization_id, invoice_number);
CREATE UNIQUE INDEX IF NOT EXISTS invite_codes_org_magic_number_unique_idx ON invite_codes (organization_id, magic_number);
CREATE UNIQUE INDEX IF NOT EXISTS payment_settings_org_unique_idx ON payment_settings (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS automation_settings_org_unique_idx ON automation_settings (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_settings_org_unique_idx ON invoice_settings (organization_id);
