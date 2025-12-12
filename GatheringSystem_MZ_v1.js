/*:
 * @target MZ
 * @plugindesc [Gathering] Region-Based Daily Gathering System
 * @author OuttieTV
 *
 * @help
 * ==============================================================================
 * 📜 Plugin: GatheringSystem_MZ_v1.js
 * ==============================================================================
 *
 * **Dependencies:**
 * 1. Shaz_TileChangerMZ.js (for dynamic tile modifications)
 * 2. GameTime_MZ_v1.js (for tracking in-game time)
 *
 * This plugin adds a system for gathering resources that dynamically spawn
 * based on map regions at the start of every in-game day.
 *
 * **⚙️ Plugin Parameters (JSON Configuration):**
 * The 'Gathering Configuration' parameter must be a single, valid JSON
 * string.
 *
 * If 'Load JSON from file' is **true**, the plugin will attempt to load its
 * configuration from 'GatheringConfig.json' in the /data/ folder. The
 * 'Gathering Configuration' parameter will be ignored.
 *
 * Example Configuration (in 'GatheringConfig.json' or the parameter field):
 * ```json
 * {
 * "regionWildflowers": 7,
 * "regionBerries": 8,
 * "regionJunk": 9,
 * "GatheringData": [
 * {
 * "name": "Dandelions",
 * "type": "wildflowers",
 * "itemID": 20,
 * "tileID": 20,
 * "spawnChance": 80
 * },
 * {
 * "name": "Rose Bush",
 * "type": "wildflowers",
 * "itemID": 21,
 * "tileID": 21,
 * "spawnChance": 20
 * },
 * {
 * "name": "Forest Berries",
 * "type": "berries",
 * "itemID": 22,
 * "tileID": 22,
 * "spawnChance": 100
 * }
 * ]
 * }
 * ```
 * ```
 *
 * - **region[Type]**: Maps a gathering *type* (e.g., "wildflowers") to an RPG
 * Maker **Region ID**.
 * - **GatheringData**: An array of objects defining each potential resource:
 * - **name**: Display name for the gathered item.
 * - **type**: Must match a key in the region mapping (e.g., "wildflowers").
 * - **itemID**: The ID of the item in the database ($dataItems) to gain.
 * - **tileID**: The new A-Layer tile ID to display when the item has spawned.
 * - **spawnChance**: A percentage (0-100) chance for this resource to spawn
 * on a valid region tile each day. *Note: If multiple resources share a
 * region, the one with the highest chance to roll successfully will be
 * chosen, with higher-index data entries being prioritized on a tie.*
 *
 * **➡️ Plugin Command: `pickup`**
 * Executes the gathering action.
 *
 * Usage in an Event:
 * ```
 * ◆Plugin Command: MZ_GatheringProfession, pickup
 * ```
 *
 * - The player must be standing on a tile that currently has a spawned
 * gatherable resource.
 * - The resource is gathered, the item is added to inventory, the tile is
 * reset, and a message is displayed.
 *
 * @param Load JSON from file
 * @type boolean
 * @default false
 * @desc If true, loads configuration from data/GatheringConfig.json. If false, uses the 'Gathering Configuration' parameter.
 *
 * @param Gathering Configuration
 * @type json
 * @desc JSON string defining region-to-type mapping and gatherable resources. See help for format.
 * @default {"regionWildflowers": 7, "regionBerries": 8, "regionJunk": 9, "GatheringData": [{"name": "Dandelions", "type": "wildflowers", "itemID": 20, "tileID": 20, "spawnChance": 100}]}
 *
 * @command pickup
 * @text Pick Up Resource
 * @desc Attempts to pick up a resource from the player's current location.
 */

// Global alias for the plugin name for parameter reading
var MZ_GatheringProfession = MZ_GatheringProfession || {};

(function() {
    'use strict';

    // --- Plugin Setup and Parameter Parsing ---
    const PLUGIN_NAME = 'GatheringSystem_MZ_v1';
    let params;
    let config;

    // --- Configuration Loading Function (Encapsulation for sync/async use) ---
    function loadGatheringConfig(rawParams) {
        const loadFromFile = rawParams['Load JSON from file'] === 'true';
        let jsonString = rawParams['Gathering Configuration'];

        if (loadFromFile) {
            console.log(`[${PLUGIN_NAME}] Attempting to load configuration from data/GatheringConfig.json...`);
            // This is the standard way to load JSON data in RPG Maker MZ
            const xhr = new XMLHttpRequest();
            const url = 'data/GatheringConfig.json';
            try {
                xhr.open('GET', url, false); // false for synchronous load
                xhr.overrideMimeType('application/json');
                xhr.send(null);
                if (xhr.status === 200 || xhr.status === 0) {
                    jsonString = xhr.responseText;
                } else {
                    console.error(`[${PLUGIN_NAME}] Failed to load ${url}. Status: ${xhr.status}. Falling back to Plugin Parameters.`);
                }
            } catch (e) {
                console.error(`[${PLUGIN_NAME}] Error during file loading XHR for ${url}. Falling back to Plugin Parameters. Error:`, e);
            }
        }

        let loadedConfig = { RegionMap: {}, GatheringData: [] };

        try {
            // Parse the JSON string (either from file or parameter)
            loadedConfig = JSON.parse(jsonString, (key, value) => {
                if (key === 'GatheringData' && typeof value === 'string') {
                    // Handle double-parsing of the nested JSON array if it comes from the parameter
                    try {
                        return JSON.parse(value);
                    } catch (e) {
                        return value; // Return as string if nested parsing fails
                    }
                }
                // Ensure numeric fields are correctly interpreted as numbers
                if (['regionWildflowers', 'regionBerries', 'regionJunk', 'itemID', 'tileID', 'spawnChance'].includes(key)) {
                    return parseInt(value, 10) || 0;
                }
                return value;
            });

            // Map the region names to their IDs for easy lookup
            loadedConfig.RegionMap = {};
            for (const key in loadedConfig) {
                if (key.startsWith('region')) {
                    const typeName = key.substring(6).toLowerCase();
                    loadedConfig.RegionMap[typeName] = loadedConfig[key];
                }
            }

        } catch (e) {
            console.error(`[${PLUGIN_NAME}] Error loading or parsing configuration:`, e);
        }

        return loadedConfig;
    }

    // Load parameters and config
    params = PluginManager.parameters(PLUGIN_NAME);
    config = loadGatheringConfig(params);

    // --- Game_System Extension for Persisting Gathered Tiles ---

    const _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize.apply(this, arguments);
        // Map: mapId -> tileKey (x, y) -> gatheredItemName (string)
        this._dailyGatheredResources = {};
        this._lastGatheringDay = 0;
    };

    Game_System.prototype.dailyGatheringResources = function() {
        return this._dailyGatheredResources;
    };

    Game_System.prototype.setGatheredTile = function(mapId, x, y, item) {
        const mapKey = mapId;
        const tileKey = `${x},${y}`;
        if (!this._dailyGatheredResources[mapKey]) {
            this._dailyGatheredResources[mapKey] = {};
        }
        // Store the name for identification and lookup on pickup
        this._dailyGatheredResources[mapKey][tileKey] = item.name;
    };

    Game_System.prototype.clearGatheredTile = function(mapId, x, y) {
        const mapKey = mapId;
        const tileKey = `${x},${y}`;
        if (this._dailyGatheredResources[mapKey]) {
            delete this._dailyGatheredResources[mapKey][tileKey];
        }
    };

    Game_System.prototype.getGatheredItemName = function(mapId, x, y) {
        const mapKey = mapId;
        const tileKey = `${x},${y}`;
        return this._dailyGatheredResources[mapKey] ? this._dailyGatheredResources[mapKey][tileKey] : null;
    };

    // --- GameTime Integration for Daily Spawn Logic ---

    const _Game_Map_update = Game_Map.prototype.update;
    Game_Map.prototype.update = function(sceneActive) {
        _Game_Map_update.apply(this, arguments);

        // Check for GameTime_MZ_v1.js availability
        if (typeof GameTimeManager !== 'undefined') {
            const currentDay = GameTimeManager.getDays();
            if (currentDay !== $gameSystem._lastGatheringDay) {
                // New Day has started
                $gameSystem._lastGatheringDay = currentDay;
                this.spawnDailyGatherables();
            }
        }
    };

    Game_Map.prototype.spawnDailyGatherables = function() {
        if (!config || !$dataMap) return;

        const mapId = $gameMap.mapId();
        const width = $gameMap.width();
        const height = $gameMap.height();

        // 1. Clear all previous daily spawned tiles for this map
        $gameSystem._dailyGatheredResources[mapId] = {};

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const regionId = $gameMap.regionId(x, y);

                // Find the gathering type that matches the tile's region ID
                let gatheringType = null;
                for (const typeName in config.RegionMap) {
                    if (config.RegionMap[typeName] === regionId) {
                        gatheringType = typeName;
                        break;
                    }
                }

                if (gatheringType) {
                    // 2. Filter resources for this type and sort by spawnChance (descending)
                    const potentialSpawns = config.GatheringData.filter(item =>
                        item.type.toLowerCase() === gatheringType.toLowerCase()
                    ).sort((a, b) => b.spawnChance - a.spawnChance); // Higher chance considered first

                    // 3. Roll for a spawn
                    let spawnedItem = null;
                    for (const item of potentialSpawns) {
                        const roll = Math.randomInt(100) + 1; // 1 to 100
                        if (roll <= item.spawnChance) {
                            spawnedItem = item;
                            break; // Stop at the first successful roll (highest chance first)
                        }
                    }

                    // 4. If an item wins the roll, apply the tile change and record it
                    if (spawnedItem) {
                        if (typeof TileChanger === 'undefined' || typeof TileChanger.changeTile !== 'function') {
                            console.error(`[${PLUGIN_NAME}] Dependency Missing: Shaz_TileChangerMZ.js is required!`);
                            return;
                        }

                        // Safety check: ensure the item and tile ID are valid
                        if ($dataItems[spawnedItem.itemID] && spawnedItem.tileID > 0) {
                            try {
                                // Use Shaz_TileChangerMZ to place the resource tile
                                TileChanger.changeTile(mapId, x, y, spawnedItem.tileID, 0); // Layer 0 for A-Layer/Floor
                                $gameSystem.setGatheredTile(mapId, x, y, spawnedItem);

                            } catch (e) {
                                console.warn(`[${PLUGIN_NAME}] TileChanger failed at (${x},${y}). Error:`, e);
                            }
                        } else {
                            console.warn(`[${PLUGIN_NAME}] Invalid itemID (${spawnedItem.itemID}) or tileID (${spawnedItem.tileID}) for resource: ${spawnedItem.name}. Skipping spawn.`);
                        }
                    }
                }
            }
        }
        // Force a map refresh to show the new tiles immediately
        $gameMap.requestRefresh();
        console.log(`[${PLUGIN_NAME}] Daily gathering resources spawned for map ${mapId}.`);
    };

    // --- Plugin Command: pickup ---

    PluginManager.registerCommand(PLUGIN_NAME, 'pickup', function(args) {
        const mapId = $gameMap.mapId();
        const x = $gamePlayer.x;
        const y = $gamePlayer.y;

        // 1. Check if the player is standing on a spawned gatherable resource
        const itemName = $gameSystem.getGatheredItemName(mapId, x, y);

        if (!itemName) {
            // No resource to pick up here
            // console.log(`[${PLUGIN_NAME}] No resource to pick up at (${x},${y}).`);
            return;
        }

        // 2. Find the corresponding item data from the config
        const gatheredItem = config.GatheringData.find(item => item.name === itemName);

        if (!gatheredItem) {
            console.error(`[${PLUGIN_NAME}] Could not find data for spawned item: ${itemName}`);
            return;
        }

        // 3. Process the pickup
        const itemId = gatheredItem.itemID;
        const itemData = $dataItems[itemId];
        const gainAmount = 1;

        if (itemData) {
            // A) Add item to inventory
            $gameParty.gainItem(itemData, gainAmount);

            // B) Reset the tile graphics
            if (typeof TileChanger === 'undefined' || typeof TileChanger.resetTile !== 'function') {
                console.error(`[${PLUGIN_NAME}] Dependency Missing: Shaz_TileChangerMZ.js is required!`);
                return;
            }

            try {
                // Use Shaz_TileChangerMZ to revert the tile to its original state
                TileChanger.resetTile(mapId, x, y, 0); // Reset A-Layer
            } catch (e) {
                console.warn(`[${PLUGIN_NAME}] TileChanger reset failed at (${x},${y}). Error:`, e);
            }

            // C) Clear the tracking data
            $gameSystem.clearGatheredTile(mapId, x, y);

            // D) Play sound and display message
            // You can customize the SE here
            AudioManager.playSe({ name: 'Item', volume: 90, pitch: 100, pan: 0 });
            $gameMessage.add(`\\I[${itemData.iconIndex}]You gathered a ${itemData.name}.`);

            // Force a map refresh to show the tile change
            $gameMap.requestRefresh();

        } else {
            console.warn(`[${PLUGIN_NAME}] Item ID ${itemId} for ${itemName} is invalid in the database. Cannot gain item.`);
        }
    });

    // --- Scene_Map Extension: Initial Spawn on Game Load/Start ---
    // Ensure resources spawn immediately if the game time plugins are present
    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function() {
        _Scene_Map_onMapLoaded.apply(this, arguments);

        if (typeof GameTimeManager !== 'undefined') {
             // If this is the first day (initialization)
             if ($gameSystem._lastGatheringDay === 0) {
                 $gameSystem._lastGatheringDay = GameTimeManager.getDays();
                 $gameMap.spawnDailyGatherables();
             } else if ($gameSystem._lastGatheringDay !== GameTimeManager.getDays()) {
                 // If the player loaded a save file, but a new day started
                  $gameSystem._lastGatheringDay = GameTimeManager.getDays();
                  $gameMap.spawnDailyGatherables();
             }
             // If it's the same day, tiles are already handled by $gameSystem._dailyGatheredResources
        }
    };

})();