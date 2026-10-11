-- Central hub: the glowing egg pavilion, spawn, plaza dressing and signposts.

local Layout = require(script.Parent.Parent.Layout)
local Field = require(script.Parent.Parent.Field)
local Parts = require(script.Parent.Parent.Parts)
local Palette = require(script.Parent.Parent.Palette)
local Pavilions = require(script.Parent.Parent.Assets.Pavilions)
local Props = require(script.Parent.Parent.Assets.Props)
local Veg = require(script.Parent.Parent.Assets.Vegetation)
local Creatures = require(script.Parent.Parent.Assets.Creatures)
local Common = require(script.Parent.Common)

local M = Enum.Material
local Hub = {}

local SIGNS = {
	{ text = "STARTER MEADOW", dir = Vector3.new(0, 0, 1) },
	{ text = "JUNGLE", dir = Vector3.new(-1, 0, 0) },
	{ text = "CANDY CLIFFS  &  SKY ISLANDS", dir = Vector3.new(0, 0, -1) },
	{ text = "VOLCANO  &  SNOW VALLEY", dir = Vector3.new(1, 0, 0) },
}

local function signpost(parent: Instance, pos: Vector3, facing: Vector3, text: string)
	local m = Parts.model(parent, "Signpost")
	Parts.block(m, CFrame.new(pos + Vector3.new(0, 4, 0)), Vector3.new(1.4, 8, 1.4), Palette.wood, M.Wood, { name = "Post" })
	local board = Parts.block(m, CFrame.lookAt(pos + Vector3.new(0, 8.6, 0), pos + Vector3.new(0, 8.6, 0) + facing), Vector3.new(14, 3.4, 0.6), Palette.woodLight, M.WoodPlanks, { name = "Board" })
	for _, face in { Enum.NormalId.Front, Enum.NormalId.Back } do
		local gui = Instance.new("SurfaceGui")
		gui.Face = face
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		gui.PixelsPerStud = 40
		gui.LightInfluence = 0.6
		gui.Parent = board
		local label = Instance.new("TextLabel")
		label.Size = UDim2.fromScale(1, 1)
		label.BackgroundTransparency = 1
		label.Text = text
		label.TextScaled = true
		label.Font = Enum.Font.FredokaOne
		label.TextColor3 = Color3.fromRGB(70, 44, 24)
		label.Parent = gui
	end
	return m
end

function Hub.build(ctx)
	local rng = Random.new(Layout.SEED + 101)
	local region = ctx.region("Hub")
	local pav = Layout.pavilions[1]
	Pavilions.central(Parts.folder(region, "Landmarks"), pav.pos, pav.face, rng)

	-- spawn: a decorative pad on the south side of the plaza, facing the pavilion
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "WorldSpawn"
	spawn.Anchored = true
	spawn.Size = Vector3.new(14, 1, 14)
	spawn.CFrame = CFrame.lookAt(Layout.SPAWN - Vector3.new(0, 0.5, 0), Layout.SPAWN - Vector3.new(0, 0.5, 1))
	spawn.Color = Palette.paleStone
	spawn.Material = M.Slate
	spawn.TopSurface = Enum.SurfaceType.Smooth
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Parent = ctx.root
	Parts.cyl(region, Layout.SPAWN - Vector3.new(0, 0.45, 0), 0.2, 20, Palette.gold, M.SmoothPlastic, { decor = true, name = "SpawnRing" })

	-- plaza ring: hedges and flower beds between the spokes, lanterns, benches
	local dress = Parts.folder(region, "Plaza")
	for i = 0, 23 do
		local a = i / 24 * math.pi * 2
		local p = Vector3.new(math.sin(a) * 176, 140, math.cos(a) * 176)
		local onSpoke = false
		for _, s in Field.pathSegs do
			if s.path.id:find("^Hub") and (require(script.Parent.Parent.Util).segDist(p.X, p.Z, s.ax, s.az, s.bx, s.bz)) < s.hw + 10 then
				onSpoke = true
			end
		end
		if not onSpoke then
			local g = Field.height(p.X, p.Z)
			if i % 2 == 0 then
				Veg.bush(dress, Vector3.new(p.X, g - 0.3, p.Z), 9, rng)
				Veg.flowers(dress, Vector3.new(p.X * 0.95, g - 0.2, p.Z * 0.95), rng)
			else
				Props.lantern(dress, Vector3.new(p.X, g - 0.3, p.Z), "hub", i % 4 == 1)
			end
		end
	end
	-- signposts where the spokes leave the plaza
	for _, sg in SIGNS do
		local p = sg.dir * 158
		local right = Vector3.new(-sg.dir.Z, 0, sg.dir.X)
		local q = p + right * 22
		signpost(dress, Vector3.new(q.X, Field.height(q.X, q.Z) - 0.3, q.Z), -sg.dir, sg.text)
	end

	-- trees and flowers on the plateau rim
	Common.scatter({
		c = { 0, 0 }, r = { 225, 225 }, count = 26, minDist = 34, pad = 10, slopeMax = 0.5, hMin = 128,
		place = function(p, r)
			if p.Magnitude < 175 then
				return
			end
			Veg.broadleaf(Parts.folder(region, "Vegetation"), p, r:NextNumber(40, 62), r)
		end,
	}, rng)
	Common.scatter({
		c = { 0, 0 }, r = { 230, 230 }, count = 50, minDist = 12, pad = 4, slopeMax = 0.5,
		place = function(p, r)
			Veg.flowers(Parts.folder(region, "Vegetation"), p, r)
		end,
	}, rng)

	-- goofy creatures greeting new players near spawn
	local cf1 = CFrame.lookAt(Vector3.new(-62, 140, 128), Vector3.new(0, 140, 112))
	Creatures.Toastodile(Parts.folder(region, "Creatures"), cf1, 10)
	local cf2 = CFrame.lookAt(Vector3.new(64, 140, 126), Vector3.new(0, 140, 112))
	Creatures.SirWobbleton(Parts.folder(region, "Creatures"), cf2, 9)
end

return Hub
