import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Calendar, FileText, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useClientDashboard, formatCents, formatDate } from "@/lib/api";

export default function ClientDashboard() {
  const { data, isLoading, error } = useClientDashboard();

  if (isLoading) {
    return (
      <Layout role="client">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout role="client">
        <div className="text-center py-12">
          <p className="text-red-600">Failed to load dashboard data</p>
        </div>
      </Layout>
    );
  }

  const { amountDueCents, nextDueDate, lastPayment, activeLease, client } = data;

  return (
    <Layout role="client">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
          <p className="text-gray-500">Welcome back{client?.displayName ? `, ${client.displayName}` : ''}. Here's your overview.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Current Amount Due
                </CardTitle>
                <DollarSign className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900" data-testid="text-amount-due">
                  {formatCents(amountDueCents)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {nextDueDate ? `Due by ${formatDate(nextDueDate)}` : 'No outstanding balance'}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Last Payment
                </CardTitle>
                <Calendar className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900" data-testid="text-last-payment">
                  {lastPayment ? formatCents(lastPayment.amountCents) : 'N/A'}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {lastPayment ? `Paid on ${formatDate(lastPayment.paidAt || lastPayment.createdAt)}` : 'No payments yet'}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="md:col-span-2">
             <Card className="shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-blue-50 to-white border-blue-100">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-700">
                  Active Agreement
                </CardTitle>
                <FileText className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-gray-900" data-testid="text-active-lease">
                  {activeLease ? activeLease.description || `Lease ${activeLease.leaseId}` : 'No active lease'}
                </div>
                {activeLease && (
                  <div className="flex items-center mt-2 text-sm text-blue-600 font-medium cursor-pointer hover:underline">
                    Monthly: {formatCents(activeLease.rentAmountCents)} <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="col-span-1 shadow-sm border-gray-200">
             <CardHeader>
               <CardTitle>Quick Actions</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                {amountDueCents > 0 && (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 flex items-center justify-between">
                     <div>
                       <p className="font-semibold text-orange-900">Outstanding Balance: {formatCents(amountDueCents)}</p>
                       <p className="text-xs text-orange-700">Due {formatDate(nextDueDate)}</p>
                     </div>
                     <Button className="btn-primary-orange shadow-orange-200" data-testid="button-pay-now">
                       Pay Now
                     </Button>
                  </div>
                )}
                
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 flex items-center justify-between">
                   <div>
                     <p className="font-medium text-gray-900">Auto-Pay Settings</p>
                     <p className="text-xs text-gray-500">Currently disabled</p>
                   </div>
                   <Button variant="outline" size="sm">Configure</Button>
                </div>
             </CardContent>
          </Card>

          <Card className="col-span-1 shadow-sm border-gray-200">
             <CardHeader>
               <CardTitle>Recent Documents</CardTitle>
             </CardHeader>
             <CardContent>
                {data.recentDocuments.length > 0 ? (
                  <div className="space-y-4">
                    {data.recentDocuments.map((doc) => (
                      <div key={doc.documentId} className="flex items-start gap-3">
                        <div className="h-2 w-2 mt-2 rounded-full bg-blue-500 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                          <p className="text-xs text-gray-500">{formatDate(doc.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No documents available</p>
                )}
             </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
