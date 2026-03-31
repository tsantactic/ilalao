"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SavedGame = { id: number; name: string; owner: string; data: any; createdAt: string };

type User = { email: string; avatarUrl?: string | null } | null;

export default function HomePage() {
  const [user, setUser] = useState<User>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {}
  }, []);

  // fetch saved games for current user
  const [games, setGames] = useState<SavedGame[]>([]);
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      fetchGames(u.email);
    }
  }, []);

  async function fetchGames(owner: string) {
    try {
      const res = await fetch(`/api/game/list?owner=${encodeURIComponent(owner)}`);
      const data = await res.json();
      if (res.ok) setGames(data.games || []);
    } catch (e) {}
  }

  async function handleDeleteGame(id: number) {
    if (!user) return setMsg("Utilisateur introuvable");
    if (!confirm("Supprimer cette partie ?")) return;
    const res = await fetch("/api/game/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, owner: user.email }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg("Partie supprimée");
      fetchGames(user.email);
    } else setMsg(data?.error || "Erreur");
  }

  function handleJoinGame(id: number) {
    router.push(`/game?load=${id}`);
  }

  function handleLogoutLocal() {
    localStorage.removeItem("user");
    setUser(null);
    router.push("/");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!user) return setMsg("Utilisateur introuvable");
    const res = await fetch("/api/auth/update-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) setMsg("Mot de passe mis à jour");
    else setMsg(data?.error || "Erreur");
  }

  async function handleUpdateAvatar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!user) return setMsg("Utilisateur introuvable");
    if (!avatarFile) return setMsg("Veuillez sélectionner une image");

    const form = new FormData();
    form.append("email", user.email);
    form.append("avatar", avatarFile);

    const res = await fetch("/api/auth/upload-avatar", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (res.ok) {
      const newUser = { email: user.email, avatarUrl: data?.user?.avatarUrl || "" };
      localStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);
      setMsg("Avatar mis à jour");
    } else {
      setMsg(data?.error || "Erreur");
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!user) return setMsg("Utilisateur introuvable");
    const res = await fetch("/api/auth/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: currentPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.removeItem("user");
      setMsg("Compte supprimé");
      router.push("/");
    } else {
      setMsg(data?.error || "Erreur");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="max-w-3xl p-8 coc-card">
        <div className="flex items-center gap-4 mb-6">
          <img
            src={user?.avatarUrl || "/file.svg"}
            alt="avatar"
            width={80}
            height={80}
            style={{ borderRadius: 12 }}
          />
          <div>
            <h2 className="text-xl coc-heading">Hello{user ? `, ${user.email}` : ""}</h2>
            <div className="text-sm text-gray-600">Bienvenue sur Ilalao</div>
          </div>
        </div>

        {msg && <div className="mb-4 text-sm text-red-700">{msg}</div>}

        <section className="mb-6">
          <h3 className="font-semibold mb-2">Changer la photo de profil</h3>
          <form onSubmit={handleUpdateAvatar} className="flex gap-2 items-center">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setAvatarFile(f);
              }}
              className="border p-2"
            />
            <button className="coc-btn" type="submit">Mettre à jour</button>
          </form>
        </section>

        <section className="mb-6">
          <h3 className="font-semibold mb-2">Changer le mot de passe</h3>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-2">
            <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Mot de passe actuel" type="password" className="border p-2" />
            <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nouveau mot de passe" type="password" className="border p-2" />
            <button className="coc-btn" type="submit">Changer</button>
          </form>
        </section>

        <section className="mb-6">
          <h3 className="font-semibold mb-2">Supprimer le compte</h3>
          <form onSubmit={handleDeleteAccount} className="flex gap-2 items-center">
            <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Confirmer mot de passe" type="password" className="border p-2" />
            <button className="coc-btn-outline" type="submit">Supprimer</button>
          </form>
        </section>

        <section className="mb-6">
          <h3 className="font-semibold mb-2">Parties sauvegardées</h3>
          {games.length === 0 ? (
            <div className="text-sm text-gray-600">Aucune partie sauvegardée.</div>
          ) : (
            <ul className="space-y-2">
              {games.map((g) => (
                <li key={g.id} className="flex items-center justify-between border p-2">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-sm text-gray-600">{new Date(g.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="coc-btn" onClick={() => handleJoinGame(g.id)}>Rejoindre</button>
                    <button className="coc-btn-outline" onClick={() => handleDeleteGame(g.id)}>Supprimer</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-6 flex gap-2 items-center">
          <Link href="/game" className="coc-btn">Jouer</Link>
          <button onClick={handleLogoutLocal} className="coc-btn-outline">Déconnexion</button>
        </div>
      </main>
    </div>
  );
}
