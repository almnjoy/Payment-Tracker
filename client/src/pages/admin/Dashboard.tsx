import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, AlertCircle, Clock, Loader2 } from "lucide-react";
import { useAdminStats, useAdminPayments, useAdminClients, formatCents, formatDate } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type PaymentStatus = "pending" | "posted" | "confirmed" | "rejected";

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

  const recentPayments = payments?.slice(0, 10) || [];

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Admin Overview</h2>
          <p className="text-gray-500">Client payment activity and verification.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
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
                Confirmed payments only
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-orange-500">
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
                Posted, pending, or rejected payments
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
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
                {stats?.activeClients === 0 ? 'No clients yet' : 'Total active clients'}
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
    </Layout>
  );
}
