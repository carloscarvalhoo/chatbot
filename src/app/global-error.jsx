"use client";

export default function GlobalError({ reset }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          color: "#e4e4e7",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: 380 }}>
          <h1 style={{ fontSize: "1rem", fontWeight: 600 }}>Algo deu errado</h1>
          <p style={{ marginTop: 8, fontSize: "0.875rem", color: "#a1a1aa", lineHeight: 1.6 }}>
            Tivemos um problema grave ao carregar a aplicação. Recarregar a página costuma resolver.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              borderRadius: 12,
              border: "none",
              background: "#fff",
              color: "#18181b",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
