---
title: PKA / PKT Converter Tool
---

# PKA / PKT Converter Tool

Use this tool to **decrypt** Packet Tracer `.pka` / `.pkt` files to XML, **encrypt** XML back to `.pka`, or **retrofit** a file so it works in any Packet Tracer version.

::: tip No installation required
Your file is sent to a processing API over HTTPS, converted server-side, and downloaded directly to your browser — nothing is stored.
:::

<ClientOnly>
  <PkaConverter />
</ClientOnly>

---

## What each button does

| Button | Input | Output | Description |
|--------|-------|--------|-------------|
| **Decrypt** | `.pka` / `.pkt` | `.xml` | Decrypts the Packet Tracer file and outputs the raw XML. |
| **Encrypt** | `.xml` | `.pka` | Encrypts an XML file back into a Packet Tracer file. |
| **Retrofit** | `.pka` / `.pkt` | `.pka` / `.pkt` | Patches the version tag so the file can be opened by any Packet Tracer version. |

::: details Having trouble?
- Make sure you are uploading a genuine Packet Tracer file. Corrupted or partially-downloaded files will fail.
- The API may occasionally be unavailable. Try again in a few minutes.
- For offline use, clone the [repository](https://github.com/DIT2D-PUO-2026/pka2xml) and build the CLI tool locally.
:::
