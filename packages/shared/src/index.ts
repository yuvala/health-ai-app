export type SourceType = "lab_results" | "medications" | "documents";

export interface LabResultInput {
  testName: string;
  value: number;
  unit: string;
  referenceRange?: string;
  measuredAt: string;
  notes?: string;
}

export interface AnalyzeLabsRequest {
  results: LabResultInput[];
}

export interface AnalyzeLabsResponse {
  summary: string;
  disclaimer: string;
}