export default function Loading() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="h-9 w-36 bg-muted rounded-lg animate-pulse" />
      <div className="h-10 w-full bg-muted rounded-lg animate-pulse" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-5 w-24 bg-muted rounded animate-pulse" />
          {[...Array(3)].map((_, j) => (
            <div key={j} className="h-9 w-full bg-muted/40 rounded-lg animate-pulse" />
          ))}
        </div>
      ))}
    </main>
  )
}
