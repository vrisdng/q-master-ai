import { useCallback, useEffect, useMemo, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { toast } from "sonner";

import {
  createFolder,
  deleteDocument,
  deleteStudySet,
  deleteFolder,
  clearFolderAssignments,
  moveDocumentToFolder,
  renameDocument,
  renameFolder,
  updateProfile,
  updateStudySet,
  type UserProfile,
  type ProfileDocument,
  type ProfileFolder,
  type ProfileStudySet,
} from "@/lib/api";
import { AVATAR_COLOR_VALUE_SET, DEFAULT_AVATAR, FOLDER_NAME_REGEX, type StudyMode } from "../constants";

interface UseProfileHandlersParams {
  profile: UserProfile | null;
  documents: ProfileDocument[];
  folders: ProfileFolder[];
  studySets: ProfileStudySet[];
  navigate: NavigateFunction;
  setProfile: (updater: (profile: UserProfile | null) => UserProfile | null) => void;
  setDocuments: (updater: (documents: ProfileDocument[]) => ProfileDocument[]) => void;
  setFolders: (updater: (folders: ProfileFolder[]) => ProfileFolder[]) => void;
  setStudySets: (updater: (studySets: ProfileStudySet[]) => ProfileStudySet[]) => void;
}

export const useProfileHandlers = ({
  profile,
  documents,
  folders,
  studySets,
  navigate,
  setProfile,
  setDocuments,
  setFolders,
  setStudySets,
}: UseProfileHandlersParams) => {
  const [usernameInput, setUsernameInput] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string>(DEFAULT_AVATAR);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<{
    id: string;
    title: string;
    sourceType: string;
    content: string;
  } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setUsernameInput(profile.username ?? "");
    const candidate = profile.avatarUrl ?? "";
    setSelectedAvatar(AVATAR_COLOR_VALUE_SET.has(candidate) ? candidate : DEFAULT_AVATAR);
  }, [profile]);

  const handleReviewStudySet = useCallback(
    (studySetId: string) => {
      navigate("/", { state: { studySetId } });
    },
    [navigate],
  );

  const handleStudyDocument = useCallback(
    (documentId: string, mode: StudyMode) => {
      switch (mode) {
        case "summary":
          navigate(`/study/${documentId}`);
          break;
        case "elaboration":
          navigate(`/study/${documentId}/elaboration`);
          break;
        case "self-explanation":
          navigate(`/study/${documentId}/self-explanation`);
          break;
        case "feynman":
          navigate(`/study/${documentId}/feynman`);
          break;
        case "test":
          navigate(`/study/${documentId}/test`);
          break;
        default:
          navigate(`/study/${documentId}`);
          break;
      }
    },
    [navigate],
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      const trimmed = name.trim();

      if (!trimmed) {
        const message = "Folder name cannot be empty";
        toast.error(message);
        throw new Error(message);
      }

      if (!FOLDER_NAME_REGEX.test(trimmed)) {
        const message = "Folder name can include letters, numbers, spaces, hyphens, and underscores only";
        toast.error(message);
        throw new Error(message);
      }

      const folderId = await createFolder(trimmed);
      const now = new Date().toISOString();
      setFolders((prev) => [
        ...prev,
        {
          id: folderId,
          ownerId: profile?.id ?? "",
          name: trimmed,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      toast.success("Folder created");
    },
    [profile?.id, setFolders],
  );

  const handleRenameFolder = useCallback(
    async (folderId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        const message = "Folder name cannot be empty";
        toast.error(message);
        throw new Error(message);
      }

      if (!FOLDER_NAME_REGEX.test(trimmed)) {
        const message = "Folder name can include letters, numbers, spaces, hyphens, and underscores only";
        toast.error(message);
        throw new Error(message);
      }

      const now = new Date().toISOString();

      const previousFolders = folders;
      setFolders((prev) =>
        prev.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                name: trimmed,
                updatedAt: now,
              }
            : folder,
        ),
      );

      try {
        await renameFolder(folderId, trimmed);
        toast.success("Folder renamed");
      } catch (err) {
        console.error("Failed to rename folder", err);
        toast.error(err instanceof Error ? err.message : "Failed to rename folder");
        setFolders(() => previousFolders);
        throw err;
      }
    },
    [folders, setFolders],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string, folderName: string) => {
      const confirmed = window.confirm(
        `Delete folder "${folderName}"? Documents inside will remain but lose their folder assignment.`,
      );
      if (!confirmed) return;

      const previousFolders = folders;
      const previousDocuments = documents;

      setFolders((prev) => prev.filter((folder) => folder.id !== folderId));
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.folderId === folderId
            ? {
                ...doc,
                folderId: null,
              }
            : doc,
        ),
      );

      try {
        await clearFolderAssignments(folderId);
        await deleteFolder(folderId);
        toast.success("Folder deleted");
      } catch (err) {
        console.error("Failed to delete folder", err);
        toast.error(err instanceof Error ? err.message : "Failed to delete folder");
        setFolders(() => previousFolders);
        setDocuments(() => previousDocuments);
      }
    },
    [documents, folders, setDocuments, setFolders],
  );

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      const confirmed = window.confirm("Delete this document? This action cannot be undone.");
      if (!confirmed) return;

      const previousDocuments = documents;
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));

      try {
        await deleteDocument(documentId);
        toast.success("Document deleted");
      } catch (err) {
        console.error("Failed to delete document", err);
        toast.error(err instanceof Error ? err.message : "Failed to delete document");
        setDocuments(() => previousDocuments);
      }
    },
    [documents, setDocuments],
  );

  const handleDeleteStudySet = useCallback(
    async (studySetId: string) => {
      const confirmed = window.confirm("Delete this study set and its questions?");
      if (!confirmed) return;

      const previousStudySets = studySets;
      setStudySets((prev) => prev.filter((set) => set.id !== studySetId));

      try {
        await deleteStudySet(studySetId);
        toast.success("Study set deleted");
      } catch (err) {
        console.error("Failed to delete study set", err);
        toast.error(err instanceof Error ? err.message : "Failed to delete study set");
        setStudySets(() => previousStudySets);
      }
    },
    [setStudySets, studySets],
  );

  const handleRenameDocument = useCallback(
    async (documentId: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) {
        toast.error("Document name cannot be empty");
        return;
      }

      const previousTitle = documents.find((doc) => doc.id === documentId)?.title ?? "";

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId
            ? {
                ...doc,
                title: trimmed,
                updatedAt: new Date().toISOString(),
              }
            : doc,
        ),
      );

      try {
        await renameDocument(documentId, trimmed);
        toast.success("Document renamed");
      } catch (err) {
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  title: previousTitle,
                }
              : doc,
          ),
        );
        console.error("Failed to rename document", err);
        toast.error(err instanceof Error ? err.message : "Failed to rename document");
        throw err;
      }
    },
    [documents, setDocuments],
  );

  const handleMoveDocument = useCallback(
    async (documentId: string, folderId: string | null) => {
      const previousFolderId = documents.find((doc) => doc.id === documentId)?.folderId ?? null;

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId
            ? {
                ...doc,
                folderId,
                updatedAt: new Date().toISOString(),
              }
            : doc,
        ),
      );

      try {
        await moveDocumentToFolder(documentId, folderId);
        toast.success("Document updated");
      } catch (err) {
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  folderId: previousFolderId,
                }
              : doc,
          ),
        );
        console.error("Failed to move document", err);
        toast.error(err instanceof Error ? err.message : "Failed to update document");
      }
    },
    [documents, setDocuments],
  );

  const handleUpdateStudySet = useCallback(
    async (
      studySetId: string,
      updates: { title?: string; labelText?: string | null; labelColor?: string | null; folderId?: string | null },
    ) => {
      const previous = studySets;
      const trimmedTitle =
        typeof updates.title === "string" ? updates.title.trim() : undefined;

      if (typeof trimmedTitle !== "undefined" && trimmedTitle.length === 0) {
        const message = "Study set name cannot be empty";
        toast.error(message);
        throw new Error(message);
      }

      setStudySets((prev) =>
        prev.map((set) =>
          set.id === studySetId
            ? {
                ...set,
                title: typeof trimmedTitle !== "undefined" ? trimmedTitle : set.title,
                labelText:
                  typeof updates.labelText !== "undefined" ? updates.labelText : set.labelText,
                labelColor:
                  typeof updates.labelColor !== "undefined" ? updates.labelColor : set.labelColor,
                folderId:
                  typeof updates.folderId !== "undefined" ? updates.folderId : set.folderId,
              }
            : set,
        ),
      );

      try {
        await updateStudySet(studySetId, {
          title: trimmedTitle,
          labelText: updates.labelText,
          labelColor: updates.labelColor,
          folderId: updates.folderId,
        });
        toast.success("Study set updated");
      } catch (err) {
        console.error("Failed to update study set", err);
        toast.error(err instanceof Error ? err.message : "Failed to update study set");
        setStudySets(() => previous);
        throw err;
      }
    },
    [setStudySets, studySets],
  );

  const handleMoveStudySet = useCallback(
    async (studySetId: string, folderId: string | null) => {
      const previous = studySets;
      setStudySets((prev) =>
        prev.map((set) =>
          set.id === studySetId
            ? {
                ...set,
                folderId,
              }
            : set,
        ),
      );

      try {
        await updateStudySet(studySetId, { folderId });
        toast.success("Study set updated");
      } catch (err) {
        console.error("Failed to update study set", err);
        toast.error(err instanceof Error ? err.message : "Failed to update study set");
        setStudySets(() => previous);
      }
    },
    [setStudySets, studySets],
  );

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
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              username: normalizedUsername,
              avatarUrl: avatarValue,
              updatedAt: new Date().toISOString(),
            }
          : prev,
      );
      toast.success("Profile updated");
    } catch (err) {
      console.error("Failed to update profile", err);
      const message = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setIsSavingProfile(false);
    }
  }, [profile, selectedAvatar, setProfile, usernameInput]);

  const openDocument = useCallback(
    (doc: { id: string; title: string; sourceType: string; content: string }) => {
      setViewingDocument(doc);
    },
    [],
  );

  const closeDocument = useCallback(() => {
    setViewingDocument(null);
  }, []);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    const normalizedUsername = usernameInput.trim().toLowerCase();
    const originalUsername = (profile.username ?? "").toLowerCase();
    const currentAvatar = AVATAR_COLOR_VALUE_SET.has(profile.avatarUrl ?? "")
      ? (profile.avatarUrl as string)
      : DEFAULT_AVATAR;

    return normalizedUsername !== originalUsername || selectedAvatar !== currentAvatar;
  }, [profile, selectedAvatar, usernameInput]);

  return {
    usernameInput,
    setUsernameInput,
    selectedAvatar,
    setSelectedAvatar,
    isSavingProfile,
    hasChanges,
    viewingDocument,
    openDocument,
    closeDocument,
    handleStudyDocument,
    handleReviewStudySet,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleDeleteDocument,
    handleDeleteStudySet,
    handleRenameDocument,
    handleMoveDocument,
    handleUpdateStudySet,
    handleMoveStudySet,
    handleSaveProfile,
  };
};
