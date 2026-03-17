import type { LabResultRow } from "../types/db";

type Props = {
  rows: LabResultRow[];
  selectedIds: string[];
  onToggle: (id: string) => void;
};

export const LabResultsTable = ({ rows, selectedIds, onToggle }: Props) => {
  return (
    <div className="card">
      <h3>Lab Results</h3>
      {rows.length === 0 ? (
        <p>No lab results yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Test</th>
              <th>Value</th>
              <th>Range</th>
              <th>Measured At</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => onToggle(row.id)}
                  />
                </td>
                <td>{row.test_name}</td>
                <td>
                  {row.value} {row.unit}
                </td>
                <td>{row.reference_range ?? "-"}</td>
                <td>{new Date(row.measured_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};