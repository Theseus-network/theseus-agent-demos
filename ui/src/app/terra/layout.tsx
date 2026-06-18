import { demoMetadata } from "@/lib/demo-copy";

export const metadata = demoMetadata("terra");

export default function TerraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
