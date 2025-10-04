import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/use-profile";
import { DocumentViewer } from "@/components/DocumentViewer";
import { Eye, FileText, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { deleteDocument, deleteStudySet, updateProfile } from "@/lib/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AVATAR_COLORS = [
  { name: "Ocean", value: "#2563EB" },
  { name: "Forest", value: "#16A34A" },
  { name: "Sunset", value: "#EA580C" },
  { name: "Lavender", value: "#9333EA" },
  { name: "Rose", value: "#DB2777" },
  { name: "Sky", value: "#0EA5E9" },
] as const;

const AVATAR_COLOR_VALUES = AVATAR_COLORS.map((option) => `color:${option.value}`);
const AVATAR_COLOR_VALUE_SET = new Set(AVATAR_COLOR_VALUES);
const DEFAULT_AVATAR = `color:${AVATAR_COLORS[0].value}`;

const ProfileInfo = ({
  username,
  displayName,
  avatarUrl,
}: {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}) => {
  const initials = (displayName ?? username ?? "?").slice(0, 2).toUpperCase();
  const colorValue = avatarUrl?.startsWith("color:") ? avatarUrl.replace("color:", "") : null;
  const colorAvatar = colorValue && /^#[0-9A-Fa-f]{6}$/.test(colorValue) ? colorValue : null;

  const renderAvatar = () => {
    if (colorAvatar) {
      return (
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white shadow-soft"
          style={{ backgroundColor: colorAvatar }}
        >
          {initials}
        </div>
      );
    }

    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={displayName ?? username ?? "User avatar"}
          className="h-16 w-16 rounded-full object-cover"
        />
      );
    }

    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
        {initials}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-muted-foreground/10 bg-muted/40 p-4">
      {renderAvatar()}
      <div>
        <p className="text-lg font-semibold">{displayName ?? username ?? "Anonymous"}</p>
        {username && <p className="text-sm text-muted-foreground">@{username}</p>}
      </div>
    </div>
  );
};

const DocumentList = ({
  documents,
  onViewDocument,
  onDeleteDocument,
}: {
  documents: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    sourceType: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }[];
  onViewDocument: (doc: { id: string; title: string; sourceType: string; content: string }) => void;
  onDeleteDocument: (documentId: string) => void;
}) => {
  if (!documents.length) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
        No documents uploaded yet.
      </div>
    );
  }

  const getPreviewText = (metadata: Record<string, unknown>) => {
    const content = (metadata.content as string) || "";
    return content.slice(0, 200) + (content.length > 200 ? "..." : "");
  };

  return (
    <ul className="space-y-3">
      {documents.map((doc) => {
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
              <div className="flex gap-2 self-end sm:self-start">
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
                  onClick={() => onDeleteDocument(doc.id)}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const StudySetList = ({
  studySets,
  onDeleteStudySet,
}: {
  studySets: {
    id: string;
    title: string;
    createdAt: string;
    topics: string[] | null;
    text: string;
  }[];
  onDeleteStudySet: (studySetId: string) => void;
}) => {
  if (!studySets.length) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
        No question sets created yet.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {studySets.map((set) => {
        const preview = set.text.slice(0, 200) + (set.text.length > 200 ? "…" : "");

        return (
          <li key={set.id} className="rounded-lg border border-muted-foreground/10 bg-card p-4 shadow-sm space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{set.title}</p>
                <p className="text-xs text-muted-foreground">Created {new Date(set.createdAt).toLocaleString()}</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDeleteStudySet(set.id)}
                className="flex items-center gap-1 self-end sm:self-start"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
            <div className="bg-muted/50 rounded p-2 text-xs text-muted-foreground font-mono whitespace-pre-wrap">
              {preview}
            </div>
            {set.topics && set.topics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {set.topics.map((topic) => (
                  <span key={topic} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export const ProfilePage = () => {
  const { profile, documents, studySets, isLoading, error, reload } = useProfile();
  const [viewingDocument, setViewingDocument] = useState<{
    id: string;
    title: string;
    sourceType: string;
    content: string;
  } | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string>(DEFAULT_AVATAR);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsernameInput(profile.username ?? "");
    const candidate = profile.avatarUrl ?? "";
    setSelectedAvatar(AVATAR_COLOR_VALUE_SET.has(candidate) ? candidate : DEFAULT_AVATAR);
  }, [profile]);

  const handleDeleteDocument = async (documentId: string) => {
    const confirmed = window.confirm("Delete this document? This action cannot be undone.");
    if (!confirmed) return;

    try {
      await deleteDocument(documentId);
      toast.success("Document deleted");
      await reload();
    } catch (err) {
      console.error("Failed to delete document", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  const handleDeleteStudySet = async (studySetId: string) => {
    const confirmed = window.confirm("Delete this study set and its questions?");
    if (!confirmed) return;

    try {
      await deleteStudySet(studySetId);
      toast.success("Study set deleted");
      await reload();
    } catch (err) {
      console.error("Failed to delete study set", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete study set");
    }
  };

  const handleSaveProfile = async () => {
    const normalizedUsername = usernameInput.trim().toLowerCase();
    const currentAvatar = AVATAR_COLOR_VALUE_SET.has(profile?.avatarUrl ?? "")
      ? (profile?.avatarUrl as string)
      : DEFAULT_AVATAR;

    if (!normalizedUsername) {
      toast.error("Username cannot be empty");
      return;
    }

    if (normalizedUsername.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    if (normalizedUsername.length > 20) {
      toast.error("Username must be 20 characters or less");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
      toast.error("Use lowercase letters, numbers, or underscores only");
      return;
    }

    if (
      normalizedUsername === (profile?.username ?? "").toLowerCase() &&
      selectedAvatar === currentAvatar
    ) {
      toast.info("No changes to save");
      return;
    }

    const avatarValue = AVATAR_COLOR_VALUE_SET.has(selectedAvatar)
      ? selectedAvatar
      : DEFAULT_AVATAR;

    setIsSavingProfile(true);
    try {
      await updateProfile({
        username: normalizedUsername,
        avatarUrl: avatarValue,
      });
      toast.success("Profile updated");
      await reload();
    } catch (err) {
      console.error("Failed to update profile", err);
      const message = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <p className="text-sm text-destructive">Failed to load profile: {error.message}</p>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <p className="text-sm text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  const normalizedUsername = usernameInput.trim().toLowerCase();
  const currentAvatar = AVATAR_COLOR_VALUE_SET.has(profile.avatarUrl ?? "")
    ? (profile.avatarUrl as string)
    : DEFAULT_AVATAR;
  const originalUsername = (profile.username ?? "").toLowerCase();
  const hasChanges = normalizedUsername !== originalUsername || selectedAvatar !== currentAvatar;

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <section>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Your Profile</h1>
              <p className="text-sm text-muted-foreground">Manage your account and review your study assets.</p>
            </div>
            <ThemeToggle />
          </div>
          <div className="mt-4">
            <ProfileInfo
              username={profile.username}
              displayName={profile.displayName}
              avatarUrl={profile.avatarUrl}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Account Settings</h2>
          <div className="space-y-6 rounded-lg border border-muted-foreground/10 bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={usernameInput}
                onChange={(event) => setUsernameInput(event.target.value)}
                placeholder="yourname"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Between 3 and 20 characters. Use lowercase letters, numbers, or underscores.
              </p>
            </div>

            <div className="space-y-3">
              <Label>Avatar Color</Label>
              <div className="flex flex-wrap gap-4">
                {AVATAR_COLORS.map(({ name, value }) => {
                  const optionValue = `color:${value}`;
                  const isActive = selectedAvatar === optionValue;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSelectedAvatar(optionValue)}
                      className="group flex flex-col items-center gap-2 focus:outline-none"
                    >
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-shadow ${isActive ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/70'}`}
                        style={{ backgroundColor: value }}
                      >
                        {isActive && <Check className="h-5 w-5 text-white" />}
                      </span>
                      <span className="text-xs text-muted-foreground">{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile || !hasChanges}
                className="gap-2"
              >
                {isSavingProfile ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Documents</h2>
            <button
              type="button"
              onClick={reload}
              className="text-sm font-medium text-primary hover:underline"
            >
              Refresh
            </button>
          </div>
          <DocumentList
            documents={documents.map((doc) => ({
              id: doc.id,
              title: doc.title,
              description: doc.description,
              status: doc.status,
              sourceType: doc.sourceType,
              createdAt: doc.createdAt,
              metadata: doc.metadata,
            }))}
            onViewDocument={setViewingDocument}
            onDeleteDocument={handleDeleteDocument}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Question Sets</h2>
          <StudySetList
            studySets={studySets.map((set) => ({
              id: set.id,
              title: set.title,
              createdAt: set.createdAt,
              topics: set.topics,
              text: set.text,
            }))}
            onDeleteStudySet={handleDeleteStudySet}
          />
        </section>
      </div>

      {viewingDocument && (
        <DocumentViewer
          isOpen={!!viewingDocument}
          onClose={() => setViewingDocument(null)}
          title={viewingDocument.title}
          content={viewingDocument.content}
          sourceType={viewingDocument.sourceType}
        />
      )}
    </>
  );
};

export default ProfilePage;
