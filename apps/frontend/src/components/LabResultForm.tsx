import { useState } from "react";
import { createLabResult } from "../services/labResults";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

type Props = {
  onSaved?: () => void;
};

export const LabResultForm = ({ onSaved }: Props) => {
  const [form, setForm] = useState({
    test_name: "",
    value: "",
    unit: "",
    reference_range: "",
    measured_at: new Date().toISOString().slice(0, 10),
    notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createLabResult({
        test_name: form.test_name,
        value: Number(form.value),
        unit: form.unit,
        reference_range: form.reference_range || undefined,
        measured_at: new Date(form.measured_at).toISOString(),
        notes: form.notes || undefined
      });

      setForm({
        test_name: "",
        value: "",
        unit: "",
        reference_range: "",
        measured_at: new Date().toISOString().slice(0, 10),
        notes: ""
      });
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save result");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Lab Result</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              required
              placeholder="Test name"
              value={form.test_name}
              onChange={(e) => onChange("test_name", e.target.value)}
            />
            <Input
              required
              type="number"
              step="any"
              placeholder="Value"
              value={form.value}
              onChange={(e) => onChange("value", e.target.value)}
            />
            <Input required placeholder="Unit" value={form.unit} onChange={(e) => onChange("unit", e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Reference range (e.g. 13-17)"
              value={form.reference_range}
              onChange={(e) => onChange("reference_range", e.target.value)}
            />
            <Input
              required
              type="date"
              value={form.measured_at}
              onChange={(e) => onChange("measured_at", e.target.value)}
            />
          </div>

          <Textarea
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => onChange("notes", e.target.value)}
          />

          {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}

          <Button disabled={saving} type="submit">
            {saving ? "Saving..." : "Save Result"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
