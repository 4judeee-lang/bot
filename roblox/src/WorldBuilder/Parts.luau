-- Part factory. Every static piece of scenery is created through here so anchoring,
-- collision flags and naming stay consistent across the whole map.

local Parts = {}

Parts.stats = { parts = 0, colliders = 0, lights = 0, emitters = 0 }

local function apply(inst: Instance, props: { [string]: any }?)
	if props then
		for k, v in props do
			(inst :: any)[k] = v
		end
	end
end

local function base(class: string, parent: Instance, cf: CFrame, size: Vector3, color: Color3, material: Enum.Material, opts: { [string]: any }?): BasePart
	local p = Instance.new(class) :: BasePart
	p.Anchored = true
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	local o = opts or {}
	if o.decor then
		-- Decorative detail: never blocks players, the camera or touch queries.
		p.CanCollide = false
		p.CanTouch = false
		p.CanQuery = false
		if o.shadow == nil and size.Magnitude < 6 then
			p.CastShadow = false
		end
	elseif o.noCollide then
		p.CanCollide = false
		p.CanTouch = false
	else
		p.CanTouch = false
	end
	if o.shadow ~= nil then
		p.CastShadow = o.shadow
	end
	if o.transparency then
		p.Transparency = o.transparency
	end
	if o.reflectance then
		p.Reflectance = o.reflectance
	end
	p.Name = o.name or class
	p.Parent = parent
	Parts.stats.parts += 1
	return p
end

function Parts.block(parent: Instance, cf: CFrame, size: Vector3, color: Color3, material: Enum.Material, opts: { [string]: any }?): Part
	return base("Part", parent, cf, size, color, material, opts) :: Part
end

function Parts.wedge(parent: Instance, cf: CFrame, size: Vector3, color: Color3, material: Enum.Material, opts: { [string]: any }?): WedgePart
	return base("WedgePart", parent, cf, size, color, material, opts) :: WedgePart
end

function Parts.corner(parent: Instance, cf: CFrame, size: Vector3, color: Color3, material: Enum.Material, opts: { [string]: any }?): CornerWedgePart
	return base("CornerWedgePart", parent, cf, size, color, material, opts) :: CornerWedgePart
end

-- Cylinder standing upright (Roblox cylinders run along the part's X axis).
function Parts.cyl(parent: Instance, pos: Vector3, height: number, diameter: number, color: Color3, material: Enum.Material, opts: { [string]: any }?): Part
	local p = base("Part", parent, CFrame.new(pos) * CFrame.Angles(0, 0, math.rad(90)), Vector3.new(height, diameter, diameter), color, material, opts) :: Part
	p.Shape = Enum.PartType.Cylinder
	return p
end

-- Cylinder whose axis runs from a to b.
function Parts.rod(parent: Instance, a: Vector3, b: Vector3, diameter: number, color: Color3, material: Enum.Material, opts: { [string]: any }?): Part
	local len = (b - a).Magnitude
	local cf = CFrame.lookAt((a + b) / 2, b) * CFrame.Angles(0, math.rad(90), 0)
	local p = base("Part", parent, cf, Vector3.new(math.max(len, 0.2), diameter, diameter), color, material, opts) :: Part
	p.Shape = Enum.PartType.Cylinder
	return p
end

-- Beam-like block spanning a to b.
function Parts.span(parent: Instance, a: Vector3, b: Vector3, width: number, thickness: number, color: Color3, material: Enum.Material, opts: { [string]: any }?): Part
	local len = (b - a).Magnitude
	return Parts.block(parent, CFrame.lookAt((a + b) / 2, b), Vector3.new(width, thickness, math.max(len, 0.2)), color, material, opts)
end

function Parts.ball(parent: Instance, pos: Vector3, diameter: number, color: Color3, material: Enum.Material, opts: { [string]: any }?): Part
	local p = base("Part", parent, CFrame.new(pos), Vector3.new(diameter, diameter, diameter), color, material, opts) :: Part
	p.Shape = Enum.PartType.Ball
	return p
end

-- Non-uniform ellipsoid: a block whose render mesh is a sphere scaled to the part size.
function Parts.ellipsoid(parent: Instance, cf: CFrame, size: Vector3, color: Color3, material: Enum.Material, opts: { [string]: any }?): Part
	local p = Parts.block(parent, cf, size, color, material, opts)
	local m = Instance.new("SpecialMesh")
	m.MeshType = Enum.MeshType.Sphere
	m.Parent = p
	return p
end

-- Invisible walkable collision. Visible geometry above it can stay non-colliding,
-- which keeps feet from snagging on plank seams and step edges.
function Parts.collider(parent: Instance, cf: CFrame, size: Vector3, name: string?): Part
	local p = base("Part", parent, cf, size, Color3.new(1, 1, 1), Enum.Material.SmoothPlastic, { name = name or "Collider", shadow = false }) :: Part
	p.Transparency = 1
	p.CanTouch = false
	Parts.stats.colliders += 1
	return p
end

-- Invisible collision wedge ramp from a low edge to a high edge, used under stairs.
function Parts.rampCollider(parent: Instance, a: Vector3, b: Vector3, width: number, name: string?): Part
	-- a = bottom-centre of the low end, b = top-centre of the high end (both on the walk surface)
	local thickness = 2
	local len = (b - a).Magnitude
	local cf = CFrame.lookAt((a + b) / 2, b) * CFrame.new(0, -thickness / 2, 0)
	return Parts.collider(parent, cf, Vector3.new(width, thickness, len + 0.6), name or "RampCollider")
end

function Parts.model(parent: Instance, name: string, props: { [string]: any }?): Model
	local m = Instance.new("Model")
	m.Name = name
	apply(m, props)
	m.Parent = parent
	return m
end

function Parts.folder(parent: Instance, name: string): Folder
	local existing = parent:FindFirstChild(name)
	if existing and existing:IsA("Folder") then
		return existing
	end
	local f = Instance.new("Folder")
	f.Name = name
	f.Parent = parent
	return f
end

function Parts.light(parent: Instance, class: string, props: { [string]: any }): Instance
	local l = Instance.new(class)
	apply(l, props)
	l.Parent = parent
	Parts.stats.lights += 1
	return l
end

function Parts.emitter(parent: Instance, props: { [string]: any }): ParticleEmitter
	local e = Instance.new("ParticleEmitter")
	apply(e, props)
	e.Parent = parent
	Parts.stats.emitters += 1
	return e
end

function Parts.reset()
	Parts.stats = { parts = 0, colliders = 0, lights = 0, emitters = 0 }
end

return Parts
