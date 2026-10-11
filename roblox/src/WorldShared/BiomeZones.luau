-- Biome zones and lighting moods, shared by the server builder and the client
-- environment controller. Zones are pure data (no instances), so the client
-- controller keeps working while scenery streams in and out.

local BiomeZones = {}

local rgb = Color3.fromRGB

-- Lighting moods. Missing fields fall back to Default.
BiomeZones.Moods = {
	Default = {
		Lighting = {
			Brightness = 2.25, ExposureCompensation = 0.1, ClockTime = 14.2,
			Ambient = rgb(96, 104, 124), OutdoorAmbient = rgb(150, 160, 180),
			EnvironmentDiffuseScale = 0.8, EnvironmentSpecularScale = 0.35, ShadowSoftness = 0.7,
		},
		Atmosphere = { Density = 0.2, Offset = 0.22, Color = rgb(200, 226, 255), Decay = rgb(112, 156, 210), Glare = 0.15, Haze = 1.1 },
		Bloom = { Intensity = 0.2, Size = 24, Threshold = 1.4 },
		ColorCorrection = { Saturation = 0.14, Contrast = 0.06, Brightness = 0.02, TintColor = rgb(255, 252, 246) },
		SunRays = { Intensity = 0.04, Spread = 0.6 },
	},
	Jungle = {
		-- purple dusk, but walking ground stays well lit through ambient + exposure
		Lighting = {
			Brightness = 1.7, ExposureCompensation = 0.28, ClockTime = 17.4,
			Ambient = rgb(104, 92, 136), OutdoorAmbient = rgb(156, 136, 196),
		},
		Atmosphere = { Density = 0.3, Offset = 0.18, Color = rgb(184, 146, 226), Decay = rgb(96, 64, 150), Glare = 0.25, Haze = 1.7 },
		Bloom = { Intensity = 0.24, Size = 26, Threshold = 1.3 },
		ColorCorrection = { Saturation = 0.22, Contrast = 0.08, Brightness = 0.02, TintColor = rgb(246, 236, 255) },
		SunRays = { Intensity = 0.06, Spread = 0.5 },
	},
	Candy = {
		Lighting = { Brightness = 2.4, ExposureCompensation = 0.12, Ambient = rgb(118, 104, 126), OutdoorAmbient = rgb(176, 160, 184) },
		Atmosphere = { Density = 0.18, Color = rgb(255, 222, 238), Decay = rgb(250, 188, 220), Glare = 0.12, Haze = 1.0 },
		ColorCorrection = { Saturation = 0.2, Contrast = 0.05, Brightness = 0.03, TintColor = rgb(255, 246, 250) },
	},
	Volcano = {
		Lighting = {
			Brightness = 1.9, ExposureCompensation = 0.12, ClockTime = 16.6,
			Ambient = rgb(110, 88, 84), OutdoorAmbient = rgb(168, 136, 126),
		},
		Atmosphere = { Density = 0.32, Offset = 0.2, Color = rgb(206, 128, 96), Decay = rgb(120, 52, 40), Glare = 0.3, Haze = 2.0 },
		Bloom = { Intensity = 0.26, Size = 26, Threshold = 1.35 },
		ColorCorrection = { Saturation = 0.1, Contrast = 0.12, Brightness = 0.0, TintColor = rgb(255, 236, 222) },
		SunRays = { Intensity = 0.03, Spread = 0.4 },
	},
	Snow = {
		Lighting = { Brightness = 2.3, ExposureCompensation = 0.0, Ambient = rgb(104, 116, 138), OutdoorAmbient = rgb(160, 176, 200) },
		Atmosphere = { Density = 0.22, Color = rgb(222, 236, 255), Decay = rgb(170, 200, 240), Glare = 0.1, Haze = 1.3 },
		ColorCorrection = { Saturation = 0.05, Contrast = 0.06, Brightness = 0.0, TintColor = rgb(240, 248, 255) },
	},
	Sky = {
		Lighting = { Brightness = 2.6, ExposureCompensation = 0.05, Ambient = rgb(110, 116, 136), OutdoorAmbient = rgb(170, 176, 196) },
		Atmosphere = { Density = 0.12, Offset = 0.3, Color = rgb(222, 236, 255), Decay = rgb(250, 222, 172), Glare = 0.3, Haze = 0.8 },
		Bloom = { Intensity = 0.22, Size = 24, Threshold = 1.4 },
		ColorCorrection = { Saturation = 0.12, Contrast = 0.05, Brightness = 0.03, TintColor = rgb(255, 250, 238) },
		SunRays = { Intensity = 0.08, Spread = 0.7 },
	},
}

-- Zones: ellipses on XZ with an optional height band. The highest priority zone
-- containing the camera subject wins; ties go to the zone whose centre is nearest.
BiomeZones.Zones = {
	{ Name = "Sky", Mood = "Sky", Priority = 3, Center = Vector2.new(260, -1500), Radii = Vector2.new(700, 460), MinY = 385 },
	{ Name = "Jungle", Mood = "Jungle", Priority = 2, Center = Vector2.new(-1110, -30), Radii = Vector2.new(620, 700) },
	{ Name = "Candy", Mood = "Candy", Priority = 2, Center = Vector2.new(-470, -1000), Radii = Vector2.new(450, 450) },
	{ Name = "Volcano", Mood = "Volcano", Priority = 2, Center = Vector2.new(1090, -780), Radii = Vector2.new(640, 640) },
	{ Name = "Snow", Mood = "Snow", Priority = 2, Center = Vector2.new(1110, 660), Radii = Vector2.new(570, 600) },
}

BiomeZones.BlendTime = 4 -- seconds

function BiomeZones.ZoneAt(pos: Vector3)
	local best, bestPri, bestD = nil, -math.huge, math.huge
	for _, z in BiomeZones.Zones do
		local dx = (pos.X - z.Center.X) / z.Radii.X
		local dz = (pos.Z - z.Center.Y) / z.Radii.Y
		local d = dx * dx + dz * dz
		if d <= 1 and (not z.MinY or pos.Y >= z.MinY) and (not z.MaxY or pos.Y <= z.MaxY) then
			if z.Priority > bestPri or (z.Priority == bestPri and d < bestD) then
				best, bestPri, bestD = z, z.Priority, d
			end
		end
	end
	return best
end

-- Mood merged over Default so every property always has a target.
function BiomeZones.Resolve(moodName: string?)
	local base = BiomeZones.Moods.Default
	local mood = moodName and BiomeZones.Moods[moodName] or base
	local out = {}
	for group, props in base do
		out[group] = table.clone(props)
		if mood[group] then
			for k, v in mood[group] do
				out[group][k] = v
			end
		end
	end
	return out
end

return BiomeZones
