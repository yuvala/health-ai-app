import { supabase } from "../lib/supabase";
import type { LabResultRow } from "../types/db";

export const listLabResults = async (): Promise<LabResultRow[]> => {
  const { data, error } = await supabase
    .from("lab_results")
    .select("*")
    .order("measured_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const createLabResult = async (payload: {
  test_name: string;
  value: number;
  unit: string;
  reference_range?: string;
  measured_at: string;
  notes?: string;
}) => {
  const { error } = await supabase.from("lab_results").insert(payload);
  if (error) {
    throw error;
  }
};