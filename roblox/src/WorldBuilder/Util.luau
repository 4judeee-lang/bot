-- Small math helpers shared by every builder module. Nothing here touches the DataModel.

local Util = {}

function Util.clamp(x: number, a: number, b: number): number
	if x < a then
		return a
	elseif x > b then
		return b
	end
	return x
end

function Util.lerp(a: number, b: number, t: number): number
	return a + (b - a) * t
end

function Util.smoothstep(e0: number, e1: number, x: number): number
	local t = Util.clamp((x - e0) / (e1 - e0), 0, 1)
	return t * t * (3 - 2 * t)
end

-- Distance from (px, pz) to segment (ax, az)-(bx, bz) on the XZ plane.
-- Returns distance and the unclamped projection parameter t.
function Util.segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): (number, number)
	local dx, dz = bx - ax, bz - az
	local len2 = dx * dx + dz * dz
	local t = 0
	if len2 > 1e-9 then
		t = ((px - ax) * dx + (pz - az) * dz) / len2
	end
	local tc = Util.clamp(t, 0, 1)
	local cx, cz = ax + dx * tc - px, az + dz * tc - pz
	return math.sqrt(cx * cx + cz * cz), t
end

-- Deterministic value noise in roughly [-1, 1].
function Util.noise2(x: number, z: number, seed: number?): number
	return math.noise(x, z, seed or 0.37) * 1.6
end

-- Two-octave noise used for organic outlines and gentle ground roll.
function Util.fbm(x: number, z: number, seed: number?): number
	local s = seed or 0.11
	return Util.noise2(x, z, s) * 0.65 + Util.noise2(x * 2.03, z * 2.03, s + 3.1) * 0.35
end

-- Hash of a grid cell into [0, 1). Used for dithering and stable per-cell choices.
function Util.hash(ix: number, iz: number, salt: number?): number
	local h = math.sin(ix * 127.1 + iz * 311.7 + (salt or 0) * 74.7) * 43758.5453
	return h - math.floor(h)
end

function Util.v3(x: number, y: number, z: number): Vector3
	return Vector3.new(x, y, z)
end

function Util.flat(v: Vector3): Vector3
	return Vector3.new(v.X, 0, v.Z)
end

-- Yaw-only CFrame at pos facing along the XZ direction dir.
function Util.facing(pos: Vector3, dir: Vector3): CFrame
	local d = Vector3.new(dir.X, 0, dir.Z)
	if d.Magnitude < 1e-6 then
		d = Vector3.new(0, 0, -1)
	end
	return CFrame.lookAt(pos, pos + d.Unit)
end

-- Variation helper: shift a colour's brightness/saturation slightly.
function Util.vary(c: Color3, rng: Random, amount: number?): Color3
	local a = amount or 0.06
	local h, s, v = c:ToHSV()
	h = (h + rng:NextNumber(-a, a) * 0.15) % 1
	s = Util.clamp(s + rng:NextNumber(-a, a), 0, 1)
	v = Util.clamp(v + rng:NextNumber(-a, a), 0, 1)
	return Color3.fromHSV(h, s, v)
end

-- Cooperative yield so long Studio builds keep the UI responsive.
local lastYield = os.clock()
function Util.breathe()
	if os.clock() - lastYield > 0.25 then
		lastYield = os.clock()
		task.wait()
	end
end

return Util
