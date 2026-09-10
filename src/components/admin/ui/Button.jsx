const VARIANTS = {
  primary: "bg-white text-zinc-900 hover:bg-zinc-100 disabled:bg-zinc-600 disabled:text-zinc-300",
  secondary: "glass glass-hover text-zinc-200 disabled:opacity-50",
  ghost: "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 disabled:opacity-50",
  danger:
    "border border-red-500/25 bg-red-500/[0.06] text-red-300 hover:bg-red-500/[0.14] disabled:opacity-50",
};

const SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export default function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
