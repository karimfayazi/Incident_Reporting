"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean()
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false
    }
  });

  async function onSubmit(values: LoginValues) {
    setServerError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        const message = data.message || data.error || "Invalid username or password.";
        setServerError(message);
        toast.error(message);
        return;
      }

      toast.success("Welcome back.");
      router.replace(data.redirectTo || "/dashboard");
      router.refresh();
    } catch {
      const message = "Unable to connect to the server. Please try again.";
      setServerError(message);
      toast.error(message);
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell login-shell--centered" aria-labelledby="login-title">
        <form className="login-card login-card--centered" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="login-card__header">
            <p className="brand__eyebrow">Sign in</p>
            <h1 id="login-title">Incident Reporting Portal</h1>
            <p>Use your assigned username and password to continue.</p>
          </div>

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              autoComplete="username"
              placeholder="Enter username"
              aria-invalid={Boolean(errors.username)}
              {...register("username")}
            />
            {errors.username ? <p className="field-error">{errors.username.message}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter password"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
              <button
                type="button"
                className="password-field__toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password ? <p className="field-error">{errors.password.message}</p> : null}
          </div>

          <label className="login-options">
            <input type="checkbox" {...register("rememberMe")} />
            <span>Remember me on this device</span>
          </label>

          {serverError ? (
            <div className="auth-alert" role="alert">
              {serverError}
            </div>
          ) : null}

          <button className="primary-button login-card__submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>

          <p className="login-card__footnote">Role-based access redirects administrators to the dashboard area.</p>
        </form>
      </section>
    </main>
  );
}
