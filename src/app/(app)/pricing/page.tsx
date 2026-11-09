import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PricingClient from "./PricingClient";

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  return <PricingClient role={session!.user.role} />;
}
