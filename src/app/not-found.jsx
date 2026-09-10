import ErrorState from "@/components/ui/ErrorState";

export default function NotFound() {
  return (
    <ErrorState
      title="Página não encontrada"
      message="O endereço que você tentou abrir não existe ou foi movido."
    />
  );
}
