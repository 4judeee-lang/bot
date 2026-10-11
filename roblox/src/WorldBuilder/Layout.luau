-- World layout: the single source of truth for where everything goes.
-- Units are studs. +X = east, -Z = north, +Y = up. The overview reference is
-- viewed from the south looking north, so "foreground" is +Z.
--
-- Every number here was chosen against the overview image:
--   hub/egg pavilion in the middle, starter meadow towards the camera (south),
--   jungle west, candy north-west/north, volcano north-east/east,
--   snow south-east, golden sky islands high up behind the north.

local Layout = {}

local function v(x: number, y: number, z: number): Vector3
	return Vector3.new(x, y, z)
end

Layout.SEED = 20261011
Layout.HALF = 1800 -- world spans -1800..1800 on X and Z (3,600 x 3,600 studs)
Layout.OCEAN_LEVEL = 92
Layout.LOWLAND = 118
Layout.SPAWN = v(0, 140, 112)

----------------------------------------------------------------------
-- Biomes (material sets, scatter rules and client lighting moods)
----------------------------------------------------------------------
Layout.BIOME = { meadow = 1, hub = 2, jungle = 3, candy = 4, volcano = 5, snow = 6, sky = 7, beach = 8 }

-- Soft biome areas; materials blend across ~100 studs at their borders.
Layout.biomes = {
	{ id = 2, c = { 0, 0 }, r = { 235, 235 }, edge = 90 },
	{ id = 1, c = { 0, 690 }, r = { 430, 560 }, edge = 110 },
	{ id = 1, c = { 60, -830 }, r = { 230, 430 }, edge = 110 }, -- northern ridge to the sky gate
	{ id = 3, c = { -1110, -30 }, r = { 650, 730 }, edge = 120 },
	{ id = 4, c = { -470, -1000 }, r = { 470, 480 }, edge = 100 },
	{ id = 5, c = { 1090, -780 }, r = { 660, 660 }, edge = 110 },
	{ id = 6, c = { 1110, 660 }, r = { 590, 620 }, edge = 110 },
}

----------------------------------------------------------------------
-- Height features, applied in order. kind:
--   blob  : ellipse plateau. mode set|max|min, h, edge falloff, optional tilt {tx,tz}
--   cone  : volcano cone (max)
--   lake  : bowl with water
-- "cliff = true" marks a terrace edge that gets faceted rock dressing.
----------------------------------------------------------------------
Layout.features = {
	-- Hub plateau and starter meadow (meadow slopes gently down towards the beach)
	{ kind = "blob", name = "HubPlateau", c = { 0, 0 }, r = { 215, 215 }, h = 140, edge = 42, roll = 0, cliff = true, biome = 2 },
	{ kind = "blob", name = "Meadow", c = { 0, 650 }, r = { 360, 470 }, h = 122.8, tilt = { 0, -0.0269 }, edge = 80, roll = 2.2 },
	{ kind = "blob", name = "Beach", c = { 0, 1190 }, r = { 950, 170 }, h = 98, edge = 90, roll = 1, mode = "set" },
	{ kind = "blob", name = "CaveRidge", c = { -230, 650 }, r = { 70, 120 }, h = 172, edge = 22, roll = 4, outline = 10, cliff = true },

	-- Jungle: lowland floor, mid terrace, upper ruin terrace, back highlands
	{ kind = "blob", name = "JungleFloor", c = { -1100, -20 }, r = { 640, 700 }, h = 142, edge = 90, roll = 2.5 },
	{ kind = "blob", name = "JungleMid", c = { -1150, -150 }, r = { 300, 320 }, h = 205, edge = 30, roll = 1.5, outline = 22, cliff = true },
	{ kind = "blob", name = "JungleUpper", c = { -1420, -420 }, r = { 230, 220 }, h = 300, edge = 30, roll = 1.5, outline = 18, cliff = true },
	{ kind = "blob", name = "JungleHighland", c = { -1560, -760 }, r = { 260, 170 }, h = 328, edge = 60, roll = 8, outline = 26, mode = "max" },
	{ kind = "blob", name = "JungleSouthHill", c = { -1380, 520 }, r = { 220, 160 }, h = 205, edge = 70, roll = 10, outline = 30, mode = "max" },

	-- Candy cliffs: base bowl, pavilion terrace, high back cliffs with lollipops
	{ kind = "blob", name = "CandyBase", c = { -470, -980 }, r = { 460, 430 }, h = 160, edge = 80, roll = 1.5 },
	{ kind = "blob", name = "CandyL2", c = { -470, -1080 }, r = { 230, 150 }, h = 215, edge = 22, roll = 0.8, outline = 12, cliff = true, frosting = true },
	{ kind = "blob", name = "CandyL3", c = { -470, -1330 }, r = { 420, 130 }, h = 290, edge = 24, roll = 0.8, outline = 14, cliff = true, frosting = true },
	{ kind = "blob", name = "CandyBack", c = { -720, -1470 }, r = { 230, 100 }, h = 330, edge = 26, roll = 2, outline = 14, cliff = true, frosting = true, mode = "max" },

	-- Northern ridge: a natural ramp from the hub up to the sky gate, joined to candy L3
	{ kind = "blob", name = "NorthSlope", c = { 60, -740 }, r = { 200, 380 }, h = 220, tilt = { 0, -0.2059 }, edge = 60, roll = 2 },
	{ kind = "blob", name = "NorthRidge", c = { -20, -1170 }, r = { 280, 150 }, h = 290, edge = 50, roll = 2 },

	-- Volcano: base plateau, mid terrace, upper arena terrace, then the cone
	{ kind = "blob", name = "VolcanoBase", c = { 1050, -640 }, r = { 600, 560 }, h = 160, edge = 90, roll = 2 },
	{ kind = "blob", name = "VolcanoT2", c = { 1100, -720 }, r = { 380, 330 }, h = 235, edge = 26, roll = 1.5, outline = 20, cliff = true },
	{ kind = "blob", name = "VolcanoT3", c = { 1250, -900 }, r = { 280, 220 }, h = 310, edge = 26, roll = 1.5, outline = 16, cliff = true },
	{ kind = "cone", name = "VolcanoCone", c = { 1420, -1360 }, peak = 545, slope = 1.7, crater = { r = 50, depth = 30 } },

	-- Snow and crystal valley: lowland, hatch ledge, upper terrace, ice cave ridge
	{ kind = "blob", name = "SnowLowland", c = { 1100, 620 }, r = { 520, 520 }, h = 115, edge = 90, roll = 2.5 },
	{ kind = "blob", name = "SnowLedge", c = { 900, 350 }, r = { 160, 130 }, h = 150, edge = 30, roll = 1, outline = 10, cliff = true },
	{ kind = "blob", name = "SnowUpper", c = { 1300, 700 }, r = { 280, 260 }, h = 205, edge = 28, roll = 1.5, outline = 18, cliff = true },
	{ kind = "blob", name = "SnowCaveRidge", c = { 1500, 950 }, r = { 150, 120 }, h = 275, edge = 24, roll = 3, outline = 12, cliff = true, mode = "max" },
	{ kind = "blob", name = "SnowEastHills", c = { 1600, 420 }, r = { 120, 220 }, h = 280, edge = 70, roll = 10, outline = 24, mode = "max" },

	-- Water bodies
	{ kind = "lake", name = "StarterPond", c = { 175, 680 }, r = { 90, 70 }, bottom = 111, level = 120 },
	{ kind = "lake", name = "FrozenLake", c = { 950, 800 }, r = { 150, 110 }, bottom = 96, level = 104 },
	{ kind = "lake", name = "LavaPoolWest", c = { 640, -480 }, r = { 46, 40 }, bottom = 140, level = 148, lava = true },
	{ kind = "lake", name = "LavaPoolEast", c = { 1350, -250 }, r = { 46, 40 }, bottom = 140, level = 148, lava = true },
}

-- Paved plazas (painted with the path material of their style).
Layout.plazas = {
	{ c = { 0, 0 }, r = 150, style = "hub" }, -- 300-stud paved hub
	{ c = { 318, -1690 }, r = 60, style = "sky", island = true },
}

----------------------------------------------------------------------
-- Named path nodes (x, walk height, z). Heights are the walk surface.
----------------------------------------------------------------------
local N = {
	-- hub
	hubS = v(0, 140, 165), hubN = v(0, 140, -165), hubW = v(-165, 140, 0), hubE = v(165, 140, 0),
	-- starter meadow
	mN = v(0, 133, 270), mJ1 = v(0, 131, 380), mPavE = v(-110, 131, 380), mM1W = v(100, 133, 296), mM1E = v(230, 133, 300),
	mJ2 = v(20, 122, 690), mDock1 = v(60, 123, 622), mDockA = v(150, 122.6, 603), mCaveA = v(-100, 123, 655), mCaveMouth = v(-150, 124, 650), mCaveEnd = v(-252, 124, 648),
	mJ3 = v(50, 117, 900), mM2E = v(-55, 118, 860), mM3W = v(190, 117, 880), mM3E = v(320, 117, 896), mBeach = v(40, 100, 1110),
	mW1 = v(-110, 121, 790), mW2 = v(-300, 118, 832),
	-- jungle
	jE = v(-480, 141, 0), jJ1 = v(-610, 141, 20), jPavE = v(-560, 142, 82), jJ2 = v(-700, 141, -120), jM1 = v(-670, 141, -182),
	jR0 = v(-740, 146, -330), jR1 = v(-850, 186, -470), jM = v(-1000, 205, -345), jBr = v(-1110, 205, -175), jM2 = v(-1150, 205, -135),
	jU0 = v(-1272, 206, -75), jU1 = v(-1400, 248, -190), jU2 = v(-1480, 286, -310), jU3 = v(-1455, 300, -360),
	jS0 = v(-700, 141, 60), jSx = v(-732, 133.5, 92), jS1 = v(-820, 141, 175), jL2 = v(-900, 143, 300), jL3 = v(-740, 141, 420),
	jL4 = v(-520, 141, 285), jS2 = v(-620, 126, 720),
	-- candy
	nJ1 = v(30, 152, -430), cE = v(-170, 160, -700), cC1 = v(-200, 160, -650), cJ1 = v(-350, 160, -790), cStA = v(-470, 160, -790),
	cStB = v(-470, 160, -815), cStT = v(-470, 215, -935), cPavE = v(-470, 215, -1000),
	cR0 = v(-235, 160, -880), cR1 = v(-270, 215, -1070), cL2a = v(-360, 215, -990),
	cU0 = v(-290, 216, -1150), cU1 = v(-180, 250, -1250), cU2 = v(-300, 290, -1340), cU3 = v(-240, 290, -1400), cC3 = v(-475, 290, -1335),
	cW1 = v(-725, 160, -880), cN1 = v(-60, 290, -1300), cN2 = v(0, 290, -1000), cN3 = v(150, 291, -1000),
	-- north ridge / sky gate
	nJ2 = v(60, 198, -650), nJ3 = v(90, 245, -870), nJ4 = v(200, 280, -980), skyGate = v(215, 292, -1050),
	-- volcano
	vE0 = v(420, 146, -70), vE = v(530, 152, -150), vJ1 = v(650, 160, -250), vPavE = v(722, 160, -260), vJ2 = v(800, 160, -380),
	vR1 = v(960, 195, -430), vR2 = v(1060, 235, -520), vM = v(1050, 235, -640), vV2 = v(1150, 235, -620),
	vU1 = v(1130, 268, -735), vU2 = v(1230, 310, -850),
	vV1a = v(700, 156, -140), vV1W = v(855, 158, -150), vV1E = v(1005, 158, -165), vL1 = v(1150, 162, -300), vL2 = v(1280, 198, -420), vL3 = v(1250, 235, -532),
	vX1 = v(860, 235, -735), vCv0 = v(930, 235, -880), vCaveMouth = v(978, 235, -880), vCaveEnd = v(1070, 235, -892),
	vS1 = v(600, 142, 80), sC2W = v(702, 134, 160),
	-- snow
	sE = v(460, 126, 440), sJ1 = v(650, 130, 380), sPavE = v(868, 150, 334), sS1W = v(745, 117, 565), sS1E = v(875, 116, 610),
	sU0 = v(1080, 118, 580), sU1 = v(1180, 150, 470), sU2 = v(1290, 182, 490), sU3 = v(1360, 205, 580), sSA = v(1336, 205, 626),
	sArS = v(1332, 205, 815), sCv1 = v(1300, 205, 895), sCv0 = v(1312, 205, 945), sCaveMouth = v(1356, 205, 950), sCaveEnd = v(1452, 205, 962),
	sArW = v(1240, 205, 740), sStA = v(1064.5, 205, 762.5), sSt0 = v(1060, 205, 780), sSt1 = v(1020, 112, 935), sStB = v(1015.5, 112, 952.5), sL1 = v(850, 110, 990), sL2 = v(560, 112, 1010),
}
Layout.nodes = N

----------------------------------------------------------------------
-- Rivers and lava channels. Each node carries the water level of the
-- segment that starts there; a level change at a node is a waterfall.
----------------------------------------------------------------------
Layout.rivers = {
	{
		name = "WestRiver", width = 46, depth = 9, bank = 0.8,
		nodes = {
			{ -780, -1400, 287, 40 }, { -778, -1236, 150, 46 }, { -700, -950, 150, 51 }, { -560, -760, 150, 54 },
			{ -440, -655, 112, 59 }, { -380, -560, 112, 65 }, { -330, -420, 112, 68 }, { -300, -150, 112, 70 },
			{ -290, 100, 112, 70 }, { -330, 420, 112, 73 }, { -400, 700, 104, 76 }, { -440, 1000, 104, 78 },
			{ -470, 1330, 92, 81 },
		},
	},
	{
		name = "EastRiver", width = 46, depth = 9, bank = 0.8,
		nodes = {
			{ 452, -430, 120, 40 }, { 330, -120, 112, 59 }, { 300, 150, 112, 68 }, { 320, 450, 112, 70 },
			{ 420, 800, 104, 73 }, { 520, 1050, 104, 76 }, { 560, 1330, 92, 78 },
		},
	},
	{
		name = "JungleStream", width = 34, depth = 8, bank = 1.1,
		nodes = {
			{ -1330, -560, 292, 24 }, { -1195, -390, 198, 30 }, { -1050, -260, 198, 32 }, { -900, -120, 198, 32 },
			{ -850, -95, 132, 36 }, { -760, -30, 132, 38 }, { -720, 150, 132, 40 }, { -640, 300, 132, 40 },
			{ -480, 430, 118, 42 }, { -375, 470, 112, 44 },
		},
	},
	{
		name = "SnowStream", width = 36, depth = 8, bank = 0.9,
		nodes = {
			{ 1460, 600, 201, 26 }, { 1440, 470, 108, 32 }, { 1200, 380, 108, 36 }, { 1040, 520, 108, 38 },
			{ 960, 700, 104, 40 }, { 800, 890, 104, 40 }, { 620, 940, 104, 40 }, { 485, 950, 104, 40 },
		},
	},
	{
		name = "LavaFlowWest", lava = true, width = 30, depth = 6, bank = 1.2,
		nodes = {
			{ 1100, -1040, 296, 24 }, { 1040, -860, 296, 28 }, { 988, -825, 222, 30 }, { 850, -660, 222, 30 },
			{ 727, -600, 148, 32 }, { 640, -480, 148, 34 },
		},
	},
	{
		name = "LavaFlowEast", lava = true, width = 30, depth = 6, bank = 1.2,
		nodes = {
			{ 1450, -880, 296, 24 }, { 1455, -760, 222, 28 }, { 1450, -600, 148, 30 }, { 1390, -340, 148, 32 }, { 1350, -250, 148, 34 },
		},
	},
}

----------------------------------------------------------------------
-- Flat pads: clearings (kept open for combat) and pavilion sites.
----------------------------------------------------------------------
Layout.clearings = {
	-- name, biome, centre (walk height), radius, boss arena?
	{ name = "MeadowClearing1", biome = "StarterMeadow", c = v(165, 133, 300), r = 65 },
	{ name = "MeadowClearing2", biome = "StarterMeadow", c = v(-120, 118, 850), r = 65 },
	{ name = "MeadowClearing3", biome = "StarterMeadow", c = v(255, 117, 880), r = 65 },
	{ name = "JungleClearing1", biome = "Jungle", c = v(-660, 141, -255), r = 75 },
	{ name = "JungleClearing2", biome = "Jungle", c = v(-1190, 205, -60), r = 85 },
	{ name = "JungleRuinArena", biome = "Jungle", c = v(-1450, 300, -460), r = 105, arena = true },
	{ name = "CandyClearing1", biome = "CandyCliffs", c = v(-260, 160, -620), r = 70 },
	{ name = "CandyClearing2", biome = "CandyCliffs", c = v(-790, 160, -900), r = 70 },
	{ name = "CandyDonutArena", biome = "CandyCliffs", c = v(-560, 290, -1330), r = 90, arena = true },
	{ name = "VolcanoClearing1", biome = "Volcano", c = v(930, 158, -160), r = 75 },
	{ name = "VolcanoClearing2", biome = "Volcano", c = v(1230, 235, -610), r = 80 },
	{ name = "VolcanoCraterArena", biome = "Volcano", c = v(1260, 310, -960), r = 105, arena = true },
	{ name = "SnowClearing1", biome = "SnowValley", c = v(800, 116, 620), r = 75 },
	{ name = "SnowClearing2", biome = "SnowValley", c = v(760, 132, 170), r = 60 },
	{ name = "SnowGlacierArena", biome = "SnowValley", c = v(1330, 205, 720), r = 95, arena = true },
	{ name = "SkyMeadow1", biome = "SkyIslands", c = v(200, 400, -1270), r = 55, island = true },
	{ name = "SkyMeadow2", biome = "SkyIslands", c = v(-170, 425, -1500), r = 55, island = true },
	{ name = "SkyGardenArena", biome = "SkyIslands", c = v(680, 460, -1480), r = 100, arena = true, island = true },
}

-- Hatch pavilions. face = direction the entrance opens towards.
Layout.pavilions = {
	{ name = "CentralEggPavilion", style = "central", biome = "Hub", pos = v(0, 140, 0), face = v(0, 0, 1), pad = 0 },
	{ name = "StarterHatchPavilion", style = "timber", biome = "StarterMeadow", pos = v(-175, 131, 380), face = v(1, 0, 0), pad = 66 },
	{ name = "MushroomHatchPavilion", style = "mushroom", biome = "Jungle", pos = v(-560, 142, 140), face = v(0, 0, -1), pad = 64 },
	{ name = "CandyHatchPavilion", style = "candy", biome = "CandyCliffs", pos = v(-470, 215, -1062), face = v(0, 0, 1), pad = 62 },
	{ name = "MoltenHatchPavilion", style = "volcano", biome = "Volcano", pos = v(785, 160, -260), face = v(-1, 0, 0), pad = 62 },
	{ name = "FrostHatchPavilion", style = "ice", biome = "SnowValley", pos = v(930, 150, 330), face = v(-1, 0, 0), pad = 58 },
	{ name = "GoldenHatchPavilion", style = "golden", biome = "SkyIslands", pos = v(-150, 425, -1700), face = v(1, 0, 0.15), pad = 0 },
}

----------------------------------------------------------------------
-- Sky islands (built as separate terrain bodies) and their links.
----------------------------------------------------------------------
Layout.islands = {
	{ name = "GateIsle", c = { 150, -1350 }, r = 150, h = 400, depth = 80 },
	{ name = "PoolIsle", c = { -180, -1600 }, r = 175, h = 425, depth = 92, pool = { c = { -255, -1610 }, r = 46 } },
	{ name = "TempleIsle", c = { 330, -1720 }, r = 190, h = 480, depth = 125, pool = { c = { 215, -1790 }, r = 30 } },
	{ name = "GardenIsle", c = { 650, -1460 }, r = 165, h = 460, depth = 105 },
	-- distant decorative islands (not connected)
	{ name = "Islet1", c = { -420, -1720 }, r = 42, h = 520, depth = 50, decor = true },
	{ name = "Islet2", c = { 560, -1760 }, r = 36, h = 600, depth = 46, decor = true },
	{ name = "Islet3", c = { 860, -1660 }, r = 48, h = 540, depth = 56, decor = true },
	{ name = "Islet4", c = { -30, -1350 }, r = 30, h = 470, depth = 38, decor = true },
	{ name = "Islet5", c = { 880, -1300 }, r = 40, h = 430, depth = 48, decor = true },
	{ name = "Islet6", c = { 40, -1770 }, r = 34, h = 590, depth = 40, decor = true },
	{ name = "Islet7", c = { -330, -1360 }, r = 28, h = 500, depth = 34, decor = true },
}

local function isl(name: string)
	for _, i in Layout.islands do
		if i.name == name then
			return i
		end
	end
	error("unknown island " .. name)
end

-- Point on island a, `inset` studs from its centre, heading towards island b.
local function towards(a: string, b: string, inset: number, h: number?): Vector3
	local A, B = isl(a), isl(b)
	local dx, dz = B.c[1] - A.c[1], B.c[2] - A.c[2]
	local len = math.sqrt(dx * dx + dz * dz)
	return v(A.c[1] + dx / len * inset, h or A.h, A.c[2] + dz / len * inset)
end

-- Island walks run level to each island edge; bridges and the temple stairway span
-- edge to edge, so every ramp stays under 20 degrees (stairway under 30).
N.i1c = v(110, 400, -1330)
N.i1Stair = v(80, 400, -1240)
N.b1a = towards("GateIsle", "PoolIsle", 146)
N.b1b = towards("PoolIsle", "GateIsle", 171)
N.i2c = v(-150, 425, -1590)
N.b2a = towards("PoolIsle", "TempleIsle", 171)
N.b2b = towards("TempleIsle", "PoolIsle", 186)
N.gsA = towards("GateIsle", "TempleIsle", 80)
N.gsB = towards("TempleIsle", "GateIsle", 186)
N.b3a = towards("TempleIsle", "GardenIsle", 186)
N.b3b = towards("GardenIsle", "TempleIsle", 161)
N.b4a = towards("GateIsle", "GardenIsle", 146)
N.b4b = towards("GardenIsle", "GateIsle", 161)
N.i2Pav = v(-92, 425, -1688)
N.tPlaza = v(318, 480, -1690)
N.i4c = v(590, 460, -1470)

-- Celestial stair: five switchback flights from the sky gate up to the gate isle.
N.t0 = v(160, 292, -1050)
N.t1 = v(80, 313.6, -1050)
N.t2 = v(80, 313.6, -1080)
N.t3 = v(160, 335.2, -1080)
N.t4 = v(160, 335.2, -1110)
N.t5 = v(80, 356.8, -1110)
N.t6 = v(80, 356.8, -1140)
N.t7 = v(160, 378.4, -1140)
N.t8 = v(160, 378.4, -1170)
N.t9 = v(80, 400, -1170)

----------------------------------------------------------------------
-- Path network. kind:
--   path   : terrain is cut/filled to the walk height; gaps become bridges
--   stairs : terrain flattened just under visible steps + smooth ramp collider
--   cave   : walkable tunnel carved into a cliff
--   sky    : painted onto island tops; gaps between islands become sky bridges
--   struct : free-standing architecture (celestial stair flights & landings)
-- width: main 30, secondary 16-20. biome decides materials and bridge style.
----------------------------------------------------------------------
Layout.paths = {
	-- Hub spokes and the starter meadow
	{ id = "HubToMeadow", biome = "meadow", width = 34, nodes = { "hubS", "mN", "mJ1", "mJ2", "mJ3", "mBeach" } },
	{ id = "MeadowToPavilion", biome = "meadow", width = 30, nodes = { "mJ1", "mPavE" } },
	{ id = "MeadowToClearing1", biome = "meadow", width = 24, nodes = { "mN", "mM1W" } },
	{ id = "MeadowToDock", biome = "meadow", width = 18, nodes = { "mJ2", "mDock1", "mDockA" } },
	{ id = "MeadowToCave", biome = "meadow", width = 20, nodes = { "mJ2", "mCaveA", "mCaveMouth" } },
	{ id = "MeadowCave", biome = "meadow", kind = "cave", width = 22, height = 26, chamber = 30, nodes = { "mCaveMouth", "mCaveEnd" } },
	{ id = "MeadowToClearing2", biome = "meadow", width = 18, nodes = { "mJ3", "mM2E" } },
	{ id = "MeadowToClearing3", biome = "meadow", width = 18, nodes = { "mJ3", "mM3W" } },

	-- Hub -> Jungle (main) and the meadow -> jungle south loop
	{ id = "HubToJungle", biome = "jungle", width = 32, nodes = { "hubW", "jE", "jJ1", "jPavE" } },
	{ id = "JungleToClearing1", biome = "jungle", width = 28, nodes = { "jJ1", "jJ2", "jM1" } },
	{ id = "JungleHillside", biome = "jungle", width = 26, nodes = { "jJ2", "jR0", "jR1", "jM", "jBr", "jM2" } },
	{ id = "JungleRuinClimb", biome = "jungle", width = 24, nodes = { "jU0", "jU1", "jU2", "jU3" } },
	{ id = "JungleRiverLoop", biome = "jungle", width = 20, crossing = "stones", nodes = { "jJ1", "jS0", "jSx", "jS1", "jL2", "jL3", "jL4", "jE" } },
	{ id = "MeadowToJungleSouth", biome = "meadow", width = 22, nodes = { "mJ2", "mW1", "mW2", "jS2", "jL3" } },

	-- Hub -> north ridge -> sky gate, with the candy branch
	{ id = "HubToSkyGate", biome = "meadow", width = 32, nodes = { "hubN", "nJ1", "nJ2", "nJ3", "nJ4", "skyGate" } },
	{ id = "SkyGateApproach", biome = "meadow", width = 24, nodes = { "skyGate", "t0" } },
	{ id = "NorthToCandy", biome = "candy", width = 30, nodes = { "nJ1", "cE", "cJ1", "cStA" } },
	{ id = "CandyStairsFoot", biome = "candy", width = 30, nodes = { "cStA", "cStB" } },
	{ id = "CandyToClearing1", biome = "candy", width = 20, nodes = { "cE", "cC1" } },
	{ id = "CandyGrandStairs", biome = "candy", kind = "stairs", width = 36, nodes = { "cStB", "cStT" } },
	{ id = "CandyTerrace", biome = "candy", width = 30, nodes = { "cStT", "cPavE" } },
	{ id = "CandyEastRamp", biome = "candy", width = 24, nodes = { "cJ1", "cR0", "cR1", "cL2a", "cPavE" } },
	{ id = "CandyUpperClimb", biome = "candy", width = 22, nodes = { "cR1", "cU0", "cU1", "cU2", "cC3" } },
	{ id = "CandyToSkyGate", biome = "candy", width = 22, nodes = { "cU2", "cU3", "cN1", "cN2", "cN3", "skyGate" } },
	{ id = "CandyWaferCrossing", biome = "candy", width = 24, nodes = { "cStA", "cW1" } },

	-- Hub -> volcano, its terraces, the crystal cave and the lower loop
	{ id = "HubToVolcano", biome = "volcano", width = 32, nodes = { "hubE", "vE0", "vE", "vJ1", "vPavE" } },
	{ id = "VolcanoClimb", biome = "volcano", width = 28, nodes = { "vJ1", "vJ2", "vR1", "vR2", "vM", "vV2" } },
	{ id = "VolcanoSummitClimb", biome = "volcano", width = 26, nodes = { "vM", "vU1", "vU2" } },
	{ id = "VolcanoLowerRoute", biome = "volcano", width = 22, nodes = { "vE", "vV1a", "vV1W" } },
	{ id = "VolcanoLowerLoop", biome = "volcano", width = 22, nodes = { "vV1E", "vL1", "vL2", "vL3" } },
	{ id = "VolcanoToCrystalCave", biome = "volcano", width = 24, nodes = { "vM", "vX1", "vCv0", "vCaveMouth" } },
	{ id = "VolcanoCrystalCave", biome = "volcano", kind = "cave", width = 24, height = 26, chamber = 34, nodes = { "vCaveMouth", "vCaveEnd" } },
	{ id = "VolcanoToSnow", biome = "volcano", width = 24, nodes = { "vE", "vS1", "sJ1" } },
	{ id = "SnowToClearing2", biome = "snow", width = 18, nodes = { "vS1", "sC2W" } },

	-- Meadow / volcano -> snow, the valley loop, upper terrace and ice cave
	{ id = "MeadowToSnow", biome = "snow", width = 30, nodes = { "mM1E", "sE", "sJ1", "sPavE" } },
	{ id = "SnowToClearing1", biome = "snow", width = 24, nodes = { "sJ1", "sS1W" } },
	{ id = "SnowUpperClimb", biome = "snow", width = 26, nodes = { "sS1E", "sU0", "sU1", "sU2", "sU3", "sSA" } },
	{ id = "SnowToIceCave", biome = "snow", width = 22, nodes = { "sArS", "sCv1", "sCv0", "sCaveMouth" } },
	{ id = "SnowIceCave", biome = "snow", kind = "cave", width = 22, height = 24, chamber = 30, nodes = { "sCaveMouth", "sCaveEnd" } },
	{ id = "SnowArenaToStairs", biome = "snow", width = 24, nodes = { "sArW", "sStA" } },
	{ id = "SnowStairsTop", biome = "snow", width = 24, nodes = { "sStA", "sSt0" } },
	{ id = "SnowStairsFoot", biome = "snow", width = 24, nodes = { "sSt1", "sStB" } },
	{ id = "SnowCliffStairs", biome = "snow", kind = "stairs", width = 24, nodes = { "sSt0", "sSt1" } },
	{ id = "SnowLakeLoop", biome = "snow", width = 22, nodes = { "sStB", "sL1", "sL2", "mM3E" } },

	-- Sky: celestial stair flights, island walks, bridges and the temple stairway
	{ id = "CelestialStair", biome = "sky", kind = "struct", width = 24, nodes = { "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "i1Stair" } },
	{ id = "GateIsleWalk", biome = "sky", kind = "sky", width = 26, nodes = { "i1Stair", "i1c", "b1a" } },
	{ id = "PoolBridge", biome = "sky", kind = "sky", width = 26, nodes = { "b1a", "b1b", "i2c" } },
	{ id = "PoolToPavilion", biome = "sky", kind = "sky", width = 20, nodes = { "i2c", "i2Pav" } },
	{ id = "TempleBridge", biome = "sky", kind = "sky", width = 26, nodes = { "i2c", "b2a", "b2b", "tPlaza" } },
	{ id = "TempleStairway", biome = "sky", kind = "skystairs", width = 40, nodes = { "i1c", "gsA", "gsB", "tPlaza" } },
	{ id = "GardenBridge", biome = "sky", kind = "sky", width = 26, nodes = { "tPlaza", "b3a", "b3b", "i4c" } },
	{ id = "GateToGarden", biome = "sky", kind = "sky", width = 26, nodes = { "i1c", "b4a", "b4b", "i4c" } },
}

----------------------------------------------------------------------
-- Biome entrances (markers for future gameplay and for the audit).
----------------------------------------------------------------------
Layout.entrances = {
	{ name = "StarterMeadow", pos = N.mN },
	{ name = "Jungle", pos = N.jE },
	{ name = "CandyCliffs", pos = N.cE },
	{ name = "Volcano", pos = N.vE },
	{ name = "SnowValley", pos = N.sE },
	{ name = "SkyIslands", pos = N.nJ4 },
}

return Layout
