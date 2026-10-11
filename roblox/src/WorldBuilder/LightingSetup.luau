-- Global lighting, post-processing and sky. The client environment controller blends
-- from these defaults towards each biome's mood locally.

local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local LightingSetup = {}

-- `value` may be a function so that enum lookups which do not exist on this
-- engine version fail inside the pcall instead of erroring the whole build.
local function set(inst: Instance, prop: string, value: any, report)
	local ok, err = pcall(function()
		(inst :: any)[prop] = if type(value) == "function" then value() else value
	end)
	if not ok then
		table.insert(report, string.format("%s.%s not set: %s", inst.ClassName, prop, tostring(err)))
	end
	return ok
end

local function effect(class: string, name: string): Instance
	local existing = Lighting:FindFirstChild(name)
	if existing and existing.ClassName == class then
		return existing
	end
	if existing then
		existing:Destroy()
	end
	local e = Instance.new(class)
	e.Name = name
	e:SetAttribute("WorldBuilder", true)
	e.Parent = Lighting
	return e
end

function LightingSetup.apply(): { string }
	local report = {}
	local BiomeZones = require(ReplicatedStorage:WaitForChild("WorldShared"):WaitForChild("BiomeZones"))
	local mood = BiomeZones.Resolve("Default")

	-- Rendering: the new lighting pipeline when available, Future technology otherwise.
	set(Lighting, "LightingStyle", function()
		return (Enum :: any).LightingStyle.Realistic
	end, report)
	set(Lighting, "PrioritizeLightingQuality", true, report)
	set(Lighting, "Technology", function()
		return Enum.Technology.Future
	end, report)
	set(Lighting, "GlobalShadows", true, report)
	set(Lighting, "GeographicLatitude", 32, report)
	set(Lighting, "FogEnd", 100000, report)
	for k, v in mood.Lighting do
		set(Lighting, k, v, report)
	end

	local atmosphere = effect("Atmosphere", "WorldAtmosphere")
	for k, v in mood.Atmosphere do
		set(atmosphere, k, v, report)
	end
	local bloom = effect("BloomEffect", "WorldBloom")
	for k, v in mood.Bloom do
		set(bloom, k, v, report)
	end
	local cc = effect("ColorCorrectionEffect", "WorldColor")
	for k, v in mood.ColorCorrection do
		set(cc, k, v, report)
	end
	local rays = effect("SunRaysEffect", "WorldSunRays")
	for k, v in mood.SunRays do
		set(rays, k, v, report)
	end
	-- Default Roblox skybox textures, with a softer sun.
	local sky = effect("Sky", "WorldSky")
	set(sky, "SunAngularSize", 14, report)
	set(sky, "MoonAngularSize", 9, report)
	set(sky, "StarCount", 1500, report)

	-- Dynamic clouds give the puffy sky of the references.
	local terrain = workspace.Terrain
	local clouds = terrain:FindFirstChildOfClass("Clouds") or Instance.new("Clouds")
	set(clouds, "Cover", 0.52, report)
	set(clouds, "Density", 0.55, report)
	set(clouds, "Color", Color3.fromRGB(255, 255, 255), report)
	clouds.Parent = terrain
	return report
end

return LightingSetup
