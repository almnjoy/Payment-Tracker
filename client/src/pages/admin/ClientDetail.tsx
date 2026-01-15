import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MOCK_CLIENTS, MOCK_PAYMENTS } from "@/lib/mockData";
import { ArrowLeft, Download, Mail, MoreHorizontal, Upload, FileText, CreditCard } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Separator } from "@/components/ui/separator";

export default function ClientDetail() {
  const [match, params] = useRoute("/admin/clients/:id");
  const id = params?.id ? parseInt(params.id) : 1;
  const client = MOCK_CLIENTS.find(c => c.id === id) || MOCK_CLIENTS[0];

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
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">{client.name}</h2>
            <p className="text-gray-500">{client.email}</p>
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
          {/* Main Info Column */}
          <div className="md:col-span-2 space-y-6">
             <Card>
               <CardHeader>
                 <CardTitle>Client Information</CardTitle>
               </CardHeader>
               <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Phone</p>
                    <p className="text-gray-900 mt-1">+1 (555) 123-4567</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Address</p>
                    <p className="text-gray-900 mt-1">123 Market St, Unit 402, SF, CA</p>
                  </div>
                  <div>
                     <p className="text-sm font-medium text-gray-500">Lease Term</p>
                     <p className="text-gray-900 mt-1">12 Months (Expires Jan 2027)</p>
                  </div>
                  <div>
                     <p className="text-sm font-medium text-gray-500">Monthly Rate</p>
                     <p className="text-gray-900 mt-1 font-bold text-lg">$1,250.00</p>
                  </div>
               </CardContent>
             </Card>

             <Card>
               <CardHeader>
                 <CardTitle>Payment History</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                    {MOCK_PAYMENTS.map(payment => (
                      <div key={payment.id} className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                         <div>
                            <p className="font-medium text-gray-900">{payment.description}</p>
                            <p className="text-sm text-gray-500">{new Date(payment.date).toLocaleDateString()}</p>
                         </div>
                         <div className="text-right">
                            <p className="font-bold text-gray-900">${payment.amount.toFixed(2)}</p>
                            <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200 text-xs">Paid</Badge>
                         </div>
                      </div>
                    ))}
                 </div>
               </CardContent>
             </Card>
          </div>

          {/* Sidebar Stats */}
          <div className="space-y-6">
             <Card className={`border-t-4 ${client.amountOwed > 0 ? 'border-t-red-500' : 'border-t-green-500'}`}>
                <CardHeader>
                   <CardTitle className="text-sm font-medium text-gray-500">Current Balance</CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="text-3xl font-bold text-gray-900">
                     ${client.amountOwed.toFixed(2)}
                   </div>
                   {client.amountOwed > 0 ? (
                      <p className="text-sm text-red-600 mt-2 font-medium">
                        Overdue by 12 days
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
                   <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <FileText size={18} className="text-blue-500" />
                        <span className="text-sm font-medium">Lease Agreement</span>
                      </div>
                      <Download size={14} className="text-gray-400" />
                   </div>
                   <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <FileText size={18} className="text-gray-500" />
                        <span className="text-sm font-medium">Insurance Policy</span>
                      </div>
                      <Download size={14} className="text-gray-400" />
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
