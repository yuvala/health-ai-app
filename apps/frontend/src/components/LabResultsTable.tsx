import type { LabResultRow } from "../types/db";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type Props = {
  rows: LabResultRow[];
  selectedIds: string[];
  onToggle: (id: string) => void;
};

export const LabResultsTable = ({ rows, selectedIds, onToggle }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lab Results</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lab results yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Select</th>
                  <th className="px-3 py-2 font-medium">Test</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">Range</th>
                  <th className="px-3 py-2 font-medium">Measured At</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => onToggle(row.id)}
                        className="h-4 w-4 rounded border-input"
                      />
                    </td>
                    <td className="px-3 py-2">{row.test_name}</td>
                    <td className="px-3 py-2">
                      {row.value} {row.unit}
                    </td>
                    <td className="px-3 py-2">{row.reference_range ?? "-"}</td>
                    <td className="px-3 py-2">{new Date(row.measured_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
