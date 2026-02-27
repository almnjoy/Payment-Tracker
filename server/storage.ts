import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  usersProfile,
  clients,
  leases,
  inviteCodes,
  invoices,
  payments,
  documents,
  externalAccounts,
  paymentSettings,
  automationSettings,
  clientBillingItems,
  plaidItems,
  plaidAccounts,
  plaidTransactions,
  plaidCursors,
  plaidRecurringGroups,
  financeEntries,
  generateClientId,
  generateLeaseId,
  generateInvoiceId,
  generatePaymentId,
  generateDocumentId,
  generateAccountId,
  generateMagicNumber,
  generatePlaidItemId,
  generatePlaidAccountRowId,
  generatePlaidTransactionRowId,
  generateFinanceEntryId,
  generateRecurringGroupId,
  type UsersProfile,
  type InsertUsersProfile,
  type Client,
  type InsertClient,
  type Lease,
  type InsertLease,
  type InviteCode,
  type InsertInviteCode,
  type Invoice,
  type InsertInvoice,
  type Payment,
  type InsertPayment,
  type Document,
  type InsertDocument,
  type ExternalAccount,
  type InsertExternalAccount,
  type PaymentSettings,
  type InsertPaymentSettings,
  type AutomationSettings,
  type InsertAutomationSettings,
} from "@shared/schema";

export interface IStorage {
  // Users Profile
  getUserProfile(userId: string): Promise<UsersProfile | undefined>;
  getUserProfileByClientId(clientId: string): Promise<UsersProfile | undefined>;
  upsertUserProfile(data: InsertUsersProfile): Promise<UsersProfile>;

  // Clients
  getClient(clientId: string): Promise<Client | undefined>;
  getAllClients(): Promise<Client[]>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(clientId: string, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(clientId: string): Promise<boolean>;

  // Leases
  getLease(leaseId: string): Promise<Lease | undefined>;
  getLeasesByClient(clientId: string): Promise<Lease[]>;
  createLease(data: InsertLease): Promise<Lease>;
  updateLease(leaseId: string, data: Partial<InsertLease>): Promise<Lease | undefined>;

  // Invite Codes
  getInviteCode(magicNumber: string): Promise<InviteCode | undefined>;
  createInviteCode(data: InsertInviteCode): Promise<InviteCode>;
  claimInviteCode(magicNumber: string, userId: string): Promise<InviteCode | undefined>;

  // Invoices
  getInvoice(invoiceId: string): Promise<Invoice | undefined>;
  getInvoicesByClient(clientId: string): Promise<Invoice[]>;
  getAllInvoices(): Promise<Invoice[]>;
  createInvoice(data: InsertInvoice): Promise<Invoice>;
  updateInvoice(invoiceId: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(invoiceId: string): Promise<boolean>;

  // Payments
  getPayment(paymentId: string): Promise<Payment | undefined>;
  getPaymentsByClient(clientId: string): Promise<Payment[]>;
  getAllPayments(): Promise<Payment[]>;
  createPayment(data: InsertPayment): Promise<Payment>;
  updatePayment(paymentId: string, data: Partial<InsertPayment>): Promise<Payment | undefined>;
  updatePaymentStatus(paymentId: string, status: string): Promise<Payment | undefined>;

  // Documents
  getDocument(documentId: string): Promise<Document | undefined>;
  getDocumentsByClient(clientId: string, visibility?: string): Promise<Document[]>;
  getAllDocuments(): Promise<Document[]>;
  createDocument(data: InsertDocument): Promise<Document>;
  deleteDocument(documentId: string): Promise<boolean>;

  // External Accounts
  getExternalAccount(accountId: string): Promise<ExternalAccount | undefined>;
  getAllExternalAccounts(): Promise<ExternalAccount[]>;
  createExternalAccount(data: InsertExternalAccount): Promise<ExternalAccount>;
  deleteExternalAccount(accountId: string): Promise<boolean>;
  
  // Payment Settings
  getPaymentSettings(): Promise<PaymentSettings | undefined>;
  upsertPaymentSettings(data: InsertPaymentSettings): Promise<PaymentSettings>;

  // Automation Settings
  getAutomationSettings(): Promise<AutomationSettings | undefined>;
  upsertAutomationSettings(data: InsertAutomationSettings): Promise<AutomationSettings>;
  
  // Documents - additional methods
  updateDocument(documentId: string, data: Partial<InsertDocument>): Promise<Document | undefined>;
  clearActiveAgreementForClient(clientId: string): Promise<void>;
  getActiveAgreementForClient(clientId: string): Promise<Document | undefined>;

  // Tenant-safe helpers (organizationId maps to adminUserId)
  createPlaidItemForOrganization(organizationId: string, data: {
    plaidItemId: string;
    accessToken: string;
    institutionId?: string | null;
    institutionName?: string | null;
  }): Promise<string>;
  upsertPlaidAccountForOrganization(organizationId: string, itemId: string, account: {
    plaidAccountId: string;
    name: string;
    officialName?: string | null;
    mask?: string | null;
    type?: string | null;
    subtype?: string | null;
    currentBalanceCents?: number | null;
    availableBalanceCents?: number | null;
    isoCurrencyCode?: string | null;
  }): Promise<void>;
  upsertPlaidTransactionForOrganization(organizationId: string, itemId: string, txn: {
    plaidTransactionId: string;
    plaidAccountId: string;
    date: string;
    name: string;
    merchantName?: string | null;
    amountCents: number;
    isoCurrencyCode?: string | null;
    pending: boolean;
    categoryPrimary?: string | null;
    rawJson?: unknown;
  }): Promise<boolean>;
  upsertPlaidCursorForOrganization(organizationId: string, itemId: string, cursor: string): Promise<void>;
  deletePlaidItemForOrganization(organizationId: string, itemId: string): Promise<boolean>;
  createFinanceEntryForOrganization(organizationId: string, data: {
    clientId?: string | null;
    entryType?: string | null;
    categoryGroup: string;
    title: string;
    amountCents: number;
    date: string;
    recurrence?: string | null;
    notes?: string | null;
    plaidAccountId?: string | null;
    externalUrl?: string | null;
  }): Promise<any>;
  deleteFinanceEntryForOrganization(organizationId: string, entryId: string): Promise<boolean>;
  createRecurringGroupForOrganization(organizationId: string, data: {
    label: string;
    recurrence: string;
    financeType?: string | null;
  }): Promise<any>;
  updateRecurringGroupForOrganization(organizationId: string, groupId: string, updates: Record<string, unknown>): Promise<any>;
  setTransactionRecurringGroupForOrganization(organizationId: string, transactionIds: string[], recurringGroupId: string | null): Promise<void>;
  updateTransactionRecurrenceForOrganization(organizationId: string, transactionId: string, recurrence: string | null): Promise<void>;
  
  // Admin utilities
  hasExistingAdmin(): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // ============================================
  // USERS PROFILE
  // ============================================
  async getUserProfile(userId: string): Promise<UsersProfile | undefined> {
    const [profile] = await db.select().from(usersProfile).where(eq(usersProfile.userId, userId));
    return profile;
  }

  async getUserProfileByClientId(clientId: string): Promise<UsersProfile | undefined> {
    const [profile] = await db.select().from(usersProfile).where(eq(usersProfile.clientId, clientId));
    return profile;
  }

  async upsertUserProfile(data: InsertUsersProfile): Promise<UsersProfile> {
    const [profile] = await db
      .insert(usersProfile)
      .values(data)
      .onConflictDoUpdate({
        target: usersProfile.userId,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();
    return profile;
  }

  // ============================================
  // CLIENTS
  // ============================================
  async getClient(clientId: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.clientId, clientId));
    return client;
  }

  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async createClient(data: InsertClient): Promise<Client> {
    const clientId = generateClientId();
    const [client] = await db
      .insert(clients)
      .values({ ...data, clientId })
      .returning();
    return client;
  }

  async updateClient(clientId: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.clientId, clientId))
      .returning();
    return client;
  }

  async deleteClient(clientId: string): Promise<boolean> {
    // Delete all related data in order (foreign key constraints)
    await db.delete(clientBillingItems).where(eq(clientBillingItems.clientId, clientId));
    await db.delete(documents).where(eq(documents.clientId, clientId));
    await db.delete(payments).where(eq(payments.clientId, clientId));
    await db.delete(invoices).where(eq(invoices.clientId, clientId));
    await db.delete(leases).where(eq(leases.clientId, clientId));
    await db.delete(inviteCodes).where(eq(inviteCodes.clientId, clientId));
    
    // Finally delete the client
    const result = await db.delete(clients).where(eq(clients.clientId, clientId)).returning();
    return result.length > 0;
  }

  // ============================================
  // LEASES
  // ============================================
  async getLease(leaseId: string): Promise<Lease | undefined> {
    const [lease] = await db.select().from(leases).where(eq(leases.leaseId, leaseId));
    return lease;
  }

  async getLeasesByClient(clientId: string): Promise<Lease[]> {
    return await db.select().from(leases).where(eq(leases.clientId, clientId)).orderBy(desc(leases.createdAt));
  }

  async createLease(data: InsertLease): Promise<Lease> {
    const leaseId = generateLeaseId();
    const [lease] = await db
      .insert(leases)
      .values({ ...data, leaseId })
      .returning();
    return lease;
  }

  async updateLease(leaseId: string, data: Partial<InsertLease>): Promise<Lease | undefined> {
    const [lease] = await db
      .update(leases)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leases.leaseId, leaseId))
      .returning();
    return lease;
  }

  // ============================================
  // INVITE CODES
  // ============================================
  async getInviteCode(magicNumber: string): Promise<InviteCode | undefined> {
    const [code] = await db.select().from(inviteCodes).where(eq(inviteCodes.magicNumber, magicNumber));
    return code;
  }

  async createInviteCode(data: InsertInviteCode): Promise<InviteCode> {
    const magicNumber = data.magicNumber || generateMagicNumber();
    const [code] = await db
      .insert(inviteCodes)
      .values({ ...data, magicNumber })
      .returning();
    return code;
  }

  async claimInviteCode(magicNumber: string, userId: string): Promise<InviteCode | undefined> {
    const [code] = await db
      .update(inviteCodes)
      .set({ usedAt: new Date(), usedByUserId: userId })
      .where(
        and(
          eq(inviteCodes.magicNumber, magicNumber),
          sql`${inviteCodes.usedAt} IS NULL`
        )
      )
      .returning();
    return code;
  }

  // ============================================
  // INVOICES
  // ============================================
  async getInvoice(invoiceId: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.invoiceId, invoiceId));
    return invoice;
  }

  async getInvoicesByClient(clientId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.clientId, clientId)).orderBy(desc(invoices.createdAt));
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    const invoiceId = generateInvoiceId();
    const insertData = {
      ...data,
      invoiceId,
      lineItems: data.lineItems || [],
    };
    const [invoice] = await db
      .insert(invoices)
      .values(insertData as any)
      .returning();
    return invoice;
  }

  async updateInvoice(invoiceId: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    const [invoice] = await db
      .update(invoices)
      .set(updateData as any)
      .where(eq(invoices.invoiceId, invoiceId))
      .returning();
    return invoice;
  }

  async deleteInvoice(invoiceId: string): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.invoiceId, invoiceId)).returning();
    return result.length > 0;
  }

  // ============================================
  // PAYMENTS
  // ============================================
  async getPayment(paymentId: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.paymentId, paymentId));
    return payment;
  }

  async getPaymentsByClient(clientId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.clientId, clientId)).orderBy(desc(payments.createdAt));
  }

  async getAllPayments(): Promise<Payment[]> {
    return await db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    const paymentId = generatePaymentId();
    const [payment] = await db
      .insert(payments)
      .values({ ...data, paymentId })
      .returning();
    return payment;
  }

  async updatePayment(paymentId: string, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(payments.paymentId, paymentId))
      .returning();
    return payment;
  }

  async updatePaymentStatus(paymentId: string, status: string): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set({ status, updatedAt: new Date() })
      .where(eq(payments.paymentId, paymentId))
      .returning();
    return payment;
  }

  // ============================================
  // DOCUMENTS
  // ============================================
  async getDocument(documentId: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.documentId, documentId));
    return doc;
  }

  async getDocumentsByClient(clientId: string, visibility?: string): Promise<Document[]> {
    if (visibility) {
      return await db
        .select()
        .from(documents)
        .where(and(eq(documents.clientId, clientId), eq(documents.visibility, visibility)))
        .orderBy(desc(documents.createdAt));
    }
    return await db.select().from(documents).where(eq(documents.clientId, clientId)).orderBy(desc(documents.createdAt));
  }

  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(documents).orderBy(desc(documents.createdAt));
  }

  async createDocument(data: InsertDocument): Promise<Document> {
    const documentId = generateDocumentId();
    const [doc] = await db
      .insert(documents)
      .values({ ...data, documentId })
      .returning();
    return doc;
  }

  async deleteDocument(documentId: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.documentId, documentId)).returning();
    return result.length > 0;
  }

  // ============================================
  // EXTERNAL ACCOUNTS
  // ============================================
  async getExternalAccount(accountId: string): Promise<ExternalAccount | undefined> {
    const [account] = await db.select().from(externalAccounts).where(eq(externalAccounts.accountId, accountId));
    return account;
  }

  async getAllExternalAccounts(): Promise<ExternalAccount[]> {
    return await db.select().from(externalAccounts).orderBy(desc(externalAccounts.createdAt));
  }

  async createExternalAccount(data: InsertExternalAccount): Promise<ExternalAccount> {
    const accountId = generateAccountId();
    const [account] = await db
      .insert(externalAccounts)
      .values({ ...data, accountId })
      .returning();
    return account;
  }

  async deleteExternalAccount(accountId: string): Promise<boolean> {
    const result = await db.delete(externalAccounts).where(eq(externalAccounts.accountId, accountId)).returning();
    return result.length > 0;
  }

  // ============================================
  // PAYMENT SETTINGS
  // ============================================
  async getPaymentSettings(): Promise<PaymentSettings | undefined> {
    const [settings] = await db.select().from(paymentSettings).where(eq(paymentSettings.id, "default"));
    return settings;
  }

  async upsertPaymentSettings(data: InsertPaymentSettings): Promise<PaymentSettings> {
    const [settings] = await db
      .insert(paymentSettings)
      .values({ ...data, id: "default" })
      .onConflictDoUpdate({
        target: paymentSettings.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();
    return settings;
  }

  // ============================================
  // AUTOMATION SETTINGS
  // ============================================
  async getAutomationSettings(): Promise<AutomationSettings | undefined> {
    const [settings] = await db.select().from(automationSettings).where(eq(automationSettings.id, "default"));
    return settings;
  }

  async upsertAutomationSettings(data: InsertAutomationSettings): Promise<AutomationSettings> {
    const [settings] = await db
      .insert(automationSettings)
      .values({ ...data, id: "default" })
      .onConflictDoUpdate({
        target: automationSettings.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();
    return settings;
  }

  // ============================================
  // DOCUMENTS - Additional Methods
  // ============================================
  async updateDocument(documentId: string, data: Partial<InsertDocument>): Promise<Document | undefined> {
    const [doc] = await db
      .update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documents.documentId, documentId))
      .returning();
    return doc;
  }

  async clearActiveAgreementForClient(clientId: string): Promise<void> {
    await db
      .update(documents)
      .set({ isActiveAgreement: false, updatedAt: new Date() })
      .where(and(eq(documents.clientId, clientId), eq(documents.isActiveAgreement, true)));
  }

  async getActiveAgreementForClient(clientId: string): Promise<Document | undefined> {
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.clientId, clientId), eq(documents.isActiveAgreement, true)));
    return doc;
  }


  private assertOrganizationId(organizationId: string): string {
    if (!organizationId || !organizationId.trim()) {
      throw new Error("organizationId is required for tenant-owned table operations");
    }
    return organizationId;
  }

  async createPlaidItemForOrganization(
    organizationId: string,
    data: { plaidItemId: string; accessToken: string; institutionId?: string | null; institutionName?: string | null },
  ): Promise<string> {
    const tenantId = this.assertOrganizationId(organizationId);
    const itemId = generatePlaidItemId();

    await db.insert(plaidItems).values({
      itemId,
      adminUserId: tenantId,
      plaidItemId: data.plaidItemId,
      accessToken: data.accessToken,
      institutionId: data.institutionId || null,
      institutionName: data.institutionName || null,
      status: "linked",
    });

    return itemId;
  }

  async upsertPlaidAccountForOrganization(
    organizationId: string,
    itemId: string,
    account: {
      plaidAccountId: string;
      name: string;
      officialName?: string | null;
      mask?: string | null;
      type?: string | null;
      subtype?: string | null;
      currentBalanceCents?: number | null;
      availableBalanceCents?: number | null;
      isoCurrencyCode?: string | null;
    },
  ): Promise<void> {
    const tenantId = this.assertOrganizationId(organizationId);
    const [item] = await db
      .select()
      .from(plaidItems)
      .where(and(eq(plaidItems.itemId, itemId), eq(plaidItems.adminUserId, tenantId)))
      .limit(1);

    if (!item) throw new Error("Plaid item not found for organization");

    const [existingAccount] = await db
      .select()
      .from(plaidAccounts)
      .where(and(eq(plaidAccounts.itemId, itemId), eq(plaidAccounts.plaidAccountId, account.plaidAccountId)))
      .limit(1);

    if (!existingAccount) {
      await db.insert(plaidAccounts).values({
        accountId: generatePlaidAccountRowId(),
        itemId,
        plaidAccountId: account.plaidAccountId,
        name: account.name,
        officialName: account.officialName || null,
        mask: account.mask || null,
        type: account.type || null,
        subtype: account.subtype || null,
        currentBalanceCents: account.currentBalanceCents ?? null,
        availableBalanceCents: account.availableBalanceCents ?? null,
        isoCurrencyCode: account.isoCurrencyCode || "USD",
      });
      return;
    }

    await db
      .update(plaidAccounts)
      .set({
        name: account.name,
        officialName: account.officialName || null,
        mask: account.mask || null,
        type: account.type || null,
        subtype: account.subtype || null,
        currentBalanceCents: account.currentBalanceCents ?? null,
        availableBalanceCents: account.availableBalanceCents ?? null,
        isoCurrencyCode: account.isoCurrencyCode || "USD",
        updatedAt: new Date(),
      })
      .where(eq(plaidAccounts.accountId, existingAccount.accountId));
  }

  async upsertPlaidTransactionForOrganization(
    organizationId: string,
    itemId: string,
    txn: {
      plaidTransactionId: string;
      plaidAccountId: string;
      date: string;
      name: string;
      merchantName?: string | null;
      amountCents: number;
      isoCurrencyCode?: string | null;
      pending: boolean;
      categoryPrimary?: string | null;
      rawJson?: unknown;
    },
  ): Promise<boolean> {
    const tenantId = this.assertOrganizationId(organizationId);
    const [item] = await db
      .select()
      .from(plaidItems)
      .where(and(eq(plaidItems.itemId, itemId), eq(plaidItems.adminUserId, tenantId)))
      .limit(1);

    if (!item) throw new Error("Plaid item not found for organization");

    const [existingTxn] = await db
      .select()
      .from(plaidTransactions)
      .where(and(eq(plaidTransactions.itemId, itemId), eq(plaidTransactions.plaidTransactionId, txn.plaidTransactionId)))
      .limit(1);

    if (!existingTxn) {
      await db.insert(plaidTransactions).values({
        transactionId: generatePlaidTransactionRowId(),
        itemId,
        plaidTransactionId: txn.plaidTransactionId,
        plaidAccountId: txn.plaidAccountId,
        date: txn.date,
        name: txn.name,
        merchantName: txn.merchantName || null,
        amountCents: txn.amountCents,
        isoCurrencyCode: txn.isoCurrencyCode || "USD",
        pending: txn.pending,
        categoryPrimary: txn.categoryPrimary || null,
        rawJson: (txn.rawJson as any) || null,
      });
      return true;
    }

    await db
      .update(plaidTransactions)
      .set({
        date: txn.date,
        name: txn.name,
        merchantName: txn.merchantName || null,
        amountCents: txn.amountCents,
        pending: txn.pending,
        categoryPrimary: txn.categoryPrimary || null,
        rawJson: (txn.rawJson as any) || null,
        updatedAt: new Date(),
      })
      .where(eq(plaidTransactions.transactionId, existingTxn.transactionId));

    return false;
  }

  async upsertPlaidCursorForOrganization(organizationId: string, itemId: string, cursor: string): Promise<void> {
    const tenantId = this.assertOrganizationId(organizationId);
    const [item] = await db
      .select()
      .from(plaidItems)
      .where(and(eq(plaidItems.itemId, itemId), eq(plaidItems.adminUserId, tenantId)))
      .limit(1);

    if (!item) throw new Error("Plaid item not found for organization");

    await db
      .insert(plaidCursors)
      .values({ itemId, cursor, lastSyncAt: new Date() })
      .onConflictDoUpdate({
        target: plaidCursors.itemId,
        set: { cursor, lastSyncAt: new Date() },
      });
  }

  async deletePlaidItemForOrganization(organizationId: string, itemId: string): Promise<boolean> {
    const tenantId = this.assertOrganizationId(organizationId);
    const [item] = await db
      .select()
      .from(plaidItems)
      .where(and(eq(plaidItems.itemId, itemId), eq(plaidItems.adminUserId, tenantId)))
      .limit(1);

    if (!item) return false;

    await db.delete(plaidTransactions).where(eq(plaidTransactions.itemId, itemId));
    await db.delete(plaidAccounts).where(eq(plaidAccounts.itemId, itemId));
    await db.delete(plaidCursors).where(eq(plaidCursors.itemId, itemId));
    await db.delete(plaidItems).where(eq(plaidItems.itemId, itemId));
    return true;
  }

  async createFinanceEntryForOrganization(
    organizationId: string,
    data: {
      clientId?: string | null;
      entryType?: string | null;
      categoryGroup: string;
      title: string;
      amountCents: number;
      date: string;
      recurrence?: string | null;
      notes?: string | null;
      plaidAccountId?: string | null;
      externalUrl?: string | null;
    },
  ): Promise<any> {
    const tenantId = this.assertOrganizationId(organizationId);
    const entryId = generateFinanceEntryId();
    await db.insert(financeEntries).values({
      entryId,
      adminUserId: tenantId,
      clientId: data.clientId || null,
      entryType: data.entryType || "manual",
      categoryGroup: data.categoryGroup,
      title: data.title,
      amountCents: data.amountCents,
      date: data.date,
      recurrence: data.recurrence || null,
      notes: data.notes || null,
      plaidAccountId: data.plaidAccountId || null,
      externalUrl: data.externalUrl || null,
    });

    const [entry] = await db.select().from(financeEntries).where(eq(financeEntries.entryId, entryId)).limit(1);
    return entry;
  }

  async deleteFinanceEntryForOrganization(organizationId: string, entryId: string): Promise<boolean> {
    const tenantId = this.assertOrganizationId(organizationId);
    const result = await db
      .delete(financeEntries)
      .where(and(eq(financeEntries.entryId, entryId), eq(financeEntries.adminUserId, tenantId)))
      .returning({ entryId: financeEntries.entryId });
    return result.length > 0;
  }

  async createRecurringGroupForOrganization(
    organizationId: string,
    data: { label: string; recurrence: string; financeType?: string | null },
  ): Promise<any> {
    const tenantId = this.assertOrganizationId(organizationId);
    const groupId = generateRecurringGroupId();
    await db.insert(plaidRecurringGroups).values({
      groupId,
      adminUserId: tenantId,
      label: data.label,
      recurrence: data.recurrence,
      financeType: data.financeType || null,
      isActive: true,
    });
    const [group] = await db.select().from(plaidRecurringGroups).where(eq(plaidRecurringGroups.groupId, groupId)).limit(1);
    return group;
  }

  async updateRecurringGroupForOrganization(
    organizationId: string,
    groupId: string,
    updates: Record<string, unknown>,
  ): Promise<any> {
    const tenantId = this.assertOrganizationId(organizationId);
    await db
      .update(plaidRecurringGroups)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(plaidRecurringGroups.groupId, groupId), eq(plaidRecurringGroups.adminUserId, tenantId)));
    const [group] = await db
      .select()
      .from(plaidRecurringGroups)
      .where(and(eq(plaidRecurringGroups.groupId, groupId), eq(plaidRecurringGroups.adminUserId, tenantId)))
      .limit(1);
    return group;
  }

  async setTransactionRecurringGroupForOrganization(
    organizationId: string,
    transactionIds: string[],
    recurringGroupId: string | null,
  ): Promise<void> {
    const tenantId = this.assertOrganizationId(organizationId);
    if (transactionIds.length === 0) return;

    await db
      .update(plaidTransactions)
      .set({ recurringGroupId, updatedAt: new Date() })
      .where(
        and(
          inArray(plaidTransactions.transactionId, transactionIds),
          sql`${plaidTransactions.itemId} IN (select ${plaidItems.itemId} from ${plaidItems} where ${plaidItems.adminUserId} = ${tenantId})`,
        ),
      );
  }

  async updateTransactionRecurrenceForOrganization(
    organizationId: string,
    transactionId: string,
    recurrence: string | null,
  ): Promise<void> {
    const tenantId = this.assertOrganizationId(organizationId);
    await db
      .update(plaidTransactions)
      .set({ overrideRecurrence: recurrence, updatedAt: new Date() })
      .where(
        and(
          eq(plaidTransactions.transactionId, transactionId),
          sql`${plaidTransactions.itemId} IN (select ${plaidItems.itemId} from ${plaidItems} where ${plaidItems.adminUserId} = ${tenantId})`,
        ),
      );
  }

  // ============================================
  // ADMIN UTILITIES
  // ============================================
  async hasExistingAdmin(): Promise<boolean> {
    const [admin] = await db
      .select()
      .from(usersProfile)
      .where(eq(usersProfile.role, "admin"))
      .limit(1);
    return !!admin;
  }
}

export const storage = new DatabaseStorage();
