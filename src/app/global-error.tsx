"use client"

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#030712", color: "#f9fafb", fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "24rem" }}>
          <div style={{ margin: "0 auto 1.25rem", width: "3.5rem", height: "3.5rem", borderRadius: "9999px", backgroundColor: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg style={{ width: "1.75rem", height: "1.75rem", color: "#ef4444" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>Something went wrong</h1>
          <p style={{ fontSize: "0.875rem", color: "#9ca3af", marginBottom: "1.5rem" }}>Chalk ran into an unexpected error. Please try refreshing the page.</p>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => reset()}
              style={{ padding: "0.5rem 1rem", backgroundColor: "#0891b2", color: "#fff", border: "none", borderRadius: "0.375rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{ padding: "0.5rem 1rem", border: "1px solid #374151", borderRadius: "0.375rem", fontSize: "0.875rem", fontWeight: 500, color: "#f9fafb", textDecoration: "none" }}
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
