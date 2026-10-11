-- Headless build + audit. Prints a summary; with __EXPORT set, also dumps the
-- height field and visible parts for tools/render.py.
local H = __HARNESS
local t0 = os.clock()
local WB = H.require(H.ServerStorage.WorldBuilder)
local summary = WB.Build({})
print(string.format("BUILD_OK seconds=%.1f parts=%d colliders=%d lights=%d emitters=%d bridges=%d", os.clock() - t0, summary.parts, summary.colliders, summary.lights, summary.emitters, summary.bridges))
local ts = H.Mock.terrainStats
print(string.format("TERRAIN writes=%d voxels=%d solid=%d liquid=%d colors=%d", ts.writes, ts.voxels, ts.solid, ts.liquid, ts.colors))
for k, v in H.tagged do
	print("TAG", k, v)
end
for _, w in summary.warnings do
	print("BUILD_WARNING", w)
end

local Network = H.require(H.ServerStorage.WorldBuilder.Network)
for _, b in Network.bridges do
	print(string.format("BRIDGE %s %s len=%.0f water=%s clear=%.1f", b.path, b.model.Name, b.length, b.water > -1e8 and string.format("%.0f", b.water) or "-", b.minClear))
end

-- region part counts
local root = H.Workspace.WorldMap
for _, region in root:GetChildren() do
	local n = 0
	for _, d in region:GetDescendants() do
		if d:IsA("BasePart") then
			n += 1
		end
	end
	print("REGION", region.Name, n)
end

if __EXPORT then
	local Field = H.require(H.ServerStorage.WorldBuilder.Field)
	local step = 8
	local half = 1800
	local n = half * 2 / step
	print(string.format("HF %d %d %d %d", -half, -half, step, n))
	for i = 0, n - 1 do
		local row = table.create(n)
		local x = -half + (i + 0.5) * step
		for k = 0, n - 1 do
			local z = -half + (k + 0.5) * step
			local s = Field.sample(x, z)
			local w = s.water > s.h and s.water or -1
			if s.lava and s.water > -1e8 then
				w = -2 - s.water -- lava marker
			end
			row[k + 1] = string.format("%.1f,%.1f,%d,%d,%d", s.h, w, s.biome, s.path, s.bed and 1 or 0)
		end
		print("R " .. table.concat(row, " "))
	end
	for i = 0, n - 1 do
		local x = -half + (i + 0.5) * step
		for k = 0, n - 1 do
			local z = -half + (k + 0.5) * step
			local isl = Field.island(x, z)
			if isl then
				print(string.format("I %.0f %.0f %.1f %.1f %d %.1f", x, z, isl.top, isl.bottom, isl.path, isl.pool or -1))
			end
		end
	end
	for _, p in root:GetDescendants() do
		if p:IsA("BasePart") and p.Transparency < 0.95 then
			local c = p.CFrame
			local shape = (p.ClassName == "Part" and p.Shape) and p.Shape.Name or p.ClassName
			if p:FindFirstChildOfClass("SpecialMesh") then
				shape = "Ellipsoid"
			end
			print(string.format("P %s %.2f %.2f %.2f %.3f %.3f %.3f %.3f %.3f %.3f %.3f %.3f %.3f %.2f %.2f %.2f %.3f %.3f %.3f %.2f %d",
				shape, c.p.X, c.p.Y, c.p.Z, c.r.X, c.r.Y, c.r.Z, c.u.X, c.u.Y, c.u.Z, c.b.X, c.b.Y, c.b.Z,
				p.Size.X, p.Size.Y, p.Size.Z, p.Color.R, p.Color.G, p.Color.B, p.Transparency, p.Material.Name == "Neon" and 1 or 0))
		end
	end
end
print("DONE")
