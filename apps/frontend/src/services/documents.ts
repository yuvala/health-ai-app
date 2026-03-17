import { supabase } from "../lib/supabase";
import type { DocumentRow } from "../types/db";

const BUCKET = "documents";

export const listDocuments = async (): Promise<DocumentRow[]> => {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("uploaded_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data ?? [];
};

export const uploadDocument = async (file: File) => {
  const userRes = await supabase.auth.getUser();
  const user = userRes.data.user;
  if (!user) {
    throw new Error("No authenticated user.");
  }

  const uniquePath = `${user.id}/${Date.now()}-${file.name}`;
  const uploadRes = await supabase.storage.from(BUCKET).upload(uniquePath, file, {
    upsert: false
  });
  if (uploadRes.error) {
    throw uploadRes.error;
  }

  const { error } = await supabase.from("documents").insert({
    user_id: user.id,
    file_name: file.name,
    file_path: uniquePath,
    file_type: file.type || "application/octet-stream",
    uploaded_at: new Date().toISOString()
  });
  if (error) {
    throw error;
  }
};