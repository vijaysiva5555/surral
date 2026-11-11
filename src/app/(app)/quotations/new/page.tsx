import { redirect } from "next/navigation";

export default function LegacyNewQuote() {
  redirect("/spare/quotations/new");
}
