-- Candy cliffs: striped hatch pavilion, lollipop trees, donut arches, candy canes,
-- gumdrops, pastel crystals and gummy/cupcake residents.

local Layout = require(script.Parent.Parent.Layout)
local Field = require(script.Parent.Parent.Field)
local Parts = require(script.Parent.Parent.Parts)
local Palette = require(script.Parent.Parent.Palette)
local Pavilions = require(script.Parent.Parent.Assets.Pavilions)
local Props = require(script.Parent.Parent.Assets.Props)
local Veg = require(script.Parent.Parent.Assets.Vegetation)
local Common = require(script.Parent.Common)

local M = Enum.Material
local Candy = {}
local CANDY = Layout.BIOME.candy

local PASTEL = { Palette.candyPink, Palette.candyTurq, Palette.mushroomLilac, Palette.candyMint, Palette.candyPeach }

function Candy.build(ctx)
	local rng = Random.new(Layout.SEED + 404)
	local region = ctx.region("CandyCliffs")
	local veg = Parts.folder(region, "Vegetation")
	local props = Parts.folder(region, "Props")
	local landmarks = Parts.folder(region, "Landmarks")

	local pav = Layout.pavilions[4]
	Pavilions.candy(landmarks, pav.pos, pav.face, rng)

	-- a pair of giant donuts flanking the entrance path
	local gate = Layout.nodes.cE:Lerp(Layout.nodes.nJ1, 0.18)
	local gdir = Common.pathDirAt(gate)
	local gright = Vector3.new(-gdir.Z, 0, gdir.X)
	for _, sd in { -1, 1 } do
		for _, dist in { 46, 62, 80 } do
			local p = gate + gright * sd * dist
			if not Common.onPath(p.X, p.Z, 34) then
				Props.donutArch(landmarks, Vector3.new(p.X, Field.height(p.X, p.Z), p.Z), gdir, 24, rng)
				break
			end
		end
	end

	-- donut arena on the high back cliffs, giant lollipop landmark on the summit
	local arena = Layout.clearings[9]
	for _, off in { Vector3.new(-arena.r - 14, 0, -20), Vector3.new(arena.r + 14, 0, -26) } do
		local p = arena.c + off
		Props.donutArch(landmarks, Vector3.new(p.X, Field.height(p.X, p.Z), p.Z), (arena.c - p).Unit:Cross(Vector3.yAxis), 24, rng)
	end
	local summit = Vector3.new(-720, Field.height(-720, -1470), -1470)
	local big = Veg.lollipop(landmarks, summit, 88, rng)
	big.Name = "GiantLollipop"
	big:SetAttribute("Landmark", true)

	-- lollipop groves, candy canes, gumdrops, pastel crystals and bushes
	local box = { -940, -1480, 20, -520 }
	Common.scatter({ box = box, count = 90, minDist = 26, pad = 9, slopeMax = 0.5, biome = CANDY,
		place = function(p, r)
			Veg.lollipop(veg, p, r:NextNumber(22, 46), r)
		end }, rng)
	Common.scatter({ box = box, count = 22, minDist = 40, pad = 8, slopeMax = 0.45, biome = CANDY,
		place = function(p, r)
			Props.candyCane(props, p, r:NextNumber(14, 26), r)
		end }, rng)
	Common.scatter({ box = box, count = 80, minDist = 12, pad = 4, slopeMax = 0.55, biome = CANDY,
		place = function(p, r)
			Props.gumdrop(props, p, r:NextNumber(2.4, 7), PASTEL[r:NextInteger(1, #PASTEL)])
		end }, rng)
	Common.scatter({ box = box, count = 30, minDist = 36, pad = 8, slopeMax = 0.6, biome = CANDY,
		place = function(p, r)
			Props.crystal(props, p, r:NextNumber(8, 16), r, PASTEL[r:NextInteger(1, 3)], r:NextNumber() < 0.25)
		end }, rng)
	Common.scatter({ box = box, count = 80, minDist = 15, pad = 5, slopeMax = 0.55, biome = CANDY,
		place = function(p, r)
			Veg.bush(veg, p, r:NextNumber(6, 10), r, { Palette.candyMint, Color3.fromRGB(130, 220, 170), Palette.candyFrost })
		end }, rng)
	Common.scatter({ box = box, count = 6, minDist = 120, pad = 34, slopeMax = 0.35, biome = CANDY,
		place = function(p, r)
			Props.donutArch(landmarks, p, Vector3.new(r:NextNumber(-1, 1), 0, r:NextNumber(-1, 1)), r:NextNumber(14, 20), r)
		end }, rng)

	Common.clearingCreatures(region, "CandyClearing1", { "GummyBear", "Cupcake", "GummyBear" }, rng, 9)
	Common.clearingCreatures(region, "CandyClearing2", { "Cupcake", "GummyBear", "Cupcake", "Bunny" }, rng, 9)
	Common.clearingCreatures(region, "CandyDonutArena", { "GummyBear", "GummyBear", "Cupcake" }, rng, 13)
	-- colour variety for the gummies
	local colors = { Color3.fromRGB(255, 90, 110), Color3.fromRGB(255, 170, 60), Color3.fromRGB(110, 210, 120), Color3.fromRGB(120, 160, 255) }
	local i = 0
	for _, d in region:GetDescendants() do
		if d:IsA("Model") and d.Name == "GummyBear" then
			i += 1
			local c = colors[(i - 1) % #colors + 1]
			for _, p in d:GetDescendants() do
				if p:IsA("BasePart") and p.Material == M.Glass then
					p.Color = c
				end
			end
		end
	end
end

return Candy
