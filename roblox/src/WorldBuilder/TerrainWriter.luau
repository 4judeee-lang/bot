-- Writes Field into Roblox smooth Terrain in 192-stud chunks.
-- Only a shell under the surface is filled (enough for cliffs and river beds),
-- which keeps the voxel count and the write time reasonable for a 3,600-stud world.

local Util = require(script.Parent.Util)
local Layout = require(script.Parent.Layout)
local Field = require(script.Parent.Field)
local Palette = require(script.Parent.Palette)

local M = Enum.Material
local TerrainWriter = {}

local RES = 4
local CH = 48 -- columns per chunk side

-- biome id -> { surface, cliff, path, bed }
local MATS = {
	[1] = { M.Grass, M.Rock, M.Pavement, M.Mud },
	[2] = { M.Grass, M.Rock, M.Pavement, M.Mud },
	[3] = { M.LeafyGrass, M.Slate, M.Cobblestone, M.Mud },
	[4] = { M.Ground, M.Sandstone, M.Salt, M.Sandstone },
	[5] = { M.Basalt, M.Concrete, M.Asphalt, M.Basalt },
	[6] = { M.Snow, M.Glacier, M.Limestone, M.Limestone },
	[7] = { M.Grass, M.Rock, M.Pavement, M.Mud },
	[8] = { M.Sand, M.Rock, M.Sand, M.Sand },
}
TerrainWriter.MATS = MATS

local function overlap(a0: number, a1: number, b0: number, b1: number): number
	local lo = math.max(a0, b0)
	local hi = math.min(a1, b1)
	return hi > lo and (hi - lo) or 0
end

function TerrainWriter.configure(terrain: Terrain)
	for name, color in Palette.terrain do
		pcall(function()
			terrain:SetMaterialColor((M :: any)[name], color)
		end)
	end
	pcall(function()
		terrain:SetMaterialColor(M.Concrete, Color3.fromRGB(84, 62, 58)) -- volcanic cliff faces
	end)
	terrain.WaterColor = Palette.water
	terrain.WaterTransparency = 0.55
	terrain.WaterReflectance = 0.35
	terrain.WaterWaveSize = 0.1
	terrain.WaterWaveSpeed = 7
	pcall(function()
		(terrain :: any).Decoration = true -- animated grass blades on Grass/LeafyGrass
	end)
end

-- Removes terrain inside the world volume only (never touches anything outside it).
function TerrainWriter.clear(terrain: Terrain)
	local half = Layout.HALF
	local step = CH * RES
	for x = -half, half - 1, step do
		for z = -half, half - 1, step do
			terrain:FillBlock(CFrame.new(x + step / 2, 380, z + step / 2), Vector3.new(step, 800, step), M.Air)
			Util.breathe()
		end
	end
end

local function writeChunk(terrain: Terrain, x0: number, z0: number, stats)
	-- sample (CH+2)^2 columns including a one-column border for slopes
	local n = CH + 2
	local H, info = table.create(n * n), table.create(n * n)
	local ymin, ymax = math.huge, -math.huge
	for i = 0, n - 1 do
		for k = 0, n - 1 do
			local x = x0 + (i - 1) * RES + RES / 2
			local z = z0 + (k - 1) * RES + RES / 2
			local s = Field.sample(x, z)
			local idx = i * n + k + 1
			H[idx] = s.h
			if i >= 1 and i <= CH and k >= 1 and k <= CH then
				local isl = Field.island(x, z)
				info[idx] = {
					water = s.water, path = s.path, bed = s.bed, lava = s.lava, nearLava = s.nearLava,
					caveFloor = s.caveFloor, caveCeil = s.caveCeil, biome = s.biome,
					iTop = isl and isl.top, iBottom = isl and isl.bottom, iPool = isl and isl.pool, iPath = isl and isl.path,
				}
				ymax = math.max(ymax, s.h, s.water, isl and (isl.pool or isl.top) or -math.huge)
				if isl then
					ymin = math.min(ymin, isl.bottom)
				end
			end
		end
	end
	-- shell bottoms need neighbour minima
	for i = 1, CH do
		for k = 1, CH do
			local idx = i * n + k + 1
			local m = math.min(H[idx - n], H[idx + n], H[idx - 1], H[idx + 1], H[idx])
			local inf = info[idx]
			inf.shell = math.min(m - 10, H[idx] - 8)
			if inf.water > H[idx] then
				inf.shell = math.min(inf.shell, H[idx] - 6)
			end
			inf.slope = math.max(math.abs(H[idx + n] - H[idx - n]), math.abs(H[idx + 1] - H[idx - 1])) / (2 * RES)
			ymin = math.min(ymin, inf.shell)
		end
	end
	ymin = math.floor(ymin / RES) * RES - RES
	ymax = math.ceil((ymax + 6) / RES) * RES
	local ny = (ymax - ymin) / RES

	local mats, occs, liqs = table.create(CH), table.create(CH), table.create(CH)
	for i = 1, CH do
		local mi, oi, li = table.create(ny), table.create(ny), table.create(ny)
		mats[i], occs[i], liqs[i] = mi, oi, li
		for j = 1, ny do
			mi[j], oi[j], li[j] = table.create(CH, M.Air), table.create(CH, 0), table.create(CH, 0)
		end
		for k = 1, CH do
			local idx = i * n + k + 1
			local h = H[idx]
			local inf = info[idx]
			local set = MATS[inf.biome] or MATS[1]
			local pathSet = inf.path > 0 and (MATS[inf.path] or set) or nil
			local steep = inf.slope > 0.95 or (inf.slope > 0.68 and Util.hash(x0 + i, z0 + k, 1) < (inf.slope - 0.68) / 0.27)
			local hashv = Util.hash(x0 + i, z0 + k, 2)
			for j = 1, ny do
				local y0 = ymin + (j - 1) * RES
				local y1 = y0 + RES
				local yc = y0 + RES / 2
				local occ, mat = 0, M.Air
				-- terrain column (optionally split by a cave)
				local g
				if inf.caveFloor and inf.caveCeil < h then
					g = overlap(inf.shell, inf.caveFloor, y0, y1) + overlap(inf.caveCeil, h, y0, y1)
				else
					g = overlap(inf.shell, h, y0, y1)
				end
				if g > 0 then
					occ = g / RES
					local depth = h - yc
					if inf.caveFloor and yc < inf.caveCeil + 3 and yc > inf.caveFloor - 6 then
						mat = (yc < inf.caveFloor + 1) and (pathSet and pathSet[3] or set[3]) or set[2]
					elseif inf.bed and depth < 7 then
						mat = inf.lava and M.CrackedLava or set[4]
					elseif steep then
						mat = set[2]
					elseif depth < 6 then
						if pathSet then
							mat = pathSet[3]
						elseif inf.nearLava and hashv < 0.55 then
							mat = M.CrackedLava
						else
							mat = set[1]
						end
					else
						mat = set[2]
					end
				end
				-- floating island body
				if inf.iTop then
					local ig = overlap(inf.iBottom, inf.iTop, y0, y1)
					if ig > 0 then
						occ = math.min(1, occ + ig / RES)
						local depth = inf.iTop - yc
						if depth < 5 then
							mat = (inf.iPath and inf.iPath > 0) and M.Pavement or (inf.iPool and M.Sand or M.Grass)
						else
							mat = M.Rock
						end
					end
				end
				-- water
				local liq = 0
				local wl = inf.water
				if inf.lava then
					wl = -1e9 -- lava is rendered with parts, never as terrain water
				end
				if wl > y0 and y1 > h - 0.5 then
					liq = Util.clamp((wl - y0) / RES, 0, 1)
				end
				if inf.iPool and inf.iPool > y0 and yc > inf.iBottom then
					liq = math.max(liq, Util.clamp((inf.iPool - y0) / RES, 0, 1))
				end
				if occ > 0 then
					mats[i][j][k] = mat
					occs[i][j][k] = occ
				end
				liqs[i][j][k] = liq
				if occ > 0 then
					stats.solid += 1
				end
			end
		end
	end

	local region = Region3.new(Vector3.new(x0, ymin, z0), Vector3.new(x0 + CH * RES, ymax, z0 + CH * RES))
	local ok, err = pcall(function()
		terrain:WriteVoxelChannels(region, RES, { SolidMaterial = mats, SolidOccupancy = occs, LiquidOccupancy = liqs })
	end)
	if not ok then
		-- Fallback for engines without WriteVoxelChannels: water only where no solid.
		stats.fallback += 1
		if stats.fallback == 1 then
			warn("[WorldBuilder] WriteVoxelChannels unavailable, using WriteVoxels: " .. tostring(err))
		end
		for i = 1, CH do
			for j = 1, ny do
				for k = 1, CH do
					if occs[i][j][k] < 0.5 and liqs[i][j][k] > 0.5 then
						mats[i][j][k] = M.Water
						occs[i][j][k] = 1
					end
				end
			end
		end
		terrain:WriteVoxels(region, RES, mats, occs)
	end
	stats.chunks += 1
	stats.voxels += CH * CH * ny
end

function TerrainWriter.write(terrain: Terrain, onProgress: ((number, number) -> ())?)
	local half = Layout.HALF
	local step = CH * RES
	local stats = { chunks = 0, voxels = 0, solid = 0, fallback = 0 }
	local total = math.ceil(2 * half / step) ^ 2
	for x0 = -half, half - 1, step do
		for z0 = -half, half - 1, step do
			writeChunk(terrain, x0, z0, stats)
			if onProgress then
				onProgress(stats.chunks, total)
			end
			Util.breathe()
		end
	end
	return stats
end

return TerrainWriter
