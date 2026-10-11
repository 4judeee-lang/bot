-- Minimal Roblox engine mock for running WorldBuilder headlessly with the Luau CLI.
-- It is deliberately strict: unknown classes, properties and enum items raise errors,
-- the way the real engine does, so typos are caught without Studio.
-- Raycasts are resolved against the builder's own height field plus part OBBs.

local Mock = {}

----------------------------------------------------------------------
-- Vector3 / Vector2
----------------------------------------------------------------------
local V3 = {}
local V3mt = {}
local function v3(x, y, z)
	return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, V3mt)
end
local function isV3(v)
	return type(v) == "table" and getmetatable(v) == V3mt
end
V3mt.__index = function(v, k)
	if k == "Magnitude" then
		return math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z)
	elseif k == "Unit" then
		local m = math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z)
		if m == 0 then
			return v3(0, 0, 0)
		end
		return v3(v.X / m, v.Y / m, v.Z / m)
	end
	local f = V3[k]
	if f then
		return f
	end
	error("Vector3 has no member " .. tostring(k), 2)
end
V3mt.__add = function(a, b)
	assert(isV3(a) and isV3(b), "Vector3 + non-Vector3")
	return v3(a.X + b.X, a.Y + b.Y, a.Z + b.Z)
end
V3mt.__sub = function(a, b)
	assert(isV3(a) and isV3(b), "Vector3 - non-Vector3")
	return v3(a.X - b.X, a.Y - b.Y, a.Z - b.Z)
end
V3mt.__mul = function(a, b)
	if type(a) == "number" then
		return v3(a * b.X, a * b.Y, a * b.Z)
	elseif type(b) == "number" then
		return v3(a.X * b, a.Y * b, a.Z * b)
	end
	return v3(a.X * b.X, a.Y * b.Y, a.Z * b.Z)
end
V3mt.__div = function(a, b)
	if type(b) == "number" then
		return v3(a.X / b, a.Y / b, a.Z / b)
	end
	return v3(a.X / b.X, a.Y / b.Y, a.Z / b.Z)
end
V3mt.__unm = function(a)
	return v3(-a.X, -a.Y, -a.Z)
end
V3mt.__eq = function(a, b)
	return a.X == b.X and a.Y == b.Y and a.Z == b.Z
end
V3mt.__tostring = function(a)
	return string.format("%g, %g, %g", a.X, a.Y, a.Z)
end
function V3.Dot(a, b)
	return a.X * b.X + a.Y * b.Y + a.Z * b.Z
end
function V3.Cross(a, b)
	return v3(a.Y * b.Z - a.Z * b.Y, a.Z * b.X - a.X * b.Z, a.X * b.Y - a.Y * b.X)
end
function V3.Lerp(a, b, t)
	return v3(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t, a.Z + (b.Z - a.Z) * t)
end
Mock.Vector3 = {
	new = v3,
	zero = v3(0, 0, 0),
	one = v3(1, 1, 1),
	xAxis = v3(1, 0, 0),
	yAxis = v3(0, 1, 0),
	zAxis = v3(0, 0, 1),
}
Mock.isV3 = isV3

local V2mt = {}
V2mt.__index = function(v, k)
	if k == "Magnitude" then
		return math.sqrt(v.X * v.X + v.Y * v.Y)
	end
	error("Vector2 has no member " .. tostring(k), 2)
end
Mock.Vector2 = {
	new = function(x, y)
		return setmetatable({ X = x or 0, Y = y or 0 }, V2mt)
	end,
}

----------------------------------------------------------------------
-- CFrame (position + 3x3 rotation stored as columns: right, up, back)
----------------------------------------------------------------------
local CF = {}
local CFmt = {}
local function cf(p, r, u, b)
	return setmetatable({ p = p, r = r, u = u, b = b }, CFmt)
end
local function isCF(v)
	return type(v) == "table" and getmetatable(v) == CFmt
end
local function rot(c, v) -- rotate vector v by c
	return v3(
		c.r.X * v.X + c.u.X * v.Y + c.b.X * v.Z,
		c.r.Y * v.X + c.u.Y * v.Y + c.b.Y * v.Z,
		c.r.Z * v.X + c.u.Z * v.Y + c.b.Z * v.Z
	)
end
CFmt.__index = function(c, k)
	if k == "Position" then
		return c.p
	elseif k == "X" then
		return c.p.X
	elseif k == "Y" then
		return c.p.Y
	elseif k == "Z" then
		return c.p.Z
	elseif k == "LookVector" then
		return -c.b
	elseif k == "RightVector" then
		return c.r
	elseif k == "UpVector" then
		return c.u
	elseif k == "Rotation" then
		return cf(v3(0, 0, 0), c.r, c.u, c.b)
	end
	local f = CF[k]
	if f then
		return f
	end
	error("CFrame has no member " .. tostring(k), 2)
end
CFmt.__mul = function(a, b)
	if isCF(b) then
		return cf(a.p + rot(a, b.p), rot(a, b.r), rot(a, b.u), rot(a, b.b))
	elseif isV3(b) then
		return a.p + rot(a, b)
	end
	error("bad CFrame multiply", 2)
end
CFmt.__add = function(a, b)
	assert(isV3(b), "CFrame + non-Vector3")
	return cf(a.p + b, a.r, a.u, a.b)
end
CFmt.__sub = function(a, b)
	assert(isV3(b), "CFrame - non-Vector3")
	return cf(a.p - b, a.r, a.u, a.b)
end
function CF.Inverse(c)
	-- transpose rotation
	local r = v3(c.r.X, c.u.X, c.b.X)
	local u = v3(c.r.Y, c.u.Y, c.b.Y)
	local b = v3(c.r.Z, c.u.Z, c.b.Z)
	local inv = cf(v3(0, 0, 0), r, u, b)
	inv.p = -rot(inv, c.p)
	return inv
end
function CF.PointToWorldSpace(c, v)
	return c * v
end
function CF.VectorToWorldSpace(c, v)
	return rot(c, v)
end
function CF.PointToObjectSpace(c, v)
	return c:Inverse() * v
end
function CF.ToObjectSpace(c, o)
	return c:Inverse() * o
end

local function identityAt(p)
	return cf(p, v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1))
end
local function fromMatrix(p, vx, vy, vz)
	vz = vz or vx:Cross(vy)
	return cf(p, vx, vy, vz)
end
local function lookAt(at, target, up)
	up = up or v3(0, 1, 0)
	local f = (target - at)
	if f.Magnitude < 1e-9 then
		return identityAt(at)
	end
	f = f.Unit
	local right = f:Cross(up)
	if right.Magnitude < 1e-6 then
		right = f:Cross(v3(0, 0, 1))
		if right.Magnitude < 1e-6 then
			right = f:Cross(v3(1, 0, 0))
		end
	end
	right = right.Unit
	local u = right:Cross(f).Unit
	return cf(at, right, u, -f)
end
local function rx(a)
	local c, s = math.cos(a), math.sin(a)
	return cf(v3(0, 0, 0), v3(1, 0, 0), v3(0, c, s), v3(0, -s, c))
end
local function ry(a)
	local c, s = math.cos(a), math.sin(a)
	return cf(v3(0, 0, 0), v3(c, 0, -s), v3(0, 1, 0), v3(s, 0, c))
end
local function rz(a)
	local c, s = math.cos(a), math.sin(a)
	return cf(v3(0, 0, 0), v3(c, s, 0), v3(-s, c, 0), v3(0, 0, 1))
end
Mock.CFrame = {
	new = function(x, y, z, ...)
		if select("#", ...) > 0 then
			error("mock CFrame.new: matrix form not supported", 2)
		end
		if isV3(x) then
			if y ~= nil then
				error("CFrame.new(pos, lookAt) is deprecated; use CFrame.lookAt", 2)
			end
			return identityAt(x)
		end
		assert(type(x) == "number" or x == nil, "CFrame.new expects numbers")
		return identityAt(v3(x or 0, y or 0, z or 0))
	end,
	lookAt = lookAt,
	fromMatrix = fromMatrix,
	Angles = function(a, b, c)
		return rx(a) * ry(b) * rz(c)
	end,
	fromEulerAnglesXYZ = function(a, b, c)
		return rx(a) * ry(b) * rz(c)
	end,
	fromEulerAnglesYXZ = function(a, b, c)
		return ry(b) * rx(a) * rz(c)
	end,
	identity = identityAt(v3(0, 0, 0)),
}
Mock.isCF = isCF

----------------------------------------------------------------------
-- Color3 & sequences
----------------------------------------------------------------------
local C3 = {}
local C3mt = { __index = C3 }
local function c3(r, g, b)
	return setmetatable({ R = r, G = g, B = b }, C3mt)
end
function C3.Lerp(a, b, t)
	return c3(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t)
end
function C3.ToHSV(c)
	local r, g, b = c.R, c.G, c.B
	local mx, mn = math.max(r, g, b), math.min(r, g, b)
	local h, s, v = 0, 0, mx
	local d = mx - mn
	if mx > 0 then
		s = d / mx
	end
	if d > 0 then
		if mx == r then
			h = ((g - b) / d) % 6
		elseif mx == g then
			h = (b - r) / d + 2
		else
			h = (r - g) / d + 4
		end
		h /= 6
	end
	return h, s, v
end
Mock.Color3 = {
	new = function(r, g, b)
		return c3(r or 0, g or 0, b or 0)
	end,
	fromRGB = function(r, g, b)
		return c3((r or 0) / 255, (g or 0) / 255, (b or 0) / 255)
	end,
	fromHSV = function(h, s, v)
		local i = math.floor(h * 6)
		local f = h * 6 - i
		local p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
		i = i % 6
		if i == 0 then
			return c3(v, t, p)
		elseif i == 1 then
			return c3(q, v, p)
		elseif i == 2 then
			return c3(p, v, t)
		elseif i == 3 then
			return c3(p, q, v)
		elseif i == 4 then
			return c3(t, p, v)
		end
		return c3(v, p, q)
	end,
}
Mock.isC3 = function(v)
	return type(v) == "table" and getmetatable(v) == C3mt
end
Mock.NumberRange = { new = function(a, b) return { Min = a, Max = b or a } end }
Mock.NumberSequenceKeypoint = { new = function(t, v) assert(t >= 0 and t <= 1, "keypoint time out of range") return { Time = t, Value = v } end }
Mock.NumberSequence = {
	new = function(a, b)
		if type(a) == "table" then
			assert(#a >= 2 and a[1].Time == 0 and a[#a].Time == 1, "NumberSequence must start at 0 and end at 1")
			return { Keypoints = a }
		end
		return { Keypoints = { { Time = 0, Value = a }, { Time = 1, Value = b or a } } }
	end,
}
Mock.ColorSequence = {
	new = function(a, b)
		assert(Mock.isC3(a) or type(a) == "table", "ColorSequence expects Color3")
		return { a = a, b = b or a }
	end,
}
Mock.UDim2 = { fromScale = function(x, y) return { X = x, Y = y } end, new = function(a, b, c, d) return { a, b, c, d } end }
Mock.Region3 = {
	new = function(mn, mx)
		return { Min = mn, Max = mx, CFrame = identityAt((mn + mx) / 2), Size = mx - mn }
	end,
}
Mock.RaycastParams = {
	new = function()
		return { FilterType = nil, FilterDescendantsInstances = {}, RespectCanCollide = false, IgnoreWater = false }
	end,
}
Mock.TweenInfo = { new = function(...) return { ... } end }

----------------------------------------------------------------------
-- Random (deterministic xorshift)
----------------------------------------------------------------------
local RNG = {}
RNG.__index = RNG
Mock.Random = {
	new = function(seed)
		local s = math.floor((seed or 1) % 2147483647)
		if s == 0 then
			s = 1234567
		end
		return setmetatable({ s = s }, RNG)
	end,
}
function RNG:_next()
	-- Park-Miller minimal standard
	self.s = (self.s * 48271) % 2147483647
	return self.s / 2147483647
end
function RNG:NextNumber(a, b)
	local u = self:_next()
	if a == nil then
		return u
	end
	return a + (b - a) * u
end
function RNG:NextInteger(a, b)
	assert(a <= b, "NextInteger: min > max")
	return math.min(b, a + math.floor(self:_next() * (b - a + 1)))
end

----------------------------------------------------------------------
-- Enum
----------------------------------------------------------------------
local ENUMS = {
	Material = { "Plastic", "SmoothPlastic", "Neon", "Wood", "WoodPlanks", "Marble", "Slate", "Concrete", "Granite", "Brick", "Pebble", "Cobblestone", "Rock", "Sandstone", "Basalt", "CrackedLava", "Asphalt", "LeafyGrass", "Salt", "Limestone", "Pavement", "Grass", "Snow", "Glacier", "Ground", "Mud", "Sand", "Fabric", "Ice", "Foil", "Metal", "DiamondPlate", "CorrodedMetal", "Glass", "ForceField", "Water", "Air", "Cardboard", "Carpet", "CeramicTiles", "ClayRoofTiles", "RoofShingles", "Leather", "Plaster", "Rubber" },
	PartType = { "Ball", "Block", "Cylinder", "Wedge", "CornerWedge" },
	MeshType = { "Head", "Torso", "Wedge", "Sphere", "Cylinder", "FileMesh", "Brick", "Prism", "Pyramid", "ParallelRamp", "RightAngleRamp", "CornerWedge" },
	SurfaceType = { "Smooth", "Glue", "Weld", "Studs", "Inlet", "Universal", "Hinge", "Motor", "SteppingMotor", "SmoothNoOutlines" },
	ModelStreamingMode = { "Default", "Atomic", "Persistent", "PersistentPerPlayer", "Nonatomic" },
	ModelLevelOfDetail = { "Automatic", "StreamingMesh", "Disabled" },
	NormalId = { "Top", "Bottom", "Front", "Back", "Left", "Right" },
	SurfaceGuiSizingMode = { "FixedSize", "PixelsPerStud" },
	StreamOutBehavior = { "Default", "LowMemory", "Opportunistic" },
	StreamingIntegrityMode = { "Default", "Disabled", "MinimumRadiusPause", "PauseOutsideLoadedArea" },
	Technology = { "Legacy", "Voxel", "Compatibility", "ShadowMap", "Future", "Unified" },
	LightingStyle = { "Realistic", "Soft" },
	RaycastFilterType = { "Exclude", "Include", "Blacklist", "Whitelist" },
	EasingStyle = { "Linear", "Sine", "Quad", "Cubic" },
	EasingDirection = { "In", "Out", "InOut" },
	CameraType = { "Custom", "Scriptable", "Fixed" },
	Font = { "FredokaOne", "GothamBold", "SourceSans", "Gotham" },
}
local enumItems = {}
Mock.Enum = setmetatable({}, {
	__index = function(_, typeName)
		local list = ENUMS[typeName]
		if not list then
			error("Enum." .. tostring(typeName) .. " is not supported by the mock (add it if real)", 2)
		end
		local cache = enumItems[typeName]
		if not cache then
			cache = {}
			for i, n in list do
				cache[n] = { EnumType = typeName, Name = n, Value = i }
			end
			enumItems[typeName] = cache
		end
		return setmetatable({}, {
			__index = function(_, item)
				local e = cache[item]
				if not e then
					error(string.format("%s is not a valid member of Enum.%s", tostring(item), typeName), 2)
				end
				return e
			end,
		})
	end,
})

----------------------------------------------------------------------
-- Instances
----------------------------------------------------------------------
local BASEPART = { "Name", "Parent", "Anchored", "Size", "CFrame", "Position", "Color", "Material", "TopSurface", "BottomSurface", "CanCollide", "CanTouch", "CanQuery", "CastShadow", "Transparency", "Reflectance", "Massless", "Locked" }
local CLASSES = {
	Part = { props = { "Shape" }, base = "BasePart" },
	WedgePart = { props = {}, base = "BasePart" },
	CornerWedgePart = { props = {}, base = "BasePart" },
	SpawnLocation = { props = { "Shape", "Neutral", "Duration", "Enabled", "AllowTeamChangeOnTouch" }, base = "BasePart" },
	Model = { props = { "Name", "Parent", "ModelStreamingMode", "LevelOfDetail", "PrimaryPart" } },
	Folder = { props = { "Name", "Parent" } },
	SpecialMesh = { props = { "Name", "Parent", "MeshType", "Scale", "Offset" } },
	PointLight = { props = { "Name", "Parent", "Color", "Brightness", "Range", "Shadows", "Enabled" } },
	SpotLight = { props = { "Name", "Parent", "Color", "Brightness", "Range", "Shadows", "Enabled", "Angle", "Face" } },
	SurfaceLight = { props = { "Name", "Parent", "Color", "Brightness", "Range", "Shadows", "Enabled", "Angle", "Face" } },
	ParticleEmitter = { props = { "Name", "Parent", "Texture", "Rate", "Lifetime", "Speed", "SpreadAngle", "Acceleration", "LightEmission", "LightInfluence", "Size", "Transparency", "Color", "EmissionDirection", "Drag", "LockedToPart", "Rotation", "RotSpeed", "Brightness", "Enabled", "ZOffset" } },
	SurfaceGui = { props = { "Name", "Parent", "Face", "SizingMode", "PixelsPerStud", "LightInfluence", "CanvasSize", "AlwaysOnTop" } },
	TextLabel = { props = { "Name", "Parent", "Size", "BackgroundTransparency", "Text", "TextScaled", "Font", "TextColor3" } },
	Atmosphere = { props = { "Name", "Parent", "Density", "Offset", "Color", "Decay", "Glare", "Haze" } },
	BloomEffect = { props = { "Name", "Parent", "Intensity", "Size", "Threshold", "Enabled" } },
	ColorCorrectionEffect = { props = { "Name", "Parent", "Saturation", "Contrast", "Brightness", "TintColor", "Enabled" } },
	SunRaysEffect = { props = { "Name", "Parent", "Intensity", "Spread", "Enabled" } },
	DepthOfFieldEffect = { props = { "Name", "Parent", "FarIntensity", "NearIntensity", "InFocusRadius", "FocusDistance" } },
	Sky = { props = { "Name", "Parent", "SunAngularSize", "MoonAngularSize", "StarCount", "CelestialBodiesShown" } },
	Clouds = { props = { "Name", "Parent", "Cover", "Density", "Color" } },
	ModuleScript = { props = { "Name", "Parent" } },
	-- services / singletons
	Workspace = { props = { "Name", "StreamingEnabled", "StreamingMinRadius", "StreamingTargetRadius", "StreamOutBehavior", "StreamingIntegrityMode", "CurrentCamera" } },
	Terrain = { props = { "Name", "Parent", "WaterColor", "WaterTransparency", "WaterReflectance", "WaterWaveSize", "WaterWaveSpeed", "Decoration" } },
	Lighting = { props = { "Name", "Brightness", "ExposureCompensation", "ClockTime", "Ambient", "OutdoorAmbient", "EnvironmentDiffuseScale", "EnvironmentSpecularScale", "ShadowSoftness", "GlobalShadows", "GeographicLatitude", "FogEnd", "Technology", "LightingStyle", "PrioritizeLightingQuality" } },
	ServerStorage = { props = { "Name" } },
	ReplicatedStorage = { props = { "Name" } },
	DataModel = { props = { "Name" } },
	Camera = { props = { "Name", "Parent", "CFrame", "FieldOfView", "CameraType" } },
}
local PROPSET = {}
for cls, spec in CLASSES do
	local set = {}
	for _, p in spec.props do
		set[p] = true
	end
	if spec.base == "BasePart" then
		for _, p in BASEPART do
			set[p] = true
		end
	end
	PROPSET[cls] = set
end
local ISA = {
	BasePart = { Part = true, WedgePart = true, CornerWedgePart = true, SpawnLocation = true, Terrain = true },
	PVInstance = { Part = true, WedgePart = true, CornerWedgePart = true, SpawnLocation = true, Model = true },
	Light = { PointLight = true, SpotLight = true, SurfaceLight = true },
	Instance = {},
}

local Inst = {}
local Instmt = {}
Mock.allParts = {} -- every BasePart created
Mock.dirty = true

local function defaults(cls)
	local d = { Name = cls }
	if PROPSET[cls] and PROPSET[cls].Anchored then
		d.Size = v3(4, 1, 2)
		d.CFrame = identityAt(v3(0, 0, 0))
		d.Anchored = false
		d.CanCollide = true
		d.CanTouch = true
		d.CanQuery = true
		d.CastShadow = true
		d.Transparency = 0
		d.Shape = Mock.Enum.PartType.Block
	end
	return d
end

local function newInstance(cls)
	if not CLASSES[cls] then
		error("Unable to create an Instance of type \"" .. tostring(cls) .. "\" (not in mock class list)", 2)
	end
	local self = setmetatable({ __cls = cls, __props = defaults(cls), __children = {}, __attrs = {}, __parent = nil, __tags = {} }, Instmt)
	if PROPSET[cls].Anchored then
		table.insert(Mock.allParts, self)
	end
	return self
end

Instmt.__index = function(self, k)
	local props = rawget(self, "__props")
	if k == "ClassName" then
		return rawget(self, "__cls")
	elseif k == "Parent" then
		return rawget(self, "__parent")
	elseif k == "Position" and props.CFrame then
		return props.CFrame.p
	end
	local f = Inst[k]
	if f then
		return f
	end
	local cls = rawget(self, "__cls")
	if PROPSET[cls][k] then
		return props[k]
	end
	-- children by name
	for _, c in rawget(self, "__children") do
		if c.Name == k then
			return c
		end
	end
	error(tostring(k) .. " is not a valid member of " .. cls .. " \"" .. tostring(props.Name) .. "\"", 2)
end

Instmt.__newindex = function(self, k, v)
	local cls = rawget(self, "__cls")
	if not PROPSET[cls][k] then
		error(tostring(k) .. " is not a valid member of " .. cls, 2)
	end
	if k == "Parent" then
		local old = rawget(self, "__parent")
		if old then
			local list = rawget(old, "__children")
			local i = table.find(list, self)
			if i then
				table.remove(list, i)
			end
		end
		rawset(self, "__parent", v)
		if v then
			table.insert(rawget(v, "__children"), self)
		end
		Mock.dirty = true
		return
	end
	local props = rawget(self, "__props")
	if k == "Position" then
		local c = props.CFrame
		props.CFrame = cf(v, c.r, c.u, c.b)
		Mock.dirty = true
		return
	end
	if (k == "Size" or k == "CFrame") and PROPSET[cls].Anchored then
		assert((k == "Size" and isV3(v)) or (k == "CFrame" and isCF(v)), k .. " type mismatch")
		if k == "Size" then
			assert(v.X == v.X and v.Y == v.Y and v.Z == v.Z, "NaN size")
			assert(v.X >= 0 and v.Y >= 0 and v.Z >= 0, "negative size")
			if v.X > 2048 or v.Y > 2048 or v.Z > 2048 then
				error("part size above 2048 studs: " .. tostring(v), 2)
			end
		else
			assert(v.p.X == v.p.X and v.p.Y == v.p.Y and v.p.Z == v.p.Z, "NaN CFrame position")
		end
		Mock.dirty = true
	end
	if k == "Shape" then
		Mock.dirty = true
	end
	if type(v) == "table" and getmetatable(v) ~= Instmt and rawget(v, "EnumType") then
		-- enum assignments must use the right enum type for well-known properties
		local expected = ({ Material = "Material", Shape = "PartType", MeshType = "MeshType", ModelStreamingMode = "ModelStreamingMode", LevelOfDetail = "ModelLevelOfDetail", Face = "NormalId", EmissionDirection = "NormalId", SizingMode = "SurfaceGuiSizingMode", Font = "Font", TopSurface = "SurfaceType", BottomSurface = "SurfaceType", Technology = "Technology", LightingStyle = "LightingStyle", StreamOutBehavior = "StreamOutBehavior", StreamingIntegrityMode = "StreamingIntegrityMode" })[k]
		if expected and v.EnumType ~= expected then
			error(string.format("%s expects Enum.%s, got Enum.%s", k, expected, v.EnumType), 2)
		end
	end
	if k == "Material" and type(v) == "table" and rawget(v, "Name") == "Water" then
		error("Material Water is terrain-only", 2)
	end
	props[k] = v
end

function Inst.IsA(self, c)
	local cls = rawget(self, "__cls")
	if cls == c or c == "Instance" then
		return true
	end
	local set = ISA[c]
	return set ~= nil and set[cls] == true
end
function Inst.GetChildren(self)
	return table.clone(rawget(self, "__children"))
end
function Inst.GetDescendants(self)
	local out = {}
	local function walk(i)
		for _, c in rawget(i, "__children") do
			table.insert(out, c)
			walk(c)
		end
	end
	walk(self)
	return out
end
function Inst.FindFirstChild(self, name)
	for _, c in rawget(self, "__children") do
		if c.Name == name then
			return c
		end
	end
	return nil
end
function Inst.WaitForChild(self, name)
	local c = Inst.FindFirstChild(self, name)
	if not c then
		error("WaitForChild would yield forever: " .. name, 2)
	end
	return c
end
function Inst.FindFirstChildOfClass(self, cls)
	for _, c in rawget(self, "__children") do
		if rawget(c, "__cls") == cls then
			return c
		end
	end
	return nil
end
function Inst.Destroy(self)
	self.Parent = nil
	rawset(self, "__destroyed", true)
end
function Inst.SetAttribute(self, k, v)
	local t = type(v)
	assert(t == "nil" or t == "number" or t == "string" or t == "boolean" or Mock.isC3(v) or isV3(v), "unsupported attribute type for " .. k)
	rawget(self, "__attrs")[k] = v
end
function Inst.GetAttribute(self, k)
	return rawget(self, "__attrs")[k]
end
function Inst.GetFullName(self)
	local parts = {}
	local i = self
	while i do
		table.insert(parts, 1, i.Name)
		i = rawget(i, "__parent")
		if i and rawget(i, "__cls") == "DataModel" then
			break
		end
	end
	return table.concat(parts, ".")
end
function Inst.GetAttributeChangedSignal()
	return { Connect = function() end }
end
function Inst.IsDescendantOf(self, other)
	local i = rawget(self, "__parent")
	while i do
		if i == other then
			return true
		end
		i = rawget(i, "__parent")
	end
	return false
end

Mock.Instance = { new = newInstance }
Mock.newInstance = newInstance

----------------------------------------------------------------------
-- terrain methods
----------------------------------------------------------------------
Mock.terrainStats = { writes = 0, voxels = 0, fills = 0, colors = 0, solid = 0, liquid = 0 }
local TerrainMethods = {}
function TerrainMethods.SetMaterialColor(self, mat, color)
	assert(type(mat) == "table" and mat.EnumType == "Material", "SetMaterialColor: material")
	assert(Mock.isC3(color), "SetMaterialColor: color")
	Mock.terrainStats.colors += 1
end
function TerrainMethods.FillBlock(self, c, size, mat)
	assert(isCF(c) and isV3(size) and mat.EnumType == "Material", "FillBlock args")
	Mock.terrainStats.fills += 1
end
local function checkRegion(region, res)
	assert(res == 4, "resolution must be 4")
	for _, axis in { "X", "Y", "Z" } do
		assert(region.Min[axis] % 4 == 0 and region.Max[axis] % 4 == 0, "region not aligned to the 4-stud grid: " .. axis)
	end
	return (region.Max.X - region.Min.X) / 4, (region.Max.Y - region.Min.Y) / 4, (region.Max.Z - region.Min.Z) / 4
end
function TerrainMethods.WriteVoxelChannels(self, region, res, channels)
	local nx, ny, nz = checkRegion(region, res)
	local mats, occ, liq = channels.SolidMaterial, channels.SolidOccupancy, channels.LiquidOccupancy
	assert(#mats == nx and #mats[1] == ny and #mats[1][1] == nz, string.format("channel size mismatch: %dx%dx%d vs %dx%dx%d", #mats, #mats[1], #mats[1][1], nx, ny, nz))
	for i = 1, nx do
		for j = 1, ny do
			for k = 1, nz do
				local o = occ[i][j][k]
				assert(o >= 0 and o <= 1, "occupancy out of range")
				if o > 0 then
					Mock.terrainStats.solid += 1
					assert(mats[i][j][k].Name ~= "Air", "solid voxel with Air material")
				end
				if liq[i][j][k] > 0 then
					Mock.terrainStats.liquid += 1
				end
			end
		end
	end
	Mock.terrainStats.writes += 1
	Mock.terrainStats.voxels += nx * ny * nz
end
Mock.TerrainMethods = TerrainMethods

return Mock
