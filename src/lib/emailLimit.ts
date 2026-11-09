import { tooMany } from "./rateLimit";
export const rateLimitedEmail = (userId: string) => tooMany(`mail:${userId}`, 20, 10 * 60_000);
