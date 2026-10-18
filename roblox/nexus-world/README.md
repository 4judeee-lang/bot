# Nexus World — map greybox

Built with the `roblox-map` skill from the concept map, scaled so 1 image pixel ≈ 1 stud. The map is 1680 × 944 studs.
North on the art (the top) is −Z in Roblox.

| Realm | Where | Ground |
|---|---|---|
| Nexus Plaza (hub) | centre, raised round mesa (top y 78) | cobblestone plaza, crystal spire, 8 portals facing their realms |
| Verdant Fields (start) | west | grass tier ~58, spawn + Meadow Hatchery |
| Shadowwood | north-west | dark mud plateau ~84, slate crag + castle, Cursed Nest |
| Frostpeak | north | snow/glacier ridge, peaks to ~260, Egg Nest |
| Celestia | north-east | 8 floating sky isles (150–225 high) over a lake, palace, Sky Hatchery egg (portal access) |
| Chroma City | east | asphalt plateau ~60, glass towers, Hatch Pods |
| Sandswept Ruins | south-east | low dunes ~38, three sandstone mesas, ruined arches, Ancient Hatchery |
| Azure Shores | south-centre | the bay, Lighthouse Isle and Palm Isle (swim), sand spit to Coral Hatchery |
| Emberfall | south-west | basalt volcano with a lava crater and lava fields, Magma Hatchery |

Roads link the hub to every realm, and a south-shore road joins Emberfall, Coral and Sandswept.

## Files

| File | What |
|---|---|
| `make_spec.py` | **the source**. Edit this, then run it to regenerate the spec |
| `nexus_world.json` | the generated roblox-map spec |
| `NexusWorld_parts.rbxmx` | every part (landmarks, hatcheries, portals, isles, towers, invisible walls), lift applied. Insert from File |
| `work/north_up.png` | top-down preview in the same orientation as the art |
| `work/plan.png`, `work/terrain/preview.png` | the skill's own plan and terrain previews (these draw +Z at the top, so they look upside-down next to the art) |
| `work/report.json` | prover report |

## Proof status

`RESULT: WARN`. There are no failures.
- **Passing:** all P checks, plus T1 flatness, T2 relief (levels at 38 / 59 / 83), T3, T4 (every hatchery can be walked to from spawn), T7 earthworks and T10 spawn.
- **T6 coast (WARN):** the coast is mostly cliff.
- **T8 cliff cover (WARN):** the voxel cliffs are bare. Both warnings clear when cliff and rock meshes are added.

## Build it in Studio (on your PC, Studio open, Roblox Studio MCP connected)

```bash
python .claude/skills/roblox-map/scripts/build_map.py roblox/nexus-world/nexus_world.json \
    --out roblox/nexus-world/work --serve
```
Then, through `execute_luau`, follow what it prints:
1. Run the bootstrap (parts, spawn, kill plane).
2. Run `build_terrain.lua`, `horizon_ocean.lua` and `tide.lua`.
3. Run `luau/verify_ground.lua` and `luau/verify_build.lua`.
4. Run the spawn probe in a playtest.

For the parts only, without the terrain, use Insert from File → `NexusWorld_parts.rbxmx`.

## Open debts (this is a greybox)

- The spire, portals, hatcheries, sky isles, towers, castle, lighthouse and arches are placeholder parts. Each one needs a mesh (`roblox-3d-model`).
- None of the trees, houses, creatures, waterfalls or bridges are built yet. That is the dressing pass.
- The cliffs need cliff models (T8).
