import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";

export async function POST(request: Request) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
