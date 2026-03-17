import { useEffect, useMemo, useState } from "react";
import type { LabResultInput } from "@health-ai/shared";
import { LabResultsTable } from "../components/LabResultsTable";
import type { LabResultRow } from "../types/db";
import { analyzeLabs } from "../services/ai";
import { listLabResults } from "../services/labResults";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

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

  const selectedRows = useMemo(() => rows.filter((r) => selectedIds.includes(r.id)), [rows, selectedIds]);

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
    <div className="space-y-4">
      <Card className="border-white/70 bg-card/90">
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Track labs and get educational AI explanations.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button onClick={explain} disabled={selectedRows.length === 0 || aiLoading}>
            {aiLoading ? "Analyzing..." : "Explain my results"}
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}

      <LabResultsTable rows={rows} selectedIds={selectedIds} onToggle={toggle} />

      {insight ? (
        <Card className="border-primary/20 bg-card/95">
          <CardHeader>
            <CardTitle>AI Explanation</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm leading-6 text-foreground">{insight}</pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
