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
  activeAgreement: Document | null;
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

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation<Document, Error, { file: File; title: string; docType: string; visibility: string; clientId?: string }>({
    mutationFn: async ({ file, title, docType, visibility, clientId }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("docType", docType);
      formData.append("visibility", visibility);
      if (clientId) formData.append("clientId", clientId);
      
      const response = await fetch("/api/admin/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(error.message || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "documents"] });
    },
  });
}

export function useToggleActiveAgreement() {
  const queryClient = useQueryClient();
  return useMutation<Document, Error, { documentId: string; isActive: boolean }>({
    mutationFn: async ({ documentId, isActive }) => {
      return fetchApi<Document>(`/api/admin/documents/${documentId}/active-agreement`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "documents"] });
    },
  });
}

export function useAdminExternalAccounts() {
  return useQuery<ExternalAccount[]>({
    queryKey: ["admin", "external-accounts"],
    queryFn: () => fetchApi("/api/admin/external-accounts"),
  });
}

export function useClientDashboard(asClientId?: string) {
  const params = asClientId ? `?asClientId=${asClientId}` : "";
  return useQuery<ClientDashboard>({
    queryKey: ["client", "dashboard", asClientId],
    queryFn: () => fetchApi(`/api/client/dashboard${params}`),
  });
}

export function useClientInvoices(asClientId?: string) {
  const params = asClientId ? `?asClientId=${asClientId}` : "";
  return useQuery<Invoice[]>({
    queryKey: ["client", "invoices", asClientId],
    queryFn: () => fetchApi(`/api/client/invoices${params}`),
  });
}

export function useClientPayments(asClientId?: string) {
  const params = asClientId ? `?asClientId=${asClientId}` : "";
  return useQuery<Payment[]>({
    queryKey: ["client", "payments", asClientId],
    queryFn: () => fetchApi(`/api/client/payments${params}`),
  });
}

export function useClientDocuments(asClientId?: string) {
  const params = asClientId ? `?asClientId=${asClientId}` : "";
  return useQuery<Document[]>({
    queryKey: ["client", "documents", asClientId],
    queryFn: () => fetchApi(`/api/client/documents${params}`),
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
    account_id: string;
    plaid_account_id: string;
    name: string;
    mask: string | null;
    type: string | null;
    subtype: string | null;
    current_balance_cents: number | null;
    available_balance_cents: number | null;
    iso_currency_code: string | null;
  }[];
}

export interface PlaidSyncStatus {
  linked_institutions: number;
  linked_accounts: number;
  last_sync_at: string | null;
}

export type TimePeriod = "weekly" | "biweekly" | "monthly" | "yearly";
export type RecurrenceType = "one_time" | "weekly" | "biweekly" | "monthly" | "yearly";

export interface PlaidFinanceTotals {
  income: number;
  bills: number;
  debts: number;
  holdings: number;
  other: number;
  period: TimePeriod;
}

export interface PlaidRecurringGroup {
  groupId: string;
  adminUserId: string;
  label: string;
  recurrence: string;
  financeType: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringSuggestion {
  merchantName: string;
  name: string;
  amountCents: number;
  occurrences: number;
  detectedRecurrence: string;
  confidence: "low" | "medium" | "high";
  avgDaysBetween: number;
}

export interface TypedPlaidTransaction {
  transaction_id: string;
  plaid_account_id: string;
  account_name: string;
  institution_name: string | null;
  date: string;
  name: string;
  merchant_name: string | null;
  amount_cents: number;
  pending: boolean;
  effective_type: string;
}

export interface PlaidSpendingSummary {
  categories: { name: string; value: number }[];
  top_merchants: { name: string; amount_cents: number }[];
  transaction_count: number;
  net_cash_flow: number;
  total_inflow: number;
  total_outflow: number;
}

export interface PlaidTransaction {
  transaction_id: string;
  date: string;
  name: string;
  merchant_name: string | null;
  amount_cents: number;
  pending: boolean;
  category_primary: string | null;
  override_finance_type: string | null;
  effective_finance_type: string | null;
}

export interface PlaidAccountTransactions {
  account: {
    accountId: string;
    itemId: string;
    name: string;
    mask: string | null;
    type: string | null;
    subtype: string | null;
    currentBalanceCents: number | null;
    availableBalanceCents: number | null;
    institution_name: string | null;
    last_sync_at: string | null;
    default_finance_type: string | null;
  };
  transactions: PlaidTransaction[];
}

export interface PlaidAccountOption {
  accountId: string;
  plaidAccountId: string;
  name: string;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  currentBalanceCents: number | null;
  availableBalanceCents: number | null;
  defaultFinanceType: string | null;
  institutionName: string | null;
}

export interface FinanceEntry {
  entryId: string;
  adminUserId: string;
  clientId: string | null;
  entryType: string;
  categoryGroup: string;
  title: string;
  amountCents: number;
  date: string;
  recurrence: string | null;
  notes: string | null;
  plaidAccountId: string | null;
  externalUrl: string | null;
  createdAt: string;
  updatedAt: string;
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

export function useAdminPlaidSyncStatus() {
  return useQuery<PlaidSyncStatus>({
    queryKey: ["admin", "plaid", "sync-status"],
    queryFn: () => fetchApi("/api/admin/plaid/sync-status"),
  });
}

export function useAdminPlaidFinanceTotals(period: TimePeriod = "monthly") {
  return useQuery<PlaidFinanceTotals>({
    queryKey: ["admin", "plaid", "finance-totals", period],
    queryFn: () => fetchApi(`/api/admin/plaid/finance-totals?period=${period}`),
  });
}

export function useAdminPlaidSpendingSummary(days: number = 30) {
  return useQuery<PlaidSpendingSummary>({
    queryKey: ["admin", "plaid", "spending-summary", days],
    queryFn: () => fetchApi(`/api/admin/plaid/spending-summary?days=${days}`),
  });
}

export function useAdminPlaidTypedTransactions(category: string, period: TimePeriod = "monthly") {
  const periodDays = { weekly: 7, biweekly: 14, monthly: 30, yearly: 365 };
  const days = periodDays[period];
  return useQuery<{ transactions: TypedPlaidTransaction[] }>({
    queryKey: ["admin", "plaid", "typed-transactions", category, period],
    queryFn: () => fetchApi(`/api/admin/plaid/typed-transactions?category=${category}&days=${days}`),
    enabled: !!category,
  });
}

export function useAdminPlaidAccountTransactions(
  plaidAccountId: string | null,
  options?: { startDate?: string; endDate?: string; search?: string; minAmount?: number; maxAmount?: number }
) {
  const params = new URLSearchParams();
  if (options?.startDate) params.append("start_date", options.startDate);
  if (options?.endDate) params.append("end_date", options.endDate);
  if (options?.search) params.append("search", options.search);
  if (options?.minAmount) params.append("min_amount", options.minAmount.toString());
  if (options?.maxAmount) params.append("max_amount", options.maxAmount.toString());
  
  const queryString = params.toString();
  
  return useQuery<PlaidAccountTransactions>({
    queryKey: ["admin", "plaid", "account-transactions", plaidAccountId, options],
    queryFn: () => fetchApi(`/api/admin/plaid/accounts/${plaidAccountId}/transactions${queryString ? `?${queryString}` : ""}`),
    enabled: !!plaidAccountId,
  });
}

export function useAdminPlaidAllAccounts() {
  return useQuery<PlaidAccountOption[]>({
    queryKey: ["admin", "plaid", "all-accounts"],
    queryFn: () => fetchApi("/api/admin/plaid/all-accounts"),
  });
}

export type FinanceType = "income" | "bill" | "debt" | "holding" | "other" | null;

export interface BulkTransactionsResponse {
  accounts: {
    account_id: string;
    plaid_account_id: string;
    name: string;
    mask: string | null;
    type: string | null;
    subtype: string | null;
    current_balance_cents: number | null;
    available_balance_cents: number | null;
    institution_name: string | null;
    default_finance_type: FinanceType;
  }[];
  transactions: {
    transaction_id: string;
    plaid_account_id: string;
    date: string;
    name: string;
    merchant_name: string | null;
    amount_cents: number;
    pending: boolean;
    category_primary: string | null;
    override_finance_type: FinanceType;
    effective_finance_type: FinanceType;
  }[];
}

export function useAdminPlaidBulkTransactions(
  plaidAccountIds: string[],
  options?: { startDate?: string; endDate?: string; search?: string }
) {
  return useQuery<BulkTransactionsResponse>({
    queryKey: ["admin", "plaid", "bulk-transactions", plaidAccountIds, options],
    queryFn: () => fetchApi("/api/admin/plaid/accounts/transactions-bulk", {
      method: "POST",
      body: JSON.stringify({
        plaidAccountIds,
        start_date: options?.startDate,
        end_date: options?.endDate,
        search: options?.search,
      }),
    }),
    enabled: plaidAccountIds.length > 0,
  });
}

export function useUpdateAccountDefaultType() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; defaultFinanceType: FinanceType }, Error, { accountId: string; defaultFinanceType: FinanceType }>({
    mutationFn: ({ accountId, defaultFinanceType }) => fetchApi(`/api/admin/plaid/accounts/${accountId}/default-type`, {
      method: "PATCH",
      body: JSON.stringify({ defaultFinanceType }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plaid"] });
    },
  });
}

export function useUpdateTransactionType() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; overrideFinanceType: FinanceType }, Error, { transactionId: string; overrideFinanceType: FinanceType }>({
    mutationFn: ({ transactionId, overrideFinanceType }) => fetchApi(`/api/admin/plaid/transactions/${transactionId}/type`, {
      method: "PATCH",
      body: JSON.stringify({ overrideFinanceType }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plaid"] });
    },
  });
}

export function useAdminFinanceEntries(categoryGroup?: string, clientId?: string) {
  const params = new URLSearchParams();
  if (categoryGroup) params.append("category_group", categoryGroup);
  if (clientId) params.append("clientId", clientId);
  const queryString = params.toString();
  
  return useQuery<FinanceEntry[]>({
    queryKey: ["admin", "finance-entries", categoryGroup, clientId],
    queryFn: () => fetchApi(`/api/admin/finance-entries${queryString ? `?${queryString}` : ""}`),
  });
}

export function useClientFinanceEntries(asClientId?: string) {
  const params = asClientId ? `?asClientId=${asClientId}` : "";
  return useQuery<FinanceEntry[]>({
    queryKey: ["client", "finance-entries", asClientId],
    queryFn: () => fetchApi(`/api/client/finance-entries${params}`),
  });
}

export function useCreateFinanceEntry() {
  const queryClient = useQueryClient();
  return useMutation<FinanceEntry, Error, Partial<FinanceEntry>>({
    mutationFn: (data) => fetchApi("/api/admin/finance-entries", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-entries"] });
    },
  });
}

export function useDeleteFinanceEntry() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (entryId) => fetchApi(`/api/admin/finance-entries/${entryId}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-entries"] });
    },
  });
}

export function useUpdateFinanceEntry() {
  const queryClient = useQueryClient();
  return useMutation<FinanceEntry, Error, { entryId: string } & Partial<FinanceEntry>>({
    mutationFn: ({ entryId, ...data }) => fetchApi(`/api/admin/finance-entries/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "finance-entries"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "plaid", "finance-totals"] });
    },
  });
}

export function useUpdateTransactionRecurrence() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; overrideRecurrence: RecurrenceType | null }, Error, { transactionId: string; recurrence: RecurrenceType | null }>({
    mutationFn: ({ transactionId, recurrence }) => fetchApi(`/api/admin/plaid/transactions/${transactionId}/recurrence`, {
      method: "PATCH",
      body: JSON.stringify({ recurrence }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plaid"] });
    },
  });
}

export function useAdminRecurringGroups() {
  return useQuery<PlaidRecurringGroup[]>({
    queryKey: ["admin", "plaid", "recurring-groups"],
    queryFn: () => fetchApi("/api/admin/plaid/recurring-groups"),
  });
}

export function useCreateRecurringGroup() {
  const queryClient = useQueryClient();
  return useMutation<PlaidRecurringGroup, Error, { label: string; recurrence: string; financeType?: string | null; transactionIds?: string[] }>({
    mutationFn: (data) => fetchApi("/api/admin/plaid/recurring-groups", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plaid"] });
    },
  });
}

export function useUpdateRecurringGroup() {
  const queryClient = useQueryClient();
  return useMutation<PlaidRecurringGroup, Error, { groupId: string; label?: string; recurrence?: string; financeType?: string | null; isActive?: boolean }>({
    mutationFn: ({ groupId, ...data }) => fetchApi(`/api/admin/plaid/recurring-groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "plaid"] });
    },
  });
}

export function useDetectRecurringPatterns() {
  return useQuery<{ suggestions: RecurringSuggestion[] }>({
    queryKey: ["admin", "plaid", "detect-recurring"],
    queryFn: () => fetchApi("/api/admin/plaid/detect-recurring"),
  });
}

// Client Billing Items
export interface ClientBillingItem {
  id: string;
  clientId: string;
  type: string;
  title: string;
  amountCents: number;
  dueDate: string;
  frequency: string;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function useClientBillingItems(clientId: string) {
  return useQuery<ClientBillingItem[]>({
    queryKey: ["admin", "clients", clientId, "billing-items"],
    queryFn: () => fetchApi(`/api/admin/clients/${clientId}/billing-items`),
    enabled: !!clientId,
  });
}

export function useCreateBillingItem() {
  const queryClient = useQueryClient();
  return useMutation<ClientBillingItem, Error, { clientId: string; type: string; title: string; amountCents: number; dueDate: string; frequency: string; notes?: string }>({
    mutationFn: ({ clientId, ...data }) => fetchApi(`/api/admin/clients/${clientId}/billing-items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clients", variables.clientId, "billing-items"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "clients", variables.clientId] });
    },
  });
}

export function useDeleteBillingItem() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { clientId: string; id: string }>({
    mutationFn: ({ clientId, id }) => fetchApi(`/api/admin/clients/${clientId}/billing-items/${id}`, {
      method: "DELETE",
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clients", variables.clientId, "billing-items"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "clients", variables.clientId] });
    },
  });
}

export function useAllBillingItems(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const queryString = params.toString();
  
  return useQuery<ClientBillingItem[]>({
    queryKey: ["admin", "billing-items", startDate, endDate],
    queryFn: () => fetchApi(`/api/admin/billing-items${queryString ? `?${queryString}` : ""}`),
  });
}

export function useUpdateClientStatus() {
  const queryClient = useQueryClient();
  return useMutation<Client, Error, { clientId: string; status: string }>({
    mutationFn: ({ clientId, status }) => fetchApi(`/api/admin/clients/${clientId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clients", variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });
    },
  });
}
