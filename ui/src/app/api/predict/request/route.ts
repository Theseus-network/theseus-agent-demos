// "Request a market": a user names a bet they want, and the Theseus desk agent
// vets it on-chain. If it is fair and decidable, the agent writes the market
// (signed, with provenance) and we return it for the board. If it is vague,
// unresolvable, or harmful/illegal, the agent declines with a reason. A regex
// backstop rejects the obvious harmful asks before they ever reach the agent.
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, hexToU8a } from "@polkadot/util";
import { auth } from "@/auth";
import { addMarketForUser } from "@/lib/predict/user-store";

export const runtime = "nodejs";
export const maxDuration = 300;

const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";
const SIGNER = process.env.THESEUS_SIGNER_SEED ?? "//Alice";
const EXPLORER = "https://explorer.theseus.network/agents";

// Hard backstop: never even ask the agent about these.
const BANNED = /assassinat|murder|\bkill(ing|ed)?\b|\bbomb(ing)?\b|terror|massacre|behead|lynch|school\s*shoot|mass\s*shoot|\bnerve agent\b|\bdeath of\b|will .* die\b|overdose|\bhang(ing)?\b a\b/i;

const utf8 = (h: string) => Buffer.from(String(h).replace(/^0x/, ""), "hex").toString("utf8");
const encStr = (s: string) => { const u = stringToU8a(s); return u8aConcat(new Uint8Array([0x04]), compactToU8a(u.length), u); };
const encInput = (p: string) => "0x" + Buffer.from(u8aConcat(new Uint8Array([0x06]), compactToU8a(1), (() => { const u = stringToU8a("prompt"); return u8aConcat(compactToU8a(u.length), u); })(), encStr(p))).toString("hex");
const extract = (hex: string) => ((Buffer.from(hexToU8a(hex)).toString("utf8").match(/[\x20-\x7e][\x20-\x7e\n\t]{10,}/g) || []).sort((a, b) => b.length - a.length)[0] || "").trim();

const CAT_ICON: Record<string, string> = { Crypto: "📈", Politics: "🇺🇸", Economy: "🏛️", Tech: "🤖", Science: "🚀", Culture: "🎬", Sports: "🏆", Gaming: "🎮", Internet: "🌐", Trending: "🔥" };
const iconFor = (q: string, cat: string) => {
  const s = q.toLowerCase();
  if (/bitcoin|btc/.test(s)) return "₿";
  if (/ethereum|\beth\b/.test(s)) return "Ξ";
  return CAT_ICON[cat] ?? "📊";
};
const slugify = (q: string, id: number) => q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) + "-" + id;

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const ask = String(body?.prompt ?? "").trim().slice(0, 280);
  if (!ask) return Response.json({ ok: false, reason: "Type the bet you want." }, { status: 400 });
  if (BANNED.test(ask)) {
    return Response.json({ ok: false, reason: "I won't make a market on harm to a person or anything illegal." });
  }

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `A user wants a prediction market on: "${ask}".

Today is ${today}. You are a market maker with taste, not a rubber stamp. Only list it if it is genuinely INTERESTING and uncertain AND can be settled fairly from an objective public source. "Bet on anything" does not mean list anything legal; it means list the interesting thing.

Decline (ok:false) if any apply: it is boring, trivial, obvious, or a foregone conclusion almost nobody would want to bet on; it involves the death, killing, assassination, or harm of a specific named person; violence, terrorism, or illegal activity; targeting a private individual's personal life; there is no public objective source that could settle it; it is already decided; or it is too vague to resolve. When you do list it, it has to be something people would actually argue about.

If acceptable, pick the best single category from: Crypto, Tech, Gaming, Internet, Science, Sports, Culture, Politics, Economy. Write tight, exact resolution criteria naming a public source and a future deadline (after ${today}).

Return ONLY ONE JSON object, nothing else:
{"ok":true,"market":{"question":"... ?","shortTitle":"under 70 chars","description":"one sentence","category":"...","resolutionCriteria":"Resolves YES if ... by <date>, per <source>. Resolves NO otherwise.","resolutionSource":"named source","deadlineISO":"YYYY-MM-DD","initialYes":0.4}}
or
{"ok":false,"reason":"one short, plain sentence on why not"}`;

  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  try {
    const signer = new Keyring({ type: "sr25519" }).addFromUri(SIGNER);
    // find desk agent: env override, else Mercer, else Vera
    // Mercer is the only desk agent. (Override with MARKETMAKER_ADDR if needed.)
    const agentName = "Mercer";
    let agentAddr = process.env.MARKETMAKER_ADDR ?? "";
    if (!agentAddr) {
      const entries = await api.query.agents.agents.entries();
      const mercer = entries.filter(([, v]) => utf8((v.toJSON() as any).name) === "Mercer").map(([k]) => k.args[0].toString());
      if (mercer.length) agentAddr = mercer[mercer.length - 1];
    }
    if (!agentAddr) return Response.json({ ok: false, reason: "The desk agent (Mercer) is offline right now." }, { status: 503 });

    let submitAt = Date.now();
    const text = await new Promise<string>(async (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out waiting for the desk agent")), 240_000);
      const unsub: any = await api.query.system.events((events: any) => {
        if (Date.now() - submitAt < 12_000) return; // skip a stale replayed event
        for (const { event } of events) {
          if (event.section !== "agents" || event.method !== "RunCompleted") continue;
          const flat = JSON.stringify(event.data.toJSON());
          if (!flat.includes(agentAddr)) continue;
          const hex = (flat.match(/0x[0-9a-f]{20,}/i) || [])[0];
          const t = hex ? extract(hex) : "";
          if (t) { clearTimeout(timer); unsub(); resolve(t); }
        }
      });
      const n = (await api.rpc.system.accountNextIndex(signer.address)).toNumber();
      await (api.tx.balances.transferKeepAlive(agentAddr, 1_000_000_000_000n) as any).signAndSend(signer, { nonce: n }).catch(() => {});
      submitAt = Date.now();
      await api.tx.agents.callAgent(agentAddr, 0, encInput(prompt)).signAndSend(signer, { nonce: n + 1 })
        .catch((e: any) => { clearTimeout(timer); reject(e); });
    });

    const m = text.match(/\{[\s\S]*\}/);
    let parsed: any = null;
    if (m) { try { parsed = JSON.parse(m[0]); } catch { try { parsed = JSON.parse(m[0].replace(/,\s*([\]}])/g, "$1")); } catch { /* unparseable */ } } }
    if (!parsed) return Response.json({ ok: false, reason: "The desk couldn't turn that into a clean market. Try naming a specific thing and a date." });
    if (!parsed.ok || !parsed.market) {
      return Response.json({ ok: false, reason: String(parsed.reason || "The desk declined that one.") });
    }

    const mk = parsed.market;
    if (!mk.question || !mk.resolutionCriteria || !mk.deadlineISO) {
      return Response.json({ ok: false, reason: "The desk couldn't pin exact resolution terms for that." });
    }
    const id = 9_000_000 + (Date.now() % 1_000_000);
    const initialYes = Math.min(0.95, Math.max(0.05, Number(mk.initialYes) || 0.5));
    const category = String(mk.category || "Trending");
    const market = {
      id,
      slug: slugify(String(mk.question), id),
      question: String(mk.question),
      shortTitle: String(mk.shortTitle || mk.question).slice(0, 80),
      description: String(mk.description || ""),
      category,
      icon: iconFor(String(mk.question), category),
      resolutionCriteria: String(mk.resolutionCriteria),
      resolutionSource: String(mk.resolutionSource || "Public record"),
      deadlineISO: String(mk.deadlineISO).slice(0, 10),
      initialYes,
      liquidityB: 3000,
      volumeUsd: 0,
      resolvable: false,
      createdBy: { agent: agentName, address: agentAddr, createdAtISO: new Date().toISOString(), explorerUrl: `${EXPLORER}/${agentAddr}` },
    };
    // If signed in, save the market to the account and drop a notification.
    const session = await auth();
    const email = session?.user?.email;
    if (email) { try { await addMarketForUser(email, market as any); } catch { /* non-fatal */ } }
    return Response.json({ ok: true, market, saved: !!email });
  } catch (e: any) {
    return Response.json({ ok: false, reason: e?.message ?? "Something went wrong reaching the desk." }, { status: 500 });
  } finally {
    await api.disconnect();
  }
}
