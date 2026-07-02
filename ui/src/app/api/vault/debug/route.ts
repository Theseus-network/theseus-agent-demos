/** TEMPORARY: verify Blob round-trips in production. Remove after diagnosis. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const hasSettler = !!process.env.SETTLER_PRIVATE_KEY;
  const out: any = { hasToken, hasSettler };
  if (!hasToken) return Response.json(out);
  try {
    const { put, list } = await import("@vercel/blob");
    const KEY = "vault/_debug.json";
    const payload = JSON.stringify({ t: "probe" });
    const w = await put(KEY, payload, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
    out.wroteUrl = w.url;
    const { blobs } = await list({ prefix: "vault/" });
    out.listed = blobs.map((b) => b.pathname);
    const read = await (await fetch(w.url, { cache: "no-store" })).json();
    out.readBack = read;
    out.ok = true;
  } catch (e) {
    out.ok = false;
    out.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  return Response.json(out);
}
