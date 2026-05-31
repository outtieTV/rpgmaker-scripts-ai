/*:
 * @target MZ
 * @plugindesc Region-Based Persistent Chest Inventory System
 * @author OuttieTV
 *
 * @param Load JSON?
 * @text Load External JSON?
 * @type boolean
 * @desc If true, settings are merged from an external JSON file.
 * @default false
 *
 * @param JSON Config File
 * @text JSON Config Path
 * @parent Load JSON?
 * @type file
 * @dir data
 * @desc Path to the external JSON file (e.g., data/ChestConfig.json).
 * @default data/ChestConfig.json
 *
 * @param Region Chest Map
 * @text Region-to-Chest Mapping
 * @type struct<RegionMap>[]
 * @desc Define which Region ID maps to a specific Chest Size and its default graphic Tile ID.
 * @default []
 *
 * @param Chest Type Settings
 * @text Chest Size Properties
 * @type struct<ChestType>[]
 * @desc Define properties (e.g., max capacity) for each Chest Size (e.g., 'small', 'large').
 * @default []
 *
 * @help
 * ===========================================================================
 * Region-Based Persistent Chest Inventory System (RBCIS)
 * ===========================================================================
 * This plugin implements a persistent chest-inventory system that uses map
 * region IDs to determine the size and graphic of a chest at a given location.
 * Chest contents are saved and loaded with the game save file.
 *
 * It provides a custom chest UI for item transfer and plugin commands for
 * advanced event-based control.
 *
 * ===========================================================================
 * Plugin Parameters
 * ===========================================================================
 *
 * - Region Chest Map: Define which **Region ID** corresponds to which **Chest Size**
 * and graphic (**Tile ID**). The 'Chest Size' must match a key in the
 * 'Chest Type Settings' (e.g., 'small', 'medium', 'large').
 *
 * - Chest Type Settings: Define the properties for each 'Chest Size' (type).
 * This is where you set the **maximum capacity** (item slots).
 *
 * - Load JSON?: If true, the plugin will load and merge settings from an
 * external JSON file specified in 'JSON Config File'.
 *
 * - JSON Config File: The path (relative to the game root) to the JSON file.
 * Example: 'data/ChestConfig.json'
 *
 * ===========================================================================
 * JSON Configuration Format
 * ===========================================================================
 *
 * The external JSON file should be an object where keys are the 'Chest Size'
 * strings (e.g., "small", "medium") and values are objects containing the
 * properties to override or add.
 *
 * Example JSON (data/ChestConfig.json):
 *
 * {
 * "small": {
 * "maxCapacity": 10,
 * "tileId": 2816 // Overrides the tile ID from Region Chest Map
 * },
 * "custom_vault": { // New chest type
 * "maxCapacity": 99,
 * "tileId": 2818
 * }
 * }
 *
 * NOTE: For a custom JSON chest type to work, you must manually map it in the
 * 'Region Chest Map' parameter using its name (e.g., use 'custom_vault' for
 * the Chest Size property of a Region ID mapping).
 *
 * @command addChest
 * @text Add Chest
 * @desc Creates a chest at the given coordinates.
 *
 * @arg x
 * @text X Coordinate
 * @type number
 * @min 0
 * @desc Map X coordinate for the chest.
 *
 * @arg y
 * @text Y Coordinate
 * @type number
 * @min 0
 * @desc Map Y coordinate for the chest.
 *
 * @command delChest
 * @text Delete Chest
 * @desc Deletes the chest at the given coordinates.
 *
 * @arg x
 * @text X Coordinate
 * @type number
 * @min 0
 * @desc Map X coordinate.
 *
 * @arg y
 * @text Y Coordinate
 * @type number
 * @min 0
 * @desc Map Y coordinate.
 *
 * @command addToChest
 * @text Add Item to Chest
 * @desc Moves items from party → chest.
 *
 * @arg x
 * @text X Coordinate
 * @type number
 * @min 0
 *
 * @arg y
 * @text Y Coordinate
 * @type number
 * @min 0
 *
 * @arg itemId
 * @text Item ID
 * @type number
 * @min 1
 * @desc ID of the item/weapon/armor.
 *
 * @arg quantity
 * @text Quantity
 * @type text
 * @desc Number OR "all"
 *
 *
 * @command removeFromChest
 * @text Remove Item from Chest
 * @desc Moves items from chest → party.
 *
 * @arg x
 * @text X Coordinate
 * @type number
 * @min 0
 *
 * @arg y
 * @text Y Coordinate
 * @type number
 * @min 0
 *
 * @arg itemId
 * @text Item ID
 * @type number
 * @min 1
 *
 * @arg quantity
 * @text Quantity
 * @type text
 * @desc Number OR "all"
 *
 *
 * @command openChest
 * @text Open Chest UI
 * @desc Opens the chest UI at the given coordinates.
 *
 * @arg x
 * @text X Coordinate
 * @type number
 * @min 0
 *
 * @arg y
 * @text Y Coordinate
 * @type number
 * @min 0
 *
 *
 * @command closeChest
 * @text Close Chest UI
 * @desc Closes the chest window if open.
 *
 * ===========================================================================
 * Interaction
 * ===========================================================================
 *
 * When the player interacts (Action Button) with a tile that is an active
 * chest location, the Chest UI will automatically open.
 *
 * ===========================================================================
 * Structures for Parameters
 * ===========================================================================
 */
/*~struct~RegionMap:
 * @param regionId
 * @text Region ID
 * @type number
 * @min 1
 * @desc The Region ID on the map that designates a chest location.
 * @default 1
 *
 * @param chestSize
 * @text Chest Size (Type)
 * @type string
 * @desc A unique identifier for the chest size (e.g., 'small', 'medium').
 * @default small
 *
 * @param tileId
 * @text Tile ID (A4/A5)
 * @type tilemap
 * @desc The Tile ID (A4/A5) used for the chest graphic when it is present.
 * @default 2816
 */
/*~struct~ChestType:
 * @param chestSize
 * @text Chest Size (Type)
 * @type string
 * @desc The unique identifier for this chest size (must match Region Map).
 * @default small
 *
 * @param maxCapacity
 * @text Max Item Capacity
 * @type number
 * @min 1
 * @desc The maximum number of distinct item stacks this chest size can hold.
 * @default 20
 *
 * @param tileId
 * @text Default Tile ID
 * @type tilemap
 * @desc The default Tile ID (A4/A5) for this size, overridden by Region Map if set.
 * @default 2816
 */

// Helper function to convert plugin parameter strings to structured data
const convertParameters = (parameters) => {
    const data = {};
    for (const key in parameters) {
        try {
            data[key] = JSON.parse(parameters[key]);
        } catch (e) {
            data[key] = parameters[key];
        }
    }
    return data;
};

(() => {
    const pluginName = "oTV_ChestSystem_MZ";

    // --- Plugin Parameters ---
    const params = PluginManager.parameters(pluginName);
    const parsedParams = convertParameters(params);

    const regionChestMap = (parsedParams["Region Chest Map"] || []).map(item => ({
        regionId: Number(item.regionId),
        chestSize: item.chestSize,
        tileId: Number(item.tileId)
    }));
    let chestTypeSettings = {};
    try {
        const settingsRaw = JSON.parse(params["Chest Type Settings"] || "[]");
        settingsRaw.forEach(setting => {
            chestTypeSettings[setting.chestSize] = {
                maxCapacity: Number(setting.maxCapacity) || 20,
                baseTileId: Number(setting.tileId) || 0
            };
        });
    } catch (e) {
        console.error("Error parsing Chest Type Settings:", e);
    }

    const loadJson = String(params["Load JSON?"] || "false") === "true";
    const jsonConfigPath = params["JSON Config File"] || "data/ChestConfig.json";

    /**
     * @typedef {object} ChestItem
     * @property {number} id - The ID of the item/weapon/armor.
     * @property {string} type - 'item', 'weapon', or 'armor'.
     * @property {number} quantity - The amount of the item.
     */

    /**
     * @typedef {object} ChestData
     * @property {string} type - The chest size type (e.g., 'small').
     * @property {ChestItem[]} items - The contents of the chest.
     */

    /**
     * Global object to store all chest data.
     * Structure: { mapId: { 'x,y': ChestData } }
     * @type {object<number, object<string, ChestData>>}
     */
    let $gameChest = {};
    
    /**
     * Stores the coordinates of the chest currently being viewed by the player.
     * Used for the `closeChest` command.
     * @type {object | null}
     */
    let $currentChestLocation = null;


    // --- Core Functions ---

    /**
     * Gets the key for a chest location.
     * @param {number} x - Map X coordinate.
     * @param {number} y - Map Y coordinate.
     * @returns {string} - The 'x,y' string key.
     */
    const getChestKey = (x, y) => `${x},${y}`;

    /**
     * Gets the chest data for a location on the current map.
     * @param {number} x - Map X coordinate.
     * @param {number} y - Map Y coordinate.
     * @returns {ChestData | null} - The chest data or null if not found.
     */
    const getChestData = (x, y) => {
        const mapId = $gameMap.mapId();
        const key = getChestKey(x, y);
        $gameChest[mapId] = $gameChest[mapId] || {};
        return $gameChest[mapId][key] || null;
    };

    /**
     * Finds the chest item object in a chest's item list.
     * @param {ChestItem[]} items - The chest's item list.
     * @param {object} itemObject - The RPG Maker item/weapon/armor object.
     * @returns {ChestItem | null} - The ChestItem object or null.
     */
    const findChestItem = (items, itemObject) => {
        const itemType = DataManager.isItem(itemObject) ? 'item' :
            DataManager.isWeapon(itemObject) ? 'weapon' :
            DataManager.isArmor(itemObject) ? 'armor' : null;

        if (!itemType) return null;

        return items.find(i => i.id === itemObject.id && i.type === itemType);
    };

    /**
     * Gets the actual item object from the item ID and type.
     * @param {number} id - The item ID.
     * @param {string} type - 'item', 'weapon', or 'armor'.
     * @returns {object | null} - The item object or null.
     */
    const getItemObject = (id, type) => {
        switch (type) {
            case 'item': return $dataItems[id];
            case 'weapon': return $dataWeapons[id];
            case 'armor': return $dataArmors[id];
            default: return null;
        }
    };

    /**
     * Gets the chest configuration (capacity, tile ID) based on its type.
     * @param {string} type - The chest size type (e.g., 'small').
     * @returns {object} - The configuration.
     */
    const getChestConfig = (type) => {
        return chestTypeSettings[type] || { maxCapacity: 20, baseTileId: 0 };
    };

    /**
     * Transfers an item between party and chest.
     * @param {number} x - Map X.
     * @param {number} y - Map Y.
     * @param {number} itemId - ID of the item/weapon/armor.
     * @param {string} itemType - 'item', 'weapon', or 'armor'.
     * @param {number | 'all'} quantity - Amount to transfer.
     * @param {boolean} toChest - True to move Party -> Chest, False for Chest -> Party.
     * @returns {boolean} - True if transfer was successful.
     */
    const transferItem = (x, y, itemId, itemType, quantity, toChest) => {
        const chestData = getChestData(x, y);
        if (!chestData) return false;

        const itemObject = getItemObject(itemId, itemType);
        if (!itemObject) return false;

        const config = getChestConfig(chestData.type);

        const partyAmount = $gameParty.numItems(itemObject);
        let chestItem = findChestItem(chestData.items, itemObject);

        // Determine actual quantity to move
        let transferQuantity = 0;
        if (toChest) { // Party -> Chest
            const available = partyAmount;
            transferQuantity = (quantity === 'all' || quantity >= available) ? available : quantity;
        } else { // Chest -> Party
            const available = chestItem ? chestItem.quantity : 0;
            transferQuantity = (quantity === 'all' || quantity >= available) ? available : quantity;
        }

        if (transferQuantity <= 0) return false;

        // Check chest capacity if adding
        if (toChest) {
            // Check if capacity of *stacks* is full only if we are adding a NEW stack
            if (!chestItem) {
                if (chestData.items.length >= config.maxCapacity) {
                    console.warn(`RBCIS: Chest at (${x}, ${y}) capacity full.`);
                    return false;
                }
            }
        }

        // Execute Transfer
        $gameParty.gainItem(itemObject, toChest ? -transferQuantity : transferQuantity);

        if (!chestItem) {
            chestItem = { id: itemId, type: itemType, quantity: 0 };
            chestData.items.push(chestItem);
        }

        chestItem.quantity += toChest ? transferQuantity : -transferQuantity;

        // Clean up chest list if quantity hits zero
        if (chestItem.quantity <= 0) {
            const index = chestData.items.indexOf(chestItem);
            if (index > -1) {
                chestData.items.splice(index, 1);
            }
        }

        $gameMap.requestRefresh(); // Visual update for chest tile if needed
        return true;
    };

    /**
     * Determines the item type from an item ID.
     * @param {number} itemId - The ID of the item/weapon/armor.
     * @returns {string | null} - 'item', 'weapon', 'armor', or null.
     */
    const determineItemType = (itemId) => {
        if ($dataItems[itemId]) return 'item';
        if ($dataWeapons[itemId]) return 'weapon';
        if ($dataArmors[itemId]) return 'armor';
        return null;
    };


    // --- Global Data Manager Overrides (Persistence) ---

    // Initialize $gameChest and $currentChestLocation on new game/load
    const _DataManager_createGameObjects = DataManager.createGameObjects;
    DataManager.createGameObjects = function() {
        _DataManager_createGameObjects.apply(this, arguments);
        $gameChest = {};
        $currentChestLocation = null;
    };

    // Save chest data
    const _DataManager_makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function() {
        const contents = _DataManager_makeSaveContents.apply(this, arguments);
        contents.chest = $gameChest;
        contents.currentChestLocation = $currentChestLocation;
        return contents;
    };

    // Load chest data
    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        _DataManager_extractSaveContents.apply(this, arguments);
        $gameChest = contents.chest || {};
        $currentChestLocation = contents.currentChestLocation || null;
    };

    // --- JSON Configuration Loading ---

    const _Scene_Boot_isDataLoaded = Scene_Boot.prototype.isDataLoaded;
    Scene_Boot.prototype.isDataLoaded = function() {
        if (!_Scene_Boot_isDataLoaded.apply(this, arguments)) {
            return false;
        }
        if (loadJson && !this._chestConfigLoaded) {
            this.loadChestConfig();
            return false;
        }
        return true;
    };

    Scene_Boot.prototype.loadChestConfig = function() {
        this._chestConfigLoaded = false;
        if (loadJson) {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', jsonConfigPath);
            xhr.overrideMimeType('application/json');
            xhr.onload = () => {
                if (xhr.status < 400) {
                    try {
                        const jsonConfig = JSON.parse(xhr.responseText);
                        // Merge JSON settings with existing
                        for (const type in jsonConfig) {
                            const config = jsonConfig[type];
                            chestTypeSettings[type] = chestTypeSettings[type] || {};
                            if (config.maxCapacity !== undefined) {
                                chestTypeSettings[type].maxCapacity = Number(config.maxCapacity);
                            }
                            // BaseTileId is used for the default graphic if region map fails
                            if (config.tileId !== undefined) {
                                chestTypeSettings[type].baseTileId = Number(config.tileId);
                            }
                        }
                        this._chestConfigLoaded = true;
                    } catch (e) {
                        console.error(`RBCIS: Failed to parse JSON config at ${jsonConfigPath}:`, e);
                        this._chestConfigLoaded = true; // Still allow game to start
                    }
                } else {
                    console.error(`RBCIS: Failed to load JSON config at ${jsonConfigPath}. Status: ${xhr.status}`);
                    this._chestConfigLoaded = true; // Still allow game to start
                }
            };
            xhr.onerror = () => {
                console.error(`RBCIS: Error loading JSON config at ${jsonConfigPath}.`);
                this._chestConfigLoaded = true; // Still allow game to start
            };
            xhr.send();
        } else {
            this._chestConfigLoaded = true;
        }
    };


    // --- Plugin Commands (@command) ---

    /**
     * Creates an empty chest at the specified coordinates based on region ID rules.
     * @param {{ x: string, y: string }} args
     */
    PluginManager.registerCommand(pluginName, "addChest", (args) => {
        const x = Number(args.x);
        const y = Number(args.y);
        const mapId = $gameMap.mapId();
        const key = getChestKey(x, y);

        if (getChestData(x, y)) {
            console.warn(`RBCIS: Chest already exists at (${x}, ${y}) on Map ${mapId}. Skipping.`);
            return;
        }

        const regionId = $gameMap.regionId(x, y);
        const configMap = regionChestMap.find(m => m.regionId === regionId);

        if (configMap) {
            $gameChest[mapId] = $gameChest[mapId] || {};
            $gameChest[mapId][key] = {
                type: configMap.chestSize,
                items: []
            };
            $gameMap.requestRefresh();
        } else {
            console.warn(`RBCIS: No chest configuration found for Region ID ${regionId} at (${x}, ${y}). Chest not added.`);
        }
    });

    /**
     * Deletes the chest at the specified coordinates. Contents are discarded.
     * @param {{ x: string, y: string }} args
     */
    PluginManager.registerCommand(pluginName, "delChest", (args) => {
        const x = Number(args.x);
        const y = Number(args.y);
        const mapId = $gameMap.mapId();
        const key = getChestKey(x, y);

        if (getChestData(x, y)) {
            delete $gameChest[mapId][key];
            $gameMap.requestRefresh();
        } else {
            console.warn(`RBCIS: No chest found at (${x}, ${y}) on Map ${mapId}. Skipping.`);
        }
    });

    /**
     * Transfers item from party to chest.
     * @param {{ x: string, y: string, itemId: string, quantity: string }} args
     */
    PluginManager.registerCommand(pluginName, "addToChest", (args) => {
        const x = Number(args.x);
        const y = Number(args.y);
        const itemId = Number(args.itemId);
        const quantity = args.quantity.toLowerCase() === 'all' ? 'all' : Number(args.quantity);
        const itemType = determineItemType(itemId);

        if (itemType) {
            transferItem(x, y, itemId, itemType, quantity, true);
        } else {
            console.error(`RBCIS: Invalid Item ID ${itemId} for addToChest at (${x}, ${y}).`);
        }
    });

    /**
     * Transfers item from chest to party.
     * @param {{ x: string, y: string, itemId: string, quantity: string }} args
     */
    PluginManager.registerCommand(pluginName, "removeFromChest", (args) => {
        const x = Number(args.x);
        const y = Number(args.y);
        const itemId = Number(args.itemId);
        const quantity = args.quantity.toLowerCase() === 'all' ? 'all' : Number(args.quantity);
        const itemType = determineItemType(itemId);

        if (itemType) {
            transferItem(x, y, itemId, itemType, quantity, false);
        } else {
            console.error(`RBCIS: Invalid Item ID ${itemId} for removeFromChest at (${x}, ${y}).`);
        }
    });

    /**
     * Opens the chest UI for a chest at the specified coordinates.
     * @param {{ x: string, y: string }} args
     */
    PluginManager.registerCommand(pluginName, "openChest", (args) => {
        const x = Number(args.x);
        const y = Number(args.y);
        const mapId = $gameMap.mapId();

        if (getChestData(x, y)) {
            $currentChestLocation = { mapId: mapId, x: x, y: y };
            SceneManager.push(Scene_Chest);
        } else {
            console.warn(`RBCIS: Cannot openChest. No chest found at (${x}, ${y}) on Map ${mapId}.`);
        }
    });

    /**
     * Closes the currently active chest UI.
     */
    PluginManager.registerCommand(pluginName, "closeChest", () => {
        if (SceneManager.isCurrentScene(Scene_Chest)) {
            SceneManager.pop();
            $currentChestLocation = null;
        }
    });


    // --- Map Rendering Override (Feature 1: Chest Graphic) ---

    // Overwrite tile ID if a chest is present at the location
    const _Game_Map_tileId = Game_Map.prototype.tileId;
    Game_Map.prototype.tileId = function(x, y, layerId) {
        // Only apply chest graphic to Layer 3 (usually B-layer/Tile 1) for the chest sprite
        if (layerId === 3) {
            const chestData = getChestData(x, y);
            if (chestData) {
                const config = getChestConfig(chestData.type);
                // Find the base tile ID from region mapping first
                const mapEntry = regionChestMap.find(m => m.chestSize === chestData.type);
                let tileId = mapEntry ? mapEntry.tileId : config.baseTileId;

                // Use the baseTileId from the merged config (JSON overrides region map)
                if (config.baseTileId !== 0) {
                    tileId = config.baseTileId;
                }

                if (tileId > 0) {
                    return tileId;
                }
            }
        }
        return _Game_Map_tileId.apply(this, arguments);
    };


    // --- Player Interaction (Feature 6: Chest UI Trigger) ---

    // Intercept player action to check for chest interaction
    const _Game_Player_triggerAction = Game_Player.prototype.triggerAction;
    Game_Player.prototype.triggerAction = function() {
        if (_Game_Player_triggerAction.apply(this, arguments)) {
            return true;
        }
        return this.triggerChestAction();
    };

    Game_Player.prototype.triggerChestAction = function() {
        if (!$gameMap.isEventRunning()) {
            const x = this.x;
            const y = this.y;
            const chestData = getChestData(x, y);

            if (chestData) {
                // Set the current chest location before reserving transfer
                $currentChestLocation = { mapId: this.mapId(), x: x, y: y };

                // Reserve transfer is used to prevent the player sprite from moving
                // if they are facing a chest from an adjacent tile.
                $gamePlayer.reserveTransfer(this.mapId(), x, y, this.direction(), 0);
                SceneManager.push(Scene_Chest);
                return true;
            }
        }
        return false;
    };


    // --- Scene_Chest (Feature 6: Chest UI) ---

    function Scene_Chest() {
        this.initialize(...arguments);
    }

    Scene_Chest.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_Chest.prototype.constructor = Scene_Chest;

    Scene_Chest.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);

        // Get chest coordinates from the reserved location data
        const mapId = $currentChestLocation.mapId;
        const x = $currentChestLocation.x;
        const y = $currentChestLocation.y;

        this._mapId = mapId;
        this._chestX = x;
        this._chestY = y;
        this._chestData = $gameChest[this._mapId] ? $gameChest[this._mapId][getChestKey(x, y)] : null;
    };

    Scene_Chest.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        this.createHelpWindow();
        this.createChestWindow();
        this.createPartyWindow();
        this.createCommandWindow();
    };

    Scene_Chest.prototype.createHelpWindow = function() {
        this._helpWindow = new Window_Help(new Rectangle(0, 0, Graphics.boxWidth, this.helpWindowHeight()));
        this.addWindow(this._helpWindow);
    };

    Scene_Chest.prototype.createChestWindow = function() {
        const rect = this.chestWindowRect();
        this._chestWindow = new Window_Chest(rect);
        this._chestWindow.setHandler("ok", this.onChestOk.bind(this));
        this._chestWindow.setHandler("cancel", this.onCancel.bind(this));
        this._chestWindow.setHelpWindow(this._helpWindow);
        this.addWindow(this._chestWindow);
    };

    Scene_Chest.prototype.chestWindowRect = function() {
        const wx = 0;
        const wy = this.helpWindowHeight();
        const ww = Graphics.boxWidth / 2;
        const wh = Graphics.boxHeight - wy - this.commandWindowRect().height;
        return new Rectangle(wx, wy, ww, wh);
    };

    Scene_Chest.prototype.createPartyWindow = function() {
        const rect = this.partyWindowRect();
        this._partyWindow = new Window_PartyChest(rect);
        this._partyWindow.setHandler("ok", this.onPartyOk.bind(this));
        this._partyWindow.setHandler("cancel", this.onCancel.bind(this));
        this._partyWindow.setHelpWindow(this._helpWindow);
        this.addWindow(this._partyWindow);
    };

    Scene_Chest.prototype.partyWindowRect = function() {
        const ww = Graphics.boxWidth / 2;
        const wx = ww;
        const wy = this.helpWindowHeight();
        const wh = Graphics.boxHeight - wy - this.commandWindowRect().height;
        return new Rectangle(wx, wy, ww, wh);
    };

    Scene_Chest.prototype.createCommandWindow = function() {
        const rect = this.commandWindowRect();
        this._commandWindow = new Window_ChestCommand(rect);
        this._commandWindow.setHandler("take", this.commandTake.bind(this));
        this._commandWindow.setHandler("store", this.commandStore.bind(this));
        this._commandWindow.setHandler("cancel", this.onCancel.bind(this));
        this.addWindow(this._commandWindow);
    };

    Scene_Chest.prototype.commandWindowRect = function() {
        const ww = Graphics.boxWidth;
        const wh = this.calcWindowHeight(1, true);
        const wx = 0;
        const wy = Graphics.boxHeight - wh;
        return new Rectangle(wx, wy, ww, wh);
    };

    Scene_Chest.prototype.start = function() {
        Scene_MenuBase.prototype.start.call(this);
        this._chestWindow.refresh(this._chestData);
        this._partyWindow.refresh();
        this._commandWindow.selectLast();
        this._commandWindow.activate();
    };

    Scene_Chest.prototype.onCancel = function() {
        $currentChestLocation = null;
        SceneManager.pop();
    }

    Scene_Chest.prototype.commandTake = function() {
        this._chestWindow.select(0);
        this._chestWindow.activate();
    };

    Scene_Chest.prototype.commandStore = function() {
        this._partyWindow.select(0);
        this._partyWindow.activate();
    };

    Scene_Chest.prototype.onChestOk = function() {
        const item = this._chestWindow.item();
        if (item) {
            // Trigger take item
            const itemObj = getItemObject(item.id, item.type);
            const max = item.quantity;
            this.showQuantityInput(itemObj, max, false); // False means Chest -> Party
        } else {
            this._chestWindow.activate();
        }
    };

    Scene_Chest.prototype.onPartyOk = function() {
        const item = this._partyWindow.item();
        if (item) {
            // Trigger store item
            const itemObj = item; // Window_PartyChest returns the actual item object
            const max = $gameParty.numItems(itemObj);
            this.showQuantityInput(itemObj, max, true); // True means Party -> Chest
        } else {
            this._partyWindow.activate();
        }
    };

    // Helper for quantity input (based on Scene_Shop's buy/sell number input)
    Scene_Chest.prototype.showQuantityInput = function(item, max, toChest) {
        this._item = item;
        this._toChest = toChest;
        const rect = this.quantityWindowRect();
        this._numberWindow = new Window_NumberInput(rect);
        this._numberWindow.setup(item, 1, max);
        this._numberWindow.setHandler("ok", this.onNumberOk.bind(this));
        this._numberWindow.setHandler("cancel", this.onNumberCancel.bind(this));
        this._numberWindow.setHelpWindow(this._helpWindow);
        this.addWindow(this._numberWindow);
        this._numberWindow.activate();

        // Deactivate source window
        if (toChest) {
            this._partyWindow.deactivate();
        } else {
            this._chestWindow.deactivate();
        }
    };

    Scene_Chest.prototype.quantityWindowRect = function() {
        const ww = 480;
        const wh = this.calcWindowHeight(4, true);
        const wx = (Graphics.boxWidth - ww) / 2;
        const wy = (Graphics.boxHeight - wh) / 2;
        return new Rectangle(wx, wy, ww, wh);
    };

    Scene_Chest.prototype.onNumberOk = function() {
        const number = this._numberWindow.number();
        this.doTransfer(this._item, number, this._toChest);
        this.endNumberInput();
        this.refreshWindows();
    };

    Scene_Chest.prototype.onNumberCancel = function() {
        this.endNumberInput();
        this.refreshWindows();
    };

    Scene_Chest.prototype.endNumberInput = function() {
        this.removeChild(this._numberWindow);
        this._numberWindow = null;
        if (this._toChest) {
            this._partyWindow.activate();
        } else {
            this._chestWindow.activate();
        }
        // Always return focus to the command window group
        this._commandWindow.activate();
    };

    Scene_Chest.prototype.doTransfer = function(item, quantity, toChest) {
        const itemId = item.id;
        const itemType = DataManager.isItem(item) ? 'item' : DataManager.isWeapon(item) ? 'weapon' : 'armor';
        transferItem(this._chestX, this._chestY, itemId, itemType, quantity, toChest);
    };

    Scene_Chest.prototype.refreshWindows = function() {
        this._chestWindow.refresh(this._chestData);
        this._partyWindow.refresh();
        this._commandWindow.activate();
    };


    // --- Window_ChestCommand ---

    function Window_ChestCommand() {
        this.initialize(...arguments);
    }

    Window_ChestCommand.prototype = Object.create(Window_Command.prototype);
    Window_ChestCommand.prototype.constructor = Window_ChestCommand;

    Window_ChestCommand.prototype.initialize = function(rect) {
        Window_Command.prototype.initialize.call(this, rect);
        this.selectLast();
    };

    Window_ChestCommand.prototype.makeCommandList = function() {
        this.addCommand("Take", "take");
        this.addCommand("Store", "store");
        this.addCommand("Cancel", "cancel");
    };

    Window_ChestCommand.prototype.maxCols = function() {
        return 3;
    };

    Window_ChestCommand.prototype.selectLast = function() {
        this.select(0);
    };


    // --- Window_Chest (Shows Chest Contents) ---

    function Window_Chest() {
        this.initialize(...arguments);
        this._chestData = null;
    }

    Window_Chest.prototype = Object.create(Window_Selectable.prototype);
    Window_Chest.prototype.constructor = Window_Chest;

    Window_Chest.prototype.maxCols = function() {
        return 1;
    };

    Window_Chest.prototype.maxItems = function() {
        return this._chestData ? this._chestData.items.length : 0;
    };

    Window_Chest.prototype.item = function() {
        const index = this.index();
        return this._chestData && index >= 0 ? this._chestData.items[index] : null;
    };

    Window_Chest.prototype.refresh = function(chestData) {
        this._chestData = chestData;
        this.createContents();
        Window_Selectable.prototype.refresh.call(this);
    };

    Window_Chest.prototype.drawItem = function(index) {
        const item = this.item();
        if (item) {
            const rect = this.itemLineRect(index);
            const itemObj = getItemObject(item.id, item.type);
            if (itemObj) {
                const numberWidth = this.textWidth("000");
                this.drawItemName(itemObj, rect.x, rect.y, rect.width - numberWidth);
                this.drawItemNumber(item.quantity, rect.x, rect.y, rect.width);
            }
        }
    };

    Window_Chest.prototype.drawItemNumber = function(quantity, x, y, width) {
        this.drawText(`: ${quantity}`, x, y, width, "right");
    };

    Window_Chest.prototype.updateHelp = function() {
        const item = this.item();
        if (item) {
            const itemObj = getItemObject(item.id, item.type);
            this._helpWindow.setItem(itemObj);
        } else {
            this._helpWindow.clear();
        }
    };


    // --- Window_PartyChest (Shows Party Contents - Inherits from Window_ItemList) ---

    function Window_PartyChest() {
        this.initialize(...arguments);
    }

    Window_PartyChest.prototype = Object.create(Window_ItemList.prototype);
    Window_PartyChest.prototype.constructor = Window_PartyChest;

    Window_PartyChest.prototype.initialize = function(rect) {
        Window_ItemList.prototype.initialize.call(this, rect);
        this._category = "item";
        this.selectLast();
    };

    // Overriding includes and makeItemList to show all items (including weapons/armor)
    Window_PartyChest.prototype.includes = function(item) {
        return item !== null; // Show all items the party has
    };

    Window_PartyChest.prototype.makeItemList = function() {
        // Collect all items, weapons, and armor the party has, filtered by quantity > 0
        this._data = $gameParty.allItems().filter(item => $gameParty.numItems(item) > 0);
    };

    Window_PartyChest.prototype.refresh = function() {
        this.makeItemList();
        this.createContents();
        Window_Selectable.prototype.refresh.call(this);
    };

    Window_PartyChest.prototype.updateHelp = function() {
        this._helpWindow.setItem(this.item());
    };

    Window_PartyChest.prototype.selectLast = function() {
        this.select(0);
    };

})();
