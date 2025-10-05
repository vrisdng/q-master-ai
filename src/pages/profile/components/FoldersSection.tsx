import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";

interface FoldersSectionProps {
  folders: { id: string; name: string }[];
  folderCounts: Map<string, { documents: number; studySets: number }>;
  onCreateFolder: (name: string) => Promise<void> | void;
  onRenameFolder: (folderId: string, newName: string) => Promise<void> | void;
  onDeleteFolder: (folderId: string, folderName: string) => Promise<void> | void;
}

export const FoldersSection = ({
  folders,
  folderCounts,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: FoldersSectionProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);

  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenameSubmitting, setIsRenameSubmitting] = useState(false);

  const handleCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreateSubmitting(true);
    try {
      await Promise.resolve(onCreateFolder(createName));
      setIsCreateOpen(false);
      setCreateName("");
    } catch {
      // errors are surfaced via toasts in handlers
    } finally {
      setIsCreateSubmitting(false);
    }
  };

  const handleRenameSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameTarget) return;
    setIsRenameSubmitting(true);
    try {
      await Promise.resolve(onRenameFolder(renameTarget.id, renameValue));
      setRenameTarget(null);
      setRenameValue("");
    } catch {
      // handler already notifies
    } finally {
      setIsRenameSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Folders</h2>
          <p className="text-sm text-muted-foreground">Group uploaded documents for quick access.</p>
        </div>
        <Button type="button" onClick={() => setIsCreateOpen(true)}>
          Create
        </Button>
      </div>

      {folders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground">
          No folders yet. Create one to start organising your documents.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((folder) => (
            <li key={folder.id} className="rounded-lg border border-muted-foreground/10 bg-card p-4 shadow-sm flex flex-col gap-3">
              <div>
                <p className="font-medium truncate">{folder.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const counts = folderCounts.get(folder.id) ?? { documents: 0, studySets: 0 };
                    const docLabel = `${counts.documents} document${counts.documents === 1 ? "" : "s"}`;
                    const setLabel = `${counts.studySets} study set${counts.studySets === 1 ? "" : "s"}`;
                    return `${docLabel} • ${setLabel}`;
                  })()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={() => {
                    setRenameTarget({ id: folder.id, name: folder.name });
                    setRenameValue(folder.name);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Rename
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={() => void onDeleteFolder(folder.id, folder.name)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) {
          setCreateName("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create folder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="Folder name"
              autoFocus
            />
            <DialogFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreateSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreateSubmitting}>
                {isCreateSubmitting ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(open) => {
        if (!open) {
          setRenameTarget(null);
          setRenameValue("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              autoFocus
              placeholder="Folder name"
            />
            <DialogFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)} disabled={isRenameSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isRenameSubmitting}>
                {isRenameSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};
