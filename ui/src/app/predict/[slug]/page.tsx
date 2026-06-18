import type { Metadata } from "next";
import { findSeed, SEED_MARKETS } from "@/lib/predict/seed";
import MarketDetail from "@/components/predict/MarketDetail";

// Pre-render the known/fallback slugs; live Polymarket markets render on demand.
export function generateStaticParams() {
  return SEED_MARKETS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const seed = findSeed(slug);
  if (seed) {
    return {
      title: `${seed.question} · Theseus Predict`,
      description: seed.description,
    };
  }
  const readable = slug.replace(/-[a-f0-9]{4,8}$/, "").replace(/-/g, " ");
  return {
    title: `${readable} · Theseus Predict`,
    description:
      "A live, agent-settled prediction market on Theseus Predict, settled from the public record instead of a token vote.",
  };
}

export default async function Page(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  return <MarketDetail slug={slug} />;
}
