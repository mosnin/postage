import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    default: "PostSyncer — Auth",
    template: "%s | PostSyncer",
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-white hover:opacity-80 transition-opacity"
      >
        <div className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-white"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <span className="text-xl font-bold tracking-tight">PostSyncer</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-8">
          {children}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} PostSyncer. All rights reserved.
      </p>
    </div>
  );
}
