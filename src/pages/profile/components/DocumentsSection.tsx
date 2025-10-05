import { useCallback, useMemo, useState } from "react";
import { Eye, FileText, Pencil, Trash2 } from "lucide-react";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Document {
  id: string;
  title: string;
  description: string | null;
  status: string;
  sourceType: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  folderId: string | null;
}

interface FolderOption {
  id: string;
  name: string;
}

interface DocumentsSectionProps {
  documents: Document[];
  folders: FolderOption[];
  onViewDocument: (doc: { id: string; title: string; sourceType: string; content: string }) => void;
  onDeleteDocument: (documentId: string) => void | Promise<void>;
  onRenameDocument: (documentId: string, newTitle: string) => void | Promise<void>;
  onMoveDocument: (documentId: string, folderId: string | null) => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
}

interface Section {
  id: string;
  name: string;
  documents: Document[];
}

export const DocumentsSection = ({
  documents,
  folders,
  onViewDocument,
  onDeleteDocument,
  onRenameDocument,
  onMoveDocument,
  onRefresh,
}: DocumentsSectionProps) => {
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const sections = useMemo(() => {
    const folderMap = new Map<string, Section>();

    folders.forEach((folder) => {
      folderMap.set(folder.id, { id: folder.id, name: folder.name, documents: [] });
    });

    const unfiled: Section = { id: "none", name: "No folder", documents: [] };

    documents.forEach((doc) => {
      const key = doc.folderId ?? "none";
      if (key === "none") {
        unfiled.documents.push(doc);
        return;
      }

      const section = folderMap.get(key);
      if (section) {
        section.documents.push(doc);
      } else {
        folderMap.set(key, {
          id: key,
          name: "Unknown folder",
          documents: [doc],
        });
      }
    });

    const ordered: Section[] = [];
    folderMap.forEach((section) => {
      if (section.documents.length > 0) {
        ordered.push(section);
      }
    });

    if (unfiled.documents.length > 0) {
      ordered.push(unfiled);
    }

    return ordered;
  }, [documents, folders]);

  const getPreviewText = useCallback((metadata: Record<string, unknown>) => {
    const content = (metadata.content as string) || "";
    return content.slice(0, 200) + (content.length > 200 ? "..." : "");
  }, []);

  const closeRenameDialog = useCallback(() => {
    if (isRenaming) return;
    setRenameTarget(null);
    setRenameValue("");
  }, [isRenaming]);

  const handleRenameSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameTarget) return;

    const trimmed = renameValue.trim();

    if (!trimmed) {
      toast.error("Document name cannot be empty");
      return;
    }

    if (trimmed === renameTarget.title) {
      closeRenameDialog();
      toast.info("No changes made");
      return;
    }

    setIsRenaming(true);
    try {
      await Promise.resolve(onRenameDocument(renameTarget.id, trimmed));
      closeRenameDialog();
    } catch (error) {
      console.error("Failed to rename document", error);
    } finally {
      setIsRenaming(false);
    }
  }, [closeRenameDialog, onRenameDocument, renameTarget, renameValue]);

  if (documents.length === 0) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Documents</h2>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-sm font-medium text-primary hover:underline"
            >
              Refresh
            </button>
          )}
        </div>
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
          No documents uploaded yet.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Documents</h2>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="text-sm font-medium text-primary hover:underline"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{section.name}</h3>
              <span className="text-xs text-muted-foreground">{section.documents.length} document{section.documents.length === 1 ? "" : "s"}</span>
            </div>
            <ul className="space-y-3">
              {section.documents.map((doc) => {
                const content = (doc.metadata.content as string) || "";
                return (
                  <li key={doc.id} className="rounded-lg border border-muted-foreground/10 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <p className="font-medium truncate">{doc.title}</p>
                        </div>
                        {doc.description && <p className="text-sm text-muted-foreground mb-2">{doc.description}</p>}
                        <div className="bg-muted/50 rounded p-2 text-xs text-muted-foreground font-mono mb-2">
                          {getPreviewText(doc.metadata)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="rounded-full bg-muted px-2 py-0.5 uppercase tracking-wide">
                            {doc.status}
                          </span>
                          <span className="uppercase">{doc.sourceType}</span>
                          <span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 self-end sm:self-start">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Folder</span>
                          <Select
                            value={doc.folderId ?? "none"}
                            onValueChange={(value) => {
                              void onMoveDocument(doc.id, value === "none" ? null : value);
                            }}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Assign folder" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No folder</SelectItem>
                              {folders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                  {folder.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex items-center gap-1"
                          >
                            <ModelTrainingIcon fontSize="small" className="h-4 w-4" />
                            Study
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRenameTarget({ id: doc.id, title: doc.title });
                              setRenameValue(doc.title);
                            }}
                            className="flex items-center gap-1"
                          >
                            <Pencil className="h-4 w-4" />
                            Rename
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewDocument({ id: doc.id, title: doc.title, sourceType: doc.sourceType, content })}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              void onDeleteDocument(doc.id);
                            }}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <Dialog open={!!renameTarget} onOpenChange={(open) => {
        if (!open) {
          closeRenameDialog();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              autoFocus
              placeholder="Document title"
            />
            <DialogFooter className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeRenameDialog}
                disabled={isRenaming}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isRenaming}>
                {isRenaming ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};
