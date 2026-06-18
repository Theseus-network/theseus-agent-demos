import DealView from "@/components/escrow/DealView";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-fg-mute">Invalid deal id.</main>;
  }
  return <DealView id={n} />;
}
