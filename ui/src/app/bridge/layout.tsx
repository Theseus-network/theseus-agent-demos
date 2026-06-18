import { demoMetadata } from "@/lib/demo-copy";

export const metadata = demoMetadata("bridge");

export default function BridgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
