# Quick IT Projects - Payment & Finance Management Portal

## Overview
A full-stack payment and finance management portal with dual interfaces (Admin and Client portals). The system uses Replit Auth for authentication, PostgreSQL for data persistence, and Object Storage for document management.

## Key Features
- **Admin Portal**: Manage clients, leases, invoices, payments, documents, and invite codes
- **Client Portal**: View dashboard, invoices, payments, and documents
- **Invite-Only Registration**: Clients receive magic numbers (e.g., "ABCD-1234") to create accounts
- **PDF Quick-View**: Inline PDF preview modal for documents with fallback error handling
- **Documents Organization**: Documents grouped by client with Invoices/Other sub-folders
- **Finance Entries**: Admin can assign bills/expenses to clients; clients view read-only
- **Client Billing Items**: Per-client charges (rent/other) with frequency tracking (one_time, weekly, monthly, yearly)
- **Lease Status Management**: Status dropdown (active, paused, inactive, behind) with color-coded badges
- **Admin Impersonation**: Admins can view client portal using `?asClientId={clientId}` query parameter
- **Derived Income**: Finance Tracker shows monthly rent income from client billing items
- **Period-Based Recurrence System**: Global time frame selector (weekly, bi-weekly, monthly, yearly) applies multipliers to calculate accurate totals
- **Plaid Transaction Types**: Transactions can be categorized by finance type (income, bill, debt, holding, other) with override support
- **Recurring Groups**: Related Plaid transactions can be grouped with shared labels and recurrence patterns

## Tech Stack
- **Frontend**: React with Vite, TailwindCSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect)
- **Storage**: Replit Object Storage for documents

## Project Structure
```
├── client/src/          # Frontend React application
│   ├── components/      # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and API client
│   └── pages/           # Route pages (admin/, client/, auth/)
├── server/              # Backend Express server
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API route handlers
│   ├── storage.ts       # Database operations interface
│   ├── db.ts            # Database connection
│   └── seed.ts          # Database seed script
└── shared/
    └── schema.ts        # Drizzle schema and types
```

## Database Tables
1. **users_profile** - User accounts (linked to Replit Auth)
2. **clients** - Client business records (includes status: active/paused/inactive/behind)
3. **leases** - Lease agreements
4. **invite_codes** - Magic numbers for client registration
5. **invoices** - Invoice records
6. **payments** - Payment transactions
7. **documents** - Document metadata (files in Object Storage)
8. **external_accounts** - External financial accounts
9. **plaid_items** - Linked Plaid institutions (admin only)
10. **plaid_accounts** - Accounts from linked institutions
11. **plaid_transactions** - Transactions synced from Plaid
12. **plaid_cursors** - Sync cursors for transactions
13. **client_billing_items** - Per-client charges (rent/other) with frequency tracking

## Authentication Flow
1. Users authenticate via Replit Auth (/api/login)
2. First-time users must register with a magic number (/auth/register)
3. The magic number links their account to an existing client profile
4. Admins are created via bootstrap endpoint (POST /api/admin/bootstrap)

## Admin Bootstrap
To create the first admin user:
1. Login with Replit Auth
2. POST to `/api/admin/bootstrap` with `{ "secret": "SETUP_ADMIN_2024" }`
3. Your account becomes an admin

## Test Data
Run `npx tsx server/seed.ts` to populate test data:
- 4 clients with leases and invoices
- Invite codes for testing client registration

### Test Invite Codes
- Sarah Miller: M9YD-EE26
- James Chen: SBXC-VS7U
- Emily Johnson: 88WF-88W4
- Michael Stark: ZF95-MJ2P

## API Endpoints

### Auth
- GET `/api/auth/user` - Get current user
- POST `/api/admin/bootstrap` - Bootstrap admin user

### Admin Endpoints (requires admin role)
- GET/POST `/api/admin/clients` - List/create clients
- GET/PUT/DELETE `/api/admin/clients/:id` - Manage single client
- PATCH `/api/admin/clients/:id/status` - Update client status (active/paused/inactive/behind)
- GET/POST/DELETE `/api/admin/clients/:id/billing-items` - Manage client billing items
- GET `/api/admin/billing-items` - Get all billing items (for derived income)
- GET/POST `/api/admin/leases` - List/create leases
- GET/POST `/api/admin/invoices` - List/create invoices
- GET/POST `/api/admin/payments` - List/create payments
- GET/POST `/api/admin/documents` - List/upload documents
- GET/POST `/api/admin/invite-codes` - List/create invite codes
- GET `/api/admin/stats` - Dashboard statistics

### Plaid Integration (Admin Only)
- POST `/api/admin/plaid/link-token` - Create Plaid Link token
- POST `/api/admin/plaid/exchange` - Exchange public token, fetch accounts/transactions
- POST `/api/admin/plaid/sync` - Sync transactions for all linked items
- GET `/api/admin/plaid/items` - List linked institutions
- DELETE `/api/admin/plaid/items/:itemId` - Unlink an institution
- GET `/api/admin/plaid/account-summaries` - Get account balances grouped by institution

### Client Endpoints (requires client role, supports admin impersonation via ?asClientId={id})
- GET `/api/client/dashboard` - Client dashboard data
- GET `/api/client/invoices` - Client's invoices
- GET `/api/client/payments` - Client's payments
- GET `/api/client/documents` - Client's documents
- GET `/api/client/finance-entries` - Client's assigned finance entries
- POST `/api/client/payments` - Make a payment

### Public
- POST `/api/register/claim` - Claim invite code during registration

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `SESSION_SECRET` - Session encryption key
- `REPL_ID` - Replit environment ID (auto-configured)
- Object Storage environment variables (auto-configured)
- `PLAID_CLIENT_ID` - Plaid API client ID
- `PLAID_SECRET` - Plaid API secret
- `PLAID_ENV` - Plaid environment (sandbox, development, production)

## Development Notes
- All monetary amounts are stored in cents (integer) to avoid floating point issues
- Document uploads use multer middleware and presigned URLs for Object Storage
- Role-based middleware (isAdmin, isClient) protects routes appropriately
