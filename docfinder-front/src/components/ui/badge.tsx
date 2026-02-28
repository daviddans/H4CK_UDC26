import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-xl border px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "border-transparent bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]",
      secondary: "border-transparent bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
      outline: "text-[hsl(var(--foreground))]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
