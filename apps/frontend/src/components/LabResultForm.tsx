import { useState } from "react";
import { createLabResult } from "../services/labResults";

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
    <form className="card" onSubmit={onSubmit}>
      <h3>Add Lab Result</h3>
      <div className="row">
        <input
          required
          placeholder="Test name (e.g. Hemoglobin)"
          value={form.test_name}
          onChange={(e) => onChange("test_name", e.target.value)}
        />
        <input
          required
          type="number"
          step="any"
          placeholder="Value"
          value={form.value}
          onChange={(e) => onChange("value", e.target.value)}
        />
        <input required placeholder="Unit" value={form.unit} onChange={(e) => onChange("unit", e.target.value)} />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <input
          placeholder="Reference range (e.g. 13-17)"
          value={form.reference_range}
          onChange={(e) => onChange("reference_range", e.target.value)}
        />
        <input
          required
          type="date"
          value={form.measured_at}
          onChange={(e) => onChange("measured_at", e.target.value)}
        />
      </div>
      <div style={{ marginTop: 10 }}>
        <textarea
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          rows={3}
          style={{ width: "100%" }}
        />
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <button className="btn" disabled={saving} type="submit">
        {saving ? "Saving..." : "Save Result"}
      </button>
    </form>
  );
};