import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle, Clock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useClientPayments, useClientInvoices, formatCents, formatDate } from "@/lib/api";

export default function ClientPayments() {
  const { data: payments, isLoading: paymentsLoading } = useClientPayments();
  const { data: invoices, isLoading: invoicesLoading } = useClientInvoices();

  const isLoading = paymentsLoading || invoicesLoading;
  const openInvoices = invoices?.filter(inv => ['open', 'sent', 'overdue'].includes(inv.status)) || [];

  return (
    <Layout role="client">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Payments</h2>
            <p className="text-gray-500">View your payment history and current invoices.</p>
          </div>
          <Button className="btn-primary-orange" data-testid="button-make-payment">
             Make a Payment
          </Button>
        </div>

        {openInvoices.length > 0 && (
          <Card className="shadow-sm border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800">Outstanding Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {openInvoices.map((invoice) => (
                  <div 
                    key={invoice.invoiceId}
                    className="flex items-center justify-between p-4 bg-white rounded-lg border border-orange-100"
                    data-testid={`invoice-${invoice.invoiceId}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                        <Clock size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{invoice.title}</p>
                        <p className="text-sm text-gray-500">
                          Due {formatDate(invoice.dueDate)} • ID: {invoice.invoiceId}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-gray-900">{formatCents(invoice.amountCents)}</span>
                      <Badge 
                        variant="outline" 
                        className={invoice.status === 'overdue' 
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-orange-50 text-orange-700 border-orange-200"
                        }
                      >
                        {invoice.status}
                      </Badge>
                      <Button className="h-8 btn-primary-orange text-xs px-3 py-0" data-testid={`button-pay-${invoice.invoiceId}`}>
                        Pay Now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : payments && payments.length > 0 ? (
              <div className="space-y-1">
                {payments.map((payment, index) => (
                  <motion.div 
                    key={payment.paymentId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0"
                    data-testid={`payment-${payment.paymentId}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        <CheckCircle size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Payment via {payment.method}</p>
                        <p className="text-sm text-gray-500">
                          {formatDate(payment.paidAt || payment.createdAt)} • ID: {payment.paymentId}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-gray-900">{formatCents(payment.amountCents)}</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                        Paid
                      </Badge>
                      <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-900">
                        <Download size={18} />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No payment history yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
