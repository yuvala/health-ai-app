import { supabase } from "../lib/supabase";

export const signIn = async (email: string, password: string) => {
  return supabase.auth.signInWithPassword({ email, password });
};

export const signUp = async (email: string, password: string, fullName: string) => {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });
};

export const signOut = async () => supabase.auth.signOut();