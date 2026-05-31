/*:
 * @name FarmingSystem_MZ_v2
 * @target MZ
 * @plugindesc v2.2.0 - Persistent farming reading directly from oTV_GameTime_MZ.
 * @author outtieTV
 * @base oTV_GameTime_MZ
 * @orderAfter oTV_GameTime_MZ
 *
 * @param LoadJson
 * @text Load JSON?
 * @type boolean
 * @default true
 * @desc If true, loads settings and crops from data/FarmingConfig.json.
 *
 * @param General Settings
 *
 * @param FarmlandRegionId
 * @parent General Settings
 * @type number
 * @min 1
 * @max 255
 * @default 10
 *
 * @param UntilledFarmlandTileId
 * @parent General Settings
 * @type number
 * @min 0
 * @default 0
 *
 * @param TilledUnseededUnwateredTileId
 * @parent General Settings
 * @type number
 * @min 0
 * @default 2816
 *
 * @param TilledUnseededWateredTileId
 * @parent General Settings
 * @type number
 * @min 0
 * @default 2817
 * * @param DefaultStage1UnwateredTileId
 * @parent General Settings
 * @type number
 * @min 0
 * @default 2820
 * * @param DefaultStage2UnwateredTileId
 * @parent General Settings
 * @type number
 * @min 0
 * @default 2822
 * * @param DefaultStage3TileId
 * @parent General Settings
 * @type number
 * @min 0
 * @default 2825
 * * @param DefaultDeadCropTileId
 * @parent General Settings
 * @type number
 * @min 0
 * @default 2826
 *
 * @param Crops
 * @type struct<Crop>[]
 * @desc List of crops. These override the General Settings if specified.
 * @default []
 *
 * @help
 * ----------------------------------------------------------------------
 * JSON STRUCTURE (data/FarmingConfig.json)
 * ----------------------------------------------------------------------
 * {
 * "GeneralSettings": {
 * "FarmlandRegionId": 10,
 * "DefaultStage1UnwateredTileId": 2820,
 * "DefaultStage2UnwateredTileId": 2822,
 * "DefaultStage3TileId": 2825,
 * "DefaultDeadCropTileId": 2826
 * },
 * "Crops": [
 * { "CropId": "Wheat", "SeedItemId": 10, "HarvestItemId": 20 }
 * ]
 * }
 *
 * If a crop in the JSON does not specify a TileId, it will use the 
 * value defined in GeneralSettings (JSON first, then Plugin Params).
 *
 * @command FarmAction
 * @text Farm Action
 * @desc Performs a farming action at the player’s tile.
 *
 * @arg action
 * @text Action
 * @type select
 * @option Till
 * @value till
 * @option Plant
 * @value plant
 * @option Water
 * @value water
 * @option Harvest
 * @value harvest
 *
 * @arg cropId
 * @text Crop ID (if planting)
 * @type string
 * @default
 */
/*~struct~Crop:
 * @param CropId
 * @type string
 * @param SeedItemId
 * @type item
 * @param Stage2Day
 * @type number
 * @default 3
 * @param Stage3Day
 * @type number
 * @default 6
 * @param MaxDryDays
 * @type number
 * @default 2
 * @param Stage1UnwateredTileId
 * @type number
 * @param Stage1WateredTileId
 * @type number
 * @param Stage2UnwateredTileId
 * @type number
 * @param Stage2WateredTileId
 * @type number
 * @param Stage2DryTileId
 * @type number
 * @param Stage3TileId
 * @type number
 * @param DeadCropTileId
 * @type number
 * @param HarvestItemId
 * @type item
 */

(() => {
    const PLUGIN_NAME = "oTV_FarmingSystem_MZ";
    const parameters = PluginManager.parameters(PLUGIN_NAME);
    const LoadJson = parameters.LoadJson === "true";

    // Globals to hold merged settings
    let ExternalCropData = null; 
    let FarmlandRegionId = 10;
    let UntilledFarmlandTileId = 0;
    let TilledUnseededUnwateredTileId = 2816;
    let TilledUnseededWateredTileId = 2817;

    // Default Fallbacks for Crops
    let DefS1Unwatered = 2820;
    let DefS2Unwatered = 2822;
    let DefS3Tile = 2825;
    let DefDeadTile = 2826;

    const CropDefinitions = {};

    // --- Data Loading ---

    const _DataManager_loadDatabase = DataManager.loadDatabase;
    DataManager.loadDatabase = function() {
        _DataManager_loadDatabase.call(this);
        if (LoadJson) {
            DataManager.loadDataFile('ExternalCropData', 'FarmingConfig.json');
        } else {
            ExternalCropData = {}; 
        }
    };

    const _DataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function() {
        if (!_DataManager_isDatabaseLoaded.call(this)) return false;
        if (LoadJson && window.ExternalCropData === undefined) return false;
        
        if (Object.keys(CropDefinitions).length === 0) {
            ExternalCropData = window.ExternalCropData || {};
            setupCropConfiguration();
        }
        return true;
    };

    function setupCropConfiguration() {
        // 1. Initial Load from Plugin Parameters
        FarmlandRegionId = Number(parameters.FarmlandRegionId);
        UntilledFarmlandTileId = Number(parameters.UntilledFarmlandTileId);
        TilledUnseededUnwateredTileId = Number(parameters.TilledUnseededUnwateredTileId);
        TilledUnseededWateredTileId = Number(parameters.TilledUnseededWateredTileId);
        
        DefS1Unwatered = Number(parameters.DefaultStage1UnwateredTileId);
        DefS2Unwatered = Number(parameters.DefaultStage2UnwateredTileId);
        DefS3Tile = Number(parameters.DefaultStage3TileId);
        DefDeadTile = Number(parameters.DefaultDeadCropTileId);

        // 2. Override General Settings from JSON
        if (ExternalCropData && ExternalCropData.GeneralSettings) {
            const ex = ExternalCropData.GeneralSettings;
            if (ex.FarmlandRegionId !== undefined) FarmlandRegionId = Number(ex.FarmlandRegionId);
            if (ex.UntilledFarmlandTileId !== undefined) UntilledFarmlandTileId = Number(ex.UntilledFarmlandTileId);
            if (ex.TilledUnseededUnwateredTileId !== undefined) TilledUnseededUnwateredTileId = Number(ex.TilledUnseededUnwateredTileId);
            if (ex.TilledUnseededWateredTileId !== undefined) TilledUnseededWateredTileId = Number(ex.TilledUnseededWateredTileId);
            
            // New Global Default Overrides from JSON
            if (ex.DefaultStage1UnwateredTileId !== undefined) DefS1Unwatered = Number(ex.DefaultStage1UnwateredTileId);
            if (ex.DefaultStage2UnwateredTileId !== undefined) DefS2Unwatered = Number(ex.DefaultStage2UnwateredTileId);
            if (ex.DefaultStage3TileId !== undefined) DefS3Tile = Number(ex.DefaultStage3TileId);
            if (ex.DefaultDeadCropTileId !== undefined) DefDeadTile = Number(ex.DefaultDeadCropTileId);
        }

        const parseCrop = (data) => {
            const getVal = (val, fallback) => (val !== undefined && val !== "") ? Number(val) : fallback;

            return {
                id: data.CropId,
                seedId: Number(data.SeedItemId),
                stage2Day: Number(data.Stage2Day || 3),
                stage3Day: Number(data.Stage3Day || 6),
                maxDryDays: Number(data.MaxDryDays || 2),
                stage1UnwateredTile: getVal(data.Stage1UnwateredTileId, DefS1Unwatered),
                stage1WateredTile: getVal(data.Stage1WateredTileId, getVal(data.Stage1UnwateredTileId, DefS1Unwatered) + 1),
                stage2UnwateredTile: getVal(data.Stage2UnwateredTileId, DefS2Unwatered),
                stage2WateredTile: getVal(data.Stage2WateredTileId, getVal(data.Stage2UnwateredTileId, DefS2Unwatered) + 1),
                stage2DryTile: getVal(data.Stage2DryTileId, getVal(data.Stage2UnwateredTileId, DefS2Unwatered) + 2),
                stage3Tile: getVal(data.Stage3TileId, DefS3Tile),
                deadTile: getVal(data.DeadCropTileId, DefDeadTile),
                harvestId: Number(data.HarvestItemId)
            };
        };

        const pluginCrops = JSON.parse(parameters.Crops || "[]");
        for (const cropStr of pluginCrops) {
            const data = JSON.parse(cropStr);
            CropDefinitions[data.CropId] = parseCrop(data);
        }

        if (ExternalCropData && ExternalCropData.Crops) {
            for (const data of ExternalCropData.Crops) {
                CropDefinitions[data.CropId] = parseCrop(data);
            }
        }
    }

    // --- Core Logic ---

    class FarmManager {
        static setupMapData() {
            if (!$gameMap._farmData) $gameMap._farmData = {};
            if (!$gameMap._farmData[$gameMap.mapId()]) $gameMap._farmData[$gameMap.mapId()] = {};
            
            // NEW: Fall back to GameTimeManager's days tracking directly instead of a Game Variable
            if (!$gameMap._lastDay) {
                $gameMap._lastDay = (typeof window.GameTimeManager !== 'undefined') ? window.GameTimeManager.getDays() : 1;
            }
        }

        static getCropData(x, y) {
            this.setupMapData();
            return $gameMap._farmData[$gameMap.mapId()][`${x},${y}`] || null;
        }

        static setCropData(x, y, data) {
            this.setupMapData();
            const key = `${x},${y}`;
            if (data === null) {
                delete $gameMap._farmData[$gameMap.mapId()][key];
            } else {
                $gameMap._farmData[$gameMap.mapId()][key] = data;
            }
            this.updateTileGraphic(x, y, data);
        }

        static updateTileGraphic(x, y, cropData) {
            let tileId = 0;
            const def = cropData ? CropDefinitions[cropData.cropId] : null;

            if (cropData === null) {
                if ($gameMap.regionId(x, y) === FarmlandRegionId && UntilledFarmlandTileId > 0) {
                    this.applyTileChange(x, y, UntilledFarmlandTileId);
                }
                return;
            }

            if (cropData.state === 'tilled') {
                tileId = cropData.wateredToday ? TilledUnseededWateredTileId : TilledUnseededUnwateredTileId;
            } else if (cropData.state === 'planted' && def) {
                if (cropData.dryDays >= def.maxDryDays) {
                    tileId = def.deadTile;
                } else if (cropData.age >= def.stage3Day) {
                    tileId = def.stage3Tile;
                } else if (cropData.age >= def.stage2Day) {
                    if (cropData.wateredToday) tileId = def.stage2WateredTile;
                    else if (cropData.dryDays > 0) tileId = def.stage2DryTile;
                    else tileId = def.stage2UnwateredTile;
                } else {
                    tileId = cropData.wateredToday ? def.stage1WateredTile : def.stage1UnwateredTile;
                }
            }

            if (tileId > 0) this.applyTileChange(x, y, tileId);
        }

static applyTileChange(x, y, tileId) {
            // Overwrite the incoming x and y with the player's exact coordinates
            const playerX = $gamePlayer.x;
            const playerY = $gamePlayer.y;

            // --- DEBUG OUTPUT BLOCK ---
            // Fetch the current tile ID on Layer 0 (Z=0) before we change it
            const currentTileId = $gameMap.tileId(playerX, playerY, 0);
            
            console.log("=========================================");
            console.log(`[FARMING ENGINE] Interaction Registered!`);
            console.log(`📍 Coordinates: X: ${playerX}, Y: ${playerY}`);
            console.log(`↩️ Current Tile ID (Layer 0): ${currentTileId}`);
            console.log(`🆕 Updated Tile ID Request  : ${tileId}`);
            console.log("=========================================");
            // ---------------------------

            // Package arguments to perfectly match what Tyruswoo_TileControl expects
            const tyruswooArgs = {
                tileId: String(tileId),
                coordinates: JSON.stringify({ x: String(playerX), y: String(playerY), z: "0" }),
                relativity: JSON.stringify({
                    mode: "Absolute",
                    eventId: "",
                    party_member: "",
                    orientational_shift: "",
                    allowAutotiling: "true",
                    clearUpperLayers: "true"
                })
            };
            
            // Explicitly call Tyruswoo's command through the global PluginManager
            PluginManager.callCommand(this, "Tyruswoo_TileControl", "set_tile", tyruswooArgs);
        }

        static till(x, y) {
            if ($gameMap.regionId(x, y) !== FarmlandRegionId) return;
            if (this.getCropData(x, y)) return;
            this.setCropData(x, y, { state: 'tilled', wateredToday: false });
        }

        static plant(x, y, cropId) {
            const def = CropDefinitions[cropId];
            if (!def || !this.isTilled(x, y)) return;
            if (!$gameParty.hasItem($dataItems[def.seedId], 1)) return;

            $gameParty.loseItem($dataItems[def.seedId], 1);
            this.setCropData(x, y, {
                state: 'planted',
                cropId: cropId,
                age: 0,
                dryDays: 0,
                wateredToday: false
            });
        }

        static water(x, y) {
            const data = this.getCropData(x, y);
            if (!data) return;
            data.wateredToday = true;
            if (data.state === 'planted') data.dryDays = 0;
            this.setCropData(x, y, data);
        }

        static harvest(x, y) {
            const data = this.getCropData(x, y);
            if (!data || data.state !== 'planted') return;
            const def = CropDefinitions[data.cropId];
            if (data.age < def.stage3Day) return;

            $gameParty.gainItem($dataItems[def.harvestId], 1);
            this.setCropData(x, y, { state: 'tilled', wateredToday: false });
        }

        static isTilled(x, y) {
            const data = this.getCropData(x, y);
            return data && data.state === 'tilled';
        }

        static checkGrowth() {
            // Safety Guards
            if (!$gameMap || !$gameMap._farmData || typeof window.GameTimeManager === 'undefined') return;

            // NEW: Pull the day value directly from the clock plugin API
            const currentDay = window.GameTimeManager.getDays();
            if (currentDay === $gameMap._lastDay) return;

            const farmData = $gameMap._farmData[$gameMap.mapId()];
            if (!farmData) return;

            for (const key in farmData) {
                let data = farmData[key];
                const [x, y] = key.split(',').map(Number);

                if (data.state === 'tilled') {
                    data.wateredToday = false;
                } else if (data.state === 'planted') {
                    const def = CropDefinitions[data.cropId];
                    if (data.wateredToday && data.age < def.stage3Day) {
                        data.age++;
                    } else if (!data.wateredToday && data.age < def.stage3Day) {
                        data.dryDays++;
                    }
                    
                    if (data.dryDays >= def.maxDryDays) {
                        data = { state: 'tilled', wateredToday: false };
                    } else {
                        data.wateredToday = false;
                    }
                }
                this.setCropData(x, y, data);
            }
            $gameMap._lastDay = currentDay;
        }
    }
	window.FarmManager = FarmManager;
    // --- Hooks ---

    const _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        _Game_Map_setup.call(this, mapId);
        FarmManager.setupMapData();
    };

    // NEW: Instead of intercepting Game_Variables, we check for growth during the normal map scene loop.
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if ($gameMap) {
            FarmManager.checkGrowth();
        }
    };

    PluginManager.registerCommand(PLUGIN_NAME, "FarmAction", args => {
        const x = $gamePlayer.x;
        const y = $gamePlayer.y;
        switch (args.action.toLowerCase()) {
            case 'till': FarmManager.till(x, y); break;
            case 'plant': FarmManager.plant(x, y, args.cropId); break;
            case 'water': FarmManager.water(x, y); break;
            case 'harvest': FarmManager.harvest(x, y); break;
        }
    });

})();
