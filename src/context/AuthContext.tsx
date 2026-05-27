import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile, Caregiver, Patient } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  caregiver: Caregiver | null;
  patient: Patient | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, data: Partial<Profile> & { cpf?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData);

      if (profileData.user_type === 'caregiver') {
        const { data: caregiverData } = await supabase
          .from('caregivers')
          .select('*, caregiver_specialties(specialties(name))')
          .eq('user_id', userId)
          .maybeSingle();
        setCaregiver(caregiverData);
      } else if (profileData.user_type === 'patient') {
        const { data: patientData } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        setPatient(patientData);
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await fetchProfile(session.user.id);
        })();
      } else {
        setProfile(null);
        setCaregiver(null);
        setPatient(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, data: Partial<Profile> & { cpf?: string }) => {
    const { data: authData, error } = await supabase.auth.signUp({ email, password });
    if (error || !authData.user) return { error };

    const userId = authData.user.id;

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      email,
      full_name: data.full_name || '',
      phone: data.phone || '',
      user_type: data.user_type || 'patient',
    });

    if (profileError) return { error: profileError };

    if (data.user_type === 'caregiver') {
      await supabase.from('caregivers').insert({
        user_id: userId,
        cpf: data.cpf || '',
      });
    } else if (data.user_type === 'patient') {
      await supabase.from('patients').insert({
        user_id: userId,
      });
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setCaregiver(null);
    setPatient(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, caregiver, patient, loading,
      signIn, signUp, signOut, refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
