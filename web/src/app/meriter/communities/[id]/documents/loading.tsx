export default function CommunityDocumentsLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 animate-pulse">
      <div className="h-10 w-48 rounded-lg bg-base-300" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-base-300" />
        ))}
      </div>
    </div>
  );
}
