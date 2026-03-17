import { useEffect, useState } from "react";
import type { DocumentRow } from "../types/db";
import { deleteDocument, getDocumentViewUrl, listDocuments, uploadDocument } from "../services/documents";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export const DocumentsPage = () => {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
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
    void refresh();
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

  const onView = async (row: DocumentRow) => {
    setViewingId(row.id);
    setError(null);
    try {
      const signedUrl = await getDocumentViewUrl(row);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "View failed");
    } finally {
      setViewingId(null);
    }
  };

  const onDelete = async (row: DocumentRow) => {
    const ok = window.confirm(`Delete ${row.file_name}? This will remove the file and parsed data links.`);
    if (!ok) {
      return;
    }

    setDeletingId(row.id);
    setError(null);
    try {
      await deleteDocument(row);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-white/70 bg-card/90">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Upload PDF lab reports. Files are processed in background after upload.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <input
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:font-medium file:text-primary-foreground hover:file:brightness-95 sm:w-auto"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" onClick={refresh} disabled={loading || uploading || deletingId !== null}>
            Refresh list
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Uploaded</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isDeleting = deletingId === row.id;
                    const isViewing = viewingId === row.id;
                    return (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{row.file_name}</td>
                        <td className="px-3 py-2">{row.file_type}</td>
                        <td className="px-3 py-2">{new Date(row.uploaded_at).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isViewing || isDeleting || uploading}
                              onClick={() => onView(row)}
                            >
                              {isViewing ? "Opening..." : "View"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-danger hover:text-danger"
                              disabled={isDeleting || isViewing || uploading}
                              onClick={() => onDelete(row)}
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {uploading ? <p className="mt-2 text-sm text-muted-foreground">Uploading...</p> : null}
        </CardContent>
      </Card>
    </div>
  );
};
