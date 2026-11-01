import { ApiError, errorResponse, readJson } from "@/lib/server/http";
import {
  clearSellerLoginAttempts,
  recordFailedSellerLogin,
  requireLoginAttemptAllowed,
  sellerLoginKey,
} from "@/lib/server/seller-login-rate";
import {
  clearSellerSessionCookie,
  createSellerSessionToken,
  passwordAuthConfigured,
  sellerSessionCookie,
  verifySellerPassword,
} from "@/lib/server/seller-session";
import { database } from "@/lib/server/stall";

export async function POST(request: Request) {
  try {
    if (!passwordAuthConfigured()) {
      throw new ApiError(
        "AUTH_NOT_CONFIGURED",
        "Seller login is not configured yet.",
        503,
      );
    }

    const payload = await readJson(request);
    if (typeof payload.password !== "string" || !payload.password) {
      throw new ApiError(
        "INVALID_CREDENTIALS",
        "Enter the seller password.",
        401,
      );
    }

    const db = database();
    const key = await sellerLoginKey(request);
    await requireLoginAttemptAllowed(db, key);
    if (!(await verifySellerPassword(payload.password))) {
      await recordFailedSellerLogin(db, key);
      throw new ApiError(
        "INVALID_CREDENTIALS",
        "The password is incorrect.",
        401,
      );
    }

    await clearSellerLoginAttempts(db, key);
    const token = await createSellerSessionToken();
    return Response.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": sellerSessionCookie(token),
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      Location: new URL("/seller", request.url).toString(),
      "Set-Cookie": clearSellerSessionCookie(),
    },
  });
}

