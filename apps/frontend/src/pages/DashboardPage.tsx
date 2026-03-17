import { useEffect, useMemo, useState } from "react";
import type { LabResultInput } from "@health-ai/shared";
import { LabResultsTable } from "../components/LabResultsTable";
import { listLabResults } from "../services/labResults";
import type { LabResultRow } from "../types/db";
import { analyzeLabs } from "../services/ai";

export const DashboardPage = () => {
  const [rows, setRows] = useState<LabResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [insight, setInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listLabResults();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lab results");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.includes(r.id)),
    [rows, selectedIds]
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const explain = async () => {
    setAiLoading(true);
    setError(null);
    setInsight(null);
    try {
      const payload: LabResultInput[] = selectedRows.map((row) => ({
        testName: row.test_name,
        value: row.value,
        unit: row.unit,
        referenceRange: row.reference_range ?? undefined,
        measuredAt: row.measured_at,
        notes: row.notes ?? undefined
      }));
      const result = await analyzeLabs(payload);
      setInsight(`${result.summary}\n\n${result.disclaimer}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze results");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <div className="card">
        <h2>Dashboard</h2>
        <p>Track your labs and get educational AI explanations.</p>
        <button className="btn secondary" onClick={refresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <LabResultsTable rows={rows} selectedIds={selectedIds} onToggle={toggle} />
      <button className="btn" disabled={selectedRows.length === 0 || aiLoading} onClick={explain}>
        {aiLoading ? "Analyzing..." : "Explain my results"}
      </button>
      {insight ? (
        <pre className="card" style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
          {insight}
        </pre>
      ) : null}
    </>
  );
};