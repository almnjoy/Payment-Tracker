import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Eye, File, Loader2, ArrowLeft, FileCheck, Receipt, Folder, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useClientDocuments, useClientDashboard, formatDate } from "@/lib/api";
import { useLocation } from "wouter";
import { PDFViewerModal } from "@/components/PDFViewerModal";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientDocuments() {
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const asClientId = searchParams.get("asClientId") || undefined;
  const isImpersonating = !!asClientId;
  const [docTypeFilter, setDocTypeFilter] = useState<string>("all");
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ documentId: string; title: string } | null>(null);
  
  const { data: documents, isLoading } = useClientDocuments(asClientId);
  const { data: dashboardData } = useClientDashboard(asClientId);

  const filteredDocuments = documents?.filter(doc => {
    if (docTypeFilter === "all") return true;
    if (docTypeFilter === "agreement") return doc.docType === "agreement";
    if (docTypeFilter === "invoice") return doc.docType === "invoice";
    if (docTypeFilter === "other") return !["agreement", "invoice"].includes(doc.docType || "");
    return true;
  }) || [];

  const activeAgreement = documents?.find(doc => (doc as any).isActiveAgreement);

  const handleDownload = (documentId: string) => {
    const params = asClientId ? `?asClientId=${asClientId}` : '';
    window.open(`/api/client/documents/${documentId}/download${params}`, '_blank');
  };

  const handlePreview = (doc: { documentId: string; title: string }) => {
    setSelectedDocument(doc);
    setPdfModalOpen(true);
  };

  const getDocIcon = (docType: string | null) => {
    switch (docType) {
      case "agreement": return <FileCheck className="h-6 w-6 text-green-600" />;
      case "invoice": return <Receipt className="h-6 w-6 text-blue-600" />;
      default: return <FileText className="h-6 w-6 text-gray-600" />;
    }
  };

  const getDocTypeCount = (type: string) => {
    if (type === "all") return documents?.length || 0;
    if (type === "other") return documents?.filter(d => !["agreement", "invoice"].includes(d.docType || "")).length || 0;
    return documents?.filter(d => d.docType === type).length || 0;
  };

  return (
    <Layout role="client" clientName={dashboardData?.client?.displayName}>
      <div className="space-y-6">
        {isImpersonating && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between" data-testid="impersonation-banner">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Admin Preview Mode</p>
                <p className="text-sm text-amber-700">You are viewing this portal as <strong>{dashboardData?.client?.displayName || 'Client'}</strong></p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/admin/clients/${asClientId}`)}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
              data-testid="button-exit-preview"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Admin
            </Button>
          </div>
        )}
        
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Documents</h2>
          <p className="text-gray-500">Access your leases, receipts, and important notices.</p>
        </div>

        {activeAgreement && (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-900">Active Agreement</p>
                  <p className="text-sm text-green-700">{activeAgreement.title}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-green-300 text-green-700 hover:bg-green-100"
                  onClick={() => handlePreview({ documentId: activeAgreement.documentId, title: activeAgreement.title })}
                  data-testid="button-view-active-agreement"
                >
                  <Eye className="h-4 w-4 mr-2" /> View
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-green-300 text-green-700 hover:bg-green-100"
                  onClick={() => handleDownload(activeAgreement.documentId)}
                  data-testid="button-download-active-agreement"
                >
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : documents && documents.length > 0 ? (
          <div className="space-y-4">
            <Tabs value={docTypeFilter} onValueChange={setDocTypeFilter}>
              <TabsList>
                <TabsTrigger value="all" className="gap-2">
                  <Folder className="h-4 w-4" /> All ({getDocTypeCount("all")})
                </TabsTrigger>
                <TabsTrigger value="agreement" className="gap-2">
                  <FileCheck className="h-4 w-4" /> Agreements ({getDocTypeCount("agreement")})
                </TabsTrigger>
                <TabsTrigger value="invoice" className="gap-2">
                  <Receipt className="h-4 w-4" /> Invoices ({getDocTypeCount("invoice")})
                </TabsTrigger>
                <TabsTrigger value="other" className="gap-2">
                  <FileText className="h-4 w-4" /> Other ({getDocTypeCount("other")})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map((doc, index) => (
                <motion.div
                  key={doc.documentId}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card 
                    className={`hover:shadow-md transition-all group cursor-pointer ${
                      (doc as any).isActiveAgreement 
                        ? 'border-green-300 bg-green-50/30 ring-2 ring-green-100' 
                        : 'border-gray-200'
                    }`} 
                    data-testid={`card-document-${doc.documentId}`}
                  >
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                      <div className={`p-2 rounded-lg transition-colors ${
                        (doc as any).isActiveAgreement 
                          ? 'bg-green-100 group-hover:bg-green-200' 
                          : 'bg-gray-100 group-hover:bg-gray-200'
                      }`}>
                        {getDocIcon(doc.docType)}
                      </div>
                      <div className="flex items-center gap-1">
                        {(doc as any).isActiveAgreement && (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                            Active
                          </Badge>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-gray-400 hover:text-gray-900"
                          onClick={() => handlePreview({ documentId: doc.documentId, title: doc.title })}
                          data-testid={`button-preview-${doc.documentId}`}
                        >
                          <Eye size={16} />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardTitle className="text-base mb-1 truncate" title={doc.title}>{doc.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 text-xs">
                        <span className="capitalize bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{doc.docType || 'document'}</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.fileSizeBytes)}</span>
                        <span>•</span>
                        <span>{formatDate(doc.createdAt)}</span>
                      </CardDescription>
                      
                      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`h-8 gap-2 ${
                            (doc as any).isActiveAgreement 
                              ? 'border-green-200 text-green-700 hover:bg-green-50' 
                              : 'group-hover:border-blue-200 group-hover:text-blue-700'
                          }`}
                          onClick={() => handleDownload(doc.documentId)}
                          data-testid={`button-download-${doc.documentId}`}
                        >
                          <Download size={14} /> Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {filteredDocuments.length === 0 && (
              <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50 flex items-center justify-center min-h-[150px] text-gray-400">
                <div className="text-center">
                  <p className="text-sm font-medium">No {docTypeFilter === "all" ? "" : docTypeFilter} documents</p>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50 flex items-center justify-center min-h-[200px] text-gray-400">
             <div className="text-center">
               <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                 <File className="text-gray-300" />
               </div>
               <p className="text-sm font-medium">No documents available</p>
               <p className="text-xs mt-1">Documents shared with you will appear here</p>
             </div>
          </Card>
        )}
      </div>

      {selectedDocument && (
        <PDFViewerModal
          open={pdfModalOpen}
          onOpenChange={setPdfModalOpen}
          documentId={selectedDocument.documentId}
          title={selectedDocument.title}
          downloadUrl={`/api/client/documents/${selectedDocument.documentId}/download${asClientId ? `?asClientId=${asClientId}` : ''}`}
        />
      )}
    </Layout>
  );
}
