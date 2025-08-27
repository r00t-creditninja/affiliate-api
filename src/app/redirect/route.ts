// redirect to url provided in the get request token parameter
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  // Decrypt the token to get the original URL
  const decrypted = await decrypt(token);
  return NextResponse.redirect(decrypted);
}

async function decrypt(encrypted: string): Promise<string> {
  const [ivBase64, cipherBase64] = encrypted.split(":");
  const iv = new Uint8Array(Buffer.from(ivBase64, "base64"));
  const cipher = new Uint8Array(Buffer.from(cipherBase64, "base64"));

  const rawKey = new TextEncoder().encode(process.env.ENCRYPTION_KEY);
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    cipher
  );

  return new TextDecoder().decode(decrypted);
}
