---
title: Trace Cleaner
---

# Trace Cleaner

Use this tool to **remove pka2xml watermarks and traces** from Packet Tracer `.pka` / `.pkt` files that were modified by older versions of pka2xml (before the watermark injection was removed), including common text-format variants.

::: info Nothing is stored
The file is decrypted, cleaned, and re-encrypted entirely in-memory. Nothing is retained server-side.
:::

<ClientOnly>
  <PkaTraceCleaner />
</ClientOnly>

::: details When is this needed?
- You used this website (or the pka2xml CLI tool) to patch or convert a file **before** the watermark injection was removed.
- You received a `.pka` file from someone else and want to check whether it contains pka2xml traces before submitting it.

If the tool reports **"No pka2xml traces were found"**, the file is already clean and no changes are made.
:::
