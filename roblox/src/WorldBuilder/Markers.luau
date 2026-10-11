-- Invisible, non-colliding gameplay markers for systems that come later:
--   CreatureSpawn (every clearing), BossArena (landmark arenas),
--   HatchStation (every pavilion), BiomeEntrance (each world's front door).
-- Each marker is tagged with CollectionService and carries attributes.

local CollectionService = game:GetService("CollectionService")
local Layout = require(script.Parent.Layout)
local Field = require(script.Parent.Field)
local Parts = require(script.Parent.Parts)

local Markers = {}

local function marker(folder: Instance, name: string, pos: Vector3, radius: number, tag: string, attrs: { [string]: any }): Part
	local p = Parts.cyl(folder, pos + Vector3.new(0, 0.5, 0), 1, radius * 2, Color3.fromRGB(255, 80, 200), Enum.Material.SmoothPlastic, { noCollide = true, name = name, shadow = false })
	p.Transparency = 1
	p.CanQuery = false
	p:SetAttribute("Radius", radius)
	for k, v in attrs do
		p:SetAttribute(k, v)
	end
	CollectionService:AddTag(p, tag)
	return p
end

function Markers.build(ctx)
	local counts = { CreatureSpawn = 0, BossArena = 0, HatchStation = 0, BiomeEntrance = 0 }
	for _, c in Layout.clearings do
		local y = Field.groundTop(c.c.X, c.c.Z, c.c.Y + 5)
		if c.arena then
			marker(ctx.markers("BossArena"), c.name, Vector3.new(c.c.X, y, c.c.Z), c.r, "BossArena", { Biome = c.biome })
			counts.BossArena += 1
		end
		marker(ctx.markers("CreatureSpawn"), c.name, Vector3.new(c.c.X, y, c.c.Z), c.r, "CreatureSpawn", { Biome = c.biome, Arena = c.arena == true })
		counts.CreatureSpawn += 1
	end
	for _, p in Layout.pavilions do
		marker(ctx.markers("HatchStation"), p.name, p.pos, 20, "HatchStation", { Biome = p.biome, Style = p.style })
		counts.HatchStation += 1
	end
	marker(ctx.markers("HatchStation"), "SkyTempleAltar", Vector3.new(350, 504, -1790), 18, "HatchStation", { Biome = "SkyIslands", Style = "temple", Optional = true })
	counts.HatchStation += 1
	for _, e in Layout.entrances do
		marker(ctx.markers("BiomeEntrance"), e.name, e.pos, 18, "BiomeEntrance", { Biome = e.name })
		counts.BiomeEntrance += 1
	end
	return counts
end

return Markers
