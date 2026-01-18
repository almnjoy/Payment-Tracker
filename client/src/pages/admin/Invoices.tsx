import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilePlus, Send, Eye, Trash2, Plus, FileText, Settings, Download, Edit2, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  amount: number;
}

interface Client {
  clientId: string;
  displayName: string;
  email: string;
}

interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  title: string;
  issueDate: string;
  dueDate: string;
  terms: string;
  lineItems: LineItem[];
  subtotalCents: number;
  taxPercent: number;
  taxCents: number;
  totalCents: number;
  balanceDueCents: number;
  status: string;
  footerText: string | null;
  createdAt: string;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    sent: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
  };
  return <Badge className={styles[status] || styles.draft}>{status}</Badge>;
}

function generateItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function AdminInvoices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    clientId: "",
    title: "",
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    terms: "Due on Receipt",
    footerText: "",
    taxPercent: 0,
    status: "draft",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateItemId(), description: "", quantity: 1, rate: 0, discountPercent: 0, amount: 0 },
  ]);

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/admin/invoices"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/admin/clients"],
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/invoices/create", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      toast({ title: "Invoice Created", description: "The invoice has been saved." });
      setIsEditorOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create invoice.", variant: "destructive" });
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId, data }: { invoiceId: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/invoices/${invoiceId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      toast({ title: "Invoice Updated", description: "The invoice has been updated." });
      setIsEditorOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update invoice.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedInvoice(null);
    setFormData({
      clientId: "",
      title: "",
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: "",
      terms: "Due on Receipt",
      footerText: "",
      taxPercent: 0,
      status: "draft",
    });
    setLineItems([
      { id: generateItemId(), description: "", quantity: 1, rate: 0, discountPercent: 0, amount: 0 },
    ]);
  };

  const openNewInvoice = () => {
    resetForm();
    setIsEditorOpen(true);
  };

  const openEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setFormData({
      clientId: invoice.clientId,
      title: invoice.title,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      terms: invoice.terms,
      footerText: invoice.footerText || "",
      taxPercent: invoice.taxPercent || 0,
      status: invoice.status,
    });
    setLineItems(invoice.lineItems?.length > 0 ? invoice.lineItems : [
      { id: generateItemId(), description: "", quantity: 1, rate: 0, discountPercent: 0, amount: 0 },
    ]);
    setIsEditorOpen(true);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      const baseAmount = updated.quantity * updated.rate;
      const discount = baseAmount * (updated.discountPercent / 100);
      updated.amount = Math.round(baseAmount - discount);
      return updated;
    }));
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, {
      id: generateItemId(),
      description: "",
      quantity: 1,
      rate: 0,
      discountPercent: 0,
      amount: 0,
    }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxCents = Math.round(subtotalCents * (formData.taxPercent / 100));
  const totalCents = subtotalCents + taxCents;

  const handleSave = () => {
    if (!formData.clientId) {
      toast({ title: "Error", description: "Please select a client.", variant: "destructive" });
      return;
    }
    if (!formData.dueDate) {
      toast({ title: "Error", description: "Please set a due date.", variant: "destructive" });
      return;
    }

    const data = {
      ...formData,
      lineItems,
      subtotalCents,
      taxCents,
      totalCents,
      balanceDueCents: totalCents,
    };

    if (selectedInvoice) {
      updateInvoiceMutation.mutate({ invoiceId: selectedInvoice.invoiceId, data });
    } else {
      createInvoiceMutation.mutate(data);
    }
  };

  const openPdfPreview = async (invoice: Invoice) => {
    try {
      const response = await fetch(`/api/admin/invoices/${invoice.invoiceId}/pdf`, {
        credentials: "include",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setSelectedInvoice(invoice);
        setIsPdfOpen(true);
      } else {
        toast({ title: "Error", description: "Failed to load PDF.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    }
  };

  const downloadPdf = async (invoice: Invoice) => {
    try {
      const response = await fetch(`/api/admin/invoices/${invoice.invoiceId}/pdf`, {
        credentials: "include",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${invoice.invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to download PDF.", variant: "destructive" });
    }
  };

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.clientId === clientId);
    return client?.displayName || "Unknown Client";
  };

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Invoices</h2>
            <p className="text-gray-500">Create and manage client invoices.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/invoice-settings">
              <Button variant="outline" data-testid="button-invoice-settings">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Button>
            </Link>
            <Button onClick={openNewInvoice} className="btn-primary-orange" data-testid="button-new-invoice">
              <FilePlus className="mr-2 h-4 w-4" /> New Invoice
            </Button>
          </div>
        </div>

        <Card className="border-gray-200 shadow-lg">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <FileText size={20} />
              </div>
              <div>
                <CardTitle>All Invoices</CardTitle>
                <CardDescription>{invoices.length} invoice(s)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {invoicesLoading ? (
              <div className="p-8 text-center text-gray-500">Loading invoices...</div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No invoices yet. Click "New Invoice" to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map(invoice => (
                    <TableRow key={invoice.invoiceId} data-testid={`row-invoice-${invoice.invoiceId}`}>
                      <TableCell className="font-mono font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{getClientName(invoice.clientId)}</TableCell>
                      <TableCell>{invoice.issueDate}</TableCell>
                      <TableCell>{invoice.dueDate}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(invoice.totalCents)}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditInvoice(invoice)}
                            data-testid={`button-edit-${invoice.invoiceId}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openPdfPreview(invoice)}
                            data-testid={`button-preview-${invoice.invoiceId}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadPdf(invoice)}
                            data-testid={`button-download-${invoice.invoiceId}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedInvoice ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
            <DialogDescription>
              {selectedInvoice ? `Editing ${selectedInvoice.invoiceNumber}` : "Fill in the invoice details below."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={formData.clientId}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, clientId: v }))}
                >
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.clientId} value={client.clientId}>
                        {client.displayName} ({client.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
                  data-testid="input-issue-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  data-testid="input-due-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input
                  value={formData.terms}
                  onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
                  placeholder="Due on Receipt"
                  data-testid="input-terms"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Invoice Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Monthly Rent - January 2026"
                data-testid="input-title"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Line Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                  data-testid="button-add-line"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Line
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[40%]">Description</TableHead>
                      <TableHead className="w-[12%]">Qty</TableHead>
                      <TableHead className="w-[15%]">Rate ($)</TableHead>
                      <TableHead className="w-[12%]">Disc %</TableHead>
                      <TableHead className="w-[15%]">Amount</TableHead>
                      <TableHead className="w-[6%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                            placeholder="Item description"
                            className="h-9"
                            data-testid={`input-line-desc-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                            className="h-9"
                            data-testid={`input-line-qty-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={(item.rate / 100).toFixed(2)}
                            onChange={(e) => updateLineItem(item.id, "rate", Math.round(parseFloat(e.target.value || "0") * 100))}
                            className="h-9"
                            data-testid={`input-line-rate-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={item.discountPercent}
                            onChange={(e) => updateLineItem(item.id, "discountPercent", parseFloat(e.target.value) || 0)}
                            className="h-9"
                            data-testid={`input-line-disc-${index}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-right">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell>
                          {lineItems.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(item.id)}
                              className="h-8 w-8 p-0"
                              data-testid={`button-remove-line-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Footer Text</Label>
                <Textarea
                  value={formData.footerText}
                  onChange={(e) => setFormData(prev => ({ ...prev, footerText: e.target.value }))}
                  placeholder="Thanks for your business."
                  rows={2}
                  data-testid="input-footer"
                />
              </div>

              <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotalCents)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Tax</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={formData.taxPercent}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxPercent: parseFloat(e.target.value) || 0 }))}
                      className="h-7 w-16 text-center"
                      data-testid="input-tax"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                  <span className="font-medium">{formatCurrency(taxCents)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(totalCents)}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="btn-primary-orange"
              disabled={createInvoiceMutation.isPending || updateInvoiceMutation.isPending}
              data-testid="button-save-invoice"
            >
              {createInvoiceMutation.isPending || updateInvoiceMutation.isPending
                ? "Saving..."
                : selectedInvoice
                ? "Update Invoice"
                : "Create Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPdfOpen} onOpenChange={setIsPdfOpen}>
        <DialogContent className="max-w-4xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 h-full min-h-0">
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                className="w-full h-[calc(90vh-120px)] border rounded-lg"
                title="Invoice PDF Preview"
                data-testid="iframe-pdf-preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
