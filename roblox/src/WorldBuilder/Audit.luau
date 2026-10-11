-- Map audit: walks every route with raycasts against the real collision and reports
-- holes, bumps, obstructions, low ceilings, steep grades, unanchored parts and tiny
-- colliders. Run it after a build (WorldBuilder.Audit()) and fix anything it lists.

local Util = require(script.Parent.Util)
local Layout = require(script.Parent.Layout)
local Field = require(script.Parent.Field)
local Network = require(script.Parent.Network)

local Audit = {}

local MAX_LIST = 40

local function push(list, item)
	if #list < MAX_LIST then
		table.insert(list, item)
	end
end

local function fmt(v: Vector3): string
	return string.format("(%.0f, %.0f, %.0f)", v.X, v.Y, v.Z)
end

function Audit.run(root: Instance, opts)
	local o = opts or {}
	local step = o.step or 4
	local report = {
		samples = 0, holes = {}, bumps = {}, obstructions = {}, lowCeilings = {}, steepGrades = {}, steepSurfaces = {},
		unanchored = 0, tinyColliders = {}, bridges = #Network.bridges, lowBridges = {}, markers = {}, spawn = nil,
		holeCount = 0, bumpCount = 0, obstructionCount = 0, ceilingCount = 0, surfaceCount = 0, bendCount = 0, bends = {},
	}
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	local exclude = {}
	local markers = root:FindFirstChild("GameplayMarkers")
	if markers then
		table.insert(exclude, markers)
	end
	params.FilterDescendantsInstances = exclude
	params.RespectCanCollide = true
	params.IgnoreWater = true
	-- second query that ignores terrain, to recognise decks laid flush over terrain edges
	local partsOnly = RaycastParams.new()
	partsOnly.FilterType = Enum.RaycastFilterType.Exclude
	local ex2 = table.clone(exclude)
	table.insert(ex2, workspace.Terrain)
	partsOnly.FilterDescendantsInstances = ex2
	partsOnly.RespectCanCollide = true

	-- 1) design grades from the layout data
	for _, s in Field.pathSegs do
		local run = math.sqrt((s.bx - s.ax) ^ 2 + (s.bz - s.az) ^ 2)
		if run > 1 then
			local deg = math.deg(math.atan(math.abs(s.bh - s.ah) / run))
			local limit = s.stairs and 32 or 20.5
			if deg > limit then
				push(report.steepGrades, string.format("%s seg %d: %.1f deg (limit %.0f)", s.path.id, s.index, deg, limit))
			end
		end
	end

	-- 2) raycast every walkway
	for _, w in Network.walkways do
		local pts = w.pts
		local hw = w.width / 2
		for i = 1, #pts - 1 do
			local a, b = pts[i], pts[i + 1]
			local len = (b - a).Magnitude
			local n = math.max(1, math.floor(len / step))
			local dir = Util.flat(b - a)
			if dir.Magnitude < 0.01 then
				continue
			end
			dir = dir.Unit
			local right = Vector3.new(-dir.Z, 0, dir.X)
			local prevHit: Vector3? = nil
			for k = 0, n do
				local c = a:Lerp(b, k / n)
				report.samples += 1
				-- inside corners of bends blend the two segment grades; allow a little more there
				local nearBend = (i > 1 and (c - a).Magnitude < hw + 2) or (i < #pts - 1 and (c - b).Magnitude < hw + 2)
				for _, lat in { 0, -(hw - 3), hw - 3 } do
					local p = c + right * lat
					local hit = workspace:Raycast(p + Vector3.new(0, 12, 0), Vector3.new(0, -40, 0), params)
					local tol = (w.kind == "stairs" or w.kind == "skystairs" or w.kind == "struct") and 2.6 or 2.5
					if hit and nearBend and lat ~= 0 and math.abs(hit.Position.Y - p.Y) > tol and math.abs(hit.Position.Y - p.Y) < 3.5 and hit.Instance == workspace.Terrain then
						report.bendCount += 1
						push(report.bends, string.format("%s %s lat %.0f: %.1f (bend blend)", w.name, fmt(p), lat, hit.Position.Y - p.Y))
					elseif not hit or hit.Position.Y < p.Y - tol then
						report.holeCount += 1
						push(report.holes, string.format("%s %s lat %.0f: %s", w.name, fmt(p), lat, hit and string.format("ground %.1f below", p.Y - hit.Position.Y) or "no ground"))
					elseif hit.Position.Y > p.Y + tol then
						report.bumpCount += 1
						push(report.bumps, string.format("%s %s lat %.0f: %.1f above (%s)", w.name, fmt(p), lat, hit.Position.Y - p.Y, hit.Instance.Name))
					elseif lat == 0 and hit.Normal.Y < math.cos(math.rad(38)) and not (function()
						-- a bridge/landing deck flush with a terrain edge is fine
						if hit.Instance ~= workspace.Terrain then
							return false
						end
						local deck = workspace:Raycast(p + Vector3.new(0, 12, 0), Vector3.new(0, -40, 0), partsOnly)
						return deck ~= nil and math.abs(deck.Position.Y - hit.Position.Y) < 0.75 and deck.Normal.Y > 0.8
					end)() then
						report.surfaceCount += 1
						push(report.steepSurfaces, string.format("%s %s normal %.2f (%s)", w.name, fmt(p), hit.Normal.Y, hit.Instance.Name))
					end
					if lat == 0 and hit then
						-- obstruction between this sample and the previous one at knee and chest height
						if prevHit then
							for _, hgt in { 2.6, 5 } do
								local from = prevHit + Vector3.new(0, hgt, 0)
								local to = hit.Position + Vector3.new(0, hgt, 0)
								local ob = workspace:Raycast(from, to - from, params)
								if ob and ob.Instance ~= workspace.Terrain then
									report.obstructionCount += 1
									push(report.obstructions, string.format("%s %s: %s at +%.1f", w.name, fmt(ob.Position), ob.Instance:GetFullName(), hgt))
									break
								end
							end
						end
						prevHit = hit.Position
						-- headroom
						local up = workspace:Raycast(hit.Position + Vector3.new(0, 0.5, 0), Vector3.new(0, 10.5, 0), params)
						if up then
							report.ceilingCount += 1
							push(report.lowCeilings, string.format("%s %s: %s %.1f above", w.name, fmt(hit.Position), up.Instance.Name, up.Position.Y - hit.Position.Y))
						end
					end
				end
			end
			Util.breathe()
		end
	end

	-- 3) bridges clearance over water/ground
	for _, b in Network.bridges do
		if b.minClear < 1.5 then
			push(report.lowBridges, string.format("%s bridge %s -> %s clearance %.1f", b.path, fmt(b.a), fmt(b.b), b.minClear))
		end
	end

	-- 4) parts: anchoring and tiny colliders
	for _, d in root:GetDescendants() do
		if d:IsA("BasePart") then
			if not d.Anchored then
				report.unanchored += 1
			end
			if d.CanCollide and d.Transparency < 1 and math.min(d.Size.X, d.Size.Y, d.Size.Z) < 0.35 and d.Size.Magnitude < 2.5 then
				push(report.tinyColliders, d:GetFullName())
			end
		end
	end

	-- 5) markers and spawn
	if markers then
		for _, f in markers:GetChildren() do
			report.markers[f.Name] = #f:GetChildren()
		end
	end
	local sp = Layout.SPAWN
	local hit = workspace:Raycast(sp + Vector3.new(0, 5, 0), Vector3.new(0, -20, 0), params)
	report.spawn = hit and string.format("ground at %.1f (%s)", hit.Position.Y, hit.Instance.Name) or "NO GROUND UNDER SPAWN"
	return report
end

function Audit.print(r)
	print(string.format("[Audit] samples %d | holes %d | bumps %d | obstructions %d | low ceilings %d | steep surfaces %d | steep grades %d | unanchored %d | bridges %d (low %d) | bend blends %d | spawn: %s",
		r.samples, r.holeCount, r.bumpCount, r.obstructionCount, r.ceilingCount, r.surfaceCount, #r.steepGrades, r.unanchored, r.bridges, #r.lowBridges, r.bendCount, tostring(r.spawn)))
	for _, key in { "steepGrades", "holes", "bumps", "obstructions", "lowCeilings", "steepSurfaces", "lowBridges", "tinyColliders", "bends" } do
		for _, line in r[key] do
			print("  [" .. key .. "] " .. line)
		end
	end
	for k, v in r.markers do
		print(string.format("  [markers] %s: %d", k, v))
	end
end

return Audit
