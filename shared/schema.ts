import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  date,
  boolean,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models (sessions and users tables)
export * from "./models/auth";

// ============================================
// USERS PROFILE (Bridge between Replit Auth and app data)
// ============================================
export const usersProfile = pgTable("users_profile", {
  userId: varchar("user_id").primaryKey(),
  role: text("role").notNull().default("client"),
  clientId: varchar("client_id"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersProfileRelations = relations(usersProfile, ({ one }) => ({
  client: one(clients, {
    fields: [usersProfile.clientId],
    references: [clients.clientId],
  }),
}));

export const insertUsersProfileSchema = createInsertSchema(usersProfile);
export type InsertUsersProfile = z.infer<typeof insertUsersProfileSchema>;
export type UsersProfile = typeof usersProfile.$inferSelect;

// ============================================
// CLIENTS (Business records)
// ============================================
export const clients = pgTable("clients", {
  clientId: varchar("client_id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  status: text("status").notNull().default("active"), // active, paused, inactive, behind
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clientsRelations = relations(clients, ({ many }) => ({
  leases: many(leases),
  invoices: many(invoices),
  payments: many(payments),
  documents: many(documents),
  inviteCodes: many(inviteCodes),
}));

export const insertClientSchema = createInsertSchema(clients).omit({
  clientId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// ============================================
// LEASES (Why they pay)
// ============================================
export const leases = pgTable("leases", {
  leaseId: varchar("lease_id").primaryKey(),
  clientId: varchar("client_id").notNull(),
  description: text("description"),
  rentAmountCents: integer("rent_amount_cents").notNull(),
  dueDay: integer("due_day").notNull().default(1),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leasesRelations = relations(leases, ({ one, many }) => ({
  client: one(clients, {
    fields: [leases.clientId],
    references: [clients.clientId],
  }),
  invoices: many(invoices),
  documents: many(documents),
}));

export const insertLeaseSchema = createInsertSchema(leases).omit({
  leaseId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLease = z.infer<typeof insertLeaseSchema>;
export type Lease = typeof leases.$inferSelect;

// ============================================
// INVITE CODES (Invite-only onboarding)
// ============================================
export const inviteCodes = pgTable("invite_codes", {
  magicNumber: varchar("magic_number").primaryKey(),
  clientId: varchar("client_id").notNull(),
  leaseId: varchar("lease_id"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  usedByUserId: varchar("used_by_user_id"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inviteCodesRelations = relations(inviteCodes, ({ one }) => ({
  client: one(clients, {
    fields: [inviteCodes.clientId],
    references: [clients.clientId],
  }),
  lease: one(leases, {
    fields: [inviteCodes.leaseId],
    references: [leases.leaseId],
  }),
}));

export const insertInviteCodeSchema = createInsertSchema(inviteCodes).omit({
  usedAt: true,
  usedByUserId: true,
  createdAt: true,
});
export type InsertInviteCode = z.infer<typeof insertInviteCodeSchema>;
export type InviteCode = typeof inviteCodes.$inferSelect;

// ============================================
// INVOICE SETTINGS (Business defaults)
// ============================================
export const invoiceSettings = pgTable("invoice_settings", {
  id: varchar("id").primaryKey().default("default"),
  adminUserId: varchar("admin_user_id").notNull(),
  businessLogo: text("business_logo"), // URL to stored logo image
  businessName: text("business_name"),
  businessAddress: text("business_address"),
  businessEmail: text("business_email"),
  defaultTerms: text("default_terms").default("Due on Receipt"),
  defaultFooterText: text("default_footer_text").default("Thanks for your business."),
  invoicePrefix: text("invoice_prefix").default("INV-"),
  nextInvoiceNumber: integer("next_invoice_number").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvoiceSettingsSchema = createInsertSchema(invoiceSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvoiceSettings = z.infer<typeof insertInvoiceSettingsSchema>;
export type InvoiceSettings = typeof invoiceSettings.$inferSelect;

// ============================================
// PAYMENT SETTINGS (Admin-configured payment methods)
// ============================================
export const paymentSettings = pgTable("payment_settings", {
  id: varchar("id").primaryKey().default("default"),
  adminUserId: varchar("admin_user_id").notNull(),
  cashAppHandle: text("cash_app_handle"),
  cashAppLink: text("cash_app_link"),
  venmoHandle: text("venmo_handle"),
  venmoLink: text("venmo_link"),
  bankInstructions: text("bank_instructions"),
  stripePlaceholderMessage: text("stripe_placeholder_message").default("Stripe payments coming soon!"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaymentSettingsSchema = createInsertSchema(paymentSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPaymentSettings = z.infer<typeof insertPaymentSettingsSchema>;
export type PaymentSettings = typeof paymentSettings.$inferSelect;

// ============================================
// AUTOMATION SETTINGS (Webhooks, integrations)
// ============================================
export const automationSettings = pgTable("automation_settings", {
  id: varchar("id").primaryKey().default("default"),
  adminUserId: varchar("admin_user_id").notNull(),
  // Client Signup Email Webhook
  signupEmailWebhookUrl: text("signup_email_webhook_url"),
  signupEmailToken: text("signup_email_token"),
  signupEmailEnabled: boolean("signup_email_enabled").default(false),
  // Payment Received Alerts Webhook
  paymentReceivedWebhookUrl: text("payment_received_webhook_url"),
  paymentReceivedToken: text("payment_received_token"),
  paymentReceivedEnabled: boolean("payment_received_enabled").default(false),
  // Monthly Summaries Webhook
  monthlySummaryWebhookUrl: text("monthly_summary_webhook_url"),
  monthlySummaryToken: text("monthly_summary_token"),
  monthlySummaryEnabled: boolean("monthly_summary_enabled").default(false),
  // Global notification toggles
  paymentReceivedAlertsGlobalEnabled: boolean("payment_received_alerts_global_enabled").default(true),
  monthlySummaryGlobalEnabled: boolean("monthly_summary_global_enabled").default(true),
  // Legacy field (deprecated, use signupEmailToken instead)
  automationToken: text("automation_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAutomationSettingsSchema = createInsertSchema(automationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAutomationSettings = z.infer<typeof insertAutomationSettingsSchema>;
export type AutomationSettings = typeof automationSettings.$inferSelect;

// Line item schema for invoice line items (stored as JSONB)
export const invoiceLineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.number(),
  rate: z.number(), // in cents
  discountPercent: z.number().default(0),
  amount: z.number(), // in cents (calculated)
});
export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>;

// ============================================
// INVOICES (Standalone PDF generator - NOT linked to clients/billing)
// ============================================
export const invoices = pgTable("invoices", {
  invoiceId: varchar("invoice_id").primaryKey(),
  invoiceNumber: varchar("invoice_number").notNull(), // e.g., "INV-000001"
  clientId: varchar("client_id"), // Optional - for backwards compatibility only
  leaseId: varchar("lease_id"),
  // Bill To fields (standalone invoice recipient)
  billToName: text("bill_to_name"), // Company or person name
  billToEmail: text("bill_to_email"),
  billToAddress: text("bill_to_address"),
  title: text("title").notNull(),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  terms: text("terms").default("Due on Receipt"),
  lineItems: jsonb("line_items").$type<InvoiceLineItem[]>().default([]),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  taxPercent: integer("tax_percent").default(0),
  taxCents: integer("tax_cents").default(0),
  totalCents: integer("total_cents").notNull().default(0),
  amountCents: integer("amount_cents").notNull(), // Legacy field for compatibility
  balanceDueCents: integer("balance_due_cents").notNull().default(0),
  status: text("status").notNull().default("draft"), // draft, sent, paid
  pdfStorageKey: text("pdf_storage_key"), // Object storage key for generated PDF
  footerText: text("footer_text"),
  stripeInvoiceId: varchar("stripe_invoice_id"),
  stripeHostedInvoiceUrl: text("stripe_hosted_invoice_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.clientId],
  }),
  lease: one(leases, {
    fields: [invoices.leaseId],
    references: [leases.leaseId],
  }),
  payments: many(payments),
  documents: many(documents),
}));

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  invoiceId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// ============================================
// PAYMENTS (Money received)
// ============================================
export const payments = pgTable("payments", {
  paymentId: varchar("payment_id").primaryKey(),
  clientId: varchar("client_id").notNull(),
  invoiceId: varchar("invoice_id"),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull().default("other"),
  status: text("status").notNull().default("paid"),
  paidAt: timestamp("paid_at"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  stripeChargeId: varchar("stripe_charge_id"),
  notes: text("notes"),
  webhookSentAt: timestamp("webhook_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  client: one(clients, {
    fields: [payments.clientId],
    references: [clients.clientId],
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.invoiceId],
  }),
}));

export const insertPaymentSchema = createInsertSchema(payments).omit({
  paymentId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// ============================================
// DOCUMENTS (Metadata for files stored in App Storage)
// ============================================
export const documents = pgTable("documents", {
  documentId: varchar("document_id").primaryKey(),
  clientId: varchar("client_id").notNull(),
  leaseId: varchar("lease_id"),
  invoiceId: varchar("invoice_id"),
  title: text("title").notNull(),
  docType: text("doc_type").notNull().default("other"), // general, agreement, invoice, other
  visibility: text("visibility").notNull().default("client_and_admin"),
  isActiveAgreement: boolean("is_active_agreement").notNull().default(false), // Only one can be true per client
  storageBucket: text("storage_bucket").notNull(),
  storageKey: text("storage_key").notNull(),
  contentType: text("content_type"),
  fileSizeBytes: integer("file_size_bytes"),
  uploadedByUserId: varchar("uploaded_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentsRelations = relations(documents, ({ one }) => ({
  client: one(clients, {
    fields: [documents.clientId],
    references: [clients.clientId],
  }),
  lease: one(leases, {
    fields: [documents.leaseId],
    references: [leases.leaseId],
  }),
  invoice: one(invoices, {
    fields: [documents.invoiceId],
    references: [invoices.invoiceId],
  }),
}));

export const insertDocumentSchema = createInsertSchema(documents).omit({
  documentId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// ============================================
// EXTERNAL ACCOUNTS (Placeholder for future Plaid/Stripe linking)
// ============================================
export const externalAccounts = pgTable("external_accounts", {
  accountId: varchar("account_id").primaryKey(),
  provider: text("provider").notNull(),
  nickname: text("nickname").notNull(),
  accountType: text("account_type"),
  status: text("status").notNull().default("linked"),
  lastSyncAt: timestamp("last_sync_at"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExternalAccountSchema = createInsertSchema(
  externalAccounts,
).omit({
  accountId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExternalAccount = z.infer<typeof insertExternalAccountSchema>;
export type ExternalAccount = typeof externalAccounts.$inferSelect;

// ============================================
// PLAID ITEMS (Linked institutions)
// ============================================
export const plaidItems = pgTable(
  "plaid_items",
  {
    itemId: varchar("item_id").primaryKey(), // ITEM-000001
    adminUserId: varchar("admin_user_id").notNull(),
    plaidItemId: varchar("plaid_item_id").notNull(),
    accessToken: text("access_token").notNull(),
    institutionId: text("institution_id"),
    institutionName: text("institution_name"),
    status: text("status").notNull().default("linked"), // linked, needs_auth, error
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    plaidItemIdIdx: index("plaid_items_plaid_item_id_idx").on(
      table.plaidItemId,
    ),
    adminUserIdIdx: index("plaid_items_admin_user_id_idx").on(
      table.adminUserId,
    ),
  }),
);

export const insertPlaidItemSchema = createInsertSchema(plaidItems).omit({
  itemId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlaidItem = z.infer<typeof insertPlaidItemSchema>;
export type PlaidItem = typeof plaidItems.$inferSelect;

// ============================================
// PLAID ACCOUNTS (Accounts under each item)
// ============================================
export const plaidAccounts = pgTable(
  "plaid_accounts",
  {
    accountId: varchar("account_id").primaryKey(), // PACCT-000001
    itemId: varchar("item_id").notNull(),
    plaidAccountId: varchar("plaid_account_id").notNull(),
    name: text("name").notNull(),
    officialName: text("official_name"),
    mask: text("mask"),
    type: text("type"),
    subtype: text("subtype"),
    currentBalanceCents: integer("current_balance_cents"),
    availableBalanceCents: integer("available_balance_cents"),
    isoCurrencyCode: text("iso_currency_code"),
    defaultFinanceType: text("default_finance_type"), // income, bill, debt, holding, other, or null
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    itemIdIdx: index("plaid_accounts_item_id_idx").on(table.itemId),
    plaidAccountIdIdx: index("plaid_accounts_plaid_account_id_idx").on(
      table.plaidAccountId,
    ),
  }),
);

export const insertPlaidAccountSchema = createInsertSchema(plaidAccounts).omit({
  accountId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlaidAccount = z.infer<typeof insertPlaidAccountSchema>;
export type PlaidAccount = typeof plaidAccounts.$inferSelect;

// ============================================
// PLAID TRANSACTIONS (Transactions pulled from Plaid)
// ============================================
export const plaidTransactions = pgTable(
  "plaid_transactions",
  {
    transactionId: varchar("transaction_id").primaryKey(), // PTXN-000001
    itemId: varchar("item_id").notNull(),
    plaidTransactionId: varchar("plaid_transaction_id").notNull(),
    plaidAccountId: varchar("plaid_account_id").notNull(),
    date: date("date").notNull(),
    name: text("name").notNull(),
    merchantName: text("merchant_name"),
    amountCents: integer("amount_cents").notNull(),
    isoCurrencyCode: text("iso_currency_code"),
    pending: boolean("pending").notNull().default(false),
    categoryPrimary: text("category_primary"),
    overrideFinanceType: text("override_finance_type"), // income, bill, debt, holding, other, or null (uses account default if null)
    overrideRecurrence: text("override_recurrence"), // one_time, weekly, biweekly, monthly, yearly, or null (defaults to one_time)
    recurringGroupId: varchar("recurring_group_id"), // Links to plaid_recurring_groups
    rawJson: jsonb("raw_json"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    itemIdIdx: index("plaid_transactions_item_id_idx").on(table.itemId),
    plaidTxnIdIdx: index("plaid_transactions_plaid_transaction_id_idx").on(
      table.plaidTransactionId,
    ),
    plaidAccountIdIdx: index("plaid_transactions_plaid_account_id_idx").on(
      table.plaidAccountId,
    ),
    recurringGroupIdIdx: index("plaid_transactions_recurring_group_id_idx").on(
      table.recurringGroupId,
    ),
  }),
);

export const insertPlaidTransactionSchema = createInsertSchema(
  plaidTransactions,
).omit({
  transactionId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlaidTransaction = z.infer<
  typeof insertPlaidTransactionSchema
>;
export type PlaidTransaction = typeof plaidTransactions.$inferSelect;

// ============================================
// PLAID CURSORS (Cursor for /transactions/sync)
// ============================================
export const plaidCursors = pgTable("plaid_cursors", {
  itemId: varchar("item_id").primaryKey(),
  cursor: text("cursor"),
  lastSyncAt: timestamp("last_sync_at"),
});
export type PlaidCursor = typeof plaidCursors.$inferSelect;

// ============================================
// PLAID RECURRING GROUPS (Groups related Plaid transactions)
// ============================================
export const plaidRecurringGroups = pgTable(
  "plaid_recurring_groups",
  {
    groupId: varchar("group_id").primaryKey(),
    adminUserId: varchar("admin_user_id").notNull(),
    label: text("label").notNull(), // e.g., "Gusto Payroll"
    recurrence: text("recurrence").notNull().default("monthly"), // one_time, weekly, biweekly, monthly, yearly
    financeType: text("finance_type"), // income, bill, debt, holding, other
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    adminUserIdIdx: index("plaid_recurring_groups_admin_user_id_idx").on(table.adminUserId),
  }),
);

export const insertPlaidRecurringGroupSchema = createInsertSchema(plaidRecurringGroups).omit({
  groupId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlaidRecurringGroup = z.infer<typeof insertPlaidRecurringGroupSchema>;
export type PlaidRecurringGroup = typeof plaidRecurringGroups.$inferSelect;

export function generateRecurringGroupId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "RG-";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================
// CLIENT BILLING ITEMS (Per-client charges)
// ============================================
export const clientBillingItems = pgTable(
  "client_billing_items",
  {
    id: varchar("id").primaryKey(),
    clientId: varchar("client_id").notNull(),
    type: text("type").notNull().default("other"), // rent, other
    title: text("title").notNull(),
    amountCents: integer("amount_cents").notNull(),
    dueDate: date("due_date").notNull(),
    frequency: text("frequency").notNull().default("one_time"), // one_time, weekly, monthly, yearly
    notes: text("notes"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    clientIdIdx: index("client_billing_items_client_id_idx").on(table.clientId),
  }),
);

export const clientBillingItemsRelations = relations(clientBillingItems, ({ one }) => ({
  client: one(clients, {
    fields: [clientBillingItems.clientId],
    references: [clients.clientId],
  }),
}));

export const insertClientBillingItemSchema = createInsertSchema(clientBillingItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClientBillingItem = z.infer<typeof insertClientBillingItemSchema>;
export type ClientBillingItem = typeof clientBillingItems.$inferSelect;

// ============================================
// FINANCE ENTRIES (Manual finance tracking)
// ============================================
export const financeEntries = pgTable(
  "finance_entries",
  {
    entryId: varchar("entry_id").primaryKey(),
    adminUserId: varchar("admin_user_id").notNull(),
    clientId: varchar("client_id"), // Optional: links entry to specific client
    entryType: text("entry_type").notNull().default("manual"), // "manual" | "linked"
    categoryGroup: text("category_group").notNull(), // "income" | "bills" | "debts" | "holdings"
    title: text("title").notNull(),
    amountCents: integer("amount_cents").notNull(),
    date: date("date").notNull(),
    recurrence: text("recurrence"), // "one_time" | "weekly" | "biweekly" | "monthly" | "yearly" | null
    notes: text("notes"),
    plaidAccountId: varchar("plaid_account_id"),
    externalUrl: text("external_url"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    adminUserIdIdx: index("finance_entries_admin_user_id_idx").on(table.adminUserId),
    categoryGroupIdx: index("finance_entries_category_group_idx").on(table.categoryGroup),
    clientIdIdx: index("finance_entries_client_id_idx").on(table.clientId),
  }),
);

export const insertFinanceEntrySchema = createInsertSchema(financeEntries).omit({
  entryId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFinanceEntry = z.infer<typeof insertFinanceEntrySchema>;
export type FinanceEntry = typeof financeEntries.$inferSelect;

// ============================================
// ID GENERATION HELPERS
// ============================================
export function generateClientId(): string {
  const num = Math.floor(Math.random() * 999999) + 1;
  return `CL-${num.toString().padStart(6, "0")}`;
}

export function generateLeaseId(): string {
  const num = Math.floor(Math.random() * 999999) + 1;
  return `LE-${num.toString().padStart(6, "0")}`;
}

export function generateInvoiceId(): string {
  const num = Math.floor(Math.random() * 999999) + 1;
  return `INV-${num.toString().padStart(6, "0")}`;
}

export function generatePaymentId(): string {
  const num = Math.floor(Math.random() * 999999) + 1;
  return `PAY-${num.toString().padStart(6, "0")}`;
}

export function generateDocumentId(): string {
  const num = Math.floor(Math.random() * 999999) + 1;
  return `DOC-${num.toString().padStart(6, "0")}`;
}

export function generateAccountId(): string {
  const num = Math.floor(Math.random() * 999999) + 1;
  return `ACC-${num.toString().padStart(6, "0")}`;
}

// ============================================
// MOBILE AUTH (JWT token-based auth for native apps)
// ============================================
export const mobileRefreshTokens = pgTable("mobile_refresh_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  deviceName: text("device_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  lastUsedAt: timestamp("last_used_at"),
});

export const mobileRevokedJtis = pgTable("mobile_revoked_jtis", {
  jti: varchar("jti", { length: 64 }).primaryKey(),
  userId: varchar("user_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MobileRefreshToken = typeof mobileRefreshTokens.$inferSelect;
export type MobileRevokedJti = typeof mobileRevokedJtis.$inferSelect;

// ============================================
// ID GENERATORS
// ============================================

export function generatePlaidItemId(): string {
  const num = Math.floor(Math.random() * 999999) + 1;
  return `ITEM-${num.toString().padStart(6, "0")}`;
}

export function generatePlaidAccountRowId(): string {
  const num = Math.floor(Math.random() * 999999) + 1;
  return `PACCT-${num.toString().padStart(6, "0")}`;
}

export function generatePlaidTransactionRowId(): string {
  const num = Math.floor(Math.random() * 999999) + 1;
  return `PTXN-${num.toString().padStart(6, "0")}`;
}

export function generateMagicNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += "-";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateFinanceEntryId(): string {
  const num = Math.floor(Math.random() * 999999) + 1;
  return `FIN-${num.toString().padStart(6, "0")}`;
}

export function generateClientBillingItemId(): string {
  const num = Math.floor(Math.random() * 999999) + 1;
  return `CBI-${num.toString().padStart(6, "0")}`;
}

export function generateInvoiceSettingsId(): string {
  return `IS-default`;
}

export function formatInvoiceNumber(prefix: string, num: number): string {
  return `${prefix}${num.toString().padStart(6, "0")}`;
}
