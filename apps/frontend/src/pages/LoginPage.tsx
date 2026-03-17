import { useState } from "react";
import { Navigate } from "react-router-dom";
import { signIn, signUp } from "../services/auth";
import { useAuth } from "../hooks/useAuth";

export const LoginPage = () => {
  const { user, loading } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    const res = isSignup ? await signUp(email, password, fullName) : await signIn(email, password);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    if (isSignup) {
      setStatus("Signup successful. Check your email if confirmation is enabled.");
    }
  };

  return (
    <div className="container" style={{ maxWidth: 460, marginTop: 60 }}>
      <div className="card">
        <h2>{isSignup ? "Sign Up" : "Login"}</h2>
        <form onSubmit={submit}>
          {isSignup ? (
            <div style={{ marginBottom: 10 }}>
              <input
                required
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          ) : null}
          <div style={{ marginBottom: 10 }}>
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <input
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
          {status ? <p style={{ color: "green" }}>{status}</p> : null}
          <button className="btn" type="submit">
            {isSignup ? "Create account" : "Login"}
          </button>
        </form>
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => setIsSignup((v) => !v)}>
          {isSignup ? "Have an account? Login" : "Need an account? Sign up"}
        </button>
      </div>
    </div>
  );
};