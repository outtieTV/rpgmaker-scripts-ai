/*:
 * @target MZ
 * @plugindesc v2.0.0 - Implements a persistent, tile-based farming system with detailed state visuals (watered/dry/dead).
 * @author OuttieTV
 *
 * @param General Settings
 *
 * @param FarmlandRegionId
 * @parent General Settings
 * @type number
 * @min 1
 * @max 255
 * @default 10
 * @desc Region ID that marks tiles that can be tilled (untilled farmland).
 *
 * @param UntilledFarmlandTileId
 * @parent General Settings
 * @type number
 * @min 0
 * @default 0
 * @desc Tile ID (A-Layer) for UNTILLED farmland (visual for untouched soil).
 *
 * @param TilledUnseededUnwateredTileId
 * @parent General Settings
 * @type number
 * @min 0
 * @default 2816
 * @desc Tile ID (A-Layer) for Tilled (unseeded, unwatered) Farmland.
 *
 * @param TilledUnseededWateredTileId
 * @parent General Settings
 * @type number
 * @min 0
 * @default 2817
 * @desc Tile ID (A-Layer) for Tilled (unseeded, watered) Farmland.
 *
 * @param Crops
 * @type struct<Crop>[]
 * @desc List of all definable crops the player can plant.
 * @default ["{\"CropId\":\"Wheat\",\"SeedItemId\":\"10\",\"Stage2Day\":\"3\",\"Stage3Day\":\"6\",\"MaxDryDays\":\"2\",\"Stage1UnwateredTileId\":\"2820\",\"Stage1WateredTileId\":\"2821\",\"Stage2UnwateredTileId\":\"2822\",\"Stage2WateredTileId\":\"2823\",\"Stage2DryTileId\":\"2824\",\"Stage3TileId\":\"2825\",\"DeadCropTileId\":\"2826\",\"HarvestItemId\":\"20\"}","{\"CropId\":\"Corn\",\"SeedItemId\":\"11\",\"Stage2Day\":\"4\",\"Stage3Day\":\"8\",\"MaxDryDays\":\"3\",\"Stage1UnwateredTileId\":\"2830\",\"Stage1WateredTileId\":\"2831\",\"Stage2UnwateredTileId\":\"2832\",\"Stage2WateredTileId\":\"2833\",\"Stage2DryTileId\":\"2834\",\"Stage3TileId\":\"2835\",\"DeadCropTileId\":\"2836\",\"HarvestItemId\":\"21\"}"]
 *
 * @help
 * ----------------------------------------------------------------------
 * PLUGIN COMMANDS (Use in Events)
 * ----------------------------------------------------------------------
 *
 * FarmAction Till
 * FarmAction Plant [CropId] (e.g., FarmAction Plant "Wheat")
 * FarmAction Water
 * FarmAction Harvest
 *
 * NOTE ON VISUALS: This plugin relies on a third-party tile control plugin 
 * (like Tyruswoo_TileControl.js) to dynamically change map tile graphics 
 * at runtime. The logic below determines the correct Tile ID but requires 
 * a function call to update the map's visual layer.
 *
 */
/*~struct~Crop:
 * @param CropId
 * @text Crop ID (Unique Name)
 * @type string
 * @desc Unique identifier for this crop (e.g., "Wheat"). Used in the Plant command.
 *
 * @param SeedItemId
 * @text Seed Item ID
 * @type item
 * @desc The Item ID required to plant this crop.
 *
 * @param Stage2Day
 * @text Days to Stage 2 (Partial Growth)
 * @type number
 * @min 1
 * @default 3
 *
 * @param Stage3Day
 * @text Days to Stage 3 (Fully Grown)
 * @type number
 * @min 1
 * @default 6
 *
 * @param MaxDryDays
 * @text Max Dry Days Before Death
 * @type number
 * @min 1
 * @default 2
 *
 * @param Stage1UnwateredTileId
 * @text Stage 1 (Seeded, Unwatered) Tile ID
 * @type number
 * @min 0
 * @default 2820
 *
 * @param Stage1WateredTileId
 * @text Stage 1 (Seeded, Watered) Tile ID
 * @type number
 * @min 0
 * @default 2821
 *
 * @param Stage2UnwateredTileId
 * @text Stage 2 (Unwatered) Tile ID
 * @type number
 * @min 0
 * @default 2822
 *
 * @param Stage2WateredTileId
 * @text Stage 2 (Watered) Tile ID
 * @type number
 * @min 0
 * @default 2823
 *
 * @param Stage2DryTileId
 * @text Stage 2 (Dry/Stressed) Tile ID
 * @type number
 * @min 0
 * @default 2824
 * @desc Used when dryDays > 0 but crop is not dead yet.
 *
 * @param Stage3TileId
 * @text Stage 3 (Fully Grown) Tile ID
 * @type number
 * @min 0
 * @default 2825
 * @desc Fully grown and harvestable. Cannot be watered.
 *
 * @param DeadCropTileId
 * @text Dead Crop (Stage 4) Tile ID
 * @type number
 * @min 0
 * @default 2826
 *
 * @param HarvestItemId
 * @text Harvest Item ID
 * @type item
 * @desc The Item ID yielded when the crop is harvested.
 *
 */

(() => {
    const PLUGIN_NAME = "FarmingSystem_MZ_v1";

    // --- 1. Parameter Initialization and Crop Data Mapping ---

    const parameters = PluginManager.parameters(PLUGIN_NAME);
    const FarmlandRegionId = Number(parameters.FarmlandRegionId || 10);
	const UntilledFarmlandTileId = Number(parameters.UntilledFarmlandTileId || 0);
    const TilledUnseededUnwateredTileId = Number(parameters.TilledUnseededUnwateredTileId || 2816);
    const TilledUnseededWateredTileId = Number(parameters.TilledUnseededWateredTileId || 2817);
    
    // Map crop parameter array into an easily searchable object
    const CropDefinitions = {};
    const cropParams = JSON.parse(parameters.Crops || "[]");
    for (const cropData of cropParams) {
        const data = JSON.parse(cropData);
        CropDefinitions[data.CropId] = {
            id: data.CropId,
            seedId: Number(data.SeedItemId),
            stage2Day: Number(data.Stage2Day),
            stage3Day: Number(data.Stage3Day),
            maxDryDays: Number(data.MaxDryDays),
            // Stage 1 (Seeded)
            stage1UnwateredTile: Number(data.Stage1UnwateredTileId),
            stage1WateredTile: Number(data.Stage1WateredTileId),
            // Stage 2 (Partial Growth)
            stage2UnwateredTile: Number(data.Stage2UnwateredTileId),
            stage2WateredTile: Number(data.Stage2WateredTileId),
            stage2DryTile: Number(data.Stage2DryTileId),
            // Stage 3 (Fully Grown)
            stage3Tile: Number(data.Stage3TileId),
            // Dead
            deadTile: Number(data.DeadCropTileId),
            harvestId: Number(data.HarvestItemId)
        };
    }

    // --- 2. Map Data Management and Storage Hook ---
    class FarmManager {
        // Initializes farm data for the current map
        static setupMapData() {
            if (!$gameMap._farmData) {
                $gameMap._farmData = {};
            }
            if (!$gameMap._farmData[this.getMapKey()]) {
                $gameMap._farmData[this.getMapKey()] = {};
            }
            if (!$gameMap._lastDay) {
                // Ensure initial day is set when game starts/loads
                $gameMap._lastDay = $gameVariables.value(4) || 1; 
            }
        }

        static getMapKey() {
            return $gameMap.mapId();
        }

        static getCropData(x, y) {
            this.setupMapData();
            const key = `${x},${y}`;
            const mapKey = this.getMapKey();
            return $gameMap._farmData[mapKey][key] || null;
        }

        static setCropData(x, y, data) {
            this.setupMapData();
            const key = `${x},${y}`;
            const mapKey = this.getMapKey();
            if (data === null) {
                delete $gameMap._farmData[mapKey][key];
            } else {
                $gameMap._farmData[mapKey][key] = data;
            }
            // Update the tile graphic immediately
            this.updateTileGraphic(x, y, data);
        }

        // --- 3. Tile Graphic Management ---

        // Replaces the tile graphic at (x, y) with the appropriate crop stage or tilled soil
        static updateTileGraphic(x, y, cropData) {
			let tileId = 0;
			const def = cropData ? CropDefinitions[cropData.cropId] : null;

			// If farmland is cleared (null), restore original tile (do nothing)
			if (cropData === null) {
				// farmland but UNTILLED → draw untilled tile
				if (this.isFarmland(x, y) && UntilledFarmlandTileId > 0) {
					const args = {
						coordX: String(x),
						coordY: String(y),
						layerZ: "0",
						tileId: String(UntilledFarmlandTileId)
					};
					if ($gameMap.changeTile) $gameMap.changeTile(args);
				}
				return;
			}

			// Determine tileId from crop state
			if (cropData.state === 'tilled') {
				tileId = cropData.wateredToday
					? TilledUnseededWateredTileId
					: TilledUnseededUnwateredTileId;
			}
			else if (cropData.state === 'planted' && def) {
				const age = cropData.age;
				const dryDays = cropData.dryDays;
				const watered = cropData.wateredToday;

				if (dryDays >= def.maxDryDays) {
					tileId = def.deadTile;
				}
				else if (age >= def.stage3Day) {
					tileId = def.stage3Tile;
				}
				else if (age >= def.stage2Day) {
					if (watered)       tileId = def.stage2WateredTile;
					else if (dryDays)  tileId = def.stage2DryTile;
					else               tileId = def.stage2UnwateredTile;
				}
				else {
					tileId = watered ? def.stage1WateredTile : def.stage1UnwateredTile;
				}
			}

			// --- USE SHAZ TILE CHANGER ---
			// layerZ = 0 = ground A-layer (correct for farmland tiles)
			const args = {
				coordX: String(x),
				coordY: String(y),
				layerZ: "0",
				tileId: String(tileId)
			};

			if ($gameMap.changeTile) {
				$gameMap.changeTile(args);
			}
		}

        // --- 4. Farmland State Checks ---

        static isFarmland(x, y) {
            return $gameMap.regionId(x, y) === FarmlandRegionId;
        }

        static isTilled(x, y) {
            const cropData = this.getCropData(x, y);
            // Must be farmland and either empty or explicitly tilled state
            return this.isFarmland(x, y) && cropData && cropData.state === 'tilled';
        }

        static hasCrop(x, y) {
            const cropData = this.getCropData(x, y);
            return cropData && cropData.state === 'planted';
        }

        static isDead(cropData) {
            if (!cropData || cropData.state !== 'planted') return false;
            const def = CropDefinitions[cropData.cropId];
            return def && cropData.dryDays >= def.maxDryDays;
        }
        
        static isFullyGrown(cropData) {
            if (!cropData || cropData.state !== 'planted') return false;
            const def = CropDefinitions[cropData.cropId];
            return def && cropData.age >= def.stage3Day;
        }

        // --- 5. Farming Actions (Called via Plugin Commands) ---

        static till(x, y) {
            if (!this.isFarmland(x, y)) {
                $gameMessage.add("This is not a designated farmland tile.");
                return false;
            }
            if (this.hasCrop(x, y)) {
                $gameMessage.add("There is already a crop here.");
                return false;
            }
            if (this.getCropData(x, y) && this.getCropData(x, y).state === 'tilled') {
                 $gameMessage.add("The ground is already tilled.");
                 return false;
            }

            // Set state to tilled (unseeded, unwatered)
            this.setCropData(x, y, { state: 'tilled', wateredToday: false });
            $gameMessage.add("Tilled the soil.");
            return true;
        }

        static plant(x, y, cropId) {
            const def = CropDefinitions[cropId];
            if (!def) {
                $gameMessage.add(`Error: Unknown crop ID '${cropId}'.`);
                return false;
            }
            if (!this.isTilled(x, y)) {
                $gameMessage.add("You must till the ground first.");
                return false;
            }
            if (!$gameParty.hasItem($dataItems[def.seedId], 1)) {
                $gameMessage.add(`You need a ${$dataItems[def.seedId].name} to plant this.`);
                return false;
            }

            // Remove item and plant. Planting automatically "waters" for day 0.
            $gameParty.loseItem($dataItems[def.seedId], 1);
            this.setCropData(x, y, {
                state: 'planted',
                cropId: cropId,
                age: 0,
                dryDays: 0,
                wateredToday: true,
                lastDay: $gameVariables.value(4)
            });
            $gameMessage.add(`Planted a ${def.id} seed.`);
            return true;
        }

        static water(x, y) {
            const cropData = this.getCropData(x, y);
            
            if (!this.hasCrop(x, y)) {
                // Allows watering tilled but unseeded soil
                if (this.isTilled(x, y)) {
                    cropData.wateredToday = true;
                    this.setCropData(x, y, cropData);
                    $gameMessage.add("Tilled soil watered.");
                    return true;
                }
                $gameMessage.add("There is nothing planted here to water.");
                return false;
            }

            if (this.isFullyGrown(cropData)) {
                $gameMessage.add("The crop is fully grown and does not need water.");
                return false;
            }
            
            // Watering planted crop
            cropData.wateredToday = true;
            cropData.dryDays = 0; // Reset dry days on watering
            this.setCropData(x, y, cropData); // Re-save
            $gameMessage.add(`Watered the ${cropData.cropId}.`);
            return true;
        }

        static harvest(x, y) {
            const cropData = this.getCropData(x, y);
            if (!this.isFullyGrown(cropData)) {
                $gameMessage.add("The crop is not ready to harvest yet.");
                return false;
            }

            const def = CropDefinitions[cropData.cropId];
            const harvestItem = $dataItems[def.harvestId];
            
            // Add item, remove crop, and revert to tilled soil
            $gameParty.gainItem(harvestItem, 1);
            // Revert to tilled, unwatered soil
            this.setCropData(x, y, { state: 'tilled', wateredToday: false }); 
            $gameMessage.add(`Harvested ${harvestItem.name}!`);
            return true;
        }

        // --- 6. Daily Growth Cycle ---

        static checkGrowth() {
            this.setupMapData();
            const currentDay = $gameVariables.value(4);
            // Only proceed if the day variable has actually changed
            if (currentDay === $gameMap._lastDay) {
                return;
            }
            
            const mapKey = this.getMapKey();
            const farmData = $gameMap._farmData[mapKey];

            for (const key in farmData) {
                let cropData = farmData[key];
                const [x, y] = key.split(',').map(Number);

                if (cropData.state === 'tilled') {
                    // Reset tilled soil watered status for the new day
                    cropData.wateredToday = false;
                    this.setCropData(x, y, cropData);
                    continue; // Skip to next tile
                }

                if (cropData.state === 'planted') {
                    const def = CropDefinitions[cropData.cropId];
                    if (!def) continue;

                    // 1. Progress Growth
                    if (cropData.wateredToday && cropData.age < def.stage3Day) {
                        cropData.age += 1;
                    } 
                    
                    // 2. Increase Dry Days if not watered
                    if (!cropData.wateredToday && cropData.age < def.stage3Day) {
                        cropData.dryDays += 1;
                    }

                    // 3. Check for Death
                    if (cropData.dryDays >= def.maxDryDays) {
                        $gameMessage.add(`${def.id} at (${x}, ${y}) died from lack of water.`);
                        // Revert to tilled, unwatered soil
                        cropData = { state: 'tilled', wateredToday: false }; 
                    }
                    
                    // 4. Reset watering status for the next day (if still alive)
                    if (cropData.state === 'planted') {
                        cropData.wateredToday = false;
                    }
                    
                    // Update data and graphic
                    this.setCropData(x, y, cropData);
                }
            }

            // Update the last day check variable
            $gameMap._lastDay = currentDay;
            $gameMap.refresh();
        }
    }
    
    // --- 7. RPG Maker Hooks ---

    // Hook into map creation to ensure farm data structure exists
    const _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        _Game_Map_setup.call(this, mapId);
        FarmManager.setupMapData();
    };

    // Hook into Game_Variables.setValue to detect day change (Variable 4)
    const _Game_Variables_setValue = Game_Variables.prototype.setValue;
    Game_Variables.prototype.setValue = function(variableId, value) {
        // Run original setValue
        const oldValue = this.value(variableId);
        _Game_Variables_setValue.call(this, variableId, value);

        // Check if the change was to the Day variable (Variable 4) and the day number increased
        if (variableId === 4 && value > oldValue && $gameMap && $gameMap.mapId() > 0) {
            FarmManager.checkGrowth();
        }
    };

    // --- 8. Plugin Commands Registration ---

    PluginManager.registerCommand(PLUGIN_NAME, "FarmAction", args => {
        const action = args.action.toLowerCase();
        const cropId = args.cropId;

        // Get player's current map coordinates
        const x = $gamePlayer.x;
        const y = $gamePlayer.y;

        switch (action) {
            case 'till':
                FarmManager.till(x, y);
                break;
            case 'plant':
                if (cropId) {
                    FarmManager.plant(x, y, cropId);
                } else {
                    $gameMessage.add("Plant command requires a Crop ID.");
                }
                break;
            case 'water':
                FarmManager.water(x, y);
                break;
            case 'harvest':
                FarmManager.harvest(x, y);
                break;
            default:
                $gameMessage.add(`Unknown farming action: ${action}`);
        }
    });

})();
