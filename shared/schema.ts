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
// INVOICES (Bills owed)
// ============================================
export const invoices = pgTable("invoices", {
  invoiceId: varchar("invoice_id").primaryKey(),
  clientId: varchar("client_id").notNull(),
  leaseId: varchar("lease_id"),
  title: text("title").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dueDate: date("due_date").notNull(),
  status: text("status").notNull().default("open"),
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
  docType: text("doc_type").notNull().default("other"),
  visibility: text("visibility").notNull().default("client_and_admin"),
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
