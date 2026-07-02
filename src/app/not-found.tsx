import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-5 p-8 max-w-sm">
        <h1 className="text-5xl font-bold text-muted-foreground font-[family-name:var(--font-exo2)]">404</h1>
        <p className="text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
