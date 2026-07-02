import { redirect } from "next/navigation";

// The Sovereign Fund now lives at its own standalone route with its own identity.
export default function FundRedirect() {
  redirect("/vault");
}
