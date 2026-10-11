-- Reusable props: lanterns, eggs, crystals, rocks, fences, banners, candy pieces, clouds.

local Util = require(script.Parent.Parent.Util)
local Parts = require(script.Parent.Parent.Parts)
local Palette = require(script.Parent.Parent.Palette)

local M = Enum.Material
local rad = math.rad
local Props = {}

local function d()
	return { decor = true }
end

----------------------------------------------------------------------
-- lighting props
----------------------------------------------------------------------
local LANTERN = {
	meadow = { post = Palette.wood, cap = Palette.woodDark, glow = Palette.lanternGlow, mat = M.Wood },
	hub = { post = Palette.paleStone, cap = Palette.gold, glow = Palette.lanternGlow, mat = M.SmoothPlastic },
	jungle = { post = Palette.woodDark, cap = Palette.woodDark, glow = Color3.fromRGB(255, 186, 96), mat = M.Wood },
	candy = { post = Palette.candyCream, cap = Palette.candyHot, glow = Color3.fromRGB(255, 214, 160), mat = M.SmoothPlastic, striped = true },
	volcano = { post = Palette.basaltLight, cap = Palette.basalt, glow = Color3.fromRGB(255, 140, 60), mat = M.Slate },
	snow = { post = Palette.paleStone, cap = Palette.iceDeep, glow = Color3.fromRGB(255, 220, 170), mat = M.SmoothPlastic },
	sky = { post = Palette.white, cap = Palette.gold, glow = Color3.fromRGB(255, 220, 140), mat = M.Marble },
}
Props.LANTERN = LANTERN

-- Post lantern; `withLight` lets callers thin out real light sources.
function Props.lantern(parent: Instance, pos: Vector3, style: string, withLight: boolean?): Model
	local s = LANTERN[style] or LANTERN.meadow
	local m = Parts.model(parent, "Lantern")
	local h = 11
	if s.striped then
		for i = 0, 4 do
			Parts.block(m, CFrame.new(pos + Vector3.new(0, i * 2.2 + 1.1, 0)), Vector3.new(1.3, 2.2, 1.3), i % 2 == 0 and Palette.candyHot or Palette.candyCream, M.SmoothPlastic, { name = "Post" })
		end
	else
		Parts.block(m, CFrame.new(pos + Vector3.new(0, h / 2, 0)), Vector3.new(1.3, h, 1.3), s.post, s.mat, { name = "Post" })
	end
	Parts.block(m, CFrame.new(pos + Vector3.new(0, 0.5, 0)), Vector3.new(2.4, 1, 2.4), s.cap, s.mat, { name = "Base" })
	local lampPos = pos + Vector3.new(0, h + 1.6, 0)
	Parts.block(m, CFrame.new(lampPos - Vector3.new(0, 1.8, 0)), Vector3.new(2.6, 0.5, 2.6), s.cap, s.mat, d())
	local glow = Parts.block(m, CFrame.new(lampPos), Vector3.new(1.8, 2.6, 1.8), s.glow, M.Neon, { decor = true, name = "Glow" })
	Parts.block(m, CFrame.new(lampPos + Vector3.new(0, 1.7, 0)) * CFrame.Angles(0, rad(45), 0), Vector3.new(2.8, 0.8, 2.8), s.cap, s.mat, d())
	if withLight ~= false then
		Parts.light(glow, "PointLight", { Color = s.glow, Brightness = 1.3, Range = 22, Shadows = false })
	end
	return m
end

function Props.hangingLantern(parent: Instance, pos: Vector3, glowColor: Color3?, withLight: boolean?)
	Parts.block(parent, CFrame.new(pos + Vector3.new(0, 2.5, 0)), Vector3.new(0.25, 3, 0.25), Palette.woodDark, M.SmoothPlastic, d())
	local g = Parts.block(parent, CFrame.new(pos), Vector3.new(1.6, 2, 1.6), glowColor or Palette.lanternGlow, M.Neon, { decor = true, name = "LanternGlow" })
	Parts.block(parent, CFrame.new(pos + Vector3.new(0, 1.2, 0)), Vector3.new(2, 0.4, 2), Palette.woodDark, M.SmoothPlastic, d())
	if withLight then
		Parts.light(g, "PointLight", { Color = glowColor or Palette.lanternGlow, Brightness = 1.1, Range = 18, Shadows = false })
	end
end

function Props.brazier(parent: Instance, pos: Vector3, withLight: boolean?): Model
	local m = Parts.model(parent, "Brazier")
	Parts.cyl(m, pos + Vector3.new(0, 2, 0), 4, 3, Palette.basaltLight, M.Slate, { name = "Stand" })
	Parts.cyl(m, pos + Vector3.new(0, 4.6, 0), 1.6, 6, Palette.basalt, M.Slate, { name = "Bowl" })
	local fire = Parts.ellipsoid(m, CFrame.new(pos + Vector3.new(0, 6.2, 0)), Vector3.new(4, 3.4, 4), Palette.lavaHot, M.Neon, { decor = true, name = "Flame" })
	if withLight ~= false then
		Parts.light(fire, "PointLight", { Color = Palette.ember, Brightness = 1.6, Range = 24, Shadows = false })
	end
	Parts.emitter(fire, {
		Texture = "rbxasset://textures/particles/fire_main.dds", Rate = 6, Lifetime = NumberRange.new(0.6, 1.1),
		Speed = NumberRange.new(3, 6), SpreadAngle = Vector2.new(12, 12), LightEmission = 0.8,
		Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 2.2), NumberSequenceKeypoint.new(1, 0.2) }),
		Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.3), NumberSequenceKeypoint.new(1, 1) }),
		Color = ColorSequence.new(Palette.lavaHot, Palette.lava),
	})
	return m
end

function Props.torch(parent: Instance, pos: Vector3, withLight: boolean?): Model
	local m = Parts.model(parent, "Torch")
	Parts.block(m, CFrame.new(pos + Vector3.new(0, 4.5, 0)), Vector3.new(1.2, 9, 1.2), Palette.woodDark, M.Wood, { name = "Post" })
	Parts.block(m, CFrame.new(pos + Vector3.new(0, 9.4, 0)), Vector3.new(2, 1.2, 2), Palette.stoneDark, M.Slate, d())
	local f = Parts.ellipsoid(m, CFrame.new(pos + Vector3.new(0, 10.8, 0)), Vector3.new(1.8, 2.6, 1.8), Palette.lavaHot, M.Neon, { decor = true, name = "Flame" })
	if withLight then
		Parts.light(f, "PointLight", { Color = Color3.fromRGB(255, 170, 90), Brightness = 1.2, Range = 20, Shadows = false })
	end
	return m
end

----------------------------------------------------------------------
-- eggs
----------------------------------------------------------------------
-- Egg standing on its base at `pos`. Big eggs get a glass shell, a soft light and spots.
function Props.egg(parent: Instance, pos: Vector3, height: number, color: Color3, withLight: boolean?): Model
	local m = Parts.model(parent, "Egg")
	local w = height * 0.76
	local centre = pos + Vector3.new(0, height / 2, 0)
	local h0, s0, v0 = color:ToHSV()
	local core = Parts.ellipsoid(m, CFrame.new(centre), Vector3.new(w, height, w), Color3.fromHSV(h0, s0 * 0.85, v0 * 0.8), M.Neon, { name = "EggCore", noCollide = true })
	if height >= 14 then
		Parts.ellipsoid(m, CFrame.new(centre), Vector3.new(w * 1.06, height * 1.04, w * 1.06), Color3.fromHSV(h0, s0 * 0.4, 1), M.Glass, { decor = true, transparency = 0.55, reflectance = 0.15, name = "EggShell" })
	end
	for i = 1, (height >= 14 and 6 or 3) do
		local a = i * 2.4
		local y = height * (0.3 + 0.12 * (i % 3))
		local r = w * 0.5 * math.sqrt(1 - ((y - height / 2) / (height / 2)) ^ 2) * 0.97
		Parts.ellipsoid(m, CFrame.lookAt(pos + Vector3.new(math.cos(a) * r, y, math.sin(a) * r), pos + Vector3.new(0, y, 0)), Vector3.new(w * 0.22, height * 0.16, 0.6), Color3.new(1, 1, 1), M.Neon, { decor = true, transparency = 0.25, name = "Spot" })
	end
	if withLight then
		Parts.light(core, "PointLight", { Color = color, Brightness = height >= 14 and 2 or 1, Range = height >= 14 and 40 or 16, Shadows = false })
	end
	m:SetAttribute("EggColor", color)
	return m
end

-- Stone pedestal with a gold ring and a small egg on top.
function Props.eggPedestal(parent: Instance, pos: Vector3, eggH: number, color: Color3, stone: Color3?, trim: Color3?, withLight: boolean?): Model
	local m = Parts.model(parent, "EggPedestal")
	local w = eggH * 0.95
	Parts.cyl(m, pos + Vector3.new(0, 1.2, 0), 2.4, w + 2.4, stone or Palette.paleStone, M.SmoothPlastic, { name = "Base" })
	Parts.cyl(m, pos + Vector3.new(0, 3.2, 0), 1.6, w, stone or Palette.paleStone, M.SmoothPlastic, { name = "Column" })
	Parts.cyl(m, pos + Vector3.new(0, 4.25, 0), 0.5, w + 0.8, trim or Palette.gold, M.SmoothPlastic, d())
	Props.egg(m, pos + Vector3.new(0, 4.3, 0), eggH, color, withLight)
	return m
end

----------------------------------------------------------------------
-- rocks & crystals
----------------------------------------------------------------------
function Props.rock(parent: Instance, pos: Vector3, size: number, rng: Random, color: Color3?, material: Enum.Material?): Model
	local m = Parts.model(parent, "Rock")
	local c = color or Palette.stone
	local collide = size > 5
	Parts.block(m, CFrame.new(pos + Vector3.new(0, size * 0.25, 0)) * CFrame.Angles(rng:NextNumber(-0.4, 0.4), rng:NextNumber(0, 6.28), rng:NextNumber(-0.4, 0.4)), Vector3.new(size, size * 0.75, size * 0.85), Util.vary(c, rng, 0.04), material or M.Slate, { decor = not collide, name = "Rock" })
	if size > 3 then
		Parts.block(m, CFrame.new(pos + Vector3.new(size * 0.4, size * 0.12, size * 0.2)) * CFrame.Angles(rng:NextNumber(-0.5, 0.5), rng:NextNumber(0, 6.28), rng:NextNumber(-0.5, 0.5)), Vector3.new(size * 0.5, size * 0.4, size * 0.45), Util.vary(c, rng, 0.05), material or M.Slate, { decor = true })
	end
	return m
end

function Props.crystal(parent: Instance, pos: Vector3, size: number, rng: Random, color: Color3?, withLight: boolean?): Model
	local m = Parts.model(parent, "Crystal")
	local c = color or Palette.iceCrystal
	local n = rng:NextInteger(3, 6)
	for i = 1, n do
		local h = size * (i == 1 and 1 or rng:NextNumber(0.4, 0.8))
		local w = h * rng:NextNumber(0.22, 0.32)
		local tilt = i == 1 and 0 or rng:NextNumber(0.25, 0.6)
		local a = rng:NextNumber(0, 6.28)
		local base = pos + Vector3.new(math.cos(a), 0, math.sin(a)) * (i == 1 and 0 or w * 0.8)
		local cf = CFrame.new(base) * CFrame.Angles(0, a, 0) * CFrame.Angles(tilt, 0, 0) * CFrame.new(0, h / 2 - 0.5, 0) * CFrame.Angles(0, rad(45), 0)
		local shard = Parts.block(m, cf, Vector3.new(w, h, w), Util.vary(c, rng, 0.04), i == 1 and M.Neon or M.Glass, { decor = size < 8, transparency = i == 1 and 0.1 or 0.18, reflectance = 0.1, name = "Shard" })
		if i == 1 then
			-- dim the neon core so it glows without losing its facets
			local hh, ss, vv = c:ToHSV()
			shard.Color = Color3.fromHSV(hh, ss, vv * 0.72)
			Parts.block(m, cf * CFrame.new(0, h / 2 + w * 0.3, 0) * CFrame.Angles(0, 0, rad(45)), Vector3.new(w * 0.72, w * 0.72, w), shard.Color, M.Neon, { decor = true, name = "Tip" })
			if withLight then
				Parts.light(shard, "PointLight", { Color = c, Brightness = 0.9, Range = math.min(24, size * 2.2), Shadows = false })
			end
		end
	end
	Parts.block(m, CFrame.new(pos + Vector3.new(0, size * 0.06, 0)) * CFrame.Angles(0.15, rng:NextNumber(0, 6.28), 0.1), Vector3.new(size * 0.6, size * 0.18, size * 0.5), Palette.stoneDark, M.Slate, { decor = true, name = "Base" })
	return m
end

----------------------------------------------------------------------
-- fences, banners, signs
----------------------------------------------------------------------
-- Fence from a to b following given heights; rails collide so they act as barriers.
function Props.fence(parent: Instance, a: Vector3, b: Vector3, color: Color3?, material: Enum.Material?, spacing: number?)
	local c = color or Palette.woodLight
	local mat = material or M.Wood
	local len = (b - a).Magnitude
	local n = math.max(1, math.floor(len / (spacing or 8)))
	for i = 0, n do
		local p = a:Lerp(b, i / n)
		Parts.block(parent, CFrame.new(p + Vector3.new(0, 2.2, 0)), Vector3.new(1, 4.4, 1), c, mat, { name = "FencePost" })
	end
	Parts.span(parent, a + Vector3.new(0, 3.6, 0), b + Vector3.new(0, 3.6, 0), 0.6, 0.6, c, mat, { name = "FenceRail" })
	Parts.span(parent, a + Vector3.new(0, 1.8, 0), b + Vector3.new(0, 1.8, 0), 0.6, 0.6, c, mat, { decor = true, name = "FenceRail" })
end

function Props.banner(parent: Instance, pos: Vector3, facing: Vector3, cloth: Color3, trim: Color3?, height: number?, emblem: Color3?): Model
	local m = Parts.model(parent, "Banner")
	local h = height or 22
	local cf = Util.facing(pos, facing)
	Parts.cyl(m, pos + Vector3.new(0, h / 2, 0), h, 1, trim or Palette.gold, M.SmoothPlastic, { name = "Pole" })
	Parts.ball(m, pos + Vector3.new(0, h + 0.8, 0), 1.8, trim or Palette.gold, M.SmoothPlastic, d())
	Parts.block(m, cf * CFrame.new(0, h - 1, 0) * CFrame.Angles(0, rad(90), 0), Vector3.new(7.4, 0.5, 0.5), trim or Palette.gold, M.SmoothPlastic, d())
	Parts.block(m, cf * CFrame.new(0, h - 6.2, -0.4), Vector3.new(6, 10, 0.3), cloth, M.Fabric, { decor = true, name = "Cloth" })
	-- swallow-tail ends
	Parts.block(m, cf * CFrame.new(-1.6, h - 11.6, -0.4) * CFrame.Angles(0, 0, rad(22)), Vector3.new(3.2, 2.6, 0.3), cloth, M.Fabric, d())
	Parts.block(m, cf * CFrame.new(1.6, h - 11.6, -0.4) * CFrame.Angles(0, 0, rad(-22)), Vector3.new(3.2, 2.6, 0.3), cloth, M.Fabric, d())
	if emblem then
		Parts.ellipsoid(m, cf * CFrame.new(0, h - 5.6, -0.65), Vector3.new(2.6, 3.4, 0.3), emblem, M.SmoothPlastic, d())
	end
	return m
end

----------------------------------------------------------------------
-- candy pieces
----------------------------------------------------------------------
function Props.candyCane(parent: Instance, pos: Vector3, height: number, rng: Random): Model
	local m = Parts.model(parent, "CandyCane")
	local d0 = math.max(1.6, height * 0.09)
	local n = math.floor(height / (d0 * 1.2))
	for i = 0, n - 1 do
		Parts.cyl(m, pos + Vector3.new(0, (i + 0.5) * d0 * 1.2, 0), d0 * 1.2, d0, i % 2 == 0 and Palette.candyHot or Palette.candyCream, M.SmoothPlastic, { name = "Cane" })
	end
	local top = pos + Vector3.new(0, n * d0 * 1.2, 0)
	local yaw = rng:NextNumber(0, 6.28)
	local r = height * 0.16
	local prev = top
	for i = 1, 7 do
		local a = i / 7 * math.pi
		local p = top + (CFrame.Angles(0, yaw, 0) * Vector3.new(r - math.cos(a) * r, math.sin(a) * r, 0))
		Parts.rod(m, prev, p, d0, i % 2 == 0 and Palette.candyHot or Palette.candyCream, M.SmoothPlastic, d())
		prev = p
	end
	return m
end

function Props.gumdrop(parent: Instance, pos: Vector3, size: number, color: Color3)
	Parts.ellipsoid(parent, CFrame.new(pos + Vector3.new(0, size * 0.3, 0)), Vector3.new(size, size * 0.9, size), color, M.SmoothPlastic, { decor = size < 6, transparency = 0.05, name = "Gumdrop" })
end

-- Frosted donut standing upright as an arch. Walk through the middle.
function Props.donutArch(parent: Instance, pos: Vector3, facing: Vector3, radius: number, rng: Random): Model
	local m = Parts.model(parent, "DonutArch")
	local cf = Util.facing(pos, facing)
	local thick = radius * 0.55
	local segs = 18
	local dough = Color3.fromRGB(226, 168, 98)
	local icing = ({ Palette.candyPink, Palette.candyHot, Palette.mushroomLilac, Palette.candyTurq })[rng:NextInteger(1, 4)]
	local centre = cf * CFrame.new(0, radius * 0.66, 0)
	for i = 0, segs - 1 do
		local a = (i + 0.5) / segs * math.pi * 2
		local p = centre * CFrame.new(math.cos(a) * radius, math.sin(a) * radius, 0)
		local segLen = 2 * math.pi * radius / segs * 1.15
		local tangentCF = CFrame.fromMatrix(p.Position, centre.LookVector, (centre.Position - p.Position).Unit)
		Parts.block(m, tangentCF, Vector3.new(thick, thick * 0.92, segLen), dough, M.SmoothPlastic, { name = "Dough" })
		if math.sin(a) > -0.25 then
			Parts.block(m, tangentCF * CFrame.new(0, -thick * 0.08, 0), Vector3.new(thick * 1.08, thick * 0.8, segLen * 1.02), icing, M.SmoothPlastic, { decor = true, name = "Icing" })
			for _ = 1, 2 do
				Parts.block(m, tangentCF * CFrame.new(rng:NextNumber(-thick / 2, thick / 2), -thick * 0.46, rng:NextNumber(-segLen / 2, segLen / 2)) * CFrame.Angles(0, rng:NextNumber(0, 3), 0), Vector3.new(0.5, 0.5, 1.6), Palette.flowers[rng:NextInteger(1, #Palette.flowers)], M.SmoothPlastic, { decor = true, shadow = false, name = "Sprinkle" })
			end
		end
	end
	return m
end

----------------------------------------------------------------------
-- sky & water dressing
----------------------------------------------------------------------
function Props.cloud(parent: Instance, pos: Vector3, size: number, rng: Random): Model
	local m = Parts.model(parent, "Cloud")
	for _ = 1, rng:NextInteger(4, 7) do
		local s = size * rng:NextNumber(0.45, 0.85)
		local off = Vector3.new(rng:NextNumber(-0.7, 0.7) * size, rng:NextNumber(-0.12, 0.18) * size, rng:NextNumber(-0.45, 0.45) * size)
		Parts.ellipsoid(m, CFrame.new(pos + off), Vector3.new(s * 1.3, s * 0.62, s), Color3.fromRGB(252, 253, 255), M.SmoothPlastic, { decor = true, shadow = false, transparency = 0.08, name = "Puff" })
	end
	return m
end

function Props.dock(parent: Instance, from: Vector3, to: Vector3, width: number): Model
	local m = Parts.model(parent, "Dock")
	local dir = (to - from)
	local len = dir.Magnitude
	local cf = CFrame.lookAt(from, to)
	local n = math.floor(len / 2.2)
	for i = 0, n - 1 do
		Parts.block(m, cf * CFrame.new(0, -0.35, -(i + 0.5) * 2.2), Vector3.new(width, 0.7, 2), i % 2 == 0 and Palette.woodLight or Palette.wood, M.WoodPlanks, { decor = true, name = "Plank" })
	end
	Parts.collider(m, cf * CFrame.new(0, -0.6, -len / 2), Vector3.new(width, 1.2, len), "DockCollider")
	for _, side in { -1, 1 } do
		for i = 1, math.floor(len / 9) do
			Parts.cyl(m, (cf * CFrame.new(side * (width / 2 - 0.6), -4, -i * 9)).Position, 9, 1.4, Palette.woodDark, M.Wood, { name = "Piling" })
		end
	end
	return m
end

return Props
