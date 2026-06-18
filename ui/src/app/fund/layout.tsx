import { demoMetadata } from "@/lib/demo-copy";

export const metadata = demoMetadata("fund");

export default function FundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
