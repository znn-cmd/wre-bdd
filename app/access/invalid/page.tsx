import Link from "next/link";

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function AccessInvalidPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const hashHint = reason === "hash-in-url";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4">
      <h1 className="text-lg font-semibold tracking-tight">
        Access link invalid or expired
      </h1>
      <p className="max-w-md text-center text-sm text-neutral-500 dark:text-neutral-400">
        Ask your administrator for a new link. If you already opened the app in
        this browser, your session may have been revoked.
      </p>
      {hashHint ? (
        <p className="max-w-md rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <span className="font-medium">Common mistake:</span> the URL must
          contain your <strong>secret access token</strong> (the long random
          string), <em>not</em> the <strong>token_hash</strong> column from the
          spreadsheet. The sheet only stores SHA-256 of the token; opening{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/80">
            /access/&lt;64-char hex&gt;
          </code>{" "}
          will not work.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <Link
          href="/login"
          className="font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
        >
          Sign in
        </Link>
        <Link
          href="/"
          className="font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
