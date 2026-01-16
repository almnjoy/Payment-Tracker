import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      window.location.href = "/api/login";
      throw new Error("Unauthorized");
    }
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }
  
  return response.json();
}

export interface UserProfile {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profile: {
    userId: string;
    role: string;
    clientId: string | null;
    status: string;
  } | null;
  hasProfile: boolean;
}

export interface Client {
  clientId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  amountOwedCents?: number;
  lastPaymentAt?: string | null;
  status?: string;
}

export interface Lease {
  leaseId: string;
  clientId: string;
  description: string | null;
  rentAmountCents: number;
  dueDay: number;
  startDate: string;
  endDate: string | null;
  status: string;
}

export interface Invoice {
  invoiceId: string;
  clientId: string;
  leaseId: string | null;
  title: string;
  amountCents: number;
  dueDate: string;
  status: string;
  stripeHostedInvoiceUrl?: string | null;
}

export interface Payment {
  paymentId: string;
  clientId: string;
  invoiceId: string | null;
  amountCents: number;
  method: string;
  status: string;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Document {
  documentId: string;
  clientId: string;
  leaseId: string | null;
  invoiceId: string | null;
  title: string;
  docType: string;
  visibility: string;
  contentType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
}

export interface ExternalAccount {
  accountId: string;
  provider: string;
  nickname: string;
  accountType: string | null;
  status: string;
  lastSyncAt: string | null;
}

export interface AdminStats {
  totalCollectedCents: number;
  outstandingCents: number;
  overdueCount: number;
  activeClients: number;
}

export interface ClientDashboard {
  client: Client | null;
  amountDueCents: number;
  nextDueDate: string | null;
  lastPayment: Payment | null;
  activeLease: Lease | null;
  recentDocuments: Document[];
  openInvoicesCount: number;
}

export interface InviteVerifyResponse {
  valid: boolean;
  reason?: string;
  clientDisplayName?: string;
  expiresAt?: string;
}

export interface InviteClaimResponse {
  success: boolean;
  message?: string;
  redirectTo?: string;
}

export function useMe() {
  return useQuery<UserProfile>({
    queryKey: ["me"],
    queryFn: () => fetchApi("/api/me"),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: () => fetchApi("/api/admin/stats"),
  });
}

export function useAdminClients() {
  return useQuery<Client[]>({
    queryKey: ["admin", "clients"],
    queryFn: () => fetchApi("/api/admin/clients"),
  });
}

export function useAdminClient(clientId: string) {
  return useQuery<Client & { leases: Lease[]; invoices: Invoice[]; payments: Payment[]; documents: Document[] }>({
    queryKey: ["admin", "clients", clientId],
    queryFn: () => fetchApi(`/api/admin/clients/${clientId}`),
    enabled: !!clientId,
  });
}

export function useAdminInvoices(clientId?: string) {
  return useQuery<Invoice[]>({
    queryKey: ["admin", "invoices", clientId],
    queryFn: () => fetchApi(`/api/admin/invoices${clientId ? `?clientId=${clientId}` : ""}`),
  });
}

export function useAdminPayments(clientId?: string) {
  return useQuery<Payment[]>({
    queryKey: ["admin", "payments", clientId],
    queryFn: () => fetchApi(`/api/admin/payments${clientId ? `?clientId=${clientId}` : ""}`),
  });
}

export function useAdminDocuments(clientId?: string) {
  return useQuery<Document[]>({
    queryKey: ["admin", "documents", clientId],
    queryFn: () => fetchApi(`/api/admin/documents${clientId ? `?clientId=${clientId}` : ""}`),
  });
}

export function useAdminExternalAccounts() {
  return useQuery<ExternalAccount[]>({
    queryKey: ["admin", "external-accounts"],
    queryFn: () => fetchApi("/api/admin/external-accounts"),
  });
}

export function useClientDashboard() {
  return useQuery<ClientDashboard>({
    queryKey: ["client", "dashboard"],
    queryFn: () => fetchApi("/api/client/dashboard"),
  });
}

export function useClientInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ["client", "invoices"],
    queryFn: () => fetchApi("/api/client/invoices"),
  });
}

export function useClientPayments() {
  return useQuery<Payment[]>({
    queryKey: ["client", "payments"],
    queryFn: () => fetchApi("/api/client/payments"),
  });
}

export function useClientDocuments() {
  return useQuery<Document[]>({
    queryKey: ["client", "documents"],
    queryFn: () => fetchApi("/api/client/documents"),
  });
}

export function useVerifyInvite() {
  return useMutation<InviteVerifyResponse, Error, { magicNumber: string }>({
    mutationFn: (data) => fetchApi("/api/invite/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  });
}

export function useClaimInvite() {
  const queryClient = useQueryClient();
  return useMutation<InviteClaimResponse, Error, { magicNumber: string }>({
    mutationFn: (data) => fetchApi("/api/invite/claim", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useBootstrapAdmin() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { secretKey: string }>({
    mutationFn: (data) => fetchApi("/api/admin/bootstrap", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation<Client, Error, Partial<Client>>({
    mutationFn: (data) => fetchApi("/api/admin/clients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });
    },
  });
}

export function useCreateInviteCode() {
  return useMutation<{ magicNumber: string }, Error, { clientId: string; leaseId?: string; expiresInDays?: number }>({
    mutationFn: (data) => fetchApi("/api/admin/invite-codes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation<Invoice, Error, Partial<Invoice>>({
    mutationFn: (data) => fetchApi("/api/admin/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation<Payment, Error, Partial<Payment>>({
    mutationFn: (data) => fetchApi("/api/admin/payments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Plaid Types
export interface PlaidItem {
  itemId: string;
  institutionName: string | null;
  status: string;
  createdAt: string;
  last_sync_at: string | null;
}

export interface PlaidAccountSummary {
  item_id: string;
  institution_name: string | null;
  last_sync_at: string | null;
  accounts: {
    name: string;
    mask: string | null;
    type: string | null;
    subtype: string | null;
    current_balance_cents: number | null;
    available_balance_cents: number | null;
    iso_currency_code: string | null;
  }[];
}

export interface PlaidSyncResult {
  synced_items: number;
  added: number;
  modified: number;
  removed: number;
}

// Plaid API Hooks
export function useAdminPlaidItems() {
  return useQuery<PlaidItem[]>({
    queryKey: ["admin", "plaid", "items"],
    queryFn: () => fetchApi("/api/admin/plaid/items"),
  });
}

export function useAdminPlaidAccountSummaries() {
  return useQuery<PlaidAccountSummary[]>({
    queryKey: ["admin", "plaid", "account-summaries"],
    queryFn: () => fetchApi("/api/admin/plaid/account-summaries"),
  });
}

export function useCreatePlaidLinkToken() {
  return useMutation<{ link_token: string }, Error>({
    mutationFn: () => fetchApi("/api/admin/plaid/link-token", {
      method: "POST",
    }),
  });
}

export function useExchangePlaidToken() {
  const queryClient = useQueryClient();
  return useMutation<{ item_id: string; institution_name: string }, Error, { public_token: string; institution_id: string; institution_name: string }>({
    mutationFn: (data) => fetchApi("/api/admin/plaid/exchange", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plaid"] });
    },
  });
}

export function useSyncPlaidTransactions() {
  const queryClient = useQueryClient();
  return useMutation<PlaidSyncResult, Error>({
    mutationFn: () => fetchApi("/api/admin/plaid/sync", {
      method: "POST",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plaid"] });
    },
  });
}

export function useDeletePlaidItem() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (itemId) => fetchApi(`/api/admin/plaid/items/${itemId}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plaid"] });
    },
  });
}
