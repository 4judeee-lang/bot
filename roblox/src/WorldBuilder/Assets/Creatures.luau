-- Posed creature display models in the cheerful blocky style of the references.
-- These are placeholders for future combat creatures: they are anchored, collide,
-- and carry a "Species" attribute so gameplay can swap them for live rigs later.

local Parts = require(script.Parent.Parent.Parts)
local Palette = require(script.Parent.Parent.Palette)
local Util = require(script.Parent.Parent.Util)

local M = Enum.Material
local rgb = Color3.fromRGB
local rad = math.rad
local C = {}

local BLACK = rgb(30, 30, 36)
local WHITE = rgb(255, 255, 255)

local function deco()
	return { decor = true, shadow = false }
end

-- Big friendly eyes + optional mouth on the front (-Z) face of a head CFrame.
local function face(m: Model, head: CFrame, w: number, h: number, depth: number, opts)
	local o = opts or {}
	local eyeW = w * (o.eyeScale or 0.22)
	for _, side in { -1, 1 } do
		local e = head * CFrame.new(side * w * 0.22, h * (o.eyeY or 0.08), -depth / 2 - 0.05)
		Parts.block(m, e, Vector3.new(eyeW, eyeW * 1.15, 0.2), WHITE, M.SmoothPlastic, deco())
		Parts.block(m, e * CFrame.new(side * eyeW * 0.12, -eyeW * 0.1, -0.12), Vector3.new(eyeW * 0.55, eyeW * 0.7, 0.2), BLACK, M.SmoothPlastic, deco())
		Parts.block(m, e * CFrame.new(side * eyeW * 0.05, eyeW * 0.15, -0.22), Vector3.new(eyeW * 0.2, eyeW * 0.2, 0.1), WHITE, M.Neon, deco())
	end
	if o.mouth ~= false then
		Parts.block(m, head * CFrame.new(0, -h * 0.22, -depth / 2 - 0.05), Vector3.new(w * 0.26, h * 0.08, 0.2), o.mouthColor or rgb(120, 40, 50), M.SmoothPlastic, deco())
	end
	if o.blush then
		for _, side in { -1, 1 } do
			Parts.block(m, head * CFrame.new(side * w * 0.36, -h * 0.1, -depth / 2 - 0.05), Vector3.new(w * 0.14, h * 0.07, 0.15), rgb(255, 150, 170), M.SmoothPlastic, deco())
		end
	end
end

local function limb(m: Model, cf: CFrame, size: Vector3, color: Color3)
	Parts.block(m, cf, size, color, M.SmoothPlastic, { name = "Limb" })
end

local function newModel(parent: Instance, species: string, cf: CFrame): (Model, CFrame)
	local m = Parts.model(parent, species)
	m:SetAttribute("Species", species)
	m:SetAttribute("Placeholder", true)
	return m, cf
end

----------------------------------------------------------------------
-- species (cf = feet position + facing; s = overall height in studs)
----------------------------------------------------------------------
function C.Monkey(parent, cf: CFrame, s: number)
	local m = newModel(parent, "Monkey", cf)
	local brown, tan = rgb(140, 92, 56), rgb(232, 196, 150)
	local u = s / 10
	Parts.block(m, cf * CFrame.new(0, u * 3.6, 0), Vector3.new(u * 4, u * 4, u * 3), brown, M.SmoothPlastic, { name = "Body" })
	Parts.block(m, cf * CFrame.new(0, u * 3.4, -u * 1.55), Vector3.new(u * 2.8, u * 3, 0.2), tan, M.SmoothPlastic, deco())
	local head = cf * CFrame.new(0, u * 7.4, 0)
	Parts.block(m, head, Vector3.new(u * 4.6, u * 3.8, u * 3.8), brown, M.SmoothPlastic, { name = "Head" })
	Parts.block(m, head * CFrame.new(0, -u * 0.5, -u * 1.9), Vector3.new(u * 3.4, u * 2.4, 0.3), tan, M.SmoothPlastic, deco())
	face(m, head, u * 4.6, u * 3.8, u * 4.2, { blush = true })
	for _, side in { -1, 1 } do
		Parts.cyl(m, (head * CFrame.new(side * u * 2.7, u * 0.4, 0)).Position, u * 0.6, u * 1.8, tan, M.SmoothPlastic, deco()).CFrame = head * CFrame.new(side * u * 2.7, u * 0.4, 0)
		limb(m, cf * CFrame.new(side * u * 1.2, u * 0.9, 0), Vector3.new(u * 1.4, u * 1.8, u * 1.6), brown)
		limb(m, cf * CFrame.new(side * u * 2.6, u * 4.2, -u * 0.4) * CFrame.Angles(rad(-30), 0, rad(side * 25)), Vector3.new(u * 1.1, u * 3.6, u * 1.1), brown)
	end
	for i = 1, 4 do
		local a = i / 4 * math.pi
		Parts.block(m, cf * CFrame.new(u * (1.5 + math.sin(a) * 1.5), u * (2 + i * 1.1), u * (1.8 + math.cos(a))), Vector3.new(u * 0.8, u * 1.4, u * 0.8), brown, M.SmoothPlastic, deco())
	end
	return m
end

function C.Frog(parent, cf: CFrame, s: number)
	local m = newModel(parent, "Frog", cf)
	local green, belly = rgb(84, 190, 84), rgb(200, 236, 150)
	local u = s / 10
	Parts.ellipsoid(m, cf * CFrame.new(0, u * 4, 0), Vector3.new(u * 10, u * 7, u * 9), green, M.SmoothPlastic, { name = "Body" })
	Parts.ellipsoid(m, cf * CFrame.new(0, u * 3.2, -u * 3), Vector3.new(u * 7, u * 4.6, u * 3.4), belly, M.SmoothPlastic, deco())
	for _, side in { -1, 1 } do
		local e = cf * CFrame.new(side * u * 2.4, u * 7.6, -u * 1.6)
		Parts.ball(m, e.Position, u * 3, green, M.SmoothPlastic, deco())
		Parts.ball(m, (e * CFrame.new(0, u * 0.2, -u * 1.1)).Position, u * 1.9, WHITE, M.SmoothPlastic, deco())
		Parts.ball(m, (e * CFrame.new(0, u * 0.2, -u * 1.8)).Position, u * 1, BLACK, M.SmoothPlastic, deco())
		limb(m, cf * CFrame.new(side * u * 4.4, u * 1, u * 1.5), Vector3.new(u * 2.6, u * 2, u * 4.5), green)
		limb(m, cf * CFrame.new(side * u * 2.6, u * 0.8, -u * 3.4), Vector3.new(u * 1.6, u * 1.6, u * 2), green)
	end
	Parts.block(m, cf * CFrame.new(0, u * 4.6, -u * 4.45), Vector3.new(u * 4, u * 0.4, 0.2), rgb(60, 120, 60), M.SmoothPlastic, deco())
	return m
end

function C.Leafling(parent, cf: CFrame, s: number)
	local m = newModel(parent, "Leafling", cf)
	local bark, leaf = rgb(150, 110, 70), rgb(96, 196, 80)
	local u = s / 10
	local body = cf * CFrame.new(0, u * 4, 0)
	Parts.block(m, body, Vector3.new(u * 6, u * 6, u * 6), bark, M.SmoothPlastic, { name = "Body" })
	face(m, body * CFrame.new(0, u * 0.6, 0), u * 6, u * 5, u * 6, { blush = true })
	for i = 1, 3 do
		Parts.wedge(m, cf * CFrame.new((i - 2) * u * 1.6, u * 8, 0) * CFrame.Angles(0, 0, rad((i - 2) * 30)), Vector3.new(u * 0.6, u * 3.6, u * 2.4), leaf, M.SmoothPlastic, deco())
	end
	for _, side in { -1, 1 } do
		limb(m, cf * CFrame.new(side * u * 1.6, u * 0.6, 0), Vector3.new(u * 1.4, u * 1.4, u * 1.6), rgb(120, 86, 56))
	end
	return m
end

function C.Bunny(parent, cf: CFrame, s: number)
	local m = newModel(parent, "Bunny", cf)
	local pink, white = rgb(255, 170, 205), rgb(255, 236, 244)
	local u = s / 10
	Parts.block(m, cf * CFrame.new(0, u * 2.8, 0), Vector3.new(u * 4, u * 3.6, u * 3.4), pink, M.SmoothPlastic, { name = "Body" })
	local head = cf * CFrame.new(0, u * 6, -u * 0.2)
	Parts.block(m, head, Vector3.new(u * 4.4, u * 3.6, u * 3.6), pink, M.SmoothPlastic, { name = "Head" })
	face(m, head, u * 4.4, u * 3.6, u * 3.6, { blush = true, mouth = false })
	for _, side in { -1, 1 } do
		Parts.block(m, head * CFrame.new(side * u * 1.1, u * 3.6, 0) * CFrame.Angles(0, 0, rad(side * -8)), Vector3.new(u * 1.1, u * 4, u * 0.8), pink, M.SmoothPlastic, deco())
		Parts.block(m, head * CFrame.new(side * u * 1.1, u * 3.6, -u * 0.42) * CFrame.Angles(0, 0, rad(side * -8)), Vector3.new(u * 0.6, u * 3.2, 0.1), white, M.SmoothPlastic, deco())
		limb(m, cf * CFrame.new(side * u * 1.2, u * 0.6, -u * 0.4), Vector3.new(u * 1.4, u * 1.2, u * 2.2), white)
	end
	Parts.ball(m, (cf * CFrame.new(0, u * 2.6, u * 1.9)).Position, u * 1.6, white, M.SmoothPlastic, deco())
	return m
end

function C.GummyBear(parent, cf: CFrame, s: number, color: Color3?)
	local m = newModel(parent, "GummyBear", cf)
	local c = color or rgb(255, 90, 110)
	local u = s / 10
	local opts = { name = "Body", transparency = 0.18 }
	Parts.ellipsoid(m, cf * CFrame.new(0, u * 3.6, 0), Vector3.new(u * 5.4, u * 5.4, u * 4.4), c, M.Glass, opts)
	local head = cf * CFrame.new(0, u * 7.6, 0)
	Parts.ellipsoid(m, head, Vector3.new(u * 4.8, u * 4, u * 4), c, M.Glass, { name = "Head", transparency = 0.18 })
	for _, side in { -1, 1 } do
		Parts.ball(m, (head * CFrame.new(side * u * 1.8, u * 1.8, 0)).Position, u * 1.6, c, M.Glass, { decor = true, transparency = 0.18 })
		Parts.ellipsoid(m, cf * CFrame.new(side * u * 2.8, u * 4.6, -u * 0.4), Vector3.new(u * 1.6, u * 2.6, u * 1.6), c, M.Glass, { decor = true, transparency = 0.18 })
		Parts.ellipsoid(m, cf * CFrame.new(side * u * 1.4, u * 0.9, -u * 0.6), Vector3.new(u * 2, u * 1.8, u * 2.4), c, M.Glass, { decor = true, transparency = 0.18 })
		Parts.ball(m, (head * CFrame.new(side * u * 0.9, u * 0.3, -u * 1.9)).Position, u * 0.6, BLACK, M.SmoothPlastic, deco())
	end
	Parts.ball(m, (head * CFrame.new(0, -u * 0.6, -u * 2)).Position, u * 0.8, BLACK, M.SmoothPlastic, deco())
	return m
end

function C.Cupcake(parent, cf: CFrame, s: number)
	local m = newModel(parent, "Cupcake", cf)
	local u = s / 10
	local wrapper = ({ rgb(255, 196, 120), rgb(150, 220, 240), rgb(255, 170, 200) })[math.floor(math.abs(cf.Position.X + cf.Position.Z)) % 3 + 1]
	for i = 0, 7 do
		local a = i / 8 * math.pi * 2
		Parts.block(m, cf * CFrame.new(math.cos(a) * u * 2.6, u * 2, math.sin(a) * u * 2.6) * CFrame.Angles(0, -a, 0), Vector3.new(u * 0.6, u * 4, u * 2.4), i % 2 == 0 and wrapper or Util.vary(wrapper, Random.new(i), 0.08), M.SmoothPlastic, { name = "Wrapper" })
	end
	Parts.cyl(m, (cf * CFrame.new(0, u * 2, 0)).Position, u * 4, u * 5.2, rgb(170, 110, 70), M.SmoothPlastic, { name = "Cake" })
	Parts.ellipsoid(m, cf * CFrame.new(0, u * 5, 0), Vector3.new(u * 7, u * 4.4, u * 7), rgb(255, 240, 246), M.SmoothPlastic, { name = "Frosting" })
	Parts.ellipsoid(m, cf * CFrame.new(0, u * 6.8, 0), Vector3.new(u * 4.4, u * 2.8, u * 4.4), rgb(255, 228, 238), M.SmoothPlastic, deco())
	Parts.ball(m, (cf * CFrame.new(0, u * 8.6, 0)).Position, u * 1.6, rgb(220, 30, 60), M.SmoothPlastic, deco())
	face(m, cf * CFrame.new(0, u * 2.4, -u * 0.3), u * 4.6, u * 3, u * 5, { blush = true })
	for i = 1, 8 do
		Parts.block(m, cf * CFrame.new(math.cos(i) * u * 2.2, u * 6.3 + (i % 2) * u * 0.6, math.sin(i) * u * 2.2) * CFrame.Angles(0, i, 0), Vector3.new(u * 0.3, u * 0.3, u * 0.9), Palette.flowers[(i % #Palette.flowers) + 1], M.SmoothPlastic, deco())
	end
	return m
end

function C.LavaPup(parent, cf: CFrame, s: number)
	local m = newModel(parent, "LavaPup", cf)
	local rock, glow = rgb(70, 52, 48), Palette.lava
	local u = s / 10
	local body = cf * CFrame.new(0, u * 3.6, 0)
	Parts.block(m, body, Vector3.new(u * 5, u * 4, u * 8), rock, M.Basalt, { name = "Body" })
	Parts.block(m, body * CFrame.new(0, u * 2.05, 0), Vector3.new(u * 3, 0.2, u * 6), glow, M.Neon, deco())
	local head = cf * CFrame.new(0, u * 6.6, -u * 4.6)
	Parts.block(m, head, Vector3.new(u * 5, u * 4.4, u * 4.4), rock, M.Basalt, { name = "Head" })
	Parts.block(m, head * CFrame.new(0, -u * 1, -u * 2.6), Vector3.new(u * 3, u * 2.2, u * 1.6), rgb(90, 66, 60), M.Basalt, deco())
	for _, side in { -1, 1 } do
		Parts.wedge(m, head * CFrame.new(side * u * 1.7, u * 3, 0), Vector3.new(u * 1.2, u * 2, u * 1.6), rock, M.Basalt, deco())
		Parts.block(m, head * CFrame.new(side * u * 1.2, u * 0.6, -u * 2.25), Vector3.new(u * 1, u * 0.8, 0.2), Palette.lavaHot, M.Neon, deco())
		for _, z in { -1, 1 } do
			limb(m, cf * CFrame.new(side * u * 1.8, u * 0.9, z * u * 2.8), Vector3.new(u * 1.4, u * 1.8, u * 1.4), rock)
		end
	end
	Parts.block(m, cf * CFrame.new(0, u * 5.4, u * 4.6) * CFrame.Angles(rad(40), 0, 0), Vector3.new(u * 1, u * 1, u * 3), glow, M.Neon, deco())
	return m
end

function C.MagmaGolem(parent, cf: CFrame, s: number)
	local m = newModel(parent, "MagmaGolem", cf)
	local rock = rgb(66, 50, 48)
	local u = s / 10
	Parts.block(m, cf * CFrame.new(0, u * 5, 0), Vector3.new(u * 6, u * 4.6, u * 4), rock, M.Basalt, { name = "Body" })
	Parts.block(m, cf * CFrame.new(0, u * 5, -u * 2.05), Vector3.new(u * 2.2, u * 2.2, 0.2), Palette.lava, M.Neon, deco())
	local head = cf * CFrame.new(0, u * 8.4, -u * 0.4)
	Parts.block(m, head, Vector3.new(u * 3.6, u * 2.6, u * 3), rock, M.Basalt, { name = "Head" })
	for _, side in { -1, 1 } do
		Parts.block(m, head * CFrame.new(side * u * 0.8, 0, -u * 1.55), Vector3.new(u * 0.9, u * 0.5, 0.2), Palette.lavaHot, M.Neon, deco())
		limb(m, cf * CFrame.new(side * u * 4, u * 4.4, -u * 0.6) * CFrame.Angles(rad(-15), 0, rad(side * 10)), Vector3.new(u * 2, u * 5, u * 2), rock)
		limb(m, cf * CFrame.new(side * u * 1.6, u * 1.4, 0), Vector3.new(u * 2, u * 2.8, u * 2.2), rock)
	end
	for i = 1, 3 do
		Parts.block(m, cf * CFrame.new((i - 2) * u * 1.6, u * 7.5, u * 1.2) * CFrame.Angles(rad(-20), 0, rad((i - 2) * 15)), Vector3.new(u * 0.8, u * 2, u * 0.8), Palette.purpleCrystal, M.Neon, deco())
	end
	return m
end

function C.Penguin(parent, cf: CFrame, s: number)
	local m = newModel(parent, "Penguin", cf)
	local u = s / 10
	Parts.ellipsoid(m, cf * CFrame.new(0, u * 4.6, 0), Vector3.new(u * 5.4, u * 8.4, u * 5), rgb(40, 50, 70), M.SmoothPlastic, { name = "Body" })
	Parts.ellipsoid(m, cf * CFrame.new(0, u * 4.2, -u * 1.4), Vector3.new(u * 4, u * 6.4, u * 2.6), WHITE, M.SmoothPlastic, deco())
	local head = cf * CFrame.new(0, u * 8.6, -u * 0.6)
	face(m, head, u * 3.6, u * 2, u * 3.2, { mouth = false, eyeScale = 0.26 })
	Parts.wedge(m, head * CFrame.new(0, -u * 0.6, -u * 2) * CFrame.Angles(rad(-90), 0, 0), Vector3.new(u * 1.2, u * 1.4, u * 0.8), rgb(255, 160, 50), M.SmoothPlastic, deco())
	for _, side in { -1, 1 } do
		limb(m, cf * CFrame.new(side * u * 2.8, u * 4.6, 0) * CFrame.Angles(0, 0, rad(side * 20)), Vector3.new(u * 0.6, u * 4, u * 1.8), rgb(40, 50, 70))
		limb(m, cf * CFrame.new(side * u * 1.1, u * 0.3, -u * 1), Vector3.new(u * 1.4, u * 0.6, u * 2), rgb(255, 160, 50))
	end
	Parts.block(m, cf * CFrame.new(0, u * 7.2, -u * 0.2), Vector3.new(u * 5.2, u * 0.9, u * 4.8), rgb(80, 180, 240), M.Fabric, deco())
	return m
end

function C.Yeti(parent, cf: CFrame, s: number)
	local m = newModel(parent, "Yeti", cf)
	local fur, skin = rgb(240, 246, 255), rgb(130, 190, 236)
	local u = s / 10
	Parts.block(m, cf * CFrame.new(0, u * 4.4, 0), Vector3.new(u * 7, u * 5.6, u * 5), fur, M.SmoothPlastic, { name = "Body" })
	local head = cf * CFrame.new(0, u * 8.4, -u * 0.3)
	Parts.block(m, head, Vector3.new(u * 5.6, u * 3.4, u * 4.6), fur, M.SmoothPlastic, { name = "Head" })
	Parts.block(m, head * CFrame.new(0, -u * 0.3, -u * 2.35), Vector3.new(u * 3.8, u * 2.4, 0.2), skin, M.SmoothPlastic, deco())
	face(m, head * CFrame.new(0, -u * 0.1, -u * 0.15), u * 4, u * 2.6, u * 4.8, { mouthColor = rgb(60, 80, 140) })
	for _, side in { -1, 1 } do
		limb(m, cf * CFrame.new(side * u * 4.6, u * 4.6, -u * 0.6) * CFrame.Angles(rad(-20), 0, rad(side * 12)), Vector3.new(u * 2.2, u * 5.4, u * 2.2), fur)
		limb(m, cf * CFrame.new(side * u * 1.8, u * 0.9, 0), Vector3.new(u * 2.2, u * 1.8, u * 2.8), fur)
	end
	return m
end

function C.IceFox(parent, cf: CFrame, s: number)
	local m = newModel(parent, "IceFox", cf)
	local fur, accent = rgb(220, 238, 255), rgb(120, 200, 250)
	local u = s / 10
	Parts.block(m, cf * CFrame.new(0, u * 3.2, 0), Vector3.new(u * 3.6, u * 3.4, u * 6.4), fur, M.SmoothPlastic, { name = "Body" })
	local head = cf * CFrame.new(0, u * 5.8, -u * 3.4)
	Parts.block(m, head, Vector3.new(u * 4, u * 3.4, u * 3.4), fur, M.SmoothPlastic, { name = "Head" })
	Parts.block(m, head * CFrame.new(0, -u * 0.8, -u * 2.2), Vector3.new(u * 1.8, u * 1.4, u * 1.4), WHITE, M.SmoothPlastic, deco())
	face(m, head, u * 4, u * 3.4, u * 3.4, { mouth = false, blush = true })
	for _, side in { -1, 1 } do
		Parts.wedge(m, head * CFrame.new(side * u * 1.3, u * 2.4, 0), Vector3.new(u * 1.2, u * 1.6, u * 1), accent, M.SmoothPlastic, deco())
		for _, z in { -1, 1 } do
			limb(m, cf * CFrame.new(side * u * 1.2, u * 0.8, z * u * 2.2), Vector3.new(u * 1, u * 1.6, u * 1), fur)
		end
	end
	Parts.ellipsoid(m, cf * CFrame.new(0, u * 4.6, u * 4.6) * CFrame.Angles(rad(-35), 0, 0), Vector3.new(u * 2.4, u * 2.4, u * 5), accent, M.SmoothPlastic, deco())
	return m
end

function C.CloudSprite(parent, cf: CFrame, s: number)
	local m = newModel(parent, "CloudSprite", cf)
	local u = s / 10
	local body = cf * CFrame.new(0, u * 5, 0)
	for i = 0, 4 do
		local a = i / 5 * math.pi * 2
		Parts.ball(m, (body * CFrame.new(math.cos(a) * u * 2.4, math.sin(i) * u * 0.6, math.sin(a) * u * 1.6)).Position, u * 4, WHITE, M.SmoothPlastic, { name = "Puff" })
	end
	Parts.ball(m, body.Position, u * 5.6, WHITE, M.SmoothPlastic, { name = "Body" })
	face(m, body * CFrame.new(0, 0, -u * 0.4), u * 4.4, u * 3.2, u * 5, { blush = true })
	Parts.cyl(m, (body * CFrame.new(0, u * 4, 0)).Position, u * 0.4, u * 4, Palette.gold, M.Neon, deco())
	return m
end

-- Original goofy "brainrot" creatures.
function C.Toastodile(parent, cf: CFrame, s: number)
	local m = newModel(parent, "Toastodile", cf)
	local crust, bread = rgb(196, 130, 66), rgb(246, 214, 150)
	local u = s / 10
	local body = cf * CFrame.new(0, u * 4.6, 0)
	Parts.block(m, body, Vector3.new(u * 7, u * 8, u * 2.4), crust, M.SmoothPlastic, { name = "Body" })
	Parts.block(m, body * CFrame.new(0, 0, -u * 1.25), Vector3.new(u * 6, u * 7, 0.2), bread, M.SmoothPlastic, deco())
	Parts.block(m, body * CFrame.new(0, u * 1.2, -u * 2.6), Vector3.new(u * 4, u * 1.6, u * 3.4), rgb(90, 170, 80), M.SmoothPlastic, { name = "Snout" })
	for i = -2, 2 do
		Parts.wedge(m, body * CFrame.new(i * u * 0.7, u * 0.35, -u * 4.1), Vector3.new(u * 0.4, u * 0.6, u * 0.4), WHITE, M.SmoothPlastic, deco())
	end
	Parts.block(m, body * CFrame.new(0, u * 2.6, -u * 1.45), Vector3.new(u * 5, u * 1, 0.3), BLACK, M.Glass, deco())
	Parts.block(m, body * CFrame.new(0, u * 2.4, -u * 1.6), Vector3.new(u * 1.2, u * 0.5, 0.2), WHITE, M.Neon, deco())
	for _, side in { -1, 1 } do
		limb(m, cf * CFrame.new(side * u * 1.6, u * 0.6, 0), Vector3.new(u * 1.4, u * 1.2, u * 2), rgb(90, 170, 80))
		limb(m, body * CFrame.new(side * u * 4, -u * 0.8, 0) * CFrame.Angles(0, 0, rad(side * 35)), Vector3.new(u * 0.8, u * 3, u * 0.8), rgb(90, 170, 80))
	end
	return m
end

function C.SirWobbleton(parent, cf: CFrame, s: number)
	local m = newModel(parent, "SirWobbleton", cf)
	local jelly = rgb(120, 230, 150)
	local u = s / 10
	local body = cf * CFrame.new(0, u * 3.2, 0)
	Parts.block(m, body, Vector3.new(u * 6.4, u * 6.4, u * 6.4), jelly, M.Glass, { name = "Body", transparency = 0.25 })
	Parts.block(m, body * CFrame.new(0, -u * 0.6, 0), Vector3.new(u * 3, u * 3, u * 3), rgb(255, 120, 150), M.Neon, { decor = true, transparency = 0.3 })
	face(m, body * CFrame.new(0, u * 0.6, 0), u * 6.4, u * 5, u * 6.4, { blush = true })
	local hat = body * CFrame.new(0, u * 3.4, 0)
	Parts.cyl(m, hat.Position, u * 0.4, u * 6, BLACK, M.SmoothPlastic, deco())
	Parts.cyl(m, (hat * CFrame.new(0, u * 2.2, 0)).Position, u * 4, u * 3.8, BLACK, M.SmoothPlastic, deco())
	Parts.cyl(m, (hat * CFrame.new(0, u * 0.9, 0)).Position, u * 0.8, u * 3.9, rgb(200, 40, 60), M.SmoothPlastic, deco())
	Parts.cyl(m, (body * CFrame.new(u * 1.4, u * 1.1, -u * 3.3)).Position, 0.2, u * 1.8, Palette.gold, M.SmoothPlastic, deco()).CFrame = body * CFrame.new(u * 1.4, u * 1.1, -u * 3.3) * CFrame.Angles(0, rad(90), 0)
	return m
end

function C.Bananarang(parent, cf: CFrame, s: number)
	local m = newModel(parent, "Bananarang", cf)
	local yellow = rgb(255, 222, 70)
	local u = s / 10
	local prev = (cf * CFrame.new(0, u * 2.4, u * 1.6)).Position
	for i = 1, 5 do
		local t = i / 5
		local p = (cf * CFrame.new(0, u * (2.4 + t * 7), u * (1.6 - math.sin(t * math.pi) * 2.4))).Position
		Parts.rod(m, prev, p, u * (3.4 - math.abs(t - 0.5) * 2), yellow, M.SmoothPlastic, { name = "Peel" })
		prev = p
	end
	Parts.block(m, CFrame.new(prev + Vector3.new(0, u * 0.6, 0)), Vector3.new(u * 0.8, u * 1.2, u * 0.8), rgb(110, 80, 40), M.SmoothPlastic, deco())
	face(m, cf * CFrame.new(0, u * 6, -u * 0.2), u * 3.2, u * 3, u * 3.4, { blush = true })
	for _, side in { -1, 1 } do
		limb(m, cf * CFrame.new(side * u * 0.9, u * 1.2, 0), Vector3.new(u * 0.6, u * 2.4, u * 0.6), BLACK)
		limb(m, cf * CFrame.new(side * u * 0.9, u * 0.3, -u * 0.4), Vector3.new(u * 1.4, u * 0.8, u * 2.2), rgb(240, 60, 60))
	end
	return m
end

function C.Capyccino(parent, cf: CFrame, s: number)
	local m = newModel(parent, "Capyccino", cf)
	local fur = rgb(170, 120, 80)
	local u = s / 10
	Parts.block(m, cf * CFrame.new(0, u * 3, 0), Vector3.new(u * 5, u * 4.4, u * 8), fur, M.SmoothPlastic, { name = "Body" })
	local head = cf * CFrame.new(0, u * 5, -u * 4.6)
	Parts.block(m, head, Vector3.new(u * 4.2, u * 3.6, u * 4), fur, M.SmoothPlastic, { name = "Head" })
	face(m, head, u * 4.2, u * 3.6, u * 4, { mouth = false, eyeScale = 0.16, eyeY = 0.2 })
	Parts.block(m, head * CFrame.new(0, -u * 0.6, -u * 2.05), Vector3.new(u * 1.6, u * 0.7, 0.2), BLACK, M.SmoothPlastic, deco())
	for _, side in { -1, 1 } do
		for _, z in { -1, 1 } do
			limb(m, cf * CFrame.new(side * u * 1.6, u * 0.5, z * u * 2.8), Vector3.new(u * 1.2, u * 1.2, u * 1.4), rgb(140, 96, 64))
		end
	end
	local cup = head * CFrame.new(0, u * 3, 0)
	Parts.cyl(m, cup.Position, u * 2.4, u * 2.6, WHITE, M.SmoothPlastic, deco())
	Parts.cyl(m, (cup * CFrame.new(0, u * 1.25, 0)).Position, 0.2, u * 2.3, rgb(120, 80, 50), M.SmoothPlastic, deco())
	return m
end

-- Big mossy stone & wood guardian statue for the jungle ruin altar.
function C.Guardian(parent, cf: CFrame, s: number)
	local m = newModel(parent, "AncientGuardian", cf)
	local wood, moss, stone = rgb(150, 116, 74), rgb(86, 160, 70), rgb(140, 140, 130)
	local u = s / 10
	Parts.block(m, cf * CFrame.new(0, u * 4.8, 0), Vector3.new(u * 5.2, u * 4.4, u * 3.4), wood, M.Wood, { name = "Body" })
	Parts.block(m, cf * CFrame.new(0, u * 6.6, 0), Vector3.new(u * 5.6, u * 1, u * 3.8), moss, M.Grass, deco())
	local head = cf * CFrame.new(0, u * 8.4, 0)
	Parts.block(m, head, Vector3.new(u * 3.4, u * 2.8, u * 3), wood, M.Wood, { name = "Head" })
	for _, side in { -1, 1 } do
		Parts.block(m, head * CFrame.new(side * u * 0.8, u * 0.2, -u * 1.55), Vector3.new(u * 0.8, u * 0.5, 0.2), Palette.cyan, M.Neon, deco())
		Parts.wedge(m, head * CFrame.new(side * u * 1.6, u * 2, 0) * CFrame.Angles(0, 0, rad(side * -20)), Vector3.new(u * 0.6, u * 2.6, u * 1.2), moss, M.Grass, deco())
		limb(m, cf * CFrame.new(side * u * 3.6, u * 4.4, 0) * CFrame.Angles(0, 0, rad(side * 8)), Vector3.new(u * 1.8, u * 5, u * 1.8), wood)
		limb(m, cf * CFrame.new(side * u * 1.4, u * 1.3, 0), Vector3.new(u * 2, u * 2.6, u * 2.2), stone)
	end
	Parts.block(m, cf * CFrame.new(0, u * 4.8, -u * 1.75), Vector3.new(u * 1.4, u * 1.4, 0.2), Palette.cyan, M.Neon, deco())
	return m
end

return C
