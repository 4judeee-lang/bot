-- Harness prelude: installs the mock globals, a module system mirroring the Rojo tree,
-- and workspace:Raycast backed by the builder's height field + part OBBs.
-- The bundler (tools/bundle.js) prepends roblox.luau and appends the module sources.

local Mock = __MOCK

Vector3 = Mock.Vector3
Vector2 = Mock.Vector2
CFrame = Mock.CFrame
Color3 = Mock.Color3
NumberRange = Mock.NumberRange
NumberSequence = Mock.NumberSequence
NumberSequenceKeypoint = Mock.NumberSequenceKeypoint
ColorSequence = Mock.ColorSequence
UDim2 = Mock.UDim2
Region3 = Mock.Region3
RaycastParams = Mock.RaycastParams
TweenInfo = Mock.TweenInfo
Random = Mock.Random
Enum = Mock.Enum
Instance = Mock.Instance
warn = function(...)
	print("WARN", ...)
end
task = { wait = function() end, spawn = function(f, ...) f(...) end, defer = function(f, ...) f(...) end }
local builtinTypeof = typeof
typeof = function(v)
	if Mock.isV3(v) then
		return "Vector3"
	elseif Mock.isCF(v) then
		return "CFrame"
	elseif Mock.isC3(v) then
		return "Color3"
	elseif type(v) == "table" and rawget(v, "__cls") then
		return "Instance"
	end
	return builtinTypeof(v)
end

-- data model -------------------------------------------------------------
local new = Mock.newInstance
local DataModel = new("DataModel")
local services = {}
local function service(cls, name)
	local s = new(cls)
	s.Name = name or cls
	rawset(s, "__parent", DataModel)
	table.insert(rawget(DataModel, "__children"), s)
	services[name or cls] = s
	return s
end
local Workspace = service("Workspace")
local Lighting = service("Lighting")
local ServerStorage = service("ServerStorage")
local ReplicatedStorage = service("ReplicatedStorage")
local Terrain = new("Terrain")
Terrain.Name = "Terrain"
Terrain.Parent = Workspace
local Camera = new("Camera")
Camera.Name = "Camera"
Camera.Parent = Workspace
Workspace.CurrentCamera = Camera

local tagged = {}
services.CollectionService = {
	AddTag = function(_, inst, tag)
		tagged[tag] = (tagged[tag] or 0) + 1
	end,
}
services.Players = { LocalPlayer = nil }
services.TweenService = {}
DataModelGetService = function(_, name)
	local s = services[name]
	if not s then
		error("mock has no service " .. name)
	end
	return s
end
game = setmetatable({}, {
	__index = function(_, k)
		if k == "GetService" then
			return DataModelGetService
		end
		return services[k]
	end,
})
workspace = Workspace
for k, f in Mock.TerrainMethods do
	rawset(Terrain, k, f)
end

-- module system -------------------------------------------------------------
local cache = {}
local loading = {}
local function mockRequire(m)
	if type(m) == "string" then
		error("require by string is not used in this project: " .. m)
	end
	local src = rawget(m, "__source")
	assert(src, "require target has no source: " .. m:GetFullName())
	if cache[m] ~= nil then
		return cache[m]
	end
	assert(not loading[m], "cyclic require: " .. m:GetFullName())
	loading[m] = true
	local result = src(m)
	loading[m] = nil
	assert(result ~= nil, "module returned nothing: " .. m:GetFullName())
	cache[m] = result
	return result
end
require = mockRequire

local function ensureFolder(parent, name)
	local existing = parent:FindFirstChild(name)
	if existing then
		return existing
	end
	local f = new("Folder")
	f.Name = name
	f.Parent = parent
	return f
end

-- path like "ServerStorage/WorldBuilder/Assets/Props"; init modules have isInit = true
function __register(path, fn)
	local parts = string.split(path, "/")
	local parent = services[parts[1]]
	for i = 2, #parts - 1 do
		local child = parent:FindFirstChild(parts[i])
		if not child then
			child = ensureFolder(parent, parts[i])
		end
		parent = child
	end
	local name = parts[#parts]
	local existing = parent:FindFirstChild(name)
	local ms
	if existing and existing.ClassName == "Folder" then
		-- a folder was created for children before its init module; convert it
		ms = new("ModuleScript")
		ms.Name = name
		for _, c in existing:GetChildren() do
			c.Parent = ms
		end
		existing.Parent = nil
		ms.Parent = parent
	elseif existing then
		ms = existing
	else
		ms = new("ModuleScript")
		ms.Name = name
		ms.Parent = parent
	end
	rawset(ms, "__source", fn)
end

-- raycasting -------------------------------------------------------------
local Field = nil
local function getField()
	if not Field then
		Field = mockRequire(ServerStorage.WorldBuilder.Field)
	end
	return Field
end

local function terrainSolid(F, x, y, z)
	local isl = F.island(x, z)
	if isl and y <= isl.top and y >= isl.bottom then
		return true
	end
	local s = F.sample(x, z)
	if s.caveFloor and y > s.caveFloor and y < s.caveCeil then
		return false
	end
	return y <= s.h and y >= s.h - 60
end

local function terrainNormal(F, x, z, y)
	local h = function(a, b)
		return F.groundTop(a, b, (y or 1e6) + 1)
	end
	local n = Vector3.new(h(x - 1, z) - h(x + 1, z), 2, h(x, z - 1) - h(x, z + 1))
	return n.Unit
end

local function rayTerrain(origin, dir)
	local F = getField()
	local len = dir.Magnitude
	if len < 1e-6 then
		return nil
	end
	-- vertical rays: resolve the column analytically
	if math.abs(dir.X) < 1e-6 and math.abs(dir.Z) < 1e-6 then
		local x, z = origin.X, origin.Z
		local y0, y1 = origin.Y, origin.Y + dir.Y
		local cands = {}
		local isl = F.island(x, z)
		local s = F.sample(x, z)
		if dir.Y < 0 then
			if isl then
				if y0 >= isl.top then
					table.insert(cands, isl.top)
				elseif y0 > isl.bottom then
					table.insert(cands, y0)
				end
			end
			if s.caveFloor and y0 < s.caveCeil and y0 > s.caveFloor then
				if s.caveFloor >= y1 and (not isl or isl.top < s.caveFloor or y0 < isl.bottom) then
					return Vector3.new(x, s.caveFloor, z), Vector3.new(0, 1, 0)
				end
				table.insert(cands, s.caveFloor)
			elseif y0 >= s.h then
				table.insert(cands, s.h)
			elseif y0 > s.h - 60 then
				table.insert(cands, y0)
			end
			local best = nil
			for _, c in cands do
				if c <= y0 and c >= y1 and (not best or c > best) then
					best = c
				end
			end
			if best then
				return Vector3.new(x, best, z), terrainNormal(F, x, z, best)
			end
		else
			if isl and y0 < isl.bottom and y1 >= isl.bottom then
				table.insert(cands, isl.bottom)
			end
			if s.caveFloor and y0 >= s.caveFloor and y0 < s.caveCeil and y1 >= s.caveCeil then
				table.insert(cands, s.caveCeil)
			end
			local best = nil
			for _, c in cands do
				if not best or c < best then
					best = c
				end
			end
			if best then
				return Vector3.new(x, best, z), Vector3.new(0, -1, 0)
			end
		end
		return nil
	end
	local step = 0.5
	local n = math.ceil(len / step)
	local unit = dir / len
	local prev = origin
	if terrainSolid(F, origin.X, origin.Y, origin.Z) then
		return nil -- starting inside terrain: Roblox ignores the containing voxel
	end
	for i = 1, n do
		local p = origin + unit * math.min(len, i * step)
		if terrainSolid(F, p.X, p.Y, p.Z) then
			-- refine
			local a, b = prev, p
			for _ = 1, 8 do
				local m = (a + b) / 2
				if terrainSolid(F, m.X, m.Y, m.Z) then
					b = m
				else
					a = m
				end
			end
			return b, terrainNormal(F, b.X, b.Z, b.Y)
		end
		prev = p
	end
	return nil
end

-- spatial index of collidable, queryable parts in Workspace
local CELL = 48
local grid = {}
local function aabb(p)
	local c = p.CFrame
	local s = p.Size
	local ex = math.abs(c.r.X) * s.X / 2 + math.abs(c.u.X) * s.Y / 2 + math.abs(c.b.X) * s.Z / 2
	local ey = math.abs(c.r.Y) * s.X / 2 + math.abs(c.u.Y) * s.Y / 2 + math.abs(c.b.Y) * s.Z / 2
	local ez = math.abs(c.r.Z) * s.X / 2 + math.abs(c.u.Z) * s.Y / 2 + math.abs(c.b.Z) * s.Z / 2
	return c.p.X - ex, c.p.Y - ey, c.p.Z - ez, c.p.X + ex, c.p.Y + ey, c.p.Z + ez
end
local function rebuildIndex()
	table.clear(grid)
	for _, p in Mock.allParts do
		if rawget(p, "__cls") ~= "Terrain" and p:IsDescendantOf(Workspace) and p.CanCollide and p.CanQuery ~= false then
			local x0, _, z0, x1, _, z1 = aabb(p)
			for ix = math.floor(x0 / CELL), math.floor(x1 / CELL) do
				for iz = math.floor(z0 / CELL), math.floor(z1 / CELL) do
					local k = ix * 100003 + iz
					local l = grid[k]
					if not l then
						l = {}
						grid[k] = l
					end
					table.insert(l, p)
				end
			end
		end
	end
	Mock.dirty = false
end

local function rayPart(p, origin, dir)
	local c = p.CFrame
	local s = p.Size
	local rel = origin - c.p
	local o = Vector3.new(rel:Dot(c.r), rel:Dot(c.u), rel:Dot(c.b))
	local d = Vector3.new(dir:Dot(c.r), dir:Dot(c.u), dir:Dot(c.b))
	local shape = p.ClassName == "Part" and p.Shape and p.Shape.Name or "Block"
	if shape == "Ball" then
		local r = math.min(s.X, s.Y, s.Z) / 2
		local a = d:Dot(d)
		local b = 2 * o:Dot(d)
		local cc = o:Dot(o) - r * r
		local disc = b * b - 4 * a * cc
		if disc < 0 then
			return nil
		end
		local t = (-b - math.sqrt(disc)) / (2 * a)
		if t < 0 or t > 1 then
			return nil
		end
		local hp = o + d * t
		return t, (c.r * hp.X + c.u * hp.Y + c.b * hp.Z).Unit
	end
	local t0, t1 = 0, 1
	local nAxis, nSign = nil, 0
	local oo = { o.X, o.Y, o.Z }
	local dd = { d.X, d.Y, d.Z }
	local hs = { s.X / 2, s.Y / 2, s.Z / 2 }
	for i = 1, 3 do
		if math.abs(dd[i]) < 1e-9 then
			if oo[i] < -hs[i] or oo[i] > hs[i] then
				return nil
			end
		else
			local ta = (-hs[i] - oo[i]) / dd[i]
			local tb = (hs[i] - oo[i]) / dd[i]
			local sign = -1
			if ta > tb then
				ta, tb = tb, ta
				sign = 1
			end
			if ta > t0 then
				t0 = ta
				nAxis, nSign = i, sign
			end
			if tb < t1 then
				t1 = tb
			end
			if t0 > t1 then
				return nil
			end
		end
	end
	if p.ClassName == "WedgePart" then
		-- solid where y/sy - z/sz <= 0 (slope rises towards +Z / back)
		local f0 = (o.Y + d.Y * t0) / s.Y - (o.Z + d.Z * t0) / s.Z
		local fd = d.Y / s.Y - d.Z / s.Z
		if f0 > 0 then
			if fd >= 0 then
				return nil
			end
			local tp = t0 - f0 / fd
			if tp > t1 then
				return nil
			end
			local n = Vector3.new(0, 1 / s.Y, -1 / s.Z).Unit
			return tp, (c.u * n.Y + c.b * n.Z).Unit
		end
	end
	if not nAxis then
		return nil -- origin inside the box: ignored, like Roblox
	end
	local axes = { c.r, c.u, c.b }
	return t0, axes[nAxis] * nSign
end

function Mock.raycast(origin, dir, params)
	if Mock.dirty then
		rebuildIndex()
	end
	local bestT, bestN, bestInst = math.huge, nil, nil
	local skipTerrain = false
	for _, e in (params and params.FilterDescendantsInstances or {}) do
		if e == Terrain then
			skipTerrain = true
		end
	end
	local tp, tn
	if not skipTerrain then
		tp, tn = rayTerrain(origin, dir)
	end
	if tp then
		bestT = (tp - origin).Magnitude / dir.Magnitude
		bestN = tn
		bestInst = Terrain
	end
	local ex = {}
	if params and params.FilterDescendantsInstances then
		ex = params.FilterDescendantsInstances
	end
	local seen = {}
	local endP = origin + dir
	local x0, x1 = math.min(origin.X, endP.X), math.max(origin.X, endP.X)
	local z0, z1 = math.min(origin.Z, endP.Z), math.max(origin.Z, endP.Z)
	for ix = math.floor(x0 / CELL), math.floor(x1 / CELL) do
		for iz = math.floor(z0 / CELL), math.floor(z1 / CELL) do
			local l = grid[ix * 100003 + iz]
			if l then
				for _, p in l do
					if not seen[p] then
						seen[p] = true
						local skip = false
						for _, e in ex do
							if p == e or p:IsDescendantOf(e) then
								skip = true
							end
						end
						if not skip then
							local t, n = rayPart(p, origin, dir)
							if t and t < bestT then
								bestT, bestN, bestInst = t, n, p
							end
						end
					end
				end
			end
		end
	end
	if bestInst then
		return { Position = origin + dir * math.min(bestT, 1), Normal = bestN, Instance = bestInst, Distance = bestT * dir.Magnitude }
	end
	return nil
end
rawset(Workspace, "Raycast", function(_, origin, dir, params)
	return Mock.raycast(origin, dir, params)
end)

__HARNESS = {
	services = services,
	require = mockRequire,
	Workspace = Workspace,
	ServerStorage = ServerStorage,
	ReplicatedStorage = ReplicatedStorage,
	Lighting = Lighting,
	tagged = tagged,
	Mock = Mock,
}
