export type LabResultRow = {
  id: string;
  user_id: string;
  test_name: string;
  value: number;
  unit: string;
  reference_range: string | null;
  measured_at: string;
  notes: string | null;
  created_at: string;
};

export type DocumentRow = {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  uploaded_at: string;
  created_at: string;
};