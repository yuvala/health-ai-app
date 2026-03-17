import { env } from "../lib/env";
import { supabase } from "../lib/supabase";
import type { DocumentRow } from "../types/db";

const BUCKET = "documents";

const isObjectMissingError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes("not found") || normalized.includes("no such") || normalized.includes("does not exist");
};

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
  if (file.type !== "application/pdf") {
    throw new Error("Currently only PDF files are supported.");
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();
  const userRes = await supabase.auth.getUser();
  const user = userRes.data.user;

  if (!user || !session?.access_token) {
    throw new Error("No authenticated user.");
  }

  const uniquePath = `${user.id}/${Date.now()}-${file.name}`;
  const uploadRes = await supabase.storage.from(BUCKET).upload(uniquePath, file, {
    upsert: false
  });

  if (uploadRes.error) {
    if (uploadRes.error.message.toLowerCase().includes("bucket not found")) {
      throw new Error(
        "Supabase Storage bucket 'documents' is missing. Run supabase/migrations/0002_documents_storage.sql."
      );
    }
    throw uploadRes.error;
  }

  const { data: document, error } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      file_name: file.name,
      file_path: uniquePath,
      file_type: file.type || "application/octet-stream",
      uploaded_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error || !document) {
    throw error ?? new Error("Failed to create document record");
  }

  const response = await fetch(`${env.apiBaseUrl}/health/documents/${document.id}/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Document upload succeeded but queueing for processing failed.");
  }
};

export const deleteDocument = async (document: Pick<DocumentRow, "id" | "file_path">) => {
  const removeRes = await supabase.storage.from(BUCKET).remove([document.file_path]);
  if (removeRes.error && !isObjectMissingError(removeRes.error.message)) {
    throw removeRes.error;
  }

  const { error } = await supabase.from("documents").delete().eq("id", document.id);
  if (error) {
    throw error;
  }
};
export const getDocumentViewUrl = async (document: Pick<DocumentRow, "file_path">): Promise<string> => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(document.file_path, 60);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Failed to create signed URL for document view");
  }
  return data.signedUrl;
};
