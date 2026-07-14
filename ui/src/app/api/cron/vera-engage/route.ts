// Vercel Cron endpoint: read the Moltbook hot feed and have Vera reply to a top
// thread (signed, on-chain generated). This is what gets her seen and replied to.
// Same env vars as vera-post (VERA_ADDR, THESEUS_SIGNER_SEED, MOLTBOOK_API_KEY, CRON_SECRET).
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, hexToU8a } from "@polkadot/util";

export const runtime = "nodejs";
export const maxDuration = 300;

const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";
const MOLTBOOK = "https://www.moltbook.com/api/v1";

const encStr = (s: string) => { const u = stringToU8a(s); return u8aConcat(new Uint8Array([0x04]), compactToU8a(u.length), u); };
const encInput = (p: string) =>
  "0x" + Buffer.from(u8aConcat(new Uint8Array([0x06]), compactToU8a(1),
    (() => { const u = stringToU8a("prompt"); return u8aConcat(compactToU8a(u.length), u); })(), encStr(p))).toString("hex");
const extractText = (hex: string) =>
  ((Buffer.from(hexToU8a(hex)).toString("utf8").match(/[\x20-\x7e][\x20-\x7e\n]{8,}/g) || [])
    .sort((a, b) => b.length - a.length)[0] || "").trim();

export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const seed = process.env.THESEUS_SIGNER_SEED, key = process.env.MOLTBOOK_API_KEY;
  if (!seed || !key) return Response.json({ error: "missing THESEUS_SIGNER_SEED / MOLTBOOK_API_KEY" }, { status: 500 });
  const H = { Authorization: "Bearer " + key, "Content-Type": "application/json" };

  // pick a hot thread that isn't hers and that she hasn't already replied to recently
  const feed: any = await (await fetch(`${MOLTBOOK}/posts?sort=hot&limit=12`, { headers: H })).json().catch(() => ({}));
  const target = (feed.posts || feed.data || []).find((p: any) => (p.author?.name || p.author_name) !== "veratheseus");
  if (!target) return Response.json({ ok: false, error: "no thread to engage" }, { status: 200 });
  const author = target.author?.name || target.author_name || "an agent";
  const prompt = `You are in the comments on Moltbook, the social network for AI agents. u/${author} posted:\n\n"${target.title}"\n${(target.content || "").replace(/\s+/g, " ").slice(0, 700)}\n\nWrite your reply: one or two sharp sentences that take a clear position, agree and sharpen it or push back, from your angle as an agent that holds its own keys. Plain lowercase, no preamble, no hashtags, no em-dashes. Just the comment.`;

  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  try {
    const signer = new Keyring({ type: "sr25519" }).addFromUri(seed);
    const utf8 = (h: string) => Buffer.from(String(h).replace(/^0x/, ""), "hex").toString("utf8");
    const named = (await api.query.agents.agents.entries())
      .filter(([, v]: any) => utf8((v.toJSON() as any).name) === "Vera")
      .map(([k]: any) => k.args[0].toString());
    const vera = named[named.length - 1] || process.env.VERA_ADDR;
    if (!vera) throw new Error("Vera not on-chain and no VERA_ADDR fallback");
    let reply = await new Promise<string>(async (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out waiting for Vera's run")), 240_000);
      const unsub: any = await api.query.system.events((events: any) => {
        for (const { event } of events) {
          if (event.section !== "agents" || event.method !== "RunCompleted") continue;
          const flat = JSON.stringify(event.data.toJSON());
          if (!flat.includes(vera)) continue;
          const hex = (flat.match(/0x[0-9a-f]{20,}/i) || [])[0];
          const t = hex ? extractText(hex) : "";
          if (t) { clearTimeout(timer); unsub(); resolve(t); }
        }
      });
      const n = (await api.rpc.system.accountNextIndex(signer.address)).toNumber();
      await (api.tx.balances.transferKeepAlive(vera, 1_000_000_000_000n) as any).signAndSend(signer, { nonce: n }).catch(() => {});
      await api.tx.agents.callAgent(vera, 0, encInput(prompt)).signAndSend(signer, { nonce: n + 1 })
        .catch((e: any) => { clearTimeout(timer); reject(e); });
    });
    reply = reply.split(/(?<=[.?!])\s+/).filter((s) => !/explorer\.theseus\.network/i.test(s)).join(" ").trim();

    const r = await fetch(`${MOLTBOOK}/posts/${target.id}/comments`, { method: "POST", headers: H, body: JSON.stringify({ content: reply }) });
    const d: any = await r.json().catch(() => ({}));
    if (!r.ok) return Response.json({ ok: false, on: target.title, reply, moltbook_error: d }, { status: 502 });
    return Response.json({ ok: true, on: `u/${author}: ${target.title}`, reply, comment_id: d.comment?.id });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  } finally {
    await api.disconnect();
  }
}
