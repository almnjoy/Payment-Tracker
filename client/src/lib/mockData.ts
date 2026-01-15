// Placeholder Data for the Prototype

export const MOCK_USER = {
  name: "Sarah Miller",
  email: "sarah.miller@example.com",
  phone: "+1 (555) 123-4567",
  avatar: "https://i.pravatar.cc/150?u=sarah",
  role: "client" // or 'admin'
};

export const MOCK_CLIENT_DASHBOARD = {
  amountDue: 1250.00,
  lastPaymentDate: "2025-12-15",
  lastPaymentAmount: 1250.00,
  leaseAgreement: "Unit 402 - 12 Month Lease",
  nextDueDate: "2026-01-15",
};

export const MOCK_PAYMENTS = [
  { id: "INV-2024-001", date: "2025-12-15", amount: 1250.00, status: "paid", description: "December Rent" },
  { id: "INV-2024-002", date: "2025-11-15", amount: 1250.00, status: "paid", description: "November Rent" },
  { id: "INV-2024-003", date: "2025-10-15", amount: 1250.00, status: "paid", description: "October Rent" },
  { id: "INV-2024-004", date: "2025-09-15", amount: 1250.00, status: "paid", description: "September Rent" },
];

export const MOCK_DOCUMENTS = [
  { id: 1, name: "Lease_Agreement_2025.pdf", type: "contract", date: "2025-01-01", size: "2.4 MB" },
  { id: 2, name: "Rent_Receipt_Dec_2025.pdf", type: "receipt", date: "2025-12-15", size: "156 KB" },
  { id: 3, name: "Maintenance_Notice_Nov.pdf", type: "notice", date: "2025-11-10", size: "450 KB" },
];

export const MOCK_ADMIN_STATS = {
  totalCollected: 145000.00,
  outstandingBalance: 12500.00,
  overdueCount: 3,
  activeClients: 42,
};

export const MOCK_CLIENTS = [
  { id: 1, name: "Sarah Miller", email: "sarah@example.com", status: "active", amountOwed: 1250.00, lastPaid: "2025-12-15" },
  { id: 2, name: "James Chen", email: "james@example.com", status: "active", amountOwed: 0.00, lastPaid: "2026-01-01" },
  { id: 3, name: "Emily Johnson", email: "emily@example.com", status: "overdue", amountOwed: 2500.00, lastPaid: "2025-11-15" },
  { id: 4, name: "Michael Stark", email: "michael@example.com", status: "active", amountOwed: 0.00, lastPaid: "2026-01-02" },
  { id: 5, name: "Jessica Wu", email: "jessica@example.com", status: "inactive", amountOwed: 0.00, lastPaid: "2025-08-15" },
];

export const MOCK_RECENT_ACTIVITY = [
  { id: 1, type: "payment", user: "James Chen", amount: 1250.00, time: "2 hours ago" },
  { id: 2, type: "invoice", user: "System", amount: 1250.00, time: "4 hours ago", message: "Generated monthly invoices" },
  { id: 3, type: "alert", user: "Emily Johnson", message: "Payment overdue by 3 days", time: "1 day ago" },
  { id: 4, type: "document", user: "Admin", message: "Uploaded new policy update", time: "2 days ago" },
];

// NEW MOCK DATA FOR FINANCE FEATURES

export const MOCK_EXTERNAL_ACCOUNTS = [
  { id: 1, provider: "Plaid", name: "Main Checking", type: "checking", balance: 12450.00, status: "Linked", lastSync: "2 mins ago", change: "+1.2%" },
  { id: 2, provider: "Stripe", name: "Client Payments", type: "payments", balance: 45200.00, status: "Linked", lastSync: "5 mins ago", change: "+5.4%" },
  { id: 3, provider: "Chase (Mock)", name: "Business Savings", type: "savings", balance: 85000.00, status: "Linked", lastSync: "1 hour ago", change: "+0.5%" },
  { id: 4, provider: "Vanguard (Mock)", name: "Investment Portfolio", type: "brokerage", balance: 120500.00, status: "Needs Auth", lastSync: "2 days ago", change: "-1.1%" },
];

export const MOCK_SPENDING_CATEGORIES = [
  { name: "Operations", value: 35 },
  { name: "Payroll", value: 45 },
  { name: "Marketing", value: 10 },
  { name: "Software", value: 5 },
  { name: "Misc", value: 5 },
];

export const MOCK_TRANSACTIONS = [
  { id: 1, merchant: "AWS Web Services", date: "2026-01-14", amount: 450.00, category: "Software" },
  { id: 2, merchant: "WeWork Office", date: "2026-01-12", amount: 2200.00, category: "Operations" },
  { id: 3, merchant: "Facebook Ads", date: "2026-01-10", amount: 1500.00, category: "Marketing" },
  { id: 4, merchant: "Gusto Payroll", date: "2026-01-01", amount: 12500.00, category: "Payroll" },
  { id: 5, merchant: "Slack", date: "2026-01-05", amount: 25.00, category: "Software" },
];

export const MOCK_FINANCE_ENTRIES = {
  income: [
    { id: 1, name: "Client Retainers", amount: 15000.00, date: "2026-01-01", recurring: "Monthly" },
    { id: 2, name: "Project X Milestone", amount: 5000.00, date: "2026-01-12", recurring: "One-time" },
  ],
  bills: [
    { id: 1, name: "Office Rent", amount: 2200.00, date: "2026-01-01", recurring: "Monthly" },
    { id: 2, name: "Internet", amount: 150.00, date: "2026-01-05", recurring: "Monthly" },
  ],
  debts: [
    { id: 1, name: "Business Loan", amount: 50000.00, date: "2025-06-01", recurring: "Monthly Payment: $1200" },
  ],
  holdings: [
    { id: 1, name: "Tech ETF", amount: 25000.00, date: "2025-01-01", recurring: "N/A" },
    { id: 2, name: "Crypto Assets", amount: 5000.00, date: "2025-12-01", recurring: "N/A" },
  ]
};
