// app/api/agora/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CompactEncrypt } from "jose";
export const runtime = "nodejs";

/**
 * Schema matches Agora V1.1. Field names are case-sensitive per spec.
 * Note: We accept a friendlier "bankMonths" from the UI and map it to subID3.
 */
const AgoraLeadSchema = z
  .object({
    // Required
    campaignID: z.number().int(),
    ipAddress: z.string(), // (allow proxies/IPv6 string)
    sourceURL: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    streetAddress: z.string(),
    city: z.string(),
    state: z.string().length(2),
    zipCode: z.string().min(5),
    homePhone: z.string().min(10),
    workPhone: z.string().min(10),
    mobilePhone: z.string().min(10),
    email: z.string().email(),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ssn: z.string().length(9),
    ownRent: z.enum(["own", "rent", "other"]),
    yearsAtResidence: z.number().int().min(0).max(127),
    monthsAtResidence: z.number().int().min(0).max(11),
    incomeSource: z.enum([
      "employment",
      "socialSecurity",
      "disability",
      "retirement",
      "unemployment",
      "other",
    ]),
    employer: z.string(),
    yearsAtEmployer: z.number().int().min(0).max(127),
    monthsAtEmployer: z.number().int().min(0).max(11),
    monthlyIncome: z.union([z.string(), z.number()]),
    loanAmount: z.union([z.string(), z.number()]),
    payMethod: z.enum(["checking", "savings", "paper", "other"]),
    payPeriod: z.enum(["weekly", "biWeekly", "semiMonthly", "monthly"]),
    firstPayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    secondPayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    bankName: z.string(),
    bankAccountType: z.enum(["checking", "savings"]),
    bankRoutingNumber: z.string(),
    bankAccountNumber: z.string(),
    activeMilitary: z.union([z.string(), z.number()]),
    minPrice: z.union([z.string(), z.number()]),

    // Optional
    gender: z.enum(["m", "f"]).optional(),
    streetAddress2: z.string().optional().nullable(),
    workPhoneExt: z.string().optional(),
    citizen: z.union([z.string(), z.number()]).optional(),
    licenseNumber: z.string().optional(),
    licenseState: z.string().length(2).optional(),
    title: z.string().optional(),
    employerAddress: z.string().optional(),
    employerCity: z.string().optional(),
    employerState: z.string().length(2).optional(),
    employerZip: z.union([z.string(), z.number()]).optional(),
    bankPhone: z.string().optional(),
    referencePrimaryName: z.string().optional(),
    referencePrimaryPhone: z.string().optional(),
    referencePrimaryRelation: z.string().optional(),
    referenceSecondaryName: z.string().optional(),
    referenceSecondaryPhone: z.string().optional(),
    referenceSecondaryRelation: z.string().optional(),
    optin: z.union([z.string(), z.number()]).optional(),
    bankruptcy: z.union([z.string(), z.number()]).optional(),
    timeToCall: z.string().optional(),
    campaignRouting: z.union([z.string(), z.number()]).optional(),
    subID: z.string().optional(),
    subID2: z.string().optional(),
    subID3: z.union([z.string(), z.number()]).optional(), // Bank Months per spec
    bankMonths: z.union([z.string(), z.number()]).optional(), // UI convenience
    subID4: z.string().optional(),
    subID5: z.string().optional(),
    subID6: z.string().optional(),
    subID7: z.string().optional(),
    subID8: z.string().optional(),
    subID9: z.string().optional(),
    subID10: z.string().optional(),
    subIDBig: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.subID3 === undefined && data.bankMonths === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "bankMonths (subID3) is required",
        path: ["bankMonths"],
      });
    }
  });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // allow all
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  // list the headers you plan to receive; include "authorization" if you send it
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  // optional: reduce preflight frequency
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS(_req: NextRequest) {
  // Preflight: must include CORS headers even with 204
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function encrypt(plaintext: string) {
  const pw = new TextEncoder().encode(process.env.ENCRYPTION_KEY);
  const jwe = await new CompactEncrypt(new TextEncoder().encode(plaintext))
    .setProtectedHeader({ alg: "PBES2-HS256+A256KW", enc: "A256GCM" })
    .encrypt(pw);
  return jwe; // compact JWE string
}

export async function POST(req: NextRequest) {
  await new Promise((resolve) =>
    setTimeout(resolve, 5000 + Math.random() * 4000)
  );

  const encrypted = await encrypt("https://google.com");
  const base64Encrypted = Buffer.from(encrypted).toString("base64");
  const res = NextResponse.json(
    {
      status: "accepted",
      redirectUrl:
        "https://prod.americacashfast.com/redirect?token=" + base64Encrypted,
    },
    { status: 200 }
  );
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}
