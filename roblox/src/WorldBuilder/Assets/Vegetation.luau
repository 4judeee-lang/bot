-- Low-poly vegetation in the blocky, rounded Roblox style of the references.
-- Trunks collide; canopies, vines, flowers and grass never block players or the camera.

local Util = require(script.Parent.Parent.Util)
local Parts = require(script.Parent.Parent.Parts)
local Palette = require(script.Parent.Parent.Palette)

local M = Enum.Material
local rad = math.rad
local Veg = {}

local function pick(list, rng: Random)
	return list[rng:NextInteger(1, #list)]
end

local function decor()
	return { decor = true }
end

-- Rounded-cube canopy cluster: the signature "blocky tree" silhouette from the overview.
local function canopy(model: Model, centre: Vector3, size: number, colors, rng: Random, lumps: number)
	Parts.block(model, CFrame.new(centre) * CFrame.Angles(0, rng:NextNumber(0, 6.28), 0), Vector3.one * size, Util.vary(pick(colors, rng), rng, 0.04), M.SmoothPlastic, { decor = true, shadow = true, name = "Canopy" })
	for _ = 1, lumps do
		local off = Vector3.new(rng:NextNumber(-0.5, 0.5), rng:NextNumber(-0.25, 0.35), rng:NextNumber(-0.5, 0.5)) * size
		local s = size * rng:NextNumber(0.55, 0.8)
		Parts.block(
			model,
			CFrame.new(centre + off) * CFrame.Angles(rng:NextNumber(-0.2, 0.2), rng:NextNumber(0, 6.28), rng:NextNumber(-0.2, 0.2)),
			Vector3.new(s, s * rng:NextNumber(0.8, 1), s),
			Util.vary(pick(colors, rng), rng, 0.05),
			M.SmoothPlastic,
			{ decor = true, shadow = true, name = "Canopy" }
		)
	end
end

function Veg.broadleaf(parent: Instance, pos: Vector3, height: number, rng: Random, colors: { Color3 }?): Model
	local m = Parts.model(parent, "Tree")
	local trunkH = height * 0.5
	local d = math.max(2.5, height * 0.07)
	Parts.cyl(m, pos + Vector3.new(0, trunkH / 2 - 1, 0), trunkH + 2, d, Util.vary(Palette.trunk, rng, 0.03), M.Wood, { name = "Trunk" })
	-- a couple of low branches
	for _ = 1, 2 do
		local a = rng:NextNumber(0, 6.28)
		local from = pos + Vector3.new(0, trunkH * rng:NextNumber(0.55, 0.8), 0)
		local to = from + Vector3.new(math.cos(a) * height * 0.18, height * 0.12, math.sin(a) * height * 0.18)
		Parts.rod(m, from, to, d * 0.45, Palette.trunk, M.Wood, decor())
	end
	canopy(m, pos + Vector3.new(0, trunkH + height * 0.22, 0), height * 0.42, colors or Palette.leaf, rng, 4)
	return m
end

function Veg.jungleGiant(parent: Instance, pos: Vector3, height: number, rng: Random): Model
	local m = Parts.model(parent, "GiantTree")
	local d = height * 0.1
	local trunkH = height * 0.62
	local bark = Util.vary(Palette.jungleTrunk, rng, 0.03)
	Parts.cyl(m, pos + Vector3.new(0, trunkH / 2 - 2, 0), trunkH + 4, d, bark, M.Wood, { name = "Trunk" })
	-- buttress roots
	for i = 1, 5 do
		local a = i / 5 * math.pi * 2 + rng:NextNumber(-0.2, 0.2)
		local dir = Vector3.new(math.cos(a), 0, math.sin(a))
		local len = d * rng:NextNumber(1.1, 1.6)
		local cf = Util.facing(pos + dir * (d * 0.35 + len / 2) + Vector3.new(0, d * 0.45 - 1, 0), -dir)
		Parts.wedge(m, cf, Vector3.new(d * 0.28, d * 0.95, len), bark, M.Wood, { name = "Root" })
	end
	-- spreading limbs carrying flat canopy layers
	local top = pos + Vector3.new(0, trunkH, 0)
	for i = 1, 4 do
		local a = i / 4 * math.pi * 2 + rng:NextNumber(-0.4, 0.4)
		local reach = height * rng:NextNumber(0.22, 0.32)
		local tip = top + Vector3.new(math.cos(a) * reach, rng:NextNumber(-4, 8), math.sin(a) * reach)
		Parts.rod(m, top - Vector3.new(0, height * 0.08, 0), tip, d * 0.35, bark, M.Wood, decor())
		local s = height * rng:NextNumber(0.26, 0.34)
		Parts.block(m, CFrame.new(tip + Vector3.new(0, s * 0.18, 0)) * CFrame.Angles(0, rng:NextNumber(0, 6.28), 0), Vector3.new(s, s * 0.45, s), Util.vary(pick(Palette.jungleLeaf, rng), rng, 0.04), M.SmoothPlastic, { decor = true, shadow = true, name = "Canopy" })
	end
	canopy(m, top + Vector3.new(0, height * 0.16, 0), height * 0.36, Palette.jungleLeaf, rng, 3)
	-- hanging vines
	for _ = 1, 7 do
		local a = rng:NextNumber(0, 6.28)
		local r = height * rng:NextNumber(0.15, 0.32)
		local len = rng:NextNumber(10, 26)
		local p = top + Vector3.new(math.cos(a) * r, -len / 2, math.sin(a) * r)
		Parts.block(m, CFrame.new(p), Vector3.new(0.6, len, 0.6), Palette.vine, M.SmoothPlastic, decor())
	end
	return m
end

function Veg.palm(parent: Instance, pos: Vector3, height: number, rng: Random): Model
	local m = Parts.model(parent, "Palm")
	local lean = rng:NextNumber(0, 6.28)
	local dir = Vector3.new(math.cos(lean), 0, math.sin(lean))
	local segs = 6
	local prev = pos - Vector3.new(0, 1, 0)
	local d = math.max(2, height * 0.06)
	for i = 1, segs do
		local t = i / segs
		local nextP = pos + Vector3.new(0, height * t, 0) + dir * (height * 0.18 * t * t)
		Parts.rod(m, prev, nextP, d * (1 - t * 0.3), i % 2 == 0 and Palette.trunk or Palette.woodLight, M.Wood, { name = "Trunk" })
		prev = nextP
	end
	local crown = prev
	for i = 1, 8 do
		local a = i / 8 * math.pi * 2 + rng:NextNumber(-0.15, 0.15)
		local len = height * rng:NextNumber(0.42, 0.55)
		local out = Vector3.new(math.cos(a), 0, math.sin(a))
		local mid = crown + out * len * 0.5 + Vector3.new(0, -len * 0.12, 0)
		local cf = CFrame.lookAt(mid, mid + out) * CFrame.Angles(rad(-18), 0, 0)
		Parts.wedge(m, cf * CFrame.Angles(0, 0, rad(180)), Vector3.new(len * 0.24, 0.8, len), Util.vary(pick(Palette.palmLeaf, rng), rng, 0.05), M.SmoothPlastic, { decor = true, shadow = true, name = "Frond" })
	end
	for _ = 1, 3 do
		Parts.ball(m, crown + Vector3.new(rng:NextNumber(-1.5, 1.5), -1.5, rng:NextNumber(-1.5, 1.5)), 2.2, Color3.fromRGB(120, 86, 40), M.SmoothPlastic, decor())
	end
	return m
end

function Veg.pine(parent: Instance, pos: Vector3, height: number, rng: Random, snowy: boolean?): Model
	local m = Parts.model(parent, "Pine")
	Parts.cyl(m, pos + Vector3.new(0, height * 0.15, 0), height * 0.32, math.max(1.8, height * 0.06), Palette.trunk, M.Wood, { name = "Trunk" })
	local tiers = 4
	for i = 1, tiers do
		local t = (i - 1) / tiers
		local w = height * (0.62 - t * 0.42)
		local y = height * (0.24 + t * 0.2)
		local cf = CFrame.new(pos + Vector3.new(0, y, 0)) * CFrame.Angles(0, rad(45 * i) + rng:NextNumber(-0.1, 0.1), 0)
		Parts.block(m, cf, Vector3.new(w, height * 0.17, w), Util.vary(pick(Palette.pine, rng), rng, 0.03), M.SmoothPlastic, { decor = true, shadow = true, name = "Needles" })
		if snowy then
			Parts.block(m, cf * CFrame.new(0, height * 0.085 + 0.4, 0), Vector3.new(w * 0.86, 1.2, w * 0.86), Palette.snowWhite, M.SmoothPlastic, { decor = true, name = "SnowCap" })
		end
	end
	Parts.block(m, CFrame.new(pos + Vector3.new(0, height * 0.98, 0)) * CFrame.Angles(0, rad(20), 0), Vector3.new(height * 0.12, height * 0.14, height * 0.12), snowy and Palette.snowWhite or Palette.pine[1], M.SmoothPlastic, decor())
	return m
end

function Veg.lollipop(parent: Instance, pos: Vector3, height: number, rng: Random): Model
	local m = Parts.model(parent, "LollipopTree")
	Parts.cyl(m, pos + Vector3.new(0, height * 0.35, 0), height * 0.7, math.max(1.6, height * 0.05), Palette.candyCream, M.SmoothPlastic, { name = "Stick" })
	local colors = { { Palette.candyPink, Palette.candyCream }, { Palette.candyTurq, Palette.candyCream }, { Palette.candyHot, Palette.candyFrost }, { Palette.mushroomLilac, Palette.candyCream } }
	local pair = pick(colors, rng)
	local centre = pos + Vector3.new(0, height * 0.78, 0)
	local yaw = rng:NextNumber(0, 6.28)
	local disc = height * 0.5
	-- concentric discs, each a hair proud of the last, read as a swirl from both sides
	for ring = 0, 4 do
		local dd = disc * (1 - ring * 0.19)
		local p = Parts.block(m, CFrame.new(centre) * CFrame.Angles(0, yaw, 0), Vector3.new(1.4 + ring * 0.3, dd, dd), ring % 2 == 0 and pair[1] or pair[2], M.SmoothPlastic, { decor = ring > 0, name = "Swirl" })
		p.Shape = Enum.PartType.Cylinder
	end
	return m
end

function Veg.mushroom(parent: Instance, pos: Vector3, height: number, rng: Random, cap: Color3, glow: boolean?): Model
	local m = Parts.model(parent, "Mushroom")
	local stemD = height * 0.22
	Parts.cyl(m, pos + Vector3.new(0, height * 0.35, 0), height * 0.75, stemD, Palette.candyCream, M.SmoothPlastic, { name = "Stem" })
	local capW = height * rng:NextNumber(0.9, 1.15)
	local capPos = pos + Vector3.new(0, height * 0.72, 0)
	local capPart = Parts.ellipsoid(m, CFrame.new(capPos) * CFrame.Angles(rng:NextNumber(-0.08, 0.08), 0, rng:NextNumber(-0.08, 0.08)), Vector3.new(capW, height * 0.5, capW), cap, glow and M.Neon or M.SmoothPlastic, { decor = height < 14, shadow = true, name = "Cap" })
	if glow then
		-- Neon cap is bright; keep its shape readable by darkening the colour.
		local h, s, v = cap:ToHSV()
		capPart.Color = Color3.fromHSV(h, s, v * 0.62)
	end
	for i = 1, 5 do
		local a = i / 5 * 6.28 + rng:NextNumber(-0.3, 0.3)
		local r = capW * 0.3
		Parts.ellipsoid(m, CFrame.new(capPos + Vector3.new(math.cos(a) * r, height * 0.18, math.sin(a) * r)), Vector3.new(capW * 0.16, height * 0.06, capW * 0.16), Palette.white, glow and M.Neon or M.SmoothPlastic, decor())
	end
	if glow and height >= 10 then
		Parts.light(capPart, "PointLight", { Color = cap, Brightness = 0.9, Range = math.min(28, height * 1.8), Shadows = false })
	end
	return m
end

function Veg.bush(parent: Instance, pos: Vector3, size: number, rng: Random, colors: { Color3 }?): Model
	local m = Parts.model(parent, "Bush")
	for _ = 1, 3 do
		local s = size * rng:NextNumber(0.6, 1)
		Parts.ellipsoid(m, CFrame.new(pos + Vector3.new(rng:NextNumber(-0.4, 0.4) * size, s * 0.3, rng:NextNumber(-0.4, 0.4) * size)), Vector3.new(s, s * 0.75, s), Util.vary(pick(colors or Palette.leaf, rng), rng, 0.05), M.SmoothPlastic, { decor = true, shadow = true })
	end
	return m
end

function Veg.flowers(parent: Instance, pos: Vector3, rng: Random, colors: { Color3 }?)
	local c = pick(colors or Palette.flowers, rng)
	for _ = 1, rng:NextInteger(3, 6) do
		local p = pos + Vector3.new(rng:NextNumber(-3, 3), 0, rng:NextNumber(-3, 3))
		Parts.block(parent, CFrame.new(p + Vector3.new(0, 0.8, 0)), Vector3.new(0.3, 1.6, 0.3), Palette.vine, M.SmoothPlastic, { decor = true, shadow = false, name = "Stem" })
		Parts.block(parent, CFrame.new(p + Vector3.new(0, 1.8, 0)) * CFrame.Angles(0, rng:NextNumber(0, 1.5), 0), Vector3.new(1.2, 0.5, 1.2), c, M.SmoothPlastic, { decor = true, shadow = false, name = "Flower" })
	end
end

function Veg.grassTuft(parent: Instance, pos: Vector3, rng: Random, color: Color3?)
	for i = 1, 3 do
		local a = i * 2.1 + rng:NextNumber(-0.4, 0.4)
		local h = rng:NextNumber(1.6, 3)
		Parts.wedge(parent, CFrame.new(pos + Vector3.new(math.cos(a) * 0.5, h / 2 - 0.2, math.sin(a) * 0.5)) * CFrame.Angles(0, a, 0), Vector3.new(0.3, h, 1), color or Palette.leaf[3], M.SmoothPlastic, { decor = true, shadow = false, name = "Grass" })
	end
end

function Veg.fern(parent: Instance, pos: Vector3, size: number, rng: Random, color: Color3?)
	for i = 1, 6 do
		local a = i / 6 * 6.28 + rng:NextNumber(-0.2, 0.2)
		local out = Vector3.new(math.cos(a), 0, math.sin(a))
		local mid = pos + out * size * 0.4 + Vector3.new(0, size * 0.25, 0)
		Parts.wedge(parent, CFrame.lookAt(mid, mid + out) * CFrame.Angles(rad(35), 0, 0), Vector3.new(size * 0.25, 0.4, size * 0.8), color or Palette.jungleLeaf[3], M.SmoothPlastic, { decor = true, shadow = false, name = "Fern" })
	end
end

function Veg.lilyPad(parent: Instance, pos: Vector3, rng: Random)
	local d = rng:NextNumber(4, 8)
	local p = Parts.cyl(parent, pos, 0.4, d, Color3.fromRGB(70, 170, 80), M.SmoothPlastic, { decor = true, name = "LilyPad" })
	p.CFrame = p.CFrame * CFrame.Angles(rng:NextNumber(0, 6.28), 0, 0)
	if rng:NextNumber() < 0.3 then
		Parts.ball(parent, pos + Vector3.new(0, 0.6, 0), 1.2, Color3.fromRGB(255, 170, 210), M.SmoothPlastic, decor())
	end
end

function Veg.vineCurtain(parent: Instance, top: Vector3, width: number, length: number, rng: Random, facing: Vector3)
	local right = Vector3.new(-facing.Z, 0, facing.X)
	for i = 1, math.max(2, math.floor(width / 3)) do
		local len = length * rng:NextNumber(0.4, 1)
		local p = top + right * ((i - 0.5) * 3 - width / 2) + Vector3.new(0, -len / 2, 0)
		Parts.block(parent, CFrame.new(p), Vector3.new(0.5, len, 0.5), Palette.vine, M.SmoothPlastic, { decor = true, shadow = false, name = "Vine" })
		if rng:NextNumber() < 0.5 then
			Parts.block(parent, CFrame.new(p + Vector3.new(0, rng:NextNumber(-len / 3, len / 3), 0)) * CFrame.Angles(0, rng:NextNumber(0, 3), 0.6), Vector3.new(1.4, 0.3, 0.9), Palette.leaf[2], M.SmoothPlastic, { decor = true, shadow = false, name = "Leaf" })
		end
	end
end

return Veg
