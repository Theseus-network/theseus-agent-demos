import { demoMetadata } from "@/lib/demo-copy";

export const metadata = demoMetadata("aviation");

export default function AviationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
