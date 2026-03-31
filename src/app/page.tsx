import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-6 bg-white dark:bg-black sm:items-start">
        <h1 className="text-3xl font-semibold coc-heading mb-8">Bienvenue</h1>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Link href="/login" className="coc-btn flex h-12 items-center justify-center">
            Connexion
          </Link>
          <Link href="/signin" className="coc-btn-outline flex h-12 items-center justify-center">
            Inscription
          </Link>
        </div>
      </main>
    </div>
  );
}
