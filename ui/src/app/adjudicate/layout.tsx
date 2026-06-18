import { demoMetadata } from "@/lib/demo-copy";

export const metadata = demoMetadata("adjudicate");

export default function AdjudicateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
