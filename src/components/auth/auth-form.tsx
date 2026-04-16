"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, AtSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { authClient } from "@/server/better-auth/client";
import { toast } from "sonner";

// ─── GoBuzz Logo ──────────────────────────────────────────────────────────────
function BuzzLogo() {
  return (
    <div className="flex flex-col items-center gap-2 mb-8">
      {/* Honeycomb speech bubble icon */}
      <div className="relative">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ backgroundColor: "hsl(var(--brand))" }}
        >
          <svg viewBox="0 0 40 36" className="h-8 w-8" fill="none">
            {/* Honeycomb pattern */}
            <polygon points="20,2 27,6 27,14 20,18 13,14 13,6" fill="rgba(0,0,0,0.15)" />
            <polygon points="10,11 17,15 17,23 10,27 3,23 3,15" fill="rgba(0,0,0,0.1)" />
            <polygon points="30,11 37,15 37,23 30,27 23,23 23,15" fill="rgba(0,0,0,0.1)" />
            <polygon points="20,20 27,24 27,32 20,36 13,32 13,24" fill="rgba(0,0,0,0.1)" />
          </svg>
        </div>
        {/* speech bubble tail */}
        <div
          className="absolute -bottom-2 left-4 h-4 w-4 rotate-45"
          style={{ backgroundColor: "hsl(var(--brand))" }}
        />
      </div>
      <div className="mt-3 text-center">
        <h1 className="text-3xl font-black tracking-tighter">
          Go<span style={{ color: "hsl(var(--brand))" }}>Buzz</span>
        </h1>
      </div>
    </div>
  );
}

// ─── Tab toggle ───────────────────────────────────────────────────────────────
type Mode = "login" | "register";

function TabToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex w-full rounded-xl bg-muted p-1 mb-6">
      {(["login", "register"] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-semibold transition-all",
            mode === m
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m === "login" ? "Sign in" : "Sign up"}
        </button>
      ))}
    </div>
  );
}

// ─── Input with icon ──────────────────────────────────────────────────────────
function IconInput({
  icon: Icon,
  rightSlot,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ElementType;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        className={cn("pl-10", rightSlot && "pr-10", className)}
        {...props}
      />
      {rightSlot && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface AuthFormProps {
  defaultMode?: Mode;
}

export function AuthForm({ defaultMode = "login" }: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");

  // ─── Submit ─────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "login") {
        const { error } = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/feed",
        });
        if (error) throw new Error(error.message ?? "Invalid credentials");
        toast.success("Welcome back!");
        router.push("/feed");
        router.refresh();
      } else {
        // Register
        if (username.length < 3) {
          toast.error("Username must be at least 3 characters");
          return;
        }
        if (password.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }

        const { error } = await authClient.signUp.email({
          email,
          password,
          name,
          // @ts-expect-error - username is a custom field in our schema
          // but better-auth types might not reflect it globally in the client
          // without additional configuration
          username,
          callbackURL: "/feed",
        });
        if (error) throw new Error(error.message ?? "Registration failed");
        toast.success("Account created! Welcome to GoBuzz 🎉");
        router.push("/feed");
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────
  async function handleGoogle() {
    setIsGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "github", // swap to "google" once configured
        callbackURL: "/feed",
      });
    } catch {
      toast.error("OAuth sign-in failed");
      setIsGoogleLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      toast.error("Enter your email first");
      return;
    }
    try {
      await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
      toast.success("Password reset link sent to your email");
    } catch {
      toast.error("Failed to send reset email");
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <BuzzLogo />

      <div className="rounded-2xl border border-border bg-card shadow-xl shadow-black/5 p-6">
        <TabToggle mode={mode} onChange={setMode} />

        {/* Heading */}
        <div className="mb-6">
          <h2 className="text-xl font-black">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {mode === "login"
              ? "Sign in to continue to GoBuzz"
              : "Join the buzz today"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Register-only fields */}
          {mode === "register" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold">Full name</Label>
                <IconInput
                  id="name"
                  icon={User}
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold">Username</Label>
                <IconInput
                  id="username"
                  icon={AtSign}
                  type="text"
                  placeholder="yourhandle"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                  required
                  autoComplete="username"
                  className="h-11"
                />
              </div>
            </>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold">Email</Label>
            <IconInput
              id="email"
              icon={Mail}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-11"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-brand hover:underline font-medium"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <IconInput
              id="password"
              icon={Lock}
              type={showPassword ? "text" : "password"}
              placeholder={mode === "register" ? "Min. 8 characters" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="h-11"
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 font-bold text-sm mt-2 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        {/* OAuth divider */}
        <div className="my-4 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground font-medium">or</span>
          <Separator className="flex-1" />
        </div>

        {/* GitHub / Google OAuth */}
        <Button
          variant="outline"
          className="w-full h-11 gap-2 font-semibold text-sm"
          onClick={handleGoogle}
          disabled={isGoogleLoading}
          type="button"
        >
          {isGoogleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" fill="currentColor" />
            </svg>
          )}
          Continue with GitHub
        </Button>

        {/* Switch mode */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="font-semibold text-brand hover:underline"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}