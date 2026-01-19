import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Users, AlertCircle, Clock, Loader2, ExternalLink } from "lucide-react";
import { useAdminStats, useAdminPayments, useAdminClients, formatCents, formatDate } from "@/lib/api";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Link } from "wouter";

type PaymentStatus = "pending" | "posted" | "confirmed" | "rejected";
type ModalType = "collected" | "outstanding" | "clients" | null;

const statusConfig: Record<PaymentStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: "Pending", color: "text-yellow-700", bgColor: "bg-yellow-50 border-yellow-200" },
  posted: { label: "Posted", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
  confirmed: { label: "Confirmed", color: "text-green-700", bgColor: "bg-green-50 border-green-200" },
  rejected: { label: "Rejected", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
};

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: payments, isLoading: paymentsLoading } = useAdminPayments();
  const { data: clients } = useAdminClients();
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState<ModalType>(null);

  const { data: billingItems = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/billing-items"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ paymentId, status }: { paymentId: string; status: string }) => {
      const res = await fetch(`/api/admin/payments/${paymentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Payment status updated");
    },
    onError: () => {
      toast.error("Failed to update payment status");
    },
  });

  const getClientName = (clientId: string) => {
    const client = clients?.find(c => c.clientId === clientId);
    return client?.displayName || clientId;
  };

  if (statsLoading) {
    return (
      <Layout role="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  // Filter to only show payments from active/behind clients (exclude paused/inactive)
  const activeClients = clients?.filter(c => c.status === "active" || c.status === "behind") || [];
  const activeClientIds = new Set(activeClients.map(c => c.clientId));
  const recentPayments = payments?.filter(p => activeClientIds.has(p.clientId)).slice(0, 10) || [];

  // Data for modals
  const confirmedPayments = payments?.filter(p => 
    activeClientIds.has(p.clientId) && p.status === "confirmed"
  ) || [];

  // Helper to calculate billing due with period logic
  const calculateBillingDue = (bills: any[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let total = 0;
    
    for (const bill of bills) {
      const dueParts = bill.dueDate.split('-').map(Number);
      const dueDate = new Date(dueParts[0], dueParts[1] - 1, dueParts[2]);
      
      if (dueDate > today) continue;
      
      if (bill.frequency === "one_time") {
        total += bill.amountCents;
      } else {
        let periods = 0;
        let currentDue = new Date(dueDate);
        
        while (currentDue <= today) {
          periods++;
          switch (bill.frequency) {
            case "weekly":
              currentDue.setDate(currentDue.getDate() + 7);
              break;
            case "biweekly":
              currentDue.setDate(currentDue.getDate() + 14);
              break;
            case "monthly": {
              const targetDay = dueDate.getDate();
              const nextMonth = currentDue.getMonth() + 1;
              const year = currentDue.getFullYear() + Math.floor(nextMonth / 12);
              const month = nextMonth % 12;
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              currentDue = new Date(year, month, Math.min(targetDay, daysInMonth));
              break;
            }
            case "yearly": {
              const targetMonth = dueDate.getMonth();
              const targetDay = dueDate.getDate();
              const nextYear = currentDue.getFullYear() + 1;
              const daysInMonth = new Date(nextYear, targetMonth + 1, 0).getDate();
              currentDue = new Date(nextYear, targetMonth, Math.min(targetDay, daysInMonth));
              break;
            }
          }
        }
        total += bill.amountCents * periods;
      }
    }
    return total;
  };

  // Calculate outstanding per client (billing items with period logic - confirmed payments)
  const clientOutstandingData = activeClients.map(client => {
    const clientBills = billingItems.filter((item: any) => 
      item.clientId === client.clientId && item.status === "active"
    );
    const billingTotal = calculateBillingDue(clientBills);
    
    const clientConfirmed = payments?.filter(p => 
      p.clientId === client.clientId && p.status === "confirmed"
    ) || [];
    const paymentsTotal = clientConfirmed.reduce((sum, p) => sum + p.amountCents, 0);
    
    const balance = paymentsTotal - billingTotal; // Negative = owes
    return {
      client,
      billingTotal,
      paymentsTotal,
      balance,
      billingItems: clientBills,
    };
  }).filter(c => c.balance < 0); // Only show clients who owe money

  const activeOnlyClients = clients?.filter(c => c.status === "active") || [];

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Admin Overview</h2>
          <p className="text-gray-500">Client payment activity and verification.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card 
            className="shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:ring-2 hover:ring-green-200"
            onClick={() => setOpenModal("collected")}
            data-testid="card-total-collected"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Collected
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900" data-testid="text-total-collected">
                {stats ? formatCents(stats.totalCollectedCents) : '$0.00'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Confirmed payments only • Click to view
              </p>
            </CardContent>
          </Card>

          <Card 
            className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-orange-500 cursor-pointer hover:ring-2 hover:ring-orange-200"
            onClick={() => setOpenModal("outstanding")}
            data-testid="card-outstanding"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Outstanding Balance
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900" data-testid="text-outstanding">
                {stats ? formatCents(stats.outstandingCents) : '$0.00'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total owed by active clients • Click to view
              </p>
            </CardContent>
          </Card>

          <Card 
            className="shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:ring-2 hover:ring-blue-200"
            onClick={() => setOpenModal("clients")}
            data-testid="card-active-clients"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Active Clients
              </CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900" data-testid="text-active-clients">
                {stats?.activeClients || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stats?.activeClients === 0 ? 'No clients yet' : 'Click to view list'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="flex flex-row items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <CardTitle>Payment Verification</CardTitle>
            {stats?.pendingVerificationCount ? (
              <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-200">
                {stats.pendingVerificationCount} pending
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : recentPayments.length > 0 ? (
              <div className="space-y-3">
                {recentPayments.map((payment) => {
                  const status = (payment.status as PaymentStatus) || "pending";
                  const config = statusConfig[status] || statusConfig.pending;
                  
                  return (
                    <div 
                      key={payment.paymentId} 
                      className={`flex items-center justify-between p-4 rounded-lg border ${config.bgColor}`}
                      data-testid={`payment-row-${payment.paymentId}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg text-gray-900">
                            {formatCents(payment.amountCents)}
                          </span>
                          <span className="text-sm text-gray-600">
                            from <span className="font-medium">{getClientName(payment.clientId)}</span>
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatDate(payment.paidAt || payment.createdAt)} • {payment.method}
                          {payment.notes && ` • ${payment.notes}`}
                        </p>
                      </div>
                      <div className="ml-4">
                        <Select
                          value={status}
                          onValueChange={(value) => {
                            updateStatusMutation.mutate({ 
                              paymentId: payment.paymentId, 
                              status: value 
                            });
                          }}
                          disabled={updateStatusMutation.isPending}
                        >
                          <SelectTrigger 
                            className="w-[130px]" 
                            data-testid={`status-select-${payment.paymentId}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="posted">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                Posted
                              </div>
                            </SelectItem>
                            <SelectItem value="confirmed">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                Confirmed
                              </div>
                            </SelectItem>
                            <SelectItem value="rejected">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500" />
                                Rejected
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <DollarSign className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="font-medium text-gray-900">No payments to verify</p>
                <p className="text-sm">Client payments will appear here for verification.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Total Collected Modal */}
      <Dialog open={openModal === "collected"} onOpenChange={() => setOpenModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Total Collected: {formatCents(stats?.totalCollectedCents || 0)}
            </DialogTitle>
            <DialogDescription>
              {confirmedPayments.length} confirmed payment(s) from active clients
            </DialogDescription>
          </DialogHeader>
          {confirmedPayments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {confirmedPayments.map(payment => (
                  <TableRow key={payment.paymentId}>
                    <TableCell className="font-medium">{getClientName(payment.clientId)}</TableCell>
                    <TableCell>{formatDate(payment.paidAt || payment.createdAt)}</TableCell>
                    <TableCell>{payment.method}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatCents(payment.amountCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">No confirmed payments yet.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Outstanding Balance Modal */}
      <Dialog open={openModal === "outstanding"} onOpenChange={() => setOpenModal(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Outstanding Balance: {formatCents(stats?.outstandingCents || 0)}
            </DialogTitle>
            <DialogDescription>
              {clientOutstandingData.length} client(s) with outstanding balances
            </DialogDescription>
          </DialogHeader>
          {clientOutstandingData.length > 0 ? (
            <div className="space-y-4">
              {clientOutstandingData.map(({ client, billingTotal, paymentsTotal, balance, billingItems: clientBills }) => (
                <div key={client.clientId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <a href={`/admin/clients/${client.clientId}`} className="font-medium text-blue-600 hover:underline flex items-center gap-1">
                        {client.displayName}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    <span className="font-bold text-red-600">{formatCents(balance)}</span>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Billing Items Total:</span>
                      <span>{formatCents(billingTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Confirmed Payments:</span>
                      <span className="text-green-600">-{formatCents(paymentsTotal)}</span>
                    </div>
                    {clientBills.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <span className="text-xs font-medium text-gray-400">Active billing items:</span>
                        {clientBills.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-xs mt-1">
                            <span>{item.title}</span>
                            <span>{formatCents(item.amountCents)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No outstanding balances.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Active Clients Modal */}
      <Dialog open={openModal === "clients"} onOpenChange={() => setOpenModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Active Clients: {activeOnlyClients.length}
            </DialogTitle>
            <DialogDescription>
              List of all active clients
            </DialogDescription>
          </DialogHeader>
          {activeOnlyClients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeOnlyClients.map(client => (
                  <TableRow key={client.clientId}>
                    <TableCell className="font-medium">{client.displayName}</TableCell>
                    <TableCell>{client.email || '-'}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-700">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <a href={`/admin/clients/${client.clientId}`} className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">No active clients yet.</div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
