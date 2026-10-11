-- Hatch pavilions (one per biome) and the sky temple.
-- Each pavilion: stepped platform, columns, a styled roof, a large glowing egg and
-- smaller egg pedestals. Local frame: entrance faces the pavilion's LookVector.

local Util = require(script.Parent.Parent.Util)
local Parts = require(script.Parent.Parent.Parts)
local Palette = require(script.Parent.Parent.Palette)
local Props = require(script.Parent.Props)
local Veg = require(script.Parent.Vegetation)
local Structures = require(script.Parent.Structures)

local M = Enum.Material
local rad = math.rad
local P = {}

local function d()
	return { decor = true }
end

-- Round platform with `tiers` 1-stud steps. Returns the floor height.
local function roundPlatform(m: Model, F: CFrame, radius: number, tiers: number, colors: { Color3 }, material: Enum.Material, trim: Color3?): number
	for i = 1, tiers do
		local r = radius + (tiers - i) * 3
		Parts.cyl(m, (F * CFrame.new(0, i - 1.5, 0)).Position, 2, r * 2, colors[(i - 1) % #colors + 1], material, { name = "Platform" })
		if trim then
			Parts.cyl(m, (F * CFrame.new(0, i - 0.45, 0)).Position, 0.15, r * 2 + 0.3, trim, M.SmoothPlastic, { decor = true, shadow = false })
		end
	end
	return F.Position.Y + tiers - 0.5
end

local function squarePlatform(m: Model, F: CFrame, half: number, tiers: number, colors: { Color3 }, material: Enum.Material): number
	for i = 1, tiers do
		local s = (half + (tiers - i) * 3) * 2
		Parts.block(m, F * CFrame.new(0, i - 1.5, 0), Vector3.new(s, 2, s), colors[(i - 1) % #colors + 1], material, { name = "Platform" })
	end
	return F.Position.Y + tiers - 0.5
end

-- Broad stepped apron in front of the entrance, 1-stud rises down to the ground.
local function apron(m: Model, F: CFrame, radius: number, width: number, floorY: number, color: Color3, material: Enum.Material)
	local steps = math.max(1, math.floor(floorY - F.Position.Y + 0.5))
	for i = 1, steps do
		local top = floorY - (i - 1)
		local z = -(radius + 2 + (i - 1) * 3)
		local cf = F * CFrame.new(0, 0, z)
		Parts.block(m, CFrame.new(cf.Position.X, top - 1, cf.Position.Z) * F.Rotation, Vector3.new(width - i * 2, 2, 6), color, material, { name = "EntranceStep" })
	end
end

-- Stacked tiers approximating a dome; alternate colours for stripes.
local function tieredDome(m: Model, centre: Vector3, radius: number, height: number, colors: { Color3 }, material: Enum.Material, transparency: number?, tiers: number?)
	local n = tiers or 7
	for i = 0, n - 1 do
		local t0 = i / n
		local r = radius * math.cos(t0 * math.pi / 2)
		local h = height / n
		local y = centre.Y + height * (i + 0.5) / n
		Parts.cyl(m, Vector3.new(centre.X, y, centre.Z), h + 0.05, math.max(2, r * 2), colors[i % #colors + 1], material, { decor = true, transparency = transparency, shadow = true, name = "Dome" })
	end
end

local function domeRibs(m: Model, centre: Vector3, radius: number, height: number, count: number, color: Color3)
	for k = 0, count - 1 do
		local a = k / count * math.pi * 2
		local prev = nil
		for i = 0, 6 do
			local t = i / 6 * math.pi / 2
			local p = centre + Vector3.new(math.cos(a) * math.cos(t) * (radius + 0.6), math.sin(t) * (height + 0.4), math.sin(a) * math.cos(t) * (radius + 0.6))
			if prev then
				Parts.span(m, prev, p, 1.2, 1.2, color, M.SmoothPlastic, { decor = true, name = "Rib" })
			end
			prev = p
		end
	end
end

local function ringBeam(m: Model, centre: Vector3, radius: number, thickness: number, height: number, color: Color3, material: Enum.Material, segs: number?)
	local n = segs or 16
	for i = 0, n - 1 do
		local a0, a1 = i / n * math.pi * 2, (i + 1) / n * math.pi * 2
		local p0 = centre + Vector3.new(math.cos(a0) * radius, 0, math.sin(a0) * radius)
		local p1 = centre + Vector3.new(math.cos(a1) * radius, 0, math.sin(a1) * radius)
		Parts.span(m, p0, p1, thickness, height, color, material, { decor = true, shadow = true, name = "RingBeam" }).Size += Vector3.new(0, 0, 1)
	end
end

local function eggRing(m: Model, F: CFrame, floorY: number, radius: number, count: number, eggH: number, colors: { Color3 }, stone: Color3?, trim: Color3?, skipFront: boolean?)
	for i = 0, count - 1 do
		local a = (i + 0.5) / count * math.pi * 2
		if skipFront and math.cos(a) < -0.75 then
			continue
		end
		local local_ = Vector3.new(math.sin(a) * radius, 0, math.cos(a) * radius)
		local p = F * CFrame.new(local_)
		Props.eggPedestal(m, Vector3.new(p.Position.X, floorY, p.Position.Z), eggH, colors[i % #colors + 1], stone, trim, i % 2 == 0)
	end
end

local function centralEgg(m: Model, F: CFrame, floorY: number, eggH: number, color: Color3, stone: Color3, trim: Color3)
	local c = F.Position
	Parts.cyl(m, Vector3.new(c.X, floorY + 1.5, c.Z), 3, eggH * 1.05, stone, M.SmoothPlastic, { name = "EggDais" })
	Parts.cyl(m, Vector3.new(c.X, floorY + 3.2, c.Z), 0.6, eggH * 1.12, trim, M.SmoothPlastic, d())
	Parts.cyl(m, Vector3.new(c.X, floorY + 4.2, c.Z), 1.6, eggH * 0.8, Palette.cyan, M.Neon, { decor = true, name = "EggGlowRing" })
	Props.egg(m, Vector3.new(c.X, floorY + 4.4, c.Z), eggH, color, true)
end

----------------------------------------------------------------------
-- styles
----------------------------------------------------------------------
function P.central(parent: Instance, pos: Vector3, face: Vector3, rng: Random): Model
	local m = Parts.model(parent, "CentralEggPavilion", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic, LevelOfDetail = Enum.ModelLevelOfDetail.StreamingMesh })
	local F = Util.facing(pos, face)
	local R = 50
	local floorY = roundPlatform(m, F, R, 3, { Palette.paleStone, Palette.cream }, M.Slate, Palette.gold)
	-- columns
	local colH = 34
	for i = 0, 7 do
		local a = (i + 0.5) / 8 * math.pi * 2
		local p = F * CFrame.new(math.sin(a) * (R - 6), 0, math.cos(a) * (R - 6))
		Structures.column(m, Vector3.new(p.Position.X, floorY, p.Position.Z), colH, 4.4, Palette.paleStone, Palette.gold)
	end
	local beamY = floorY + colH + 1.5
	ringBeam(m, Vector3.new(pos.X, beamY, pos.Z), R - 6, 5, 3, Palette.paleStone, M.Marble)
	ringBeam(m, Vector3.new(pos.X, beamY + 2, pos.Z), R - 5, 6.4, 1, Palette.gold, M.SmoothPlastic)
	ringBeam(m, Vector3.new(pos.X, beamY - 1.8, pos.Z), R - 5, 2, 0.8, Palette.cyan, M.Neon)
	-- glass dome with gold ribs and finial
	local domeBase = Vector3.new(pos.X, beamY + 2.5, pos.Z)
	tieredDome(m, domeBase, R - 7, 30, { Color3.fromRGB(150, 222, 250), Color3.fromRGB(176, 232, 252) }, M.Glass, 0.38, 8)
	domeRibs(m, domeBase, R - 7, 30, 8, Palette.gold)
	Parts.cyl(m, domeBase + Vector3.new(0, 31, 0), 3, 8, Palette.gold, M.SmoothPlastic, d())
	Props.egg(m, domeBase + Vector3.new(0, 32.5, 0), 7, Palette.eggs[3], false)
	-- eggs
	centralEgg(m, F, floorY, 26, Color3.fromRGB(230, 214, 255), Palette.paleStone, Palette.gold)
	eggRing(m, F, floorY, 24, 6, 8.5, { Palette.eggs[1], Palette.eggs[2], Palette.eggs[3], Palette.eggs[4], Palette.eggs[5], Palette.eggs[7] }, Palette.paleStone, Palette.gold, true)
	apron(m, F, R + 6, 44, floorY, Palette.cream, M.Slate)
	-- flags on either side of the entrance and the back
	for _, a in { -0.55, 0.55, math.pi - 0.55, math.pi + 0.55 } do
		local p = F * CFrame.new(math.sin(a) * (R + 14), 0, -math.cos(a) * (R + 14))
		Props.banner(m, Vector3.new(p.Position.X, pos.Y - 0.5, p.Position.Z), face, Color3.fromRGB(70, 130, 220), Palette.gold, 28, Palette.white)
	end
	return m
end

function P.timber(parent: Instance, pos: Vector3, face: Vector3, rng: Random): Model
	local m = Parts.model(parent, "StarterHatchPavilion", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic, LevelOfDetail = Enum.ModelLevelOfDetail.StreamingMesh })
	local F = Util.facing(pos, face)
	local half = 34
	local floorY = squarePlatform(m, F, half, 2, { Palette.stone, Palette.paleStone }, M.Slate)
	local postH = 24
	local postPos = {}
	for _, x in { -1, 0, 1 } do
		for _, z in { -1, 1 } do
			table.insert(postPos, Vector3.new(x * (half - 4), 0, z * (half - 4)))
		end
	end
	table.insert(postPos, Vector3.new(-(half - 4), 0, 0))
	table.insert(postPos, Vector3.new(half - 4, 0, 0))
	for _, lp in postPos do
		local p = F * CFrame.new(lp)
		Parts.block(m, CFrame.new(p.Position.X, floorY + postH / 2, p.Position.Z) * F.Rotation, Vector3.new(3, postH, 3), Palette.wood, M.Wood, { name = "Post" })
		Parts.block(m, CFrame.new(p.Position.X, floorY + 0.7, p.Position.Z) * F.Rotation, Vector3.new(4.2, 1.4, 4.2), Palette.stoneDark, M.Slate, d())
	end
	-- beams
	local top = floorY + postH
	for _, z in { -1, 1 } do
		Parts.block(m, F * CFrame.new(0, top - pos.Y + 1, z * (half - 4)), Vector3.new(half * 2 - 2, 2.4, 2.4), Palette.woodDark, M.Wood, d())
		Parts.block(m, F * CFrame.new(z * (half - 4), top - pos.Y + 1, 0), Vector3.new(2.4, 2.4, half * 2 - 2), Palette.woodDark, M.Wood, d())
	end
	-- layered teal roof with flared eaves
	local roofY = top - pos.Y + 2.5
	local layers = { { 46, 3.2 }, { 38, 3 }, { 30, 3 }, { 22, 2.8 }, { 14, 2.6 }, { 7, 2.4 } }
	local y = roofY
	for i, l in layers do
		local w = l[1]
		Parts.block(m, F * CFrame.new(0, y + l[2] / 2, 0), Vector3.new(w * 2, l[2], w * 2), i % 2 == 1 and Palette.teal or Palette.tealDark, M.SmoothPlastic, { decor = true, shadow = true, name = "Roof" })
		if i == 1 then
			-- eave trim and corner flares
			Parts.block(m, F * CFrame.new(0, y + 0.3, 0), Vector3.new(w * 2 + 1.2, 0.8, w * 2 + 1.2), Palette.woodDark, M.Wood, d())
			for _, cx in { -1, 1 } do
				for _, cz in { -1, 1 } do
					Parts.wedge(m, F * CFrame.new(cx * w, y + 2.4, cz * w) * CFrame.Angles(0, math.atan2(cx, cz) + math.pi, 0), Vector3.new(3, 2.4, 6), Palette.teal, M.SmoothPlastic, d())
				end
			end
		end
		y += l[2] * 0.82
	end
	Parts.ball(m, (F * CFrame.new(0, y + 1.5, 0)).Position, 3.4, Palette.gold, M.SmoothPlastic, d())
	-- vines & hanging lanterns along the eaves
	for _, side in { -1, 1 } do
		local edge = F * CFrame.new(0, roofY, side * 45)
		Veg.vineCurtain(m, edge.Position, 70, 9, rng, F.RightVector)
		local edge2 = F * CFrame.new(side * 45, roofY, 0)
		Veg.vineCurtain(m, edge2.Position, 60, 7, rng, F.LookVector)
	end
	for _, cx in { -1, 1 } do
		for _, cz in { -1, 1 } do
			Props.hangingLantern(m, (F * CFrame.new(cx * 30, roofY - 4, cz * 30)).Position, Palette.lanternGlow, true)
		end
	end
	centralEgg(m, F, floorY, 22, Color3.fromRGB(190, 250, 230), Palette.paleStone, Palette.gold)
	eggRing(m, F, floorY, 18, 4, 8, { Palette.eggs[1], Palette.eggs[2], Palette.eggs[3], Palette.eggs[5] }, Palette.paleStone, Palette.gold, true)
	apron(m, F, half + 3, 40, floorY, Palette.paleStone, M.Slate)
	-- flower boxes along the platform sides
	for _, side in { -1, 1 } do
		for k = -2, 2 do
			Veg.flowers(m, (F * CFrame.new(side * (half + 6), 0, k * 12)).Position, rng)
		end
	end
	return m
end

function P.mushroom(parent: Instance, pos: Vector3, face: Vector3, rng: Random): Model
	local m = Parts.model(parent, "MushroomHatchPavilion", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic, LevelOfDetail = Enum.ModelLevelOfDetail.StreamingMesh })
	local F = Util.facing(pos, face)
	local R = 40
	local floorY = roundPlatform(m, F, R, 2, { Color3.fromRGB(150, 140, 120), Color3.fromRGB(176, 164, 140) }, M.Cobblestone)
	-- curved timber supports
	for i = 0, 5 do
		local a = (i + 0.5) / 6 * math.pi * 2
		local base = F * CFrame.new(math.sin(a) * (R - 5), 0, math.cos(a) * (R - 5))
		local b0 = Vector3.new(base.Position.X, floorY, base.Position.Z)
		local mid = b0 + Vector3.new(0, 14, 0) + (b0 - pos) * Vector3.new(1, 0, 1) * 0.08
		local tip = b0 + Vector3.new(0, 30, 0) + (b0 - pos) * Vector3.new(1, 0, 1) * 0.02
		Parts.rod(m, b0, mid, 3.4, Palette.wood, M.Wood, { name = "Support" })
		Parts.rod(m, mid, tip, 3, Palette.wood, M.Wood, { name = "Support" })
		Veg.vineCurtain(m, tip, 5, 16, rng, (pos - b0).Unit)
	end
	-- the cap: broad purple dome, pale gills underneath, lilac spots
	local capY = floorY + 32
	Parts.ellipsoid(m, CFrame.new(pos.X, capY + 9, pos.Z), Vector3.new(R * 2.6, 34, R * 2.6), Palette.mushroomPurple, M.SmoothPlastic, { decor = true, shadow = true, name = "Cap" })
	Parts.cyl(m, Vector3.new(pos.X, capY + 1.5, pos.Z), 2, R * 2.3, Palette.mushroomLilac, M.SmoothPlastic, { decor = true, name = "Gills" })
	for i = 1, 12 do
		local a = i / 12 * math.pi * 2 + rng:NextNumber(-0.2, 0.2)
		local r = R * rng:NextNumber(0.35, 1.05)
		local yy = capY + 9 + 17 * math.sqrt(math.max(0, 1 - (r / (R * 1.3)) ^ 2)) - 0.8
		Parts.ellipsoid(m, CFrame.new(pos.X + math.cos(a) * r, yy, pos.Z + math.sin(a) * r), Vector3.new(9, 2.2, 9), Palette.mushroomLilac, M.SmoothPlastic, { decor = true, name = "Spot" })
	end
	for i = 0, 9 do
		local a = i / 10 * math.pi * 2
		Props.hangingLantern(m, Vector3.new(pos.X + math.cos(a) * R * 1.05, capY - 3, pos.Z + math.sin(a) * R * 1.05), Palette.lanternGlow, i % 3 == 0)
		Veg.vineCurtain(m, Vector3.new(pos.X + math.cos(a + 0.3) * R * 1.2, capY + 2, pos.Z + math.sin(a + 0.3) * R * 1.2), 6, 12, rng, Vector3.new(math.cos(a), 0, math.sin(a)))
	end
	centralEgg(m, F, floorY, 20, Color3.fromRGB(150, 250, 200), Color3.fromRGB(150, 140, 120), Palette.goldDark)
	eggRing(m, F, floorY, 20, 5, 8, { Color3.fromRGB(200, 120, 255), Palette.eggs[3], Palette.eggs[2], Palette.eggs[1], Palette.mushroomCyan }, Color3.fromRGB(150, 140, 120), Palette.goldDark, true)
	apron(m, F, R + 3, 36, floorY, Color3.fromRGB(160, 150, 128), M.Cobblestone)
	-- glowing mushrooms around the platform
	for i = 1, 6 do
		local a = rng:NextNumber(0, 6.28)
		if math.cos(a) < -0.5 then
			continue
		end
		local p = F * CFrame.new(math.sin(a) * (R + 12), 0, math.cos(a) * (R + 12))
		Veg.mushroom(m, Vector3.new(p.Position.X, pos.Y - 0.5, p.Position.Z), rng:NextNumber(6, 12), rng, i % 2 == 0 and Palette.mushroomPurple or Palette.mushroomCyan, true)
	end
	return m
end

function P.candy(parent: Instance, pos: Vector3, face: Vector3, rng: Random): Model
	local m = Parts.model(parent, "CandyHatchPavilion", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic, LevelOfDetail = Enum.ModelLevelOfDetail.StreamingMesh })
	local F = Util.facing(pos, face)
	local R = 42
	local floorY = roundPlatform(m, F, R, 3, { Palette.candyPink, Palette.candyCream, Palette.candyFrost }, M.SmoothPlastic, Palette.gold)
	local colH = 30
	for i = 0, 7 do
		local a = (i + 0.5) / 8 * math.pi * 2
		local p = F * CFrame.new(math.sin(a) * (R - 6), 0, math.cos(a) * (R - 6))
		local base = Vector3.new(p.Position.X, floorY, p.Position.Z)
		for k = 0, 9 do
			Parts.cyl(m, base + Vector3.new(0, (k + 0.5) * colH / 10, 0), colH / 10, 4.2, k % 2 == 0 and Palette.candyHot or Palette.candyCream, M.SmoothPlastic, { name = "StripedColumn" })
		end
		Parts.ball(m, base + Vector3.new(0, colH + 1, 0), 5.6, Palette.gold, M.SmoothPlastic, d())
	end
	local beamY = floorY + colH + 2
	ringBeam(m, Vector3.new(pos.X, beamY, pos.Z), R - 6, 5.4, 3, Palette.candyCream, M.SmoothPlastic)
	-- striped circus canopy roof with frosting drips
	tieredDome(m, Vector3.new(pos.X, beamY + 1.5, pos.Z), R - 2, 24, { Palette.candyPink, Palette.candyCream }, M.SmoothPlastic, nil, 8)
	for i = 0, 15 do
		local a = i / 16 * math.pi * 2
		local p = Vector3.new(pos.X + math.cos(a) * (R - 1.5), beamY + 1, pos.Z + math.sin(a) * (R - 1.5))
		Parts.ellipsoid(m, CFrame.new(p - Vector3.new(0, rng:NextNumber(1, 4), 0)), Vector3.new(6, rng:NextNumber(5, 10), 6), Palette.candyFrost, M.SmoothPlastic, { decor = true, name = "Drip" })
	end
	Parts.cyl(m, Vector3.new(pos.X, beamY + 27, pos.Z), 3, 7, Palette.gold, M.SmoothPlastic, d())
	Props.gumdrop(m, Vector3.new(pos.X, beamY + 28, pos.Z), 7, Palette.candyHot)
	-- interior lights
	for i = 0, 3 do
		local a = i / 4 * math.pi * 2 + 0.4
		Props.hangingLantern(m, Vector3.new(pos.X + math.cos(a) * 22, beamY - 5, pos.Z + math.sin(a) * 22), Color3.fromRGB(255, 220, 170), i % 2 == 0)
	end
	centralEgg(m, F, floorY, 24, Color3.fromRGB(255, 200, 240), Palette.candyCream, Palette.gold)
	eggRing(m, F, floorY, 21, 5, 8.5, { Palette.eggs[5], Palette.candyTurq, Palette.eggs[2], Palette.mushroomLilac, Palette.candyMint }, Palette.candyCream, Palette.gold, true)
	-- generous entrance terrace
	local terrace = F * CFrame.new(0, -0.5, -(R + 16))
	Parts.block(m, CFrame.new(terrace.Position.X, floorY - 1, terrace.Position.Z) * F.Rotation, Vector3.new(52, 2, 30), Palette.candyCream, M.SmoothPlastic, { name = "Terrace" })
	apron(m, F * CFrame.new(0, 0, -30), R + 3, 46, floorY, Palette.candyFrost, M.SmoothPlastic)
	for _, side in { -1, 1 } do
		Props.candyCane(m, (F * CFrame.new(side * 28, floorY - pos.Y - 0.5, -(R + 26))).Position, 18, rng)
	end
	return m
end

function P.volcano(parent: Instance, pos: Vector3, face: Vector3, rng: Random): Model
	local m = Parts.model(parent, "MoltenHatchPavilion", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic, LevelOfDetail = Enum.ModelLevelOfDetail.StreamingMesh })
	local F = Util.facing(pos, face)
	local half = 38
	local floorY = squarePlatform(m, F, half, 3, { Palette.basalt, Palette.basaltLight }, M.Basalt)
	local colH = 30
	local spots = {}
	for _, x in { -1, -0.33, 0.33, 1 } do
		table.insert(spots, Vector3.new(x * (half - 5), 0, -(half - 5)))
		table.insert(spots, Vector3.new(x * (half - 5), 0, half - 5))
	end
	for _, lp in spots do
		local p = F * CFrame.new(lp)
		Parts.block(m, CFrame.new(p.Position.X, floorY + colH / 2, p.Position.Z) * F.Rotation, Vector3.new(5, colH, 5), Palette.basaltLight, M.Basalt, { name = "Column" })
		Parts.block(m, CFrame.new(p.Position.X, floorY + colH - 1, p.Position.Z) * F.Rotation, Vector3.new(7, 2, 7), Palette.volcanoBanner, M.SmoothPlastic, d())
	end
	-- banners hung between the front and back columns
	for _, z in { -1, 1 } do
		for _, x in { -0.66, 0, 0.66 } do
			local p = F * CFrame.new(x * (half - 5), floorY - pos.Y + colH - 9, z * (half - 5))
			Parts.block(m, p, Vector3.new(7, 14, 0.4), Palette.volcanoBanner, M.Fabric, { decor = true, name = "Banner" })
			Parts.block(m, p * CFrame.new(0, -1, -0.3 * z), Vector3.new(3, 3, 0.2), Palette.lavaHot, M.Neon, { decor = true, name = "Emblem" })
		end
	end
	-- stepped dark roof with glowing trim
	local y = floorY + colH
	for i, w in { 46, 40, 32, 24, 16 } do
		Parts.block(m, CFrame.new(pos.X, y + 1.6, pos.Z) * F.Rotation, Vector3.new(w * 2, 3.2, w * 2), i % 2 == 1 and Palette.basalt or Palette.basaltLight, M.Basalt, { decor = true, shadow = true, name = "Roof" })
		if i == 1 then
			Parts.block(m, CFrame.new(pos.X, y + 0.2, pos.Z) * F.Rotation, Vector3.new(w * 2 + 1, 0.6, w * 2 + 1), Palette.lava, M.Neon, { decor = true, name = "GlowTrim" })
		end
		y += 3.2
	end
	Parts.block(m, CFrame.new(pos.X, y + 4, pos.Z) * F.Rotation * CFrame.Angles(0, rad(45), 0), Vector3.new(6, 8, 6), Palette.lava, M.Neon, { decor = true, name = "Finial" })
	centralEgg(m, F, floorY, 22, Palette.eggs[6], Palette.basaltLight, Palette.volcanoBanner)
	eggRing(m, F, floorY, 20, 4, 8, { Palette.lava, Palette.purpleCrystal, Palette.lavaHot, Color3.fromRGB(255, 90, 70) }, Palette.basalt, Palette.volcanoBanner, true)
	apron(m, F, half + 7, 40, floorY, Palette.basaltLight, M.Basalt)
	for _, side in { -1, 1 } do
		Props.brazier(m, (F * CFrame.new(side * 24, -0.5, -(half + 12))).Position, true)
	end
	return m
end

function P.ice(parent: Instance, pos: Vector3, face: Vector3, rng: Random): Model
	local m = Parts.model(parent, "FrostHatchPavilion", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic, LevelOfDetail = Enum.ModelLevelOfDetail.StreamingMesh })
	local F = Util.facing(pos, face)
	local R = 40
	local floorY = roundPlatform(m, F, R, 3, { Palette.paleStone, Color3.fromRGB(220, 232, 244) }, M.Slate, Palette.iceDeep)
	local colH = 28
	for i = 0, 5 do
		local a = (i + 0.5) / 6 * math.pi * 2
		local p = F * CFrame.new(math.sin(a) * (R - 6), 0, math.cos(a) * (R - 6))
		Structures.column(m, Vector3.new(p.Position.X, floorY, p.Position.Z), colH, 4.2, Palette.paleStone, Palette.iceDeep)
	end
	local beamY = floorY + colH + 1.5
	ringBeam(m, Vector3.new(pos.X, beamY, pos.Z), R - 6, 5, 3, Palette.paleStone, M.Marble, 12)
	-- faceted ice roof
	local y = beamY + 1.5
	for i, w in { 40, 33, 25, 17, 9 } do
		Parts.block(m, CFrame.new(pos.X, y + 2.5, pos.Z) * CFrame.Angles(0, rad(45 * i), 0), Vector3.new(w * 2 * 0.72, 5, w * 2 * 0.72), i % 2 == 1 and Palette.ice or Palette.iceDeep, M.Glass, { decor = true, transparency = 0.12, shadow = true, name = "IceRoof" })
		y += 4.6
	end
	Props.crystal(m, Vector3.new(pos.X, y, pos.Z), 12, rng, Palette.iceCrystal, true)
	for i = 0, 2 do
		local a = i / 3 * math.pi * 2 + 0.6
		Props.hangingLantern(m, Vector3.new(pos.X + math.cos(a) * 20, beamY - 5, pos.Z + math.sin(a) * 20), Color3.fromRGB(255, 214, 160), true)
	end
	centralEgg(m, F, floorY, 22, Palette.eggs[7], Palette.paleStone, Palette.iceDeep)
	eggRing(m, F, floorY, 19, 4, 8, { Palette.iceCrystal, Palette.white, Palette.skyBlue, Color3.fromRGB(190, 240, 255) }, Palette.paleStone, Palette.iceDeep, true)
	apron(m, F, R + 6, 36, floorY, Palette.paleStone, M.Slate)
	for _, side in { -1, 1 } do
		Props.crystal(m, (F * CFrame.new(side * (R + 4), -0.5, -(R - 4))).Position, 14, rng, Palette.iceCrystal, false)
	end
	return m
end

function P.golden(parent: Instance, pos: Vector3, face: Vector3, rng: Random): Model
	local m = Parts.model(parent, "GoldenHatchPavilion", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic, LevelOfDetail = Enum.ModelLevelOfDetail.StreamingMesh })
	local F = Util.facing(pos, face)
	local R = 40
	local floorY = roundPlatform(m, F, R, 3, { Palette.white, Palette.cream }, M.Marble, Palette.gold)
	local colH = 30
	for i = 0, 7 do
		local a = (i + 0.5) / 8 * math.pi * 2
		local p = F * CFrame.new(math.sin(a) * (R - 5), 0, math.cos(a) * (R - 5))
		Structures.column(m, Vector3.new(p.Position.X, floorY, p.Position.Z), colH, 4, Palette.white, Palette.gold)
	end
	local beamY = floorY + colH + 1.5
	ringBeam(m, Vector3.new(pos.X, beamY, pos.Z), R - 5, 5, 3, Palette.white, M.Marble)
	ringBeam(m, Vector3.new(pos.X, beamY + 2, pos.Z), R - 4, 6.2, 1, Palette.gold, M.SmoothPlastic)
	local domeBase = Vector3.new(pos.X, beamY + 2.5, pos.Z)
	tieredDome(m, domeBase, R - 6, 26, { Palette.skyRoof, Palette.gold }, M.SmoothPlastic, nil, 8)
	domeRibs(m, domeBase, R - 6, 26, 8, Palette.gold)
	Parts.cyl(m, domeBase + Vector3.new(0, 27, 0), 4, 5, Palette.gold, M.SmoothPlastic, d())
	Parts.ball(m, domeBase + Vector3.new(0, 30.5, 0), 5, Palette.gold, M.Neon, d())
	centralEgg(m, F, floorY, 22, Palette.eggs[8], Palette.white, Palette.gold)
	eggRing(m, F, floorY, 20, 5, 8.5, { Palette.eggs[8], Palette.skyBlue, Palette.white, Palette.eggs[4], Palette.cyan }, Palette.white, Palette.gold, true)
	apron(m, F, R + 6, 40, floorY, Palette.cream, M.Marble)
	for _, side in { -1, 1 } do
		Props.lantern(m, (F * CFrame.new(side * 18, -0.5, -(R + 16))).Position, "sky", true)
	end
	return m
end

----------------------------------------------------------------------
-- sky temple
----------------------------------------------------------------------
function P.temple(parent: Instance, pos: Vector3, face: Vector3, rng: Random): Model
	local m = Parts.model(parent, "SkyTemple", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic, LevelOfDetail = Enum.ModelLevelOfDetail.StreamingMesh })
	local collision = Parts.folder(m, "Collision")
	local F = Util.facing(pos, face)
	local W, D, podiumH = 150, 104, 24
	local white, gold, blue = Palette.white, Palette.gold, Palette.skyRoof
	-- podium (solid, walkable top)
	Parts.block(m, F * CFrame.new(0, podiumH / 2 - 4, 0), Vector3.new(W, podiumH + 8, D), Palette.cream, M.Marble, { name = "Podium" })
	Parts.block(m, F * CFrame.new(0, podiumH - 0.4, 0), Vector3.new(W + 2, 1, D + 2), gold, M.SmoothPlastic, { decor = true, name = "PodiumTrim" })
	local topY = pos.Y + podiumH
	-- broad front stairway (60 wide) with a smooth ramp collider
	local run = podiumH / math.tan(rad(28))
	local sa = (F * CFrame.new(0, 0, -(D / 2 + run))).Position
	local sb = (F * CFrame.new(0, podiumH, -D / 2)).Position
	Structures.stairs(m, sa, sb, 60, { name = "TempleStairs", grounded = true, color = white, color2 = Palette.cream, material = M.Marble, wall = white, trim = gold })
	-- front colonnade
	local colH = 46
	for i = 0, 7 do
		local x = -W / 2 + 12 + i * (W - 24) / 7
		local p = F * CFrame.new(x, podiumH, -D / 2 + 9)
		Structures.column(m, p.Position, colH, 6, white, gold)
	end
	local entY = podiumH + colH
	Parts.block(m, F * CFrame.new(0, entY + 2.5, -D / 2 + 9), Vector3.new(W - 8, 5, 12), white, M.Marble, { decor = true, name = "Entablature" })
	Parts.block(m, F * CFrame.new(0, entY + 5.5, -D / 2 + 9), Vector3.new(W - 6, 1.5, 13), gold, M.SmoothPlastic, { decor = true, name = "Frieze" })
	-- pediment
	for _, side in { -1, 1 } do
		Parts.wedge(m, F * CFrame.new(side * (W - 8) / 4, entY + 13, -D / 2 + 9) * CFrame.Angles(0, side > 0 and rad(90) or rad(-90), 0), Vector3.new(12, 14, (W - 8) / 2), white, M.Marble, { decor = true, name = "Pediment" })
	end
	-- hall body behind the colonnade
	Parts.block(m, F * CFrame.new(0, podiumH + colH / 2, 14), Vector3.new(W - 20, colH, D - 44), Palette.cream, M.Marble, { name = "Hall" })
	-- central gate tower with arched golden gate and wings
	local towerH = 106
	Parts.block(m, F * CFrame.new(0, podiumH + towerH / 2, 6), Vector3.new(54, towerH, 44), white, M.Marble, { name = "GateTower" })
	Parts.block(m, F * CFrame.new(0, podiumH + 26, -16.4), Vector3.new(26, 52, 1), Color3.fromRGB(60, 90, 170), M.SmoothPlastic, { decor = true, name = "GateRecess" })
	Parts.cyl(m, (F * CFrame.new(0, podiumH + 52, -16.6)).Position, 1, 26, gold, M.SmoothPlastic, d()).CFrame = F * CFrame.new(0, podiumH + 52, -16.6) * CFrame.Angles(0, rad(90), 0)
	for k = -2, 2 do
		Parts.block(m, F * CFrame.new(k * 4.6, podiumH + 24, -17), Vector3.new(0.8, 48, 0.6), gold, M.SmoothPlastic, { decor = true, name = "GateBar" })
	end
	local gateGlow = Parts.block(m, F * CFrame.new(0, podiumH + 24, -16.9), Vector3.new(24, 46, 0.2), Color3.fromRGB(255, 226, 150), M.Neon, { decor = true, transparency = 0.55, name = "GateGlow" })
	Parts.light(gateGlow, "SurfaceLight", { Face = Enum.NormalId.Front, Color = Color3.fromRGB(255, 220, 150), Brightness = 1.2, Range = 30, Angle = 80, Shadows = false })
	for _, side in { -1, 1 } do
		for i = 1, 4 do
			local wing = F * CFrame.new(side * (30 + i * 6), podiumH + towerH - 12 - i * 4, -10) * CFrame.Angles(0, 0, rad(side * (20 + i * 8)))
			Parts.block(m, wing, Vector3.new(16 - i * 1.5, 3, 2), gold, M.SmoothPlastic, { decor = true, name = "Wing" })
		end
	end
	tieredDome(m, (F * CFrame.new(0, podiumH + towerH, 6)).Position, 22, 30, { gold, Color3.fromRGB(250, 214, 110) }, M.SmoothPlastic, nil, 7)
	Parts.cyl(m, (F * CFrame.new(0, podiumH + towerH + 38, 6)).Position, 16, 3, gold, M.SmoothPlastic, d())
	Parts.ball(m, (F * CFrame.new(0, podiumH + towerH + 47, 6)).Position, 6, gold, M.Neon, d())
	-- side towers
	for _, side in { -1, 1 } do
		local base = F * CFrame.new(side * (W / 2 - 8), podiumH, 20)
		Parts.cyl(m, base.Position + Vector3.new(0, 40, 0), 80, 22, white, M.Marble, { name = "SideTower" })
		Parts.cyl(m, base.Position + Vector3.new(0, 80.6, 0), 1.2, 24, gold, M.SmoothPlastic, d())
		tieredDome(m, base.Position + Vector3.new(0, 81, 0), 11, 16, { blue, gold }, M.SmoothPlastic, nil, 6)
		Parts.cyl(m, base.Position + Vector3.new(0, 104, 0), 14, 1.6, gold, M.SmoothPlastic, d())
	end
	-- waterfalls pouring from the podium flanks
	for _, side in { -1, 1 } do
		local lip = (F * CFrame.new(side * (W / 2 + 1), podiumH - 2, -10)).Position
		Structures.waterfall(m, lip, F.RightVector * side, 14, pos.Y - 0.5, "water", rng)
	end
	-- golden lanterns along the stairway
	for _, side in { -1, 1 } do
		for k = 0, 2 do
			local p = (F * CFrame.new(side * 36, 0, -(D / 2 + run) + k * run / 2.2)).Position
			Props.lantern(m, Vector3.new(p.X, pos.Y + k * run / 2.2 * math.tan(rad(28)) - 0.5, p.Z), "sky", k == 0)
		end
	end
	-- top collider so the podium walk surface is perfectly flat
	Parts.collider(collision, F * CFrame.new(0, podiumH - 0.75, 0), Vector3.new(W, 1.5, D), "PodiumTop")
	return m
end

return P
