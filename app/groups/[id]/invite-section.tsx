"use client";

import { useState, useTransition } from "react";
import { ensureInviteTokenAction } from "./invite-actions";

interface InviteSectionProps {
  groupId: string;
  inviteUrl: string | null; // null = no token yet
}

/**
 * Invite UI — shows either a "Generate invite link" button (if no token yet)
 * or the existing link with a copy-to-clipboard button.
 *
 * UX choice: no separate page or modal. The link appears inline, immediately
 * usable. One tap to copy, one paste to share.
 */
export function InviteSection({ groupId, inviteUrl }: InviteSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function generate() {
    startTransition(async () => {
      await ensureInviteTokenAction(groupId);
    });
  }

  async function copy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs uppercase tracking-wide text-ink/55">Invite</h2>
      {inviteUrl ? (
        <div className="flex items-center gap-2 bg-card border border-hairline rounded-xl p-2 pl-3">
          <span className="text-sm truncate flex-1 text-ink/75 select-all">
            {inviteUrl}
          </span>
          <button
            type="button"
            onClick={copy}
            className="px-3 h-9 rounded-lg bg-accent text-white text-sm font-medium active:scale-95 transition"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          className="h-11 rounded-xl bg-card border border-hairline hover:border-accent/40 text-sm font-medium transition disabled:opacity-50"
        >
          {isPending ? "Generating…" : "Generate invite link"}
        </button>
      )}
      <p className="text-xs text-ink/45">
        Anyone with this link who signs in joins the group.
      </p>
    </section>
  );
}
