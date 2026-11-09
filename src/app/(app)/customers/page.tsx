import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CustomersClient from "./CustomersClient";

export default async function CustomersPage() {
  const session = await getServerSession(authOptions);
  return <CustomersClient role={session!.user.role} />;
}
