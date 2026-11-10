export function NotificationsLoading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading notifications">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="h-4 w-32 rounded bg-muted/80" />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-16 rounded-xl bg-muted/70" />
      ))}
    </div>
  );
}
