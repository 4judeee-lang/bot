-- Height field: turns Layout into a sampled description of the ground.
--   Field.sample(x, z)     -> surface height, water level, path/bed/lava flags, biome
--   Field.island(x, z)     -> floating island span at this column, if any
--   Field.groundTop(x,z,y) -> the walkable surface nearest below y (terrain or island)
-- The same function drives the voxel writer, prop placement, bridge detection and the audit,
-- so everything agrees on where the ground is.

local Util = require(script.Parent.Util)
local Layout = require(script.Parent.Layout)

local clamp, lerp, smoothstep, segDist, fbm = Util.clamp, Util.lerp, Util.smoothstep, Util.segDist, Util.fbm

local Field = {}

local BUCKET = 128
local feats = {} -- compiled height features, in application order
local buckets: { [number]: { any } } = {}
local islands = {}
local skySegs = {}
local caveSegs = {}
Field.pathSegs = {} -- every walkable segment (for bridges, lanterns, audit)
Field.riverSegs = {}
Field.reserves = {} -- circles that scatter must keep clear: {x, z, r}

local STYLE = { meadow = 1, hub = 2, jungle = 3, candy = 4, volcano = 5, snow = 6, sky = 7 }
Field.STYLE = STYLE

local function key(ix: number, iz: number): number
	return (ix + 1000) * 4096 + (iz + 1000)
end

local function register(f, minx: number, minz: number, maxx: number, maxz: number)
	table.insert(feats, f)
	f.order = #feats
	for ix = math.floor(minx / BUCKET), math.floor(maxx / BUCKET) do
		for iz = math.floor(minz / BUCKET), math.floor(maxz / BUCKET) do
			local k = key(ix, iz)
			local list = buckets[k]
			if not list then
				list = {}
				buckets[k] = list
			end
			table.insert(list, f)
		end
	end
end

local function node(n): Vector3
	if typeof(n) == "string" then
		local p = Layout.nodes[n]
		assert(p, "unknown path node " .. n)
		return p
	end
	return n
end
Field.node = node

----------------------------------------------------------------------
-- path profiles
----------------------------------------------------------------------
-- Where several routes meet, each one runs level for a short distance around the
-- shared node. Diverging routes therefore leave a junction at the same height
-- instead of tearing a step between their surfaces.
local profiles = {}
local junctionR: { [string]: number } = {}

local function computeJunctions()
	table.clear(junctionR)
	local uses: { [string]: number } = {}
	local widest: { [string]: number } = {}
	for _, path in Layout.paths do
		for _, n in path.nodes do
			if typeof(n) == "string" then
				uses[n] = (uses[n] or 0) + 1
				widest[n] = math.max(widest[n] or 0, path.width / 2)
			end
		end
	end
	for name, count in uses do
		if count >= 2 then
			junctionR[name] = widest[name] * 1.25
		end
	end
end

-- Polyline for a path with flat junction zones inserted (kind "path" only).
function Field.profiled(path): { Vector3 }
	local cached = profiles[path]
	if cached then
		return cached
	end
	local pts = {}
	local kind = path.kind or "path"
	for i, n in path.nodes do
		local p = node(n)
		if kind ~= "path" or i == 1 then
			table.insert(pts, p)
		else
			local prevName, prev = path.nodes[i - 1], node(path.nodes[i - 1])
			local flat = Vector3.new(p.X - prev.X, 0, p.Z - prev.Z)
			local L = flat.Magnitude
			local dir = L > 0 and flat / L or Vector3.zero
			local fa = typeof(prevName) == "string" and junctionR[prevName] or 0
			local fb = typeof(n) == "string" and junctionR[n] or 0
			if fa + fb > L * 0.5 then
				local k = L * 0.5 / (fa + fb)
				fa, fb = fa * k, fb * k
			end
			if fa > 0.5 then
				table.insert(pts, Vector3.new(prev.X + dir.X * fa, prev.Y, prev.Z + dir.Z * fa))
			end
			if fb > 0.5 then
				table.insert(pts, Vector3.new(p.X - dir.X * fb, p.Y, p.Z - dir.Z * fb))
			end
			table.insert(pts, p)
		end
	end
	profiles[path] = pts
	return pts
end

----------------------------------------------------------------------
-- compile
----------------------------------------------------------------------
local function addBlob(spec, order)
	local rot = math.rad(spec.rot or 0)
	local f = {
		t = "blob", name = spec.name, cx = spec.c[1], cz = spec.c[2], rx = spec.r[1], rz = spec.r[2],
		cos = math.cos(rot), sin = math.sin(rot), h = spec.h, edge = spec.edge or 40, mode = spec.mode or "set",
		tx = spec.tilt and spec.tilt[1] or 0, tz = spec.tilt and spec.tilt[2] or 0, roll = spec.roll or 0,
		outline = spec.outline or 0, seed = (order or 1) * 1.37, minr = math.min(spec.r[1], spec.r[2]),
	}
	local pad = math.max(f.rx, f.rz) + f.edge + f.outline + 4
	register(f, f.cx - pad, f.cz - pad, f.cx + pad, f.cz + pad)
	return f
end

local function compile()
	table.clear(profiles)
	computeJunctions()
	table.clear(feats)
	table.clear(buckets)
	table.clear(islands)
	table.clear(skySegs)
	table.clear(caveSegs)
	table.clear(Field.pathSegs)
	table.clear(Field.riverSegs)
	table.clear(Field.reserves)

	for i, spec in Layout.features do
		if spec.kind == "blob" then
			addBlob(spec, i)
		elseif spec.kind == "cone" then
			local reach = (spec.peak - 60) / spec.slope
			local f = { t = "cone", name = spec.name, cx = spec.c[1], cz = spec.c[2], peak = spec.peak, slope = spec.slope, cr = spec.crater.r, cd = spec.crater.depth }
			register(f, f.cx - reach, f.cz - reach, f.cx + reach, f.cz + reach)
		elseif spec.kind == "lake" then
			local f = { t = "lake", name = spec.name, cx = spec.c[1], cz = spec.c[2], rx = spec.r[1], rz = spec.r[2], bottom = spec.bottom, level = spec.level, lava = spec.lava, edge = 26 }
			local pad = math.max(f.rx, f.rz) * 1.4 + 30
			register(f, f.cx - pad, f.cz - pad, f.cx + pad, f.cz + pad)
			table.insert(Field.reserves, { x = f.cx, z = f.cz, r = math.max(f.rx, f.rz) + 8, kind = "water" })
		end
	end

	-- flat pads for clearings and pavilions
	for _, c in Layout.clearings do
		if not c.island then
			addBlob({ name = c.name, c = { c.c.X, c.c.Z }, r = { c.r + 6, c.r + 6 }, h = c.c.Y, edge = 30, roll = 0 }, 500)
		end
		table.insert(Field.reserves, { x = c.c.X, z = c.c.Z, r = c.r, kind = "clearing" })
	end
	for _, p in Layout.pavilions do
		if p.pad and p.pad > 0 then
			addBlob({ name = p.name, c = { p.pos.X, p.pos.Z }, r = { p.pad, p.pad }, h = p.pos.Y, edge = 26, roll = 0 }, 600)
		end
		table.insert(Field.reserves, { x = p.pos.X, z = p.pos.Z, r = (p.style == "central" and 70 or 58), kind = "pavilion" })
	end

	-- paths (cut & fill), stairs, caves, sky paint.
	-- Each path is one feature covering its whole polyline: the nearest segment decides
	-- the target height, so bends never step. Regular paths register before stairs.
	local pathFeatures = {}
	for _, path in Layout.paths do
		local kind = path.kind or "path"
		local style = STYLE[path.biome] or 1
		local hw = path.width / 2
		local pts = Field.profiled(path)
		local segs = {}
		for i = 1, #pts - 1 do
			local a, b = pts[i], pts[i + 1]
			local seg = {
				kind = kind, path = path, index = i,
				ax = a.X, az = a.Z, ah = a.Y, bx = b.X, bz = b.Z, bh = b.Y, hw = hw, style = style,
				stairs = (kind == "stairs") or ((kind == "skystairs" or kind == "struct") and math.abs(b.Y - a.Y) > 2),
			}
			table.insert(Field.pathSegs, seg)
			table.insert(segs, seg)
			if kind == "cave" then
				seg.height = path.height or 24
				seg.chamber = (i == #pts - 1) and (path.chamber or 0) or 0
				table.insert(caveSegs, seg)
			elseif kind == "sky" or kind == "skystairs" then
				table.insert(skySegs, seg)
			end
		end
		if kind == "path" or kind == "stairs" then
			local minx, minz, maxx, maxz = math.huge, math.huge, -math.huge, -math.huge
			for _, p in pts do
				minx, minz = math.min(minx, p.X), math.min(minz, p.Z)
				maxx, maxz = math.max(maxx, p.X), math.max(maxz, p.Z)
			end
			table.insert(pathFeatures, { f = { t = "path", kind = kind, segs = segs, hw = hw, style = style, id = path.id }, box = { minx, minz, maxx, maxz } })
		end
	end
	for pass = 1, 2 do
		for _, pf in pathFeatures do
			if (pass == 1) == (pf.f.kind == "path") then
				local pad = pf.f.hw + 72
				register(pf.f, pf.box[1] - pad, pf.box[2] - pad, pf.box[3] + pad, pf.box[4] + pad)
			end
		end
	end

	-- rivers & lava channels carve last so they cut through path fills (bridges span them)
	for _, r in Layout.rivers do
		local ns = r.nodes
		for i = 1, #ns - 1 do
			local a, b = ns[i], ns[i + 1]
			local prevLevel = i > 1 and ns[i - 1][3] or a[3]
			local seg = {
				t = "river", river = r, index = i, ax = a[1], az = a[2], bx = b[1], bz = b[2], level = a[3],
				hwa = a[4] / 2, hwb = b[4] / 2, depth = r.depth, bank = r.bank, lava = r.lava,
				flatA = prevLevel ~= a[3], -- a waterfall lands here: square-off the upstream cap
				flatB = b[3] ~= a[3], -- a waterfall starts here
				dropTo = b[3],
			}
			table.insert(Field.riverSegs, seg)
			local pad = math.max(seg.hwa, seg.hwb) + 90
			register(seg, math.min(a[1], b[1]) - pad, math.min(a[2], b[2]) - pad, math.max(a[1], b[1]) + pad, math.max(a[2], b[2]) + pad)
		end
	end

	for _, spec in Layout.islands do
		table.insert(islands, {
			name = spec.name, cx = spec.c[1], cz = spec.c[2], r = spec.r, h = spec.h, depth = spec.depth, decor = spec.decor,
			pool = spec.pool, seed = #islands * 2.31 + 0.5,
		})
	end
end

----------------------------------------------------------------------
-- sampling
----------------------------------------------------------------------
local cores, coreD, rivers = {}, {}, {}
local S = {
	h = 0, water = -1e9, path = 0, pathH = 0, bed = false, lava = false, caveFloor = nil, caveCeil = nil,
	biome = 1, biome2 = 1, nearLava = false,
}

local function blobSd(f, x: number, z: number): number
	local dx, dz = x - f.cx, z - f.cz
	local lx = dx * f.cos + dz * f.sin
	local lz = -dx * f.sin + dz * f.cos
	local q = math.sqrt((lx / f.rx) ^ 2 + (lz / f.rz) ^ 2)
	local sd = (q - 1) * f.minr
	if f.outline > 0 then
		sd += f.outline * fbm(x / 95, z / 95, f.seed)
	end
	return sd
end

local function biomeAt(x: number, z: number, h: number)
	local best, bestW, second, secondW = 1, -1, 1, -1
	local n = fbm(x / 70, z / 70, 9.1) * 0.28
	for _, b in Layout.biomes do
		local dx, dz = (x - b.c[1]) / b.r[1], (z - b.c[2]) / b.r[2]
		local sd = (math.sqrt(dx * dx + dz * dz) - 1) * math.min(b.r[1], b.r[2])
		local w = 1 - smoothstep(-b.edge / 2, b.edge / 2, sd) + n
		if w > bestW then
			second, secondW = best, bestW
			best, bestW = b.id, w
		elseif w > secondW then
			second, secondW = b.id, w
		end
	end
	if bestW < 0.15 then
		best = 1
	end
	return best, second
end

function Field.sample(x: number, z: number)
	-- land base: rolling lowland surrounded by sea
	local half = Layout.HALF - 100
	local d = ((math.abs(x) / half) ^ 4 + (math.abs(z) / half) ^ 4) ^ 0.25
	local landT = 1 - smoothstep(0.86, 1.0, d)
	local h = lerp(40, Layout.LOWLAND + fbm(x / 260, z / 260, 1.7) * 5, landT)
	local water = -1e9
	local path, pathH, bed, lava, nearLava = 0, 0, false, false, false
	local ncore, nriv = 0, 0

	local list = buckets[key(math.floor(x / BUCKET), math.floor(z / BUCKET))]
	if list then
		for _, f in list do
			local t = f.t
			if t == "blob" then
				local sd = blobSd(f, x, z)
				if sd < f.edge then
					local mask = 1 - smoothstep(0, f.edge, sd)
					local target = f.h + f.tx * (x - f.cx) + f.tz * (z - f.cz)
					if f.roll > 0 then
						target += f.roll * fbm(x / 140, z / 140, f.seed + 0.5)
					end
					if f.mode == "max" then
						h = lerp(h, math.max(h, target), mask)
					elseif f.mode == "min" then
						h = lerp(h, math.min(h, target), mask)
					else
						h = lerp(h, target, mask)
					end
				end
			elseif t == "cone" then
				local dx, dz = x - f.cx, z - f.cz
				local r = math.sqrt(dx * dx + dz * dz)
				local ch = f.peak - f.slope * r + fbm(x / 60, z / 60, 4.4) * 10
				if r < f.cr then
					ch = f.peak - f.cd
				elseif r < f.cr + 14 then
					ch = lerp(f.peak - f.cd, f.peak, (r - f.cr) / 14)
				end
				if ch > h then
					h = ch
				end
			elseif t == "lake" then
				local dx, dz = (x - f.cx) / f.rx, (z - f.cz) / f.rz
				local q = math.sqrt(dx * dx + dz * dz) + fbm(x / 50, z / 50, 2.2) * 0.06
				if q < 1.0 then
					local bowl = f.bottom + (f.level + 1 - f.bottom) * (q * q)
					h = math.min(h, bowl)
					water = f.level
					lava = f.lava or lava
				elseif q < 1.0 + f.edge / f.rx then
					local shore = f.level + 1 + (q - 1) * f.rx * 0.35
					if shore < h then
						h = shore
					end
					if f.lava then
						nearLava = true
					end
				end
			elseif t == "path" then
				-- nearest segment of this path
				-- nearest segment for masks; height blended over every segment within reach so
				-- bends that also change grade stay continuous on their inside corner
				local bestD, bestPh, bestT, bestSeg = math.huge, 0, 0, nil
				local reach = f.hw + 6
				local sw, sh = 0, 0
				for _, sg in f.segs do
					local dd, tt = segDist(x, z, sg.ax, sg.az, sg.bx, sg.bz)
					local tc = clamp(tt, 0, 1)
					local hh = lerp(sg.ah, sg.bh, tc)
					if dd < bestD then
						bestD, bestT, bestSeg = dd, tc, sg
					end
					if dd < reach then
						local w = (reach - dd) ^ 3
						sw += w
						sh += w * hh
					end
				end
				if sw > 0 then
					bestPh = sh / sw
				elseif bestSeg then
					bestPh = lerp(bestSeg.ah, bestSeg.bh, bestT)
				end
				local hw = f.hw
				if bestD < hw + 72 then
					local target = bestPh
					if f.kind == "stairs" then
						-- terrain sits under the steps, rising to meet the paths at both ends
						local L = math.sqrt((bestSeg.bx - bestSeg.ax) ^ 2 + (bestSeg.bz - bestSeg.az) ^ 2)
						local fromEnd = math.min(bestT, 1 - bestT) * L
						target = bestPh - 2.2 * clamp(fromEnd / 10, 0, 1)
					end
					local shoulder = clamp(math.abs(h - target) * 1.35, 8, 70)
					if bestD < hw + shoulder then
						local w = 1 - smoothstep(hw - 1, hw + shoulder, bestD)
						h = lerp(h, target, w)
						if bestD < hw * (0.96 + 0.08 * fbm(x / 18, z / 18, 3.3)) then
							path, pathH = f.style, bestPh
						end
					end
					if bestD < hw + 1 then
						ncore += 1
						cores[ncore] = target
						coreD[ncore] = bestD
					end
				end
			elseif t == "river" then
				nriv += 1
				rivers[nriv] = f
			end
		end
	end

	-- path cores: every path surface sits exactly at its design height, whatever
	-- shoulders were blended afterwards. At junctions the nearest core wins.
	if ncore == 1 then
		h = cores[1]
	elseif ncore > 1 then
		-- overlapping cores (junctions, diverging routes): blend so there is no seam
		local sw, sh = 0, 0
		for i = 1, ncore do
			local w = (1.5 + math.max(0, 1 - coreD[i] / 20)) ^ 4
			sw += w
			sh += w * cores[i]
		end
		h = sh / sw
	end

	-- rivers & lava carve last so bridges span them
	for ri = 1, nriv do
		local f = rivers[ri]
		local dd, tt = segDist(x, z, f.ax, f.az, f.bx, f.bz)
		local skip = (tt < 0 and f.flatA) or (tt > 1 and f.flatB)
		if not skip then
			local hw = lerp(f.hwa, f.hwb, clamp(tt, 0, 1))
			hw *= 1 + 0.06 * fbm(x / 40, z / 40, 7.7)
			local reach = ncore > 0 and 6 or 30
			if dd < hw + reach then
				local carve
				if dd < hw then
					carve = f.level - f.depth * (1 - (dd / hw) ^ 2)
				else
					carve = f.level + 1.5 + (dd - hw) * f.bank
				end
				-- banks blend back into the surrounding ground; further out the valley is a cliff
				local w = ncore > 0 and (dd < hw + reach and 1 or 0) or (1 - smoothstep(hw + reach * 0.6, hw + reach, dd))
				local nh = lerp(h, math.min(h, carve), w)
				if nh < h then
					h = nh
					if dd < hw + 6 then
						water = f.level
						bed = true
						if f.lava then
							lava = true
						end
					end
				end
			end
			if f.lava and dd < hw + 18 then
				nearLava = true
			end
		end
	end

	if h < Layout.OCEAN_LEVEL and water < Layout.OCEAN_LEVEL then
		water = Layout.OCEAN_LEVEL
	end

	-- caves (air pockets carved under the surface)
	local caveFloor, caveCeil = nil, nil
	for _, c in caveSegs do
		local dd, tt = segDist(x, z, c.ax, c.az, c.bx, c.bz)
		local floor = lerp(c.ah, c.bh, clamp(tt, 0, 1))
		local hw = c.hw
		local prof = nil
		if dd < hw and tt >= -0.02 then
			prof = math.sqrt(1 - (dd / hw) ^ 2)
		end
		if c.chamber > 0 then
			local cdx, cdz = x - c.bx, z - c.bz
			local cr = math.sqrt(cdx * cdx + cdz * cdz)
			if cr < c.chamber then
				local p2 = math.sqrt(1 - (cr / c.chamber) ^ 2)
				prof = math.max(prof or 0, p2)
				floor = c.bh
			end
		end
		if prof then
			local ceil = floor + 6 + (c.height - 6) * prof
			if dd < hw - 1 or (c.chamber > 0) then
				caveFloor, caveCeil = floor, ceil
				path, pathH = c.style, floor
			end
		end
	end

	for _, pz in Layout.plazas do
		if not pz.island then
			local dx, dz = x - pz.c[1], z - pz.c[2]
			if dx * dx + dz * dz < (pz.r * (1 + 0.03 * fbm(x / 20, z / 20, 5.5))) ^ 2 then
				path, pathH = STYLE[pz.style] or 2, h
			end
		end
	end

	S.h = h
	S.water = water
	S.path = path
	S.pathH = pathH
	S.bed = bed
	S.lava = lava
	S.nearLava = nearLava
	S.caveFloor = caveFloor
	S.caveCeil = caveCeil
	local b1, b2 = biomeAt(x, z, h)
	if h < 99.5 and not bed and b1 ~= 6 and landT > 0 then
		b1 = Layout.BIOME.beach
	end
	S.biome, S.biome2 = b1, b2
	return S
end

-- Height only (cheap wrapper used by prop placement).
function Field.height(x: number, z: number): number
	return Field.sample(x, z).h
end

----------------------------------------------------------------------
-- floating islands
----------------------------------------------------------------------
local I = { top = 0, bottom = 0, pool = nil, island = nil, path = 0, edge = 0 }

function Field.island(x: number, z: number)
	for _, isl in islands do
		local dx, dz = x - isl.cx, z - isl.cz
		local reach = isl.r * 1.12
		if math.abs(dx) < reach and math.abs(dz) < reach then
			local r = math.sqrt(dx * dx + dz * dz)
			local rEff = isl.r * (1 + 0.07 * fbm(x / 70, z / 70, isl.seed))
			local q = r / rEff
			if q < 1 then
				local onRoute = false
				for _, sg in skySegs do
					if (segDist(x, z, sg.ax, sg.az, sg.bx, sg.bz)) < sg.hw + 4 then
						onRoute = true
						break
					end
				end
				local top = onRoute and isl.h or (isl.h + fbm(x / 60, z / 60, isl.seed + 1) * 0.8 - 5 * smoothstep(0.86, 1, q))
				local under = (1 - q * q) ^ 0.55
				local bottom = isl.h - 6 - isl.depth * under * (0.78 + 0.22 * fbm(x / 34, z / 34, isl.seed + 2))
				local pool = nil
				if isl.pool then
					local pdx, pdz = x - isl.pool.c[1], z - isl.pool.c[2]
					local pr = math.sqrt(pdx * pdx + pdz * pdz) / isl.pool.r
					if pr < 1 then
						top = isl.h - 1.5 - 6 * (1 - pr * pr)
						pool = isl.h - 1.2
					end
				end
				I.top, I.bottom, I.pool, I.island, I.edge = top, math.min(bottom, top - 6), pool, isl, q
				local path = 0
				for _, pz in Layout.plazas do
					if pz.island and (x - pz.c[1]) ^ 2 + (z - pz.c[2]) ^ 2 < pz.r * pz.r then
						path = STYLE.sky
					end
				end
				for _, s in skySegs do
					local dd = segDist(x, z, s.ax, s.az, s.bx, s.bz)
					if dd < s.hw * (0.96 + 0.08 * fbm(x / 18, z / 18, 3.3)) then
						path = STYLE.sky
						break
					end
				end
				I.path = path
				return I
			end
		end
	end
	return nil
end

function Field.islandList()
	return islands
end

-- Walkable surface nearest below `nearY` at this column (terrain, cave floor or island).
function Field.groundTop(x: number, z: number, nearY: number): number
	local isl = Field.island(x, z)
	if isl and nearY >= isl.bottom - 2 then
		return isl.top
	end
	local s = Field.sample(x, z)
	if s.caveFloor and nearY < s.caveCeil then
		return s.caveFloor
	end
	return s.h
end

-- Clearance test for scatter: false if the point is on a path, river, pad or reserve.
function Field.isFree(x: number, z: number, pad: number?): boolean
	local p = pad or 6
	for _, r in Field.reserves do
		local dx, dz = x - r.x, z - r.z
		if dx * dx + dz * dz < (r.r + p) ^ 2 then
			return false
		end
	end
	for _, s in Field.pathSegs do
		if (segDist(x, z, s.ax, s.az, s.bx, s.bz)) < s.hw + p then
			return false
		end
	end
	for _, s in Field.riverSegs do
		if (segDist(x, z, s.ax, s.az, s.bx, s.bz)) < math.max(s.hwa, s.hwb) + p + 4 then
			return false
		end
	end
	return true
end

-- Steepness (rise over run) around a point.
function Field.slope(x: number, z: number): number
	local h0 = Field.height(x, z)
	local hx = Field.height(x + 4, z)
	local hz = Field.height(x, z + 4)
	return math.max(math.abs(hx - h0), math.abs(hz - h0)) / 4
end

function Field.addReserve(x: number, z: number, r: number, kind: string?)
	table.insert(Field.reserves, { x = x, z = z, r = r, kind = kind or "structure" })
end

function Field.init()
	compile()
end

return Field
