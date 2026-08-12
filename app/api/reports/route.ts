import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { reportSchema, parseJson } from "@/lib/validation";
import { rateLimitGuard } from "@/lib/rate-limit";

/** Report a user or a post (Phase 12 moderation). */
export async function POST(request: Request) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const limited = rateLimitGuard("default", request);
  if (limited) return limited;

  const user = await getSessionUser();
  if (!user?.profile) return unauthorized();

  let body;
  try {
    body = reportSchema.parse(await parseJson(request));
  } catch (e) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: (e as Error).message } },
      { status: 400 }
    );
  }

  // Self-reporting is meaningless.
  if (body.targetType === "USER" && body.targetId === user.profile.id) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "You cannot report yourself" } },
      { status: 400 }
    );
  }

  const report = await prisma.report.create({
    data: {
      reporterId: user.profile.id,
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason,
    },
  });

  return NextResponse.json({ report: { id: report.id, status: report.status } }, { status: 201 });
}
