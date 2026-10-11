-- Reference camera positions matching the attached concept images.
-- Used for comparison screenshots (WorldBuilder.Camera in Studio) and by the
-- optional client showcase camera (set the workspace attribute "ShowcaseCamera").

local function v(x: number, y: number, z: number): Vector3
	return Vector3.new(x, y, z)
end

return {
	-- Overview image: high, from the south, hub in the middle, sky islands at the top.
	Overview = { pos = v(40, 860, 1240), look = v(30, 150, -430), fov = 58 },
	-- Starter meadow: elevated view across the pond towards the teal pavilion.
	StarterMeadow = { pos = v(-60, 230, 640), look = v(-160, 132, 380), fov = 60 },
	-- Jungle dusk: from above the mushroom pavilion looking deeper into the terraces.
	Jungle = { pos = v(-470, 260, 330), look = v(-900, 180, -220), fov = 62 },
	-- Candy: from the south over the river towards the striped pavilion terrace.
	CandyCliffs = { pos = v(-470, 250, -560), look = v(-480, 200, -1060), fov = 60 },
	Volcano = { pos = v(560, 290, 60), look = v(1150, 260, -720), fov = 60 },
	SnowValley = { pos = v(560, 240, 260), look = v(1120, 150, 760), fov = 62 },
	SkyIslands = { pos = v(-120, 560, -1180), look = v(260, 500, -1680), fov = 60 },
}
