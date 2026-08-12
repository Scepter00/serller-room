import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/auth";
import { csrfGuard } from "@/lib/auth";
import { rateLimitGuard } from "@/lib/rate-limit";
import { getStorageDriver, validateUpload } from "@/lib/storage";

/**
 * Upload an image → IPFS (Pinata) or the local dev fallback.
 * Server-side validation of type, size, extension and content sniffing.
 */
export async function POST(request: Request) {
  const csrf = csrfGuard(request);
  if (csrf) return csrf;

  const limited = rateLimitGuard("mediaUpload", request);
  if (limited) return limited;

  const user = await getSessionUser();
  if (!user) return unauthorized();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Expected multipart form data" } },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "No file provided" } },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const invalid = validateUpload({
    name: file.name,
    type: file.type,
    size: file.size,
    buffer,
  });
  if (invalid) {
    return NextResponse.json(
      { error: { code: "INVALID_FILE", message: invalid } },
      { status: 400 }
    );
  }

  try {
    const driver = getStorageDriver();
    const result = await driver.put({
      name: file.name,
      type: file.type,
      size: file.size,
      buffer,
    });

    await prisma.media.create({
      data: {
        uploaderId: user.id,
        cid: result.cid,
        mimeType: file.type,
        sizeBytes: file.size,
        originalName: file.name,
      },
    });

    return NextResponse.json({ cid: result.cid, url: result.url }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: "UPLOAD_FAILED",
          message: (e as Error).message ?? "Upload failed",
        },
      },
      { status: 502 }
    );
  }
}
