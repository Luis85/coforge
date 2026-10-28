---
id: "native-mcp"
title: "Local MCP server"
goal: "Activate one MCP connection for every CoForge project in this vault."
audience: "streamer"
kind: "panel"
route: "native settings / Local MCP server"
parent: "native-settings"
component: "src/plugin/presentation/components/coforge/PluginSettingsMcp.vue"
entry: ["Open Obsidian Settings → Community plugins → CoForge → Local MCP server."]
actions: ["Activate MCP","Deactivate MCP","Acknowledge inspected workspace recovery"]
states: ["Inactive","Updating","Active","Configuration error","Desktop unavailable","Interrupted workspace"]
journeys: ["setup","workflow-configuration"]
privacy: "Private workflow context and code; loopback authentication is stored only in ignored plugin data."
---

# Local MCP server

## Purpose

Let external agents perform Screen, Score, Plan and Build against canonical CoForge requests while retaining the final human review.

## Entry and next action

Open the [native integration settings](native-settings.md) and activate MCP once. Node.js 22+ must be on PATH. Activation registers one bundled stdio bridge in the vault's `.mcp.json` and the user's `~/.claude.json`. Reconnect the client, discover projects with `coforge_projects`, and pass the chosen project ID to workflow tools. New projects appear automatically without further registration.

## States and recovery

Activation and deactivation are serialized and show actionable configuration errors. Both client files are preflighted; unrelated entries survive. Conflicting or malformed configuration is preserved. An interrupted activation stays inactive until explicitly retried or removed. Changing a game repository does not require a registration change; an in-flight task still rejects a changed repository identity.

## Composition and boundaries

Use existing native settings rows and controls. Credentials stay in private plugin data. The bridge re-reads its descriptor on each request, so clients can reconnect after Obsidian restarts without a configuration rewrite. Deactivation revokes access before attempting removal; unload closes the listener, interrupts tasks and clears credentials. No approval, moderation, shell, Git push or human-checkpoint tools are exposed.

Source: [PluginSettingsMcp.vue](../../../src/plugin/presentation/components/coforge/PluginSettingsMcp.vue). Protocol, tools and privacy details: [MCP integration](../../coforge/MCP.md).
