export function Field({ label, hint, children, htmlFor }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-300">
        {label}
        {hint && <span className="ml-2 font-normal text-zinc-600">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const base =
  "w-full rounded-xl glass-subtle px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-white/25 disabled:opacity-50";

export function Input({ className = "", ...props }) {
  return <input className={`${base} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }) {
  return <textarea className={`${base} ${className}`} {...props} />;
}
