/* Who may do what. Every screen and API route asks these helpers instead of comparing role names, so a new role
   cannot slip through a "not a viewer" check.

   admin  – everything
   sales  – quotations, BOM packages, customers…; stock pages read only
   stock  – stock pages (inward, outward, ledger, reports); the sales side read only, no BOM / cost data
   viewer – read only everywhere, no BOM / cost data */
export const ROLES = ["admin", "sales", "stock", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", sales: "Sales", stock: "Stock", viewer: "Viewer" };

type R = string | null | undefined;

/** may create and edit quotations, BOM packages, customers, HSN codes, terms – and see landed costs */
export const canSell = (role: R) => role === "admin" || role === "sales";
/** may enter stock: inward, outward, ledger cells, imports */
export const canStock = (role: R) => role === "admin" || role === "stock";
/** gets the low-stock bell */
export const seesStockAlerts = canStock;
/** sees the sales (quotation) dashboard */
export const seesSalesDashboard = (role: R) => role !== "stock";
/** sees the stock dashboard */
export const seesStockDashboard = canStock;
