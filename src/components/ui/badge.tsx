import { cn } from "@/lib/utils";

const colors: Record<string, string> = {
  default: "bg-slate-100 text-slate-700",
  teal: "bg-[rgba(172,22,224,0.08)] text-[#8b10b8]",
  purple: "bg-[rgba(172,22,224,0.08)] text-[#8b10b8]",
  green: "bg-emerald-50 text-emerald-800",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-800",
  blue: "bg-sky-50 text-sky-800",
  violet: "bg-violet-50 text-violet-800",
};

export function Badge({
  className,
  color = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { color?: keyof typeof colors }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        colors[color] || colors.default,
        className
      )}
      {...props}
    />
  );
}
