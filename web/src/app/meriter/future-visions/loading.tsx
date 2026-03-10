export default function FutureVisionsLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 animate-pulse">
      <div className="h-8 w-48 bg-base-300 rounded" />
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-20 bg-base-300 rounded" />
        ))}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <li key={i} className="h-64 bg-base-300 rounded-lg" />
        ))}
      </ul>
    </div>
  );
}
