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
