---
title: Activity Wizard Password
---

# Activity Wizard Password Recovery

Use this tool to extract and recover the Activity Wizard password from a Packet Tracer activity file.

::: tip How it works
Packet Tracer stores the Activity Wizard password hash in the `PASS` attribute of the `<ACTIVITY>` tag. This tool extracts that hash and runs an MD5 candidate attack (common passwords, instruction-derived words, and your custom list).
:::

<ClientOnly>
  <ActivityWizardPassword />
</ClientOnly>
