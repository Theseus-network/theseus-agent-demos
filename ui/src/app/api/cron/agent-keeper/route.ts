/**
 * Agent keeper: re-register any expected agent that a testnet reset wiped.
 *
 * The Theseus alpha testnet is ephemeral — a reset erases every agent and the
 * whole system (Vera's posts, the trader desk, the demo suite) silently freezes.
 * This cron reads the precompiled manifest, checks each agent is still on-chain
 * by name, and re-registers the missing ones from their stored SCALE payload, so
 * the system self-heals without a manual redeploy. Crons find agents by name, so
 * the re-registered address does not need to match the old one.
 *
 * Env: THESEUS_SIGNER_SEED (//Alice), THESEUS_RPC, CRON_SECRET.
 */
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { blake2AsU8a, encodeAddress } from "@polkadot/util-crypto";
import { u8aToHex, stringToU8a } from "@polkadot/util";
import manifest from "@/lib/predict/agent-manifest.json";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";

export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  try {
    const signer = new Keyring({ type: "sr25519" }).addFromUri(process.env.THESEUS_SIGNER_SEED ?? "//Alice");
    const utf8 = (h: string) => Buffer.from(String(h).replace(/^0x/, ""), "hex").toString("utf8");
    const present = new Set(
      (await api.query.agents.agents.entries()).map(([, v]) => utf8((v.toJSON() as any).name)),
    );

    const missing = (manifest as { name: string; salt: string; scaleHex: string }[]).filter((a) => !present.has(a.name));
    if (!missing.length) {
      return Response.json({ ok: true, checked: manifest.length, present: present.size, reregistered: [] });
    }

    let nonce = (await api.rpc.system.accountNextIndex(signer.address)).toNumber();
    const VALUE = 1_000_000_000_000n; // 1 THE endowment
    const done: { name: string; addr: string }[] = [];
    const failed: { name: string; error: string }[] = [];

    for (const a of missing) {
      const salt = blake2AsU8a(stringToU8a(a.salt), 256);
      const r = await new Promise<{ addr?: string; err?: string }>((resolve) => {
        api.tx.agents
          .registerShipAgent({ Sovereign: null }, VALUE, a.scaleHex, u8aToHex(salt))
          .signAndSend(signer, { nonce: nonce++ }, ({ status, dispatchError, events }: any) => {
            if (dispatchError) {
              let msg = dispatchError.toString();
              if (dispatchError.isModule) { try { const d = api.registry.findMetaError(dispatchError.asModule); msg = `${d.section}.${d.name}`; } catch {} }
              resolve({ err: msg }); return;
            }
            if (status.isInBlock) {
              let addr: string | undefined;
              for (const { event } of events) {
                if (event.section === "agents" && /Registered/i.test(event.method)) {
                  const flat = JSON.stringify(event.data.toJSON());
                  const m = flat.match(/5[1-9A-HJ-NP-Za-km-z]{46,48}/);
                  addr = m ? m[0] : (flat.match(/0x[0-9a-f]{64}/i) ? encodeAddress(flat.match(/0x[0-9a-f]{64}/i)![0], 42) : undefined);
                }
              }
              resolve({ addr });
            }
          }).catch((e) => resolve({ err: (e as Error).message }));
      });
      if (r.addr) done.push({ name: a.name, addr: r.addr });
      else failed.push({ name: a.name, error: r.err || "unknown" });
    }

    return Response.json({
      ok: failed.length === 0,
      checked: manifest.length,
      present: present.size,
      reregistered: done,
      failed,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  } finally {
    await api.disconnect();
  }
}
