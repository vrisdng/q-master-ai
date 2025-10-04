import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface IDocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  sourceType: string;
}

export const DocumentViewer = ({ isOpen, onClose, title, content, sourceType }: IDocumentViewerProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {sourceType}
            </span>
            <span className="text-muted-foreground">|</span>
            <span>{title}</span>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
          <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {content}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
