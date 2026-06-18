import { demoMetadata } from "@/lib/demo-copy";

export const metadata = demoMetadata("governance");

export default function GovernanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
