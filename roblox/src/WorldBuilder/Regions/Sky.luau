-- Sky islands: white-and-gold temple, golden egg pavilion beside the luminous pool,
-- the sky gate, island gardens, cyan waterfalls into the clouds, crystals and clouds.

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
local Sky = {}

local function island(name: string)
	for _, i in Layout.islands do
		if i.name == name then
			return i
		end
	end
	return nil
end

-- Waterfall pouring off an island edge and fading into the clouds.
local function skyFall(parent: Instance, lip: Vector3, dir: Vector3, width: number, length: number, rng: Random)
	local m = Parts.model(parent, "SkyWaterfall")
	local fwd = Util.flat(dir).Unit
	local seg = length / 3
	for k = 0, 2 do
		local cf = Util.facing(lip + fwd * (1.5 + k * 1.2) - Vector3.new(0, seg * (k + 0.5), 0), fwd)
		Parts.block(m, cf, Vector3.new(width * (1 + k * 0.12), seg + 1, 2), Color3.fromRGB(150, 228, 246), M.Glass, { decor = true, shadow = false, transparency = 0.25 + k * 0.22, name = "Sheet" })
		for _ = 1, math.max(2, math.floor(width / 6)) do
			Parts.block(m, cf * CFrame.new(rng:NextNumber(-width / 2, width / 2), rng:NextNumber(-seg / 4, seg / 4), -1.2), Vector3.new(rng:NextNumber(1.5, 3), seg * rng:NextNumber(0.5, 0.9), 0.4), Color3.fromRGB(230, 250, 255), M.SmoothPlastic, { decor = true, shadow = false, transparency = 0.35 + k * 0.2, name = "Streak" })
		end
	end
	Parts.ellipsoid(m, CFrame.new(lip + fwd * 0.6) * Util.facing(Vector3.zero, fwd).Rotation, Vector3.new(width + 2, 3, 5), Color3.fromRGB(230, 250, 255), M.SmoothPlastic, { decor = true, shadow = false, transparency = 0.15, name = "Lip" })
	local mist = Parts.block(m, CFrame.new(lip + fwd * 4 - Vector3.new(0, length, 0)), Vector3.new(width, 2, 6), Color3.new(1, 1, 1), M.SmoothPlastic, { decor = true, transparency = 1, name = "Mist" })
	Parts.emitter(mist, {
		Texture = Structures.SMOKE, Rate = 3, Lifetime = NumberRange.new(3, 5), Speed = NumberRange.new(2, 4),
		SpreadAngle = Vector2.new(40, 40), Drag = 1, LightInfluence = 1,
		Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 10), NumberSequenceKeypoint.new(1, 24) }),
		Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 1) }),
	})
	return m
end

local function nearSkyRoute(x: number, z: number, y: number, pad: number): boolean
	for _, s in Field.pathSegs do
		if s.kind == "sky" or s.kind == "skystairs" or s.kind == "struct" then
			local d, t = Util.segDist(x, z, s.ax, s.az, s.bx, s.bz)
			local sy = Util.lerp(s.ah, s.bh, math.clamp(t, 0, 1))
			if d < s.hw + pad and math.abs(sy - y) < 90 then
				return true
			end
		end
	end
	return false
end

function Sky.build(ctx)
	local rng = Random.new(Layout.SEED + 707)
	local region = ctx.region("SkyIslands")
	local veg = Parts.folder(region, "Vegetation")
	local props = Parts.folder(region, "Props")
	local landmarks = Parts.folder(region, "Landmarks")

	-- temple (main landmark) and the golden hatch pavilion beside the pool
	Pavilions.temple(landmarks, Vector3.new(350, 480, -1790), Vector3.new(-0.25, 0, 1), rng)
	local pav = Layout.pavilions[7]
	Pavilions.golden(landmarks, pav.pos, pav.face, rng)

	-- luminous pool rim
	local pi = island("PoolIsle")
	local pool = pi.pool
	for i = 0, 23 do
		local a = i / 24 * math.pi * 2
		local p = Vector3.new(pool.c[1] + math.cos(a) * (pool.r + 2), pi.h - 0.6, pool.c[2] + math.sin(a) * (pool.r + 2))
		Parts.block(props, CFrame.lookAt(p, Vector3.new(pool.c[1], p.Y, pool.c[2])), Vector3.new(12, 1.6, 4), Palette.white, M.Marble, { name = "PoolRim" })
		if i % 2 == 0 then
			Parts.block(props, CFrame.lookAt(p, Vector3.new(pool.c[1], p.Y, pool.c[2])) * CFrame.new(0, 0.9, 0), Vector3.new(12.4, 0.3, 4.4), Palette.cyan, M.Neon, { decor = true, name = "PoolGlow" })
		end
	end
	local glow = Parts.block(props, CFrame.new(pool.c[1], pi.h - 4, pool.c[2]), Vector3.new(1, 1, 1), Palette.cyan, M.Neon, { decor = true, transparency = 1, name = "PoolLight" })
	Parts.light(glow, "PointLight", { Color = Palette.cyan, Brightness = 1.5, Range = 50, Shadows = false })

	-- sky gate at the foot of the celestial stair
	local g = Layout.nodes.nJ4:Lerp(Layout.nodes.skyGate, 0.5)
	local gdir = Common.pathDirAt(g)
	local gm = Parts.model(landmarks, "SkyGate", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic, LevelOfDetail = Enum.ModelLevelOfDetail.StreamingMesh })
	local gcf = Util.facing(Vector3.new(g.X, Field.height(g.X, g.Z) - 0.5, g.Z), gdir)
	for _, sd in { -1, 1 } do
		Structures.column(gm, (gcf * CFrame.new(sd * 22, 0, 0)).Position, 40, 6, Palette.white, Palette.gold)
		for i = 1, 4 do
			Parts.block(gm, gcf * CFrame.new(sd * (26 + i * 5), 40 - i * 3, 0) * CFrame.Angles(0, 0, math.rad(sd * (15 + i * 9))), Vector3.new(12 - i, 2.4, 1.6), Palette.gold, M.SmoothPlastic, { decor = true, name = "Wing" })
		end
	end
	Parts.block(gm, gcf * CFrame.new(0, 42, 0), Vector3.new(56, 4, 8), Palette.white, M.Marble, { name = "Lintel" })
	Parts.block(gm, gcf * CFrame.new(0, 44.5, 0), Vector3.new(58, 1, 9), Palette.gold, M.SmoothPlastic, { decor = true })
	Props.egg(gm, (gcf * CFrame.new(0, 45, 0)).Position, 8, Palette.eggs[8], true)

	-- waterfalls pouring off the islands into the clouds
	local falls = {
		{ "GateIsle", 0.2, 22 }, { "GateIsle", 2.6, 16 }, { "PoolIsle", 3.4, 24 }, { "GardenIsle", 0.9, 20 },
		{ "GardenIsle", -0.6, 14 }, { "TempleIsle", 2.2, 18 }, { "Islet1", 1.0, 10 }, { "Islet3", 4.0, 10 },
	}
	for _, f in falls do
		local isl = island(f[1])
		local a = f[2]
		local dir = Vector3.new(math.cos(a), 0, math.sin(a))
		local edge = nil
		for r = isl.r * 0.7, isl.r * 1.2, 2 do
			if not Field.island(isl.c[1] + dir.X * r, isl.c[2] + dir.Z * r) then
				break
			end
			edge = r
		end
		if edge then
			local x, z = isl.c[1] + dir.X * (edge - 1), isl.c[2] + dir.Z * (edge - 1)
			if not nearSkyRoute(x, z, isl.h, 14) then
				skyFall(Parts.folder(region, "Waterways"), Vector3.new(x, isl.h - 0.8, z), dir, f[3], isl.decor and 90 or 150, rng)
			end
		end
	end

	-- island gardens: trees, flowers, purple crystals, golden lanterns along routes
	for _, isl in Layout.islands do
		local box = { isl.c[1] - isl.r, isl.c[2] - isl.r, isl.c[1] + isl.r, isl.c[2] + isl.r }
		Common.scatter({ box = box, count = isl.decor and 3 or 16, minDist = 30, pad = 10, island = true,
			place = function(p, r)
				Veg.broadleaf(veg, p, r:NextNumber(30, 54), r, { Color3.fromRGB(120, 210, 90), Color3.fromRGB(96, 196, 80), Color3.fromRGB(140, 220, 110) })
			end }, rng)
		Common.scatter({ box = box, count = isl.decor and 4 or 30, minDist = 10, pad = 3, island = true,
			place = function(p, r)
				Veg.flowers(veg, p, r)
			end }, rng)
		if not isl.decor then
			Common.scatter({ box = box, count = 6, minDist = 40, pad = 8, island = true,
				place = function(p, r)
					Props.crystal(props, p, r:NextNumber(8, 15), r, Palette.purpleCrystal, r:NextNumber() < 0.3)
				end }, rng)
		end
	end
	local nLantern = 0
	for _, s in Field.pathSegs do
		if s.kind == "sky" then
			local a = Vector3.new(s.ax, s.ah, s.az)
			local b = Vector3.new(s.bx, s.bh, s.bz)
			local len = (b - a).Magnitude
			local dir = Util.flat(b - a).Unit
			local right = Vector3.new(-dir.Z, 0, dir.X)
			for k = 1, math.floor(len / 56) do
				local p = a:Lerp(b, k / (math.floor(len / 56) + 1))
				local sd = k % 2 == 0 and 1 or -1
				local q = p + right * sd * (s.hw + 3.5)
				local isl = Field.island(q.X, q.Z)
				if isl and isl.edge < 0.92 and math.abs(isl.top - p.Y) < 2 and not Common.onPath(q.X, q.Z, 1.5) then
					nLantern += 1
					Props.lantern(props, Vector3.new(q.X, isl.top - 0.4, q.Z), "sky", nLantern % 2 == 1)
				end
			end
		end
	end

	-- clouds: a bank below the islands and a few drifting around them, clear of routes
	local cloudFolder = Parts.folder(region, "Clouds")
	local placed = 0
	for _ = 1, 260 do
		if placed >= 46 then
			break
		end
		local x = rng:NextNumber(-520, 1000)
		local z = rng:NextNumber(-1800, -1080)
		local y = rng:NextNumber() < 0.7 and rng:NextNumber(300, 368) or rng:NextNumber(430, 620)
		local size = rng:NextNumber(40, 90)
		local ground = Field.height(x, z)
		local isl = Field.island(x, z)
		local clearOfIsland = (not isl) or (y < isl.bottom - size * 0.3) or (y > isl.top + 120)
		if ground < y - size * 0.6 and clearOfIsland and not nearSkyRoute(x, z, y, size * 0.8 + 20) then
			Props.cloud(cloudFolder, Vector3.new(x, y, z), size, rng)
			placed += 1
		end
	end

	Common.clearingCreatures(region, "SkyMeadow1", { "CloudSprite", "Bunny" }, rng, 8)
	Common.clearingCreatures(region, "SkyMeadow2", { "CloudSprite", "CloudSprite" }, rng, 8)
	Common.clearingCreatures(region, "SkyGardenArena", { "CloudSprite", "Bunny", "CloudSprite" }, rng, 12)
end

return Sky
