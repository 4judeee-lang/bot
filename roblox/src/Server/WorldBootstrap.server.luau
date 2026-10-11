-- Server bootstrap. The world is meant to be built once in Studio and saved with the
-- place. As a fallback (e.g. a fresh Rojo-synced place), set the Workspace attribute
-- "AutoBuildWorld" = true and the server builds the map on start if it is missing.
-- It never deletes or rebuilds an existing WorldMap.

local ServerStorage = game:GetService("ServerStorage")

if workspace:FindFirstChild("WorldMap") then
	return
end

if workspace:GetAttribute("AutoBuildWorld") == true then
	local builder = ServerStorage:FindFirstChild("WorldBuilder")
	if builder then
		warn("[WorldBootstrap] WorldMap missing - building at runtime (slow; prefer building in Studio and saving)")
		require(builder).Build({ skipLibrary = true, audit = false })
	end
else
	warn("[WorldBootstrap] Workspace.WorldMap is missing. Build it in Studio: require(game.ServerStorage.WorldBuilder).Build()")
end
