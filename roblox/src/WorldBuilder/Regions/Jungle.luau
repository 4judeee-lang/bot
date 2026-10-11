-- Jungle: purple mushroom hatch pavilion, giant emerald trees, glowing mushrooms,
-- cyan streams, ruin arches and the guardian arena on the upper terrace.

local Layout = require(script.Parent.Parent.Layout)
local Field = require(script.Parent.Parent.Field)
local Parts = require(script.Parent.Parent.Parts)
local Palette = require(script.Parent.Parent.Palette)
local Pavilions = require(script.Parent.Parent.Assets.Pavilions)
local Props = require(script.Parent.Parent.Assets.Props)
local Veg = require(script.Parent.Parent.Assets.Vegetation)
local Structures = require(script.Parent.Parent.Assets.Structures)
local Creatures = require(script.Parent.Parent.Assets.Creatures)
local Common = require(script.Parent.Common)

local M = Enum.Material
local Jungle = {}
local JUNGLE = Layout.BIOME.jungle

-- Hand-placed landmark trees (90-130 studs) that frame the routes and terraces.
local GIANTS = {
	{ -560, 300, 120 }, { -800, 120, 110 }, { -930, 430, 125 }, { -780, -420, 105 }, { -1010, -520, 118 },
	{ -1290, -260, 112 }, { -1330, 120, 130 }, { -1100, 220, 100 }, { -1560, -560, 122 }, { -1300, -630, 108 },
	{ -1520, 120, 116 }, { -640, 520, 96 },
}

function Jungle.build(ctx)
	local rng = Random.new(Layout.SEED + 303)
	local region = ctx.region("Jungle")
	local veg = Parts.folder(region, "Vegetation")
	local props = Parts.folder(region, "Props")
	local landmarks = Parts.folder(region, "Landmarks")

	local pav = Layout.pavilions[3]
	Pavilions.mushroom(landmarks, pav.pos, pav.face, rng)

	-- entrance gateway: ruin arch straddling the main path
	local gate = Layout.nodes.jE:Lerp(Layout.nodes.jJ1, 0.2)
	Structures.ruinArch(landmarks, Vector3.new(gate.X, Field.height(gate.X, gate.Z) - 0.5, gate.Z), Common.pathDirAt(gate), 54, 30, rng)

	-- guardian arena on the upper terrace: altar, ruin arch, broken columns
	local arena = Layout.clearings[6]
	local back = arena.c + Vector3.new(-30, 0, -100)
	local altar = Parts.model(landmarks, "GuardianAltar", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic })
	for i = 0, 2 do
		Parts.block(altar, CFrame.new(back + Vector3.new(0, i * 1.4 - 0.2, i * -3)), Vector3.new(44 - i * 8, 1.6, 26 - i * 6), Color3.fromRGB(140 - i * 6, 142 - i * 6, 132 - i * 6), M.Slate, { name = "AltarStep" })
	end
	Creatures.Guardian(altar, CFrame.lookAt(back + Vector3.new(0, 3.6, -6), arena.c + Vector3.new(0, 3.6, 0)), 30)
	Structures.ruinArch(landmarks, back + Vector3.new(0, -0.3, 22), Vector3.new(0, 0, 1), 54, 40, rng)
	for i = 0, 7 do
		local a = i / 8 * math.pi * 2 + 0.2
		local p = arena.c + Vector3.new(math.cos(a) * (arena.r + 8), 0, math.sin(a) * (arena.r + 8))
		if Field.isFree(p.X, p.Z, 2) then
			local g = Field.height(p.X, p.Z)
			local h = rng:NextNumber(10, 26)
			Structures.column(props, Vector3.new(p.X, g - 0.5, p.Z), h, 5, Color3.fromRGB(150, 150, 140), Color3.fromRGB(120, 124, 116), M.Slate)
			Props.torch(props, Vector3.new(p.X, g - 0.5, p.Z) + (arena.c - p).Unit * 6, i % 2 == 0)
		end
	end
	-- a second ruin gateway on the mid terrace, plus scattered ruin blocks
	local mid = Layout.nodes.jM:Lerp(Layout.nodes.jBr, 0.3)
	Structures.ruinArch(landmarks, Vector3.new(mid.X, Field.height(mid.X, mid.Z) - 0.5, mid.Z), Common.pathDirAt(mid), 48, 28, rng)

	-- giant trees
	for _, g in GIANTS do
		local x, z = g[1], g[2]
		if Field.isFree(x, z, 14) then
			Veg.jungleGiant(veg, Vector3.new(x, Field.height(x, z) - 0.5, z), g[3], rng)
		end
	end

	-- canopy trees, palms, ferns, bushes
	local box = { -1720, -820, -470, 700 }
	Common.scatter({ box = box, count = 300, minDist = 26, pad = 10, slopeMax = 0.55, biome = JUNGLE,
		place = function(p, r)
			Veg.broadleaf(veg, p, r:NextNumber(42, 82), r, Palette.jungleLeaf)
		end }, rng)
	Common.scatter({ box = box, count = 55, minDist = 32, pad = 10, slopeMax = 0.45, biome = JUNGLE,
		place = function(p, r)
			Veg.palm(veg, p, r:NextNumber(34, 52), r)
		end }, rng)
	Common.scatter({ box = box, count = 220, minDist = 10, pad = 3, slopeMax = 0.6, biome = JUNGLE,
		place = function(p, r)
			Veg.fern(veg, p, r:NextNumber(4, 9), r)
		end }, rng)
	Common.scatter({ box = box, count = 140, minDist = 16, pad = 5, slopeMax = 0.6, biome = JUNGLE,
		place = function(p, r)
			Veg.bush(veg, p, r:NextNumber(7, 13), r, Palette.jungleLeaf)
		end }, rng)
	-- big mushrooms along route edges, restrained glow on about a third
	Common.scatter({ box = box, count = 30, minDist = 46, pad = 5, slopeMax = 0.45, biome = JUNGLE,
		place = function(p, r, i)
			Veg.mushroom(veg, p, r:NextNumber(14, 30), r, i % 2 == 0 and Palette.mushroomPurple or Palette.mushroomCyan, i % 3 == 0)
		end }, rng)
	Common.scatter({ box = box, count = 90, minDist = 14, pad = 3, slopeMax = 0.6, biome = JUNGLE,
		place = function(p, r, i)
			Veg.mushroom(veg, p, r:NextNumber(3, 8), r, i % 2 == 0 and Palette.mushroomPurple or Palette.mushroomCyan, i % 2 == 0)
		end }, rng)
	Common.scatter({ box = box, count = 30, minDist = 40, pad = 8, slopeMax = 0.6, biome = JUNGLE,
		place = function(p, r)
			Props.rock(props, p, r:NextNumber(4, 10), r, Color3.fromRGB(116, 124, 108))
		end }, rng)

	-- restrained fireflies over the lower and mid jungle
	local fx = Parts.folder(region, "Ambience")
	for _, c in { { -650, 0 }, { -900, 300 }, { -1150, -100 }, { -1420, -420 }, { -760, -260 }, { -600, 480 } } do
		local y = Field.height(c[1], c[2]) + 10
		local holder = Parts.block(fx, CFrame.new(c[1], y, c[2]), Vector3.new(160, 14, 160), Palette.lanternGlow, M.SmoothPlastic, { decor = true, transparency = 1, name = "FireflyVolume" })
		Parts.emitter(holder, {
			Texture = Structures.SPARK, Rate = 4, Lifetime = NumberRange.new(4, 7), Speed = NumberRange.new(0.3, 1.2),
			SpreadAngle = Vector2.new(180, 180), LightEmission = 1, LightInfluence = 0,
			Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(0.3, 0.45), NumberSequenceKeypoint.new(1, 0) }),
			Color = ColorSequence.new(Color3.fromRGB(220, 255, 140)), Drag = 1,
		})
	end

	Common.clearingCreatures(region, "JungleClearing1", { "Monkey", "Frog", "Monkey", "Leafling" }, rng, 10)
	Common.clearingCreatures(region, "JungleClearing2", { "Frog", "Leafling", "Monkey", "Frog" }, rng, 11)
	Common.clearingCreatures(region, "JungleRuinArena", { "Monkey", "Frog" }, rng, 14)
end

return Jungle
