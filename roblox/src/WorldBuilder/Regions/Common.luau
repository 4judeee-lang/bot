-- Shared helpers for region builders: Poisson-style scatter that respects paths,
-- rivers, clearings and pavilions, plus clearing creature placement.

local Util = require(script.Parent.Parent.Util)
local Field = require(script.Parent.Parent.Field)
local Layout = require(script.Parent.Parent.Layout)
local Parts = require(script.Parent.Parent.Parts)
local Creatures = require(script.Parent.Parent.Assets.Creatures)

local Common = {}

-- opts: c = {x, z}, r = {rx, rz} (ellipse) | box = {x0, z0, x1, z1}
--       count, minDist, pad (path/reserve clearance), slopeMax, hMin, hMax,
--       biome (required biome id or list), island (bool: place on islands), place(pos, rng, i)
function Common.scatter(opts, rng: Random): number
	local placed = {}
	local grid = {}
	local cell = math.max(4, opts.minDist or 10)
	local function tooClose(x: number, z: number): boolean
		local gx, gz = math.floor(x / cell), math.floor(z / cell)
		for ix = gx - 1, gx + 1 do
			for iz = gz - 1, gz + 1 do
				local list = grid[ix * 100003 + iz]
				if list then
					for _, p in list do
						if (p.X - x) ^ 2 + (p.Z - z) ^ 2 < cell * cell then
							return true
						end
					end
				end
			end
		end
		return false
	end
	local biomes = opts.biome
	if typeof(biomes) == "number" then
		biomes = { biomes }
	end
	local attempts = 0
	local count = 0
	while count < opts.count and attempts < opts.count * 14 do
		attempts += 1
		local x, z
		if opts.box then
			x = rng:NextNumber(opts.box[1], opts.box[3])
			z = rng:NextNumber(opts.box[2], opts.box[4])
		else
			local a = rng:NextNumber(0, math.pi * 2)
			local r = math.sqrt(rng:NextNumber())
			x = opts.c[1] + math.cos(a) * r * opts.r[1]
			z = opts.c[2] + math.sin(a) * r * opts.r[2]
		end
		if tooClose(x, z) then
			continue
		end
		if not Field.isFree(x, z, opts.pad or 6) then
			continue
		end
		local y
		if opts.island then
			local s = Field.island(x, z)
			if not s or s.pool or s.path > 0 or s.edge > 0.9 then
				continue
			end
			y = s.top
		else
			local s = Field.sample(x, z)
			if s.water > s.h - 0.5 or s.path > 0 or s.caveFloor then
				continue
			end
			if biomes and not table.find(biomes, s.biome) then
				continue
			end
			if Field.island(x, z) then
				continue
			end
			y = s.h
			if (opts.hMin and y < opts.hMin) or (opts.hMax and y > opts.hMax) then
				continue
			end
			if Field.slope(x, z) > (opts.slopeMax or 0.45) then
				continue
			end
		end
		local p = Vector3.new(x, y - 0.4, z)
		local gx, gz = math.floor(x / cell), math.floor(z / cell)
		local k = gx * 100003 + gz
		grid[k] = grid[k] or {}
		table.insert(grid[k], p)
		count += 1
		table.insert(placed, p)
		opts.place(p, rng, count)
		Util.breathe()
	end
	return count
end

-- Ring of creatures around a clearing edge, all facing the open centre.
function Common.clearingCreatures(parent: Instance, clearingName: string, species: { string }, rng: Random, scale: number?)
	local c
	for _, cl in Layout.clearings do
		if cl.name == clearingName then
			c = cl
		end
	end
	assert(c, "unknown clearing " .. clearingName)
	local folder = Parts.folder(parent, "Creatures")
	local n = #species
	local start = rng:NextNumber(0, 6.28)
	for i, sp in species do
		for attempt = 0, 8 do
			local a = start + (i - 1) / n * math.pi * 2 + attempt * 0.35
			local r = c.r * rng:NextNumber(0.72, 0.9)
			local x, z = c.c.X + math.cos(a) * r, c.c.Z + math.sin(a) * r
			local onPath = false
			for _, s in Field.pathSegs do
				if (Util.segDist(x, z, s.ax, s.az, s.bx, s.bz)) < s.hw + 6 then
					onPath = true
					break
				end
			end
			if not onPath then
				local y = Field.groundTop(x, z, c.c.Y + 6)
				local pos = Vector3.new(x, y - 0.2, z)
				local cf = CFrame.lookAt(pos, Vector3.new(c.c.X, y - 0.2, c.c.Z))
				local fn = (Creatures :: any)[sp]
				fn(folder, cf, (scale or 9) * rng:NextNumber(0.85, 1.2))
				break
			end
		end
	end
end

function Common.onPath(x: number, z: number, pad: number): boolean
	for _, s in Field.pathSegs do
		if (Util.segDist(x, z, s.ax, s.az, s.bx, s.bz)) < s.hw + pad then
			return true
		end
	end
	return false
end

-- Gateway over a path at a biome entrance (built by the caller's style function).
function Common.pathDirAt(p: Vector3): Vector3
	local best, bestD = nil, math.huge
	for _, s in Field.pathSegs do
		local d = Util.segDist(p.X, p.Z, s.ax, s.az, s.bx, s.bz)
		if d < bestD then
			bestD = d
			best = s
		end
	end
	if not best then
		return Vector3.new(0, 0, -1)
	end
	return Vector3.new(best.bx - best.ax, 0, best.bz - best.az).Unit
end

return Common
