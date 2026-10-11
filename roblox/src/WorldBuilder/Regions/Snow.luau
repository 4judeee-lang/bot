-- Snow and crystal valley: frost hatch station, snowy pines, ice crystals, snowbanks,
-- frozen lake floes, an ice gateway, penguins, foxes and the yeti arena.

local Layout = require(script.Parent.Parent.Layout)
local Field = require(script.Parent.Parent.Field)
local Parts = require(script.Parent.Parent.Parts)
local Palette = require(script.Parent.Parent.Palette)
local Util = require(script.Parent.Parent.Util)
local Pavilions = require(script.Parent.Parent.Assets.Pavilions)
local Props = require(script.Parent.Parent.Assets.Props)
local Veg = require(script.Parent.Parent.Assets.Vegetation)
local Structures = require(script.Parent.Parent.Assets.Structures)
local Common = require(script.Parent.Common)

local M = Enum.Material
local Snow = {}
local SNOW = Layout.BIOME.snow

function Snow.build(ctx)
	local rng = Random.new(Layout.SEED + 606)
	local region = ctx.region("SnowValley")
	local veg = Parts.folder(region, "Vegetation")
	local props = Parts.folder(region, "Props")
	local landmarks = Parts.folder(region, "Landmarks")

	local pav = Layout.pavilions[6]
	Pavilions.ice(landmarks, pav.pos, pav.face, rng)

	-- ice gateway: two crystal pillars and a pale stone lintel over the entrance path
	local gate = Layout.nodes.sE + Vector3.new(40, 0, -10)
	local dir = Common.pathDirAt(gate)
	local gm = Parts.model(landmarks, "IceGate", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic })
	local gcf = Util.facing(Vector3.new(gate.X, Field.height(gate.X, gate.Z) - 0.5, gate.Z), dir)
	for _, sd in { -1, 1 } do
		Parts.block(gm, gcf * CFrame.new(sd * 21, 13, 0), Vector3.new(6, 26, 6), Palette.paleStone, M.Slate, { name = "GatePillar" })
		Props.crystal(gm, (gcf * CFrame.new(sd * 21, 26, 0)).Position, 10, rng, Palette.iceCrystal, sd == 1)
	end
	Parts.block(gm, gcf * CFrame.new(0, 27, 0), Vector3.new(48, 3, 7), Palette.paleStone, M.Slate, { name = "Lintel" })
	Parts.block(gm, gcf * CFrame.new(0, 29, 0), Vector3.new(50, 1.4, 8), Palette.snowWhite, M.Snow, { decor = true })

	-- frozen lake floes (decorative, sit on the water)
	for _ = 1, 12 do
		local a = rng:NextNumber(0, 6.28)
		local r = math.sqrt(rng:NextNumber()) * 0.75
		local x, z = 950 + math.cos(a) * 150 * r, 800 + math.sin(a) * 110 * r
		Parts.block(props, CFrame.new(x, 104.2, z) * CFrame.Angles(0, rng:NextNumber(0, 6.28), 0), Vector3.new(rng:NextNumber(8, 20), 0.6, rng:NextNumber(6, 16)), Color3.fromRGB(226, 242, 255), M.Ice, { decor = true, name = "IceFloe" })
	end

	-- glacier arena: crystal ring
	local arena = Layout.clearings[15]
	for i = 0, 11 do
		local a = i / 12 * math.pi * 2
		local p = arena.c + Vector3.new(math.cos(a) * (arena.r + 10), 0, math.sin(a) * (arena.r + 10))
		if Field.isFree(p.X, p.Z, 3) then
			Props.crystal(props, Vector3.new(p.X, Field.height(p.X, p.Z), p.Z), rng:NextNumber(12, 24), rng, Palette.iceCrystal, i % 3 == 0)
		end
	end

	local box = { 560, 60, 1700, 1180 }
	Common.scatter({ box = box, count = 180, minDist = 24, pad = 8, slopeMax = 0.55, biome = SNOW,
		place = function(p, r)
			Veg.pine(veg, p, r:NextNumber(30, 62), r, true)
		end }, rng)
	Common.scatter({ box = box, count = 55, minDist = 34, pad = 7, slopeMax = 0.6, biome = SNOW,
		place = function(p, r)
			Props.crystal(props, p, r:NextNumber(7, 16), r, r:NextNumber() < 0.7 and Palette.iceCrystal or Palette.ice, r:NextNumber() < 0.25)
		end }, rng)
	Common.scatter({ box = box, count = 45, minDist = 24, pad = 5, slopeMax = 0.5, biome = SNOW,
		place = function(p, r)
			Parts.ellipsoid(props, CFrame.new(p) * CFrame.Angles(0, r:NextNumber(0, 6.28), 0), Vector3.new(r:NextNumber(10, 22), r:NextNumber(3, 6), r:NextNumber(8, 16)), Palette.snowWhite, M.Snow, { decor = true, name = "Snowbank" })
		end }, rng)
	Common.scatter({ box = box, count = 30, minDist = 30, pad = 6, slopeMax = 0.6, biome = SNOW,
		place = function(p, r)
			Props.rock(props, p, r:NextNumber(3, 8), r, Color3.fromRGB(176, 196, 214))
		end }, rng)

	-- light snowfall around the hatch station and the arena
	local fx = Parts.folder(region, "Ambience")
	for _, c in { Vector3.new(900, 210, 330), Vector3.new(1330, 270, 720), Vector3.new(850, 190, 700) } do
		local holder = Parts.block(fx, CFrame.new(c), Vector3.new(220, 2, 220), Palette.snowWhite, M.SmoothPlastic, { decor = true, transparency = 1, name = "SnowfallVolume" })
		Parts.emitter(holder, {
			Texture = Structures.SPARK, Rate = 8, Lifetime = NumberRange.new(8, 12), Speed = NumberRange.new(4, 7),
			SpreadAngle = Vector2.new(15, 15), EmissionDirection = Enum.NormalId.Bottom, LightInfluence = 1,
			Size = NumberSequence.new(0.4), Color = ColorSequence.new(Color3.new(1, 1, 1)),
			Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.2), NumberSequenceKeypoint.new(1, 1) }),
		})
	end

	Common.clearingCreatures(region, "SnowClearing1", { "Penguin", "Penguin", "IceFox" }, rng, 8)
	Common.clearingCreatures(region, "SnowClearing2", { "IceFox", "Penguin" }, rng, 8)
	Common.clearingCreatures(region, "SnowGlacierArena", { "Yeti", "Penguin", "IceFox" }, rng, 15)
end

return Snow
