import { useCallback, useEffect, useState } from "react";
import { fetchProfile, ProfileCapabilities, ProfileDocument, ProfileFolder, ProfileResponse, ProfileStudySet, UserProfile } from "@/lib/api";

type ProfileData = {
  profile: UserProfile | null;
  documents: ProfileDocument[];
  studySets: ProfileStudySet[];
  folders: ProfileFolder[];
  capabilities: ProfileCapabilities | null;
};

type UseProfileState = ProfileData & {
  isLoading: boolean;
  error: Error | null;
};

const initialState: UseProfileState = {
  profile: null,
  documents: [],
  studySets: [],
  folders: [],
  capabilities: null,
  isLoading: true,
  error: null,
};

export const useProfile = () => {
  const [state, setState] = useState<UseProfileState>(initialState);

  const loadProfile = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data: ProfileResponse = await fetchProfile();
      setState({
        profile: data.profile,
        documents: data.documents ?? [],
        studySets: data.studySets ?? [],
        folders: data.folders ?? [],
        capabilities: data.capabilities ?? null,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        profile: null,
        documents: [],
        studySets: [],
        folders: [],
        capabilities: null,
        isLoading: false,
        error: err instanceof Error ? err : new Error("Failed to load profile"),
      });
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const setProfileState = useCallback(
    (updater: (profile: UserProfile | null) => UserProfile | null) => {
      setState((prev) => ({
        ...prev,
        profile: updater(prev.profile),
      }));
    },
    [],
  );

  const setDocuments = useCallback(
    (updater: (documents: ProfileDocument[]) => ProfileDocument[]) => {
      setState((prev) => ({
        ...prev,
        documents: updater(prev.documents),
      }));
    },
    [],
  );

  const setStudySets = useCallback(
    (updater: (studySets: ProfileStudySet[]) => ProfileStudySet[]) => {
      setState((prev) => ({
        ...prev,
        studySets: updater(prev.studySets),
      }));
    },
    [],
  );

  const setFolders = useCallback(
    (updater: (folders: ProfileFolder[]) => ProfileFolder[]) => {
      setState((prev) => ({
        ...prev,
        folders: updater(prev.folders),
      }));
    },
    [],
  );

  return {
    profile: state.profile,
    documents: state.documents,
    studySets: state.studySets,
    folders: state.folders,
    capabilities: state.capabilities,
    isLoading: state.isLoading,
    error: state.error,
    reload: loadProfile,
    setProfile: setProfileState,
    setDocuments,
    setStudySets,
    setFolders,
  };
};
