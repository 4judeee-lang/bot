-- Bridges, stairs, sky walkways, waterfalls, cliff facets and ruins.
-- Walk surfaces are always a single smooth invisible collider so plank seams and
-- step edges never snag or bounce characters; visible pieces sit on top as decor.

local Util = require(script.Parent.Parent.Util)
local Parts = require(script.Parent.Parent.Parts)
local Palette = require(script.Parent.Parent.Palette)
local Field = require(script.Parent.Parent.Field)

local M = Enum.Material
local rad = math.rad
local S = {}

local function d()
	return { decor = true }
end

local BRIDGE = {
	meadow = { deck = Palette.woodLight, deck2 = Palette.wood, rail = Palette.wood, mat = M.WoodPlanks, railMat = M.Wood, kind = "wood" },
	hub = { deck = Palette.paleStone, deck2 = Palette.cream, rail = Palette.paleStone, mat = M.Slate, railMat = M.Slate, kind = "stone" },
	jungle = { deck = Palette.wood, deck2 = Palette.woodDark, rail = Palette.woodDark, mat = M.WoodPlanks, railMat = M.Wood, kind = "rope" },
	candy = { deck = Palette.wafer, deck2 = Palette.waferDark, rail = Palette.wafer, mat = M.SmoothPlastic, railMat = M.SmoothPlastic, kind = "wafer" },
	volcano = { deck = Color3.fromRGB(120, 100, 92), deck2 = Palette.basaltLight, rail = Palette.basalt, mat = M.Slate, railMat = M.Slate, kind = "stone" },
	snow = { deck = Color3.fromRGB(214, 226, 238), deck2 = Palette.ice, rail = Palette.paleStone, mat = M.Slate, railMat = M.SmoothPlastic, kind = "stone" },
	sky = { deck = Palette.white, deck2 = Palette.cream, rail = Palette.white, mat = M.Marble, railMat = M.Marble, kind = "sky" },
}
S.BRIDGE = BRIDGE

----------------------------------------------------------------------
-- bridges
----------------------------------------------------------------------
-- pts: deck centreline at walk height. Returns the bridge model.
function S.bridge(parent: Instance, pts: { Vector3 }, width: number, style: string, rng: Random): Model
	local st = BRIDGE[style] or BRIDGE.meadow
	local m = Parts.model(parent, "Bridge_" .. style, { ModelStreamingMode = Enum.ModelStreamingMode.Atomic })
	local collision = Parts.folder(m, "Collision")
	local total = 0
	for i = 1, #pts - 1 do
		local a, b = pts[i], pts[i + 1]
		local len = (b - a).Magnitude
		if len < 0.5 then
			continue
		end
		total += len
		local cf = CFrame.lookAt(a, b)
		local mid = cf * CFrame.new(0, 0, -len / 2)
		-- smooth walk collider (top flush with the walk height)
		Parts.collider(collision, mid * CFrame.new(0, -0.75, 0), Vector3.new(width, 1.5, len + 1.2), "DeckCollider")
		-- visible deck
		if st.kind == "wood" or st.kind == "rope" then
			local n = math.max(1, math.floor(len / 2.4))
			for k = 0, n - 1 do
				local w = width * (k % 3 == 0 and 1 or 0.97)
				Parts.block(m, cf * CFrame.new(rng:NextNumber(-0.2, 0.2), -0.45, -(k + 0.5) * len / n), Vector3.new(w, 0.8, len / n - 0.25), k % 2 == 0 and st.deck or st.deck2, st.mat, { decor = true, shadow = true, name = "Plank" })
			end
			Parts.block(m, mid * CFrame.new(0, -1.4, 0), Vector3.new(width * 0.8, 1, len), Palette.woodDark, M.Wood, { decor = true, shadow = true, name = "Stringer" })
		elseif st.kind == "wafer" then
			Parts.block(m, mid * CFrame.new(0, -1, 0), Vector3.new(width, 2, len), st.deck, M.SmoothPlastic, { decor = true, shadow = true, name = "Wafer" })
			-- cross-hatch grooves
			local n = math.max(2, math.floor(len / 5))
			for k = 0, n do
				Parts.block(m, cf * CFrame.new(0, 0.02, -k * len / n), Vector3.new(width - 0.6, 0.12, 0.5), st.deck2, M.SmoothPlastic, { decor = true, shadow = false, name = "Groove" })
			end
			for k = -2, 2 do
				Parts.block(m, mid * CFrame.new(k * width / 5, 0.02, 0), Vector3.new(0.5, 0.12, len - 0.6), st.deck2, M.SmoothPlastic, { decor = true, shadow = false, name = "Groove" })
			end
		else
			Parts.block(m, mid * CFrame.new(0, -1.2, 0), Vector3.new(width, 2.4, len + 0.4), st.deck, st.mat, { decor = true, shadow = true, name = "Deck" })
			Parts.block(m, mid * CFrame.new(0, -2.6, 0), Vector3.new(width + 1.6, 0.8, len + 0.4), st.kind == "sky" and Palette.gold or st.deck2, st.kind == "sky" and M.SmoothPlastic or st.mat, { decor = true, name = "Trim" })
		end
		-- railings (top rail + posts collide: they are functional barriers)
		for _, side in { -1, 1 } do
			local off = side * (width / 2 - 0.6)
			local ra = (cf * CFrame.new(off, 0, 0)).Position
			local rb = (cf * CFrame.new(off, 0, -len)).Position
			local postN = math.max(1, math.floor(len / 8))
			if st.kind == "stone" or st.kind == "sky" then
				-- low parapet / balustrade
				Parts.span(m, ra + Vector3.new(0, 1.6, 0), rb + Vector3.new(0, 1.6, 0), 1.4, 3.2, st.rail, st.railMat, { name = "Parapet" })
				Parts.span(m, ra + Vector3.new(0, 3.5, 0), rb + Vector3.new(0, 3.5, 0), 1.9, 0.6, st.kind == "sky" and Palette.gold or st.deck2, st.kind == "sky" and M.SmoothPlastic or st.railMat, d())
			else
				for k = 0, postN do
					local p = ra:Lerp(rb, k / postN)
					local postColor = st.kind == "wafer" and (k % 2 == 0 and Palette.candyHot or Palette.candyCream) or st.rail
					Parts.block(m, CFrame.new(p + Vector3.new(0, 2.1, 0)), Vector3.new(1.1, 4.2, 1.1), postColor, st.railMat, { name = "RailPost" })
				end
				Parts.span(m, ra + Vector3.new(0, 3.9, 0), rb + Vector3.new(0, 3.9, 0), 0.7, 0.6, st.kind == "rope" and Palette.rope or st.rail, st.railMat, { name = "Rail" })
				Parts.span(m, ra + Vector3.new(0, 2.1, 0), rb + Vector3.new(0, 2.1, 0), 0.5, 0.5, st.kind == "rope" and Palette.rope or st.rail, st.railMat, d())
			end
		end
	end

	-- supports / arches underneath
	local a, b = pts[1], pts[#pts]
	local span = Util.flat(b - a).Magnitude
	if st.kind == "stone" or st.kind == "sky" then
		-- a shallow arch under the deck
		local segs = math.max(6, math.floor(span / 10))
		local archDepth = math.min(18, span * 0.18)
		for k = 0, segs - 1 do
			local t0, t1 = k / segs, (k + 1) / segs
			local p0 = a:Lerp(b, t0) - Vector3.new(0, 3 + archDepth * (2 * t0 - 1) ^ 2, 0)
			local p1 = a:Lerp(b, t1) - Vector3.new(0, 3 + archDepth * (2 * t1 - 1) ^ 2, 0)
			Parts.span(m, p0, p1, width * 0.86, 3, st.kind == "sky" and Palette.cream or st.deck2, st.mat, { decor = true, shadow = true, name = "Arch" })
		end
		-- fill the spandrels with a few vertical ribs
		for k = 1, segs - 1 do
			local t = k / segs
			local top = a:Lerp(b, t) - Vector3.new(0, 2.4, 0)
			local low = a:Lerp(b, t) - Vector3.new(0, 3 + archDepth * (2 * t - 1) ^ 2, 0)
			if (top - low).Magnitude > 2 then
				Parts.span(m, low, top, width * 0.8, 1.6, st.deck, st.mat, { decor = true, name = "Rib" })
			end
		end
	end
	if st.kind ~= "sky" then
		local nSup = math.floor(span / 55)
		for k = 1, nSup do
			local p = a:Lerp(b, k / (nSup + 1))
			local g = Field.groundTop(p.X, p.Z, p.Y - 2)
			local hgt = p.Y - 2.5 - g + 6
			if hgt > 4 and hgt < 140 then
				for _, side in { -1, 1 } do
					local dir = Util.flat(b - a).Unit
					local right = Vector3.new(-dir.Z, 0, dir.X)
					local base = p + right * side * (width / 2 - 2)
					local colColor = st.kind == "wafer" and Palette.candyPink or (st.kind == "stone" and st.deck2 or Palette.woodDark)
					Parts.block(m, CFrame.new(base.X, p.Y - 2.5 - hgt / 2, base.Z), Vector3.new(3, hgt, 3), colColor, st.kind == "wafer" and M.SmoothPlastic or st.railMat, { name = "Support" })
				end
			end
		end
	end
	m:SetAttribute("Length", math.floor(total))
	return m
end

-- Stepping stones: flat-topped pillars that sit just above the water and touch each other,
-- so they read as stones but walk like a path.
function S.steppingStones(parent: Instance, pts: { Vector3 }, width: number, rng: Random): Model
	local m = Parts.model(parent, "SteppingStones")
	local collision = Parts.folder(m, "Collision")
	for i = 1, #pts - 1 do
		local a, b = pts[i], pts[i + 1]
		local len = (b - a).Magnitude
		local dir = Util.flat(b - a).Unit
		local right = Vector3.new(-dir.Z, 0, dir.X)
		local n = math.max(1, math.ceil(len / 6))
		for k = 0, n do
			for _, lane in { -0.25, 0.25 } do
				local p = a:Lerp(b, k / n) + right * (lane * width + (k % 2 == 0 and 1.5 or -1.5)) + Vector3.new(rng:NextNumber(-0.8, 0.8), 0, rng:NextNumber(-0.8, 0.8))
				local dia = width * 0.52 + rng:NextNumber(-0.5, 1.5)
				local pillar = Parts.cyl(m, p - Vector3.new(0, 6, 0), 12, dia, Util.vary(Palette.stone, rng, 0.04), M.Slate, { decor = true, shadow = true, name = "Stone" })
				pillar.CFrame = pillar.CFrame * CFrame.Angles(rng:NextNumber(0, 6.28), 0, 0)
			end
		end
		local cf = CFrame.lookAt(a, b)
		Parts.collider(collision, cf * CFrame.new(0, -0.75, -len / 2), Vector3.new(width, 1.5, len + 1), "StonesCollider")
	end
	return m
end

----------------------------------------------------------------------
-- stairs
----------------------------------------------------------------------
-- Steps from a to b (walk heights). Visible treads are decor; one smooth ramp collides.
-- grounded = true: steps are solid down to the terrain; false: floating flight with a stringer.
function S.stairs(parent: Instance, a: Vector3, b: Vector3, width: number, opts): Model
	local o = opts or {}
	if a.Y > b.Y then
		a, b = b, a
	end
	local m = Parts.model(parent, o.name or "Stairs", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic })
	local collision = Parts.folder(m, "Collision")
	local rise = b.Y - a.Y
	local flat = Util.flat(b - a)
	local run = flat.Magnitude
	local n = math.max(1, math.ceil(rise / 1.35))
	local stepRise, stepRun = rise / n, run / n
	local yaw = Util.facing(a, flat)
	local stone = o.color or Palette.paleStone
	local stone2 = o.color2 or Palette.cream
	for i = 1, n do
		local top = a.Y + stepRise * (i - 0.5)
		local horiz = (i - 0.5) * stepRun
		local base = yaw * CFrame.new(0, 0, -horiz)
		local bottom = o.grounded and (top - stepRise * 2 - 6) or (top - stepRise - 1.2)
		local h = top - bottom
		local cfStep = CFrame.new(base.Position.X, bottom + h / 2, base.Position.Z) * yaw.Rotation
		Parts.block(m, cfStep, Vector3.new(width, h, stepRun + 0.12), i % 2 == 0 and stone or stone2, o.material or M.Slate, { decor = true, shadow = true, name = "Step" })
	end
	Parts.rampCollider(collision, a, b, width, "StairRamp")
	-- side walls / balustrades
	local wallColor = o.wall or stone
	for _, side in { -1, 1 } do
		local off = side * (width / 2 + 0.9)
		local pa = (yaw * CFrame.new(off, 0, 0)).Position
		local pb = pa + (b - a)
		Parts.span(m, pa + Vector3.new(0, 1.6, 0), pb + Vector3.new(0, 1.6, 0), 1.8, 3.4, wallColor, o.material or M.Slate, { name = "Balustrade" })
		if o.trim then
			Parts.span(m, pa + Vector3.new(0, 3.5, 0), pb + Vector3.new(0, 3.5, 0), 2.3, 0.6, o.trim, M.SmoothPlastic, d())
		end
		if not o.grounded then
			Parts.span(m, pa + Vector3.new(0, -2.5, 0), pb + Vector3.new(0, -2.5, 0), 2.2, 4, o.stringer or stone2, o.material or M.Slate, { decor = true, shadow = true, name = "Stringer" })
		end
	end
	return m
end

-- Flat landing / walkway slab between two walk-height points (used by struct paths).
function S.landing(parent: Instance, a: Vector3, b: Vector3, width: number, opts): Model
	local o = opts or {}
	local m = Parts.model(parent, o.name or "Landing", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic })
	local collision = Parts.folder(m, "Collision")
	local len = (b - a).Magnitude
	local cf = CFrame.lookAt(a, b)
	local ext = o.ext or 0
	local mid = cf * CFrame.new(0, 0, -len / 2)
	Parts.collider(collision, mid * CFrame.new(0, -0.75, 0), Vector3.new(width, 1.5, len + ext), "LandingCollider")
	Parts.block(m, mid * CFrame.new(0, -1.6, 0), Vector3.new(width, 3.2, len + ext), o.color or Palette.white, o.material or M.Marble, { decor = true, shadow = true, name = "Slab" })
	Parts.block(m, mid * CFrame.new(0, -3.4, 0), Vector3.new(width + 1.4, 0.8, len + ext + 1.4), o.trim or Palette.gold, M.SmoothPlastic, { decor = true, name = "Trim" })
	return m
end

-- Column from ground up to y (supports for floating structures).
function S.supportColumn(parent: Instance, pos: Vector3, topY: number, diameter: number, color: Color3, trim: Color3?)
	local g = Field.groundTop(pos.X, pos.Z, topY - 1) - 2
	local h = topY - g
	if h < 3 or h > 220 then
		return
	end
	Parts.cyl(parent, Vector3.new(pos.X, g + h / 2, pos.Z), h, diameter, color, M.Marble, { name = "SupportColumn" })
	Parts.block(parent, CFrame.new(pos.X, topY - 1, pos.Z), Vector3.new(diameter + 2, 2, diameter + 2), trim or color, M.SmoothPlastic, d())
	Parts.block(parent, CFrame.new(pos.X, g + 3, pos.Z), Vector3.new(diameter + 2.4, 2, diameter + 2.4), trim or color, M.SmoothPlastic, d())
end

----------------------------------------------------------------------
-- waterfalls & lava falls
----------------------------------------------------------------------
local SMOKE = "rbxasset://textures/particles/smoke_main.dds"
local SPARK = "rbxasset://textures/particles/sparkles_main.dds"
S.SMOKE, S.SPARK = SMOKE, SPARK

-- Waterfall sheet whose top lip is at `lip` (centre), flowing along `dir`, falling to bottomY.
function S.waterfall(parent: Instance, lip: Vector3, dir: Vector3, width: number, bottomY: number, kind: string?, rng: Random): Model
	local lava = kind == "lava"
	local m = Parts.model(parent, lava and "LavaFall" or "Waterfall")
	local fwd = Util.flat(dir).Unit
	local h = lip.Y - bottomY
	local cf = Util.facing(Vector3.new(lip.X, bottomY + h / 2, lip.Z) + fwd * 1.5, fwd)
	local main = lava and Palette.lava or Color3.fromRGB(150, 228, 246)
	local streak = lava and Palette.lavaHot or Color3.fromRGB(226, 248, 255)
	Parts.block(m, cf, Vector3.new(width, h + 2, 2.2), main, lava and M.Neon or M.Glass, { decor = true, transparency = lava and 0 or 0.22, reflectance = lava and 0 or 0.08, shadow = false, name = "Sheet" })
	-- brighter vertical streaks in front of the sheet give the low-poly flow texture
	local streaks = math.max(2, math.floor(width / 7))
	for i = 1, streaks do
		local x = (i - 0.5) / streaks * width - width / 2 + rng:NextNumber(-1.5, 1.5)
		local len = h * rng:NextNumber(0.55, 1)
		Parts.block(m, cf * CFrame.new(x, (h - len) / 2 + 1, -1.3), Vector3.new(rng:NextNumber(1.6, 3.2), len, 0.4), streak, lava and M.Neon or M.SmoothPlastic, { decor = true, transparency = lava and 0.1 or 0.3, shadow = false, name = "Streak" })
	end
	-- rounded lip
	Parts.ellipsoid(m, CFrame.new(lip + fwd * 0.5) * cf.Rotation, Vector3.new(width + 2, 3, 5), streak, lava and M.Neon or M.SmoothPlastic, { decor = true, transparency = lava and 0 or 0.15, shadow = false, name = "Lip" })
	-- foam / glow pool at the landing
	local landing = Vector3.new(lip.X, bottomY + 0.4, lip.Z) + fwd * 7
	local foam = Parts.ellipsoid(m, CFrame.new(landing), Vector3.new(width * 1.25, 2, 16), lava and Palette.lavaHot or Color3.fromRGB(240, 252, 255), lava and M.Neon or M.SmoothPlastic, { decor = true, transparency = lava and 0.05 or 0.25, shadow = false, name = "Foam" })
	if lava then
		Parts.emitter(foam, {
			Texture = SPARK, Rate = 3, Lifetime = NumberRange.new(2, 3.5), Speed = NumberRange.new(4, 9),
			SpreadAngle = Vector2.new(30, 30), Acceleration = Vector3.new(0, 2, 0), LightEmission = 1,
			Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 0.1) }),
			Color = ColorSequence.new(Palette.ember), EmissionDirection = Enum.NormalId.Top,
		})
		Parts.light(foam, "PointLight", { Color = Palette.ember, Brightness = 2, Range = math.min(60, 20 + width), Shadows = false })
	else
		Parts.emitter(foam, {
			Texture = SMOKE, Rate = math.clamp(width / 6, 3, 10), Lifetime = NumberRange.new(1.4, 2.4), Speed = NumberRange.new(3, 7),
			SpreadAngle = Vector2.new(50, 50), Drag = 1.5, LightInfluence = 1, EmissionDirection = Enum.NormalId.Top,
			Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 4), NumberSequenceKeypoint.new(1, 12) }),
			Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.55), NumberSequenceKeypoint.new(1, 1) }),
			Color = ColorSequence.new(Color3.fromRGB(235, 250, 255)),
		})
	end
	return m
end

----------------------------------------------------------------------
-- cliff dressing
----------------------------------------------------------------------
-- Faceted rock slab leaning against a cliff face between y0 (foot) and y1 (rim).
function S.cliffFacet(parent: Instance, base: Vector3, outward: Vector3, y0: number, y1: number, width: number, color: Color3, material: Enum.Material, rng: Random)
	local h = y1 - y0
	if h < 6 then
		return
	end
	local depth = math.clamp(h * 0.35, 6, 18)
	local cf = Util.facing(Vector3.new(base.X, y0 + h / 2, base.Z), outward)
		* CFrame.Angles(rad(rng:NextNumber(-10, -4)), rng:NextNumber(-0.25, 0.25), rng:NextNumber(-0.06, 0.06))
		* CFrame.new(0, 0, depth * 0.15)
	Parts.block(parent, cf, Vector3.new(width, h, depth), Util.vary(color, rng, 0.035), material, { name = "CliffFacet", shadow = true })
	if h > 18 and rng:NextNumber() < 0.6 then
		local h2 = h * rng:NextNumber(0.35, 0.6)
		Parts.block(parent, Util.facing(Vector3.new(base.X, y0 + h2 / 2, base.Z), outward) * CFrame.Angles(rad(-8), rng:NextNumber(-0.5, 0.5), 0) * CFrame.new(rng:NextNumber(-width / 3, width / 3), 0, -depth * 0.3), Vector3.new(width * 0.6, h2, depth * 0.7), Util.vary(color, rng, 0.05), material, { name = "CliffFacet", shadow = true })
	end
end

-- Thick frosting lip with drips along a candy cliff rim.
function S.frosting(parent: Instance, rim: Vector3, outward: Vector3, width: number, rng: Random)
	local c = rng:NextNumber() < 0.5 and Palette.candyFrost or Palette.candyCream
	local cf = Util.facing(rim, outward)
	Parts.ellipsoid(parent, cf * CFrame.new(0, -1.2, -1.5), Vector3.new(width * 1.25, 5, 9), c, M.SmoothPlastic, { decor = true, shadow = true, name = "FrostingLip" })
	for _ = 1, rng:NextInteger(1, 2) do
		local len = rng:NextNumber(6, 18)
		Parts.ellipsoid(parent, cf * CFrame.new(rng:NextNumber(-width / 2.5, width / 2.5), -len / 2, -3.2), Vector3.new(rng:NextNumber(4, 7), len, 4), c, M.SmoothPlastic, { decor = true, shadow = true, name = "FrostingDrip" })
	end
end

-- Stone ruin archway (jungle). Two mossy pillars, a lintel and a glowing rune.
function S.ruinArch(parent: Instance, pos: Vector3, facing: Vector3, width: number, height: number, rng: Random): Model
	local m = Parts.model(parent, "RuinArch", { ModelStreamingMode = Enum.ModelStreamingMode.Atomic })
	local cf = Util.facing(pos, facing)
	local stone = Color3.fromRGB(128, 132, 124)
	local pillarW = 8
	for _, side in { -1, 1 } do
		local x = side * (width / 2 - pillarW / 2)
		local blocks = math.floor(height / 8)
		for i = 0, blocks - 1 do
			local bh = height / blocks
			Parts.block(m, cf * CFrame.new(x + rng:NextNumber(-0.4, 0.4), bh * (i + 0.5), 0) * CFrame.Angles(0, rng:NextNumber(-0.04, 0.04), 0), Vector3.new(pillarW, bh - 0.2, pillarW * 1.1), Util.vary(stone, rng, 0.04), M.Slate, { name = "Pillar" })
		end
		Parts.block(m, cf * CFrame.new(x, height * 0.55, -pillarW * 0.56), Vector3.new(pillarW * 0.9, height * 0.5, 0.4), Palette.vine, M.Grass, { decor = true, name = "Moss" })
	end
	Parts.block(m, cf * CFrame.new(0, height + 3, 0), Vector3.new(width + 4, 6, pillarW * 1.3), stone, M.Slate, { name = "Lintel" })
	Parts.block(m, cf * CFrame.new(0, height + 7.5, 0), Vector3.new(width * 0.6, 3, pillarW * 1.1), Util.vary(stone, rng, 0.05), M.Slate, { name = "Crown" })
	local rune = Parts.block(m, cf * CFrame.new(0, height + 3, -pillarW * 0.66) * CFrame.Angles(0, 0, rad(45)), Vector3.new(3.4, 3.4, 0.4), Palette.cyan, M.Neon, { decor = true, name = "Rune" })
	Parts.light(rune, "PointLight", { Color = Palette.cyan, Brightness = 1, Range = 16, Shadows = false })
	for _, side in { -1, 1 } do
		local rp = cf * CFrame.new(side * (width / 2 - pillarW / 2), height * 0.6, -pillarW * 0.62)
		Parts.block(m, rp * CFrame.Angles(0, 0, rad(45)), Vector3.new(2.2, 2.2, 0.3), Palette.cyan, M.Neon, { decor = true, name = "Rune" })
	end
	return m
end

-- Classical column: base, shaft, capital.
function S.column(parent: Instance, pos: Vector3, height: number, diameter: number, shaft: Color3, trim: Color3, material: Enum.Material?)
	Parts.block(parent, CFrame.new(pos + Vector3.new(0, 1, 0)), Vector3.new(diameter + 2.4, 2, diameter + 2.4), trim, M.SmoothPlastic, { name = "ColumnBase" })
	Parts.cyl(parent, pos + Vector3.new(0, height / 2, 0), height - 3.6, diameter, shaft, material or M.Marble, { name = "ColumnShaft" })
	Parts.block(parent, CFrame.new(pos + Vector3.new(0, height - 0.9, 0)), Vector3.new(diameter + 2.8, 1.8, diameter + 2.8), trim, M.SmoothPlastic, { name = "Capital" })
end

return S
