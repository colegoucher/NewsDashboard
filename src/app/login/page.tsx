"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Wrong password");
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6">
      {/* soft glow accents */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-fuchsia-300/20 blur-3xl" />

      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">🗞️</div>
          <h1 className="text-2xl font-bold tracking-tight text-white">News Dashboard</h1>
          <p className="mt-1 text-sm text-indigo-100">Your morning, already read for you.</p>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded-xl border border-white/25 bg-white/15 px-4 py-3 text-base text-white placeholder-indigo-200 outline-none transition focus:border-white/60 focus:bg-white/20"
        />
        {error && <p className="mt-2 text-sm font-medium text-rose-200">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-4 w-full rounded-xl bg-white py-3 text-base font-semibold text-indigo-700 shadow-lg transition hover:bg-indigo-50 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "…" : "Open the paper"}
        </button>
      </form>
    </main>
  );
}
