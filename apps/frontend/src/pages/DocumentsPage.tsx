import { useEffect, useMemo, useState } from "react";
import type { DocumentRow } from "../types/db";
import {
  approveDocumentExtraction,
  deleteDocument,
  getDocumentViewUrl,
  listDocumentExtractions,
  listDocuments,
  type DocumentExtractionRow,
  uploadDocument
} from "../services/documents";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

const toStatusLabel = (status: DocumentExtractionRow["status"] | "not_started"): string => {
  switch (status) {
    case "queued":
      return "Queued";
    case "extracting":
      return "Extracting";
    case "parsing":
      return "Parsing";
    case "review_needed":
      return "Review needed";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Not started";
  }
};

const toExtractionMethodLabel = (extraction: DocumentExtractionRow | undefined): string | null => {
  if (!extraction) {
    return null;
  }

  const parser = extraction.parser_version === "openai-v1" ? "AI" : "Regex";
  const ocr = extraction.used_ocr ? " + OCR" : "";
  return `${parser}${ocr}`;
};

const toPercent = (value: number | null): string | null => {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return `${Math.round(value * 100)}%`;
};

export const DocumentsPage = () => {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [extractions, setExtractions] = useState<DocumentExtractionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extractionByDocumentId = useMemo(() => {
    const map = new Map<string, DocumentExtractionRow>();
    for (const extraction of extractions) {
      map.set(extraction.document_id, extraction);
    }
    return map;
  }, [extractions]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedDocumentId) ?? null,
    [rows, selectedDocumentId]
  );
  const selectedExtraction = useMemo(
    () => (selectedRow ? extractionByDocumentId.get(selectedRow.id) : undefined),
    [selectedRow, extractionByDocumentId]
  );

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [documentsData, extractionData] = await Promise.all([listDocuments(), listDocumentExtractions()]);
      setRows(documentsData);
      setExtractions(extractionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedDocumentId(null);
      return;
    }

    if (!selectedDocumentId || !rows.some((row) => row.id === selectedDocumentId)) {
      setSelectedDocumentId(rows[0].id);
    }
  }, [rows, selectedDocumentId]);

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

  const onApprove = async (row: DocumentRow) => {
    setApprovingId(row.id);
    setError(null);
    try {
      await approveDocumentExtraction(row.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setApprovingId(null);
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
          <Button
            variant="outline"
            onClick={refresh}
            disabled={loading || uploading || deletingId !== null || approvingId !== null}
          >
            Refresh list
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
          <CardDescription>Select a row to see full extracted details below.</CardDescription>
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
                    <th className="px-3 py-2 font-medium">Processing</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isDeleting = deletingId === row.id;
                    const isViewing = viewingId === row.id;
                    const isApproving = approvingId === row.id;
                    const extraction = extractionByDocumentId.get(row.id);
                    const status = extraction?.status ?? "not_started";
                    const canApprove = extraction?.status === "review_needed";
                    const methodLabel = toExtractionMethodLabel(extraction);
                    const dateConfidence = toPercent(extraction?.date_confidence ?? null);
                    const isSelected = selectedDocumentId === row.id;

                    return (
                      <tr
                        key={row.id}
                        className={`border-b last:border-0 cursor-pointer ${isSelected ? "bg-muted/40" : ""}`}
                        onClick={() => setSelectedDocumentId(row.id)}
                      >
                        <td className="px-3 py-2">{row.file_name}</td>
                        <td className="px-3 py-2">{row.file_type}</td>
                        <td className="px-3 py-2">{new Date(row.uploaded_at).toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <div>{toStatusLabel(status)}</div>
                          {methodLabel ? <div className="text-xs text-muted-foreground">Method: {methodLabel}</div> : null}
                          {extraction?.document_date ? (
                            <div className="text-xs text-muted-foreground">
                              Date: {extraction.document_date}
                              {dateConfidence ? ` (confidence ${dateConfidence})` : ""}
                            </div>
                          ) : null}
                          {extraction ? (
                            <div className="mt-1 text-xs text-muted-foreground">Results: {extraction.parsed_results_count}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isViewing || isDeleting || uploading || isApproving}
                              onClick={(event) => {
                                event.stopPropagation();
                                void onView(row);
                              }}
                            >
                              {isViewing ? "Opening..." : "View"}
                            </Button>
                            {canApprove ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={isApproving || isDeleting || isViewing || uploading}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onApprove(row);
                                }}
                              >
                                {isApproving ? "Approving..." : "Approve"}
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-danger hover:text-danger"
                              disabled={isDeleting || isViewing || uploading || isApproving}
                              onClick={(event) => {
                                event.stopPropagation();
                                void onDelete(row);
                              }}
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

      <Card>
        <CardHeader>
          <CardTitle>Extracted Data (Selected Row)</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedRow ? (
            <p className="text-sm text-muted-foreground">Select a document row to see extracted data.</p>
          ) : !selectedExtraction ? (
            <p className="text-sm text-muted-foreground">No extraction data yet for this document.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div><span className="font-medium">File:</span> {selectedRow.file_name}</div>
                <div><span className="font-medium">Uploaded:</span> {new Date(selectedRow.uploaded_at).toLocaleString()}</div>
                <div><span className="font-medium">Status:</span> {toStatusLabel(selectedExtraction.status)}</div>
                <div><span className="font-medium">Method:</span> {toExtractionMethodLabel(selectedExtraction) ?? "-"}</div>
                <div>
                  <span className="font-medium">Document Date:</span> {selectedExtraction.document_date ?? "-"}
                  {selectedExtraction.date_confidence !== null ? ` (${toPercent(selectedExtraction.date_confidence)})` : ""}
                </div>
                <div><span className="font-medium">Results Count:</span> {selectedExtraction.parsed_results_count}</div>
              </div>

              {selectedExtraction.error_message ? (
                <div className="rounded-md border border-danger/40 bg-danger/10 p-2 text-danger">
                  {selectedExtraction.error_message}
                </div>
              ) : null}

              <div>
                <p className="mb-1 font-medium">Parsed Results</p>
                {selectedExtraction.parsed_results.length === 0 ? (
                  <p className="text-muted-foreground">No parsed rows found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-2 py-1 font-medium">Test</th>
                          <th className="px-2 py-1 font-medium">Code</th>
                          <th className="px-2 py-1 font-medium">Value</th>
                          <th className="px-2 py-1 font-medium">Unit</th>
                          <th className="px-2 py-1 font-medium">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedExtraction.parsed_results.map((result, index) => (
                          <tr key={`${selectedExtraction.id}-${result.testCode}-${index}`} className="border-b last:border-0">
                            <td className="px-2 py-1">{result.testName}</td>
                            <td className="px-2 py-1">{result.testCode}</td>
                            <td className="px-2 py-1">{result.value}</td>
                            <td className="px-2 py-1">{result.unit}</td>
                            <td className="px-2 py-1">{Math.round(result.confidence * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1 font-medium">Extracted Text</p>
                {selectedExtraction.extracted_text ? (
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-2 text-xs">
                    {selectedExtraction.extracted_text}
                  </pre>
                ) : selectedExtraction.extracted_text_preview ? (
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-2 text-xs">
                    {selectedExtraction.extracted_text_preview}
                  </pre>
                ) : (
                  <p className="text-muted-foreground">No extracted text.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
