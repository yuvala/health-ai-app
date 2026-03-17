import { useNavigate } from "react-router-dom";
import { LabResultForm } from "../components/LabResultForm";

export const AddLabResultPage = () => {
  const navigate = useNavigate();
  return (
    <div>
      <LabResultForm onSaved={() => navigate("/dashboard")} />
    </div>
  );
};