import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useAdminClient, formatCents, formatDate } from "@/lib/api";

export default function ClientDetail() {
  const [match, params] = useRoute("/admin/clients/:id");
  const clientId = params?.id || "";
  
  const { data: clientData, isLoading, error } = useAdminClient(clientId);

  if (isLoading) {
    return (
      <Layout role="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  if (error || !clientData) {
    return (
      <Layout role="admin">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/clients">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft size={20} />
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">Client Not Found</h2>
            </div>
          </div>
          
          <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Unable to Load Client</h3>
              <p className="text-gray-500 text-center max-w-md mb-4">
                This client may have been deleted or you don't have permission to view it.
              </p>
              <Link href="/admin/clients">
                <Button variant="outline">Back to Clients</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const client = clientData;
  const payments = client.payments || [];
  const documents = client.documents || [];
  const leases = client.leases || [];
  const invoices = client.invoices || [];
  
  const activeLease = leases.find(l => l.status === 'active');
  const outstandingBalance = invoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + (inv.amountCents || 0), 0);

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/clients">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">{client.displayName}</h2>
            <p className="text-gray-500">{client.email || 'No email provided'}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" className="gap-2">
              <Upload size={16} /> Upload Document
            </Button>
            <Button className="btn-primary-orange gap-2">
              <FileText size={16} /> Generate Invoice
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
             <Card>
               <CardHeader>
                 <CardTitle>Client Information</CardTitle>
               </CardHeader>
               <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Phone</p>
                    <p className="text-gray-900 mt-1">{client.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Address</p>
                    <p className="text-gray-900 mt-1">{client.address || 'Not provided'}</p>
                  </div>
                  <div>
                     <p className="text-sm font-medium text-gray-500">Lease Status</p>
                     <p className="text-gray-900 mt-1">
                       {activeLease 
                         ? `Active${activeLease.endDate ? ` (Expires ${formatDate(activeLease.endDate)})` : ''}`
                         : 'No active lease'}
                     </p>
                  </div>
                  <div>
                     <p className="text-sm font-medium text-gray-500">Monthly Rate</p>
                     <p className="text-gray-900 mt-1 font-bold text-lg">
                       {activeLease?.rentAmountCents ? formatCents(activeLease.rentAmountCents) : 'N/A'}
                     </p>
                  </div>
               </CardContent>
             </Card>

             <Card>
               <CardHeader>
                 <CardTitle>Payment History</CardTitle>
               </CardHeader>
               <CardContent>
                 {payments.length > 0 ? (
                   <div className="space-y-4">
                      {payments.map(payment => (
                        <div key={payment.paymentId} className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                           <div>
                              <p className="font-medium text-gray-900">Invoice {payment.invoiceId || 'Payment'}</p>
                              <p className="text-sm text-gray-500">{formatDate(payment.paidAt || payment.createdAt) || 'N/A'}</p>
                           </div>
                           <div className="text-right">
                              <p className="font-bold text-gray-900">{formatCents(payment.amountCents)}</p>
                              <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200 text-xs capitalize">
                                {payment.status}
                              </Badge>
                           </div>
                        </div>
                      ))}
                   </div>
                 ) : (
                   <div className="text-center py-8 text-gray-400">
                     <p className="font-medium text-gray-900">No payments yet</p>
                     <p className="text-sm">Payment history will appear here.</p>
                   </div>
                 )}
               </CardContent>
             </Card>
          </div>

          <div className="space-y-6">
             <Card className={`border-t-4 ${outstandingBalance > 0 ? 'border-t-red-500' : 'border-t-green-500'}`}>
                <CardHeader>
                   <CardTitle className="text-sm font-medium text-gray-500">Current Balance</CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="text-3xl font-bold text-gray-900">
                     {formatCents(outstandingBalance)}
                   </div>
                   {outstandingBalance > 0 ? (
                      <p className="text-sm text-red-600 mt-2 font-medium">
                        Outstanding balance
                      </p>
                   ) : (
                      <p className="text-sm text-green-600 mt-2 font-medium flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                        All paid up
                      </p>
                   )}
                </CardContent>
             </Card>

             <Card>
                <CardHeader>
                  <CardTitle>Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                   {documents.length > 0 ? (
                     documents.map(doc => (
                       <div key={doc.documentId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            <FileText size={18} className="text-blue-500" />
                            <span className="text-sm font-medium truncate max-w-[150px]">{doc.title}</span>
                          </div>
                          <Download size={14} className="text-gray-400" />
                       </div>
                     ))
                   ) : (
                     <div className="text-center py-4 text-gray-400">
                       <p className="text-sm">No documents uploaded</p>
                     </div>
                   )}
                </CardContent>
             </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
