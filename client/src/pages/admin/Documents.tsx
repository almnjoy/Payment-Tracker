import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Folder, Search, Loader2, Download, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAdminDocuments, useUploadDocument, formatDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function AdminDocuments() {
  const { toast } = useToast();
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: documents, isLoading, refetch } = useAdminDocuments();
  const uploadDocument = useUploadDocument();

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    try {
      await uploadDocument.mutateAsync({
        file,
        title: file.name,
        docType: getDocType(file.name),
        visibility: "admin_only",
      });
      toast({ title: "Upload Complete", description: `${file.name} uploaded successfully` });
      refetch();
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    }
  };

  const getDocType = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.includes("lease") || lower.includes("agreement")) return "contract";
    if (lower.includes("receipt") || lower.includes("invoice")) return "receipt";
    if (lower.includes("notice")) return "notice";
    return "other";
  };

  const handleDownload = async (documentId: string, title: string) => {
    try {
      const response = await fetch(`/api/admin/documents/${documentId}/download`);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const filteredDocuments = documents?.filter(doc => {
    const matchesSearch = searchQuery === "" || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = selectedFolder === "all" || doc.docType === selectedFolder;
    return matchesSearch && matchesFolder;
  }) || [];

  const folders = [
    { id: "all", label: "All Files", count: documents?.length || 0 },
    { id: "contract", label: "Leases", count: documents?.filter(d => d.docType === "contract").length || 0 },
    { id: "receipt", label: "Receipts", count: documents?.filter(d => d.docType === "receipt").length || 0 },
    { id: "notice", label: "Notices", count: documents?.filter(d => d.docType === "notice").length || 0 },
    { id: "other", label: "Other", count: documents?.filter(d => d.docType === "other").length || 0 },
  ];

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Documents</h2>
            <p className="text-gray-500">Manage all client documents and files.</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          />
          <Button 
            className="btn-primary-orange" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadDocument.isPending}
            data-testid="button-upload"
          >
            {uploadDocument.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload Document
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card className="md:col-span-1 border-gray-200 h-fit">
            <CardContent className="p-4 space-y-1">
              {folders.map(folder => (
                <Button 
                  key={folder.id}
                  variant="ghost" 
                  className={`w-full justify-start ${selectedFolder === folder.id ? 'font-medium bg-blue-50 text-blue-700' : 'text-gray-600'}`}
                  onClick={() => setSelectedFolder(folder.id)}
                  data-testid={`folder-${folder.id}`}
                >
                  <Folder className={`mr-2 h-4 w-4 ${selectedFolder === folder.id ? 'fill-blue-200' : ''}`} />
                  {folder.label}
                  <span className="ml-auto text-xs text-gray-400">{folder.count}</span>
                </Button>
              ))}
            </CardContent>
          </Card>
           
          <div className="md:col-span-3 space-y-4">
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search documents..." 
                  className="pl-9 bg-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div 
                  className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-gray-400 transition-colors cursor-pointer bg-gray-50/30 ${
                    isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  data-testid="dropzone"
                >
                  <Upload className="h-8 w-8 mb-2" />
                  <span className="text-sm font-medium">
                    {uploadDocument.isPending ? "Uploading..." : "Drop files to upload"}
                  </span>
                </div>

                {filteredDocuments.map((doc) => (
                  <Card key={doc.documentId} className="group hover:shadow-md transition-shadow" data-testid={`doc-${doc.documentId}`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500 mb-3">
                          <FileText size={20} />
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-gray-400 hover:text-blue-500"
                            onClick={() => handleDownload(doc.documentId, doc.title)}
                            data-testid={`button-download-${doc.documentId}`}
                          >
                            <Download size={16} />
                          </Button>
                        </div>
                      </div>
                      <h3 className="font-medium text-gray-900 truncate" title={doc.title}>{doc.title}</h3>
                      <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                        <span>{doc.fileSizeBytes ? `${(doc.fileSizeBytes / 1024).toFixed(1)} KB` : ''}</span>
                        <span>{formatDate(doc.createdAt)}</span>
                      </div>
                      <div className="mt-3 text-xs bg-gray-100 inline-block px-2 py-1 rounded text-gray-600 capitalize">
                        {doc.docType}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredDocuments.length === 0 && !isLoading && (
                  <div className="col-span-full text-center py-12 text-gray-400">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-gray-900">No documents found</p>
                    <p className="text-sm mt-1">Upload your first document to get started.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
