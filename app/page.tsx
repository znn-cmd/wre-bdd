import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold tracking-tight">Lead Hub</h1>
      <p className="max-w-md text-center text-sm text-neutral-500">
        Access is only via your personal link. Open the URL you received from
        your administrator (path{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
          /access/&lt;token&gt;
        </code>
        ).
      </p>
      <Link
        className="text-sm font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
        href="/access/invalid"
      >
        Invalid link help
      </Link>
    </div>
  );
}
