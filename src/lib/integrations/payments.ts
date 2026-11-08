import { PaymentMethod } from "@prisma/client";

export type PaymentVerifyResult = {
  ok: boolean;
  status: "VERIFIED" | "REJECTED" | "PENDING_REVIEW";
  provider: string;
  message: string;
  mock: boolean;
};

/**
 * Manual + sandbox verification.
 * Live JazzCash/bank APIs need merchant credentials — until then:
 * - JazzCash refs starting with JC-OK- verify
 * - Bank refs length >= 8 verify
 * - Cheque numbers length >= 4 mark RECEIVED/verified stub
 */
export function verifyPaymentReference(input: {
  method: PaymentMethod;
  reference: string;
  amount: number;
}): PaymentVerifyResult {
  const ref = input.reference.trim();
  if (!ref) {
    return {
      ok: false,
      status: "REJECTED",
      provider: input.method,
      message: "Reference required",
      mock: true,
    };
  }

  if (input.method === "JAZZCASH") {
    if (ref.toUpperCase().startsWith("JC-OK-")) {
      return {
        ok: true,
        status: "VERIFIED",
        provider: "JAZZCASH",
        message: "Sandbox JazzCash verification passed",
        mock: true,
      };
    }
    if (ref.toUpperCase().startsWith("JC-FAIL-")) {
      return {
        ok: false,
        status: "REJECTED",
        provider: "JAZZCASH",
        message: "Sandbox JazzCash verification rejected",
        mock: true,
      };
    }
    return {
      ok: true,
      status: "PENDING_REVIEW",
      provider: "JAZZCASH",
      message: "No live JazzCash API — mark manually or use JC-OK-{txn}",
      mock: true,
    };
  }

  if (input.method === "BANK") {
    if (ref.length >= 8) {
      return {
        ok: true,
        status: "VERIFIED",
        provider: "BANK",
        message: "Bank reference accepted (manual sandbox rules)",
        mock: true,
      };
    }
    return {
      ok: false,
      status: "REJECTED",
      provider: "BANK",
      message: "Bank reference too short (min 8 chars in sandbox)",
      mock: true,
    };
  }

  if (input.method === "CHEQUE") {
    return {
      ok: true,
      status: ref.length >= 4 ? "VERIFIED" : "PENDING_REVIEW",
      provider: "CHEQUE",
      message:
        ref.length >= 4
          ? "Cheque number recorded — clear manually when bank clears"
          : "Cheque number incomplete",
      mock: true,
    };
  }

  return {
    ok: true,
    status: "PENDING_REVIEW",
    provider: input.method,
    message: "Installment / other — confirm each installment separately",
    mock: true,
  };
}
