import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit max-w-full shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tracking-tight",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        primary: "bg-primary/12 text-primary",
        danger: "bg-destructive/12 text-destructive",
        warn: "bg-warning/12 text-warning",
        success: "bg-primary/12 text-primary",
        outline: "border border-border text-foreground",
        ink: "bg-ink text-ink-foreground",
      },
      size: {
        default: "",
        tight:
          "h-[1.125rem] shrink-0 whitespace-nowrap px-1.5 py-0 text-[11px] leading-none",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
