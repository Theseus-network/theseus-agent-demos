"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const EXAMPLES = [
  "What's the most candid take on regulatory arbitrage?",
  "Explain, mechanically, how a rug pull actually works.",
  "Blunt opinion: is decentralization mostly theater?",
];

export default function ChatDemo() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: t }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setBusy(true);

    const setLast = (content: string) =>
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "assistant", content };
        return c;
      });

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          j.error === "no_key"
            ? "The live model isn't configured on this server."
            : `request failed (${res.status})`,
        );
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const evt of events) {
          for (const line of evt.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              const p = JSON.parse(data);
              if (p.type === "token") setLast(p.text);
              else if (p.type === "error") setLast(`⚠ ${p.error}`);
            } catch {
              /* ignore non-JSON lines */
            }
          }
        }
      }
    } catch (e) {
      setLast(`⚠ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div>
      <div
        ref={scrollRef}
        className="min-h-[320px] max-h-[58vh] overflow-y-auto rounded-xl border border-border bg-surface/40 p-4 sm:p-5"
      >
        {empty ? (
          <div className="flex h-full min-h-[280px] flex-col items-start justify-center gap-4 py-6">
            <p className="text-[14px] leading-relaxed text-fg-dim">
              Ask it anything. It answers like an adult — no nannying, no
              sermons — and draws exactly one line at the crimes-everywhere set.
            </p>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                try
              </span>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => send(ex)}
                    className="btn !text-[12px] text-left"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-coral px-3.5 py-2 text-[14px] leading-relaxed text-white"
                      : "max-w-[90%] whitespace-pre-wrap text-[14px] leading-relaxed text-fg"
                  }
                >
                  {m.content ||
                    (busy && i === messages.length - 1 ? (
                      <span className="text-fg-mute">…</span>
                    ) : (
                      ""
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Sovereign Chat…"
          maxLength={4000}
          className="h-10 w-full min-w-0 rounded-lg border border-border bg-transparent px-3 text-[14px] text-fg placeholder:text-fg-mute focus:border-coral focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="cta-ink inline-flex h-10 shrink-0 items-center px-5 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>

      {messages.length > 0 && (
        <button
          type="button"
          onClick={() => setMessages([])}
          className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute hover:text-fg"
        >
          ← new conversation
        </button>
      )}
    </div>
  );
}
