import { useEffect, useState } from "react";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STUDY_SET_LABEL_COLORS } from "../constants";
import { Trash2 } from "lucide-react";

interface QuestionSet {
  id: string;
  title: string;
  createdAt: string;
  topics: string[] | null;
  text: string;
  folderId: string | null;
  labelText: string | null;
  labelColor: string | null;
}

interface FolderOption {
  id: string;
  name: string;
}

interface QuestionSetsSectionProps {
  studySets: QuestionSet[];
  folders: FolderOption[];
  onDeleteStudySet: (studySetId: string) => void | Promise<void>;
  onReviewStudySet: (studySetId: string) => void;
  onUpdateStudySet: (
    studySetId: string,
    updates: { title?: string; labelText?: string | null; labelColor?: string | null },
  ) => void | Promise<void>;
  onMoveStudySet: (studySetId: string, folderId: string | null) => void | Promise<void>;
}

export const QuestionSetsSection = ({
  studySets,
  folders,
  onDeleteStudySet,
  onReviewStudySet,
  onUpdateStudySet,
  onMoveStudySet,
}: QuestionSetsSectionProps) => {
  const [editingSet, setEditingSet] = useState<QuestionSet | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [labelTextInput, setLabelTextInput] = useState("");
  const [labelColor, setLabelColor] = useState<string | null>(null);
  const [folderSelection, setFolderSelection] = useState<string>("none");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!labelTextInput.trim()) {
      setLabelColor(null);
    }
  }, [labelTextInput]);

  const openEditDialog = (studySet: QuestionSet) => {
    setEditingSet(studySet);
    setTitleInput(studySet.title);
    setLabelTextInput(studySet.labelText ?? "");
    setLabelColor(studySet.labelColor ?? null);
    setFolderSelection(studySet.folderId ?? "none");
  };

  const closeEditDialog = () => {
    if (isSubmitting) return;
    setEditingSet(null);
    setTitleInput("");
    setLabelTextInput("");
    setLabelColor(null);
    setFolderSelection("none");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingSet) return;

    const trimmedTitle = titleInput.trim();
    if (!trimmedTitle) {
      return;
    }

    const trimmedLabel = labelTextInput.trim();
    const nextFolderId = folderSelection === "none" ? null : folderSelection;
    const payload = {
      title: trimmedTitle,
      labelText: trimmedLabel ? trimmedLabel : null,
      labelColor: trimmedLabel ? labelColor : null,
      folderId: nextFolderId,
    } as {
      title?: string;
      labelText?: string | null;
      labelColor?: string | null;
      folderId?: string | null;
    };

    setIsSubmitting(true);
    try {
      await Promise.resolve(onUpdateStudySet(editingSet.id, payload));
      closeEditDialog();
    } catch {
      // errors surfaced via handler toast
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!studySets.length) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Question Sets</h2>
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
          No question sets created yet.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Question Sets</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {studySets.map((set) => (
          <div key={set.id} className="rounded-lg border border-muted-foreground/10 bg-card p-4 shadow-sm space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">{set.title}</p>
                    {set.labelText && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: set.labelColor ?? "#64748B" }}
                      >
                        {set.labelText}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                    <span>Created {new Date(set.createdAt).toLocaleString()}</span>
                    <span className="flex items-center gap-1">
                      Folder:
                      <strong className="text-foreground">
                        {set.folderId ? folders.find((f) => f.id === set.folderId)?.name ?? "Unknown" : "None"}
                      </strong>
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 self-end sm:self-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReviewStudySet(set.id)}
                    className="flex items-center gap-1"
                  >
                    <ModelTrainingIcon fontSize="small" className="h-4 w-4" />
                    Review
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(set)}
                    className="flex items-center gap-1"
                  >
                    Rename
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDeleteStudySet(set.id)}
                    className="flex items-center gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Folder</span>
                  <Select
                    value={set.folderId ?? "none"}
                    onValueChange={(value) => {
                      const nextFolderId = value === "none" ? null : value;
                      void onMoveStudySet(set.id, nextFolderId);
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
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
                {set.topics && set.topics.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {set.topics.map((topic) => (
                      <span key={topic} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editingSet} onOpenChange={(open) => {
        if (!open) {
          closeEditDialog();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update study set</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                value={titleInput}
                onChange={(event) => setTitleInput(event.target.value)}
                placeholder="Study set name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Input
                value={labelTextInput}
                onChange={(event) => setLabelTextInput(event.target.value)}
                placeholder="Label (optional)"
              />
            <div className="flex flex-wrap gap-2">
              {STUDY_SET_LABEL_COLORS.map(({ name, value }) => {
                const isActive = labelColor === value;
                return (
                  <button
                      key={value}
                      type="button"
                      onClick={() => setLabelColor(value)}
                      className={`h-8 w-8 rounded-full border-2 transition-shadow focus:outline-none ${isActive ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/70'}`}
                      style={{ backgroundColor: value }}
                      title={name}
                    />
                  );
                })}
                <button
                  type="button"
                  onClick={() => setLabelColor(null)}
                  className="h-8 rounded-full border px-3 text-xs text-muted-foreground hover:border-primary"
                >
                  Clear color
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Folder</span>
              <Select value={folderSelection} onValueChange={setFolderSelection}>
                <SelectTrigger className="w-full">
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
            <DialogFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeEditDialog} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};
