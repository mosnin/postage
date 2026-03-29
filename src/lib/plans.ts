import type { Plan } from "@prisma/client";

// Plan hierarchy for upgrade checks (index = rank)
const PLAN_RANK: Record<Plan, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  PRO_PLUS: 3,
};

export const PLAN_FEATURES = {
  FREE: {
    analytics: "none" as const,
    inbox: "none" as const,
    aiCredits: 0,
    apiAccess: false,
    apiPostsPerDay: 0,
  },
  STARTER: {
    analytics: "basic" as const,
    inbox: "basic" as const,
    aiCredits: 1000,
    apiAccess: true,
    apiPostsPerDay: 100,
  },
  PRO: {
    analytics: "advanced" as const,
    inbox: "advanced" as const,
    aiCredits: 1000,
    apiAccess: true,
    apiPostsPerDay: 250,
  },
  PRO_PLUS: {
    analytics: "advanced" as const,
    inbox: "advanced" as const,
    aiCredits: 2000,
    apiAccess: true,
    apiPostsPerDay: 500,
  },
} as const;

export type PlanFeatures = (typeof PLAN_FEATURES)[Plan];
export type AnalyticsTier = PlanFeatures["analytics"];
export type InboxTier = PlanFeatures["inbox"];

/**
 * Check whether a plan has access to a specific feature.
 * For boolean features (apiAccess) returns the value directly.
 * For numeric features (aiCredits, apiPostsPerDay) returns true when > 0.
 * For tier features (analytics, inbox) returns true when not 'none'.
 */
export function canAccessFeature(
  plan: Plan,
  feature: keyof PlanFeatures
): boolean {
  const features = PLAN_FEATURES[plan];
  const value = features[feature];

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  // string tier: 'none' | 'basic' | 'advanced'
  return value !== "none";
}

/**
 * Returns the analytics tier for the given plan.
 */
export function getAnalyticsTier(plan: Plan): AnalyticsTier {
  return PLAN_FEATURES[plan].analytics;
}

/**
 * Returns the inbox tier for the given plan.
 */
export function getInboxTier(plan: Plan): InboxTier {
  return PLAN_FEATURES[plan].inbox;
}

/**
 * Returns true when the workspace's current plan is below the required plan.
 * Use to gate features that require a minimum plan level.
 */
export function requiresPlanUpgrade(plan: Plan, requiredPlan: Plan): boolean {
  return PLAN_RANK[plan] < PLAN_RANK[requiredPlan];
}

/**
 * Returns the minimum plan that provides access to the given feature.
 * Returns null if no plan supports the feature.
 */
export function minimumPlanFor(
  feature: keyof PlanFeatures
): Plan | null {
  const plans: Plan[] = ["FREE", "STARTER", "PRO", "PRO_PLUS"];
  for (const plan of plans) {
    if (canAccessFeature(plan, feature)) return plan;
  }
  return null;
}

/**
 * Returns the AI credits allocated for a given plan.
 */
export function getAiCreditsLimit(plan: Plan): number {
  return PLAN_FEATURES[plan].aiCredits;
}
