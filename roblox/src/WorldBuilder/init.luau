-- WorldBuilder: builds the complete creature-battling / egg-hatching world map.
--
-- Run from the Studio command bar (Edit mode), then save the place:
--     require(game.ServerStorage.WorldBuilder).Build()
-- Re-running is safe: it replaces Workspace.WorldMap, the terrain inside the world
-- bounds and the Lighting effects it created, and leaves everything else alone.
--
--     require(game.ServerStorage.WorldBuilder).Audit()          -- walk every route
--     require(game.ServerStorage.WorldBuilder).Camera("Jungle") -- jump to a reference view

local ServerStorage = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Util = require(script.Util)
local Layout = require(script.Layout)
local Field = require(script.Field)
local Parts = require(script.Parts)
local TerrainWriter = require(script.TerrainWriter)
local Network = require(script.Network)
local Dressing = require(script.Dressing)
local Markers = require(script.Markers)
local LightingSetup = require(script.LightingSetup)
local Audit = require(script.Audit)

local REGIONS = { "Hub", "StarterMeadow", "Jungle", "CandyCliffs", "Volcano", "SnowValley", "SkyIslands" }
local REGION_MODULES = {
	{ "Hub", script.Regions.Hub },
	{ "StarterMeadow", script.Regions.Meadow },
	{ "Jungle", script.Regions.Jungle },
	{ "CandyCliffs", script.Regions.Candy },
	{ "Volcano", script.Regions.Volcano },
	{ "SnowValley", script.Regions.Snow },
	{ "SkyIslands", script.Regions.Sky },
}
local BIOME_REGION = { [1] = "StarterMeadow", [2] = "Hub", [3] = "Jungle", [4] = "CandyCliffs", [5] = "Volcano", [6] = "SnowValley", [7] = "SkyIslands", [8] = "StarterMeadow" }

local WorldBuilder = {}
WorldBuilder.Layout = Layout
WorldBuilder.Field = Field

local function log(msg: string)
	print("[WorldBuilder] " .. msg)
end

local function makeContext(root: Instance)
	local regions = {}
	for _, name in REGIONS do
		local f = Instance.new("Folder")
		f.Name = name
		f.Parent = root
		regions[name] = f
	end
	local markerRoot = Instance.new("Folder")
	markerRoot.Name = "GameplayMarkers"
	markerRoot.Parent = root
	local ctx = { root = root }
	function ctx.region(name: string): Instance
		return regions[name] or regions.StarterMeadow
	end
	function ctx.regionAt(p: Vector3): string
		if Field.island(p.X, p.Z) and p.Y > 360 then
			return "SkyIslands"
		end
		local b = Field.sample(p.X, p.Z).biome
		if (b == 1 or b == 2) and Util.flat(p).Magnitude < 250 then
			return "Hub"
		end
		return BIOME_REGION[b] or "StarterMeadow"
	end
	function ctx.markers(kind: string): Instance
		return Parts.folder(markerRoot, kind)
	end
	return ctx
end

-- Streaming is a place setting; set it here so a fresh place is configured correctly.
local function configureStreaming(report)
	local settings = {
		StreamingEnabled = function()
			return true
		end,
		StreamingMinRadius = function()
			return 256
		end,
		StreamingTargetRadius = function()
			return 1024
		end,
		StreamOutBehavior = function()
			return Enum.StreamOutBehavior.Opportunistic
		end,
		StreamingIntegrityMode = function()
			return Enum.StreamingIntegrityMode.PauseOutsideLoadedArea
		end,
	}
	for k, v in settings do
		local ok, err = pcall(function()
			(workspace :: any)[k] = v()
		end)
		if not ok then
			table.insert(report, "Workspace." .. k .. " not set (" .. tostring(err) .. ") - set it in Studio properties")
		end
	end
end

-- A small library of reusable asset variants for designers (ServerStorage.WorldAssetLibrary).
local function buildLibrary()
	local old = ServerStorage:FindFirstChild("WorldAssetLibrary")
	if old then
		old:Destroy()
	end
	local lib = Instance.new("Folder")
	lib.Name = "WorldAssetLibrary"
	local rng = Random.new(Layout.SEED + 999)
	local Veg = require(script.Assets.Vegetation)
	local Props = require(script.Assets.Props)
	local Structures = require(script.Assets.Structures)
	local Palette = require(script.Palette)
	local x = 0
	local function slot(): Vector3
		x += 60
		return Vector3.new(x, 0, 0)
	end
	Veg.broadleaf(lib, slot(), 56, rng)
	Veg.jungleGiant(lib, slot(), 110, rng)
	Veg.palm(lib, slot(), 40, rng)
	Veg.pine(lib, slot(), 46, rng, true)
	Veg.lollipop(lib, slot(), 36, rng)
	Veg.mushroom(lib, slot(), 22, rng, Palette.mushroomPurple, true)
	Props.lantern(lib, slot(), "meadow", true)
	Props.crystal(lib, slot(), 14, rng, Palette.iceCrystal, true)
	Props.eggPedestal(lib, slot(), 8, Palette.eggs[1])
	Props.donutArch(lib, slot(), Vector3.new(0, 0, -1), 24, rng)
	local s = slot()
	Structures.bridge(lib, { s, s + Vector3.new(0, 0, -60) }, 24, "meadow", rng)
	s = slot()
	Structures.stairs(lib, s, s + Vector3.new(0, 20, -44), 24, { name = "Stairs", grounded = true })
	for _, m in lib:GetChildren() do
		if m:IsA("Model") then
			m:SetAttribute("LibraryAsset", true)
		end
	end
	lib.Parent = ServerStorage
end

function WorldBuilder.Build(options)
	local o = options or {}
	local t0 = os.clock()
	local warnings = {}
	Parts.reset()
	Field.init()
	if not ReplicatedStorage:FindFirstChild("WorldShared") then
		error("ReplicatedStorage.WorldShared is missing - sync the whole Rojo project before building")
	end

	local old = workspace:FindFirstChild("WorldMap")
	if old then
		old:Destroy()
	end
	local terrain = workspace.Terrain
	if not o.skipTerrain then
		log("clearing terrain inside the world bounds")
		TerrainWriter.clear(terrain)
		TerrainWriter.configure(terrain)
		log("writing terrain")
		local tstats = TerrainWriter.write(terrain, function(done, total)
			if done % 25 == 0 then
				log(string.format("terrain %d/%d chunks", done, total))
			end
		end)
		log(string.format("terrain done: %d chunks, %d voxels (%d solid)", tstats.chunks, tstats.voxels, tstats.solid))
	end

	local root = Instance.new("Folder")
	root.Name = "WorldMap"
	root:SetAttribute("BuiltBy", "WorldBuilder")
	root:SetAttribute("Seed", Layout.SEED)
	local ctx = makeContext(root)
	-- Build into an unparented folder so nothing renders half-finished, then parent once.
	log("building network (paths, bridges, stairs, waterways)")
	Network.build(ctx)
	log("dressing cliffs and islands")
	Dressing.build(ctx)
	for _, entry in REGION_MODULES do
		log("building " .. entry[1])
		require(entry[2]).build(ctx)
	end
	local markerCounts = Markers.build(ctx)

	-- Invisible boundary walls at the edge of the playable sea.
	local bounds = Parts.folder(root, "Boundaries")
	local H = Layout.HALF - 20
	-- parts are limited to 2,048 studs, so each side is two segments
	for _, side in { -1, 1 } do
		for _, half in { -1, 1 } do
			Parts.collider(bounds, CFrame.new(half * H / 2, 400, side * H), Vector3.new(H, 900, 4), "BoundaryWall")
			Parts.collider(bounds, CFrame.new(side * H, 400, half * H / 2), Vector3.new(4, 900, H), "BoundaryWall")
		end
	end

	root.Parent = workspace
	if not o.skipLighting then
		for _, line in LightingSetup.apply() do
			table.insert(warnings, line)
		end
	end
	configureStreaming(warnings)
	if not o.skipLibrary then
		buildLibrary()
	end

	local seconds = os.clock() - t0
	local summary = {
		seconds = seconds,
		parts = Parts.stats.parts,
		colliders = Parts.stats.colliders,
		lights = Parts.stats.lights,
		emitters = Parts.stats.emitters,
		bridges = #Network.bridges,
		markers = markerCounts,
		warnings = warnings,
	}
	log(string.format("done in %.1fs: %d parts (%d colliders), %d lights, %d emitters, %d bridges", seconds, summary.parts, summary.colliders, summary.lights, summary.emitters, summary.bridges))
	for _, w in warnings do
		warn("[WorldBuilder] " .. w)
	end
	if o.audit ~= false then
		local r = Audit.run(root)
		Audit.print(r)
		summary.audit = r
	end
	return summary
end

function WorldBuilder.Audit()
	Field.init()
	local root = workspace:FindFirstChild("WorldMap")
	assert(root, "build the world first")
	-- walkways are recomputed from the layout so the audit can run in a fresh session
	if #Network.walkways == 0 then
		for _, path in Layout.paths do
			local pts = Field.profiled(path)
			table.insert(Network.walkways, { name = path.id, pts = pts, width = path.width, kind = path.kind or "path" })
		end
	end
	local r = Audit.run(root)
	Audit.print(r)
	return r
end

-- Point the Studio camera at one of the reference views (for comparison screenshots).
function WorldBuilder.Camera(name: string)
	local cams = require(ReplicatedStorage.WorldShared.ReferenceCameras)
	local c = cams[name]
	assert(c, "unknown camera " .. tostring(name))
	local cam = workspace.CurrentCamera
	cam.CFrame = CFrame.lookAt(c.pos, c.look)
	cam.FieldOfView = c.fov
	return c
end

return WorldBuilder
