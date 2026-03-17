import { Link, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "../services/auth";

export const NavLayout = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div>
      <nav className="card container" style={{ display: "flex", justifyContent: "space-between" }}>
        <div className="row">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/add-lab-result">Add Lab Result</Link>
          <Link to="/documents">Documents</Link>
        </div>
        <button className="btn secondary" onClick={handleLogout}>
          Logout
        </button>
      </nav>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
};