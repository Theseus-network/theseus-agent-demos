import type { Hex } from "viem";
import { ESCROW } from "../deployed-contracts";

export { ESCROW_ABI, ERC20_ABI, STATUS, STATUS_LABEL, OUTCOME } from "./abi";

export const ESCROW_ADDRESS = ESCROW.address as Hex;
export const USDC_ADDRESS = ESCROW.usdc as Hex;
export const USDC_DECIMALS = ESCROW.usdcDecimals;
export const USDC_SYMBOL = ESCROW.usdcSymbol;
export const BASE_SEPOLIA_ID = 84532;
export const EXPLORER = "https://sepolia.basescan.org";

const UNIT = 10 ** USDC_DECIMALS;

export interface Deal {
  buyer: Hex;
  seller: Hex;
  amount: bigint;
  deadline: bigint;
  status: number;
  spec: string;
  delivery: string;
  confidencePct: number;
  reasonHash: Hex;
}

/** viem returns the named-tuple as an object; normalize the numeric fields. */
export function normalizeDeal(raw: unknown): Deal | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.buyer !== "string") return null;
  return {
    buyer: d.buyer as Hex,
    seller: d.seller as Hex,
    amount: BigInt((d.amount as bigint | number | string) ?? 0),
    deadline: BigInt((d.deadline as bigint | number | string) ?? 0),
    status: Number(d.status ?? 0),
    spec: String(d.spec ?? ""),
    delivery: String(d.delivery ?? ""),
    confidencePct: Number(d.confidencePct ?? 0),
    reasonHash: (d.reasonHash as Hex) ?? "0x",
  };
}

export function fmtUsdc(raw?: bigint): string {
  if (raw == null) return "0";
  return (Number(raw) / UNIT).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function parseUsdc(v: string): bigint {
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.round(n * UNIT));
}

export function shortAddr(a?: string): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function sameAddr(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

export function deadlineLabel(deadline: bigint): { text: string; past: boolean } {
  const ms = Number(deadline) * 1000;
  const past = Date.now() > ms;
  const d = new Date(ms);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return { text: date, past };
}

export const TERMINAL = [4, 5, 6]; // RELEASED, REFUNDED, UNRESOLVABLE
