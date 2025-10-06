import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { DocumentViewer } from "@/components/DocumentViewer";
import { useProfile } from "@/hooks/use-profile";
import GuestUpgradeCallout from "@/components/GuestUpgradeCallout";

import { ProfileCard } from "./components/ProfileCard";
import { FoldersSection } from "./components/FoldersSection";
import { DocumentsSection } from "./components/DocumentsSection";
import { QuestionSetsSection } from "./components/QuestionSetsSection";
import { useProfileHandlers } from "./hooks/useProfileHandlers";
import { mapDocuments, mapStudySets, mapFolders, computeFolderCounts } from "@/utils/profile";

export const ProfilePage = () => {
  const navigate = useNavigate();
  const {
    profile,
    documents,
    studySets,
    folders,
    capabilities,
    isLoading,
    error,
    reload,
    setProfile,
    setDocuments,
    setStudySets,
    setFolders,
  } = useProfile();

  const {
    usernameInput,
    setUsernameInput,
    selectedAvatar,
    setSelectedAvatar,
    isSavingProfile,
    hasChanges,
    viewingDocument,
    openDocument,
    closeDocument,
    handleReviewStudySet,
    handleStudyDocument,
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
  } = useProfileHandlers({
    profile,
    documents,
    folders,
    studySets,
    navigate,
    setProfile,
    setDocuments,
    setFolders,
    setStudySets,
  });

  const documentItems = useMemo(() => mapDocuments(documents), [documents]);
  const studySetItems = useMemo(() => mapStudySets(studySets), [studySets]);
  const folderItems = useMemo(() => mapFolders(folders), [folders]);
  const folderCounts = useMemo(() => computeFolderCounts(folders, documents, studySets), [folders, documents, studySets]);
  const isGuest = capabilities?.role === "guest";

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

        {isGuest && (
          <GuestUpgradeCallout
            description="Guest profiles can explore uploaded content and generate up to two study sets. Create your account to unlock unlimited uploads, study modes, and progress tracking."
          />
        )}

        <FoldersSection
    folders={folderItems}
          folderCounts={folderCounts}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
        />

        <DocumentsSection
          documents={documentItems}
          folders={folderItems}
          onViewDocument={openDocument}
          onStudyDocument={handleStudyDocument}
          onDeleteDocument={handleDeleteDocument}
          onRenameDocument={handleRenameDocument}
          onMoveDocument={handleMoveDocument}
          onRefresh={reload}
          canUseStudyModes={capabilities?.canUseStudyModes ?? true}
          onUpgradeRequest={() => navigate('/auth')}
        />

        <QuestionSetsSection
          studySets={studySetItems}
          folders={folderItems}
          onDeleteStudySet={handleDeleteStudySet}
          onReviewStudySet={handleReviewStudySet}
          onUpdateStudySet={handleUpdateStudySet}
          onMoveStudySet={handleMoveStudySet}
        />
      </div>

      {viewingDocument && (
        <DocumentViewer
          isOpen={!!viewingDocument}
          onClose={closeDocument}
          title={viewingDocument.title}
          content={viewingDocument.content}
          sourceType={viewingDocument.sourceType}
        />
      )}
    </>
  );
};

export default ProfilePage;
