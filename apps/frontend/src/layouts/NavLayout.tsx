import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "../services/auth";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/add-lab-result", label: "Add Lab Result" },
  { href: "/documents", label: "Documents" }
];

export const NavLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen pb-12">
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-8">
        <header className="rounded-2xl border bg-card/90 p-3 shadow-sm backdrop-blur sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <nav className="flex flex-wrap items-center gap-2">
              {links.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition",
                    location.pathname === item.href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <Button variant="secondary" onClick={handleLogout} className="w-full sm:w-auto">
              Logout
            </Button>
          </div>
        </header>

        <main className="mt-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
