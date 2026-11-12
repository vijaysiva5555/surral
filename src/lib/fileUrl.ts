/** Shared by client and server: turn a stored image value into something an <img> can show.
    New uploads are S3 keys (served through /api/files); older values may still be data URLs. */
export const fileSrc = (v?: string | null) => (!v ? undefined : v.startsWith("data:") || v.startsWith("/") || v.startsWith("http") ? v : `/api/files/${v}`);
