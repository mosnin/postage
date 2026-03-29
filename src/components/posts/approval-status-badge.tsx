import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, AlertCircle, Clock, MinusCircle } from "lucide-react";

export type ApprovalStatusValue =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

interface ApprovalStatusConfig {
  label: string;
  className: string;
  icon: React.ElementType;
}

const APPROVAL_STATUS_CONFIG: Record<ApprovalStatusValue, ApprovalStatusConfig> = {
  NOT_REQUIRED: {
    label: "Not Required",
    className: "bg-gray-50 text-gray-500 border-gray-200",
    icon: MinusCircle,
  },
  PENDING: {
    label: "Pending Review",
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    className: "bg-green-50 text-green-700 border-green-200",
    icon: CheckCircle,
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
  CHANGES_REQUESTED: {
    label: "Changes Requested",
    className: "bg-orange-50 text-orange-700 border-orange-200",
    icon: AlertCircle,
  },
};

interface ApprovalStatusBadgeProps {
  status: ApprovalStatusValue | string | null | undefined;
  showIcon?: boolean;
  className?: string;
}

export function ApprovalStatusBadge({
  status,
  showIcon = true,
  className,
}: ApprovalStatusBadgeProps) {
  const key = (status ?? "NOT_REQUIRED") as ApprovalStatusValue;
  const config = APPROVAL_STATUS_CONFIG[key] ?? APPROVAL_STATUS_CONFIG.NOT_REQUIRED;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3 shrink-0" />}
      {config.label}
    </span>
  );
}
