/** Small fetch helper for client components: returns JSON or throws the server's error message */
export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, json !== undefined
    ? { ...rest, method: rest.method ?? "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) }
    : rest);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}
