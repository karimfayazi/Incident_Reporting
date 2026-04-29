import type { NextConfig } from "next";

/** Always merged with LAN entries so local dev (localhost / 127.0.0.1) HMR is never blocked. */
const LOOPBACK_DEV_ORIGINS = ["localhost", "127.0.0.1", "::1"] as const;

/**
 * Dev-only: extra browser origins allowed for webpack HMR WebSockets (beyond Next defaults).
 * Set `NEXT_DEV_ALLOWED_ORIGINS` in `.env.local` as comma-separated hostnames or IPs (no scheme).
 * Loopback hosts above are always included when this env is set so LAN-only lists do not block localhost.
 * Omit the env entirely to rely on Next.js built-in dev defaults.
 */
function getAllowedDevOrigins(): string[] | undefined {
  const raw = process.env.NEXT_DEV_ALLOWED_ORIGINS?.trim();
  if (!raw) {
    return undefined;
  }

  const fromEnv = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (fromEnv.length === 0) {
    return undefined;
  }

  return [...new Set([...LOOPBACK_DEV_ORIGINS, ...fromEnv])];
}

const allowedDevOrigins = getAllowedDevOrigins();

const nextConfig: NextConfig = {
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
  experimental: {
    turbopackFileSystemCacheForDev: false
  }
};

export default nextConfig;
