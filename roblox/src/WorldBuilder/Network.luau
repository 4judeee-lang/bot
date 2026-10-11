-- Builds everything that follows the path and river network:
--   * bridges wherever a path leaves the ground (rivers, lava, ravines, gaps between islands)
--   * stairs, celestial stair flights/landings and the temple stairway
--   * cave mouths, lanterns, edge fences and path-side dressing
--   * waterfalls at every level change, springs, lava channels, curbs and hazard volumes

local Util = require(script.Parent.Util)
local Layout = require(script.Parent.Layout)
local Field = require(script.Parent.Field)
local Parts = require(script.Parent.Parts)
local Palette = require(script.Parent.Palette)
local Structures = require(script.Parent.Assets.Structures)
local Props = require(script.Parent.Assets.Props)
local Veg = require(script.Parent.Assets.Vegetation)

local M = Enum.Material
local Network = {}

local REGION_OF = { meadow = "StarterMeadow", hub = "Hub", jungle = "Jungle", candy = "CandyCliffs", volcano = "Volcano", snow = "SnowValley", sky = "SkyIslands" }
local STAIR_STYLE = {
	candy = { color = Palette.candyPink, color2 = Palette.candyCream, wall = Palette.candyFrost, trim = Palette.gold, material = M.SmoothPlastic },
	snow = { color = Palette.paleStone, color2 = Color3.fromRGB(214, 228, 242), wall = Palette.paleStone, trim = Palette.iceDeep, material = M.Slate },
	sky = { color = Palette.white, color2 = Palette.cream, wall = Palette.white, trim = Palette.gold, material = M.Marble, stringer = Palette.cream },
	meadow = { color = Palette.paleStone, color2 = Palette.stone, wall = Palette.stone, material = M.Slate },
}

Network.bridges = {} -- {path=id, a=Vector3, b=Vector3, length, minClear}
Network.walkways = {} -- polylines the audit walks: {name, pts={Vector3}, width}

local function regionFor(ctx, biome: string, p: Vector3)
	if (biome == "meadow" or biome == "hub") and Util.flat(p).Magnitude < 260 then
		return ctx.region("Hub")
	end
	return ctx.region(REGION_OF[biome] or "StarterMeadow")
end

-- Points along a polyline: list of {p=Vector3, s=cumulative distance}
local function samplePolyline(pts: { Vector3 }, step: number)
	local out = {}
	local s = 0
	for i = 1, #pts - 1 do
		local a, b = pts[i], pts[i + 1]
		local len = (b - a).Magnitude
		local n = math.max(1, math.ceil(len / step))
		for k = (i == 1 and 0 or 1), n do
			table.insert(out, { p = a:Lerp(b, k / n), s = s + len * k / n, seg = i })
		end
		s += len
	end
	return out, s
end

-- Sub-polyline between arc lengths s0..s1 (keeps interior vertices).
local function slice(pts: { Vector3 }, s0: number, s1: number): { Vector3 }
	local out = {}
	local s = 0
	for i = 1, #pts - 1 do
		local a, b = pts[i], pts[i + 1]
		local len = (b - a).Magnitude
		local e = s + len
		if e >= s0 and s <= s1 then
			local t0 = math.clamp((s0 - s) / len, 0, 1)
			local t1 = math.clamp((s1 - s) / len, 0, 1)
			if #out == 0 then
				table.insert(out, a:Lerp(b, t0))
			end
			table.insert(out, a:Lerp(b, t1))
		end
		s = e
	end
	return out
end

local function pathPoints(path): { Vector3 }
	return Field.profiled(path)
end

----------------------------------------------------------------------
-- bridges over gaps
----------------------------------------------------------------------
local function buildGaps(ctx, path, pts: { Vector3 }, rng: Random)
	local samples, total = samplePolyline(pts, 2)
	local runs = {}
	local cur = nil
	local hw = path.width / 2
	for i, smp in samples do
		local p = smp.p
		local nxt = samples[math.min(#samples, i + 1)].p
		local prv = samples[math.max(1, i - 1)].p
		local dir = Util.flat(nxt - prv)
		local right = dir.Magnitude > 0.01 and Vector3.new(-dir.Unit.Z, 0, dir.Unit.X) or Vector3.xAxis
		local g = Field.groundTop(p.X, p.Z, p.Y)
		local gap = g < p.Y - 2.5
		local nearVertex = false
		for _, v in pts do
			if Util.flat(v - p).Magnitude < hw + 2 then
				nearVertex = true
				break
			end
		end
		-- the edges matter too: a diagonal crossing leaves corners over the bank
		for _, sd in (nearVertex and {} or { -1, 1 }) do
			local q = p + right * sd * (hw - 1.5)
			if Field.groundTop(q.X, q.Z, p.Y) < p.Y - 2.5 then
				gap = true
			end
		end
		if gap then
			if not cur then
				cur = { s0 = smp.s, s1 = smp.s, minG = g, water = -1e9 }
			end
			cur.s1 = smp.s
			cur.minG = math.min(cur.minG, g)
			local w = Field.sample(p.X, p.Z).water
			cur.water = math.max(cur.water, w)
		elseif cur then
			table.insert(runs, cur)
			cur = nil
		end
	end
	if cur then
		table.insert(runs, cur)
	end
	local style = path.biome
	for _, r in runs do
		if r.s1 - r.s0 < 3 then
			continue
		end
		local s0 = math.max(0, r.s0 - 8)
		local s1 = math.min(total, r.s1 + 8)
		local sub = slice(pts, s0, s1)
		local mid = sub[math.max(1, math.floor(#sub / 2))]
		local parent = Parts.folder(regionFor(ctx, style, mid), "Bridges")
		local bstyle = style
		if (style == "meadow") and Util.flat(mid).Magnitude < 330 then
			bstyle = "hub"
		end
		local model
		if path.crossing == "stones" and r.water > r.minG then
			model = Structures.steppingStones(parent, sub, path.width, rng)
		else
			model = Structures.bridge(parent, sub, math.max(24, path.width), bstyle, rng)
		end
		model.Name = path.id .. "_" .. model.Name
		-- clearance of the deck above any water it crosses
		local minClear = math.huge
		for _, smp in samplePolyline(slice(pts, r.s0, r.s1), 4) do
			local w = Field.sample(smp.p.X, smp.p.Z).water
			if w > -1e8 then
				minClear = math.min(minClear, smp.p.Y - w)
			end
		end
		table.insert(Network.bridges, { path = path.id, a = sub[1], b = sub[#sub], length = s1 - s0, water = r.water, minClear = minClear, model = model })
	end
end

----------------------------------------------------------------------
-- lanterns, fences and edge dressing along paths
----------------------------------------------------------------------
local function nearReserve(x: number, z: number, pad: number): boolean
	for _, r in Field.reserves do
		if r.kind ~= "water" then
			local dx, dz = x - r.x, z - r.z
			if dx * dx + dz * dz < (r.r + pad) ^ 2 then
				return true
			end
		end
	end
	return false
end

local function onAnyPath(x: number, z: number, pad: number, except): boolean
	for _, s in Field.pathSegs do
		if s.path ~= except and (Util.segDist(x, z, s.ax, s.az, s.bx, s.bz)) < s.hw + pad then
			return true
		end
	end
	return false
end
Network.onAnyPath = onAnyPath

local function dressPath(ctx, path, pts: { Vector3 }, rng: Random)
	local samples, total = samplePolyline(pts, 4)
	local style = path.biome
	local lanternStyle = style
	local hw = path.width / 2
	local nextLantern = 24
	local side = 1
	local lanternCount = 0
	local fenceRun = nil
	local function flushFence(parent)
		if fenceRun and #fenceRun >= 2 then
			local fc = style == "candy" and Palette.candyCream or (style == "volcano" and Palette.basaltLight or (style == "snow" and Palette.paleStone or Palette.woodLight))
			local fm = (style == "candy" or style == "snow") and M.SmoothPlastic or (style == "volcano" and M.Slate or M.Wood)
			for i = 1, #fenceRun - 1 do
				Props.fence(parent, fenceRun[i], fenceRun[i + 1], fc, fm, 8)
			end
		end
		fenceRun = nil
	end
	local lastParent = nil
	for i, smp in samples do
		local p = smp.p
		local nxt = samples[math.min(#samples, i + 1)].p
		local prv = samples[math.max(1, i - 1)].p
		local dir = Util.flat(nxt - prv)
		if dir.Magnitude < 0.01 then
			continue
		end
		dir = dir.Unit
		local right = Vector3.new(-dir.Z, 0, dir.X)
		local ground = Field.groundTop(p.X, p.Z, p.Y)
		local onGround = math.abs(ground - p.Y) < 3
		local parent = Parts.folder(regionFor(ctx, style == "hub" and "meadow" or style, p), "PathDressing")
		lastParent = parent
		-- lanterns
		if smp.s >= nextLantern and smp.s < total - 10 and onGround then
			local lp = p + right * side * (hw + 3.5)
			local lg = Field.groundTop(lp.X, lp.Z, p.Y + 4)
			if math.abs(lg - p.Y) < 3.5 and not nearReserve(lp.X, lp.Z, 6) and not onAnyPath(lp.X, lp.Z, 1.5, path) then
				lanternCount += 1
				Props.lantern(parent, Vector3.new(lp.X, lg - 0.4, lp.Z), lanternStyle, lanternCount % 2 == 1)
				side = -side
				nextLantern = smp.s + 70
			else
				nextLantern = smp.s + 8
			end
		end
		-- fences along sharp drop-offs beside the path (a functional barrier)
		if onGround and path.kind ~= "cave" then
			local edgeSide = nil
			for _, sd in { 1, -1 } do
				local q = p + right * sd * (hw + 5)
				local qg = Field.groundTop(q.X, q.Z, p.Y)
				if qg < p.Y - 7 and not onAnyPath(q.X, q.Z, 0, nil) then
					edgeSide = sd
				end
			end
			if edgeSide and smp.s > 6 and smp.s < total - 6 then
				local fp = p + right * edgeSide * (hw + 1.2)
				local fg = Field.groundTop(fp.X, fp.Z, p.Y + 2)
				fenceRun = fenceRun or {}
				table.insert(fenceRun, Vector3.new(fp.X, fg - 0.3, fp.Z))
			else
				flushFence(parent)
			end
		else
			flushFence(parent)
		end
		-- small edge dressing: stones, flowers, grass tufts (never on the walk surface)
		if onGround and rng:NextNumber() < 0.22 and (i % 3 == 0) then
			local sd = rng:NextNumber() < 0.5 and -1 or 1
			local q = p + right * sd * (hw + rng:NextNumber(1.5, 6))
			if not onAnyPath(q.X, q.Z, 0.5, nil) and not nearReserve(q.X, q.Z, 2) then
				local qg = Field.groundTop(q.X, q.Z, p.Y + 3)
				local qp = Vector3.new(q.X, qg - 0.2, q.Z)
				if style == "meadow" or style == "hub" or style == "sky" then
					if rng:NextNumber() < 0.5 then
						Veg.flowers(parent, qp, rng)
					else
						Props.rock(parent, qp, rng:NextNumber(1.5, 3), rng, Palette.stone)
					end
				elseif style == "jungle" then
					Veg.fern(parent, qp, rng:NextNumber(4, 7), rng)
				elseif style == "candy" then
					Props.gumdrop(parent, qp, rng:NextNumber(1.8, 3.2), ({ Palette.candyHot, Palette.candyTurq, Palette.candyMint, Palette.mushroomLilac })[rng:NextInteger(1, 4)])
				elseif style == "volcano" then
					Props.rock(parent, qp, rng:NextNumber(1.5, 3.5), rng, Palette.basaltLight, M.Basalt)
				elseif style == "snow" then
					Props.rock(parent, qp, rng:NextNumber(1.5, 3), rng, Palette.snowWhite, M.Snow)
				end
			end
		end
	end
	if lastParent then
		flushFence(lastParent)
	end
end

----------------------------------------------------------------------
-- caves
----------------------------------------------------------------------
local CAVE_LIGHT = { meadow = Palette.lanternGlow, volcano = Palette.purpleCrystal, snow = Palette.iceCrystal }
local CAVE_CRYSTAL = { meadow = Palette.mushroomLilac, volcano = Palette.purpleCrystal, snow = Palette.iceCrystal }

local function buildCave(ctx, path, pts: { Vector3 }, rng: Random)
	local mouth, inner = pts[1], pts[#pts]
	local dir = Util.flat(inner - mouth).Unit
	local right = Vector3.new(-dir.Z, 0, dir.X)
	local style = path.biome
	local region = ctx.region(REGION_OF[style])
	local m = Parts.model(Parts.folder(region, "Caves"), path.id, { ModelStreamingMode = Enum.ModelStreamingMode.Atomic })
	local hw = path.width / 2
	local cliffColor = style == "volcano" and Palette.basalt or (style == "snow" and Palette.ice or Palette.stone)
	local cliffMat = style == "volcano" and M.Basalt or (style == "snow" and M.Ice or M.Slate)
	-- faceted frame around the opening
	for k = -3, 3 do
		local a = k / 3 * math.pi / 2
		local off = right * math.sin(a) * (hw + 8) + Vector3.new(0, math.cos(a) * ((path.height or 24) + 5), 0)
		local p = mouth + off - dir * 2
		local cf = CFrame.lookAt(p, p + dir) * CFrame.Angles(0, 0, a + rng:NextNumber(-0.2, 0.2))
		Parts.block(m, cf, Vector3.new(7 + rng:NextNumber(0, 3), 6 + rng:NextNumber(0, 3), 8), Util.vary(cliffColor, rng, 0.04), cliffMat, { name = "CaveFrame" })
	end
	-- lights & crystals inside, lanterns at the mouth
	local len = (inner - mouth).Magnitude
	for k = 1, math.max(1, math.floor(len / 30)) do
		local p = mouth:Lerp(inner, k / (math.floor(len / 30) + 1))
		for _, sd in { -1, 1 } do
			Props.crystal(m, p + right * sd * (hw + 1) + Vector3.new(0, 1.5, 0), rng:NextNumber(4, 7), rng, CAVE_CRYSTAL[style], sd == 1)
		end
	end
	for i = 1, 7 do
		-- ring around the chamber, skipping the side the tunnel enters from
		local a = math.atan2(-dir.Z, -dir.X) + math.rad(60 + (i - 1) * 40)
		Props.crystal(m, inner + Vector3.new(math.cos(a), 0, math.sin(a)) * ((path.chamber or 24) - 3) + Vector3.new(0, 0.5, 0), rng:NextNumber(7, 13), rng, CAVE_CRYSTAL[style], i % 2 == 0)
	end
	for _, sd in { -1, 1 } do
		local p = mouth + right * sd * (hw + 6) - dir * 6
		local g = Field.groundTop(p.X, p.Z, mouth.Y + 4)
		if style == "volcano" then
			Props.brazier(m, Vector3.new(p.X, g - 0.4, p.Z), true)
		else
			Props.torch(m, Vector3.new(p.X, g - 0.4, p.Z), true)
		end
	end
	local glow = Parts.block(m, CFrame.new(inner + Vector3.new(0, 14, 0)), Vector3.new(1, 1, 1), CAVE_LIGHT[style] or Palette.lanternGlow, M.Neon, { decor = true, transparency = 1, name = "ChamberLight" })
	Parts.light(glow, "PointLight", { Color = CAVE_LIGHT[style] or Palette.lanternGlow, Brightness = 1.4, Range = 40, Shadows = false })
end

----------------------------------------------------------------------
-- rivers, waterfalls and lava
----------------------------------------------------------------------
local function buildRivers(ctx, rng: Random)
	for _, river in Layout.rivers do
		local lava = river.lava
		local ns = river.nodes
		local regionName = lava and "Volcano" or nil
		for i = 1, #ns - 1 do
			local a, b = ns[i], ns[i + 1]
			local A = Vector3.new(a[1], a[3], a[2])
			local B = Vector3.new(b[1], a[3], b[2])
			local dir = Util.flat(B - A).Unit
			local s = Field.sample(B.X, B.Z)
			local region = ctx.region(regionName or ctx.regionAt(B))
			local wf = Parts.folder(region, "Waterways")
			-- waterfall at every level drop
			if b[3] ~= a[3] then
				Structures.waterfall(wf, Vector3.new(b[1], a[3] + 0.4, b[2]), dir, b[4] * 0.9, b[3] - 0.5, lava and "lava" or "water", rng)
				-- faceted rocks flanking the fall
				local right = Vector3.new(-dir.Z, 0, dir.X)
				for _, sd in { -1, 1 } do
					local p = Vector3.new(b[1], 0, b[2]) + right * sd * (b[4] / 2 + 6)
					local top = a[3] + 4
					Structures.cliffFacet(wf, p, dir, b[3] - 2, top, 14, lava and Palette.basalt or Palette.stone, lava and M.Basalt or M.Slate, rng)
				end
			end
			if lava then
				local len = (B - A).Magnitude
				local hw = (a[4] + b[4]) / 4
				local cf = CFrame.lookAt(A, B) * CFrame.new(0, -1, -len / 2)
				local surf = Parts.block(wf, cf, Vector3.new(hw * 1.9, 2, len + hw), Palette.lava, M.Neon, { name = "LavaSurface", shadow = false })
				surf:SetAttribute("Decorative", true) -- visual only: never wired to damage here
				-- dark crust plates drifting on the surface
				for _ = 1, math.floor(len / 22) do
					Parts.block(wf, cf * CFrame.new(rng:NextNumber(-hw * 0.6, hw * 0.6), 1.1, rng:NextNumber(-len / 2, len / 2)) * CFrame.Angles(0, rng:NextNumber(0, 6.28), 0), Vector3.new(rng:NextNumber(3, 7), 0.6, rng:NextNumber(3, 7)), Palette.basalt, M.Basalt, { decor = true, name = "Crust" })
				end
				for k = 1, math.max(1, math.floor(len / 90)) do
					local lp = A:Lerp(B, k / (math.floor(len / 90) + 1)) + Vector3.new(0, 4, 0)
					local holder = Parts.block(wf, CFrame.new(lp), Vector3.new(1, 1, 1), Palette.lava, M.Neon, { decor = true, transparency = 1, name = "LavaLight" })
					Parts.light(holder, "PointLight", { Color = Palette.ember, Brightness = 1.8, Range = 45, Shadows = false })
					if k % 2 == 1 then
						Parts.emitter(holder, {
							Texture = Structures.SPARK, Rate = 2, Lifetime = NumberRange.new(2.5, 4), Speed = NumberRange.new(2, 5),
							SpreadAngle = Vector2.new(40, 40), Acceleration = Vector3.new(0, 1.5, 0), LightEmission = 1,
							Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.5), NumberSequenceKeypoint.new(1, 0.1) }),
							Color = ColorSequence.new(Palette.ember), EmissionDirection = Enum.NormalId.Top,
						})
					end
				end
				-- safe boundary: chunky basalt curb on both banks except where a bridge crosses
				local right = Vector3.new(-dir.Z, 0, dir.X)
				for k = 0, math.floor(len / 10) do
					local c = A:Lerp(B, k / math.max(1, math.floor(len / 10)))
					for _, sd in { -1, 1 } do
						local off = hw + 4
						local q = c + right * sd * off
						-- move outward until we reach the top of the bank
						local g = Field.height(q.X, q.Z)
						for _ = 1, 8 do
							if g > a[3] + 6 then
								break
							end
							off += 3
							q = c + right * sd * off
							g = Field.height(q.X, q.Z)
						end
						if not onAnyPath(q.X, q.Z, 5, nil) then
							Parts.block(wf, CFrame.lookAt(Vector3.new(q.X, g + 1.2, q.Z), Vector3.new(q.X, g + 1.2, q.Z) + dir) * CFrame.Angles(0, rng:NextNumber(-0.1, 0.1), 0), Vector3.new(4, 3.4 + rng:NextNumber(0, 1), 9.5), Util.vary(Palette.basaltLight, rng, 0.04), M.Basalt, { name = "LavaCurb" })
						end
					end
				end
				-- hazard volume for a future damage system (inert in this build)
				local hz = Parts.block(ctx.markers("Hazards"), cf * CFrame.new(0, 3, 0), Vector3.new(hw * 2, 6, len + hw), Palette.lava, M.SmoothPlastic, { noCollide = true, name = "LavaHazardVolume" })
				hz.Transparency = 1
				hz.CanQuery = false
				hz:SetAttribute("HazardType", "Lava")
			end
		end
		-- spring: if the source sits under higher ground, pour it out of the cliff
		local a, b = ns[1], ns[2]
		local A = Vector3.new(a[1], a[3], a[2])
		local dir = Util.flat(Vector3.new(b[1], 0, b[2]) - Vector3.new(a[1], 0, a[2])).Unit
		local behind = A - dir * (a[4] / 2 + 14)
		local hb = Field.height(behind.X, behind.Z)
		if hb > a[3] + 10 then
			local region = ctx.region(regionName or ctx.regionAt(A))
			Structures.waterfall(Parts.folder(region, "Waterways"), Vector3.new(behind.X, hb - 1, behind.Z) + dir * 4, dir, a[4] * 0.8, a[3] - 0.5, lava and "lava" or "water", rng)
		end
	end
	-- lava pools
	for _, f in Layout.features do
		if f.kind == "lake" and f.lava then
			local wf = Parts.folder(ctx.region("Volcano"), "Waterways")
			local c = Vector3.new(f.c[1], f.level - 1, f.c[2])
			local p = Parts.cyl(wf, c, 2, (f.r[1] + f.r[2]) * 1.02, Palette.lava, M.Neon, { name = "LavaSurface", shadow = false })
			p:SetAttribute("Decorative", true)
			local holder = Parts.block(wf, CFrame.new(c + Vector3.new(0, 6, 0)), Vector3.new(1, 1, 1), Palette.lava, M.Neon, { decor = true, transparency = 1, name = "LavaLight" })
			Parts.light(holder, "PointLight", { Color = Palette.ember, Brightness = 2, Range = 55, Shadows = false })
			for k = 0, 17 do
				local a = k / 18 * math.pi * 2
				local q = Vector3.new(f.c[1] + math.cos(a) * (f.r[1] + 12), 0, f.c[2] + math.sin(a) * (f.r[2] + 12))
				local g = Field.height(q.X, q.Z)
				if not onAnyPath(q.X, q.Z, 4, nil) then
					Parts.block(wf, CFrame.lookAt(Vector3.new(q.X, g + 1.2, q.Z), Vector3.new(f.c[1], g + 1.2, f.c[2])), Vector3.new(10, 3.4, 4), Util.vary(Palette.basaltLight, rng, 0.04), M.Basalt, { name = "LavaCurb" })
				end
			end
			local hz = Parts.cyl(ctx.markers("Hazards"), c + Vector3.new(0, 3, 0), 6, (f.r[1] + f.r[2]), Palette.lava, M.SmoothPlastic, { noCollide = true, name = "LavaHazardVolume" })
			hz.Transparency = 1
			hz.CanQuery = false
			hz:SetAttribute("HazardType", "Lava")
		end
	end
end

----------------------------------------------------------------------
-- entry point
----------------------------------------------------------------------
function Network.build(ctx)
	table.clear(Network.bridges)
	table.clear(Network.walkways)
	local rng = Random.new(Layout.SEED + 7)
	for _, path in Layout.paths do
		local pts = pathPoints(path)
		local kind = path.kind or "path"
		if kind ~= "struct" then
			table.insert(Network.walkways, { name = path.id, pts = pts, width = path.width, kind = kind })
		end
		if kind == "path" then
			buildGaps(ctx, path, pts, rng)
			dressPath(ctx, path, pts, rng)
		elseif kind == "stairs" then
			local st = STAIR_STYLE[path.biome] or STAIR_STYLE.meadow
			local parent = Parts.folder(ctx.region(REGION_OF[path.biome]), "Stairs")
			local o = table.clone(st)
			o.name = path.id
			o.grounded = true
			Structures.stairs(parent, pts[1], pts[2], path.width, o)
		elseif kind == "cave" then
			buildCave(ctx, path, pts, rng)
		elseif kind == "sky" then
			buildGaps(ctx, path, pts, rng)
		elseif kind == "skystairs" or kind == "struct" then
			local parent = Parts.folder(ctx.region("SkyIslands"), kind == "struct" and "CelestialStair" or "TempleStairway")
			local st = STAIR_STYLE.sky
			for i = 1, #pts - 1 do
				local a, b = pts[i], pts[i + 1]
				if math.abs(b.Y - a.Y) > 2 then
					local o = table.clone(st)
					o.name = path.id .. "_Flight" .. i
					o.grounded = false
					Structures.stairs(parent, a, b, path.width, o)
					if kind == "struct" then
						table.insert(Network.walkways, { name = o.name, pts = { a, b }, width = path.width, kind = "struct" })
					end
					-- supports and an arch-like underside for long flights
					local flat = Util.flat(b - a)
					local right = Vector3.new(-flat.Unit.Z, 0, flat.Unit.X)
					local n = math.max(1, math.floor(flat.Magnitude / 40))
					for k = 0, n do
						local p = a:Lerp(b, k / n)
						for _, sd in { -1, 1 } do
							Structures.supportColumn(parent, p + right * sd * (path.width / 2 - 2), p.Y - 4.5, 3.4, Palette.white, Palette.gold)
						end
					end
				elseif kind == "struct" then
					-- Landing beside the flights: its inner edge is the line the flights end on,
					-- so each flight top meets the landing flush (no lip).
					local fw = path.width / 2
					local w = path.width + 6
					local dirv = Util.flat(b - a).Unit
					local right = Vector3.new(-dirv.Z, 0, dirv.X)
					local prev, nxt = pts[i - 1], pts[i + 2]
					local inner = 1
					if prev then
						inner = Util.flat(prev - a):Dot(right) > 0 and 1 or -1
					end
					local out = -right * inner
					local la = a - dirv * fw + out * (w / 2)
					local lb = (nxt and (b + dirv * fw) or (b + dirv * 10)) + out * (w / 2)
					Structures.landing(parent, la, lb, w, { name = path.id .. "_Landing" .. i })
					-- audit the walkable interior (end caps are barriers by design)
					local inset = Util.flat(lb - la).Unit * 2.5
					table.insert(Network.walkways, { name = path.id .. "_Landing" .. i, pts = { la + inset, lb - inset }, width = w - 2, kind = "struct" })
					for _, p in { la + out * (w / 2 - 3), lb + out * (w / 2 - 3) } do
						Structures.supportColumn(parent, p, p.Y - 3.8, 5, Palette.white, Palette.gold)
					end
					local function rail(p: Vector3, q: Vector3)
						Parts.span(parent, p + Vector3.new(0, 1.6, 0), q + Vector3.new(0, 1.6, 0), 1.4, 3.2, Palette.white, M.Marble, { name = "Balustrade" })
					end
					local edgeOut = out * (w - 0.8)
					local edgeIn = out * 0.8
					-- outer side, full length
					rail(a - dirv * fw + edgeOut, (nxt and (b + dirv * fw) or (b + dirv * 10)) + edgeOut)
					-- inner side between the two flights (or to the end of the last walkway)
					local p0 = a + dirv * fw
					local p1 = nxt and (b - dirv * fw) or (b + dirv * 10)
					if (p1 - p0):Dot(dirv) > 1 then
						rail(p0 + edgeIn, p1 + edgeIn)
					end
					-- end caps
					rail(a - dirv * fw + edgeIn, a - dirv * fw + edgeOut)
					if nxt then
						rail(b + dirv * fw + edgeIn, b + dirv * fw + edgeOut)
					end
				else
					buildGaps(ctx, { id = path.id, biome = "sky", width = path.width, kind = "sky" }, { a, b }, rng)
				end
			end
		end
	end
	buildRivers(ctx, rng)
end

return Network
