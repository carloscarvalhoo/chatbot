export default function Card({ className = "", children, ...props }) {
  return (
    <div className={`glass rounded-2xl ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className = "", children }) {
  return <div className={`p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5 sm:px-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
