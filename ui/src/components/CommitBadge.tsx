import type { OnChainCommit } from "@/lib/agent-onchain/types";
import { theseusAgentUrl } from "@/lib/theseus-agents";

interface Props {
  commit?: OnChainCommit;
  error?: string;
  className?: string;
  /** Demo slug, used to link the agent's page on the Theseus explorer. */
  slug?: string;
}

export function CommitBadge({ commit, error, className, slug }: Props) {
  const explorerUrl = slug ? theseusAgentUrl(slug) : null;

  if (commit) {
    return (
      <div
        className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] mono ${className ?? ""}`}
      >
        <span className="text-fg-mute uppercase tracking-wider">
          Recorded on Theseus
        </span>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-coral hover:underline underline-offset-[3px] break-all"
          >
            explorer.theseus.network ↗
          </a>
        )}
        {commit.blobUrl && (
          <a
            href={commit.blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-dim hover:text-fg underline-offset-[3px] hover:underline"
          >
            reasoning blob ↗
          </a>
        )}
      </div>
    );
  }
  if (error) {
    return (
      <div
        className={`mt-2 text-[10.5px] mono text-amber ${className ?? ""}`}
      >
        On-chain commit failed: {error}
      </div>
    );
  }
  return null;
}
