import { db } from "./db";
import {
  clients,
  leases,
  invoices,
  payments,
  inviteCodes,
  generateClientId,
  generateLeaseId,
  generateInvoiceId,
  generatePaymentId,
  generateMagicNumber,
} from "@shared/schema";

async function seed() {
  const organizationId = "org-default";
  console.log("Seeding database...");

  // Create sample clients
  const clientData = [
    { clientId: generateClientId(), displayName: "Sarah Miller", email: "sarah@example.com", phone: "+1 (555) 123-4567", address: "123 Main St, Unit 402, New York, NY 10001" },
    { clientId: generateClientId(), displayName: "James Chen", email: "james@example.com", phone: "+1 (555) 234-5678", address: "456 Oak Ave, Suite 12, San Francisco, CA 94102" },
    { clientId: generateClientId(), displayName: "Emily Johnson", email: "emily@example.com", phone: "+1 (555) 345-6789", address: "789 Pine Rd, Apt 8, Chicago, IL 60601" },
    { clientId: generateClientId(), displayName: "Michael Stark", email: "michael@example.com", phone: "+1 (555) 456-7890", address: "321 Elm Blvd, Unit 15, Austin, TX 78701" },
  ];

  const insertedClients = await db.insert(clients).values(clientData).returning();
  console.log(`Created ${insertedClients.length} clients`);

  // Create leases for each client
  const leaseData = insertedClients.map((client, i) => ({
    leaseId: generateLeaseId(),
    clientId: client.clientId,
    description: `12 Month Lease - Unit ${400 + i}`,
    rentAmountCents: 125000 + (i * 25000), // $1250 - $2000
    dueDay: 1,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    status: "active",
  }));

  const insertedLeases = await db.insert(leases).values(leaseData).returning();
  console.log(`Created ${insertedLeases.length} leases`);

  // Create invoices
  const invoiceData: any[] = [];
  const today = new Date();
  
  insertedClients.forEach((client, clientIndex) => {
    const lease = insertedLeases[clientIndex];
    
    // Past invoices (paid)
    for (let month = 1; month <= 3; month++) {
      invoiceData.push({
        invoiceId: generateInvoiceId(),
        clientId: client.clientId,
        leaseId: lease.leaseId,
        title: `${['January', 'February', 'March'][month-1]} 2025 Rent`,
        amountCents: lease.rentAmountCents,
        dueDate: `2025-0${month}-01`,
        status: "paid",
      });
    }
    
    // Current month invoice (open for some, overdue for one)
    invoiceData.push({
      invoiceId: generateInvoiceId(),
      clientId: client.clientId,
      leaseId: lease.leaseId,
      title: "April 2025 Rent",
      amountCents: lease.rentAmountCents,
      dueDate: "2025-04-01",
      status: clientIndex === 2 ? "overdue" : "open",
    });
  });

  const insertedInvoices = await db.insert(invoices).values(invoiceData).returning();
  console.log(`Created ${insertedInvoices.length} invoices`);

  // Create payments for paid invoices
  const paymentData: any[] = [];
  
  insertedInvoices
    .filter(inv => inv.status === "paid")
    .forEach((invoice) => {
      paymentData.push({
        paymentId: generatePaymentId(),
        clientId: invoice.clientId,
        invoiceId: invoice.invoiceId,
        amountCents: invoice.amountCents,
        method: ["card", "bank_transfer", "check"][Math.floor(Math.random() * 3)],
        status: "paid",
        paidAt: new Date(invoice.dueDate),
      });
    });

  const insertedPayments = await db.insert(payments).values(paymentData).returning();
  console.log(`Created ${insertedPayments.length} payments`);

  // Create invite codes for clients without linked users
  const inviteCodeData = insertedClients.map((client) => ({
    magicNumber: generateMagicNumber(),
    organizationId,
    clientId: client.clientId,
    leaseId: insertedLeases.find(l => l.clientId === client.clientId)?.leaseId,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    createdByUserId: "SEED_SCRIPT",
  }));

  const insertedCodes = await db.insert(inviteCodes).values(inviteCodeData).returning();
  console.log(`Created ${insertedCodes.length} invite codes`);
  
  console.log("\n--- Invite Codes ---");
  insertedCodes.forEach((code, i) => {
    console.log(`${insertedClients[i].displayName}: ${code.magicNumber}`);
  });

  console.log("\nSeeding complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
