// Uploads delivered files (images, PDFs) to blob storage and returns their URLs.
// The seller's on-chain delivery references these URLs; the adjudicator fetches
// them and hands them to the agent as visual evidence.
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED = /\.(png|jpe?g|webp|gif|pdf)$/i;

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "File uploads aren't configured on this server (BLOB_READ_WRITE_TOKEN)." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "expected a multipart form" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File).slice(0, 8);
  if (!files.length) return Response.json({ error: "no files" }, { status: 400 });

  const urls: string[] = [];
  for (const f of files) {
    if (!ALLOWED.test(f.name)) continue;
    if (f.size > 20 * 1024 * 1024) continue; // 20MB cap per file
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await put(`escrow-deliveries/${Date.now()}-${safe}`, f, { access: "public", addRandomSuffix: true });
    urls.push(blob.url);
  }

  if (!urls.length) return Response.json({ error: "no valid files (images or PDFs only)" }, { status: 400 });
  return Response.json({ urls });
}
