import { type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface FeatureCard {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
}

interface FeatureGridProps {
  features: FeatureCard[];
  className?: string;
  columns?: 2 | 3 | 4;
}

export function FeatureGrid({
  features,
  className,
  columns = 3,
}: FeatureGridProps) {
  const gridCols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];

  return (
    <div className={cn("grid gap-6", gridCols, className)}>
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <Card
            key={feature.title}
            className="group relative overflow-hidden transition-shadow hover:shadow-md"
          >
            <CardHeader className="pb-3">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                {feature.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {feature.badge}
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold leading-snug">{feature.title}</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
