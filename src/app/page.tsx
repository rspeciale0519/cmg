import { site } from "@/lib/site";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-accent-300">
        {site.tagline}
      </p>
      <h1 className="text-5xl font-medium tracking-tight">{site.name}</h1>
      <p className="text-ink/72">Scaffold ready — marketing site lands in phase 2.</p>
    </main>
  );
}
