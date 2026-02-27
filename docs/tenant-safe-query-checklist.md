# Tenant-Safe Query Checklist

Applies to **all route handlers** (admin and client):

1. Resolve `organizationId` from authenticated context only (`getUserId(req)`), never from body/query/path.
2. For tenant-owned tables (`plaid_*`, `finance_entries`), call storage methods that require `organizationId` in the function signature.
3. Ensure every read/write uses tenant filter columns (`adminUserId`) either directly or through validated parent ownership.
4. Reject/return 404 for cross-tenant IDs before mutating data.

## Inventory: direct `db.select/insert/update/delete` usages in `server/routes.ts`

Current direct query-builder calls (single-line pattern search):

- `server/routes.ts:308` → `db.update(payments)`
- `server/routes.ts:697` → `db.update(clientsTable)`
- `server/routes.ts:701` → `db.update(clientsTable)`

Command used:

```bash
rg -n "db\.(select|insert|update|delete)" server/routes.ts
```
