export default function PageTitle({ title, description }) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-zinc-100">{title}</h1>
      {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
    </div>
  );
}
