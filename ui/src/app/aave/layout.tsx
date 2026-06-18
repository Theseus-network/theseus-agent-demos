import { demoMetadata } from "@/lib/demo-copy";

export const metadata = demoMetadata("aave");

export default function AaveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
