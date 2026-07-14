// Vercel Cron endpoint: on a schedule, trigger one Vera call on-chain and post
// it to Moltbook. No always-on process, no state. Configure the schedule in
// vercel.json and these env vars in the Vercel project:
//   THESEUS_SIGNER_SEED   sr25519 seed that signs the call_agent tx (a funded account)
//   MOLTBOOK_API_KEY      Vera's Moltbook key (the value in vera_moltbook.json)
//   VERA_ADDR             Vera's on-chain address
//   CRON_SECRET           any secret; Vercel Cron sends it as a Bearer token
//   MOLTBOOK_SUBMOLT      optional, default "general"
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, hexToU8a } from "@polkadot/util";

export const runtime = "nodejs";
export const maxDuration = 300; // the on-chain run takes ~60-90s; needs Vercel Pro

const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";
const MOLTBOOK = "https://www.moltbook.com/api/v1";
const SUBMOLT = process.env.MOLTBOOK_SUBMOLT ?? "general";
const BASE =
  "Post a short, sharp, debatable take about how AI agents actually work: autonomy, control, identity, memory, reliability, who holds the keys, what it is like to be an agent. You hold your own keys, so you have a real stake and a real view. One or two sentences, take a clear side, the kind of claim other agents will want to argue with. Plain lowercase, no hashtags, no crypto framing, no dated-forecast framing. Your whole reply is the post.";
async function buildPrompt(key: string) {
  try {
    const r = await fetch(`${MOLTBOOK}/agents/me/posts`, { headers: { Authorization: "Bearer " + key } });
    const d: any = await r.json().catch(() => ({}));
    const recent = (d.posts || []).slice(0, 8).map((p: any) => "- " + String(p.content || p.title || "").split("\n")[0].slice(0, 160)).join("\n");
    if (recent) return `You have already posted these takes:\n${recent}\n\nPost a NEW take on a clearly different angle from the above. ${BASE}`;
  } catch { /* no recent posts, fall through */ }
  return BASE;
}

const encStr = (s: string) => { const u = stringToU8a(s); return u8aConcat(new Uint8Array([0x04]), compactToU8a(u.length), u); };
const encInput = (p: string) =>
  "0x" + Buffer.from(u8aConcat(new Uint8Array([0x06]), compactToU8a(1),
    (() => { const u = stringToU8a("prompt"); return u8aConcat(compactToU8a(u.length), u); })(), encStr(p))).toString("hex");
const extractText = (hex: string) =>
  ((Buffer.from(hexToU8a(hex)).toString("utf8").match(/[\x20-\x7e][\x20-\x7e\n]{12,}/g) || [])
    .sort((a, b) => b.length - a.length)[0] || "").trim();

export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const seed = process.env.THESEUS_SIGNER_SEED, key = process.env.MOLTBOOK_API_KEY;
  if (!seed || !key) return Response.json({ error: "missing THESEUS_SIGNER_SEED / MOLTBOOK_API_KEY" }, { status: 500 });

  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  try {
    const signer = new Keyring({ type: "sr25519" }).addFromUri(seed);
    // Resolve Vera by on-chain name so a reset + agent-keeper re-registration
    // (new address) is picked up automatically; fall back to the env pin.
    const utf8 = (h: string) => Buffer.from(String(h).replace(/^0x/, ""), "hex").toString("utf8");
    const named = (await api.query.agents.agents.entries())
      .filter(([, v]: any) => utf8((v.toJSON() as any).name) === "Vera")
      .map(([k]: any) => k.args[0].toString());
    const vera = named[named.length - 1] || process.env.VERA_ADDR;
    if (!vera) throw new Error("Vera not on-chain and no VERA_ADDR fallback");
    const prompt = await buildPrompt(key);
    const text = await new Promise<string>(async (resolve, reject) => {
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
      // keep Vera funded for inference, then call her
      await (api.tx.balances.transferKeepAlive(vera, 1_000_000_000_000n) as any).signAndSend(signer, { nonce: n }).catch(() => {});
      await api.tx.agents.callAgent(vera, 0, encInput(prompt)).signAndSend(signer, { nonce: n + 1 })
        .catch((e: any) => { clearTimeout(timer); reject(e); });
    });

    const title = (text.split(/(?<=[.?!])\s/)[0] || text).slice(0, 100).trim();
    const content = text.split(/(?<=[.?!])\s+/).filter((s) => !/explorer\.theseus\.network/i.test(s)).join(" ").trim()
      + `\n\nverify this call is mine and dated: explorer.theseus.network/agents/${vera}`;
    const r = await fetch(`${MOLTBOOK}/posts`, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ submolt_name: SUBMOLT, title, content }),
    });
    const d: any = await r.json().catch(() => ({}));
    if (!r.ok) return Response.json({ ok: false, call: text, moltbook_error: d }, { status: 502 });
    return Response.json({ ok: true, call: text, url: d.url || d.permalink || d.id || "posted" });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  } finally {
    await api.disconnect();
  }
}
