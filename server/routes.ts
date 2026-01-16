import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { objectStorageClient, ObjectStorageService } from "./replit_integrations/object_storage";
import multer from "multer";
import { plaidClient } from "./plaid/client";
import { CountryCode, Products } from "plaid";
import { db } from "./db";
import { 
  plaidItems, 
  plaidAccounts, 
  plaidTransactions, 
  plaidCursors,
  financeEntries,
  clientBillingItems,
  clients,
  generatePlaidItemId,
  generatePlaidAccountRowId,
  generatePlaidTransactionRowId,
  generateFinanceEntryId,
  generateClientBillingItemId,
  insertFinanceEntrySchema,
  insertClientBillingItemSchema
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql, ilike, or } from "drizzle-orm";

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface User {
      claims?: {
        sub: string;
        email?: string;
        first_name?: string;
        last_name?: string;
      };
    }
  }
}

// Multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

const objectStorageService = new ObjectStorageService();

// Helper to get user ID from request
function getUserId(req: Request): string | undefined {
  return (req.user as any)?.claims?.sub;
}

// Middleware to check if user is admin
async function isAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const profile = await storage.getUserProfile(userId);
  if (!profile || profile.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }
  
  (req as any).userProfile = profile;
  next();
}

// Middleware to check if user is client (or admin for impersonation)
async function isClient(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const profile = await storage.getUserProfile(userId);
  if (!profile) {
    return res.status(403).json({ message: "Forbidden: No user profile found" });
  }
  
  // Check for admin impersonation
  const asClientId = req.query.asClientId as string | undefined;
  if (asClientId && profile.role === "admin") {
    // Admin impersonating a client
    const client = await storage.getClient(asClientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found for impersonation" });
    }
    (req as any).userProfile = { ...profile, clientId: asClientId, impersonating: true };
    (req as any).impersonatedClient = client;
    return next();
  }
  
  // Client role required (admins can also access for impersonation/support purposes)
  if (profile.role !== "client" && profile.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Client access required" });
  }
  
  (req as any).userProfile = profile;
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============================================
  // AUTH + PROFILE
  // ============================================
  
  // Get current user profile with role info
  app.get("/api/me", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const profile = await storage.getUserProfile(userId);
      const userClaims = (req.user as any)?.claims;
      
      res.json({
        userId,
        email: userClaims?.email,
        firstName: userClaims?.first_name,
        lastName: userClaims?.last_name,
        profile: profile || null,
        hasProfile: !!profile,
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // ============================================
  // INVITE CODES
  // ============================================
  
  // Verify magic number (no auth required)
  app.post("/api/invite/verify", async (req: Request, res: Response) => {
    try {
      const { magicNumber } = req.body;
      
      if (!magicNumber) {
        return res.status(400).json({ valid: false, reason: "Magic number required" });
      }
      
      const code = await storage.getInviteCode(magicNumber.toUpperCase());
      
      if (!code) {
        return res.json({ valid: false, reason: "Invalid magic number" });
      }
      
      if (code.usedAt) {
        return res.json({ valid: false, reason: "This invite has already been used" });
      }
      
      if (new Date(code.expiresAt) < new Date()) {
        return res.json({ valid: false, reason: "This invite has expired" });
      }
      
      const client = await storage.getClient(code.clientId);
      
      res.json({
        valid: true,
        clientDisplayName: client?.displayName || "Unknown Client",
        expiresAt: code.expiresAt,
      });
    } catch (error) {
      console.error("Error verifying invite:", error);
      res.status(500).json({ valid: false, reason: "Server error" });
    }
  });
  
  // Claim magic number (requires auth)
  app.post("/api/invite/claim", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { magicNumber } = req.body;
      
      if (!userId || !magicNumber) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }
      
      // First verify the code is valid
      const code = await storage.getInviteCode(magicNumber.toUpperCase());
      
      if (!code || code.usedAt || new Date(code.expiresAt) < new Date()) {
        return res.status(400).json({ success: false, message: "Invalid or expired invite" });
      }
      
      // Claim the code
      const claimedCode = await storage.claimInviteCode(magicNumber.toUpperCase(), userId);
      
      if (!claimedCode) {
        return res.status(400).json({ success: false, message: "Failed to claim invite" });
      }
      
      // Create/update user profile
      await storage.upsertUserProfile({
        userId,
        role: "client",
        clientId: code.clientId,
        status: "active",
      });
      
      res.json({
        success: true,
        redirectTo: "/client/dashboard",
      });
    } catch (error) {
      console.error("Error claiming invite:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ============================================
  // ADMIN: CLIENTS
  // ============================================
  
  app.get("/api/admin/clients", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const clients = await storage.getAllClients();
      
      // Get additional data for each client
      const enrichedClients = await Promise.all(clients.map(async (client) => {
        const invoices = await storage.getInvoicesByClient(client.clientId);
        const payments = await storage.getPaymentsByClient(client.clientId);
        
        const totalOwed = invoices
          .filter(inv => ['open', 'sent', 'overdue'].includes(inv.status))
          .reduce((sum, inv) => sum + inv.amountCents, 0);
          
        const lastPayment = payments.length > 0 ? payments[0] : null;
        
        return {
          ...client,
          amountOwedCents: totalOwed,
          lastPaymentAt: lastPayment?.paidAt || lastPayment?.createdAt,
          status: totalOwed > 0 && invoices.some(i => i.status === 'overdue') ? 'overdue' : 'active',
        };
      }));
      
      res.json(enrichedClients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });
  
  app.get("/api/admin/clients/:clientId", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const client = await storage.getClient(clientId);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const leases = await storage.getLeasesByClient(clientId);
      const invoices = await storage.getInvoicesByClient(clientId);
      const payments = await storage.getPaymentsByClient(clientId);
      const documents = await storage.getDocumentsByClient(clientId);
      
      res.json({
        ...client,
        leases,
        invoices,
        payments,
        documents,
      });
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });
  
  app.post("/api/admin/clients", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const client = await storage.createClient(req.body);
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // ============================================
  // ADMIN: LEASES
  // ============================================
  
  app.get("/api/admin/leases", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { clientId } = req.query;
      if (clientId) {
        const leases = await storage.getLeasesByClient(clientId as string);
        return res.json(leases);
      }
      // If no clientId, return empty (could also return all leases)
      res.json([]);
    } catch (error) {
      console.error("Error fetching leases:", error);
      res.status(500).json({ message: "Failed to fetch leases" });
    }
  });
  
  app.post("/api/admin/leases", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const lease = await storage.createLease(req.body);
      res.status(201).json(lease);
    } catch (error) {
      console.error("Error creating lease:", error);
      res.status(500).json({ message: "Failed to create lease" });
    }
  });

  // ============================================
  // ADMIN: INVOICES
  // ============================================
  
  app.get("/api/admin/invoices", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { clientId } = req.query;
      if (clientId) {
        const invoices = await storage.getInvoicesByClient(clientId as string);
        return res.json(invoices);
      }
      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });
  
  app.post("/api/admin/invoices", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const invoice = await storage.createInvoice(req.body);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });
  
  app.patch("/api/admin/invoices/:invoiceId", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const invoice = await storage.updateInvoice(invoiceId, req.body);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  // ============================================
  // ADMIN: PAYMENTS
  // ============================================
  
  app.get("/api/admin/payments", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { clientId } = req.query;
      if (clientId) {
        const payments = await storage.getPaymentsByClient(clientId as string);
        return res.json(payments);
      }
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });
  
  app.post("/api/admin/payments", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const payment = await storage.createPayment({
        ...req.body,
        paidAt: req.body.paidAt || new Date(),
      });
      
      // If payment is for an invoice, update invoice status
      if (req.body.invoiceId) {
        await storage.updateInvoice(req.body.invoiceId, { status: "paid" });
      }
      
      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  // ============================================
  // ADMIN: DOCUMENTS
  // ============================================
  
  app.get("/api/admin/documents", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { clientId } = req.query;
      if (clientId) {
        const documents = await storage.getDocumentsByClient(clientId as string);
        return res.json(documents);
      }
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });
  
  app.post("/api/admin/documents/upload", isAuthenticated, isAdmin, upload.single('file'), async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const file = req.file;
      const { clientId, leaseId, invoiceId, title, docType, visibility } = req.body;
      
      if (!file || !clientId || !title) {
        return res.status(400).json({ message: "Missing required fields: file, clientId, and title are required" });
      }
      
      if (file.mimetype !== 'application/pdf') {
        return res.status(400).json({ message: "Only PDF files are allowed" });
      }
      
      // Get the private object directory
      const privateDir = objectStorageService.getPrivateObjectDir();
      const bucketName = privateDir.split('/')[1];
      const timestamp = Date.now();
      const storageKey = `clients/${clientId}/documents/${timestamp}_${file.originalname}`;
      const fullPath = `${privateDir.split('/').slice(0, 2).join('/')}/${storageKey}`;
      
      // Upload to object storage
      const bucket = objectStorageClient.bucket(bucketName);
      const blob = bucket.file(storageKey);
      
      await blob.save(file.buffer, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
        },
      });
      
      // Save document metadata
      const document = await storage.createDocument({
        clientId,
        leaseId: leaseId || null,
        invoiceId: invoiceId || null,
        title,
        docType: docType || 'other',
        visibility: visibility || 'client_and_admin',
        storageBucket: bucketName,
        storageKey,
        contentType: file.mimetype,
        fileSizeBytes: file.size,
        uploadedByUserId: userId!,
      });
      
      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });
  
  app.get("/api/admin/documents/:documentId/download", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const isPreview = req.query.preview === 'true';
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const bucket = objectStorageClient.bucket(document.storageBucket);
      const file = bucket.file(document.storageKey);
      
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ message: "File not found in storage" });
      }
      
      res.set({
        'Content-Type': document.contentType || 'application/octet-stream',
        'Content-Disposition': `${isPreview ? 'inline' : 'attachment'}; filename="${document.title}"`,
      });
      
      file.createReadStream().pipe(res);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  // ============================================
  // ADMIN: CLIENT BILLING ITEMS
  // ============================================
  
  app.get("/api/admin/clients/:clientId/billing-items", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const items = await db.select().from(clientBillingItems)
        .where(eq(clientBillingItems.clientId, clientId))
        .orderBy(desc(clientBillingItems.createdAt));
      res.json(items);
    } catch (error) {
      console.error("Error fetching billing items:", error);
      res.status(500).json({ message: "Failed to fetch billing items" });
    }
  });
  
  app.post("/api/admin/clients/:clientId/billing-items", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const { type, title, amountCents, dueDate, frequency, notes } = req.body;
      
      if (!title || !amountCents || !dueDate) {
        return res.status(400).json({ message: "title, amountCents, and dueDate are required" });
      }
      
      const item = await db.insert(clientBillingItems).values({
        id: generateClientBillingItemId(),
        clientId,
        type: type || "other",
        title,
        amountCents,
        dueDate,
        frequency: frequency || "one_time",
        notes: notes || null,
        status: "active",
      }).returning();
      
      res.status(201).json(item[0]);
    } catch (error) {
      console.error("Error creating billing item:", error);
      res.status(500).json({ message: "Failed to create billing item" });
    }
  });
  
  app.delete("/api/admin/clients/:clientId/billing-items/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { clientId, id } = req.params;
      const deleted = await db.delete(clientBillingItems)
        .where(and(eq(clientBillingItems.id, id), eq(clientBillingItems.clientId, clientId)))
        .returning();
      
      if (deleted.length === 0) {
        return res.status(404).json({ message: "Billing item not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting billing item:", error);
      res.status(500).json({ message: "Failed to delete billing item" });
    }
  });
  
  // Get all billing items (for Finance Tracker derived income)
  app.get("/api/admin/billing-items", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      let query = db.select().from(clientBillingItems).where(eq(clientBillingItems.status, "active"));
      
      if (startDate && endDate) {
        query = db.select().from(clientBillingItems)
          .where(and(
            eq(clientBillingItems.status, "active"),
            gte(clientBillingItems.dueDate, startDate as string),
            lte(clientBillingItems.dueDate, endDate as string)
          ));
      }
      
      const items = await query.orderBy(desc(clientBillingItems.dueDate));
      res.json(items);
    } catch (error) {
      console.error("Error fetching all billing items:", error);
      res.status(500).json({ message: "Failed to fetch billing items" });
    }
  });
  
  // Update client status (lease status)
  app.patch("/api/admin/clients/:clientId/status", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const { status } = req.body;
      
      if (!["active", "paused", "inactive", "behind"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be active, paused, inactive, or behind" });
      }
      
      const updated = await db.update(clients)
        .set({ status, updatedAt: new Date() })
        .where(eq(clients.clientId, clientId))
        .returning();
      
      if (updated.length === 0) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating client status:", error);
      res.status(500).json({ message: "Failed to update client status" });
    }
  });

  // ============================================
  // ADMIN: INVITE CODES
  // ============================================
  
  app.get("/api/admin/invite-codes", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    // For now, we don't have a getAllInviteCodes method, so return empty
    res.json([]);
  });
  
  app.post("/api/admin/invite-codes", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { clientId, leaseId, expiresInDays = 30 } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ message: "clientId is required" });
      }
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      
      const code = await storage.createInviteCode({
        magicNumber: undefined as any, // Will be generated
        clientId,
        leaseId,
        expiresAt,
        createdByUserId: userId!,
      });
      
      res.status(201).json(code);
    } catch (error) {
      console.error("Error creating invite code:", error);
      res.status(500).json({ message: "Failed to create invite code" });
    }
  });

  // ============================================
  // ADMIN: EXTERNAL ACCOUNTS
  // ============================================
  
  app.get("/api/admin/external-accounts", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const accounts = await storage.getAllExternalAccounts();
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching external accounts:", error);
      res.status(500).json({ message: "Failed to fetch external accounts" });
    }
  });
  
  app.post("/api/admin/external-accounts", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const account = await storage.createExternalAccount({
        ...req.body,
        createdByUserId: userId!,
      });
      res.status(201).json(account);
    } catch (error) {
      console.error("Error creating external account:", error);
      res.status(500).json({ message: "Failed to create external account" });
    }
  });
  
  app.delete("/api/admin/external-accounts/:accountId", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { accountId } = req.params;
      const deleted = await storage.deleteExternalAccount(accountId);
      if (!deleted) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting external account:", error);
      res.status(500).json({ message: "Failed to delete external account" });
    }
  });

  // ============================================
  // ADMIN: DASHBOARD STATS
  // ============================================
  
  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const clients = await storage.getAllClients();
      const invoices = await storage.getAllInvoices();
      const payments = await storage.getAllPayments();
      
      const totalCollectedCents = payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amountCents, 0);
        
      const outstandingCents = invoices
        .filter(inv => ['open', 'sent', 'overdue'].includes(inv.status))
        .reduce((sum, inv) => sum + inv.amountCents, 0);
        
      const overdueCount = invoices.filter(inv => inv.status === 'overdue').length;
      
      res.json({
        totalCollectedCents,
        outstandingCents,
        overdueCount,
        activeClients: clients.length,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============================================
  // CLIENT: DASHBOARD
  // ============================================
  
  app.get("/api/client/dashboard", isAuthenticated, isClient, async (req: Request, res: Response) => {
    try {
      const profile = (req as any).userProfile;
      
      if (!profile.clientId) {
        return res.status(403).json({ message: "No client profile linked" });
      }
      
      const client = await storage.getClient(profile.clientId);
      const invoices = await storage.getInvoicesByClient(profile.clientId);
      const payments = await storage.getPaymentsByClient(profile.clientId);
      const leases = await storage.getLeasesByClient(profile.clientId);
      const documents = await storage.getDocumentsByClient(profile.clientId, "client_and_admin");
      
      const openInvoices = invoices.filter(inv => ['open', 'sent', 'overdue'].includes(inv.status));
      const amountDueCents = openInvoices.reduce((sum, inv) => sum + inv.amountCents, 0);
      const lastPayment = payments.length > 0 ? payments[0] : null;
      const activeLease = leases.find(l => l.status === 'active');
      
      res.json({
        client,
        amountDueCents,
        nextDueDate: openInvoices.length > 0 ? openInvoices[0].dueDate : null,
        lastPayment,
        activeLease,
        recentDocuments: documents.slice(0, 5),
        openInvoicesCount: openInvoices.length,
      });
    } catch (error) {
      console.error("Error fetching client dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  });

  // ============================================
  // CLIENT: INVOICES
  // ============================================
  
  app.get("/api/client/invoices", isAuthenticated, isClient, async (req: Request, res: Response) => {
    try {
      const profile = (req as any).userProfile;
      
      if (!profile.clientId) {
        return res.status(403).json({ message: "No client profile linked" });
      }
      
      const invoices = await storage.getInvoicesByClient(profile.clientId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching client invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // ============================================
  // CLIENT: PAYMENTS
  // ============================================
  
  app.get("/api/client/payments", isAuthenticated, isClient, async (req: Request, res: Response) => {
    try {
      const profile = (req as any).userProfile;
      
      if (!profile.clientId) {
        return res.status(403).json({ message: "No client profile linked" });
      }
      
      const payments = await storage.getPaymentsByClient(profile.clientId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching client payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // ============================================
  // CLIENT: DOCUMENTS
  // ============================================
  
  app.get("/api/client/documents", isAuthenticated, isClient, async (req: Request, res: Response) => {
    try {
      const profile = (req as any).userProfile;
      
      if (!profile.clientId) {
        return res.status(403).json({ message: "No client profile linked" });
      }
      
      const documents = await storage.getDocumentsByClient(profile.clientId, "client_and_admin");
      res.json(documents);
    } catch (error) {
      console.error("Error fetching client documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });
  
  app.get("/api/client/documents/:documentId/download", isAuthenticated, isClient, async (req: Request, res: Response) => {
    try {
      const profile = (req as any).userProfile;
      const { documentId } = req.params;
      const isPreview = req.query.preview === 'true';
      
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Verify client can access this document
      if (document.clientId !== profile.clientId || document.visibility !== "client_and_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const bucket = objectStorageClient.bucket(document.storageBucket);
      const file = bucket.file(document.storageKey);
      
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ message: "File not found in storage" });
      }
      
      res.set({
        'Content-Type': document.contentType || 'application/octet-stream',
        'Content-Disposition': `${isPreview ? 'inline' : 'attachment'}; filename="${document.title}"`,
      });
      
      file.createReadStream().pipe(res);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  // Get finance entries for client (read-only - entries assigned to their clientId)
  app.get("/api/client/finance-entries", isAuthenticated, isClient, async (req: Request, res: Response) => {
    try {
      const profile = (req as any).userProfile;
      
      if (!profile.clientId) {
        return res.status(403).json({ message: "No client profile linked" });
      }
      
      const entries = await db.select().from(financeEntries)
        .where(eq(financeEntries.clientId, profile.clientId))
        .orderBy(desc(financeEntries.date));
      
      res.json(entries);
    } catch (error) {
      console.error("Error fetching client finance entries:", error);
      res.status(500).json({ message: "Failed to fetch finance entries" });
    }
  });

  // ============================================
  // ADMIN BOOTSTRAP (for first admin setup)
  // ============================================
  
  app.post("/api/admin/bootstrap", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { secretKey } = req.body;
      
      // Check for admin bootstrap secret (set in environment)
      const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET || "SETUP_ADMIN_2024";
      
      if (secretKey !== bootstrapSecret) {
        return res.status(403).json({ message: "Invalid bootstrap secret" });
      }
      
      // Create admin profile
      const profile = await storage.upsertUserProfile({
        userId: userId!,
        role: "admin",
        clientId: null,
        status: "active",
      });
      
      res.json({ success: true, profile });
    } catch (error) {
      console.error("Error bootstrapping admin:", error);
      res.status(500).json({ message: "Failed to bootstrap admin" });
    }
  });

  // ============================================
  // PLAID INTEGRATION (Admin Only)
  // ============================================

  // A) Create Link Token for Plaid Link
  app.post("/api/admin/plaid/link-token", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      const response = await plaidClient.linkTokenCreate({
        client_name: "Quick IT Projects",
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: "en",
        user: {
          client_user_id: userId!,
        },
      });
      
      res.json({ link_token: response.data.link_token });
    } catch (error: any) {
      console.error("Error creating link token:", error?.response?.data || error);
      res.status(500).json({ message: "Failed to create link token" });
    }
  });

  // B) Exchange public token and initialize transactions
  app.post("/api/admin/plaid/exchange", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { public_token, institution_id, institution_name } = req.body;
      
      if (!public_token) {
        return res.status(400).json({ message: "public_token is required" });
      }
      
      // Exchange public token for access token
      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token,
      });
      
      const accessToken = exchangeResponse.data.access_token;
      const plaidItemIdValue = exchangeResponse.data.item_id;
      
      // Insert into plaid_items
      const itemId = generatePlaidItemId();
      await db.insert(plaidItems).values({
        itemId,
        adminUserId: userId!,
        plaidItemId: plaidItemIdValue,
        accessToken,
        institutionId: institution_id || null,
        institutionName: institution_name || null,
        status: "linked",
      });
      
      // Fetch accounts
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      });
      
      for (const account of accountsResponse.data.accounts) {
        const existingAccount = await db.select().from(plaidAccounts)
          .where(and(
            eq(plaidAccounts.itemId, itemId),
            eq(plaidAccounts.plaidAccountId, account.account_id)
          ))
          .limit(1);
        
        if (existingAccount.length === 0) {
          await db.insert(plaidAccounts).values({
            accountId: generatePlaidAccountRowId(),
            itemId,
            plaidAccountId: account.account_id,
            name: account.name,
            officialName: account.official_name || null,
            mask: account.mask || null,
            type: account.type,
            subtype: account.subtype || null,
            currentBalanceCents: account.balances.current ? Math.round(account.balances.current * 100) : null,
            availableBalanceCents: account.balances.available ? Math.round(account.balances.available * 100) : null,
            isoCurrencyCode: account.balances.iso_currency_code || "USD",
          });
        } else {
          await db.update(plaidAccounts)
            .set({
              name: account.name,
              officialName: account.official_name || null,
              mask: account.mask || null,
              type: account.type,
              subtype: account.subtype || null,
              currentBalanceCents: account.balances.current ? Math.round(account.balances.current * 100) : null,
              availableBalanceCents: account.balances.available ? Math.round(account.balances.available * 100) : null,
              isoCurrencyCode: account.balances.iso_currency_code || "USD",
              updatedAt: new Date(),
            })
            .where(eq(plaidAccounts.accountId, existingAccount[0].accountId));
        }
      }
      
      // Initialize transactions sync
      const syncResponse = await plaidClient.transactionsSync({
        access_token: accessToken,
      });
      
      // Upsert added transactions
      for (const txn of syncResponse.data.added) {
        const existingTxn = await db.select().from(plaidTransactions)
          .where(and(
            eq(plaidTransactions.itemId, itemId),
            eq(plaidTransactions.plaidTransactionId, txn.transaction_id)
          ))
          .limit(1);
        
        if (existingTxn.length === 0) {
          await db.insert(plaidTransactions).values({
            transactionId: generatePlaidTransactionRowId(),
            itemId,
            plaidTransactionId: txn.transaction_id,
            plaidAccountId: txn.account_id,
            date: txn.date,
            name: txn.name,
            merchantName: txn.merchant_name || null,
            amountCents: Math.round(txn.amount * 100),
            isoCurrencyCode: txn.iso_currency_code || "USD",
            pending: txn.pending,
            categoryPrimary: txn.personal_finance_category?.primary || null,
            rawJson: txn as any,
          });
        }
      }
      
      // Store cursor
      await db.insert(plaidCursors).values({
        itemId,
        cursor: syncResponse.data.next_cursor,
        lastSyncAt: new Date(),
      }).onConflictDoUpdate({
        target: plaidCursors.itemId,
        set: {
          cursor: syncResponse.data.next_cursor,
          lastSyncAt: new Date(),
        },
      });
      
      res.json({ item_id: itemId, institution_name: institution_name || "Unknown" });
    } catch (error: any) {
      console.error("Error exchanging token:", error?.response?.data || error);
      res.status(500).json({ message: "Failed to exchange token" });
    }
  });

  // C) Sync transactions for all linked items
  app.post("/api/admin/plaid/sync", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      // Get all items for this admin
      const items = await db.select().from(plaidItems)
        .where(eq(plaidItems.adminUserId, userId!));
      
      let totalAdded = 0;
      let totalModified = 0;
      let totalRemoved = 0;
      
      for (const item of items) {
        // Get current cursor
        const cursorResult = await db.select().from(plaidCursors)
          .where(eq(plaidCursors.itemId, item.itemId))
          .limit(1);
        
        const currentCursor = cursorResult[0]?.cursor || undefined;
        
        // Sync transactions
        const syncResponse = await plaidClient.transactionsSync({
          access_token: item.accessToken,
          cursor: currentCursor,
        });
        
        // Process added transactions
        for (const txn of syncResponse.data.added) {
          const existingTxn = await db.select().from(plaidTransactions)
            .where(and(
              eq(plaidTransactions.itemId, item.itemId),
              eq(plaidTransactions.plaidTransactionId, txn.transaction_id)
            ))
            .limit(1);
          
          if (existingTxn.length === 0) {
            await db.insert(plaidTransactions).values({
              transactionId: generatePlaidTransactionRowId(),
              itemId: item.itemId,
              plaidTransactionId: txn.transaction_id,
              plaidAccountId: txn.account_id,
              date: txn.date,
              name: txn.name,
              merchantName: txn.merchant_name || null,
              amountCents: Math.round(txn.amount * 100),
              isoCurrencyCode: txn.iso_currency_code || "USD",
              pending: txn.pending,
              categoryPrimary: txn.personal_finance_category?.primary || null,
              rawJson: txn as any,
            });
            totalAdded++;
          }
        }
        
        // Process modified transactions
        for (const txn of syncResponse.data.modified) {
          await db.update(plaidTransactions)
            .set({
              date: txn.date,
              name: txn.name,
              merchantName: txn.merchant_name || null,
              amountCents: Math.round(txn.amount * 100),
              pending: txn.pending,
              categoryPrimary: txn.personal_finance_category?.primary || null,
              rawJson: txn as any,
              updatedAt: new Date(),
            })
            .where(and(
              eq(plaidTransactions.itemId, item.itemId),
              eq(plaidTransactions.plaidTransactionId, txn.transaction_id)
            ));
          totalModified++;
        }
        
        // Process removed transactions
        for (const removed of syncResponse.data.removed) {
          if (removed.transaction_id) {
            await db.delete(plaidTransactions)
              .where(and(
                eq(plaidTransactions.itemId, item.itemId),
                eq(plaidTransactions.plaidTransactionId, removed.transaction_id)
              ));
            totalRemoved++;
          }
        }
        
        // Update accounts balances
        const accountsResponse = await plaidClient.accountsGet({
          access_token: item.accessToken,
        });
        
        for (const account of accountsResponse.data.accounts) {
          await db.update(plaidAccounts)
            .set({
              currentBalanceCents: account.balances.current ? Math.round(account.balances.current * 100) : null,
              availableBalanceCents: account.balances.available ? Math.round(account.balances.available * 100) : null,
              updatedAt: new Date(),
            })
            .where(and(
              eq(plaidAccounts.itemId, item.itemId),
              eq(plaidAccounts.plaidAccountId, account.account_id)
            ));
        }
        
        // Update cursor
        await db.insert(plaidCursors).values({
          itemId: item.itemId,
          cursor: syncResponse.data.next_cursor,
          lastSyncAt: new Date(),
        }).onConflictDoUpdate({
          target: plaidCursors.itemId,
          set: {
            cursor: syncResponse.data.next_cursor,
            lastSyncAt: new Date(),
          },
        });
      }
      
      res.json({
        synced_items: items.length,
        added: totalAdded,
        modified: totalModified,
        removed: totalRemoved,
      });
    } catch (error: any) {
      console.error("Error syncing transactions:", error?.response?.data || error);
      res.status(500).json({ message: "Failed to sync transactions" });
    }
  });

  // D) Get linked items for this admin
  app.get("/api/admin/plaid/items", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      const items = await db.select({
        itemId: plaidItems.itemId,
        institutionName: plaidItems.institutionName,
        status: plaidItems.status,
        createdAt: plaidItems.createdAt,
      }).from(plaidItems)
        .where(eq(plaidItems.adminUserId, userId!));
      
      // Add last_sync_at from cursors
      const result = await Promise.all(items.map(async (item) => {
        const cursor = await db.select().from(plaidCursors)
          .where(eq(plaidCursors.itemId, item.itemId))
          .limit(1);
        
        return {
          ...item,
          last_sync_at: cursor[0]?.lastSyncAt || null,
        };
      }));
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching plaid items:", error);
      res.status(500).json({ message: "Failed to fetch linked accounts" });
    }
  });

  // E) Delete/Unlink a Plaid item
  app.delete("/api/admin/plaid/items/:itemId", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { itemId } = req.params;
      
      // Verify item belongs to this admin
      const item = await db.select().from(plaidItems)
        .where(and(
          eq(plaidItems.itemId, itemId),
          eq(plaidItems.adminUserId, userId!)
        ))
        .limit(1);
      
      if (item.length === 0) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Delete in order: transactions, accounts, cursors, items
      await db.delete(plaidTransactions).where(eq(plaidTransactions.itemId, itemId));
      await db.delete(plaidAccounts).where(eq(plaidAccounts.itemId, itemId));
      await db.delete(plaidCursors).where(eq(plaidCursors.itemId, itemId));
      await db.delete(plaidItems).where(eq(plaidItems.itemId, itemId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting plaid item:", error);
      res.status(500).json({ message: "Failed to unlink account" });
    }
  });

  // F) Get account summaries grouped by institution
  app.get("/api/admin/plaid/account-summaries", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      // Get all items for this admin
      const items = await db.select().from(plaidItems)
        .where(eq(plaidItems.adminUserId, userId!));
      
      const result = await Promise.all(items.map(async (item) => {
        // Get accounts for this item
        const accounts = await db.select().from(plaidAccounts)
          .where(eq(plaidAccounts.itemId, item.itemId));
        
        // Get last sync time
        const cursor = await db.select().from(plaidCursors)
          .where(eq(plaidCursors.itemId, item.itemId))
          .limit(1);
        
        return {
          item_id: item.itemId,
          institution_name: item.institutionName,
          last_sync_at: cursor[0]?.lastSyncAt || null,
          accounts: accounts.map(acc => ({
            account_id: acc.accountId,
            plaid_account_id: acc.plaidAccountId,
            name: acc.name,
            mask: acc.mask,
            type: acc.type,
            subtype: acc.subtype,
            current_balance_cents: acc.currentBalanceCents,
            available_balance_cents: acc.availableBalanceCents,
            iso_currency_code: acc.isoCurrencyCode,
          })),
        };
      }));
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching account summaries:", error);
      res.status(500).json({ message: "Failed to fetch account summaries" });
    }
  });

  // G) Get transactions for a specific Plaid account
  app.get("/api/admin/plaid/accounts/:plaidAccountId/transactions", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { plaidAccountId } = req.params;
      const { start_date, end_date, search, min_amount, max_amount } = req.query;
      
      // Default to last 30 days
      const endDate = end_date ? new Date(end_date as string) : new Date();
      const startDate = start_date ? new Date(start_date as string) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Verify admin owns this account
      const account = await db.select({
        accountId: plaidAccounts.accountId,
        itemId: plaidAccounts.itemId,
        name: plaidAccounts.name,
        mask: plaidAccounts.mask,
        type: plaidAccounts.type,
        subtype: plaidAccounts.subtype,
        currentBalanceCents: plaidAccounts.currentBalanceCents,
        availableBalanceCents: plaidAccounts.availableBalanceCents,
      }).from(plaidAccounts)
        .innerJoin(plaidItems, eq(plaidAccounts.itemId, plaidItems.itemId))
        .where(and(
          eq(plaidAccounts.plaidAccountId, plaidAccountId),
          eq(plaidItems.adminUserId, userId!)
        ))
        .limit(1);
      
      if (account.length === 0) {
        return res.status(404).json({ message: "Account not found" });
      }
      
      // Get item info for institution name
      const item = await db.select().from(plaidItems)
        .where(eq(plaidItems.itemId, account[0].itemId))
        .limit(1);
      
      // Get cursor for last sync time
      const cursor = await db.select().from(plaidCursors)
        .where(eq(plaidCursors.itemId, account[0].itemId))
        .limit(1);
      
      // Build query conditions
      let conditions = [
        eq(plaidTransactions.plaidAccountId, plaidAccountId),
        gte(plaidTransactions.date, startDate.toISOString().split('T')[0]),
        lte(plaidTransactions.date, endDate.toISOString().split('T')[0]),
      ];
      
      // Add search filter
      if (search) {
        const searchTerm = `%${search}%`;
        conditions.push(or(
          ilike(plaidTransactions.name, searchTerm),
          ilike(plaidTransactions.merchantName, searchTerm)
        )!);
      }
      
      // Add amount filters
      if (min_amount) {
        conditions.push(gte(plaidTransactions.amountCents, Math.round(parseFloat(min_amount as string) * 100)));
      }
      if (max_amount) {
        conditions.push(lte(plaidTransactions.amountCents, Math.round(parseFloat(max_amount as string) * 100)));
      }
      
      const transactions = await db.select().from(plaidTransactions)
        .where(and(...conditions))
        .orderBy(desc(plaidTransactions.date));
      
      res.json({
        account: {
          ...account[0],
          institution_name: item[0]?.institutionName,
          last_sync_at: cursor[0]?.lastSyncAt,
        },
        transactions: transactions.map(t => ({
          transaction_id: t.transactionId,
          date: t.date,
          name: t.name,
          merchant_name: t.merchantName,
          amount_cents: t.amountCents,
          pending: t.pending,
          category_primary: t.categoryPrimary,
        })),
      });
    } catch (error) {
      console.error("Error fetching account transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // H) Get Plaid sync status
  app.get("/api/admin/plaid/sync-status", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      const items = await db.select().from(plaidItems)
        .where(eq(plaidItems.adminUserId, userId!));
      
      const accounts = await db.select().from(plaidAccounts)
        .innerJoin(plaidItems, eq(plaidAccounts.itemId, plaidItems.itemId))
        .where(eq(plaidItems.adminUserId, userId!));
      
      // Get latest sync time
      let lastSyncAt: Date | null = null;
      for (const item of items) {
        const cursor = await db.select().from(plaidCursors)
          .where(eq(plaidCursors.itemId, item.itemId))
          .limit(1);
        if (cursor[0]?.lastSyncAt && (!lastSyncAt || cursor[0].lastSyncAt > lastSyncAt)) {
          lastSyncAt = cursor[0].lastSyncAt;
        }
      }
      
      res.json({
        linked_institutions: items.length,
        linked_accounts: accounts.length,
        last_sync_at: lastSyncAt,
      });
    } catch (error) {
      console.error("Error fetching sync status:", error);
      res.status(500).json({ message: "Failed to fetch sync status" });
    }
  });

  // I) Get Plaid-derived financial totals
  app.get("/api/admin/plaid/finance-totals", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { days = "30" } = req.query;
      
      const daysNum = parseInt(days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);
      
      // Get all items for this admin
      const items = await db.select().from(plaidItems)
        .where(eq(plaidItems.adminUserId, userId!));
      
      const itemIds = items.map(i => i.itemId);
      
      if (itemIds.length === 0) {
        return res.json({
          income: 0,
          spending: 0,
          debts: 0,
          holdings: 0,
          date_range: daysNum,
        });
      }
      
      // Get transactions in date range
      const transactions = await db.select().from(plaidTransactions)
        .where(and(
          gte(plaidTransactions.date, startDate.toISOString().split('T')[0]),
          sql`${plaidTransactions.itemId} = ANY(${itemIds})`
        ));
      
      // Calculate income (negative amounts in Plaid = money in)
      const income = transactions
        .filter(t => t.amountCents < 0)
        .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
      
      // Calculate spending (positive amounts in Plaid = money out)
      const spending = transactions
        .filter(t => t.amountCents > 0)
        .reduce((sum, t) => sum + t.amountCents, 0);
      
      // Get account balances for debts and holdings
      const accounts = await db.select().from(plaidAccounts)
        .where(sql`${plaidAccounts.itemId} = ANY(${itemIds})`);
      
      // Debts: credit, loan account types
      const debts = accounts
        .filter(a => ['credit', 'loan'].includes(a.type?.toLowerCase() || ''))
        .reduce((sum, a) => sum + (a.currentBalanceCents || 0), 0);
      
      // Holdings: investment accounts
      const holdings = accounts
        .filter(a => ['investment', 'brokerage'].includes(a.type?.toLowerCase() || ''))
        .reduce((sum, a) => sum + (a.currentBalanceCents || 0), 0);
      
      res.json({
        income,
        spending,
        debts,
        holdings,
        date_range: daysNum,
      });
    } catch (error) {
      console.error("Error fetching finance totals:", error);
      res.status(500).json({ message: "Failed to fetch finance totals" });
    }
  });

  // J) Spending summary for charts
  app.get("/api/admin/plaid/spending-summary", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { days = "30" } = req.query;
      
      const daysNum = parseInt(days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);
      
      const items = await db.select().from(plaidItems)
        .where(eq(plaidItems.adminUserId, userId!));
      
      const itemIds = items.map(i => i.itemId);
      
      if (itemIds.length === 0) {
        return res.json({
          categories: [],
          top_merchants: [],
          transaction_count: 0,
          net_cash_flow: 0,
          total_inflow: 0,
          total_outflow: 0,
        });
      }
      
      const transactions = await db.select().from(plaidTransactions)
        .where(and(
          gte(plaidTransactions.date, startDate.toISOString().split('T')[0]),
          sql`${plaidTransactions.itemId} = ANY(${itemIds})`
        ))
        .orderBy(desc(plaidTransactions.date));
      
      // Aggregate by category
      const categoryMap = new Map<string, number>();
      const merchantMap = new Map<string, number>();
      let totalInflow = 0;
      let totalOutflow = 0;
      
      for (const txn of transactions) {
        const category = txn.categoryPrimary || "Uncategorized";
        const merchant = txn.merchantName || txn.name;
        
        if (txn.amountCents > 0) {
          // Money out (spending)
          totalOutflow += txn.amountCents;
          categoryMap.set(category, (categoryMap.get(category) || 0) + txn.amountCents);
          merchantMap.set(merchant, (merchantMap.get(merchant) || 0) + txn.amountCents);
        } else {
          // Money in (income)
          totalInflow += Math.abs(txn.amountCents);
        }
      }
      
      // Sort categories by value
      const categories = Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
      
      // Top 10 merchants
      const topMerchants = Array.from(merchantMap.entries())
        .map(([name, amount_cents]) => ({ name, amount_cents }))
        .sort((a, b) => b.amount_cents - a.amount_cents)
        .slice(0, 10);
      
      res.json({
        categories,
        top_merchants: topMerchants,
        transaction_count: transactions.length,
        net_cash_flow: totalInflow - totalOutflow,
        total_inflow: totalInflow,
        total_outflow: totalOutflow,
      });
    } catch (error) {
      console.error("Error fetching spending summary:", error);
      res.status(500).json({ message: "Failed to fetch spending summary" });
    }
  });

  // ============================================
  // FINANCE ENTRIES (Manual/Linked)
  // ============================================

  // Get all finance entries for admin (optionally filter by clientId)
  app.get("/api/admin/finance-entries", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { category_group, clientId } = req.query;
      
      let conditions = [eq(financeEntries.adminUserId, userId!)];
      
      if (category_group) {
        conditions.push(eq(financeEntries.categoryGroup, category_group as string));
      }
      
      if (clientId) {
        conditions.push(eq(financeEntries.clientId, clientId as string));
      }
      
      const entries = await db.select().from(financeEntries)
        .where(and(...conditions))
        .orderBy(desc(financeEntries.date));
      
      res.json(entries);
    } catch (error) {
      console.error("Error fetching finance entries:", error);
      res.status(500).json({ message: "Failed to fetch finance entries" });
    }
  });

  // Create finance entry
  app.post("/api/admin/finance-entries", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const data = req.body;
      
      const entryId = generateFinanceEntryId();
      
      await db.insert(financeEntries).values({
        entryId,
        adminUserId: userId!,
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
      
      const entry = await db.select().from(financeEntries)
        .where(eq(financeEntries.entryId, entryId))
        .limit(1);
      
      res.status(201).json(entry[0]);
    } catch (error) {
      console.error("Error creating finance entry:", error);
      res.status(500).json({ message: "Failed to create finance entry" });
    }
  });

  // Delete finance entry
  app.delete("/api/admin/finance-entries/:entryId", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { entryId } = req.params;
      
      const entry = await db.select().from(financeEntries)
        .where(and(
          eq(financeEntries.entryId, entryId),
          eq(financeEntries.adminUserId, userId!)
        ))
        .limit(1);
      
      if (entry.length === 0) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      await db.delete(financeEntries).where(eq(financeEntries.entryId, entryId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting finance entry:", error);
      res.status(500).json({ message: "Failed to delete finance entry" });
    }
  });

  // Get all Plaid accounts for dropdown selection
  app.get("/api/admin/plaid/all-accounts", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      
      const accounts = await db.select({
        accountId: plaidAccounts.accountId,
        plaidAccountId: plaidAccounts.plaidAccountId,
        name: plaidAccounts.name,
        mask: plaidAccounts.mask,
        type: plaidAccounts.type,
        institutionName: plaidItems.institutionName,
      }).from(plaidAccounts)
        .innerJoin(plaidItems, eq(plaidAccounts.itemId, plaidItems.itemId))
        .where(eq(plaidItems.adminUserId, userId!));
      
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching all accounts:", error);
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  return httpServer;
}
