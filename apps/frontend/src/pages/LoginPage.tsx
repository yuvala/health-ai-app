import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { signIn, signUp } from "../services/auth";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

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
    <div className="mx-auto grid min-h-[78vh] w-full max-w-6xl items-center gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div className="hidden lg:block">
        <h1 className="text-4xl font-bold tracking-tight">Health Journey, one clear dashboard.</h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          Track labs, medications and documents in one responsive workspace designed for personal use.
        </p>
      </div>

      <Card className="w-full border-white/70 bg-card/95 shadow-xl backdrop-blur">
        <CardHeader>
          <CardTitle>{isSignup ? "Create account" : "Welcome back"}</CardTitle>
          <CardDescription>
            {isSignup ? "Start your personal health workspace." : "Sign in to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            {isSignup ? (
              <Input
                required
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            ) : null}

            <Input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
            {status ? <p className="text-sm font-medium text-emerald-700">{status}</p> : null}

            <Button className="w-full" type="submit">
              {isSignup ? "Create account" : "Login"}
            </Button>
          </form>

          <Button variant="ghost" className="mt-3 w-full" onClick={() => setIsSignup((v) => !v)}>
            {isSignup ? "Have an account? Login" : "Need an account? Sign up"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
