import { useNavigate } from "react-router-dom";
import { LabResultForm } from "../components/LabResultForm";

export const AddLabResultPage = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Add Lab Result</h2>
        <p className="text-sm text-muted-foreground">Capture one lab value at a time and keep your timeline clean.</p>
      </div>
      <LabResultForm onSaved={() => navigate("/dashboard")} />
    </div>
  );
};
