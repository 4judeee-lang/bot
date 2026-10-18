# Claude instructions

## Roblox skills — always use them

This repo ships the SyphoDev Roblox skill pack in `.claude/skills/` and its agents in
`.claude/agents/` (source: https://github.com/SyphoDev-yt/roblox-ai-skills/tree/main/skills).

For ANY Roblox work, load and follow the matching skill before doing anything else:

| Skill | Use for |
|---|---|
| `create-roblox-game` | Front door: making a whole game, stage by stage |
| `roblox-build-orchestrator` | Running a full build pipeline with sub-agents |
| `roblox-code` | Luau / Rojo / Knit / Wally game code |
| `roblox-ui` | GUI, HUD, shops, icons |
| `roblox-map` | Maps, arenas, terrain, greyboxes |
| `roblox-3d-model` | Generating MeshParts / 3D models |
| `roblox-texture-gen` | Textures and skins |
| `roblox-vfx` | Particle effects |
| `roblox-sfx` | Sound effects and music |
| `roblox-animation` | R15 / R6 animations |
| `roblox-skills-setup` | First-time setup, writes each skill's `LOCAL.md` |

Each skill's `LOCAL.md` is per-machine and is git-ignored — run `roblox-skills-setup` to create it.
