import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  usersProfile,
  clients,
  leases,
  inviteCodes,
  organizationMemberships,
  clientMemberships,
  invoices,
  payments,
  documents,
  externalAccounts,
  paymentSettings,
  organizationSettings,
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
  type OrganizationMembership,
  type InsertOrganizationMembership,
  type ClientMembership,
  type InsertClientMembership,
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
  type OrganizationSettings,
  type InsertOrganizationSettings,
  type AutomationSettings,
  type InsertAutomationSettings,
} from "@shared/schema";

const DEFAULT_ORG_ID = "org-default";

export interface IStorage {
  // Users Profile
  getUserProfile(userId: string, organizationId?: string): Promise<UsersProfile | undefined>;
  getUserProfileByClientId(clientId: string): Promise<UsersProfile | undefined>;
  upsertUserProfile(data: InsertUsersProfile): Promise<UsersProfile>;

  // Organization memberships
  getOrganizationMembership(userId: string, organizationId: string): Promise<OrganizationMembership | undefined>;
  upsertOrganizationMembership(data: InsertOrganizationMembership): Promise<OrganizationMembership>;

  // Client memberships
  getClientMembershipForUser(userId: string, organizationId: string): Promise<ClientMembership | undefined>;
  findClientMembership(organizationId: string, clientId: string): Promise<ClientMembership | undefined>;
  upsertClientMembership(data: InsertClientMembership): Promise<ClientMembership>;

  // Clients
  getClient(clientId: string, organizationId?: string): Promise<Client | undefined>;
  getAllClients(organizationId?: string): Promise<Client[]>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(clientId: string, data: Partial<InsertClient>, organizationId?: string): Promise<Client | undefined>;
  deleteClient(clientId: string, organizationId?: string): Promise<boolean>;

  // Leases
  getLease(leaseId: string, organizationId?: string): Promise<Lease | undefined>;
  getLeasesByClient(clientId: string, organizationId?: string): Promise<Lease[]>;
  createLease(data: InsertLease): Promise<Lease>;
  updateLease(leaseId: string, data: Partial<InsertLease>, organizationId?: string): Promise<Lease | undefined>;

  // Invite Codes
  getInviteCode(magicNumber: string, organizationId?: string): Promise<InviteCode | undefined>;
  createInviteCode(data: InsertInviteCode): Promise<InviteCode>;
  claimInviteCode(magicNumber: string, userId: string, organizationId?: string): Promise<InviteCode | undefined>;

  // Invoices
  getInvoice(invoiceId: string, organizationId?: string): Promise<Invoice | undefined>;
  getInvoicesByClient(clientId: string, organizationId?: string): Promise<Invoice[]>;
  getAllInvoices(organizationId?: string): Promise<Invoice[]>;
  createInvoice(data: InsertInvoice): Promise<Invoice>;
  updateInvoice(invoiceId: string, data: Partial<InsertInvoice>, organizationId?: string): Promise<Invoice | undefined>;
  deleteInvoice(invoiceId: string, organizationId?: string): Promise<boolean>;

  // Payments
  getPayment(paymentId: string, organizationId?: string): Promise<Payment | undefined>;
  getPaymentsByClient(clientId: string, organizationId?: string): Promise<Payment[]>;
  getAllPayments(organizationId?: string): Promise<Payment[]>;
  createPayment(data: InsertPayment): Promise<Payment>;
  updatePayment(paymentId: string, data: Partial<InsertPayment>, organizationId?: string): Promise<Payment | undefined>;
  updatePaymentStatus(paymentId: string, status: string, organizationId?: string): Promise<Payment | undefined>;

  // Documents
  getDocument(documentId: string, organizationId?: string): Promise<Document | undefined>;
  getDocumentsByClient(clientId: string, organizationId?: string, visibility?: string): Promise<Document[]>;
  getAllDocuments(organizationId?: string): Promise<Document[]>;
  createDocument(data: InsertDocument): Promise<Document>;
  deleteDocument(documentId: string, organizationId?: string): Promise<boolean>;

  // External Accounts
  getExternalAccount(accountId: string): Promise<ExternalAccount | undefined>;
  getAllExternalAccounts(): Promise<ExternalAccount[]>;
  createExternalAccount(data: InsertExternalAccount): Promise<ExternalAccount>;
  deleteExternalAccount(accountId: string): Promise<boolean>;
  
  // Payment Settings
  getPaymentSettings(organizationId?: string): Promise<PaymentSettings | undefined>;
  upsertPaymentSettings(organizationId: string, data: Omit<InsertPaymentSettings, "organizationId">): Promise<PaymentSettings>;

  // Organization Settings
  getOrganizationSettings(): Promise<OrganizationSettings | undefined>;
  upsertOrganizationSettings(data: InsertOrganizationSettings): Promise<OrganizationSettings>;

  // Automation Settings
  getAutomationSettings(organizationId?: string): Promise<AutomationSettings | undefined>;
  upsertAutomationSettings(organizationId: string, data: Omit<InsertAutomationSettings, "organizationId">): Promise<AutomationSettings>;
  
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
  

  // Organization memberships
  getOrganizationMembership(userId: string, organizationId: string): Promise<OrganizationMembership | undefined>;
  getActiveMembershipsByOrganization(organizationId: string): Promise<OrganizationMembership[]>;
  getActiveMembershipsByUser(userId: string): Promise<OrganizationMembership[]>;
  createOrganizationMembership(data: InsertOrganizationMembership): Promise<OrganizationMembership>;
  updateOrganizationMembershipRole(userId: string, organizationId: string, role: MembershipRole): Promise<OrganizationMembership | undefined>;
  updateOrganizationMembershipStatus(userId: string, organizationId: string, status: "active" | "inactive"): Promise<OrganizationMembership | undefined>;

  // Admin utilities
  hasExistingAdmin(): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // ============================================
  // USERS PROFILE
  // ============================================
  async getUserProfile(userId: string, organizationId: string = DEFAULT_ORG_ID): Promise<UsersProfile | undefined> {
    const [profile] = await db.select().from(usersProfile).where(organizationId ? and(eq(usersProfile.userId, userId), eq(usersProfile.organizationId, organizationId)) : eq(usersProfile.userId, userId));
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

  async getOrganizationMembership(userId: string, organizationId: string): Promise<OrganizationMembership | undefined> {
    const [membership] = await db
      .select()
      .from(organizationMemberships)
      .where(and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.organizationId, organizationId),
      ));
    return membership;
  }

  async upsertOrganizationMembership(data: InsertOrganizationMembership): Promise<OrganizationMembership> {
    const [membership] = await db
      .insert(organizationMemberships)
      .values(data)
      .onConflictDoUpdate({
        target: [organizationMemberships.organizationId, organizationMemberships.userId],
        set: {
          role: data.role,
          status: data.status ?? "active",
          updatedAt: new Date(),
        },
      })
      .returning();
    return membership;
  }

  async getClientMembershipForUser(userId: string, organizationId: string): Promise<ClientMembership | undefined> {
    const [membership] = await db
      .select()
      .from(clientMemberships)
      .where(and(
        eq(clientMemberships.userId, userId),
        eq(clientMemberships.organizationId, organizationId),
        eq(clientMemberships.status, "active"),
      ))
      .limit(1);
    return membership;
  }

  async findClientMembership(organizationId: string, clientId: string): Promise<ClientMembership | undefined> {
    const [membership] = await db
      .select()
      .from(clientMemberships)
      .where(and(
        eq(clientMemberships.organizationId, organizationId),
        eq(clientMemberships.clientId, clientId),
        eq(clientMemberships.status, "active"),
      ))
      .limit(1);
    return membership;
  }

  async upsertClientMembership(data: InsertClientMembership): Promise<ClientMembership> {
    const [membership] = await db
      .insert(clientMemberships)
      .values(data)
      .onConflictDoUpdate({
        target: [clientMemberships.organizationId, clientMemberships.userId, clientMemberships.clientId],
        set: {
          status: data.status ?? "active",
          updatedAt: new Date(),
        },
      })
      .returning();
    return membership;
  }

  // ============================================
  // CLIENTS
  // ============================================
  async getClient(clientId: string, organizationId: string = DEFAULT_ORG_ID): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(and(eq(clients.clientId, clientId), eq(clients.organizationId, organizationId)));
    return client;
  }

  async getAllClients(organizationId: string = DEFAULT_ORG_ID): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.organizationId, organizationId)).orderBy(desc(clients.createdAt));
  }

  async createClient(data: InsertClient): Promise<Client> {
    const clientId = generateClientId();
    const [client] = await db
      .insert(clients)
      .values({ ...data, clientId } as any)
      .returning();
    return client;
  }

  async updateClient(clientId: string, data: Partial<InsertClient>, organizationId: string = DEFAULT_ORG_ID): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(clients.clientId, clientId), eq(clients.organizationId, organizationId)))
      .returning();
    return client;
  }

  async deleteClient(clientId: string, organizationId: string = DEFAULT_ORG_ID): Promise<boolean> {
    // Delete all related data in order (foreign key constraints)
    await db.delete(clientBillingItems).where(and(eq(clientBillingItems.clientId, clientId), eq(clientBillingItems.organizationId, organizationId)));
    await db.delete(documents).where(and(eq(documents.clientId, clientId), eq(documents.organizationId, organizationId)));
    await db.delete(payments).where(and(eq(payments.clientId, clientId), eq(payments.organizationId, organizationId)));
    await db.delete(invoices).where(and(eq(invoices.clientId, clientId), eq(invoices.organizationId, organizationId)));
    await db.delete(leases).where(and(eq(leases.clientId, clientId), eq(leases.organizationId, organizationId)));
    await db.delete(inviteCodes).where(and(eq(inviteCodes.clientId, clientId), eq(inviteCodes.organizationId, organizationId)));
    
    // Finally delete the client
    const result = await db.delete(clients).where(and(eq(clients.clientId, clientId), eq(clients.organizationId, organizationId))).returning();
    return result.length > 0;
  }

  // ============================================
  // LEASES
  // ============================================
  async getLease(leaseId: string, organizationId: string = DEFAULT_ORG_ID): Promise<Lease | undefined> {
    const [lease] = await db.select().from(leases).where(and(eq(leases.leaseId, leaseId), eq(leases.organizationId, organizationId)));
    return lease;
  }

  async getLeasesByClient(clientId: string, organizationId: string = DEFAULT_ORG_ID): Promise<Lease[]> {
    return await db.select().from(leases).where(and(eq(leases.clientId, clientId), eq(leases.organizationId, organizationId))).orderBy(desc(leases.createdAt));
  }

  async createLease(data: InsertLease): Promise<Lease> {
    const leaseId = generateLeaseId();
    const [lease] = await db
      .insert(leases)
      .values({ ...data, leaseId })
      .returning();
    return lease;
  }

  async updateLease(leaseId: string, data: Partial<InsertLease>, organizationId: string = DEFAULT_ORG_ID): Promise<Lease | undefined> {
    const [lease] = await db
      .update(leases)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(leases.leaseId, leaseId), eq(leases.organizationId, organizationId)))
      .returning();
    return lease;
  }

  // ============================================
  // INVITE CODES
  // ============================================
  async getInviteCode(magicNumber: string, organizationId: string = DEFAULT_ORG_ID): Promise<InviteCode | undefined> {
    const [code] = await db.select().from(inviteCodes).where(and(eq(inviteCodes.magicNumber, magicNumber),
          eq(inviteCodes.organizationId, organizationId), eq(inviteCodes.organizationId, organizationId)));
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

  async claimInviteCode(magicNumber: string, userId: string, organizationId: string = DEFAULT_ORG_ID): Promise<InviteCode | undefined> {
    const [code] = await db
      .update(inviteCodes)
      .set({ usedAt: new Date(), usedByUserId: userId })
      .where(
        and(
          eq(inviteCodes.magicNumber, magicNumber),
          eq(inviteCodes.organizationId, organizationId),
          sql`${inviteCodes.usedAt} IS NULL`
        )
      )
      .returning();
    return code;
  }

  // ============================================
  // INVOICES
  // ============================================
  async getInvoice(invoiceId: string, organizationId: string = DEFAULT_ORG_ID): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.invoiceId, invoiceId), eq(invoices.organizationId, organizationId)));
    return invoice;
  }

  async getInvoicesByClient(clientId: string, organizationId: string = DEFAULT_ORG_ID): Promise<Invoice[]> {
    return await db.select().from(invoices).where(and(eq(invoices.clientId, clientId), eq(invoices.organizationId, organizationId))).orderBy(desc(invoices.createdAt));
  }

  async getAllInvoices(organizationId: string = DEFAULT_ORG_ID): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.organizationId, organizationId)).orderBy(desc(invoices.createdAt));
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

  async updateInvoice(invoiceId: string, data: Partial<InsertInvoice>, organizationId: string = DEFAULT_ORG_ID): Promise<Invoice | undefined> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    const [invoice] = await db
      .update(invoices)
      .set(updateData as any)
      .where(and(eq(invoices.invoiceId, invoiceId), eq(invoices.organizationId, organizationId)))
      .returning();
    return invoice;
  }

  async deleteInvoice(invoiceId: string, organizationId: string = DEFAULT_ORG_ID): Promise<boolean> {
    const result = await db.delete(invoices).where(and(eq(invoices.invoiceId, invoiceId), eq(invoices.organizationId, organizationId))).returning();
    return result.length > 0;
  }

  // ============================================
  // PAYMENTS
  // ============================================
  async getPayment(paymentId: string, organizationId: string = DEFAULT_ORG_ID): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(and(eq(payments.paymentId, paymentId), eq(payments.organizationId, organizationId)));
    return payment;
  }

  async getPaymentsByClient(clientId: string, organizationId: string = DEFAULT_ORG_ID): Promise<Payment[]> {
    return await db.select().from(payments).where(and(eq(payments.clientId, clientId), eq(payments.organizationId, organizationId))).orderBy(desc(payments.createdAt));
  }

  async getAllPayments(organizationId: string = DEFAULT_ORG_ID): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.organizationId, organizationId)).orderBy(desc(payments.createdAt));
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    const paymentId = generatePaymentId();
    const [payment] = await db
      .insert(payments)
      .values({ ...data, paymentId })
      .returning();
    return payment;
  }

  async updatePayment(paymentId: string, data: Partial<InsertPayment>, organizationId: string = DEFAULT_ORG_ID): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(payments.paymentId, paymentId), eq(payments.organizationId, organizationId)))
      .returning();
    return payment;
  }

  async updatePaymentStatus(paymentId: string, status: string, organizationId: string = DEFAULT_ORG_ID): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(payments.paymentId, paymentId), eq(payments.organizationId, organizationId)))
      .returning();
    return payment;
  }

  // ============================================
  // DOCUMENTS
  // ============================================
  async getDocument(documentId: string, organizationId: string = DEFAULT_ORG_ID): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(and(eq(documents.documentId, documentId), eq(documents.organizationId, organizationId)));
    return doc;
  }

  async getDocumentsByClient(clientId: string, organizationId: string = DEFAULT_ORG_ID, visibility?: string): Promise<Document[]> {
    if (visibility) {
      return await db
        .select()
        .from(documents)
        .where(and(eq(documents.clientId, clientId), eq(documents.organizationId, organizationId), eq(documents.visibility, visibility)))
        .orderBy(desc(documents.createdAt));
    }
    return await db.select().from(documents).where(and(eq(documents.clientId, clientId), eq(documents.organizationId, organizationId))).orderBy(desc(documents.createdAt));
  }

  async getAllDocuments(organizationId: string = DEFAULT_ORG_ID): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.organizationId, organizationId)).orderBy(desc(documents.createdAt));
  }

  async createDocument(data: InsertDocument): Promise<Document> {
    const documentId = generateDocumentId();
    const [doc] = await db
      .insert(documents)
      .values({ ...data, documentId })
      .returning();
    return doc;
  }

  async deleteDocument(documentId: string, organizationId: string = DEFAULT_ORG_ID): Promise<boolean> {
    const result = await db.delete(documents).where(and(eq(documents.documentId, documentId), eq(documents.organizationId, organizationId))).returning();
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
  async getPaymentSettings(organizationId?: string): Promise<PaymentSettings | undefined> {
    if (!organizationId) {
      const [settings] = await db.select().from(paymentSettings).orderBy(desc(paymentSettings.updatedAt)).limit(1);
      return settings;
    }
    const [settings] = await db.select().from(paymentSettings).where(eq(paymentSettings.organizationId, organizationId));
    return settings;
  }

  async upsertPaymentSettings(
    organizationId: string,
    data: Omit<InsertPaymentSettings, "organizationId">,
  ): Promise<PaymentSettings> {
    const [settings] = await db
      .insert(paymentSettings)
      .values({ ...data, organizationId })
      .onConflictDoUpdate({
        target: paymentSettings.organizationId,
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
  async getAutomationSettings(organizationId?: string): Promise<AutomationSettings | undefined> {
    if (!organizationId) {
      const [settings] = await db.select().from(automationSettings).orderBy(desc(automationSettings.updatedAt)).limit(1);
      return settings;
    }
    const [settings] = await db.select().from(automationSettings).where(eq(automationSettings.organizationId, organizationId));
    return settings;
  }

  async upsertAutomationSettings(
    organizationId: string,
    data: Omit<InsertAutomationSettings, "organizationId">,
  ): Promise<AutomationSettings> {
    const [settings] = await db
      .insert(automationSettings)
      .values({ ...data, organizationId })
      .onConflictDoUpdate({
        target: automationSettings.organizationId,
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
  async updateDocument(documentId: string, data: Partial<InsertDocument>, organizationId: string = DEFAULT_ORG_ID): Promise<Document | undefined> {
    const [doc] = await db
      .update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(documents.documentId, documentId), eq(documents.organizationId, organizationId)))
      .returning();
    return doc;
  }

  async clearActiveAgreementForClient(clientId: string, organizationId: string = DEFAULT_ORG_ID): Promise<void> {
    await db
      .update(documents)
      .set({ isActiveAgreement: false, updatedAt: new Date() })
      .where(and(eq(documents.clientId, clientId), eq(documents.organizationId, organizationId), eq(documents.isActiveAgreement, true)));
  }

  async getActiveAgreementForClient(clientId: string, organizationId: string = DEFAULT_ORG_ID): Promise<Document | undefined> {
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.clientId, clientId), eq(documents.organizationId, organizationId), eq(documents.isActiveAgreement, true)));
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
      .from(organizationMemberships)
      .where(and(eq(organizationMemberships.status, "active"), sql`${organizationMemberships.role} in ('owner', 'admin')`))
      .limit(1);
    return !!admin;
  }
}

export const storage = new DatabaseStorage();
