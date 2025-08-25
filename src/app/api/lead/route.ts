// app/api/agora/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

export async function POST(req: NextRequest) {
  try {
    await new Promise((resolve) =>
      setTimeout(resolve, 5000 + Math.random() * 4000)
    );
    return NextResponse.json(
      {
        status: "accepted",
        redirectUrl: "https://google.com",
      },
      { status: 200 }
    );
    const raw = await req.json();
    const parsed = AgoraLeadSchema.parse(raw);

    // Map bankMonths -> subID3 if needed; remove the convenience key
    const payload: Record<string, unknown> = { ...parsed };
    if (payload.bankMonths !== undefined && payload.subID3 === undefined) {
      payload.subID3 = payload.bankMonths;
    }
    delete payload.bankMonths;

    // Compose Agora URL from env (fallback keeps path shape for non-prod)
    const base =
      process.env.AGORA_BASE_URL ??
      "https://creditninja-agora.digitaljobler.com";
    const url = `${base}/api/v1/service/submit`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "API-KEY": process.env.AGORA_API_KEY || "",
        "API-SECRET": process.env.AGORA_API_SECRET || "",
      },
      body: JSON.stringify(payload),
    });

    // Try to parse JSON; fall back to text
    const text = await res.text();
    let upstream: any;
    try {
      upstream = JSON.parse(text);
    } catch {
      upstream = { raw: text };
    }

    // Normalize responses for the UI
    if (res.status === 200 && upstream?.status === "ACCEPTED") {
      return NextResponse.json(
        {
          status: "accepted",
          redirectUrl: upstream.redirectUrl,
          price: upstream.price,
        },
        { status: 200 }
      );
    }
    if (res.status === 200 && upstream?.status === "REJECTED") {
      return NextResponse.json(
        { status: "rejected", message: upstream?.message ?? "rejected" },
        { status: 200 }
      );
    }

    // Bubble up validation/auth/other errors with context
    return NextResponse.json(
      {
        status: "error",
        upstreamStatus: res.status,
        upstream,
      },
      { status: res.status }
    );
  } catch (err: any) {
    if (err?.issues) {
      // Zod validation error
      return NextResponse.json(
        { status: "validation_error", errors: err.flatten?.() ?? err },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { status: "error", message: "Unexpected server error" },
      { status: 500 }
    );
  }
}
