"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(80, "Name is too long"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  terms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms of Service" }),
  }),
});
type RegisterFormValues = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Icons (reused from login page — inlined for isolation)
// ---------------------------------------------------------------------------
function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.09-.745.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.807 1.305 3.492.998.108-.776.42-1.305.763-1.605-2.665-.305-5.466-1.332-5.466-5.93 0-1.31.468-2.381 1.235-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function RegisterPage() {
  const router = useRouter();
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  async function handleOAuth(provider: "google" | "github") {
    setOauthLoading(provider);
    try {
      await signIn(provider, { callbackUrl: "/onboarding" });
    } catch {
      setOauthLoading(null);
    }
  }

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        email: values.email,
        password: values.password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setServerError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    // Sign in immediately with the new credentials
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (result?.error) {
      setServerError("Account created but sign-in failed. Please log in.");
      router.push("/login");
      return;
    }

    router.push("/onboarding?step=1");
    router.refresh();
  }

  return (
    <>
      {/* Heading */}
      <div className="mb-2 text-center">
        <h1 className="text-2xl font-bold text-white">Start your free trial</h1>
        <p className="mt-2 text-sm text-slate-400">
          No credit card required &bull; 7-day free trial
        </p>
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-3 mt-6 mb-6">
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          disabled={!!oauthLoading || isSubmitting}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-white/15 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {oauthLoading === "google" ? <Spinner /> : <GoogleIcon />}
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => handleOAuth("github")}
          disabled={!!oauthLoading || isSubmitting}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-white/15 bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {oauthLoading === "github" ? <Spinner /> : <GitHubIcon />}
          Continue with GitHub
        </button>
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-transparent px-3 text-slate-500">or</span>
        </div>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {serverError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {serverError}
          </div>
        )}

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">
            Full name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Jane Smith"
            {...register("name")}
            className={cn(
              "w-full rounded-lg border bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition",
              "focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
              errors.name ? "border-red-500/60 focus:ring-red-500" : "border-white/10"
            )}
          />
          {errors.name && (
            <p className="mt-1.5 text-xs text-red-400">{errors.name.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
            Work email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
            className={cn(
              "w-full rounded-lg border bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition",
              "focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
              errors.email ? "border-red-500/60 focus:ring-red-500" : "border-white/10"
            )}
          />
          {errors.email && (
            <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            {...register("password")}
            className={cn(
              "w-full rounded-lg border bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition",
              "focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
              errors.password ? "border-red-500/60 focus:ring-red-500" : "border-white/10"
            )}
          />
          {errors.password && (
            <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        {/* Terms checkbox */}
        <div className="flex items-start gap-3">
          <input
            id="terms"
            type="checkbox"
            {...register("terms")}
            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
          />
          <label htmlFor="terms" className="text-sm text-slate-400 leading-snug cursor-pointer">
            I agree to the{" "}
            <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
              Privacy Policy
            </Link>
          </label>
        </div>
        {errors.terms && (
          <p className="-mt-2 text-xs text-red-400">{errors.terms.message}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !!oauthLoading}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {isSubmitting && <Spinner />}
          Create free account
        </button>
      </form>

      {/* Login link */}
      <p className="mt-6 text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Log in
        </Link>
      </p>
    </>
  );
}
