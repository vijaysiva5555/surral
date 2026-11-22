/** Sign-in names: 3–30 characters, lower-case letters, digits, dot, dash or underscore, starting with a letter or digit. */
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const normUsername = (s: unknown) => String(s ?? "").trim().toLowerCase();
export const USERNAME_HINT = "3–30 characters: letters, digits, dot, dash or underscore (no spaces)";
