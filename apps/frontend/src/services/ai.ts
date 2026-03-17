import type { AnalyzeLabsResponse, LabResultInput } from "@health-ai/shared";
import { env } from "../lib/env";
import { supabase } from "../lib/supabase";

export const analyzeLabs = async (results: LabResultInput[]): Promise<AnalyzeLabsResponse> => {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${env.apiBaseUrl}/ai/analyze-labs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ results })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to analyze labs");
  }

  return response.json();
};