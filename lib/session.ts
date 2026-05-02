export const SESSION_COOKIE_NAME = "ir_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export const userRoles = ["field_volunteer", "ntf_volunteer", "admin"] as const;

export type UserRole = (typeof userRoles)[number];

export type SessionUser = {
  userId: number;
  username: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
};

export type SessionPayload = SessionUser & {
  exp: number;
  iat: number;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.JWT_SECRET || "dev-only-change-this-auth-secret";
}

function base64UrlEncode(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.includes(value as UserRole);
}

export function normalizeUserRole(value: unknown): UserRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return isUserRole(normalized) ? normalized : null;
}

export function getRoleRedirect(role: UserRole) {
  if (role === "field_volunteer") {
    return "/record-incident";
  }

  if (role === "admin") {
    return "/admin/dashboard";
  }

  return "/dashboard";
}

export async function signSessionToken(user: SessionUser) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    ...user,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await crypto.subtle.sign("HMAC", await getSigningKey(), new TextEncoder().encode(data));

  return `${data}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = base64UrlDecode(encodedSignature);
  const isValid = await crypto.subtle.verify(
    "HMAC",
    await getSigningKey(),
    expectedSignature,
    new TextEncoder().encode(data)
  );

  if (!isValid) {
    return null;
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as Partial<SessionPayload>;
    const now = Math.floor(Date.now() / 1000);

    if (
      typeof payload.userId !== "number" ||
      typeof payload.username !== "string" ||
      typeof payload.fullName !== "string" ||
      !isUserRole(payload.role) ||
      typeof payload.exp !== "number" ||
      payload.exp <= now
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      username: payload.username,
      fullName: payload.fullName,
      phone: typeof payload.phone === "string" ? payload.phone : null,
      role: payload.role,
      iat: typeof payload.iat === "number" ? payload.iat : now,
      exp: payload.exp
    };
  } catch {
    return null;
  }
}
