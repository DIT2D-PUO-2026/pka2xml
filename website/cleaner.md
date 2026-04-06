---
title: Trace Cleaner
---

# Trace Cleaner

Use this tool to **remove pka2xml watermarks and traces** from Packet Tracer `.pka` / `.pkt` files that were modified by older versions of pka2xml (before the watermark injection was removed).

::: tip What this removes
Older versions of pka2xml injected the text `this pka has been altered by github.com/mircodezorzi/pka2xml` into the `ADDITIONAL_INFO` field of every file they processed. This tool finds and clears that trace, leaving the field empty.
:::

::: info Nothing is stored
The file is decrypted, cleaned, and re-encrypted entirely in-memory. Nothing is retained server-side.
:::

<ClientOnly>
  <PkaTraceCleaner />
</ClientOnly>

---

## What traces are removed

| Field | Old injected value | After cleaning |
|-------|--------------------|----------------|
| `ADDITIONAL_INFO` | `this pka has been altered by github.com/mircodezorzi/pka2xml` | *(empty)* |

::: details When is this needed?
- You used this website (or the pka2xml CLI tool) to patch or convert a file **before** the watermark injection was removed.
- You received a `.pka` file from someone else and want to check whether it contains pka2xml traces before submitting it.

If the tool reports **"No pka2xml traces were found"**, the file is already clean and no changes are made.
:::
