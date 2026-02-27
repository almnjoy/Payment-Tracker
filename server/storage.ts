import { eq, and, desc, sql } from "drizzle-orm";
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
  organizationSettings,
  automationSettings,
  clientBillingItems,
  generateClientId,
  generateLeaseId,
  generateInvoiceId,
  generatePaymentId,
  generateDocumentId,
  generateAccountId,
  generateMagicNumber,
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
  upsertPaymentSettings(data: InsertPaymentSettings): Promise<PaymentSettings>;

  // Organization Settings
  getOrganizationSettings(): Promise<OrganizationSettings | undefined>;
  upsertOrganizationSettings(data: InsertOrganizationSettings): Promise<OrganizationSettings>;

  // Automation Settings
  getAutomationSettings(organizationId?: string): Promise<AutomationSettings | undefined>;
  upsertAutomationSettings(data: InsertAutomationSettings): Promise<AutomationSettings>;
  
  // Documents - additional methods
  updateDocument(documentId: string, data: Partial<InsertDocument>, organizationId?: string): Promise<Document | undefined>;
  clearActiveAgreementForClient(clientId: string, organizationId?: string): Promise<void>;
  getActiveAgreementForClient(clientId: string, organizationId?: string): Promise<Document | undefined>;
  
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
  async getPaymentSettings(organizationId: string = DEFAULT_ORG_ID): Promise<PaymentSettings | undefined> {
    const [settings] = await db.select().from(paymentSettings).where(eq(paymentSettings.organizationId, organizationId));
    return settings;
  }

  async upsertPaymentSettings(data: InsertPaymentSettings): Promise<PaymentSettings> {
    const [settings] = await db
      .insert(paymentSettings)
      .values(data as any)
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
  // ORGANIZATION SETTINGS
  // ============================================
  async getOrganizationSettings(): Promise<OrganizationSettings | undefined> {
    const [settings] = await db.select().from(organizationSettings).where(eq(organizationSettings.id, "default"));
    return settings;
  }

  async upsertOrganizationSettings(data: InsertOrganizationSettings): Promise<OrganizationSettings> {
    const [settings] = await db
      .insert(organizationSettings)
      .values({ ...data, id: "default" })
      .onConflictDoUpdate({
        target: organizationSettings.id,
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
  async getAutomationSettings(organizationId: string = DEFAULT_ORG_ID): Promise<AutomationSettings | undefined> {
    const [settings] = await db.select().from(automationSettings).where(eq(automationSettings.organizationId, organizationId));
    return settings;
  }

  async upsertAutomationSettings(data: InsertAutomationSettings): Promise<AutomationSettings> {
    const [settings] = await db
      .insert(automationSettings)
      .values(data as any)
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
