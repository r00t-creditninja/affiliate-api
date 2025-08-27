// redirect to url provided in the get request token parameter
import { NextRequest, NextResponse } from "next/server";
import { compactDecrypt } from "jose";
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  console.log("Received token:", token);
  const decoded = Buffer.from(token, "base64").toString("utf-8");
  console.log("Decoded token:", decoded);

  // Decrypt the token to get the original URL
  const decrypted = await decrypt(decoded);
  console.log("Decrypted token:", decrypted);
  return NextResponse.redirect(decrypted);
}
export async function decrypt(jwe: string) {
  const pw = new TextEncoder().encode(process.env.ENCRYPTION_KEY);
  const { plaintext } = await compactDecrypt(jwe, pw);
  return new TextDecoder().decode(plaintext);
}
