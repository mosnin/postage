import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlatformHeroProps {
  platformName: string;
  platformLetter: string;
  platformColor: string;
  tagline: string;
  description: string;
  bullets: string[];
  stat: string;
  statLabel: string;
  className?: string;
}

export function PlatformHero({
  platformName,
  platformLetter,
  platformColor,
  tagline,
  description,
  bullets,
  stat,
  statLabel,
  className,
}: PlatformHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden bg-background px-4 pb-20 pt-16 sm:px-6 lg:px-8",
        className
      )}
    >
      {/* Gradient blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            background: `linear-gradient(to top right, ${platformColor}66, ${platformColor}22)`,
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        {/* Platform icon */}
        <div className="mb-6 flex justify-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-white text-xl font-bold shadow-lg"
            style={{ backgroundColor: platformColor }}
            aria-hidden
          >
            {platformLetter}
          </div>
        </div>

        <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1 text-sm">
          {platformName} Scheduler
        </Badge>

        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
          {tagline}
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          {description}
        </p>

        {/* Bullet list */}
        <ul className="mx-auto mt-8 max-w-sm space-y-2 text-left">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* Stat pill */}
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-5 py-2">
          <span className="text-2xl font-bold">{stat}</span>
          <span className="text-sm text-muted-foreground">{statLabel}</span>
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" className="w-full sm:w-auto" asChild>
            <Link href="/register">
              Start Scheduling {platformName}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          7-day free trial · No credit card required · Cancel anytime
        </p>
      </div>
    </section>
  );
}
