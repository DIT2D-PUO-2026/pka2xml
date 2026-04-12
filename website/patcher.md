---
title: PKA Patcher
---

# PKA Patcher

Use this tool to **patch activity timer variables** inside a Packet Tracer `.pka` / `.pkt` file — directly in your browser.

::: tip How it works
The file is decrypted to XML, the selected variables are patched in-memory, and the result is re-encrypted and downloaded as a new `.pka` file. Nothing is stored server-side.
:::

<ClientOnly>
  <PkaPatcher />
</ClientOnly>

---

## Patchable variables

| Label | XML attribute | Description |
|-------|---------------|-------------|
| **Expired Activity Bypass** | `COUNTDOWN_EXPIRED` | `0` = not expired &nbsp;/&nbsp; `1` = expired. Uncheck **Mark as expired** inside the card to clear the expiry flag (`0`) and bypass the check. |
| **Default Time** | `COUNTDOWNMS` | Total activity timer duration in milliseconds. |
| **Time Left** | `COUNTDOWNLEFT` | Remaining countdown time in milliseconds. |
| **Check Results Feature** | `COMPARISONS/NAME[@checkType]` | Enable checks by converting `checkType="0"` to `1`, or disable checks by converting `checkType="1"` / `2` to `0`. |

::: details Tips
- Tick only the patches you want to change; unticked patches are left as-is in the file.
- For **Default Time** and **Time Left**, enter hours, minutes and seconds — the tool converts them to milliseconds automatically.
- Set **Time Left** equal to (or greater than) **Default Time** to effectively reset the timer.
- To bypass an expired activity, uncheck **Mark as expired** under *Expired Activity Bypass*.
- The **Check Results Feature** patch is only useful when assessment items exist in the `COMPARISONS` section.
:::
