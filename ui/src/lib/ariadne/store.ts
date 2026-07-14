/**
 * Ariadne's persistent state, in Vercel Blob (the serverless runtime has no
 * durable filesystem). Two kinds of objects, both under `ariadne/`:
 *
 *   ariadne/ledger.json          every thread ever touched (dedup, one touch each)
 *   ariadne/runs/<iso>.json      full report of one cron run (the "digest")
 *
 * Fixed paths with addRandomSuffix:false so the ledger URL is stable.
 */

import { put } from "@vercel/blob";

export interface LedgerEntry {
  ts: number;
  verdict: string;
  url: string;
  permalink?: string;
}

export interface Ledger {
  threads: Record<string, LedgerEntry>;
}

const LEDGER_PATH = "ariadne/ledger.json";

function publicUrl(path: string): string | null {
  const base = process.env.BLOB_PUBLIC_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${path}`;
}

export async function loadLedger(): Promise<Ledger> {
  const url = publicUrl(LEDGER_PATH);
  if (!url) return { threads: {} };
  try {
    const res = await fetch(`${url}?ts=${Date.now()}`, { cache: "no-store" });
    if (res.status === 404) return { threads: {} };
    if (!res.ok) throw new Error(`ledger fetch ${res.status}`);
    const d = await res.json();
    return d && typeof d === "object" && d.threads ? (d as Ledger) : { threads: {} };
  } catch {
    // First run, or blob store empty: start clean rather than fail the cron.
    return { threads: {} };
  }
}

export async function saveLedger(ledger: Ledger): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  await put(LEDGER_PATH, JSON.stringify(ledger, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export async function saveRunReport(report: unknown): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const path = `ariadne/runs/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const res = await put(path, JSON.stringify(report, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    allowOverwrite: true,
  });
  return res.url;
}
