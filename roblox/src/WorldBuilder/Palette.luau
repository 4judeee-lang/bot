-- Colour palette sampled by eye from the reference images. Large surfaces use the
-- softer tones; landmarks use the stronger accents.

local rgb = Color3.fromRGB

local Palette = {
	-- terrain material tints (Terrain:SetMaterialColor)
	terrain = {
		Grass = rgb(104, 192, 70),
		LeafyGrass = rgb(62, 150, 56),
		Ground = rgb(150, 220, 146), -- candy mint lawns
		Sand = rgb(238, 214, 158),
		Pavement = rgb(234, 222, 194), -- hub / meadow / sky cream paths
		Cobblestone = rgb(178, 152, 112), -- jungle paths
		Salt = rgb(248, 216, 190), -- candy peach-cream paths
		Asphalt = rgb(104, 84, 74), -- volcano paths
		Limestone = rgb(210, 226, 244), -- snow paths, subtle blue tint
		Rock = rgb(140, 142, 150),
		Slate = rgb(102, 112, 96), -- mossy jungle cliffs
		Sandstone = rgb(238, 150, 178), -- pink candy cliffs
		Basalt = rgb(62, 50, 48),
		CrackedLava = rgb(232, 98, 36),
		Snow = rgb(244, 249, 255),
		Glacier = rgb(146, 208, 242),
		Mud = rgb(112, 94, 72),
	},

	water = rgb(52, 196, 232),

	-- shared materials
	stone = rgb(150, 150, 158),
	stoneDark = rgb(110, 112, 120),
	paleStone = rgb(236, 230, 214),
	cream = rgb(246, 238, 218),
	gold = rgb(240, 196, 76),
	goldDark = rgb(196, 148, 52),
	wood = rgb(140, 92, 54),
	woodLight = rgb(176, 122, 74),
	woodDark = rgb(98, 64, 40),
	rope = rgb(206, 178, 120),
	lanternGlow = rgb(255, 196, 110),
	white = rgb(250, 250, 252),

	-- foliage
	leaf = { rgb(86, 178, 62), rgb(68, 160, 58), rgb(104, 196, 74), rgb(58, 140, 60) },
	jungleLeaf = { rgb(46, 132, 60), rgb(38, 116, 56), rgb(58, 150, 66), rgb(30, 100, 52) },
	palmLeaf = { rgb(70, 170, 70), rgb(84, 186, 76), rgb(56, 150, 64) },
	pine = { rgb(48, 112, 78), rgb(40, 100, 70), rgb(58, 124, 86) },
	trunk = rgb(122, 84, 52),
	jungleTrunk = rgb(98, 70, 48),
	vine = rgb(60, 140, 60),
	flowers = { rgb(255, 120, 150), rgb(255, 214, 80), rgb(160, 120, 255), rgb(255, 255, 255), rgb(255, 150, 70), rgb(120, 200, 255) },

	-- biome accents
	teal = rgb(46, 170, 170),
	tealDark = rgb(32, 128, 136),
	cyan = rgb(80, 220, 240),
	mushroomPurple = rgb(146, 82, 210),
	mushroomLilac = rgb(214, 170, 255),
	mushroomCyan = rgb(80, 230, 240),
	candyPink = rgb(255, 150, 190),
	candyHot = rgb(255, 92, 150),
	candyCream = rgb(255, 240, 236),
	candyFrost = rgb(255, 214, 228),
	candyMint = rgb(150, 236, 196),
	candyTurq = rgb(90, 214, 220),
	candyPeach = rgb(255, 196, 150),
	wafer = rgb(232, 176, 100),
	waferDark = rgb(196, 136, 70),
	basalt = rgb(64, 52, 50),
	basaltLight = rgb(96, 80, 74),
	lava = rgb(255, 110, 30),
	lavaHot = rgb(255, 180, 60),
	ember = rgb(255, 140, 50),
	volcanoBanner = rgb(232, 96, 30),
	purpleCrystal = rgb(170, 100, 255),
	ice = rgb(170, 226, 250),
	iceDeep = rgb(96, 180, 236),
	iceCrystal = rgb(120, 230, 255),
	snowWhite = rgb(246, 250, 255),
	skyBlue = rgb(84, 156, 232),
	skyRoof = rgb(70, 130, 220),

	eggs = {
		rgb(120, 230, 140), -- green
		rgb(255, 196, 70), -- amber
		rgb(150, 210, 255), -- sky blue
		rgb(200, 140, 255), -- violet
		rgb(255, 140, 190), -- pink
		rgb(255, 120, 60), -- molten
		rgb(130, 240, 255), -- ice
		rgb(255, 230, 140), -- gold
	},
}

return Palette
