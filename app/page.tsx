import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold tracking-tight">Lead Hub</h1>
      <p className="max-w-md text-center text-sm text-neutral-500">
        Sign in with login and password, or open the personal link from your
        administrator (
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
          /access/&lt;token&gt;
        </code>
        ).
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <Link
          className="font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
          href="/login"
        >
          Sign in
        </Link>
        <Link
          className="font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
          href="/access/invalid"
        >
          Invalid link help
        </Link>
      </div>
    </div>
  );
}
