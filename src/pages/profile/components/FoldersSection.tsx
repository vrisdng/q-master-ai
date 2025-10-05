import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";

interface FoldersSectionProps {
  folders: { id: string; name: string }[];
  folderCounts: Map<string, number>;
  newFolderName: string;
  onNewFolderNameChange: (value: string) => void;
  onCreateFolder: () => void;
  isCreatingFolder: boolean;
  onRenameFolder: (folderId: string, currentName: string) => Promise<void> | void;
}

export const FoldersSection = ({
  folders,
  folderCounts,
  newFolderName,
  onNewFolderNameChange,
  onCreateFolder,
  isCreatingFolder,
  onRenameFolder,
}: FoldersSectionProps) => {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Folders</h2>
          <p className="text-sm text-muted-foreground">Group uploaded documents for quick access.</p>
        </div>
        <div className="flex gap-2">
          <Input
            value={newFolderName}
            onChange={(event) => onNewFolderNameChange(event.target.value)}
            placeholder="New folder name"
            className="w-56"
          />
          <Button
            type="button"
            onClick={onCreateFolder}
            disabled={isCreatingFolder}
          >
            {isCreatingFolder ? "Creating…" : "Create"}
          </Button>
        </div>
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
                <p className="text-xs text-muted-foreground">{folderCounts.get(folder.id) ?? 0} document{(folderCounts.get(folder.id) ?? 0) === 1 ? '' : 's'}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex items-center gap-1 self-start"
                onClick={() => void onRenameFolder(folder.id, folder.name)}
              >
                <Pencil className="h-4 w-4" />
                Rename
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
