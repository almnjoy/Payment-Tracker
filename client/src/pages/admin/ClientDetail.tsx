import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Download, Upload, FileText, Loader2, AlertCircle, Plus, DollarSign, Calendar, Trash2 } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useAdminClient, useAdminFinanceEntries, useCreateFinanceEntry, useDeleteFinanceEntry, formatCents, formatDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ClientDetail() {
  const [match, params] = useRoute("/admin/clients/:id");
  const clientId = params?.id || "";
  const { toast } = useToast();
  
  const { data: clientData, isLoading, error } = useAdminClient(clientId);
  const { data: financeEntries, refetch: refetchEntries } = useAdminFinanceEntries(undefined, clientId);
  const createEntry = useCreateFinanceEntry();
  const deleteEntry = useDeleteFinanceEntry();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    categoryGroup: "bills",
    title: "",
    amountCents: "",
    date: new Date().toISOString().split('T')[0],
    recurrence: "one_time",
    notes: "",
  });

  const handleCreateEntry = async () => {
    if (!formData.title.trim() || !formData.amountCents) {
      toast({ title: "Error", description: "Title and amount are required", variant: "destructive" });
      return;
    }
    
    try {
      await createEntry.mutateAsync({
        clientId,
        categoryGroup: formData.categoryGroup,
        title: formData.title,
        amountCents: Math.round(parseFloat(formData.amountCents) * 100),
        date: formData.date,
        recurrence: formData.recurrence,
        notes: formData.notes || null,
        entryType: "manual",
      });
      
      toast({ title: "Success", description: "Entry created successfully" });
      setDialogOpen(false);
      setFormData({
        categoryGroup: "bills",
        title: "",
        amountCents: "",
        date: new Date().toISOString().split('T')[0],
        recurrence: "one_time",
        notes: "",
      });
      refetchEntries();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const handleDeleteEntry = async (entryId: string) => {
    try {
      await deleteEntry.mutateAsync(entryId);
      toast({ title: "Success", description: "Entry deleted" });
      refetchEntries();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

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

  const clientEntries = financeEntries || [];

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
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-add-bill">
                  <Plus size={16} /> Add Bill/Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add Bill/Expense</DialogTitle>
                  <DialogDescription>
                    Create a new financial entry for {client.displayName}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="categoryGroup" className="text-right">Type</Label>
                    <Select value={formData.categoryGroup} onValueChange={(v) => setFormData({ ...formData, categoryGroup: v })}>
                      <SelectTrigger className="col-span-3" data-testid="select-category">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bills">Bill</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="debts">Debt</SelectItem>
                        <SelectItem value="holdings">Holding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">Title</Label>
                    <Input 
                      id="title" 
                      placeholder="e.g. Monthly Rent" 
                      className="col-span-3"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      data-testid="input-entry-title"
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="amount" className="text-right">Amount</Label>
                    <div className="col-span-3 relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input 
                        id="amount" 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        className="pl-9"
                        value={formData.amountCents}
                        onChange={(e) => setFormData({ ...formData, amountCents: e.target.value })}
                        data-testid="input-entry-amount"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="date" className="text-right">Due Date</Label>
                    <Input 
                      id="date" 
                      type="date" 
                      className="col-span-3"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      data-testid="input-entry-date"
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="recurrence" className="text-right">Frequency</Label>
                    <Select value={formData.recurrence} onValueChange={(v) => setFormData({ ...formData, recurrence: v })}>
                      <SelectTrigger className="col-span-3" data-testid="select-recurrence">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">One-time</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="notes" className="text-right">Notes</Label>
                    <Textarea 
                      id="notes" 
                      placeholder="Optional notes..."
                      className="col-span-3"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      data-testid="input-entry-notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={handleCreateEntry} 
                    className="btn-primary-orange"
                    disabled={createEntry.isPending}
                    data-testid="button-save-entry"
                  >
                    {createEntry.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Entry
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
               <CardHeader className="flex flex-row items-center justify-between">
                 <CardTitle className="flex items-center gap-2">
                   <Calendar size={18} className="text-blue-500" />
                   Bills & Expenses
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 {clientEntries.length > 0 ? (
                   <div className="space-y-3">
                      {clientEntries.map(entry => (
                        <div key={entry.entryId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100" data-testid={`entry-${entry.entryId}`}>
                           <div className="flex-1">
                             <div className="flex items-center gap-2">
                               <h4 className="font-medium text-gray-900">{entry.title}</h4>
                               <Badge variant="outline" className="text-xs capitalize">
                                 {entry.categoryGroup}
                               </Badge>
                               {entry.recurrence && entry.recurrence !== 'one_time' && (
                                 <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                   {entry.recurrence}
                                 </Badge>
                               )}
                             </div>
                             <p className="text-sm text-gray-500">
                               Due: {formatDate(entry.date)}
                               {entry.notes && ` • ${entry.notes}`}
                             </p>
                           </div>
                           <div className="flex items-center gap-3">
                             <span className="font-bold text-gray-900 text-lg">
                               {formatCents(entry.amountCents)}
                             </span>
                             <Button 
                               variant="ghost" 
                               size="icon"
                               onClick={() => handleDeleteEntry(entry.entryId)}
                               disabled={deleteEntry.isPending}
                               data-testid={`button-delete-${entry.entryId}`}
                             >
                               <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                             </Button>
                           </div>
                        </div>
                      ))}
                   </div>
                 ) : (
                   <div className="text-center py-8 text-gray-400">
                     <p className="font-medium text-gray-900">No bills or expenses yet</p>
                     <p className="text-sm">Click "Add Bill/Expense" to create one.</p>
                   </div>
                 )}
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
                       <div key={doc.documentId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" data-testid={`doc-${doc.documentId}`}>
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
