import { env } from "../lib/env";
import { supabase } from "../lib/supabase";
import type { DocumentRow } from "../types/db";

const BUCKET = "documents";

const isObjectMissingError = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes("not found") || normalized.includes("no such") || normalized.includes("does not exist");
};

export type ParsedExtractionResultRow = {
  testName: string;
  testCode: string;
  value: number;
  unit: string;
  confidence: number;
};

export type DocumentExtractionRow = {
  id: string;
  document_id: string;
  status: "queued" | "extracting" | "parsing" | "review_needed" | "completed" | "failed";
  document_date: string | null;
  date_confidence: number | null;
  error_message: string | null;
  parser_version: string;
  used_ocr: boolean;
  parsed_results: ParsedExtractionResultRow[];
  parsed_results_count: number;
  extracted_text: string | null;
  extracted_text_preview: string;
  documents: {
    file_name: string;
    file_type: string;
    uploaded_at: string;
  };
  updated_at: string;
  created_at: string;
};

const getSessionAccessToken = async (): Promise<string> => {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  return session.access_token;
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

export const listDocumentExtractions = async (): Promise<DocumentExtractionRow[]> => {
  const accessToken = await getSessionAccessToken();
  const response = await fetch(`${env.apiBaseUrl}/health/documents/extractions`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to load document extraction statuses");
  }

  return response.json();
};

export const approveDocumentExtraction = async (documentId: string) => {
  const accessToken = await getSessionAccessToken();
  const response = await fetch(`${env.apiBaseUrl}/health/documents/${documentId}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to approve parsed extraction");
  }

  return response.json();
};

export const uploadDocument = async (file: File) => {
  if (file.type !== "application/pdf") {
    throw new Error("Currently only PDF files are supported.");
  }

  const accessToken = await getSessionAccessToken();
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
      Authorization: `Bearer ${accessToken}`
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





