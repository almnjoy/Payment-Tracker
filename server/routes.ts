import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import {
  objectStorageClient,
  ObjectStorageService,
} from "./replit_integrations/object_storage";
import multer from "multer";
import { plaidClient } from "./plaid/client";
import { CountryCode, Products } from "plaid";
import { db } from "./db";
import { z } from "zod";
import {
  plaidItems,
  plaidAccounts,
  plaidTransactions,
  plaidCursors,
  plaidRecurringGroups,
  financeEntries,
  clientBillingItems,
  clients,
  invoices,
  invoiceSettings,
  paymentSettings,
  documents,
  usersProfile,
  generatePlaidItemId,
  generatePlaidAccountRowId,
  generatePlaidTransactionRowId,
  generateFinanceEntryId,
  generateClientBillingItemId,
  generateRecurringGroupId,
  generatePaymentId,
  formatInvoiceNumber,
  insertFinanceEntrySchema,
  insertClientBillingItemSchema,
  insertInvoiceSettingsSchema,
  type InvoiceLineItem,
  type InvoiceSettings,
} from "@shared/schema";
import PDFDocument from "pdfkit";
import {
  getRecurrenceMultiplier,
  isOneTimeInRange,
  getPeriodDays,
  type TimePeriod,
  type RecurrenceType,
} from "@shared/recurrence";
import { eq, and, gte, lte, desc, sql, inArray, ilike, or } from "drizzle-orm";

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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
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
    return res
      .status(403)
      .json({ message: "Forbidden: Admin access required" });
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
    return res
      .status(403)
      .json({ message: "Forbidden: No user profile found" });
  }

  // Check for admin impersonation
  const asClientId = req.query.asClientId as string | undefined;
  if (asClientId && profile.role === "admin") {
    // Admin impersonating a client
    const client = await storage.getClient(asClientId);
    if (!client) {
      return res
        .status(404)
        .json({ message: "Client not found for impersonation" });
    }
    (req as any).userProfile = {
      ...profile,
      clientId: asClientId,
      impersonating: true,
    };
    (req as any).impersonatedClient = client;
    return next();
  }

  // Client role required (admins can also access for impersonation/support purposes)
  if (profile.role !== "client" && profile.role !== "admin") {
    return res
      .status(403)
      .json({ message: "Forbidden: Client access required" });
  }

  (req as any).userProfile = profile;
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
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
        return res
          .status(400)
          .json({ valid: false, reason: "Magic number required" });
      }

      const code = await storage.getInviteCode(magicNumber.toUpperCase());

      if (!code) {
        return res.json({ valid: false, reason: "Invalid magic number" });
      }

      if (code.usedAt) {
        return res.json({
          valid: false,
          reason: "This invite has already been used",
        });
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
  app.post(
    "/api/invite/claim",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { magicNumber } = req.body;

        if (!userId || !magicNumber) {
          return res
            .status(400)
            .json({ success: false, message: "Missing required fields" });
        }

        // First verify the code is valid
        const code = await storage.getInviteCode(magicNumber.toUpperCase());

        if (!code || code.usedAt || new Date(code.expiresAt) < new Date()) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid or expired invite" });
        }

        // Claim the code
        const claimedCode = await storage.claimInviteCode(
          magicNumber.toUpperCase(),
          userId,
        );

        if (!claimedCode) {
          return res
            .status(400)
            .json({ success: false, message: "Failed to claim invite" });
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
    },
  );

  // Verify Client ID with email (no auth required - validates email match)
  app.post("/api/client-signup/verify", async (req: Request, res: Response) => {
    try {
      const { clientId, email } = req.body;

      if (!clientId) {
        return res.status(400).json({ valid: false, reason: "Client ID is required" });
      }

      // Normalize clientId format (CL-XXXXXX or CL XXXXXX or just XXXXXX)
      let normalizedId = clientId.toUpperCase().replace(/\s+/g, '-');
      if (!normalizedId.startsWith('CL-')) {
        normalizedId = 'CL-' + normalizedId.replace(/^CL-?/, '');
      }

      const client = await storage.getClient(normalizedId);

      if (!client) {
        return res.json({ valid: false, reason: "Invalid Client ID" });
      }

      // Check if email matches (if provided)
      if (email && client.email && client.email.toLowerCase() !== email.toLowerCase()) {
        return res.json({ valid: false, reason: "Email does not match the client record" });
      }

      res.json({
        valid: true,
        clientId: client.clientId,
        clientDisplayName: client.displayName,
        requiresEmail: !email, // If no email provided, client needs to enter their email
      });
    } catch (error) {
      console.error("Error verifying client ID:", error);
      res.status(500).json({ valid: false, reason: "Server error" });
    }
  });

  // Claim Client ID (requires auth, validates email match)
  app.post(
    "/api/client-signup/claim",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const userClaims = (req.user as any)?.claims;
        const userEmail = userClaims?.email;
        const { clientId } = req.body;

        if (!userId || !clientId) {
          return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Normalize clientId format
        let normalizedId = clientId.toUpperCase().replace(/\s+/g, '-');
        if (!normalizedId.startsWith('CL-')) {
          normalizedId = 'CL-' + normalizedId.replace(/^CL-?/, '');
        }

        // Get the client record
        const client = await storage.getClient(normalizedId);

        if (!client) {
          return res.status(400).json({ success: false, message: "Invalid Client ID" });
        }

        // Validate email matches
        if (!userEmail || !client.email || client.email.toLowerCase() !== userEmail.toLowerCase()) {
          return res.status(400).json({
            success: false,
            message: "Your email does not match the client record. Please sign in with the correct email.",
          });
        }

        // Check if this client is already linked to another user
        const existingProfiles = await db
          .select()
          .from(usersProfile)
          .where(eq(usersProfile.clientId, normalizedId));

        if (existingProfiles.length > 0 && existingProfiles[0].userId !== userId) {
          return res.status(400).json({
            success: false,
            message: "This client account is already linked to another user.",
          });
        }

        // Create/update user profile
        await storage.upsertUserProfile({
          userId,
          role: "client",
          clientId: normalizedId,
          status: "active",
        });

        res.json({
          success: true,
          redirectTo: "/client/dashboard",
        });
      } catch (error) {
        console.error("Error claiming client ID:", error);
        res.status(500).json({ success: false, message: "Server error" });
      }
    },
  );

  // ============================================
  // ADMIN: CLIENTS
  // ============================================

  app.get(
    "/api/admin/clients",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const clients = await storage.getAllClients();

        // Get additional data for each client
        const enrichedClients = await Promise.all(
          clients.map(async (client) => {
            const invoices = await storage.getInvoicesByClient(client.clientId);
            const payments = await storage.getPaymentsByClient(client.clientId);

            const totalOwed = invoices
              .filter((inv) => ["open", "sent", "overdue"].includes(inv.status))
              .reduce((sum, inv) => sum + inv.amountCents, 0);

            const lastPayment = payments.length > 0 ? payments[0] : null;

            return {
              ...client,
              amountOwedCents: totalOwed,
              lastPaymentAt: lastPayment?.paidAt || lastPayment?.createdAt,
            };
          }),
        );

        res.json(enrichedClients);
      } catch (error) {
        console.error("Error fetching clients:", error);
        res.status(500).json({ message: "Failed to fetch clients" });
      }
    },
  );

  app.get(
    "/api/admin/clients/:clientId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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
    },
  );

  app.post(
    "/api/admin/clients",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const client = await storage.createClient(req.body);
        res.status(201).json(client);
      } catch (error) {
        console.error("Error creating client:", error);
        res.status(500).json({ message: "Failed to create client" });
      }
    },
  );

  app.delete(
    "/api/admin/clients/:clientId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { clientId } = req.params;
        
        // Get documents to delete from object storage
        const docs = await storage.getDocumentsByClient(clientId);
        
        // Delete document files from object storage
        for (const doc of docs) {
          if (doc.storageBucket && doc.storageKey) {
            try {
              const bucket = objectStorageClient.bucket(doc.storageBucket);
              await bucket.file(doc.storageKey).delete();
            } catch (err) {
              console.warn(`Failed to delete file ${doc.storageKey}:`, err);
            }
          }
        }

        // Get invoices to delete their PDFs from object storage
        const invoicesForClient = await storage.getInvoicesByClient(clientId);
        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
        
        if (bucketId) {
          for (const invoice of invoicesForClient) {
            if (invoice.pdfStorageKey) {
              try {
                const bucket = objectStorageClient.bucket(bucketId);
                await bucket.file(invoice.pdfStorageKey).delete();
              } catch (err) {
                console.warn(`Failed to delete invoice PDF ${invoice.pdfStorageKey}:`, err);
              }
            }
          }
        }
        
        // Delete client and all related database records
        const deleted = await storage.deleteClient(clientId);
        
        if (!deleted) {
          return res.status(404).json({ message: "Client not found" });
        }
        
        res.json({ success: true, message: "Client and all related data deleted" });
      } catch (error) {
        console.error("Error deleting client:", error);
        res.status(500).json({ message: "Failed to delete client" });
      }
    },
  );

  // ============================================
  // ADMIN: LEASES
  // ============================================

  app.get(
    "/api/admin/leases",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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
    },
  );

  app.post(
    "/api/admin/leases",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const lease = await storage.createLease(req.body);
        res.status(201).json(lease);
      } catch (error) {
        console.error("Error creating lease:", error);
        res.status(500).json({ message: "Failed to create lease" });
      }
    },
  );

  // ============================================
  // ADMIN: INVOICES
  // ============================================

  app.get(
    "/api/admin/invoices",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { clientId } = req.query;
        if (clientId) {
          const invoices = await storage.getInvoicesByClient(
            clientId as string,
          );
          return res.json(invoices);
        }
        const invoices = await storage.getAllInvoices();
        res.json(invoices);
      } catch (error) {
        console.error("Error fetching invoices:", error);
        res.status(500).json({ message: "Failed to fetch invoices" });
      }
    },
  );

  app.post(
    "/api/admin/invoices",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const invoice = await storage.createInvoice(req.body);
        res.status(201).json(invoice);
      } catch (error) {
        console.error("Error creating invoice:", error);
        res.status(500).json({ message: "Failed to create invoice" });
      }
    },
  );

  app.patch(
    "/api/admin/invoices/:invoiceId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { invoiceId } = req.params;
        const userId = getUserId(req);
        
        // Get current invoice to check if status is changing
        const currentInvoice = await storage.getInvoice(invoiceId);
        if (!currentInvoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }
        
        const newStatus = req.body.status;
        const wasNotSentOrPaid = currentInvoice.status !== "sent" && currentInvoice.status !== "paid";
        const isBecomingSentOrPaid = newStatus === "sent" || newStatus === "paid";
        
        // Update the invoice
        const invoice = await storage.updateInvoice(invoiceId, req.body);
        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }
        
        // Generate PDF when status changes to sent/paid (standalone, no document record)
        if (wasNotSentOrPaid && isBecomingSentOrPaid) {
          try {
            // Get settings for PDF generation
            const [settings] = await db
              .select()
              .from(invoiceSettings)
              .where(eq(invoiceSettings.adminUserId, userId!));
            
            // Generate PDF buffer using billTo fields (not client)
            const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
              const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
              const chunks: Buffer[] = [];
              
              doc.on('data', (chunk: Buffer) => chunks.push(chunk));
              doc.on('end', () => resolve(Buffer.concat(chunks)));
              doc.on('error', reject);
              
              const pageWidth = 612;
              const margin = 50;
              const contentWidth = pageWidth - (margin * 2);
              
              // Header - INVOICE title
              doc.fontSize(28).font('Helvetica-Bold').text('INVOICE', margin, margin, { align: 'right' });
              doc.fontSize(12).font('Helvetica').text(`# ${invoice.invoiceNumber}`, { align: 'right' });
              
              // Balance due box
              doc.moveDown(0.5);
              doc.fontSize(10).text('Balance Due', { align: 'right' });
              doc.fontSize(18).font('Helvetica-Bold').text(
                `$${(invoice.balanceDueCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                { align: 'right' }
              );
              
              // Business info (left side)
              let yPos = margin;
              if (settings?.businessName) {
                doc.fontSize(14).font('Helvetica-Bold').text(settings.businessName, margin, yPos);
                yPos += 20;
              }
              if (settings?.businessAddress) {
                doc.fontSize(10).font('Helvetica');
                const addressLines = settings.businessAddress.split('\n');
                addressLines.forEach(line => {
                  doc.text(line, margin, yPos);
                  yPos += 14;
                });
              }
              if (settings?.businessEmail) {
                doc.text(settings.businessEmail, margin, yPos);
                yPos += 14;
              }
              
              // Invoice details section
              yPos = 180;
              const labelX = 350;
              const valueX = 450;
              
              doc.fontSize(10).font('Helvetica');
              doc.text('Invoice Date:', labelX, yPos);
              doc.text(invoice.issueDate || '-', valueX, yPos);
              yPos += 18;
              
              doc.text('Terms:', labelX, yPos);
              doc.text(invoice.terms || 'Due on Receipt', valueX, yPos);
              yPos += 18;
              
              doc.text('Due Date:', labelX, yPos);
              doc.text(invoice.dueDate, valueX, yPos);
              yPos += 18;
              
              // Bill To info (standalone - not linked to client)
              yPos = 180;
              const billToName = invoice.billToName || 'Bill To';
              doc.fontSize(10).font('Helvetica-Bold').text(billToName, margin, yPos);
              yPos += 16;
              doc.font('Helvetica');
              if (invoice.billToAddress) {
                const addressLines = invoice.billToAddress.split('\n');
                addressLines.forEach(line => {
                  doc.text(line, margin, yPos);
                  yPos += 14;
                });
              }
              if (invoice.billToEmail) {
                doc.text(invoice.billToEmail, margin, yPos);
                yPos += 14;
              }
              
              // Line items table
              yPos = 280;
              const colX = [margin, margin + 30, margin + 250, margin + 300, margin + 370, margin + 440];
              
              // Table header
              doc.fontSize(9).font('Helvetica-Bold');
              doc.rect(margin, yPos - 5, contentWidth, 20).fill('#f5f5f5');
              doc.fillColor('#333');
              doc.text('#', colX[0], yPos);
              doc.text('Description', colX[1], yPos);
              doc.text('Qty', colX[2], yPos);
              doc.text('Rate', colX[3], yPos);
              doc.text('Discount', colX[4], yPos);
              doc.text('Amount', colX[5], yPos);
              
              yPos += 25;
              
              // Table rows
              doc.font('Helvetica').fontSize(9);
              const lineItems = (invoice.lineItems || []) as InvoiceLineItem[];
              lineItems.forEach((item, index) => {
                doc.fillColor('#333');
                doc.text((index + 1).toString(), colX[0], yPos);
                doc.text(item.description, colX[1], yPos, { width: 200 });
                doc.text(item.quantity.toFixed(2), colX[2], yPos);
                doc.text(`$${(item.rate / 100).toFixed(2)}`, colX[3], yPos);
                doc.text(item.discountPercent > 0 ? `${item.discountPercent}%` : '-', colX[4], yPos);
                doc.text(`$${(item.amount / 100).toFixed(2)}`, colX[5], yPos);
                yPos += 30;
              });
              
              // Totals
              yPos += 20;
              const totalsX = 380;
              const totalsValueX = 480;
              
              doc.font('Helvetica').fontSize(10);
              doc.text('Sub Total', totalsX, yPos);
              doc.text(`$${(invoice.subtotalCents / 100).toFixed(2)}`, totalsValueX, yPos, { align: 'right', width: 70 });
              yPos += 20;
              
              doc.font('Helvetica-Bold');
              doc.text('Total', totalsX, yPos);
              doc.text(`$${(invoice.totalCents / 100).toFixed(2)}`, totalsValueX, yPos, { align: 'right', width: 70 });
              yPos += 20;
              
              doc.text('Balance Due', totalsX, yPos);
              doc.text(`$${(invoice.balanceDueCents / 100).toFixed(2)}`, totalsValueX, yPos, { align: 'right', width: 70 });
              
              // Footer
              yPos = 650;
              doc.font('Helvetica').fontSize(10);
              const footerText = invoice.footerText || settings?.defaultFooterText || 'Thanks for your business.';
              doc.text(footerText, margin, yPos);
              
              doc.end();
            });
            
            // Upload PDF to object storage (no document record - standalone invoice)
            const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
            if (bucketId) {
              const storageKey = `invoices/${invoice.invoiceNumber}.pdf`;
              const bucket = objectStorageClient.bucket(bucketId);
              const file = bucket.file(storageKey);
              await file.save(pdfBuffer, { contentType: 'application/pdf' });
              
              // Update invoice with PDF storage key (no document record created)
              await storage.updateInvoice(invoiceId, { pdfStorageKey: storageKey });
            }
          } catch (pdfError) {
            console.error("Error generating invoice PDF:", pdfError);
            // Don't fail the status update, just log the PDF error
          }
        }
        
        res.json(invoice);
      } catch (error) {
        console.error("Error updating invoice:", error);
        res.status(500).json({ message: "Failed to update invoice" });
      }
    },
  );

  app.get(
    "/api/admin/invoices/:invoiceId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { invoiceId } = req.params;
        const invoice = await storage.getInvoice(invoiceId);
        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }
        res.json(invoice);
      } catch (error) {
        console.error("Error fetching invoice:", error);
        res.status(500).json({ message: "Failed to fetch invoice" });
      }
    },
  );

  app.delete(
    "/api/admin/invoices/:invoiceId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { invoiceId } = req.params;
        
        // Get invoice to find PDF storage key
        const invoice = await storage.getInvoice(invoiceId);
        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }
        
        // Delete PDF from object storage if exists
        if (invoice.pdfStorageKey) {
          try {
            const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
            if (bucketId) {
              const bucket = objectStorageClient.bucket(bucketId);
              await bucket.file(invoice.pdfStorageKey).delete();
            }
          } catch (err) {
            console.warn(`Failed to delete PDF ${invoice.pdfStorageKey}:`, err);
          }
        }
        
        // Delete from database
        const deleted = await storage.deleteInvoice(invoiceId);
        
        if (!deleted) {
          return res.status(500).json({ message: "Failed to delete invoice" });
        }
        
        res.json({ success: true, message: "Invoice deleted" });
      } catch (error) {
        console.error("Error deleting invoice:", error);
        res.status(500).json({ message: "Failed to delete invoice" });
      }
    },
  );

  // ============================================
  // ADMIN: INVOICE SETTINGS
  // ============================================

  app.get(
    "/api/admin/invoice-settings",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const [settings] = await db
          .select()
          .from(invoiceSettings)
          .where(eq(invoiceSettings.adminUserId, userId!));
        
        if (!settings) {
          // Return default settings if none exist
          return res.json({
            id: null,
            businessLogo: null,
            businessName: "",
            businessAddress: "",
            businessEmail: "",
            defaultTerms: "Due on Receipt",
            defaultFooterText: "Thanks for your business.",
            invoicePrefix: "INV-",
            nextInvoiceNumber: 1,
          });
        }
        res.json(settings);
      } catch (error) {
        console.error("Error fetching invoice settings:", error);
        res.status(500).json({ message: "Failed to fetch invoice settings" });
      }
    },
  );

  app.post(
    "/api/admin/invoice-settings",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const settingsId = `IS-${userId}`;
        
        const [existing] = await db
          .select()
          .from(invoiceSettings)
          .where(eq(invoiceSettings.id, settingsId));
        
        if (existing) {
          // Update existing
          const [updated] = await db
            .update(invoiceSettings)
            .set({ ...req.body, updatedAt: new Date() })
            .where(eq(invoiceSettings.id, settingsId))
            .returning();
          return res.json(updated);
        }
        
        // Create new
        const [created] = await db
          .insert(invoiceSettings)
          .values({
            id: settingsId,
            adminUserId: userId!,
            ...req.body,
          })
          .returning();
        res.status(201).json(created);
      } catch (error) {
        console.error("Error saving invoice settings:", error);
        res.status(500).json({ message: "Failed to save invoice settings" });
      }
    },
  );

  // Logo upload for invoice settings
  app.post(
    "/api/admin/invoice-settings/logo",
    isAuthenticated,
    isAdmin,
    upload.single("logo"),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const file = req.file;
        
        if (!file) {
          return res.status(400).json({ message: "No file uploaded" });
        }
        
        // Upload to object storage (public directory for logos)
        const publicPaths = objectStorageService.getPublicObjectSearchPaths();
        const publicPath = publicPaths[0]; // e.g., "/bucket-name/public"
        const pathParts = publicPath.split('/').filter(Boolean);
        const bucketName = pathParts[0];
        const storageKey = `logos/${userId}-${Date.now()}-${file.originalname}`;
        
        const bucket = objectStorageClient.bucket(bucketName);
        const blob = bucket.file(`public/${storageKey}`);
        
        await blob.save(file.buffer, {
          contentType: file.mimetype,
          metadata: { originalName: file.originalname },
        });
        
        // The public URL will be served through /api/assets endpoint
        const publicUrl = `/api/assets/${storageKey}`;
        
        // Update settings with logo URL
        const settingsId = `IS-${userId}`;
        const [existing] = await db
          .select()
          .from(invoiceSettings)
          .where(eq(invoiceSettings.id, settingsId));
        
        if (existing) {
          await db
            .update(invoiceSettings)
            .set({ businessLogo: publicUrl, updatedAt: new Date() })
            .where(eq(invoiceSettings.id, settingsId));
        } else {
          await db
            .insert(invoiceSettings)
            .values({
              id: settingsId,
              adminUserId: userId!,
              businessLogo: publicUrl,
            });
        }
        
        res.json({ url: publicUrl });
      } catch (error) {
        console.error("Error uploading logo:", error);
        res.status(500).json({ message: "Failed to upload logo" });
      }
    },
  );

  // Get next invoice number
  app.get(
    "/api/admin/invoice-settings/next-number",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const [settings] = await db
          .select()
          .from(invoiceSettings)
          .where(eq(invoiceSettings.adminUserId, userId!));
        
        const prefix = settings?.invoicePrefix || "INV-";
        const nextNum = settings?.nextInvoiceNumber || 1;
        
        res.json({
          prefix,
          nextNumber: nextNum,
          formatted: formatInvoiceNumber(prefix, nextNum),
        });
      } catch (error) {
        console.error("Error getting next invoice number:", error);
        res.status(500).json({ message: "Failed to get next invoice number" });
      }
    },
  );

  // ============================================
  // ADMIN: PAYMENT SETTINGS
  // ============================================

  app.get(
    "/api/admin/payment-settings",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const settings = await storage.getPaymentSettings();
        
        if (!settings) {
          return res.json({
            id: null,
            cashAppHandle: null,
            cashAppLink: null,
            venmoHandle: null,
            venmoLink: null,
            bankInstructions: null,
            stripePlaceholderMessage: "Stripe payments coming soon!",
          });
        }
        res.json(settings);
      } catch (error) {
        console.error("Error fetching payment settings:", error);
        res.status(500).json({ message: "Failed to fetch payment settings" });
      }
    },
  );

  app.put(
    "/api/admin/payment-settings",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const settings = await storage.upsertPaymentSettings({
          adminUserId: userId!,
          ...req.body,
        });
        res.json(settings);
      } catch (error) {
        console.error("Error updating payment settings:", error);
        res.status(500).json({ message: "Failed to update payment settings" });
      }
    },
  );

  // ============================================
  // ADMIN: AUTOMATION SETTINGS
  // ============================================
  app.get(
    "/api/admin/automation-settings",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const settings = await storage.getAutomationSettings();
        if (!settings) {
          return res.json({
            id: null,
            signupEmailWebhookUrl: "https://n8n.srv1077528.hstgr.cloud/webhook-test/client-signup-email",
            hasAutomationToken: false,
          });
        }
        // Don't expose the actual token - just indicate if it's set
        res.json({
          id: settings.id,
          signupEmailWebhookUrl: settings.signupEmailWebhookUrl,
          hasAutomationToken: !!settings.automationToken,
        });
      } catch (error) {
        console.error("Error fetching automation settings:", error);
        res.status(500).json({ message: "Failed to fetch automation settings" });
      }
    },
  );

  app.put(
    "/api/admin/automation-settings",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { signupEmailWebhookUrl, automationToken } = req.body;
        
        const settings = await storage.upsertAutomationSettings({
          adminUserId: userId!,
          signupEmailWebhookUrl: signupEmailWebhookUrl ?? null,
          automationToken: automationToken ?? null,
        });
        
        // Don't expose the actual token in response - just indicate if it's set
        res.json({
          id: settings.id,
          signupEmailWebhookUrl: settings.signupEmailWebhookUrl,
          hasAutomationToken: !!settings.automationToken,
        });
      } catch (error) {
        console.error("Error updating automation settings:", error);
        res.status(500).json({ message: "Failed to update automation settings" });
      }
    },
  );

  // Send Signup Email Webhook (server-side proxy to avoid CORS and token exposure)
  app.post(
    "/api/admin/send-signup-email",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { clientId } = req.body;
        
        if (!clientId) {
          return res.status(400).json({ message: "clientId is required" });
        }

        // Get client data
        const client = await storage.getClient(clientId);
        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }

        if (!client.email) {
          return res.status(400).json({ message: "Client email is required to send signup email" });
        }

        // Get automation settings
        const settings = await storage.getAutomationSettings();
        const webhookUrl = settings?.signupEmailWebhookUrl;
        
        if (!webhookUrl) {
          return res.status(400).json({ message: "Signup email webhook URL not configured. Please configure it in Settings > Automations" });
        }

        // Build payload
        const baseUrl = process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
          : process.env.REPLIT_DOMAINS 
            ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` 
            : "http://localhost:5000";
        
        const portalUrl = `${baseUrl}/auth/register`;
        const payload = {
          clientName: client.displayName,
          clientEmail: client.email,
          clientId: clientId,
          portalUrl: portalUrl,
        };

        // Build headers
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (settings?.automationToken) {
          headers["X-Automation-Token"] = settings.automationToken;
        } else {
          console.warn("Automation webhook token not set");
        }

        // Send webhook request
        console.log(`Sending signup email webhook to: ${webhookUrl}`);
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();
        console.log(`Webhook response: ${response.status} - ${responseText}`);

        if (!response.ok) {
          console.error("Webhook failed:", response.status, responseText);
          return res.status(502).json({ message: "Webhook request failed" });
        }

        console.log(`Signup email webhook sent for client ${clientId} to ${client.email}`);
        res.json({ success: true, message: `Signup email sent to ${client.email}` });
      } catch (error: any) {
        console.error("Error sending signup email webhook:", error);
        res.status(500).json({ message: error.message || "Failed to send signup email" });
      }
    },
  );

  // ============================================
  // ADMIN: DOCUMENT UPDATE (Active Agreement Toggle)
  // ============================================

  app.patch(
    "/api/admin/documents/:documentId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { documentId } = req.params;
        const { isActiveAgreement, docType, ...otherData } = req.body;
        
        const doc = await storage.getDocument(documentId);
        if (!doc) {
          return res.status(404).json({ message: "Document not found" });
        }
        
        // If marking as active agreement, first clear any existing active agreements for this client
        if (isActiveAgreement === true) {
          await storage.clearActiveAgreementForClient(doc.clientId);
        }
        
        // Update the document
        const updated = await storage.updateDocument(documentId, {
          ...(docType !== undefined && { docType }),
          ...(isActiveAgreement !== undefined && { isActiveAgreement }),
          ...otherData,
        });
        
        res.json(updated);
      } catch (error) {
        console.error("Error updating document:", error);
        res.status(500).json({ message: "Failed to update document" });
      }
    },
  );

  app.delete(
    "/api/admin/documents/:documentId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { documentId } = req.params;
        
        // Get document to find storage path
        const doc = await storage.getDocument(documentId);
        if (!doc) {
          return res.status(404).json({ message: "Document not found" });
        }
        
        // Delete from object storage
        if (doc.storageBucket && doc.storageKey) {
          try {
            const bucket = objectStorageClient.bucket(doc.storageBucket);
            await bucket.file(doc.storageKey).delete();
          } catch (err) {
            console.warn(`Failed to delete file ${doc.storageKey}:`, err);
          }
        }
        
        // Delete from database
        const deleted = await storage.deleteDocument(documentId);
        
        if (!deleted) {
          return res.status(500).json({ message: "Failed to delete document" });
        }
        
        res.json({ success: true, message: "Document deleted" });
      } catch (error) {
        console.error("Error deleting document:", error);
        res.status(500).json({ message: "Failed to delete document" });
      }
    },
  );

  // Generate PDF for invoice
  app.get(
    "/api/admin/invoices/:invoiceId/pdf",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { invoiceId } = req.params;
        const userId = getUserId(req);
        
        // Get invoice
        const invoice = await storage.getInvoice(invoiceId);
        if (!invoice) {
          return res.status(404).json({ message: "Invoice not found" });
        }
        
        // Get settings (no client needed - using billTo fields)
        const [settings] = await db
          .select()
          .from(invoiceSettings)
          .where(eq(invoiceSettings.adminUserId, userId!));
        
        // Create PDF
        const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
        const chunks: Buffer[] = [];
        
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', async () => {
          const pdfBuffer = Buffer.concat(chunks);
          
          // Return the PDF
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
          res.send(pdfBuffer);
        });
        
        // ============================================
        // PDF CONTENT
        // ============================================
        
        const pageWidth = 612;
        const margin = 50;
        const contentWidth = pageWidth - (margin * 2);
        
        // Header - INVOICE title
        doc.fontSize(28).font('Helvetica-Bold').text('INVOICE', margin, margin, { align: 'right' });
        doc.fontSize(12).font('Helvetica').text(`# ${invoice.invoiceNumber}`, { align: 'right' });
        
        // Balance due box
        doc.moveDown(0.5);
        doc.fontSize(10).text('Balance Due', { align: 'right' });
        doc.fontSize(18).font('Helvetica-Bold').text(
          `$${(invoice.balanceDueCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          { align: 'right' }
        );
        
        // Business info (left side)
        let yPos = margin;
        if (settings?.businessName) {
          doc.fontSize(14).font('Helvetica-Bold').text(settings.businessName, margin, yPos);
          yPos += 20;
        }
        if (settings?.businessAddress) {
          doc.fontSize(10).font('Helvetica');
          const addressLines = settings.businessAddress.split('\n');
          addressLines.forEach(line => {
            doc.text(line, margin, yPos);
            yPos += 14;
          });
        }
        if (settings?.businessEmail) {
          doc.text(settings.businessEmail, margin, yPos);
          yPos += 14;
        }
        
        // Invoice details section
        yPos = 180;
        const labelX = 350;
        const valueX = 450;
        
        doc.fontSize(10).font('Helvetica');
        doc.text('Invoice Date:', labelX, yPos);
        doc.text(invoice.issueDate || '-', valueX, yPos);
        yPos += 18;
        
        doc.text('Terms:', labelX, yPos);
        doc.text(invoice.terms || 'Due on Receipt', valueX, yPos);
        yPos += 18;
        
        doc.text('Due Date:', labelX, yPos);
        doc.text(invoice.dueDate, valueX, yPos);
        yPos += 18;
        
        // Bill To info (standalone invoice - no client link)
        yPos = 180;
        const billToName = invoice.billToName || 'Bill To';
        doc.fontSize(10).font('Helvetica-Bold').text(billToName, margin, yPos);
        yPos += 16;
        doc.font('Helvetica');
        if (invoice.billToAddress) {
          const addressLines = invoice.billToAddress.split('\n');
          addressLines.forEach(line => {
            doc.text(line, margin, yPos);
            yPos += 14;
          });
        }
        if (invoice.billToEmail) {
          doc.text(invoice.billToEmail, margin, yPos);
          yPos += 14;
        }
        
        // Line items table
        yPos = 280;
        const tableTop = yPos;
        const colWidths = [30, 220, 50, 70, 70, 70];
        const colX = [margin, margin + 30, margin + 250, margin + 300, margin + 370, margin + 440];
        
        // Table header
        doc.fontSize(9).font('Helvetica-Bold');
        doc.rect(margin, yPos - 5, contentWidth, 20).fill('#f5f5f5');
        doc.fillColor('#333');
        doc.text('#', colX[0], yPos);
        doc.text('Description', colX[1], yPos);
        doc.text('Qty', colX[2], yPos);
        doc.text('Rate', colX[3], yPos);
        doc.text('Discount', colX[4], yPos);
        doc.text('Amount', colX[5], yPos);
        
        yPos += 25;
        
        // Table rows
        doc.font('Helvetica').fontSize(9);
        const lineItems = (invoice.lineItems || []) as InvoiceLineItem[];
        lineItems.forEach((item, index) => {
          doc.fillColor('#333');
          doc.text((index + 1).toString(), colX[0], yPos);
          doc.text(item.description, colX[1], yPos, { width: 200 });
          doc.text(item.quantity.toFixed(2), colX[2], yPos);
          doc.text(`$${(item.rate / 100).toFixed(2)}`, colX[3], yPos);
          doc.text(item.discountPercent > 0 ? `${item.discountPercent}%` : '-', colX[4], yPos);
          doc.text(`$${(item.amount / 100).toFixed(2)}`, colX[5], yPos);
          yPos += 30;
        });
        
        // Totals
        yPos += 20;
        const totalsX = 380;
        const totalsValueX = 480;
        
        doc.font('Helvetica').fontSize(10);
        doc.text('Sub Total', totalsX, yPos);
        doc.text(`$${(invoice.subtotalCents / 100).toFixed(2)}`, totalsValueX, yPos, { align: 'right', width: 70 });
        yPos += 20;
        
        doc.font('Helvetica-Bold');
        doc.text('Total', totalsX, yPos);
        doc.text(`$${(invoice.totalCents / 100).toFixed(2)}`, totalsValueX, yPos, { align: 'right', width: 70 });
        yPos += 20;
        
        doc.text('Balance Due', totalsX, yPos);
        doc.text(`$${(invoice.balanceDueCents / 100).toFixed(2)}`, totalsValueX, yPos, { align: 'right', width: 70 });
        
        // Footer
        yPos = 650;
        doc.font('Helvetica').fontSize(10);
        const footerText = invoice.footerText || settings?.defaultFooterText || 'Thanks for your business.';
        doc.text(footerText, margin, yPos);
        
        doc.end();
      } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({ message: "Failed to generate PDF" });
      }
    },
  );

  // Create invoice with auto-numbering
  app.post(
    "/api/admin/invoices/create",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        
        // Get settings for auto-numbering
        const settingsId = `IS-${userId}`;
        let [settings] = await db
          .select()
          .from(invoiceSettings)
          .where(eq(invoiceSettings.id, settingsId));
        
        const prefix = settings?.invoicePrefix || "INV-";
        const nextNum = settings?.nextInvoiceNumber || 1;
        const invoiceNumber = formatInvoiceNumber(prefix, nextNum);
        
        // Calculate totals
        const lineItems = (req.body.lineItems || []) as InvoiceLineItem[];
        const subtotalCents = lineItems.reduce((sum, item) => sum + item.amount, 0);
        const taxPercent = req.body.taxPercent || 0;
        const taxCents = Math.round(subtotalCents * (taxPercent / 100));
        const totalCents = subtotalCents + taxCents;
        const balanceDueCents = totalCents;
        
        // Create invoice (standalone - no client link required)
        const invoice = await storage.createInvoice({
          billToName: req.body.billToName,
          billToEmail: req.body.billToEmail || null,
          billToAddress: req.body.billToAddress || null,
          invoiceNumber,
          title: req.body.title || `Invoice ${invoiceNumber}`,
          issueDate: req.body.issueDate || new Date().toISOString().split('T')[0],
          dueDate: req.body.dueDate,
          terms: req.body.terms || settings?.defaultTerms || "Due on Receipt",
          lineItems,
          subtotalCents,
          taxPercent,
          taxCents,
          totalCents,
          amountCents: totalCents,
          balanceDueCents,
          status: req.body.status || "draft",
          footerText: req.body.footerText || settings?.defaultFooterText,
        });
        
        // Increment next invoice number
        if (settings) {
          await db
            .update(invoiceSettings)
            .set({ nextInvoiceNumber: nextNum + 1, updatedAt: new Date() })
            .where(eq(invoiceSettings.id, settingsId));
        } else {
          await db
            .insert(invoiceSettings)
            .values({
              id: settingsId,
              adminUserId: userId!,
              nextInvoiceNumber: 2,
            });
        }
        
        res.status(201).json(invoice);
      } catch (error) {
        console.error("Error creating invoice:", error);
        res.status(500).json({ message: "Failed to create invoice" });
      }
    },
  );

  // ============================================
  // ADMIN: PAYMENTS
  // ============================================

  app.get(
    "/api/admin/payments",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { clientId } = req.query;
        if (clientId) {
          const payments = await storage.getPaymentsByClient(
            clientId as string,
          );
          return res.json(payments);
        }
        const payments = await storage.getAllPayments();
        res.json(payments);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).json({ message: "Failed to fetch payments" });
      }
    },
  );

  app.post(
    "/api/admin/payments",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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
    },
  );

  // Update payment status (for payment verification)
  app.patch(
    "/api/admin/payments/:paymentId/status",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { paymentId } = req.params;
        const { status } = req.body;

        const validStatuses = ["pending", "posted", "confirmed", "rejected"];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ 
            message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` 
          });
        }

        const payment = await storage.updatePaymentStatus(paymentId, status);
        if (!payment) {
          return res.status(404).json({ message: "Payment not found" });
        }

        res.json(payment);
      } catch (error) {
        console.error("Error updating payment status:", error);
        res.status(500).json({ message: "Failed to update payment status" });
      }
    },
  );

  // ============================================
  // ADMIN: DOCUMENTS
  // ============================================

  app.get(
    "/api/admin/documents",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { clientId } = req.query;
        if (clientId) {
          const documents = await storage.getDocumentsByClient(
            clientId as string,
          );
          return res.json(documents);
        }
        const documents = await storage.getAllDocuments();
        res.json(documents);
      } catch (error) {
        console.error("Error fetching documents:", error);
        res.status(500).json({ message: "Failed to fetch documents" });
      }
    },
  );

  app.post(
    "/api/admin/documents/upload",
    isAuthenticated,
    isAdmin,
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const file = req.file;
        const { clientId, leaseId, invoiceId, title, docType, visibility, isActiveAgreement } =
          req.body;

        if (!file || !clientId || !title) {
          return res
            .status(400)
            .json({
              message:
                "Missing required fields: file, clientId, and title are required",
            });
        }

        if (file.mimetype !== "application/pdf") {
          return res
            .status(400)
            .json({ message: "Only PDF files are allowed" });
        }

        // Get the private object directory
        const privateDir = objectStorageService.getPrivateObjectDir();
        const bucketName = privateDir.split("/")[1];
        const timestamp = Date.now();
        const storageKey = `clients/${clientId}/documents/${timestamp}_${file.originalname}`;
        const fullPath = `${privateDir.split("/").slice(0, 2).join("/")}/${storageKey}`;

        // Upload to object storage
        const bucket = objectStorageClient.bucket(bucketName);
        const blob = bucket.file(storageKey);

        await blob.save(file.buffer, {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
          },
        });

        // If setting as active agreement, clear any existing active agreements for this client
        if (isActiveAgreement === "true") {
          await storage.clearActiveAgreementForClient(clientId);
        }

        // Save document metadata
        const document = await storage.createDocument({
          clientId,
          leaseId: leaseId || null,
          invoiceId: invoiceId || null,
          title,
          docType: docType || "other",
          visibility: visibility || "client_and_admin",
          storageBucket: bucketName,
          storageKey,
          contentType: file.mimetype,
          fileSizeBytes: file.size,
          uploadedByUserId: userId!,
          isActiveAgreement: isActiveAgreement === "true",
        });

        res.status(201).json(document);
      } catch (error) {
        console.error("Error uploading document:", error);
        res.status(500).json({ message: "Failed to upload document" });
      }
    },
  );

  app.get(
    "/api/admin/documents/:documentId/download",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { documentId } = req.params;
        const isPreview = req.query.preview === "true";
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
          "Content-Type": document.contentType || "application/octet-stream",
          "Content-Disposition": `${isPreview ? "inline" : "attachment"}; filename="${document.title}"`,
        });

        file.createReadStream().pipe(res);
      } catch (error) {
        console.error("Error downloading document:", error);
        res.status(500).json({ message: "Failed to download document" });
      }
    },
  );

  // Toggle active agreement status for a document
  app.patch(
    "/api/admin/documents/:documentId/active-agreement",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { documentId } = req.params;
        const { isActive } = req.body;

        const document = await storage.getDocument(documentId);
        if (!document) {
          return res.status(404).json({ message: "Document not found" });
        }

        if (isActive) {
          // First, unmark any existing active agreement for this client
          await db
            .update(documents)
            .set({ isActiveAgreement: false, updatedAt: new Date() })
            .where(
              and(
                eq(documents.clientId, document.clientId),
                eq(documents.isActiveAgreement, true)
              )
            );
        }

        // Now set this document's active agreement status
        const [updated] = await db
          .update(documents)
          .set({ isActiveAgreement: !!isActive, updatedAt: new Date() })
          .where(eq(documents.documentId, documentId))
          .returning();

        res.json(updated);
      } catch (error) {
        console.error("Error updating active agreement:", error);
        res.status(500).json({ message: "Failed to update active agreement" });
      }
    },
  );

  // Get active agreement for a client
  app.get(
    "/api/admin/clients/:clientId/active-agreement",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { clientId } = req.params;
        const [activeDoc] = await db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.clientId, clientId),
              eq(documents.isActiveAgreement, true)
            )
          );
        res.json(activeDoc || null);
      } catch (error) {
        console.error("Error fetching active agreement:", error);
        res.status(500).json({ message: "Failed to fetch active agreement" });
      }
    },
  );

  // ============================================
  // ADMIN: CLIENT BILLING ITEMS
  // ============================================

  app.get(
    "/api/admin/clients/:clientId/billing-items",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { clientId } = req.params;
        const items = await db
          .select()
          .from(clientBillingItems)
          .where(eq(clientBillingItems.clientId, clientId))
          .orderBy(desc(clientBillingItems.createdAt));
        res.json(items);
      } catch (error) {
        console.error("Error fetching billing items:", error);
        res.status(500).json({ message: "Failed to fetch billing items" });
      }
    },
  );

  app.post(
    "/api/admin/clients/:clientId/billing-items",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { clientId } = req.params;
        const { type, title, amountCents, dueDate, frequency, notes } =
          req.body;

        if (!title || !amountCents || !dueDate) {
          return res
            .status(400)
            .json({ message: "title, amountCents, and dueDate are required" });
        }

        const item = await db
          .insert(clientBillingItems)
          .values({
            id: generateClientBillingItemId(),
            clientId,
            type: type || "other",
            title,
            amountCents,
            dueDate,
            frequency: frequency || "one_time",
            notes: notes || null,
            status: "active",
          })
          .returning();

        res.status(201).json(item[0]);
      } catch (error) {
        console.error("Error creating billing item:", error);
        res.status(500).json({ message: "Failed to create billing item" });
      }
    },
  );

  app.delete(
    "/api/admin/clients/:clientId/billing-items/:id",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { clientId, id } = req.params;
        const deleted = await db
          .delete(clientBillingItems)
          .where(
            and(
              eq(clientBillingItems.id, id),
              eq(clientBillingItems.clientId, clientId),
            ),
          )
          .returning();

        if (deleted.length === 0) {
          return res.status(404).json({ message: "Billing item not found" });
        }

        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting billing item:", error);
        res.status(500).json({ message: "Failed to delete billing item" });
      }
    },
  );

  // Get all billing items (for Finance Tracker derived income)
  app.get(
    "/api/admin/billing-items",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { startDate, endDate } = req.query;
        let query = db
          .select()
          .from(clientBillingItems)
          .where(eq(clientBillingItems.status, "active"));

        if (startDate && endDate) {
          query = db
            .select()
            .from(clientBillingItems)
            .where(
              and(
                eq(clientBillingItems.status, "active"),
                gte(clientBillingItems.dueDate, startDate as string),
                lte(clientBillingItems.dueDate, endDate as string),
              ),
            );
        }

        const items = await query.orderBy(desc(clientBillingItems.dueDate));
        res.json(items);
      } catch (error) {
        console.error("Error fetching all billing items:", error);
        res.status(500).json({ message: "Failed to fetch billing items" });
      }
    },
  );

  // Update client status (lease status)
  app.patch(
    "/api/admin/clients/:clientId/status",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { clientId } = req.params;
        const { status } = req.body;

        if (!["active", "paused", "inactive", "behind"].includes(status)) {
          return res
            .status(400)
            .json({
              message:
                "Invalid status. Must be active, paused, inactive, or behind",
            });
        }

        const updated = await db
          .update(clients)
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
    },
  );

  // ============================================
  // ADMIN: INVITE CODES
  // ============================================

  app.get(
    "/api/admin/invite-codes",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      // For now, we don't have a getAllInviteCodes method, so return empty
      res.json([]);
    },
  );

  app.post(
    "/api/admin/invite-codes",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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
    },
  );

  // ============================================
  // ADMIN: EXTERNAL ACCOUNTS
  // ============================================

  app.get(
    "/api/admin/external-accounts",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const accounts = await storage.getAllExternalAccounts();
        res.json(accounts);
      } catch (error) {
        console.error("Error fetching external accounts:", error);
        res.status(500).json({ message: "Failed to fetch external accounts" });
      }
    },
  );

  app.post(
    "/api/admin/external-accounts",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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
    },
  );

  app.delete(
    "/api/admin/external-accounts/:accountId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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
    },
  );

  // ============================================
  // ADMIN: DASHBOARD STATS
  // ============================================

  app.get(
    "/api/admin/stats",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const clients = await storage.getAllClients();
        const payments = await storage.getAllPayments();
        
        // Get all active billing items directly from database
        const allBillingItems = await db
          .select()
          .from(clientBillingItems)
          .where(eq(clientBillingItems.status, "active"));

        // Get active clients only (exclude paused/inactive)
        const activeClients = clients.filter(c => c.status === "active" || c.status === "behind");
        const activeClientIds = new Set(activeClients.map(c => c.clientId));

        // Filter payments to only include those from active/behind clients
        const activePayments = payments.filter(p => activeClientIds.has(p.clientId));

        // Total Collected = confirmed payments from active/behind clients only
        const totalCollectedCents = activePayments
          .filter((p) => p.status === "confirmed")
          .reduce((sum, p) => sum + p.amountCents, 0);

        // Calculate Outstanding Balance using same logic as Client Details:
        // For each active client: billingItemsTotal - confirmedPaymentsTotal
        // Negative value means client owes money
        let totalOutstandingCents = 0;
        for (const client of activeClients) {
          const clientBills = allBillingItems.filter(
            item => item.clientId === client.clientId
          );
          const clientBillingTotal = clientBills.reduce(
            (sum: number, item) => sum + (item.amountCents || 0), 0
          );
          
          const clientConfirmedPayments = activePayments.filter(
            p => p.clientId === client.clientId && p.status === 'confirmed'
          );
          const clientPaymentsTotal = clientConfirmedPayments.reduce(
            (sum, p) => sum + p.amountCents, 0
          );
          
          // currentBalance = confirmedPayments - billingItems (negative = owes)
          const clientBalance = clientPaymentsTotal - clientBillingTotal;
          // Add to total outstanding (only if client owes money, i.e., balance < 0)
          if (clientBalance < 0) {
            totalOutstandingCents += clientBalance; // Accumulate negative amounts
          }
        }

        // Count payments needing verification from active/behind clients
        const pendingVerificationCount = activePayments.filter(
          (p) => ["pending", "posted"].includes(p.status),
        ).length;

        res.json({
          totalCollectedCents,
          outstandingCents: totalOutstandingCents, // Now matches Client Details (negative = owed)
          pendingVerificationCount,
          activeClients: activeClients.filter(c => c.status === "active").length,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({ message: "Failed to fetch stats" });
      }
    },
  );

  // ============================================
  // CLIENT: DASHBOARD
  // ============================================

  app.get(
    "/api/client/dashboard",
    isAuthenticated,
    isClient,
    async (req: Request, res: Response) => {
      try {
        const profile = (req as any).userProfile;

        if (!profile.clientId) {
          return res.status(403).json({ message: "No client profile linked" });
        }

        const client = await storage.getClient(profile.clientId);
        const invoices = await storage.getInvoicesByClient(profile.clientId);
        const payments = await storage.getPaymentsByClient(profile.clientId);
        const leases = await storage.getLeasesByClient(profile.clientId);
        const documents = await storage.getDocumentsByClient(
          profile.clientId,
          "client_and_admin",
        );

        const openInvoices = invoices.filter((inv) =>
          ["open", "sent", "overdue"].includes(inv.status),
        );
        const amountDueCents = openInvoices.reduce(
          (sum, inv) => sum + inv.amountCents,
          0,
        );
        const lastPayment = payments.length > 0 ? payments[0] : null;
        const activeLease = leases.find((l) => l.status === "active");
        const activeAgreement = documents.find((d: any) => d.isActiveAgreement === true);

        res.json({
          client,
          amountDueCents,
          nextDueDate: openInvoices.length > 0 ? openInvoices[0].dueDate : null,
          lastPayment,
          activeLease,
          activeAgreement,
          recentDocuments: documents.slice(0, 5),
          openInvoicesCount: openInvoices.length,
        });
      } catch (error) {
        console.error("Error fetching client dashboard:", error);
        res.status(500).json({ message: "Failed to fetch dashboard" });
      }
    },
  );

  // ============================================
  // CLIENT: INVOICES
  // ============================================

  app.get(
    "/api/client/invoices",
    isAuthenticated,
    isClient,
    async (req: Request, res: Response) => {
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
    },
  );

  // ============================================
  // CLIENT: PAYMENTS
  // ============================================

  app.get(
    "/api/client/payments",
    isAuthenticated,
    isClient,
    async (req: Request, res: Response) => {
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
    },
  );

  // Client submit payment (report payment for logging)
  app.post(
    "/api/client/payments",
    isAuthenticated,
    isClient,
    async (req: Request, res: Response) => {
      try {
        const profile = (req as any).userProfile;
        
        if (!profile.clientId) {
          return res.status(403).json({ message: "No client profile linked" });
        }
        
        const { amountCents, method, note } = req.body;
        
        if (!amountCents || amountCents <= 0) {
          return res.status(400).json({ message: "Invalid payment amount" });
        }
        
        if (!method) {
          return res.status(400).json({ message: "Payment method is required" });
        }
        
        const payment = await storage.createPayment({
          clientId: profile.clientId,
          amountCents,
          method,
          notes: note || null,
          status: "pending",
          paidAt: new Date(),
        });
        
        res.status(201).json(payment);
      } catch (error) {
        console.error("Error creating client payment:", error);
        res.status(500).json({ message: "Failed to create payment" });
      }
    },
  );

  // ============================================
  // CLIENT: PROFILE UPDATE
  // ============================================

  app.get(
    "/api/client/profile",
    isAuthenticated,
    isClient,
    async (req: Request, res: Response) => {
      try {
        const profile = (req as any).userProfile;
        
        if (!profile.clientId) {
          return res.status(403).json({ message: "No client profile linked" });
        }
        
        const client = await storage.getClient(profile.clientId);
        res.json(client);
      } catch (error) {
        console.error("Error fetching client profile:", error);
        res.status(500).json({ message: "Failed to fetch profile" });
      }
    },
  );

  app.put(
    "/api/client/profile",
    isAuthenticated,
    isClient,
    async (req: Request, res: Response) => {
      try {
        const profile = (req as any).userProfile;
        
        if (!profile.clientId) {
          return res.status(403).json({ message: "No client profile linked" });
        }
        
        const { displayName, email, phone, address, notificationsEnabled } = req.body;
        
        // Validate required fields
        if (!displayName || !displayName.trim()) {
          return res.status(400).json({ message: "Name is required" });
        }
        
        if (!email || !email.trim()) {
          return res.status(400).json({ message: "Email is required" });
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ message: "Invalid email format" });
        }
        
        const updated = await storage.updateClient(profile.clientId, {
          displayName: displayName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          notificationsEnabled: notificationsEnabled ?? true,
        });
        
        res.json(updated);
      } catch (error) {
        console.error("Error updating client profile:", error);
        res.status(500).json({ message: "Failed to update profile" });
      }
    },
  );

  // ============================================
  // CLIENT: PAYMENT SETTINGS (Public - read only for clients)
  // ============================================

  app.get(
    "/api/client/payment-settings",
    isAuthenticated,
    isClient,
    async (req: Request, res: Response) => {
      try {
        const settings = await storage.getPaymentSettings();
        
        // Return sanitized settings (no admin userId)
        res.json({
          cashAppHandle: settings?.cashAppHandle || null,
          cashAppLink: settings?.cashAppLink || null,
          venmoHandle: settings?.venmoHandle || null,
          venmoLink: settings?.venmoLink || null,
          bankInstructions: settings?.bankInstructions || null,
          stripePlaceholderMessage: settings?.stripePlaceholderMessage || "Stripe payments coming soon!",
        });
      } catch (error) {
        console.error("Error fetching payment settings for client:", error);
        res.status(500).json({ message: "Failed to fetch payment settings" });
      }
    },
  );

  // ============================================
  // CLIENT: DOCUMENTS
  // ============================================

  app.get(
    "/api/client/documents",
    isAuthenticated,
    isClient,
    async (req: Request, res: Response) => {
      try {
        const profile = (req as any).userProfile;

        if (!profile.clientId) {
          return res.status(403).json({ message: "No client profile linked" });
        }

        const documents = await storage.getDocumentsByClient(
          profile.clientId,
          "client_and_admin",
        );
        res.json(documents);
      } catch (error) {
        console.error("Error fetching client documents:", error);
        res.status(500).json({ message: "Failed to fetch documents" });
      }
    },
  );

  app.get(
    "/api/client/documents/:documentId/download",
    isAuthenticated,
    isClient,
    async (req: Request, res: Response) => {
      try {
        const profile = (req as any).userProfile;
        const { documentId } = req.params;
        const isPreview = req.query.preview === "true";

        const document = await storage.getDocument(documentId);

        if (!document) {
          return res.status(404).json({ message: "Document not found" });
        }

        // Verify client can access this document
        if (
          document.clientId !== profile.clientId ||
          document.visibility !== "client_and_admin"
        ) {
          return res.status(403).json({ message: "Access denied" });
        }

        const bucket = objectStorageClient.bucket(document.storageBucket);
        const file = bucket.file(document.storageKey);

        const [exists] = await file.exists();
        if (!exists) {
          return res.status(404).json({ message: "File not found in storage" });
        }

        res.set({
          "Content-Type": document.contentType || "application/octet-stream",
          "Content-Disposition": `${isPreview ? "inline" : "attachment"}; filename="${document.title}"`,
        });

        file.createReadStream().pipe(res);
      } catch (error) {
        console.error("Error downloading document:", error);
        res.status(500).json({ message: "Failed to download document" });
      }
    },
  );

  // Get billing items for client (bills/expenses assigned to their clientId)
  app.get(
    "/api/client/finance-entries",
    isAuthenticated,
    isClient,
    async (req: Request, res: Response) => {
      try {
        const profile = (req as any).userProfile;

        if (!profile.clientId) {
          return res.status(403).json({ message: "No client profile linked" });
        }

        // Query client billing items (created by admin for this client)
        const items = await db
          .select()
          .from(clientBillingItems)
          .where(eq(clientBillingItems.clientId, profile.clientId))
          .orderBy(desc(clientBillingItems.dueDate));

        // Transform to match expected format for client dashboard
        const entries = items.map(item => ({
          entryId: item.id,
          title: item.title,
          amountCents: item.amountCents,
          date: item.dueDate,
          categoryGroup: item.type,
          recurrence: item.frequency,
          notes: item.notes,
        }));

        res.json(entries);
      } catch (error) {
        console.error("Error fetching client finance entries:", error);
        res.status(500).json({ message: "Failed to fetch finance entries" });
      }
    },
  );

  // ============================================
  // ADMIN BOOTSTRAP (for first admin setup)
  // ============================================

  app.post(
    "/api/admin/bootstrap",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { secretKey } = req.body;

        // Check for admin bootstrap secret (set in environment)
        const bootstrapSecret =
          process.env.ADMIN_BOOTSTRAP_SECRET || "SETUP_ADMIN_2024";

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
    },
  );

  // ============================================
  // PLAID INTEGRATION (Admin Only)
  // ============================================

  // A) Create Link Token for Plaid Link
  app.post(
    "/api/admin/plaid/link-token",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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
        console.error(
          "Error creating link token:",
          error?.response?.data || error,
        );
        res.status(500).json({ message: "Failed to create link token" });
      }
    },
  );

  // B) Exchange public token and initialize transactions
  app.post(
    "/api/admin/plaid/exchange",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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
          const existingAccount = await db
            .select()
            .from(plaidAccounts)
            .where(
              and(
                eq(plaidAccounts.itemId, itemId),
                eq(plaidAccounts.plaidAccountId, account.account_id),
              ),
            )
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
              currentBalanceCents: account.balances.current
                ? Math.round(account.balances.current * 100)
                : null,
              availableBalanceCents: account.balances.available
                ? Math.round(account.balances.available * 100)
                : null,
              isoCurrencyCode: account.balances.iso_currency_code || "USD",
            });
          } else {
            await db
              .update(plaidAccounts)
              .set({
                name: account.name,
                officialName: account.official_name || null,
                mask: account.mask || null,
                type: account.type,
                subtype: account.subtype || null,
                currentBalanceCents: account.balances.current
                  ? Math.round(account.balances.current * 100)
                  : null,
                availableBalanceCents: account.balances.available
                  ? Math.round(account.balances.available * 100)
                  : null,
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
          const existingTxn = await db
            .select()
            .from(plaidTransactions)
            .where(
              and(
                eq(plaidTransactions.itemId, itemId),
                eq(plaidTransactions.plaidTransactionId, txn.transaction_id),
              ),
            )
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
        await db
          .insert(plaidCursors)
          .values({
            itemId,
            cursor: syncResponse.data.next_cursor,
            lastSyncAt: new Date(),
          })
          .onConflictDoUpdate({
            target: plaidCursors.itemId,
            set: {
              cursor: syncResponse.data.next_cursor,
              lastSyncAt: new Date(),
            },
          });

        res.json({
          item_id: itemId,
          institution_name: institution_name || "Unknown",
        });
      } catch (error: any) {
        console.error(
          "Error exchanging token:",
          error?.response?.data || error,
        );
        res.status(500).json({ message: "Failed to exchange token" });
      }
    },
  );

  // C) Sync transactions for all linked items
  app.post(
    "/api/admin/plaid/sync",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);

        // Get all items for this admin
        const items = await db
          .select()
          .from(plaidItems)
          .where(eq(plaidItems.adminUserId, userId!));

        let totalAdded = 0;
        let totalModified = 0;
        let totalRemoved = 0;

        for (const item of items) {
          // Get current cursor
          const cursorResult = await db
            .select()
            .from(plaidCursors)
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
            const existingTxn = await db
              .select()
              .from(plaidTransactions)
              .where(
                and(
                  eq(plaidTransactions.itemId, item.itemId),
                  eq(plaidTransactions.plaidTransactionId, txn.transaction_id),
                ),
              )
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
            await db
              .update(plaidTransactions)
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
              .where(
                and(
                  eq(plaidTransactions.itemId, item.itemId),
                  eq(plaidTransactions.plaidTransactionId, txn.transaction_id),
                ),
              );
            totalModified++;
          }

          // Process removed transactions
          for (const removed of syncResponse.data.removed) {
            if (removed.transaction_id) {
              await db
                .delete(plaidTransactions)
                .where(
                  and(
                    eq(plaidTransactions.itemId, item.itemId),
                    eq(
                      plaidTransactions.plaidTransactionId,
                      removed.transaction_id,
                    ),
                  ),
                );
              totalRemoved++;
            }
          }

          // Update accounts balances
          const accountsResponse = await plaidClient.accountsGet({
            access_token: item.accessToken,
          });

          for (const account of accountsResponse.data.accounts) {
            await db
              .update(plaidAccounts)
              .set({
                currentBalanceCents: account.balances.current
                  ? Math.round(account.balances.current * 100)
                  : null,
                availableBalanceCents: account.balances.available
                  ? Math.round(account.balances.available * 100)
                  : null,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(plaidAccounts.itemId, item.itemId),
                  eq(plaidAccounts.plaidAccountId, account.account_id),
                ),
              );
          }

          // Update cursor
          await db
            .insert(plaidCursors)
            .values({
              itemId: item.itemId,
              cursor: syncResponse.data.next_cursor,
              lastSyncAt: new Date(),
            })
            .onConflictDoUpdate({
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
        console.error(
          "Error syncing transactions:",
          error?.response?.data || error,
        );
        res.status(500).json({ message: "Failed to sync transactions" });
      }
    },
  );

  // D) Get linked items for this admin
  app.get(
    "/api/admin/plaid/items",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);

        const items = await db
          .select({
            itemId: plaidItems.itemId,
            institutionName: plaidItems.institutionName,
            status: plaidItems.status,
            createdAt: plaidItems.createdAt,
          })
          .from(plaidItems)
          .where(eq(plaidItems.adminUserId, userId!));

        // Add last_sync_at from cursors
        const result = await Promise.all(
          items.map(async (item) => {
            const cursor = await db
              .select()
              .from(plaidCursors)
              .where(eq(plaidCursors.itemId, item.itemId))
              .limit(1);

            return {
              ...item,
              last_sync_at: cursor[0]?.lastSyncAt || null,
            };
          }),
        );

        res.json(result);
      } catch (error) {
        console.error("Error fetching plaid items:", error);
        res.status(500).json({ message: "Failed to fetch linked accounts" });
      }
    },
  );

  // E) Delete/Unlink a Plaid item
  app.delete(
    "/api/admin/plaid/items/:itemId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { itemId } = req.params;

        // Verify item belongs to this admin
        const item = await db
          .select()
          .from(plaidItems)
          .where(
            and(
              eq(plaidItems.itemId, itemId),
              eq(plaidItems.adminUserId, userId!),
            ),
          )
          .limit(1);

        if (item.length === 0) {
          return res.status(404).json({ message: "Item not found" });
        }

        // Delete in order: transactions, accounts, cursors, items
        await db
          .delete(plaidTransactions)
          .where(eq(plaidTransactions.itemId, itemId));
        await db.delete(plaidAccounts).where(eq(plaidAccounts.itemId, itemId));
        await db.delete(plaidCursors).where(eq(plaidCursors.itemId, itemId));
        await db.delete(plaidItems).where(eq(plaidItems.itemId, itemId));

        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting plaid item:", error);
        res.status(500).json({ message: "Failed to unlink account" });
      }
    },
  );

  // F) Get account summaries grouped by institution
  app.get(
    "/api/admin/plaid/account-summaries",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);

        // Get all items for this admin
        const items = await db
          .select()
          .from(plaidItems)
          .where(eq(plaidItems.adminUserId, userId!));

        const result = await Promise.all(
          items.map(async (item) => {
            // Get accounts for this item
            const accounts = await db
              .select()
              .from(plaidAccounts)
              .where(eq(plaidAccounts.itemId, item.itemId));

            // Get last sync time
            const cursor = await db
              .select()
              .from(plaidCursors)
              .where(eq(plaidCursors.itemId, item.itemId))
              .limit(1);

            return {
              item_id: item.itemId,
              institution_name: item.institutionName,
              last_sync_at: cursor[0]?.lastSyncAt || null,
              accounts: accounts.map((acc) => ({
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
          }),
        );

        res.json(result);
      } catch (error) {
        console.error("Error fetching account summaries:", error);
        res.status(500).json({ message: "Failed to fetch account summaries" });
      }
    },
  );

  // G) Get transactions for a specific Plaid account
  app.get(
    "/api/admin/plaid/accounts/:plaidAccountId/transactions",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { plaidAccountId } = req.params;
        const { start_date, end_date, search, min_amount, max_amount } =
          req.query;

        // Default to last 30 days
        const endDate = end_date ? new Date(end_date as string) : new Date();
        const startDate = start_date
          ? new Date(start_date as string)
          : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Verify admin owns this account
        const account = await db
          .select({
            accountId: plaidAccounts.accountId,
            itemId: plaidAccounts.itemId,
            name: plaidAccounts.name,
            mask: plaidAccounts.mask,
            type: plaidAccounts.type,
            subtype: plaidAccounts.subtype,
            currentBalanceCents: plaidAccounts.currentBalanceCents,
            availableBalanceCents: plaidAccounts.availableBalanceCents,
            defaultFinanceType: plaidAccounts.defaultFinanceType,
          })
          .from(plaidAccounts)
          .innerJoin(plaidItems, eq(plaidAccounts.itemId, plaidItems.itemId))
          .where(
            and(
              eq(plaidAccounts.plaidAccountId, plaidAccountId),
              eq(plaidItems.adminUserId, userId!),
            ),
          )
          .limit(1);

        if (account.length === 0) {
          return res.status(404).json({ message: "Account not found" });
        }

        // Get item info for institution name
        const item = await db
          .select()
          .from(plaidItems)
          .where(eq(plaidItems.itemId, account[0].itemId))
          .limit(1);

        // Get cursor for last sync time
        const cursor = await db
          .select()
          .from(plaidCursors)
          .where(eq(plaidCursors.itemId, account[0].itemId))
          .limit(1);

        // Build query conditions
        let conditions = [
          eq(plaidTransactions.plaidAccountId, plaidAccountId),
          gte(plaidTransactions.date, startDate.toISOString().split("T")[0]),
          lte(plaidTransactions.date, endDate.toISOString().split("T")[0]),
        ];

        // Add search filter
        if (search) {
          const searchTerm = `%${search}%`;
          conditions.push(
            or(
              ilike(plaidTransactions.name, searchTerm),
              ilike(plaidTransactions.merchantName, searchTerm),
            )!,
          );
        }

        // Add amount filters
        if (min_amount) {
          conditions.push(
            gte(
              plaidTransactions.amountCents,
              Math.round(parseFloat(min_amount as string) * 100),
            ),
          );
        }
        if (max_amount) {
          conditions.push(
            lte(
              plaidTransactions.amountCents,
              Math.round(parseFloat(max_amount as string) * 100),
            ),
          );
        }

        const transactions = await db
          .select()
          .from(plaidTransactions)
          .where(and(...conditions))
          .orderBy(desc(plaidTransactions.date));

        const accountDefault = account[0].defaultFinanceType;
        res.json({
          account: {
            ...account[0],
            institution_name: item[0]?.institutionName,
            last_sync_at: cursor[0]?.lastSyncAt,
            default_finance_type: accountDefault,
          },
          transactions: transactions.map((t) => ({
            transaction_id: t.transactionId,
            date: t.date,
            name: t.name,
            merchant_name: t.merchantName,
            amount_cents: t.amountCents,
            pending: t.pending,
            category_primary: t.categoryPrimary,
            override_finance_type: t.overrideFinanceType,
            effective_finance_type: t.overrideFinanceType || accountDefault || null,
          })),
        });
      } catch (error) {
        console.error("Error fetching account transactions:", error);
        res.status(500).json({ message: "Failed to fetch transactions" });
      }
    },
  );

  // G2) Get transactions for multiple Plaid accounts (for tile drilldowns)
  const bulkTransactionsSchema = z.object({
    plaidAccountIds: z.array(z.string()).min(1, "At least one account ID required"),
    start_date: z.string().optional().refine(
      (val) => !val || !isNaN(Date.parse(val)),
      { message: "Invalid start_date format" }
    ),
    end_date: z.string().optional().refine(
      (val) => !val || !isNaN(Date.parse(val)),
      { message: "Invalid end_date format" }
    ),
    search: z.string().optional(),
  });

  app.post(
    "/api/admin/plaid/accounts/transactions-bulk",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const parseResult = bulkTransactionsSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({ 
            message: "Validation error", 
            errors: parseResult.error.flatten().fieldErrors 
          });
        }

        const { plaidAccountIds, start_date, end_date, search } = parseResult.data;
        const userId = getUserId(req);

        // Default to last 30 days
        const endDate = end_date ? new Date(end_date) : new Date();
        const startDate = start_date
          ? new Date(start_date)
          : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Verify admin owns these accounts
        const accounts = await db
          .select({
            accountId: plaidAccounts.accountId,
            plaidAccountId: plaidAccounts.plaidAccountId,
            itemId: plaidAccounts.itemId,
            name: plaidAccounts.name,
            mask: plaidAccounts.mask,
            type: plaidAccounts.type,
            subtype: plaidAccounts.subtype,
            currentBalanceCents: plaidAccounts.currentBalanceCents,
            availableBalanceCents: plaidAccounts.availableBalanceCents,
            institutionName: plaidItems.institutionName,
            defaultFinanceType: plaidAccounts.defaultFinanceType,
          })
          .from(plaidAccounts)
          .innerJoin(plaidItems, eq(plaidAccounts.itemId, plaidItems.itemId))
          .where(
            and(
              inArray(plaidAccounts.plaidAccountId, plaidAccountIds),
              eq(plaidItems.adminUserId, userId!),
            ),
          );

        if (accounts.length === 0) {
          return res.status(404).json({ message: "No accounts found" });
        }

        // Build query conditions for transactions
        let conditions: any[] = [
          inArray(plaidTransactions.plaidAccountId, plaidAccountIds),
          gte(plaidTransactions.date, startDate.toISOString().split("T")[0]),
          lte(plaidTransactions.date, endDate.toISOString().split("T")[0]),
        ];

        // Add search filter
        if (search) {
          const searchTerm = `%${search}%`;
          conditions.push(
            or(
              ilike(plaidTransactions.name, searchTerm),
              ilike(plaidTransactions.merchantName, searchTerm),
            )!,
          );
        }

        const transactions = await db
          .select()
          .from(plaidTransactions)
          .where(and(...conditions))
          .orderBy(desc(plaidTransactions.date))
          .limit(500);

        // Build a map of account defaults for transaction effective type calculation
        const accountDefaultMap = new Map(
          accounts.map(a => [a.plaidAccountId, a.defaultFinanceType])
        );

        res.json({
          accounts: accounts.map((a) => ({
            account_id: a.accountId,
            plaid_account_id: a.plaidAccountId,
            name: a.name,
            mask: a.mask,
            type: a.type,
            subtype: a.subtype,
            current_balance_cents: a.currentBalanceCents,
            available_balance_cents: a.availableBalanceCents,
            institution_name: a.institutionName,
            default_finance_type: a.defaultFinanceType,
          })),
          transactions: transactions.map((t) => ({
            transaction_id: t.transactionId,
            plaid_account_id: t.plaidAccountId,
            date: t.date,
            name: t.name,
            merchant_name: t.merchantName,
            amount_cents: t.amountCents,
            pending: t.pending,
            category_primary: t.categoryPrimary,
            override_finance_type: t.overrideFinanceType,
            effective_finance_type: t.overrideFinanceType || accountDefaultMap.get(t.plaidAccountId) || null,
          })),
        });
      } catch (error) {
        console.error("Error fetching bulk account transactions:", error);
        res.status(500).json({ message: "Failed to fetch transactions" });
      }
    },
  );

  // G3) Update account default finance type
  const updateAccountTypeSchema = z.object({
    defaultFinanceType: z.enum(["income", "bill", "debt", "holding", "other"]).nullable(),
  });

  app.patch(
    "/api/admin/plaid/accounts/:accountId/default-type",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { accountId } = req.params;
        const parseResult = updateAccountTypeSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({ 
            message: "Validation error", 
            errors: parseResult.error.flatten().fieldErrors 
          });
        }

        const { defaultFinanceType } = parseResult.data;
        const userId = getUserId(req);

        // Verify admin owns this account
        const account = await db
          .select({ accountId: plaidAccounts.accountId })
          .from(plaidAccounts)
          .innerJoin(plaidItems, eq(plaidAccounts.itemId, plaidItems.itemId))
          .where(
            and(
              eq(plaidAccounts.accountId, accountId),
              eq(plaidItems.adminUserId, userId!),
            ),
          );

        if (account.length === 0) {
          return res.status(404).json({ message: "Account not found" });
        }

        await db
          .update(plaidAccounts)
          .set({ 
            defaultFinanceType, 
            updatedAt: new Date() 
          })
          .where(eq(plaidAccounts.accountId, accountId));

        res.json({ success: true, defaultFinanceType });
      } catch (error) {
        console.error("Error updating account default type:", error);
        res.status(500).json({ message: "Failed to update account" });
      }
    },
  );

  // G4) Update transaction override finance type
  const updateTransactionTypeSchema = z.object({
    overrideFinanceType: z.enum(["income", "bill", "debt", "holding", "other"]).nullable(),
  });

  app.patch(
    "/api/admin/plaid/transactions/:transactionId/type",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { transactionId } = req.params;
        const parseResult = updateTransactionTypeSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({ 
            message: "Validation error", 
            errors: parseResult.error.flatten().fieldErrors 
          });
        }

        const { overrideFinanceType } = parseResult.data;
        const userId = getUserId(req);

        // Verify admin owns this transaction
        const transaction = await db
          .select({ transactionId: plaidTransactions.transactionId })
          .from(plaidTransactions)
          .innerJoin(plaidItems, eq(plaidTransactions.itemId, plaidItems.itemId))
          .where(
            and(
              eq(plaidTransactions.transactionId, transactionId),
              eq(plaidItems.adminUserId, userId!),
            ),
          );

        if (transaction.length === 0) {
          return res.status(404).json({ message: "Transaction not found" });
        }

        await db
          .update(plaidTransactions)
          .set({ 
            overrideFinanceType, 
            updatedAt: new Date() 
          })
          .where(eq(plaidTransactions.transactionId, transactionId));

        res.json({ success: true, overrideFinanceType });
      } catch (error) {
        console.error("Error updating transaction type:", error);
        res.status(500).json({ message: "Failed to update transaction" });
      }
    },
  );

  // H) Get Plaid sync status
  app.get(
    "/api/admin/plaid/sync-status",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);

        const items = await db
          .select()
          .from(plaidItems)
          .where(eq(plaidItems.adminUserId, userId!));

        const accounts = await db
          .select()
          .from(plaidAccounts)
          .innerJoin(plaidItems, eq(plaidAccounts.itemId, plaidItems.itemId))
          .where(eq(plaidItems.adminUserId, userId!));

        // Get latest sync time
        let lastSyncAt: Date | null = null;
        for (const item of items) {
          const cursor = await db
            .select()
            .from(plaidCursors)
            .where(eq(plaidCursors.itemId, item.itemId))
            .limit(1);
          if (
            cursor[0]?.lastSyncAt &&
            (!lastSyncAt || cursor[0].lastSyncAt > lastSyncAt)
          ) {
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
    },
  );

  // I) Get Plaid-derived financial totals - With recurrence-based period calculations
  app.get(
    "/api/admin/plaid/finance-totals",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { period = "monthly" } = req.query;
        
        const validPeriods = ["weekly", "biweekly", "monthly", "yearly"];
        const selectedPeriod = validPeriods.includes(period as string) 
          ? (period as TimePeriod) 
          : "monthly";
        
        const daysNum = getPeriodDays(selectedPeriod);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysNum);

        // Get all items for this admin
        const items = await db
          .select()
          .from(plaidItems)
          .where(eq(plaidItems.adminUserId, userId!));

        const itemIds = items.map((i) => i.itemId);

        if (itemIds.length === 0) {
          return res.json({
            income: 0,
            bills: 0,
            debts: 0,
            holdings: 0,
            other: 0,
            period: selectedPeriod,
          });
        }

        // Get all accounts to build default type map
        const accounts = await db
          .select()
          .from(plaidAccounts)
          .where(inArray(plaidAccounts.itemId, itemIds));

        const accountDefaultMap = new Map<string, string | null>();
        accounts.forEach((a) => {
          accountDefaultMap.set(a.plaidAccountId, a.defaultFinanceType);
        });

        // Get recurring groups for this admin
        const groups = await db
          .select()
          .from(plaidRecurringGroups)
          .where(eq(plaidRecurringGroups.adminUserId, userId!));
        
        const groupMap = new Map<string, typeof groups[0]>();
        groups.forEach((g) => {
          groupMap.set(g.groupId, g);
        });

        // Get transactions in date range (start <= date <= today)
        const endDate = new Date().toISOString().split("T")[0];
        const transactions = await db
          .select()
          .from(plaidTransactions)
          .where(
            and(
              gte(
                plaidTransactions.date,
                startDate.toISOString().split("T")[0],
              ),
              lte(plaidTransactions.date, endDate),
              inArray(plaidTransactions.itemId, itemIds),
            ),
          );

        // Calculate effective type and recurrence for each transaction
        // ONLY count transactions with an explicitly assigned type
        const typedTransactions = transactions.map((t) => {
          const group = t.recurringGroupId ? groupMap.get(t.recurringGroupId) : null;
          return {
            ...t,
            effectiveType: t.overrideFinanceType || (group?.financeType) || accountDefaultMap.get(t.plaidAccountId) || null,
            effectiveRecurrence: (t.overrideRecurrence || group?.recurrence || "one_time") as RecurrenceType,
          };
        }).filter((t) => t.effectiveType !== null);

        // Sum by category with recurrence multipliers
        const calculateTotal = (type: string) => {
          return typedTransactions
            .filter((t) => t.effectiveType === type)
            .reduce((sum, t) => {
              const recurrence = t.effectiveRecurrence;
              if (recurrence === "one_time") {
                return sum + Math.abs(t.amountCents);
              }
              const multiplier = getRecurrenceMultiplier(recurrence, selectedPeriod);
              return sum + Math.abs(t.amountCents) * multiplier;
            }, 0);
        };

        res.json({
          income: Math.round(calculateTotal("income")),
          bills: Math.round(calculateTotal("bill")),
          debts: Math.round(calculateTotal("debt")),
          holdings: Math.round(calculateTotal("holding")),
          other: Math.round(calculateTotal("other")),
          period: selectedPeriod,
        });
      } catch (error) {
        console.error("Error fetching finance totals:", error);
        res.status(500).json({ message: "Failed to fetch finance totals" });
      }
    },
  );

  // I2) Get typed Plaid transactions by category
  app.get(
    "/api/admin/plaid/typed-transactions",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { category, days = "30" } = req.query;

        if (!category || typeof category !== "string") {
          return res.status(400).json({ message: "Category is required" });
        }

        // Map tab names to finance type values
        const categoryToType: Record<string, string> = {
          income: "income",
          bills: "bill",
          debts: "debt",
          holdings: "holding",
          other: "other",
        };

        const financeType = categoryToType[category];
        if (!financeType) {
          return res.status(400).json({ message: "Invalid category" });
        }

        const daysNum = parseInt(days as string) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysNum);

        // Get all items for this admin
        const items = await db
          .select()
          .from(plaidItems)
          .where(eq(plaidItems.adminUserId, userId!));

        const itemIds = items.map((i) => i.itemId);

        if (itemIds.length === 0) {
          return res.json({ transactions: [] });
        }

        // Build institution name map from items
        const institutionNameMap = new Map<string, string | null>();
        items.forEach((i) => {
          institutionNameMap.set(i.itemId, i.institutionName);
        });

        // Get all accounts to build default type map and name map
        const accounts = await db
          .select()
          .from(plaidAccounts)
          .where(inArray(plaidAccounts.itemId, itemIds));

        const accountDefaultMap = new Map<string, string | null>();
        const accountNameMap = new Map<string, { name: string; institutionName: string | null; itemId: string }>();
        accounts.forEach((a) => {
          accountDefaultMap.set(a.plaidAccountId, a.defaultFinanceType);
          accountNameMap.set(a.plaidAccountId, { 
            name: a.name, 
            institutionName: institutionNameMap.get(a.itemId) || null,
            itemId: a.itemId
          });
        });

        // Get transactions in date range (start <= date <= today)
        const endDate = new Date().toISOString().split("T")[0];
        const transactions = await db
          .select()
          .from(plaidTransactions)
          .where(
            and(
              gte(
                plaidTransactions.date,
                startDate.toISOString().split("T")[0],
              ),
              lte(plaidTransactions.date, endDate),
              inArray(plaidTransactions.itemId, itemIds),
            ),
          )
          .orderBy(sql`${plaidTransactions.date} DESC`);

        // Filter to only transactions with matching effective type
        const typedTransactions = transactions
          .map((t) => ({
            ...t,
            effectiveType: t.overrideFinanceType || accountDefaultMap.get(t.plaidAccountId) || null,
          }))
          .filter((t) => t.effectiveType === financeType)
          .map((t) => {
            const accountInfo = accountNameMap.get(t.plaidAccountId);
            return {
              transaction_id: t.transactionId,
              plaid_account_id: t.plaidAccountId,
              account_name: accountInfo?.name || "Unknown Account",
              institution_name: accountInfo?.institutionName || null,
              date: t.date,
              name: t.name,
              merchant_name: t.merchantName,
              amount_cents: t.amountCents,
              pending: t.pending,
              effective_type: t.effectiveType,
              override_recurrence: t.overrideRecurrence || null,
            };
          });

        res.json({ transactions: typedTransactions });
      } catch (error) {
        console.error("Error fetching typed transactions:", error);
        res.status(500).json({ message: "Failed to fetch typed transactions" });
      }
    },
  );

  // J) Spending summary for charts
  app.get(
    "/api/admin/plaid/spending-summary",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { days = "30" } = req.query;

        const daysNum = parseInt(days as string) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysNum);

        const items = await db
          .select()
          .from(plaidItems)
          .where(eq(plaidItems.adminUserId, userId!));

        const itemIds = items.map((i) => i.itemId);

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

        const transactions = await db
          .select()
          .from(plaidTransactions)
          .where(
            and(
              gte(
                plaidTransactions.date,
                startDate.toISOString().split("T")[0],
              ),
              inArray(plaidTransactions.itemId, itemIds),
            ),
          )
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
            categoryMap.set(
              category,
              (categoryMap.get(category) || 0) + txn.amountCents,
            );
            merchantMap.set(
              merchant,
              (merchantMap.get(merchant) || 0) + txn.amountCents,
            );
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
    },
  );

  // ============================================
  // FINANCE ENTRIES (Manual/Linked)
  // ============================================

  // Get all finance entries for admin (optionally filter by clientId)
  app.get(
    "/api/admin/finance-entries",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { category_group, clientId } = req.query;

        let conditions = [eq(financeEntries.adminUserId, userId!)];

        if (category_group) {
          conditions.push(
            eq(financeEntries.categoryGroup, category_group as string),
          );
        }

        if (clientId) {
          conditions.push(eq(financeEntries.clientId, clientId as string));
        }

        const entries = await db
          .select()
          .from(financeEntries)
          .where(and(...conditions))
          .orderBy(desc(financeEntries.date));

        res.json(entries);
      } catch (error) {
        console.error("Error fetching finance entries:", error);
        res.status(500).json({ message: "Failed to fetch finance entries" });
      }
    },
  );

  // Create finance entry
  app.post(
    "/api/admin/finance-entries",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
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

        const entry = await db
          .select()
          .from(financeEntries)
          .where(eq(financeEntries.entryId, entryId))
          .limit(1);

        res.status(201).json(entry[0]);
      } catch (error) {
        console.error("Error creating finance entry:", error);
        res.status(500).json({ message: "Failed to create finance entry" });
      }
    },
  );

  // Delete finance entry
  app.delete(
    "/api/admin/finance-entries/:entryId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { entryId } = req.params;

        const entry = await db
          .select()
          .from(financeEntries)
          .where(
            and(
              eq(financeEntries.entryId, entryId),
              eq(financeEntries.adminUserId, userId!),
            ),
          )
          .limit(1);

        if (entry.length === 0) {
          return res.status(404).json({ message: "Entry not found" });
        }

        await db
          .delete(financeEntries)
          .where(eq(financeEntries.entryId, entryId));

        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting finance entry:", error);
        res.status(500).json({ message: "Failed to delete finance entry" });
      }
    },
  );

  // Get all Plaid accounts for dropdown selection
  app.get(
    "/api/admin/plaid/all-accounts",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);

        const accounts = await db
          .select({
            accountId: plaidAccounts.accountId,
            plaidAccountId: plaidAccounts.plaidAccountId,
            name: plaidAccounts.name,
            mask: plaidAccounts.mask,
            type: plaidAccounts.type,
            subtype: plaidAccounts.subtype,
            currentBalanceCents: plaidAccounts.currentBalanceCents,
            availableBalanceCents: plaidAccounts.availableBalanceCents,
            defaultFinanceType: plaidAccounts.defaultFinanceType,
            institutionName: plaidItems.institutionName,
          })
          .from(plaidAccounts)
          .innerJoin(plaidItems, eq(plaidAccounts.itemId, plaidItems.itemId))
          .where(eq(plaidItems.adminUserId, userId!));

        res.json(accounts);
      } catch (error) {
        console.error("Error fetching all accounts:", error);
        res.status(500).json({ message: "Failed to fetch accounts" });
      }
    },
  );

  // ============================================
  // PLAID TRANSACTION RECURRENCE & GROUPING
  // ============================================

  // Update Plaid transaction recurrence
  app.patch(
    "/api/admin/plaid/transactions/:transactionId/recurrence",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { transactionId } = req.params;
        const { recurrence } = req.body;

        const validRecurrences = ["one_time", "weekly", "biweekly", "monthly", "yearly", null];
        if (!validRecurrences.includes(recurrence)) {
          return res.status(400).json({ message: "Invalid recurrence value" });
        }

        await db
          .update(plaidTransactions)
          .set({ 
            overrideRecurrence: recurrence,
            updatedAt: new Date() 
          })
          .where(eq(plaidTransactions.transactionId, transactionId));

        res.json({ success: true, overrideRecurrence: recurrence });
      } catch (error) {
        console.error("Error updating transaction recurrence:", error);
        res.status(500).json({ message: "Failed to update transaction recurrence" });
      }
    },
  );

  // Get all recurring groups for admin
  app.get(
    "/api/admin/plaid/recurring-groups",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);

        const groups = await db
          .select()
          .from(plaidRecurringGroups)
          .where(eq(plaidRecurringGroups.adminUserId, userId!))
          .orderBy(desc(plaidRecurringGroups.createdAt));

        res.json(groups);
      } catch (error) {
        console.error("Error fetching recurring groups:", error);
        res.status(500).json({ message: "Failed to fetch recurring groups" });
      }
    },
  );

  // Create recurring group
  app.post(
    "/api/admin/plaid/recurring-groups",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { label, recurrence, financeType, transactionIds } = req.body;

        if (!label || !recurrence) {
          return res.status(400).json({ message: "Label and recurrence are required" });
        }

        const groupId = generateRecurringGroupId();

        await db.insert(plaidRecurringGroups).values({
          groupId,
          adminUserId: userId!,
          label,
          recurrence,
          financeType: financeType || null,
          isActive: true,
        });

        // Link transactions to the group if provided
        if (transactionIds && Array.isArray(transactionIds) && transactionIds.length > 0) {
          for (const txnId of transactionIds) {
            await db
              .update(plaidTransactions)
              .set({ recurringGroupId: groupId, updatedAt: new Date() })
              .where(eq(plaidTransactions.transactionId, txnId));
          }
        }

        const group = await db
          .select()
          .from(plaidRecurringGroups)
          .where(eq(plaidRecurringGroups.groupId, groupId))
          .limit(1);

        res.status(201).json(group[0]);
      } catch (error) {
        console.error("Error creating recurring group:", error);
        res.status(500).json({ message: "Failed to create recurring group" });
      }
    },
  );

  // Update recurring group
  app.patch(
    "/api/admin/plaid/recurring-groups/:groupId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { groupId } = req.params;
        const { label, recurrence, financeType, isActive } = req.body;

        const updates: any = { updatedAt: new Date() };
        if (label !== undefined) updates.label = label;
        if (recurrence !== undefined) updates.recurrence = recurrence;
        if (financeType !== undefined) updates.financeType = financeType;
        if (isActive !== undefined) updates.isActive = isActive;

        await db
          .update(plaidRecurringGroups)
          .set(updates)
          .where(
            and(
              eq(plaidRecurringGroups.groupId, groupId),
              eq(plaidRecurringGroups.adminUserId, userId!),
            ),
          );

        const group = await db
          .select()
          .from(plaidRecurringGroups)
          .where(eq(plaidRecurringGroups.groupId, groupId))
          .limit(1);

        res.json(group[0]);
      } catch (error) {
        console.error("Error updating recurring group:", error);
        res.status(500).json({ message: "Failed to update recurring group" });
      }
    },
  );

  // Add/remove transactions from a group
  app.post(
    "/api/admin/plaid/recurring-groups/:groupId/transactions",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { groupId } = req.params;
        const { transactionIds, action } = req.body;

        if (!transactionIds || !Array.isArray(transactionIds)) {
          return res.status(400).json({ message: "transactionIds array is required" });
        }

        if (action === "remove") {
          for (const txnId of transactionIds) {
            await db
              .update(plaidTransactions)
              .set({ recurringGroupId: null, updatedAt: new Date() })
              .where(eq(plaidTransactions.transactionId, txnId));
          }
        } else {
          for (const txnId of transactionIds) {
            await db
              .update(plaidTransactions)
              .set({ recurringGroupId: groupId, updatedAt: new Date() })
              .where(eq(plaidTransactions.transactionId, txnId));
          }
        }

        res.json({ success: true });
      } catch (error) {
        console.error("Error updating group transactions:", error);
        res.status(500).json({ message: "Failed to update group transactions" });
      }
    },
  );

  // Detect recurring patterns in Plaid transactions
  app.get(
    "/api/admin/plaid/detect-recurring",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);

        const items = await db
          .select()
          .from(plaidItems)
          .where(eq(plaidItems.adminUserId, userId!));

        const itemIds = items.map((i) => i.itemId);

        if (itemIds.length === 0) {
          return res.json({ suggestions: [] });
        }

        // Get all transactions from last 90 days for pattern detection
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);

        const transactions = await db
          .select()
          .from(plaidTransactions)
          .where(
            and(
              gte(plaidTransactions.date, startDate.toISOString().split("T")[0]),
              inArray(plaidTransactions.itemId, itemIds),
            ),
          )
          .orderBy(desc(plaidTransactions.date));

        // Group by merchant and amount for pattern detection
        const patternMap = new Map<string, { dates: string[]; amount: number; name: string; merchantName: string | null }>();

        for (const txn of transactions) {
          const key = `${txn.merchantName || txn.name}_${Math.abs(txn.amountCents)}`;
          const existing = patternMap.get(key);
          if (existing) {
            existing.dates.push(txn.date);
          } else {
            patternMap.set(key, {
              dates: [txn.date],
              amount: txn.amountCents,
              name: txn.name,
              merchantName: txn.merchantName,
            });
          }
        }

        // Analyze patterns
        const suggestions: Array<{
          merchantName: string;
          name: string;
          amountCents: number;
          occurrences: number;
          detectedRecurrence: string;
          confidence: "low" | "medium" | "high";
          avgDaysBetween: number;
        }> = [];

        for (const [key, data] of Array.from(patternMap.entries())) {
          if (data.dates.length < 2) continue;

          // Calculate average days between occurrences
          const sortedDates = data.dates
            .map((d: string) => new Date(d).getTime())
            .sort((a: number, b: number) => a - b);
          
          let totalDays = 0;
          for (let i = 1; i < sortedDates.length; i++) {
            totalDays += (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
          }
          const avgDays = totalDays / (sortedDates.length - 1);

          let detectedRecurrence = "one_time";
          let confidence: "low" | "medium" | "high" = "low";

          if (avgDays >= 5 && avgDays <= 9) {
            detectedRecurrence = "weekly";
            confidence = avgDays >= 6 && avgDays <= 8 ? "high" : "medium";
          } else if (avgDays >= 12 && avgDays <= 16) {
            detectedRecurrence = "biweekly";
            confidence = avgDays >= 13 && avgDays <= 15 ? "high" : "medium";
          } else if (avgDays >= 27 && avgDays <= 33) {
            detectedRecurrence = "monthly";
            confidence = avgDays >= 29 && avgDays <= 31 ? "high" : "medium";
          } else if (avgDays >= 350 && avgDays <= 380) {
            detectedRecurrence = "yearly";
            confidence = avgDays >= 360 && avgDays <= 370 ? "high" : "medium";
          }

          if (detectedRecurrence !== "one_time" && data.dates.length >= 2) {
            suggestions.push({
              merchantName: data.merchantName || data.name,
              name: data.name,
              amountCents: data.amount,
              occurrences: data.dates.length,
              detectedRecurrence,
              confidence,
              avgDaysBetween: Math.round(avgDays),
            });
          }
        }

        // Sort by confidence and occurrences
        suggestions.sort((a, b) => {
          const confOrder = { high: 0, medium: 1, low: 2 };
          if (confOrder[a.confidence] !== confOrder[b.confidence]) {
            return confOrder[a.confidence] - confOrder[b.confidence];
          }
          return b.occurrences - a.occurrences;
        });

        res.json({ suggestions: suggestions.slice(0, 20) });
      } catch (error) {
        console.error("Error detecting recurring patterns:", error);
        res.status(500).json({ message: "Failed to detect recurring patterns" });
      }
    },
  );

  // ============================================
  // FINANCE ENTRY EDITING
  // ============================================

  // Update finance entry
  app.patch(
    "/api/admin/finance-entries/:entryId",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const { entryId } = req.params;
        const { title, amountCents, date, recurrence, categoryGroup, notes, clientId } = req.body;

        // Verify ownership
        const existing = await db
          .select()
          .from(financeEntries)
          .where(
            and(
              eq(financeEntries.entryId, entryId),
              eq(financeEntries.adminUserId, userId!),
            ),
          )
          .limit(1);

        if (existing.length === 0) {
          return res.status(404).json({ message: "Entry not found" });
        }

        const updates: any = { updatedAt: new Date() };
        if (title !== undefined) updates.title = title;
        if (amountCents !== undefined) updates.amountCents = amountCents;
        if (date !== undefined) updates.date = date;
        if (recurrence !== undefined) updates.recurrence = recurrence;
        if (categoryGroup !== undefined) updates.categoryGroup = categoryGroup;
        if (notes !== undefined) updates.notes = notes;
        if (clientId !== undefined) updates.clientId = clientId;

        await db
          .update(financeEntries)
          .set(updates)
          .where(eq(financeEntries.entryId, entryId));

        const entry = await db
          .select()
          .from(financeEntries)
          .where(eq(financeEntries.entryId, entryId))
          .limit(1);

        res.json(entry[0]);
      } catch (error) {
        console.error("Error updating finance entry:", error);
        res.status(500).json({ message: "Failed to update finance entry" });
      }
    },
  );

  return httpServer;
}
