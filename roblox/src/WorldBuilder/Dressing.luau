-- Large-form dressing that gives the terrain the faceted low-poly look of the references:
--   * rock facets around every terrace marked cliff = true
--   * frosting lips and drips on candy cliffs
--   * faceted rims and hanging rock under the floating islands

local Util = require(script.Parent.Util)
local Layout = require(script.Parent.Layout)
local Field = require(script.Parent.Field)
local Parts = require(script.Parent.Parts)
local Palette = require(script.Parent.Palette)
local Structures = require(script.Parent.Assets.Structures)

local M = Enum.Material
local Dressing = {}

local CLIFF = {
	[1] = { Palette.stone, M.Slate }, [2] = { Palette.stone, M.Slate },
	[3] = { Color3.fromRGB(104, 114, 98), M.Slate },
	[4] = { Color3.fromRGB(236, 146, 176), M.SmoothPlastic },
	[5] = { Color3.fromRGB(76, 60, 56), M.Basalt },
	[6] = { Color3.fromRGB(150, 208, 240), M.Ice },
	[7] = { Palette.stone, M.Slate },
	[8] = { Palette.stone, M.Slate },
}

local function blocked(x: number, z: number, ignoreRivers: boolean?): boolean
	for _, s in Field.pathSegs do
		if (Util.segDist(x, z, s.ax, s.az, s.bx, s.bz)) < s.hw + 7 then
			return true
		end
	end
	if not ignoreRivers then
		for _, s in Field.riverSegs do
			if (Util.segDist(x, z, s.ax, s.az, s.bx, s.bz)) < math.max(s.hwa, s.hwb) + 6 then
				return true
			end
		end
	end
	for _, r in Field.reserves do
		if r.kind ~= "water" then
			local dx, dz = x - r.x, z - r.z
			if dx * dx + dz * dz < (r.r + 4) ^ 2 then
				return true
			end
		end
	end
	return false
end

-- Walk the rim of a terrace and dress it.
local function dressCliff(ctx, f, rng: Random)
	local cx, cz = f.c[1], f.c[2]
	local perim = math.pi * (f.r[1] + f.r[2])
	local n = math.floor(perim / 17)
	local region = ctx.region(ctx.regionAt(Vector3.new(cx, f.h, cz)))
	local folder = Parts.folder(region, "Cliffs")
	local model = Parts.model(folder, f.name .. "Cliffs")
	for i = 0, n - 1 do
		local a = (i + rng:NextNumber(-0.25, 0.25)) / n * math.pi * 2
		local ux, uz = math.cos(a), math.sin(a)
		local ellR = 1 / math.sqrt((ux / f.r[1]) ^ 2 + (uz / f.r[2]) ^ 2)
		-- march outwards to find the rim (last point still near terrace height)
		local rimR, rimH = nil, nil
		local r = ellR * 0.7
		while r < ellR + f.edge + (f.outline or 0) + 30 do
			local h = Field.height(cx + ux * r, cz + uz * r)
			if h < f.h - 5 then
				break
			end
			rimR, rimH = r, h
			r += 3
		end
		if not rimR then
			continue
		end
		-- find the foot of the drop
		local footR, footH = rimR, rimH
		for k = 1, 16 do
			local rr = rimR + k * 3
			local h = Field.height(cx + ux * rr, cz + uz * rr)
			if h > footH - 0.8 and k > 2 then
				break
			end
			footR, footH = rr, h
		end
		local drop = rimH - footH
		if drop < 7 then
			continue
		end
		local midR = (rimR + footR) / 2
		local mx, mz = cx + ux * midR, cz + uz * midR
		if blocked(mx, mz) or blocked(cx + ux * rimR, cz + uz * rimR) then
			continue
		end
		local biome = Field.sample(mx, mz).biome
		local style = CLIFF[biome] or CLIFF[1]
		local outward = Vector3.new(ux, 0, uz)
		local color = style[1]
		if f.frosting then
			color = CLIFF[4][1]
		end
		Structures.cliffFacet(model, Vector3.new(mx, 0, mz), outward, footH - 4, rimH - 1.6, rng:NextNumber(15, 24), color, f.frosting and M.SmoothPlastic or style[2], rng)
		if f.frosting then
			Structures.frosting(model, Vector3.new(cx + ux * (rimR + 1), rimH + 0.6, cz + uz * (rimR + 1)), outward, rng:NextNumber(12, 18), rng)
		end
		-- a few boulders at the foot
		if rng:NextNumber() < 0.25 then
			local bx, bz = cx + ux * (footR + 6), cz + uz * (footR + 6)
			if not blocked(bx, bz) then
				local g = Field.height(bx, bz)
				Parts.block(model, CFrame.new(bx, g + 2, bz) * CFrame.Angles(rng:NextNumber(-0.4, 0.4), rng:NextNumber(0, 6), rng:NextNumber(-0.4, 0.4)), Vector3.new(7, 5, 6) * rng:NextNumber(0.8, 1.5), Util.vary(color, rng, 0.05), f.frosting and M.SmoothPlastic or style[2], { name = "Boulder" })
			end
		end
		Util.breathe()
	end
end

local function dressIsland(ctx, isl, rng: Random)
	local folder = Parts.folder(ctx.region("SkyIslands"), "IslandRock")
	local model = Parts.model(folder, isl.name .. "Rock", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic })
	local rock = Color3.fromRGB(150, 146, 140)
	local n = math.floor(math.pi * 2 * isl.r / 20)
	for i = 0, n - 1 do
		local a = (i + rng:NextNumber(-0.2, 0.2)) / n * math.pi * 2
		local ux, uz = math.cos(a), math.sin(a)
		-- find the island edge along this bearing
		local edgeR = nil
		for r = isl.r * 0.8, isl.r * 1.15, 2 do
			if not Field.island(isl.c[1] + ux * r, isl.c[2] + uz * r) then
				break
			end
			edgeR = r
		end
		local nearRoute = false
		if edgeR then
			local ex, ez = isl.c[1] + ux * edgeR, isl.c[2] + uz * edgeR
			for _, sg in Field.pathSegs do
				if (sg.kind == "sky" or sg.kind == "skystairs" or sg.kind == "struct") and (Util.segDist(ex, ez, sg.ax, sg.az, sg.bx, sg.bz)) < sg.hw + 10 then
					nearRoute = true
				end
			end
		end
		if edgeR and not nearRoute then
			local x, z = isl.c[1] + ux * (edgeR - 2), isl.c[2] + uz * (edgeR - 2)
			local s = Field.island(x, z)
			if s then
				local h = rng:NextNumber(14, 26)
				local cf = Util.facing(Vector3.new(x, s.top - 2.5 - h / 2, z), Vector3.new(ux, 0, uz)) * CFrame.Angles(math.rad(rng:NextNumber(4, 12)), rng:NextNumber(-0.2, 0.2), 0)
				Parts.block(model, cf, Vector3.new(rng:NextNumber(12, 20), h, 9), Util.vary(rock, rng, 0.04), M.Slate, { name = "RimFacet" })
			end
		end
	end
	-- hanging rock spikes underneath
	local spikes = isl.decor and 6 or 26
	for _ = 1, spikes do
		local a = rng:NextNumber(0, 6.28)
		local r = math.sqrt(rng:NextNumber()) * isl.r * 0.75
		local x, z = isl.c[1] + math.cos(a) * r, isl.c[2] + math.sin(a) * r
		local s = Field.island(x, z)
		if s then
			local len = rng:NextNumber(14, 36) * (isl.decor and 0.6 or 1)
			local w = len * rng:NextNumber(0.35, 0.55)
			Parts.block(model, CFrame.new(x, s.bottom - len * 0.32, z) * CFrame.Angles(0, rng:NextNumber(0, 6.28), 0) * CFrame.Angles(math.rad(45), 0, math.rad(45)), Vector3.new(w, len, w), Util.vary(Color3.fromRGB(128, 122, 116), rng, 0.05), M.Slate, { decor = true, shadow = true, name = "Underside" })
		end
	end
end

-- Grey faceted rock walls along river gorges (the overview's rivers run between cliffs).
local function dressRiverBanks(ctx, rng: Random)
	for _, river in Layout.rivers do
		if river.lava then
			continue
		end
		local ns = river.nodes
		for i = 1, #ns - 1 do
			local a, b = ns[i], ns[i + 1]
			local level = a[3]
			local A = Vector3.new(a[1], 0, a[2])
			local Bv = Vector3.new(b[1], 0, b[2])
			local len = (Bv - A).Magnitude
			local dir = (Bv - A).Unit
			local right = Vector3.new(-dir.Z, 0, dir.X)
			local n = math.floor(len / 19)
			for k = 1, n - 1 do
				local c = A:Lerp(Bv, k / n)
				local hw = (a[4] + (b[4] - a[4]) * k / n) / 2
				for _, sd in { -1, 1 } do
					-- march out from the water's edge to the top of the bank
					local inner = c + right * sd * (hw + 1)
					local top, topR = nil, nil
					for r = hw + 2, hw + 40, 3 do
						local q = c + right * sd * r
						local h = Field.height(q.X, q.Z)
						if h > level + 9 then
							top, topR = h, r
							break
						end
					end
					if top and topR then
						local mid = c + right * sd * ((hw + topR) / 2 + 2)
						if not blocked(mid.X, mid.Z, true) and not blocked(inner.X, inner.Z, true) then
							local biome = Field.sample(mid.X, mid.Z).biome
							local style = CLIFF[biome] or CLIFF[1]
							local region = ctx.region(ctx.regionAt(Vector3.new(mid.X, top, mid.Z)))
							local folder = Parts.folder(Parts.folder(region, "Cliffs"), river.name .. "Banks")
							Structures.cliffFacet(folder, mid, -right * sd, level - 3, top - 1.4, rng:NextNumber(14, 22), style[1], style[2], rng)
						end
					end
				end
			end
			Util.breathe()
		end
	end
end

function Dressing.build(ctx)
	local rng = Random.new(Layout.SEED + 31)
	dressRiverBanks(ctx, rng)
	for _, f in Layout.features do
		if f.kind == "blob" and f.cliff then
			dressCliff(ctx, f, rng)
		end
	end
	for _, isl in Layout.islands do
		dressIsland(ctx, isl, rng)
	end
end

return Dressing
