import { useEffect, useState } from "react";
import { listDocuments, uploadDocument } from "../services/documents";
import type { DocumentRow } from "../types/db";

export const DocumentsPage = () => {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDocuments();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onFile = async (file: File | null) => {
    if (!file) {
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(file);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Documents</h2>
        <p>Upload PDFs/lab files to Supabase Storage (metadata is stored in table).</p>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </div>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <div className="card">
        <h3>Uploaded Documents</h3>
        {loading ? (
          <p>Loading...</p>
        ) : rows.length === 0 ? (
          <p>No documents uploaded.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.file_name}</td>
                  <td>{row.file_type}</td>
                  <td>{new Date(row.uploaded_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {uploading ? <p>Uploading...</p> : null}
      </div>
    </div>
  );
};