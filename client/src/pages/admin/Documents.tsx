import { useState, useRef, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Search, Loader2, Download, Eye, ChevronDown, ChevronRight, FolderOpen, User, FileArchive, Star, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAdminDocuments, useAdminClients, useUploadDocument, formatDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PDFViewerModal } from "@/components/PDFViewerModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface Document {
  documentId: string;
  clientId: string | null;
  title: string;
  docType: string;
  fileSizeBytes: number | null;
  createdAt: string;
  contentType: string | null;
  isActiveAgreement?: boolean;
}

interface ClientGroup {
  clientId: string;
  clientName: string;
  invoices: Document[];
  other: Document[];
  hasActiveAgreement: boolean;
}

export default function AdminDocuments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadFormData, setUploadFormData] = useState({
    clientId: "",
    title: "",
    docType: "other",
    isActiveAgreement: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  
  const { data: documents, isLoading, refetch } = useAdminDocuments();
  const { data: clients } = useAdminClients();
  const uploadDocument = useUploadDocument();

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ documentId, data }: { documentId: string; data: Partial<Document> }) => {
      const response = await fetch(`/api/admin/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update document");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
    },
  });

  const groupedDocuments = useMemo(() => {
    if (!documents) return { byClient: [], noClient: [] as Document[] };
    
    const clientMap = new Map<string, ClientGroup>();
    const noClient: Document[] = [];
    
    documents.forEach((doc: Document) => {
      if (!doc.clientId) {
        noClient.push(doc);
        return;
      }
      
      if (!clientMap.has(doc.clientId)) {
        const client = clients?.find(c => c.clientId === doc.clientId);
        clientMap.set(doc.clientId, {
          clientId: doc.clientId,
          clientName: client?.displayName || doc.clientId,
          invoices: [],
          other: [],
          hasActiveAgreement: false,
        });
      }
      
      const group = clientMap.get(doc.clientId)!;
      if (doc.isActiveAgreement) {
        group.hasActiveAgreement = true;
      }
      if (doc.docType === 'invoice' || doc.docType === 'receipt') {
        group.invoices.push(doc);
      } else {
        group.other.push(doc);
      }
    });
    
    const byClient = Array.from(clientMap.values()).sort((a, b) => 
      a.clientName.localeCompare(b.clientName)
    );
    
    return { byClient, noClient };
  }, [documents, clients]);

  const filteredGroupedDocs = useMemo(() => {
    if (!searchQuery) return groupedDocuments;
    
    const lowerSearch = searchQuery.toLowerCase();
    
    const byClient = groupedDocuments.byClient.map(group => ({
      ...group,
      invoices: group.invoices.filter(doc => doc.title.toLowerCase().includes(lowerSearch)),
      other: group.other.filter(doc => doc.title.toLowerCase().includes(lowerSearch)),
    })).filter(group => group.invoices.length > 0 || group.other.length > 0);
    
    const noClient = groupedDocuments.noClient.filter(doc => 
      doc.title.toLowerCase().includes(lowerSearch)
    );
    
    return { byClient, noClient };
  }, [groupedDocuments, searchQuery]);

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
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
    if (!uploadFormData.clientId) {
      toast({ title: "Error", description: "Please select a client", variant: "destructive" });
      return;
    }
    if (!uploadFormData.title.trim()) {
      toast({ title: "Error", description: "Please enter a title", variant: "destructive" });
      return;
    }
    
    try {
      await uploadDocument.mutateAsync({
        file: selectedFile,
        clientId: uploadFormData.clientId,
        title: uploadFormData.title + '.pdf',
        docType: uploadFormData.docType,
        visibility: "client_and_admin",
        isActiveAgreement: uploadFormData.isActiveAgreement,
      });
      toast({ title: "Upload Complete", description: `${uploadFormData.title}.pdf uploaded successfully` });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadFormData({ clientId: "", title: "", docType: "other", isActiveAgreement: false });
      refetch();
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleQuickView = (doc: Document) => {
    setSelectedDocument(doc);
    setPdfModalOpen(true);
  };

  const handleDownload = async (documentId: string, title: string) => {
    try {
      const response = await fetch(`/api/admin/documents/${documentId}/download`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = title;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast({ title: "Download Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleSetActiveAgreement = async (doc: Document, isActive: boolean) => {
    try {
      await updateDocumentMutation.mutateAsync({
        documentId: doc.documentId,
        data: { isActiveAgreement: isActive },
      });
      toast({ 
        title: isActive ? "Active Agreement Set" : "Active Agreement Removed",
        description: isActive 
          ? `${doc.title} is now the active agreement for this client`
          : `${doc.title} is no longer the active agreement`
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const DocumentItem = ({ doc }: { doc: Document }) => (
    <div 
      className={`flex items-center justify-between p-3 bg-white rounded-lg border transition-colors group ${
        doc.isActiveAgreement 
          ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400' 
          : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'
      }`}
      data-testid={`doc-${doc.documentId}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`h-8 w-8 rounded flex items-center justify-center shrink-0 ${
          doc.isActiveAgreement ? 'bg-amber-100 text-amber-600' : 'bg-red-50 text-red-500'
        }`}>
          {doc.isActiveAgreement ? <Star size={16} /> : <FileText size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 truncate" title={doc.title}>{doc.title}</p>
            {doc.isActiveAgreement && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs" data-testid={`badge-active-${doc.documentId}`}>
                Active Agreement
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {formatDate(doc.createdAt)}
            {doc.fileSizeBytes && ` • ${(doc.fileSizeBytes / 1024).toFixed(1)} KB`}
            <span className="ml-2 text-gray-400 capitalize">{doc.docType}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-gray-400 hover:text-blue-500"
          onClick={() => handleQuickView(doc)}
          data-testid={`button-view-${doc.documentId}`}
        >
          <Eye size={16} />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-gray-400 hover:text-blue-500"
          onClick={() => handleDownload(doc.documentId, doc.title)}
          data-testid={`button-download-${doc.documentId}`}
        >
          <Download size={16} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-gray-400 hover:text-gray-600"
              data-testid={`button-more-${doc.documentId}`}
            >
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {doc.isActiveAgreement ? (
              <DropdownMenuItem 
                onClick={() => handleSetActiveAgreement(doc, false)}
                data-testid={`menu-remove-active-${doc.documentId}`}
              >
                <Star className="h-4 w-4 mr-2" />
                Remove Active Agreement
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem 
                onClick={() => handleSetActiveAgreement(doc, true)}
                data-testid={`menu-set-active-${doc.documentId}`}
              >
                <Star className="h-4 w-4 mr-2" />
                Set as Active Agreement
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Documents</h2>
            <p className="text-gray-500">Manage all client documents organized by client.</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="application/pdf"
            onChange={handleFileSelect}
          />
          <Button 
            className="btn-primary-orange" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadDocument.isPending}
            data-testid="button-upload"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload PDF
          </Button>
        </div>

        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload a PDF document for a client
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
                <Label htmlFor="clientId" className="text-right">Client *</Label>
                <Select value={uploadFormData.clientId} onValueChange={(v) => setUploadFormData({ ...uploadFormData, clientId: v })}>
                  <SelectTrigger className="col-span-3" data-testid="select-upload-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map(client => (
                      <SelectItem key={client.clientId} value={client.clientId}>
                        {client.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">Title *</Label>
                <Input 
                  id="title" 
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
                    <SelectItem value="contract">Contract/Lease</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="notice">Notice</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <div className="text-right"></div>
                <div className="col-span-3 flex items-center space-x-2">
                  <Checkbox
                    id="isActiveAgreement"
                    checked={uploadFormData.isActiveAgreement}
                    onCheckedChange={(checked) => 
                      setUploadFormData({ ...uploadFormData, isActiveAgreement: checked as boolean })
                    }
                    data-testid="checkbox-active-agreement"
                  />
                  <Label htmlFor="isActiveAgreement" className="text-sm font-normal cursor-pointer">
                    Set as Active Agreement
                    <span className="block text-xs text-gray-500">
                      This will be shown on the client's dashboard
                    </span>
                  </Label>
                </div>
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

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search documents..." 
              className="pl-9 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <p className="text-sm text-gray-500">
            {documents?.length || 0} documents total
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGroupedDocs.byClient.map(group => (
              <Card key={group.clientId} className="border-gray-200" data-testid={`client-group-${group.clientId}`}>
                <Collapsible open={expandedClients.has(group.clientId)} onOpenChange={() => toggleClient(group.clientId)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedClients.has(group.clientId) ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                          <User className="h-5 w-5 text-blue-500" />
                          <CardTitle className="text-lg">{group.clientName}</CardTitle>
                          {group.hasActiveAgreement && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                              Has Active Agreement
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-gray-500">
                          <span>{group.invoices.length} invoices</span>
                          <span>{group.other.length} other</span>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-6">
                      {group.invoices.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <FolderOpen className="h-4 w-4 text-orange-500" />
                            <h4 className="font-medium text-gray-700">Invoices & Receipts</h4>
                          </div>
                          <div className="space-y-2 pl-6">
                            {group.invoices.map(doc => (
                              <DocumentItem key={doc.documentId} doc={doc} />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {group.other.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <FileArchive className="h-4 w-4 text-gray-500" />
                            <h4 className="font-medium text-gray-700">Other Documents</h4>
                          </div>
                          <div className="space-y-2 pl-6">
                            {group.other.map(doc => (
                              <DocumentItem key={doc.documentId} doc={doc} />
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}

            {filteredGroupedDocs.noClient.length > 0 && (
              <Card className="border-gray-200 border-dashed" data-testid="client-group-unassigned">
                <Collapsible open={expandedClients.has('unassigned')} onOpenChange={() => toggleClient('unassigned')}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedClients.has('unassigned') ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                          <FileArchive className="h-5 w-5 text-gray-400" />
                          <CardTitle className="text-lg text-gray-500">Unassigned Documents</CardTitle>
                        </div>
                        <span className="text-sm text-gray-500">{filteredGroupedDocs.noClient.length} documents</span>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {filteredGroupedDocs.noClient.map(doc => (
                          <DocumentItem key={doc.documentId} doc={doc} />
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            {filteredGroupedDocs.byClient.length === 0 && filteredGroupedDocs.noClient.length === 0 && (
              <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">No documents found</h3>
                  <p className="text-gray-500 text-center max-w-md">
                    {searchQuery 
                      ? "Try adjusting your search terms" 
                      : "Upload your first PDF document to get started"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
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
