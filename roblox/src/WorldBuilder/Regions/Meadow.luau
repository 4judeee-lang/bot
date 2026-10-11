-- Starter meadow: teal timber hatch pavilion, pond with dock and lily pads, cave,
-- grassy creature fields, flowers, trees and the palm beach in the foreground.

local Layout = require(script.Parent.Parent.Layout)
local Field = require(script.Parent.Parent.Field)
local Parts = require(script.Parent.Parent.Parts)
local Palette = require(script.Parent.Parent.Palette)
local Pavilions = require(script.Parent.Parent.Assets.Pavilions)
local Props = require(script.Parent.Parent.Assets.Props)
local Veg = require(script.Parent.Parent.Assets.Vegetation)
local Common = require(script.Parent.Common)

local Meadow = {}
local B = Layout.BIOME

function Meadow.build(ctx)
	local rng = Random.new(Layout.SEED + 202)
	local region = ctx.region("StarterMeadow")
	local veg = Parts.folder(region, "Vegetation")
	local props = Parts.folder(region, "Props")

	local pav = Layout.pavilions[2]
	Pavilions.timber(Parts.folder(region, "Landmarks"), pav.pos, pav.face, rng)

	-- pond: dock, lily pads, shoreline stones and reeds
	Props.dock(props, Vector3.new(165, 121.4, 607), Vector3.new(165, 121.4, 644), 10)
	local pond = { c = { 175, 680 }, r = { 90, 70 } }
	for _ = 1, 16 do
		local a = rng:NextNumber(0, 6.28)
		local rr = math.sqrt(rng:NextNumber()) * 0.8
		local x, z = pond.c[1] + math.cos(a) * pond.r[1] * rr, pond.c[2] + math.sin(a) * pond.r[2] * rr
		if math.abs(x - 165) > 8 or z > 650 then
			Veg.lilyPad(props, Vector3.new(x, 120.1, z), rng)
		end
	end
	for i = 0, 27 do
		local a = i / 28 * math.pi * 2 + rng:NextNumber(-0.05, 0.05)
		local x, z = pond.c[1] + math.cos(a) * (pond.r[1] + 5), pond.c[2] + math.sin(a) * (pond.r[2] + 5)
		if math.abs(x - 165) > 10 and not Common.onPath(x, z, 2) then
			local g = Field.height(x, z)
			if i % 3 == 0 then
				Props.rock(props, Vector3.new(x, g - 0.5, z), rng:NextNumber(2.5, 5), rng, Palette.stone)
			else
				Veg.grassTuft(veg, Vector3.new(x, g, z), rng, Palette.leaf[4])
			end
		end
	end

	-- vines over the cave mouth
	Veg.vineCurtain(props, Vector3.new(-152, 150, 650), 26, 10, rng, Vector3.new(1, 0, 0))

	-- trees, bushes, flowers across the green valley
	local meadowBiomes = { B.meadow, B.hub }
	Common.scatter({
		box = { -520, 180, 520, 1060 }, count = 120, minDist = 30, pad = 12, slopeMax = 0.5, biome = meadowBiomes,
		place = function(p, r)
			Veg.broadleaf(veg, p, r:NextNumber(38, 72), r)
		end,
	}, rng)
	Common.scatter({
		box = { -520, 180, 520, 1060 }, count = 110, minDist = 15, pad = 6, slopeMax = 0.55, biome = meadowBiomes,
		place = function(p, r)
			Veg.bush(veg, p, r:NextNumber(6, 11), r)
		end,
	}, rng)
	Common.scatter({
		box = { -470, 200, 470, 1060 }, count = 160, minDist = 9, pad = 3, slopeMax = 0.5, biome = meadowBiomes,
		place = function(p, r, i)
			if i % 3 == 0 then
				Veg.grassTuft(veg, p, r)
			else
				Veg.flowers(veg, p, r)
			end
		end,
	}, rng)
	Common.scatter({
		box = { -470, 200, 470, 1060 }, count = 26, minDist = 30, pad = 8, slopeMax = 0.6, biome = meadowBiomes,
		place = function(p, r)
			Props.rock(props, p, r:NextNumber(4, 9), r, Palette.stone)
		end,
	}, rng)
	-- beach palms
	Common.scatter({
		box = { -800, 1030, 800, 1290 }, count = 30, minDist = 30, pad = 8, slopeMax = 0.4, biome = { B.beach, B.meadow },
		place = function(p, r)
			Veg.palm(veg, p, r:NextNumber(30, 46), r)
		end,
	}, rng)

	-- residents of the starter fields
	Common.clearingCreatures(region, "MeadowClearing1", { "Bunny", "Leafling", "Bunny", "Frog" }, rng, 8)
	Common.clearingCreatures(region, "MeadowClearing2", { "Monkey", "Frog", "Leafling" }, rng, 9)
	Common.clearingCreatures(region, "MeadowClearing3", { "Capyccino", "Bananarang", "Bunny" }, rng, 9)
end

return Meadow
