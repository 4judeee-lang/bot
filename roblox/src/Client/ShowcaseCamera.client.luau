-- Optional showcase camera for comparison screenshots and trailers.
-- Set the Workspace attribute "ShowcaseCamera" to a name from
-- ReplicatedStorage.WorldShared.ReferenceCameras (e.g. "Overview") during a Play test;
-- clear it to return to the normal camera. Depth of field is only used here,
-- never during normal gameplay.

local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Cameras = require(ReplicatedStorage:WaitForChild("WorldShared"):WaitForChild("ReferenceCameras"))

local dof: DepthOfFieldEffect? = nil

local function update()
	local name = workspace:GetAttribute("ShowcaseCamera")
	local camera = workspace.CurrentCamera
	local spec = name and Cameras[name]
	if spec then
		camera.CameraType = Enum.CameraType.Scriptable
		camera.CFrame = CFrame.lookAt(spec.pos, spec.look)
		camera.FieldOfView = spec.fov
		if not dof then
			dof = Instance.new("DepthOfFieldEffect")
			dof.Name = "ShowcaseDepthOfField"
			dof.FarIntensity = 0.12
			dof.NearIntensity = 0
			dof.InFocusRadius = 600
			dof.FocusDistance = (spec.look - spec.pos).Magnitude
			dof.Parent = Lighting
		end
		-- Ask streaming to load around the showcase view.
		pcall(function()
			game:GetService("Players").LocalPlayer:RequestStreamAroundAsync(spec.look, 10)
		end)
	else
		camera.CameraType = Enum.CameraType.Custom
		camera.FieldOfView = 70
		if dof then
			dof:Destroy()
			dof = nil
		end
	end
end

workspace:GetAttributeChangedSignal("ShowcaseCamera"):Connect(update)
if workspace:GetAttribute("ShowcaseCamera") then
	update()
end
