"use client"

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-gray-950 text-white font-sans">
        <div className="text-center space-y-4 p-8">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-gray-400">An unexpected error occurred. Please try again.</p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md text-sm font-medium transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
