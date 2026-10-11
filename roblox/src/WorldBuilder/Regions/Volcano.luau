-- Volcano: molten hatch pavilion, the volcano cone with crater glow and lava streams,
-- basalt spires, purple crystals, charred trees, ember gate and the crater arena.

local Layout = require(script.Parent.Parent.Layout)
local Field = require(script.Parent.Parent.Field)
local Parts = require(script.Parent.Parent.Parts)
local Palette = require(script.Parent.Parent.Palette)
local Util = require(script.Parent.Parent.Util)
local Pavilions = require(script.Parent.Parent.Assets.Pavilions)
local Props = require(script.Parent.Parent.Assets.Props)
local Structures = require(script.Parent.Parent.Assets.Structures)
local Common = require(script.Parent.Common)

local M = Enum.Material
local Volcano = {}
local VOLC = Layout.BIOME.volcano

local function deadTree(parent: Instance, pos: Vector3, h: number, rng: Random)
	local m = Parts.model(parent, "CharredTree")
	local c = Color3.fromRGB(56, 44, 40)
	Parts.cyl(m, pos + Vector3.new(0, h / 2, 0), h, h * 0.08, c, M.Wood, { name = "Trunk" })
	for _ = 1, 4 do
		local a = rng:NextNumber(0, 6.28)
		local from = pos + Vector3.new(0, h * rng:NextNumber(0.45, 0.9), 0)
		Parts.rod(m, from, from + Vector3.new(math.cos(a) * h * 0.3, h * 0.25, math.sin(a) * h * 0.3), h * 0.04, c, M.Wood, { decor = true })
	end
end

local function spire(parent: Instance, pos: Vector3, h: number, rng: Random)
	local w = h * rng:NextNumber(0.28, 0.4)
	Parts.block(parent, CFrame.new(pos + Vector3.new(0, h / 2 - 2, 0)) * CFrame.Angles(rng:NextNumber(-0.12, 0.12), rng:NextNumber(0, 6.28), rng:NextNumber(-0.12, 0.12)), Vector3.new(w, h, w * 0.9), Util.vary(Palette.basalt, rng, 0.04), M.Basalt, { name = "Spire" })
	Parts.block(parent, CFrame.new(pos + Vector3.new(0, h - 1, 0)) * CFrame.Angles(0, rng:NextNumber(0, 6.28), 0) * CFrame.Angles(math.rad(45), 0, math.rad(45)), Vector3.new(w * 0.7, w * 0.7, w * 0.7), Util.vary(Palette.basalt, rng, 0.05), M.Basalt, { decor = true })
end

function Volcano.build(ctx)
	local rng = Random.new(Layout.SEED + 505)
	local region = ctx.region("Volcano")
	local props = Parts.folder(region, "Props")
	local landmarks = Parts.folder(region, "Landmarks")

	local pav = Layout.pavilions[5]
	Pavilions.volcano(landmarks, pav.pos, pav.face, rng)

	-- the cone: crater lava, rim rocks, lava streams down the slope, a smoke plume
	local cone
	for _, f in Layout.features do
		if f.kind == "cone" then
			cone = f
		end
	end
	local coneModel = Parts.model(landmarks, "VolcanoCone", { ModelStreamingMode = Enum.ModelStreamingMode.Persistent })
	local crater = Vector3.new(cone.c[1], cone.peak - cone.crater.depth + 1, cone.c[2])
	local lavaDisc = Parts.cyl(coneModel, crater, 2, cone.crater.r * 2 - 2, Palette.lava, M.Neon, { decor = true, name = "CraterLava" })
	Parts.light(lavaDisc, "PointLight", { Color = Palette.ember, Brightness = 3, Range = 60, Shadows = false })
	Parts.emitter(lavaDisc, {
		Texture = Structures.SMOKE, Rate = 3, Lifetime = NumberRange.new(10, 16), Speed = NumberRange.new(10, 16),
		SpreadAngle = Vector2.new(12, 12), Acceleration = Vector3.new(2, 1, 0), LightInfluence = 0.6, EmissionDirection = Enum.NormalId.Top,
		Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 30), NumberSequenceKeypoint.new(1, 90) }),
		Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.55), NumberSequenceKeypoint.new(1, 1) }),
		Color = ColorSequence.new(Color3.fromRGB(90, 76, 74)),
	})
	for i = 0, 15 do
		local a = i / 16 * math.pi * 2
		local p = Vector3.new(cone.c[1] + math.cos(a) * (cone.crater.r + 8), cone.peak - 2, cone.c[2] + math.sin(a) * (cone.crater.r + 8))
		Parts.block(coneModel, CFrame.new(p) * CFrame.Angles(rng:NextNumber(-0.3, 0.3), a, rng:NextNumber(-0.3, 0.3)), Vector3.new(18, 12, 14), Util.vary(Palette.basalt, rng, 0.04), M.Basalt, { decor = true, name = "RimRock" })
	end
	-- glowing lava streams running down the cone faces visible from the hub
	for _, bearing in { 3.6, 2.6, 4.4 } do
		local prev = nil
		for k = 0, 12 do
			local r = cone.crater.r + 6 + k * 24
			local x = cone.c[1] + math.cos(bearing + math.sin(k * 0.7) * 0.06) * r
			local z = cone.c[2] + math.sin(bearing + math.sin(k * 0.7) * 0.06) * r
			local p = Vector3.new(x, Field.height(x, z) + 0.4, z)
			if prev then
				Parts.span(coneModel, prev, p, 10 - k * 0.4, 1.2, Palette.lava, M.Neon, { decor = true, name = "LavaStream" })
			end
			prev = p
		end
	end

	-- ember gate at the entrance
	local gate = Layout.nodes.vE
	local dir = Common.pathDirAt(gate)
	local gm = Parts.model(landmarks, "EmberGate", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic })
	local gcf = Util.facing(Vector3.new(gate.X, Field.height(gate.X, gate.Z) - 0.5, gate.Z), dir)
	for _, sd in { -1, 1 } do
		Parts.block(gm, gcf * CFrame.new(sd * 22, 16, 0), Vector3.new(7, 32, 7), Palette.basaltLight, M.Basalt, { name = "GatePillar" })
		Props.brazier(gm, (gcf * CFrame.new(sd * 22, 32, 0)).Position, sd == 1)
		Parts.block(gm, gcf * CFrame.new(sd * 22, 22, -3.7), Vector3.new(5, 12, 0.3), Palette.volcanoBanner, M.Fabric, { decor = true, name = "Banner" })
	end
	Parts.block(gm, gcf * CFrame.new(0, 30, 0), Vector3.new(52, 4, 8), Palette.basalt, M.Basalt, { name = "GateBeam" })
	Parts.block(gm, gcf * CFrame.new(0, 28, -4.2), Vector3.new(40, 0.8, 0.4), Palette.lava, M.Neon, { decor = true, name = "GlowLine" })

	-- crater arena: ring of basalt pillars with braziers
	local arena = Layout.clearings[12]
	for i = 0, 9 do
		local a = i / 10 * math.pi * 2
		local p = arena.c + Vector3.new(math.cos(a) * (arena.r + 10), 0, math.sin(a) * (arena.r + 10))
		if Field.isFree(p.X, p.Z, 3) then
			local g = Field.height(p.X, p.Z)
			spire(props, Vector3.new(p.X, g, p.Z), rng:NextNumber(18, 34), rng)
			if i % 2 == 0 then
				Props.brazier(props, Vector3.new(p.X, g - 0.4, p.Z) + (arena.c - p).Unit * 9, i % 4 == 0)
			end
		end
	end

	-- spires, purple crystals, charred trees, rocks
	local box = { 420, -1260, 1700, -60 }
	Common.scatter({ box = box, count = 130, minDist = 26, pad = 9, slopeMax = 0.9, biome = VOLC, hMax = 420,
		place = function(p, r)
			spire(props, p, r:NextNumber(16, 58), r)
		end }, rng)
	Common.scatter({ box = box, count = 38, minDist = 40, pad = 7, slopeMax = 0.6, biome = VOLC, hMax = 330,
		place = function(p, r)
			Props.crystal(props, p, r:NextNumber(8, 18), r, Palette.purpleCrystal, r:NextNumber() < 0.3)
		end }, rng)
	Common.scatter({ box = box, count = 26, minDist = 50, pad = 8, slopeMax = 0.5, biome = VOLC, hMax = 330,
		place = function(p, r)
			deadTree(props, p, r:NextNumber(18, 32), r)
		end }, rng)
	Common.scatter({ box = box, count = 40, minDist = 26, pad = 5, slopeMax = 0.6, biome = VOLC, hMax = 330,
		place = function(p, r)
			Props.rock(props, p, r:NextNumber(3, 8), r, Palette.basaltLight, M.Basalt)
		end }, rng)

	Common.clearingCreatures(region, "VolcanoClearing1", { "LavaPup", "LavaPup", "MagmaGolem" }, rng, 10)
	Common.clearingCreatures(region, "VolcanoClearing2", { "MagmaGolem", "LavaPup", "LavaPup" }, rng, 11)
	Common.clearingCreatures(region, "VolcanoCraterArena", { "MagmaGolem", "LavaPup" }, rng, 18)
end

return Volcano
