import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { DocumentViewer } from "@/components/DocumentViewer";
import { useProfile } from "@/hooks/use-profile";
import {
  createFolder,
  deleteDocument,
  deleteStudySet,
  moveDocumentToFolder,
  renameDocument,
  renameFolder,
  updateProfile,
  ProfileDocument,
  ProfileStudySet,
  ProfileFolder,
} from "@/lib/api";

import { ProfileCard } from "./components/ProfileCard";
import { FoldersSection } from "./components/FoldersSection";
import { DocumentsSection } from "./components/DocumentsSection";
import { QuestionSetsSection } from "./components/QuestionSetsSection";
import { AVATAR_COLOR_VALUE_SET, DEFAULT_AVATAR, FOLDER_NAME_REGEX } from "./constants";

export const ProfilePage = () => {
  const navigate = useNavigate();
  const { profile, documents, studySets, folders, isLoading, error, reload } = useProfile();
  const [viewingDocument, setViewingDocument] = useState<{
    id: string;
    title: string;
    sourceType: string;
    content: string;
  } | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string>(DEFAULT_AVATAR);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsernameInput(profile.username ?? "");
    const candidate = profile.avatarUrl ?? "";
    setSelectedAvatar(AVATAR_COLOR_VALUE_SET.has(candidate) ? candidate : DEFAULT_AVATAR);
  }, [profile]);

  const handleReviewStudySet = useCallback((studySetId: string) => {
    navigate('/', { state: { studySetId } });
  }, [navigate]);

  const handleCreateFolder = useCallback(async () => {
    const trimmed = newFolderName.trim();

    if (!trimmed) {
      toast.error("Folder name cannot be empty");
      return;
    }

    if (!FOLDER_NAME_REGEX.test(trimmed)) {
      toast.error("Folder name can include letters, numbers, spaces, hyphens, and underscores only");
      return;
    }

    setIsCreatingFolder(true);
    try {
      await createFolder(trimmed);
      toast.success("Folder created");
      setNewFolderName("");
      await reload();
    } catch (err) {
      console.error("Failed to create folder", err);
      toast.error(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setIsCreatingFolder(false);
    }
  }, [newFolderName, reload]);

  const handleRenameFolder = useCallback(async (folderId: string, currentName: string) => {
    const next = window.prompt("Rename folder", currentName);
    if (next === null) return;

    const trimmed = next.trim();
    if (!trimmed) {
      toast.error("Folder name cannot be empty");
      return;
    }

    if (trimmed === currentName) {
      toast.info("No changes detected");
      return;
    }

    if (!FOLDER_NAME_REGEX.test(trimmed)) {
      toast.error("Folder name can include letters, numbers, spaces, hyphens, and underscores only");
      return;
    }

    try {
      await renameFolder(folderId, trimmed);
      toast.success("Folder renamed");
      await reload();
    } catch (err) {
      console.error("Failed to rename folder", err);
      toast.error(err instanceof Error ? err.message : "Failed to rename folder");
    }
  }, [reload]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
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
  }, [reload]);

  const handleDeleteStudySet = useCallback(async (studySetId: string) => {
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
  }, [reload]);

  const handleRenameDocument = useCallback(async (documentId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      toast.error("Document name cannot be empty");
      return;
    }

    try {
      await renameDocument(documentId, trimmed);
      toast.success("Document renamed");
      await reload();
    } catch (err) {
      console.error("Failed to rename document", err);
      toast.error(err instanceof Error ? err.message : "Failed to rename document");
      throw err;
    }
  }, [reload]);

  const handleMoveDocument = useCallback(async (documentId: string, folderId: string | null) => {
    try {
      await moveDocumentToFolder(documentId, folderId);
      toast.success("Document updated");
      await reload();
    } catch (err) {
      console.error("Failed to move document", err);
      toast.error(err instanceof Error ? err.message : "Failed to update document");
    }
  }, [reload]);

  const handleSaveProfile = useCallback(async () => {
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
  }, [usernameInput, profile?.avatarUrl, profile?.username, selectedAvatar, reload]);

  const documentItems = useMemo(
    () => mapDocuments(documents),
    [documents]
  );

  const studySetItems = useMemo(
    () => mapStudySets(studySets),
    [studySets]
  );

  const folderItems = useMemo(
    () => mapFolders(folders),
    [folders]
  );

  const folderCounts = useMemo(() => computeFolderCounts(folders, documents), [folders, documents]);

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
        <ProfileCard
          profile={profile}
          usernameInput={usernameInput}
          onUsernameChange={setUsernameInput}
          selectedAvatar={selectedAvatar}
          onAvatarChange={setSelectedAvatar}
          onSave={handleSaveProfile}
          isSaving={isSavingProfile}
          hasChanges={hasChanges}
        />

        <FoldersSection
          folders={folderItems}
          folderCounts={folderCounts}
          newFolderName={newFolderName}
          onNewFolderNameChange={setNewFolderName}
          onCreateFolder={handleCreateFolder}
          isCreatingFolder={isCreatingFolder}
          onRenameFolder={handleRenameFolder}
        />

        <DocumentsSection
          documents={documentItems}
          folders={folderItems}
          onViewDocument={setViewingDocument}
          onDeleteDocument={handleDeleteDocument}
          onRenameDocument={handleRenameDocument}
          onMoveDocument={handleMoveDocument}
          onRefresh={reload}
        />

        <QuestionSetsSection
          studySets={studySetItems}
          onDeleteStudySet={handleDeleteStudySet}
          onReviewStudySet={handleReviewStudySet}
        />
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

const mapDocuments = (documents: ProfileDocument[]) =>
  documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    sourceType: doc.sourceType,
    createdAt: doc.createdAt,
    metadata: doc.metadata,
    folderId: doc.folderId,
  }));

const mapStudySets = (studySets: ProfileStudySet[]) =>
  studySets.map((set) => ({
    id: set.id,
    title: set.title,
    createdAt: set.createdAt,
    topics: set.topics,
    text: set.text,
  }));

const mapFolders = (folders: ProfileFolder[]) =>
  folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
  }));

const computeFolderCounts = (folders: ProfileFolder[], documents: ProfileDocument[]) => {
  const counts = new Map<string, number>();
  folders.forEach((folder) => counts.set(folder.id, 0));
  documents.forEach((doc) => {
    if (doc.folderId) {
      counts.set(doc.folderId, (counts.get(doc.folderId) ?? 0) + 1);
    }
  });
  return counts;
};

export default ProfilePage;
