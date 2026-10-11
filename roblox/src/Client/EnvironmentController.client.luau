-- Client-side environment controller.
-- Blends Lighting and post-processing towards the mood of the biome the local player
-- is in, over BiomeZones.BlendTime seconds. Everything happens on this client only,
-- so two players in different biomes each see their own mood.
--
-- Zones are plain data, so this keeps working while scenery streams in and out.
-- It follows the camera subject, which also covers death, respawn and spectating.

local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local BiomeZones = require(ReplicatedStorage:WaitForChild("WorldShared"):WaitForChild("BiomeZones"))

local player = Players.LocalPlayer
local CHECK_INTERVAL = 0.5

local EFFECTS = {
	Atmosphere = { class = "Atmosphere", name = "WorldAtmosphere" },
	Bloom = { class = "BloomEffect", name = "WorldBloom" },
	ColorCorrection = { class = "ColorCorrectionEffect", name = "WorldColor" },
	SunRays = { class = "SunRaysEffect", name = "WorldSunRays" },
}

-- Find (or locally create) the effect instances the moods drive.
local function getTargets()
	local targets = { Lighting = Lighting }
	for group, spec in EFFECTS do
		local inst = Lighting:FindFirstChild(spec.name)
		if not inst then
			inst = Lighting:FindFirstChildOfClass(spec.class)
		end
		if not inst then
			inst = Instance.new(spec.class)
			inst.Name = spec.name
			inst.Parent = Lighting
		end
		targets[group] = inst
	end
	return targets
end

local targets = getTargets()
local activeTweens: { Tween } = {}
local currentMood: string? = nil

-- Properties that cannot be tweened are snapped instead.
local function isTweenable(v: any): boolean
	local t = typeof(v)
	return t == "number" or t == "Color3" or t == "Vector3"
end

local function applyMood(moodName: string, instant: boolean?)
	if moodName == currentMood then
		return
	end
	currentMood = moodName
	for _, tw in activeTweens do
		tw:Cancel()
	end
	table.clear(activeTweens)
	local mood = BiomeZones.Resolve(moodName)
	local info = TweenInfo.new(instant and 0 or BiomeZones.BlendTime, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut)
	for group, props in mood do
		local inst = targets[group]
		if inst and inst.Parent then
			local goal = {}
			for k, v in props do
				if isTweenable(v) and not instant then
					goal[k] = v
				else
					pcall(function()
						(inst :: any)[k] = v
					end)
				end
			end
			if next(goal) then
				local ok, tw = pcall(TweenService.Create, TweenService, inst, info, goal)
				if ok then
					tw:Play()
					table.insert(activeTweens, tw)
				else
					-- fall back to snapping if a property is not tweenable on this engine version
					for k, v in goal do
						pcall(function()
							(inst :: any)[k] = v
						end)
					end
				end
			end
		end
	end
end

local function subjectPosition(): Vector3?
	local camera = workspace.CurrentCamera
	local subject = camera and camera.CameraSubject
	if subject then
		if subject:IsA("Humanoid") then
			local root = subject.RootPart
			if root then
				return root.Position
			end
		elseif subject:IsA("BasePart") then
			return subject.Position
		end
	end
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if root and root:IsA("BasePart") then
		return root.Position
	end
	return camera and camera.CFrame.Position or nil
end

local function evaluate(instant: boolean?)
	-- Effects may be replaced by a rebuild; re-acquire if one went missing.
	for group in EFFECTS do
		local inst = targets[group]
		if not inst or not inst.Parent then
			targets = getTargets()
			break
		end
	end
	local pos = subjectPosition()
	if not pos then
		return
	end
	local zone = BiomeZones.ZoneAt(pos)
	applyMood(zone and zone.Mood or "Default", instant)
end

-- Respawns: snap to the right mood at the new spawn position instead of blending
-- from wherever the player died.
player.CharacterAdded:Connect(function(character)
	local root = character:WaitForChild("HumanoidRootPart", 10)
	if root then
		currentMood = nil
		evaluate(true)
	end
end)

evaluate(true)
while true do
	task.wait(CHECK_INTERVAL)
	local ok, err = pcall(evaluate, false)
	if not ok then
		warn("[EnvironmentController] " .. tostring(err))
	end
end
