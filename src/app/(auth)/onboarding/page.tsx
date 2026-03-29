"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn, PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type UserType = "creator" | "business" | "agency";
type InviteRole = "MEMBER" | "ADMIN";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PLATFORMS = Object.keys(PLATFORM_LABELS) as (keyof typeof PLATFORM_LABELS)[];

const USER_TYPE_OPTIONS: {
  value: UserType;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    value: "creator",
    label: "Creator",
    description: "Individual content creator, influencer, or freelancer",
    emoji: "✍️",
  },
  {
    value: "business",
    label: "Business",
    description: "Small to mid-sized company managing your own social presence",
    emoji: "🏢",
  },
  {
    value: "agency",
    label: "Agency",
    description: "Marketing or social media agency managing multiple clients",
    emoji: "🚀",
  },
];

const TOTAL_STEPS = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin h-4 w-4", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full flex-1 transition-all duration-300",
            i + 1 <= current ? "bg-indigo-500" : "bg-white/10"
          )}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Welcome / user type
// ---------------------------------------------------------------------------
function Step1({
  selected,
  onSelect,
  onNext,
  isPending,
}: {
  selected: UserType | null;
  onSelect: (v: UserType) => void;
  onNext: () => void;
  isPending: boolean;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">What best describes you?</h2>
      <p className="text-sm text-slate-400 mb-6">
        We&apos;ll personalise your experience based on your answer.
      </p>

      <div className="space-y-3 mb-8">
        {USER_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              "w-full text-left flex items-start gap-4 rounded-xl border p-4 transition-all",
              selected === opt.value
                ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
            )}
          >
            <span className="text-2xl mt-0.5">{opt.emoji}</span>
            <div>
              <p className="font-semibold text-white text-sm">{opt.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
            </div>
            {selected === opt.value && (
              <div className="ml-auto mt-0.5 h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!selected || isPending}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending && <Spinner />}
        Continue
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Connect first account
// ---------------------------------------------------------------------------
function Step2({ onSkip }: { onSkip: () => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">Connect your first social account</h2>
      <p className="text-sm text-slate-400 mb-6">
        PostSyncer supports 11 platforms. You can always add more later.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-8 sm:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <Link
            key={platform}
            href={`/dashboard/accounts/connect/${platform.toLowerCase()}`}
            className="group flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0 transition-all"
              style={{ backgroundColor: PLATFORM_COLORS[platform] }}
            />
            {PLATFORM_LABELS[platform]}
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors py-2"
      >
        Skip for now &rarr;
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Schedule first post
// ---------------------------------------------------------------------------
const postSchema = z.object({
  content: z.string().min(1, "Post content is required").max(280, "Content too long"),
  platforms: z.array(z.string()).min(1, "Select at least one platform"),
  scheduled: z.boolean(),
  scheduledAt: z.string().optional(),
});
type PostFormValues = z.infer<typeof postSchema>;

function Step3({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: { scheduled: false, platforms: [] },
  });

  const scheduled = watch("scheduled");
  const selectedPlatforms = watch("platforms");

  function togglePlatform(platform: string) {
    const current = selectedPlatforms ?? [];
    if (current.includes(platform)) {
      setValue("platforms", current.filter((p) => p !== platform), { shouldValidate: true });
    } else {
      setValue("platforms", [...current, platform], { shouldValidate: true });
    }
  }

  async function onSubmit(_values: PostFormValues) {
    // In a real app this would create the draft/scheduled post
    // For onboarding, we simply proceed to the next step
    onNext();
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">Schedule your first post</h2>
      <p className="text-sm text-slate-400 mb-6">
        Compose a post to see how PostSyncer works. You can edit or delete it anytime.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Content */}
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-slate-300 mb-1.5">
            Post content
          </label>
          <textarea
            id="content"
            rows={4}
            placeholder="What's on your mind? Write your first post..."
            {...register("content")}
            className={cn(
              "w-full rounded-lg border bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition resize-none",
              "focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
              errors.content ? "border-red-500/60" : "border-white/10"
            )}
          />
          {errors.content && (
            <p className="mt-1.5 text-xs text-red-400">{errors.content.message}</p>
          )}
        </div>

        {/* Platform selector */}
        <div>
          <p className="text-sm font-medium text-slate-300 mb-2">Post to</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((platform) => {
              const active = (selectedPlatforms ?? []).includes(platform);
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => togglePlatform(platform)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    active
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                      : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PLATFORM_COLORS[platform] }}
                  />
                  {PLATFORM_LABELS[platform]}
                </button>
              );
            })}
          </div>
          {errors.platforms && (
            <p className="mt-1.5 text-xs text-red-400">{errors.platforms.message}</p>
          )}
        </div>

        {/* Schedule toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={scheduled}
            onClick={() => setValue("scheduled", !scheduled)}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900",
              scheduled ? "bg-indigo-600" : "bg-white/20"
            )}
          >
            <span
              className={cn(
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                scheduled ? "translate-x-[18px]" : "translate-x-0.5"
              )}
            />
          </button>
          <span className="text-sm text-slate-300">Schedule for later</span>
        </div>

        {/* Date picker (shown when scheduled) */}
        {scheduled && (
          <div>
            <label htmlFor="scheduledAt" className="block text-sm font-medium text-slate-300 mb-1.5">
              Schedule date &amp; time
            </label>
            <input
              id="scheduledAt"
              type="datetime-local"
              {...register("scheduledAt")}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Spinner />}
            Save Draft &amp; Continue
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors py-2"
          >
            Skip &rarr;
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Invite team
// ---------------------------------------------------------------------------
const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["MEMBER", "ADMIN"]),
});
type InviteFormValues = z.infer<typeof inviteSchema>;

function Step4({ onDone }: { onDone: () => void }) {
  const [inviteSent, setInviteSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "MEMBER" },
  });

  async function onSubmit(values: InviteFormValues) {
    setServerError(null);
    try {
      // Placeholder — in production this would call POST /api/team/invite
      await new Promise((resolve) => setTimeout(resolve, 600));
      setInviteSent(true);
      reset();
    } catch {
      setServerError("Failed to send invite. Please try again.");
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">Invite your team</h2>
      <p className="text-sm text-slate-400 mb-6">
        Collaborate with teammates. This step is optional — you can add people later in Settings.
      </p>

      {inviteSent && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          Invite sent! Add another or continue to your dashboard.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mb-6">
        {serverError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {serverError}
          </div>
        )}

        <div className="flex gap-3">
          {/* Email */}
          <div className="flex-1">
            <label htmlFor="invite-email" className="block text-sm font-medium text-slate-300 mb-1.5">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              {...register("email")}
              className={cn(
                "w-full rounded-lg border bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition",
                "focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
                errors.email ? "border-red-500/60" : "border-white/10"
              )}
            />
          </div>

          {/* Role */}
          <div className="w-32">
            <label htmlFor="invite-role" className="block text-sm font-medium text-slate-300 mb-1.5">
              Role
            </label>
            <select
              id="invite-role"
              {...register("role")}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>

        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-indigo-500 bg-indigo-500/10 px-4 py-2.5 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting && <Spinner />}
          Send Invite
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onDone}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Done — Go to Dashboard
        </button>
        <button
          type="button"
          onClick={onDone}
          className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors py-2"
        >
          Skip for now &rarr;
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding Page (root)
// ---------------------------------------------------------------------------
function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStep = searchParams.get("step");
  const step = rawStep ? Math.max(1, Math.min(4, parseInt(rawStep, 10))) : 1;

  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [isPending, startTransition] = useTransition();

  function goToStep(n: number) {
    router.push(`/onboarding?step=${n}`);
  }

  async function handleStep1Next() {
    if (!selectedType) return;
    startTransition(async () => {
      try {
        // Persist user type preference
        await fetch("/api/user/onboarding-meta", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userType: selectedType }),
        }).catch(() => {
          // Non-fatal — continue even if this fails
        });
      } finally {
        goToStep(2);
      }
    });
  }

  return (
    <div>
      <StepIndicator current={step} total={TOTAL_STEPS} />

      {step === 1 && (
        <Step1
          selected={selectedType}
          onSelect={setSelectedType}
          onNext={handleStep1Next}
          isPending={isPending}
        />
      )}

      {step === 2 && (
        <Step2 onSkip={() => goToStep(3)} />
      )}

      {step === 3 && (
        <Step3
          onNext={() => goToStep(4)}
          onSkip={() => goToStep(4)}
        />
      )}

      {step === 4 && (
        <Step4 onDone={() => router.push("/dashboard")} />
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <OnboardingPageInner />
    </Suspense>
  );
}
