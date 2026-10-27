# Manual stream finances

Open **Finances** to record actual income received or expenses paid in EUR. Set description, payment date,
category and optionally a recorded stream. Amounts accept a dot or comma with at most two decimal places;
storage uses integer cents. Edit existing entries or confirm an exact entry before deleting it.

Recurring expense plans support weekly/monthly/yearly amounts, start date and active/paused state. They
never create actual payments. Record payments separately. Monthly equivalents use weekly × 52 ÷ 12 and
yearly ÷ 12, summed and rounded to cents without proration. Only active plans beginning by month end count.
Plans remain channel-wide when filtering actual income and expenses to a stream. Pausing affects the current
estimate, not historical payment records; this increment does not retain a history of plan activation changes.

The month and stream filters control actual totals. Recorded balance is income minus expenses; it is not a
bank balance or inferred Twitch revenue. No subscriptions, taxes, bank accounts or payment services are queried.

`CoForge/Finance/Ledger.md` is the private canonical ledger: type `coforge-finance`, version 1, currency EUR,
and an entries array. Entry IDs remain stable. Unknown top-level frontmatter and exact Markdown body bytes
are preserved. External changes invalidate a draft revision; refresh and review before saving again. Invalid
ledgers are preserved rather than reset. The public viewer board and structured logs exclude financial details.
