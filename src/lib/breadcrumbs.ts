/* The breadcrumb trail in the header, built from the page address. */

const SEGMENTS: Record<string, string> = {
  dashboard: "Dashboard",
  search: "Advanced search",
  spare: "Spare",
  equipment: "Equipment",
  quotations: "Quotations",
  new: "New",
  customers: "Customers",
  pricing: "Pricing",
  bom: "BOM packages",
  hsn: "HSN codes",
  users: "Users",
  settings: "Company",
  terms: "Terms templates",
  audit: "Audit log",
  profile: "Profile",
  parts: "Parts master",
  access: "Page access",
  project: "Project",
  stock: "Stock",
  inward: "Inward",
  outward: "Outward",
  ledger: "Ledger",
  reports: "Reports",
};

/** a crumb with no href is shown as plain text: a menu group (Equipment, Spare, Project) is not a page of its own */
export type Crumb = { href: string | null; label: string };
const GROUPS = new Set(["equipment", "spare", "project"]);

export function breadcrumbs(path: string): Crumb[] {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return [{ href: "/dashboard", label: "Dashboard" }];
  const out: Crumb[] = [{ href: "/dashboard", label: "Home" }];
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    acc += `/${parts[i]}`;
    const seg = parts[i];
    if (/^[a-f0-9]{24}$/i.test(seg)) {
      out.push({ href: acc, label: "Details" });
      continue;
    }
    out.push({ href: i === 0 && GROUPS.has(seg) ? null : acc, label: SEGMENTS[seg] ?? seg });
  }
  return out;
}
