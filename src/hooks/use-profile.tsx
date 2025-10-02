import { useCallback, useEffect, useState } from "react";
import { fetchProfile, ProfileDocument, ProfileResponse, ProfileStudySet, UserProfile } from "@/lib/api";

type ProfileData = {
  profile: UserProfile | null;
  documents: ProfileDocument[];
  studySets: ProfileStudySet[];
};

type UseProfileState = ProfileData & {
  isLoading: boolean;
  error: Error | null;
};

const initialState: UseProfileState = {
  profile: null,
  documents: [],
  studySets: [],
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
        documents: data.documents,
        studySets: data.studySets,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        profile: null,
        documents: [],
        studySets: [],
        isLoading: false,
        error: err instanceof Error ? err : new Error("Failed to load profile"),
      });
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return {
    profile: state.profile,
    documents: state.documents,
    studySets: state.studySets,
    isLoading: state.isLoading,
    error: state.error,
    reload: loadProfile,
  };
};
