"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqCategory {
  category: string;
  items: FaqItem[];
}

interface FaqAccordionProps {
  items: FaqItem[] | FaqCategory[];
  className?: string;
  /** If true, items is treated as categorised (FaqCategory[]). */
  categorised?: boolean;
}

function isCategorised(
  items: FaqItem[] | FaqCategory[]
): items is FaqCategory[] {
  return items.length > 0 && "category" in items[0];
}

export function FaqAccordion({ items, className, categorised }: FaqAccordionProps) {
  const grouped = categorised || isCategorised(items);

  if (grouped) {
    const cats = items as FaqCategory[];
    return (
      <div className={cn("space-y-8", className)}>
        {cats.map((cat) => (
          <div key={cat.category}>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              {cat.category}
            </h3>
            <Accordion type="single" collapsible className="w-full">
              {cat.items.map((item, i) => (
                <AccordionItem key={i} value={`${cat.category}-${i}`}>
                  <AccordionTrigger className="text-sm font-medium">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </div>
    );
  }

  const flat = items as FaqItem[];
  return (
    <Accordion type="single" collapsible className={cn("w-full", className)}>
      {flat.map((item, i) => (
        <AccordionItem key={i} value={`item-${i}`}>
          <AccordionTrigger className="text-sm font-medium">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
