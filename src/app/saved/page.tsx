import { ItemCard } from "@/components/item-card";
import { Nav } from "@/components/nav";
import { getSaved } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const saved = await getSaved();

  return (
    <>
      <Nav active="saved" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        {saved.length === 0 ? (
          <p className="py-16 text-center text-sm text-neutral-500">
            Nothing saved yet. Saved items live here forever.
          </p>
        ) : (
          <div className="space-y-3">
            {saved.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
