import { FollowingList } from "@/components/following-list";
import { ItemCard } from "@/components/item-card";
import { Nav } from "@/components/nav";
import { getFollowing, getSaved } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const [saved, following] = await Promise.all([getSaved(), getFollowing()]);

  return (
    <>
      <Nav active="saved" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <FollowingList follows={following} />
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
