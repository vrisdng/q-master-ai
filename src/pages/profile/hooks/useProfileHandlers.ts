import { useCallback, useEffect, useMemo, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { toast } from "sonner";

import {
  createFolder,
  deleteDocument,
  deleteStudySet,
  moveDocumentToFolder,
  renameDocument,
  renameFolder,
  updateProfile,
  type UserProfile,
} from "@/lib/api";
import { AVATAR_COLOR_VALUE_SET, DEFAULT_AVATAR, FOLDER_NAME_REGEX } from "../constants";

interface UseProfileHandlersParams {
  profile: UserProfile | null;
  reload: () => Promise<void> | void;
  navigate: NavigateFunction;
}

export const useProfileHandlers = ({ profile, reload, navigate }: UseProfileHandlersParams) => {
  const [usernameInput, setUsernameInput] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string>(DEFAULT_AVATAR);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
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
      await Promise.resolve(reload());
    } catch (err) {
      console.error("Failed to create folder", err);
      toast.error(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setIsCreatingFolder(false);
    }
  }, [newFolderName, reload]);

  const handleRenameFolder = useCallback(
    async (folderId: string, currentName: string) => {
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
        await Promise.resolve(reload());
      } catch (err) {
        console.error("Failed to rename folder", err);
        toast.error(err instanceof Error ? err.message : "Failed to rename folder");
      }
    },
    [reload],
  );

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      const confirmed = window.confirm("Delete this document? This action cannot be undone.");
      if (!confirmed) return;

      try {
        await deleteDocument(documentId);
        toast.success("Document deleted");
        await Promise.resolve(reload());
      } catch (err) {
        console.error("Failed to delete document", err);
        toast.error(err instanceof Error ? err.message : "Failed to delete document");
      }
    },
    [reload],
  );

  const handleDeleteStudySet = useCallback(
    async (studySetId: string) => {
      const confirmed = window.confirm("Delete this study set and its questions?");
      if (!confirmed) return;

      try {
        await deleteStudySet(studySetId);
        toast.success("Study set deleted");
        await Promise.resolve(reload());
      } catch (err) {
        console.error("Failed to delete study set", err);
        toast.error(err instanceof Error ? err.message : "Failed to delete study set");
      }
    },
    [reload],
  );

  const handleRenameDocument = useCallback(
    async (documentId: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) {
        toast.error("Document name cannot be empty");
        return;
      }

      try {
        await renameDocument(documentId, trimmed);
        toast.success("Document renamed");
        await Promise.resolve(reload());
      } catch (err) {
        console.error("Failed to rename document", err);
        toast.error(err instanceof Error ? err.message : "Failed to rename document");
        throw err;
      }
    },
    [reload],
  );

  const handleMoveDocument = useCallback(
    async (documentId: string, folderId: string | null) => {
      try {
        await moveDocumentToFolder(documentId, folderId);
        toast.success("Document updated");
        await Promise.resolve(reload());
      } catch (err) {
        console.error("Failed to move document", err);
        toast.error(err instanceof Error ? err.message : "Failed to update document");
      }
    },
    [reload],
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
      toast.success("Profile updated");
      await Promise.resolve(reload());
    } catch (err) {
      console.error("Failed to update profile", err);
      const message = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setIsSavingProfile(false);
    }
  }, [profile, reload, selectedAvatar, usernameInput]);

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
    newFolderName,
    setNewFolderName,
    isCreatingFolder,
    viewingDocument,
    openDocument,
    closeDocument,
    handleReviewStudySet,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteDocument,
    handleDeleteStudySet,
    handleRenameDocument,
    handleMoveDocument,
    handleSaveProfile,
  };
};
