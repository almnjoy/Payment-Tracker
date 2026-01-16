import { useState, useRef, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Download, Upload, FileText, Loader2, AlertCircle, Plus, DollarSign, Calendar, Trash2, Eye, ExternalLink } from "lucide-react";
import { Link, useRoute, useLocation } from "wouter";
import { useAdminClient, useClientBillingItems, useCreateBillingItem, useDeleteBillingItem, useUpdateClientStatus, useUploadDocument, formatCents, formatDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PDFViewerModal } from "@/components/PDFViewerModal";

export default function ClientDetail() {
  const [match, params] = useRoute("/admin/clients/:id");
  const [, navigate] = useLocation();
  const clientId = params?.id || "";
  const { toast } = useToast();
  
  const { data: clientData, isLoading, error, refetch: refetchClient } = useAdminClient(clientId);
  const { data: billingItems, refetch: refetchBillingItems } = useClientBillingItems(clientId);
  const createBillingItem = useCreateBillingItem();
  const deleteBillingItem = useDeleteBillingItem();
  const updateClientStatus = useUpdateClientStatus();
  const uploadDocument = useUploadDocument();
  
  const [billingDialogOpen, setBillingDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ documentId: string; title: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [billingFormData, setBillingFormData] = useState({
    type: "rent",
    title: "",
    amountCents: "",
    dueDate: new Date().toISOString().split('T')[0],
    frequency: "monthly",
    notes: "",
  });
  
  const [uploadFormData, setUploadFormData] = useState({
    title: "",
    docType: "other",
  });

  const handleQuickView = (doc: { documentId: string; title: string }) => {
    setSelectedDocument(doc);
    setPdfModalOpen(true);
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({ title: "Invalid File", description: "Only PDF files are allowed", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      setUploadFormData(prev => ({ ...prev, title: file.name.replace('.pdf', '') }));
      setUploadDialogOpen(true);
    }
  };
  
  const handleUpload = async () => {
    if (!selectedFile) {
      toast({ title: "Error", description: "Please select a file", variant: "destructive" });
      return;
    }
    if (!uploadFormData.title.trim()) {
      toast({ title: "Error", description: "Please enter a title", variant: "destructive" });
      return;
    }
    
    try {
      await uploadDocument.mutateAsync({
        file: selectedFile,
        clientId,
        title: uploadFormData.title.endsWith('.pdf') ? uploadFormData.title : uploadFormData.title + '.pdf',
        docType: uploadFormData.docType,
        visibility: "client_and_admin",
      });
      toast({ title: "Upload Complete", description: `${uploadFormData.title} uploaded successfully` });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadFormData({ title: "", docType: "other" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      refetchClient();
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleCreateBillingItem = async () => {
    if (!billingFormData.title.trim() || !billingFormData.amountCents) {
      toast({ title: "Error", description: "Title and amount are required", variant: "destructive" });
      return;
    }
    
    try {
      await createBillingItem.mutateAsync({
        clientId,
        type: billingFormData.type,
        title: billingFormData.title,
        amountCents: Math.round(parseFloat(billingFormData.amountCents) * 100),
        dueDate: billingFormData.dueDate,
        frequency: billingFormData.frequency,
        notes: billingFormData.notes || undefined,
      });
      
      toast({ title: "Success", description: "Billing item created successfully" });
      setBillingDialogOpen(false);
      setBillingFormData({
        type: "rent",
        title: "",
        amountCents: "",
        dueDate: new Date().toISOString().split('T')[0],
        frequency: "monthly",
        notes: "",
      });
      refetchBillingItems();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const handleDeleteBillingItem = async (id: string) => {
    try {
      await deleteBillingItem.mutateAsync({ clientId, id });
      toast({ title: "Success", description: "Billing item deleted" });
      refetchBillingItems();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const handleStatusChange = async (status: string) => {
    try {
      await updateClientStatus.mutateAsync({ clientId, status });
      toast({ title: "Success", description: "Status updated" });
      refetchClient();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const handleViewClientPortal = () => {
    navigate(`/client/dashboard?asClientId=${clientId}`);
  };

  const monthlyRate = useMemo(() => {
    if (!billingItems) return 0;
    return billingItems
      .filter(item => item.frequency === "monthly" && item.status === "active")
      .reduce((sum, item) => sum + item.amountCents, 0);
  }, [billingItems]);

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
                This client may have been deleted or you do not have permission to view it.
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
  const invoices = client.invoices || [];
  
  const outstandingBalance = invoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + (inv.amountCents || 0), 0);

  const clientBillingItemsList = billingItems || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 border-green-200';
      case 'paused': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'inactive': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'behind': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/clients">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">{client.displayName}</h2>
            <p className="text-gray-500">{client.email || 'No email provided'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleViewClientPortal} data-testid="button-view-portal">
              <ExternalLink size={16} /> View Client Portal
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="application/pdf"
              onChange={handleFileSelect}
            />
            <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} data-testid="button-upload-doc">
              <Upload size={16} /> Upload Document
            </Button>
            <Dialog open={billingDialogOpen} onOpenChange={setBillingDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-primary-orange gap-2" data-testid="button-add-billing">
                  <Plus size={16} /> Add Billing Item
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add Billing Item</DialogTitle>
                  <DialogDescription>
                    Create a new billing item for {client.displayName}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="type" className="text-right">Type</Label>
                    <Select value={billingFormData.type} onValueChange={(v) => setBillingFormData({ ...billingFormData, type: v })}>
                      <SelectTrigger className="col-span-3" data-testid="select-billing-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rent">Rent</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">Title</Label>
                    <Input 
                      id="title" 
                      placeholder="e.g. Monthly Rent" 
                      className="col-span-3"
                      value={billingFormData.title}
                      onChange={(e) => setBillingFormData({ ...billingFormData, title: e.target.value })}
                      data-testid="input-billing-title"
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
                        value={billingFormData.amountCents}
                        onChange={(e) => setBillingFormData({ ...billingFormData, amountCents: e.target.value })}
                        data-testid="input-billing-amount"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="dueDate" className="text-right">Due Date</Label>
                    <Input 
                      id="dueDate" 
                      type="date" 
                      className="col-span-3"
                      value={billingFormData.dueDate}
                      onChange={(e) => setBillingFormData({ ...billingFormData, dueDate: e.target.value })}
                      data-testid="input-billing-dueDate"
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="frequency" className="text-right">Frequency</Label>
                    <Select value={billingFormData.frequency} onValueChange={(v) => setBillingFormData({ ...billingFormData, frequency: v })}>
                      <SelectTrigger className="col-span-3" data-testid="select-billing-frequency">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">One Time</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="notes" className="text-right">Notes</Label>
                    <Textarea 
                      id="notes" 
                      placeholder="Optional notes" 
                      className="col-span-3"
                      value={billingFormData.notes}
                      onChange={(e) => setBillingFormData({ ...billingFormData, notes: e.target.value })}
                      data-testid="input-billing-notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBillingDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={handleCreateBillingItem} 
                    className="btn-primary-orange"
                    disabled={createBillingItem.isPending}
                    data-testid="button-confirm-billing"
                  >
                    {createBillingItem.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload a PDF document for {client.displayName}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">File</Label>
                <div className="col-span-3 flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                  <FileText size={16} className="text-red-500" />
                  <span className="text-sm truncate">{selectedFile?.name || 'No file selected'}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="uploadTitle" className="text-right">Title</Label>
                <Input 
                  id="uploadTitle" 
                  className="col-span-3"
                  value={uploadFormData.title}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                  data-testid="input-upload-title"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="docType" className="text-right">Type</Label>
                <Select value={uploadFormData.docType} onValueChange={(v) => setUploadFormData({ ...uploadFormData, docType: v })}>
                  <SelectTrigger className="col-span-3" data-testid="select-upload-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="contract">Contract/Lease</SelectItem>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="notice">Notice</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleUpload} 
                className="btn-primary-orange"
                disabled={uploadDocument.isPending}
                data-testid="button-confirm-upload"
              >
                {uploadDocument.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
               <CardHeader className="flex flex-row items-center justify-between">
                 <CardTitle>Client Details</CardTitle>
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
                     <div className="mt-1">
                       <Select value={client.status || "active"} onValueChange={handleStatusChange}>
                         <SelectTrigger className="w-[180px]" data-testid="select-lease-status">
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="active">
                             <span className="flex items-center gap-2">
                               <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                               Active
                             </span>
                           </SelectItem>
                           <SelectItem value="paused">
                             <span className="flex items-center gap-2">
                               <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                               Paused
                             </span>
                           </SelectItem>
                           <SelectItem value="inactive">
                             <span className="flex items-center gap-2">
                               <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                               Inactive
                             </span>
                           </SelectItem>
                           <SelectItem value="behind">
                             <span className="flex items-center gap-2">
                               <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                               Behind
                             </span>
                           </SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                  </div>
                  <div>
                     <p className="text-sm font-medium text-gray-500">Monthly Rate</p>
                     <p className="text-gray-900 mt-1 font-bold text-lg">
                       {monthlyRate > 0 ? formatCents(monthlyRate) : 'No monthly items'}
                     </p>
                  </div>
               </CardContent>
             </Card>

             <Card>
               <CardHeader className="flex flex-row items-center justify-between">
                 <CardTitle className="flex items-center gap-2">
                   <Calendar size={18} className="text-blue-500" />
                   Billing Items
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 {clientBillingItemsList.length > 0 ? (
                   <div className="space-y-3">
                      {clientBillingItemsList.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100" data-testid={`billing-${item.id}`}>
                           <div className="flex-1">
                             <div className="flex items-center gap-2">
                               <h4 className="font-medium text-gray-900">{item.title}</h4>
                               <Badge variant="outline" className={`text-xs capitalize ${item.type === 'rent' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                                 {item.type}
                               </Badge>
                               {item.frequency && item.frequency !== 'one_time' && (
                                 <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                   {item.frequency}
                                 </Badge>
                               )}
                             </div>
                             <p className="text-sm text-gray-500">
                               Due: {formatDate(item.dueDate)}
                               {item.notes && ` - ${item.notes}`}
                             </p>
                           </div>
                           <div className="flex items-center gap-3">
                             <span className="font-bold text-gray-900 text-lg">
                               {formatCents(item.amountCents)}
                             </span>
                             <Button 
                               variant="ghost" 
                               size="icon"
                               onClick={() => handleDeleteBillingItem(item.id)}
                               disabled={deleteBillingItem.isPending}
                               data-testid={`button-delete-billing-${item.id}`}
                             >
                               <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                             </Button>
                           </div>
                        </div>
                      ))}
                   </div>
                 ) : (
                   <div className="text-center py-8 text-gray-400">
                     <p className="font-medium text-gray-900">No billing items yet</p>
                     <p className="text-sm">Click "Add Billing Item" to create one.</p>
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
                       <div key={doc.documentId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group" data-testid={`doc-${doc.documentId}`}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText size={18} className="text-red-500 shrink-0" />
                            <span className="text-sm font-medium truncate">{doc.title}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-gray-400 hover:text-blue-500"
                              onClick={() => handleQuickView(doc)}
                              data-testid={`button-view-${doc.documentId}`}
                            >
                              <Eye size={14} />
                            </Button>
                          </div>
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

      {selectedDocument && (
        <PDFViewerModal
          open={pdfModalOpen}
          onOpenChange={setPdfModalOpen}
          documentId={selectedDocument.documentId}
          title={selectedDocument.title}
          downloadUrl={`/api/admin/documents/${selectedDocument.documentId}/download`}
        />
      )}
    </Layout>
  );
}
