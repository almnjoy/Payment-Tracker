# Security Documentation

## Authentication Model

### Replit Auth Integration
- Authentication is handled via Replit's OpenID Connect integration
- All authenticated requests include user claims (userId, email, name)
- Session management uses express-session with PostgreSQL store

### Role-Based Access Control (RBAC)
Two roles are supported:
- **admin**: Full access to all admin endpoints and client management
- **client**: Access only to their own data via client portal

### Middleware Stack
```
isAuthenticated  → Verifies user is logged in via Replit Auth
isAdmin          → Verifies user.role === "admin"  
isClient         → Verifies user has linkedClientId OR is admin impersonating
```

## Data Isolation Rules

### Client Data Isolation
- All `/api/client/*` endpoints derive `clientId` from the authenticated user's profile
- **ClientId is NEVER trusted from browser input** (query params, body, headers)
- Database queries always include `WHERE clientId = linkedClientId`
- This prevents Client A from accessing Client B's data

### Server-Derived Client ID
```typescript
function getLinkedClientId(req: Request): string | null {
  const profile = (req as any).userProfile;
  return profile?.clientId || null;
}
```

### Document Access Control
- Admin: Can access all documents
- Client: Can only access documents where:
  - `document.clientId === profile.clientId`
  - `document.visibility === "client_and_admin"`

## Route Security Matrix

### Admin Routes (`/api/admin/*`)
| Endpoint | Auth Required | Admin Only | Rate Limited |
|----------|--------------|------------|--------------|
| `/api/admin/clients` | Yes | Yes | No |
| `/api/admin/payments` | Yes | Yes | No |
| `/api/admin/documents` | Yes | Yes | No |
| `/api/admin/automation-settings` | Yes | Yes | No |
| `/api/admin/test-webhook` | Yes | Yes | **Yes (5/min)** |
| `/api/admin/bootstrap` | Yes | No* | **Yes (10/15min)** |
| `/api/admin/security-test` | Yes | Yes | No |

*Bootstrap requires secret key validation

### Client Routes (`/api/client/*`)
| Endpoint | Auth Required | Client Link Required | Uses Server ClientId |
|----------|--------------|---------------------|---------------------|
| `/api/client/dashboard` | Yes | Yes | Yes |
| `/api/client/invoices` | Yes | Yes | Yes |
| `/api/client/payments` | Yes | Yes | Yes |
| `/api/client/documents` | Yes | Yes | Yes |
| `/api/client/profile` | Yes | Yes | Yes |

### Public/Auth Routes
| Endpoint | Rate Limited | Notes |
|----------|--------------|-------|
| `/api/client-signup/verify` | **Yes (10/15min)** | Prevents enumeration |
| `/api/client-signup/claim` | **Yes (10/15min)** | Prevents brute force |

## Signup Linking Flow (Anti-Leakage)

### Flow
1. Admin creates client record with email
2. Admin generates invite code or client uses Client ID
3. User authenticates via Replit Auth
4. User enters Client ID on signup page
5. Server verifies:
   - Client ID exists
   - User's email matches client record email
   - Client is not already linked to another user
6. Only on match: Server links user profile to client

### Security Controls
- Email verification prevents unauthorized account claims
- One-to-one mapping enforced (one user per client)
- Rate limiting prevents enumeration/brute force

## Webhook Security

### Token Storage
- Webhook tokens stored in database (automation_settings table)
- Tokens never returned to frontend (GET returns `hasXXXToken: boolean` only)
- All webhook requests made server-side only

### Authorization Headers
- Signup Email: `Authorization: Bearer {signupEmailToken}`
- Payment Received: `Authorization: Bearer {paymentReceivedToken}`
- Monthly Summary: `Authorization: Bearer {monthlySummaryToken}`

### Token Exposure Prevention
```typescript
// GET response - tokens not exposed
res.json({
  hasSignupEmailToken: !!(settings.signupEmailToken),
  hasPaymentReceivedToken: !!(settings.paymentReceivedToken),
  // ... actual values never sent
});
```

## Rate Limiting

### Configuration
| Limiter | Window | Max Requests | Applied To |
|---------|--------|--------------|------------|
| authRateLimiter | 15 min | 10 | Signup/claim endpoints |
| sensitiveRateLimiter | 1 min | 30 | Sensitive operations |
| webhookTestRateLimiter | 1 min | 5 | Webhook test endpoints |

### Implementation
```typescript
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}-auth`,
});
```

## Stripe Integration Security

### Checkout Session Creation
- `clientId` derived from authenticated user's profile
- Never accepts `clientId` from request body
- Session metadata includes server-verified clientId

### Checkout Confirmation
- Retrieves clientId from Stripe session (not browser)
- Verifies: `profile.clientId === session.client_reference_id`
- Returns 403 if mismatch detected

### Webhook Processing
- Signature verification using Stripe webhook secret
- idempotency key prevents duplicate payment creation
- ClientId extracted from Stripe metadata only

## Logging Hygiene

### Redacted Fields
- Passwords, tokens, secrets, API keys
- Authorization headers
- Webhook tokens (signup, payment, monthly)

### Log Format
```
[Express] METHOD /path STATUS_CODE in XXXms :: {sanitized_response}
```

### PII Minimization
- Log route, status code, IDs only
- Full payloads not logged
- Client names/emails not in routine logs

## Security Self-Test

### Endpoint
```
GET /api/admin/security-test
```

### Tests Performed
1. Admin role enforcement
2. Client ID server-derived (not browser-trusted)
3. Webhook tokens not exposed to frontend
4. Document download verifies client ownership
5. Stripe checkout uses server-derived clientId
6. Stripe confirm-checkout verifies client ownership
7. Rate limiting configured
8. One active agreement per client (server-enforced)

### Response Format
```json
{
  "summary": {
    "total": 8,
    "passed": 8,
    "failed": 0,
    "overallStatus": "SECURE"
  },
  "tests": [...],
  "timestamp": "2024-..."
}
```

## Active Agreement Enforcement

### Server-Side Logic
When setting a document as active agreement:
1. Server calls `clearActiveAgreementForClient(clientId)`
2. Only then sets `isActiveAgreement = true` on new document
3. Ensures exactly one active agreement per client

## Environment Variables

### Secrets (Never Logged)
- `DATABASE_URL` - PostgreSQL connection
- `SESSION_SECRET` - Session encryption
- `STRIPE_SECRET_KEY_TEST` - Stripe API key
- `STRIPE_WEBHOOK_THIN_SECRET_TEST` - Webhook signature
- `PLAID_SECRET` - Plaid API secret
- `ADMIN_BOOTSTRAP_SECRET` - Bootstrap key

### Safe to Log
- `REPL_ID` - Replit instance ID
- `NODE_ENV` - Environment name
