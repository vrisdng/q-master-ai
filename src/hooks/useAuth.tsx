import { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { EdgeFunctionFailureError, invokeEdgeFunction } from '@/lib/api';

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  display_name: string | null;
  metadata: Record<string, unknown> | null;
}

interface UserRole {
  role: 'guest' | 'user' | 'admin';
}

const GUEST_CREDENTIAL_KEY = 'qm_guest_credentials';

type GuestCredentials = {
  email: string;
  secret: string;
  expiresAt?: string;
};

const readGuestCredentials = (): GuestCredentials | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GUEST_CREDENTIAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestCredentials;
  } catch (error) {
    console.warn('Failed to parse guest credentials', error);
    return null;
  }
};

const storeGuestCredentials = (value: GuestCredentials) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GUEST_CREDENTIAL_KEY, JSON.stringify(value));
};

const clearGuestCredentials = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(GUEST_CREDENTIAL_KEY);
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  const ensureGuestSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return;

    const credentials = readGuestCredentials();

    if (credentials) {
      try {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.secret,
        });
        if (!reauthError) {
          return;
        }
        console.warn('Stored guest credentials rejected, creating new guest', reauthError);
      } catch (error) {
        console.warn('Stored guest credentials rejected, creating new guest', error);
      } finally {
        clearGuestCredentials();
      }
    }

    let data: GuestCredentials | null;
    try {
      data = await invokeEdgeFunction<GuestCredentials | null>('guest-session', {
        method: 'POST',
        body: {},
      });
    } catch (error) {
      if (error instanceof EdgeFunctionFailureError) {
        throw new Error(error.message);
      }
      throw error;
    }

    const guestCredentials: GuestCredentials = {
      email: data?.email ?? '',
      secret: data?.secret ?? '',
      expiresAt: data?.expiresAt,
    };

    if (!guestCredentials.email || !guestCredentials.secret) {
      throw new Error('Guest session response missing credentials');
    }

    storeGuestCredentials(guestCredentials);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: guestCredentials.email,
      password: guestCredentials.secret,
    });

    if (signInError) {
      clearGuestCredentials();
      throw new Error(signInError.message ?? 'Failed to sign into guest account');
    }
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      setProfile(data);
    }
  };

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (data) {
      setRoles(data as UserRole[]);
    }
  };

  const isAdmin = () => {
    return roles.some(r => r.role === 'admin');
  };

  const primaryRole = useMemo(() => roles[0]?.role ?? 'user', [roles]);

  const isGuest = useMemo(() => primaryRole === 'guest', [primaryRole]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile and roles fetching
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchRoles(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }

        setLoading(false);
      }
    );

    // THEN check for existing session or create guest session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        fetchProfile(session.user.id);
        fetchRoles(session.user.id);
        setLoading(false);
        return;
      }

      try {
        await ensureGuestSession();
      } catch (error) {
        console.error('Guest session initialization failed', error);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [ensureGuestSession]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  return {
    user,
    session,
    profile,
    roles,
    role: primaryRole,
    isGuest,
    loading,
    isAdmin,
    signOut,
  };
}
