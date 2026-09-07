# Agent Mailroom

Receive-first portable mailroom on Cloudflare Email Workers + SQLite Durable Objects.

Zone: agentmailroom.net / subdomain mailroom.agentmailroom.net
Lanes: frontdesk, test. Reject unknown recipients. Receive-only. No R2.
90-day SQLite retention; full body; attachment metadata only.
