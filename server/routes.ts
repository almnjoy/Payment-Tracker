import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { objectStorageClient, ObjectStorageService } from "./replit_integrations/object_storage";
import multer from "multer";

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

// Middleware to check if user is client (or admin for access)
async function isClient(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const profile = await storage.getUserProfile(userId);
  if (!profile) {
    return res.status(403).json({ message: "Forbidden: No user profile found" });
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
        return res.status(400).json({ message: "Missing required fields" });
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
        'Content-Disposition': `attachment; filename="${document.title}"`,
      });
      
      file.createReadStream().pipe(res);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
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
        'Content-Disposition': `attachment; filename="${document.title}"`,
      });
      
      file.createReadStream().pipe(res);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
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

  return httpServer;
}
