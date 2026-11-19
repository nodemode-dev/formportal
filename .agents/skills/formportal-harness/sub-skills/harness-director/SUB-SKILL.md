---
name: harness-director
description: Plans a broad FormPortal job before any tool runs. Use when the person asks to set up the whole Form family, update everything, prepare a new computer, compare what is installed with what is released, or anything that touches several products or channels at once.
---

# harness-director

## Intake

Write down, before any change:

1. The person's words, unparaphrased.
2. `status`: the platform, the install folder and `outside_agents`. Unless that is Allowed, `install`, `update`, `rollback` and `remove` will all be refused: tell the person first, and offer the plan as a list they carry out in the FormPortal window, or after choosing Allowed in Preferences, Apps, Outside agents.
3. `apps`: per product and channel, offered and installed.

## Build the plan

One row per product and channel that would change:

| Product | Channel | Installed | Offered | Size | Action |
| --- | --- | --- | --- | --- | --- |

- **Update everything** means the rows `updates` returns (it lists only newer versions, so a downgrade never appears); after the yes, `update {}` does them all in one call.
- **Set up the family** means every `available` stable product the person names. When they say "everything", list the available ones and the in-progress ones separately, and install only what is available.
- Add the total download size.

## Confirm once, then work

Show the table and get one yes for the whole plan. Then act row by row (`install`, `rollback` or `remove`), one call per row, and keep going past a failed row: note its error, finish the others. A refusal for the outside-agents choice is the exception: it is the same for every row, so stop and tell the person instead of repeating it.

## Close

Run `installs`, then report per row: done (version), skipped (why), failed (FormPortal's sentence). Nothing claimed that `installs` does not show.
