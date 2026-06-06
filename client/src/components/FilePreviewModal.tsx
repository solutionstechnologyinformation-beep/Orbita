import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileText, Image as ImageIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    name: string;
    url: string;
    type?: string;
  } | null;
}

export function FilePreviewModal({ open, onOpenChange, file }: FilePreviewModalProps) {
  if (!file) return null;

  const getMimeType = (url: string) => {
    if (url.includes('.pdf')) return 'application/pdf';
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image/*';
    return 'application/octet-stream';
  };

  const mimeType = file.type || getMimeType(file.url);
  const isPdf = mimeType === 'application/pdf';
  const isImage = mimeType.startsWith('image/');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPdf ? <FileText className="w-5 h-5" /> : isImage ? <ImageIcon className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {file.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto bg-muted/30 rounded-lg">
          {isPdf ? (
            <iframe
              src={file.url}
              className="w-full h-full border-0"
              title={file.name}
            />
          ) : isImage ? (
            <div className="flex items-center justify-center p-4 h-full">
              <img
                src={file.url}
                alt={file.name}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
              <FileText className="w-16 h-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Tipo de arquivo não suportado para preview</p>
              <Button asChild>
                <a href={file.url} download={file.name}>
                  <Download className="w-4 h-4 mr-2" /> Download
                </a>
              </Button>
            </div>
          )}
        </div>

        {!isPdf && !isImage && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button asChild>
              <a href={file.url} download={file.name}>
                <Download className="w-4 h-4 mr-2" /> Download
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
