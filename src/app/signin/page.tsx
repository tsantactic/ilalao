"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/dist/client/link";

export default function SigninPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data?.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
        }
        router.push("/home");
      } else {
        setError(data?.error || "Erreur lors de l'inscription");
      }
    } catch (err) {
      setError("Erreur réseau");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-4 coc-card p-8">
        <h2 className="text-xl font-semibold coc-heading">Inscription</h2>
        {error && <div className="text-red-600">{error}</div>}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border p-2"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          className="border p-2"
        />
        <button className="coc-btn">S'inscrire</button>
        <Link href="/login" className="text-blue-500 hover:underline mt-4">
          Déjà un compte ? Connectez-vous
        </Link>
      </form>
    </div>
  );
}
