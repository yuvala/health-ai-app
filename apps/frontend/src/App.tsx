import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AddLabResultPage } from "./pages/AddLabResultPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NavLayout } from "./layouts/NavLayout";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <NavLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/add-lab-result" element={<AddLabResultPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;