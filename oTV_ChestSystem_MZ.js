/*:
 * @target MZ
 * @plugindesc Region-Based Persistent Dual-Panel Chest Inventory System (With Auto-Open & 3s Cooldown)
 * @author OuttieTV
 *
 * @param Load JSON
 * @type boolean
 * @desc If true, configurations are handled/overwritten by your external JSON config file.
 * @default false
 *
 * @param JSON Config File
 * @text JSON Config Path
 * @parent Load JSON
 * @type string
 * @desc Path to the external configuration matrix (e.g., data/ChestConfig.json).
 * @default data/ChestConfig.json
 *
 * @param Chest Configuration
 * @type struct<ChestConfigItem>[]
 * @desc Combined setup parameters for localized regions and core properties per custom chest container.
 * @default []
 *
 * @help
 * ===========================================================================
 * Region-Based Persistent Chest Inventory System (RBCIS)
 * ===========================================================================
 * No map events required! Simply painting a region ID on the map triggers the
 * custom dual-inventory panel automatically when stepped on.
 *
 * Features a 3-second sleep/cooldown period upon closing the menu to prevent
 * looping interfaces while standing stationary on the chest tile.
 *
 * All operations print thorough debugging logs directly to the developer console (F8).
 *
 * @command addChest
 * @text Add Chest
 * @arg x
 * @type number
 * @arg y
 *
 * @command delChest
 * @text Delete Chest
 * @arg x
 * @type number
 * @arg y
 *
 * @command openChest
 * @text Open Chest UI
 * @arg x
 * @type number
 * @arg y
 *
 * @command closeChest
 * @text Close Chest UI
 */
/*~struct~ChestConfigItem:
 * @param regionId
 * @text Region ID
 * @type number
 * @min 1
 * @default 1
 *
 * @param chestSize
 * @text Chest Size (Type Name)
 * @type string
 * @default small
 *
 * @param maxCapacity
 * @text Max Item Capacity
 * @type number
 * @min 1
 * @default 20
 *
 * @param tileId
 * @text Tile ID (A4/A5 Layer Graphic)
 * @type tilemap
 * @default 2816
 *
 * @param textOnly
 * @text Text Only?
 * @type boolean
 * @default false
 */

const ChestSystem = {};
ChestSystem.pluginName = "oTV_ChestSystem_MZ";
ChestSystem.parameters = PluginManager.parameters(ChestSystem.pluginName);

ChestSystem.loadJson = eval(ChestSystem.parameters["Load JSON"] || "false");
ChestSystem.jsonConfigPath = String(ChestSystem.parameters["JSON Config File"] || "data/ChestConfig.json");

// Core Runtime Context Containers
ChestSystem.regionChestMap = [];
ChestSystem.chestTypeSettings = {};
ChestSystem._chestCooldowns = {};

// Parse unified parameter structure directly into standard lookup maps
try {
    const rawItems = JSON.parse(ChestSystem.parameters["Chest Configuration"] || "[]");
    rawItems.forEach(itemStr => {
        const item = typeof itemStr === 'string' ? JSON.parse(itemStr) : itemStr;
        if (!item) return;
        
        const rId = Number(item.regionId || 1);
        const sizeName = item.chestSize || "small";
        const capacity = Number(item.maxCapacity || 20);
        const tile = Number(item.tileId || 0);
        const textOnlyFlag = String(item.textOnly) === "true";

        // Map regions directly to types
        ChestSystem.regionChestMap.push({
            regionId: rId,
            chestSize: sizeName,
            tileId: tile
        });

        // Map properties to configurations
        ChestSystem.chestTypeSettings[sizeName] = {
            maxCapacity: capacity,
            baseTileId: tile,
            textOnly: textOnlyFlag
        };
    });
} catch(e) {
    console.error("ChestSystem: Parameter structural setup initialization error:", e);
}

// Global scope access layers
let $gameChest = {};
let $currentChestLocation = null;

// ============================================================================
// DATA HANDLING
// ============================================================================

ChestSystem.loadJsonFile = function() {
    return new Promise(resolve => {
        console.log(`[${ChestSystem.pluginName}] Initializing XMLHttpRequest trace target: ${ChestSystem.jsonConfigPath}`);
        const xhr = new XMLHttpRequest();
        xhr.open("GET", ChestSystem.jsonConfigPath);
        xhr.overrideMimeType("application/json");
        xhr.onload = function() {
            if (xhr.status < 400) {
                try {
                    const parsedData = JSON.parse(xhr.responseText);
                    console.log(`[${ChestSystem.pluginName}] File Load Success! Context Payload Recieved:`);
                    console.dir(parsedData); // Outputs cleanly as an interactive object tree in console
                    resolve(parsedData);
                } catch(e) {
                    console.error(`[${ChestSystem.pluginName}] File loaded but failed structural JSON verification check:`, e);
                    resolve(null);
                }
            } else {
                console.error(`[${ChestSystem.pluginName}] Target read missed. Web storage server returned HTTP Status: ${xhr.status}`);
                resolve(null);
            }
        };
        xhr.onerror = () => {
            console.error(`[${ChestSystem.pluginName}] Fatal connection breakdown reading external filesystem handle address path.`);
            resolve(null);
        };
        xhr.send();
    });
};

ChestSystem.loadChestData = function() {
    if (!ChestSystem.loadJson) {
        console.log(`[${ChestSystem.pluginName}] External load disabled. Using Parameters structural database:`, ChestSystem.chestTypeSettings);
        return;
    }

    ChestSystem.loadJsonFile().then(jsonConfig => {
        if (!jsonConfig) {
            console.warn(`[${ChestSystem.pluginName}] Fallback warning activated. Failed to build configuration cache from file source environment.`);
            return;
        }

        for (const type in jsonConfig) {
            const config = jsonConfig[type];
            ChestSystem.chestTypeSettings[type] = ChestSystem.chestTypeSettings[type] || {};
            
            if (config.maxCapacity !== undefined) ChestSystem.chestTypeSettings[type].maxCapacity = Number(config.maxCapacity);
            if (config.tileId !== undefined) ChestSystem.chestTypeSettings[type].baseTileId = Number(config.tileId);
            if (config.textOnly !== undefined) ChestSystem.chestTypeSettings[type].textOnly = !!config.textOnly;

            if (config.regionId !== undefined) {
                const rId = Number(config.regionId);
                const existingIndex = ChestSystem.regionChestMap.findIndex(m => m.regionId === rId);
                const mapEntry = {
                    regionId: rId,
                    chestSize: type,
                    tileId: config.tileId !== undefined ? Number(config.tileId) : 0
                };

                if (existingIndex > -1) {
                    ChestSystem.regionChestMap[existingIndex] = mapEntry;
                } else {
                    ChestSystem.regionChestMap.push(mapEntry);
                }
            }
        }
        console.log(`[${ChestSystem.pluginName}] Global system state runtime settings overridden successfully by layout file contents.`);
    });
};

(() => {
    const _load = Scene_Boot.prototype.loadSystemImages;
    Scene_Boot.prototype.loadSystemImages = function() {
        _load.call(this);
        ChestSystem.loadChestData();
    };
})();

// ============================================================================
// CORE STORAGE LOGIC & UTILITIES
// ============================================================================

ChestSystem.getChestKey = (x, y) => `${x},${y}`;

ChestSystem.getChestData = (x, y) => {
    const mapId = $gameMap.mapId();
    const key = ChestSystem.getChestKey(x, y);
    $gameChest[mapId] = $gameChest[mapId] || {};
    return $gameChest[mapId][key] || null;
};

ChestSystem.findChestItem = (items, itemObject) => {
    const itemType = DataManager.isItem(itemObject) ? 'item' :
                     DataManager.isWeapon(itemObject) ? 'weapon' :
                     DataManager.isArmor(itemObject) ? 'armor' : null;
    if (!itemType) return null;
    return items.find(i => i.id === itemObject.id && i.type === itemType);
};

ChestSystem.getItemObject = (id, type) => {
    switch (type) {
        case 'item': return $dataItems[id];
        case 'weapon': return $dataWeapons[id];
        case 'armor': return $dataArmors[id];
        default: return null;
    }
};

ChestSystem.getChestConfig = (type) => {
    return ChestSystem.chestTypeSettings[type] || { maxCapacity: 20, baseTileId: 0, textOnly: false };
};

ChestSystem.transferItem = (x, y, itemId, itemType, quantity, toChest) => {
    const chestData = ChestSystem.getChestData(x, y);
    if (!chestData) return false;

    const itemObject = ChestSystem.getItemObject(itemId, itemType);
    if (!itemObject) return false;

    const config = ChestSystem.getChestConfig(chestData.type);
    const partyAmount = $gameParty.numItems(itemObject);
    let chestItem = ChestSystem.findChestItem(chestData.items, itemObject);

    let transferQuantity = 0;
    if (toChest) {
        const available = partyAmount;
        transferQuantity = (quantity === 'all' || quantity >= available) ? available : quantity;
    } else {
        const available = chestItem ? chestItem.quantity : 0;
        transferQuantity = (quantity === 'all' || quantity >= available) ? available : quantity;
    }

    if (transferQuantity <= 0) return false;

    if (toChest && !chestItem) {
        if (chestData.items.length >= config.maxCapacity) {
            console.warn(`[${ChestSystem.pluginName}] Transfer aborted: Chest at (${x}, ${y}) size [${chestData.type}] limit reached (${config.maxCapacity}).`);
            SoundManager.playBuzzer();
            return false;
        }
    }

    console.log(`[${ChestSystem.pluginName}] Item Transfer: ${itemObject.name} x${transferQuantity} | Destination: ${toChest ? 'Container' : 'Party'}`);
    $gameParty.gainItem(itemObject, toChest ? -transferQuantity : transferQuantity);

    if (!chestItem) {
        chestItem = { id: itemId, type: itemType, quantity: 0 };
        chestData.items.push(chestItem);
    }

    chestItem.quantity += toChest ? transferQuantity : -transferQuantity;

    if (chestItem.quantity <= 0) {
        const index = chestData.items.indexOf(chestItem);
        if (index > -1) chestData.items.splice(index, 1);
    }

    $gameMap.requestRefresh();
    return true;
};

ChestSystem.initializeOrGetChestAt = (x, y) => {
    let chestData = ChestSystem.getChestData(x, y);
    if (chestData) return chestData;

    const regionId = $gameMap.regionId(x, y);
    const configMap = ChestSystem.regionChestMap.find(m => m.regionId === regionId);

    if (configMap) {
        const mapId = $gameMap.mapId();
        const key = ChestSystem.getChestKey(x, y);
        $gameChest[mapId] = $gameChest[mapId] || {};
        $gameChest[mapId][key] = {
            type: configMap.chestSize,
            items: []
        };
        console.log(`[${ChestSystem.pluginName}] Instantiated container map context dynamically on (${x}, ${y}) | Size mapping key: ${configMap.chestSize}`);
        $gameMap.requestRefresh();
        return $gameChest[mapId][key];
    }
    return null;
};

// ============================================================================
// DATA ENGINE HOOKS & PERSISTENCE
// ============================================================================

const _DataManager_createGameObjects = DataManager.createGameObjects;
DataManager.createGameObjects = function() {
    _DataManager_createGameObjects.apply(this, arguments);
    $gameChest = {};
    $currentChestLocation = null;
    ChestSystem._chestCooldowns = {};
};

const _DataManager_makeSaveContents = DataManager.makeSaveContents;
DataManager.makeSaveContents = function() {
    const contents = _DataManager_makeSaveContents.apply(this, arguments);
    contents.chest = $gameChest;
    contents.currentChestLocation = $currentChestLocation;
    return contents;
};

const _DataManager_extractSaveContents = DataManager.extractSaveContents;
DataManager.extractSaveContents = function(contents) {
    _DataManager_extractSaveContents.apply(this, arguments);
    $gameChest = contents.chest || {};
    $currentChestLocation = contents.currentChestLocation || null;
    ChestSystem._chestCooldowns = {};
    console.log(`[${ChestSystem.pluginName}] Storage structures synchronized smoothly from save-state contents.`);
};

// ============================================================================
// ENGINE UPDATE INTERFACES (COOLDOWNS & TRIGGERS)
// ============================================================================

const _Game_Map_update = Game_Map.prototype.update;
Game_Map.prototype.update = function(sceneActive) {
    _Game_Map_update.apply(this, arguments);
    for (const key in ChestSystem._chestCooldowns) {
        if (ChestSystem._chestCooldowns[key] > 0) {
            ChestSystem._chestCooldowns[key] -= 1;
            if (ChestSystem._chestCooldowns[key] === 0) {
                console.log(`[${ChestSystem.pluginName}] Safe operational trigger cooldown cleared for node context Key: ${key}`);
            }
        }
    }
};

const _Game_Player_update = Game_Player.prototype.update;
Game_Player.prototype.update = function(sceneActive) {
    _Game_Player_update.apply(this, arguments);
    if (!this.isMoving()) {
        if ($gameMap.isEventRunning() || SceneManager.isNextScene(Scene_Chest) || (SceneManager._scene instanceof Scene_Chest)) return;
        
        const x = this.x;
        const y = this.y;
        const mapId = $gameMap.mapId();
        const regionId = $gameMap.regionId(x, y);
        
        if (regionId > 0) {
            const match = ChestSystem.regionChestMap.find(m => m.regionId === regionId);
            if (match) {
                const cdKey = `${mapId},${x},${y}`;
                if (ChestSystem._chestCooldowns[cdKey] && ChestSystem._chestCooldowns[cdKey] > 0) return;

                console.log(`[${ChestSystem.pluginName}] Step check matched region matrix -> Coordinates: (${x}, ${y}) | Region ID: ${regionId} | Size Type: ${match.chestSize}`);
                
                const chestData = ChestSystem.initializeOrGetChestAt(x, y);
                if (chestData) {
                    $currentChestLocation = { mapId: mapId, x: x, y: y };
                    SceneManager.push(Scene_Chest);
                }
            }
        }
    }
};

// ============================================================================
// PLUGIN COMMAND MAPPINGS
// ============================================================================

PluginManager.registerCommand(ChestSystem.pluginName, "addChest", (args) => {
    const x = Number(args.x);
    const y = Number(args.y);
    const mapId = $gameMap.mapId();
    const key = ChestSystem.getChestKey(x, y);
    if (ChestSystem.getChestData(x, y)) return;

    const regionId = $gameMap.regionId(x, y);
    const configMap = ChestSystem.regionChestMap.find(m => m.regionId === regionId);
    if (configMap) {
        $gameChest[mapId] = $gameChest[mapId] || {};
        $gameChest[mapId][key] = { type: configMap.chestSize, items: [] };
        console.log(`[${ChestSystem.pluginName}] API Trigger: Enforced compilation layout initialization at (${x}, ${y})`);
        $gameMap.requestRefresh();
    }
});

PluginManager.registerCommand(ChestSystem.pluginName, "delChest", (args) => {
    const x = Number(args.x);
    const y = Number(args.y);
    const mapId = $gameMap.mapId();
    const key = ChestSystem.getChestKey(x, y);
    if (ChestSystem.getChestData(x, y)) {
        delete $gameChest[mapId][key];
        console.log(`[${ChestSystem.pluginName}] API Trigger: Removed container context tracking allocation at (${x}, ${y})`);
        $gameMap.requestRefresh();
    }
});

PluginManager.registerCommand(ChestSystem.pluginName, "openChest", (args) => {
    const x = Number(args.x);
    const y = Number(args.y);
    if (ChestSystem.initializeOrGetChestAt(x, y)) {
        console.log(`[${ChestSystem.pluginName}] API Trigger: Command execution forcing interface initialization sequence for coordinates (${x}, ${y})`);
        $currentChestLocation = { mapId: $gameMap.mapId(), x: x, y: y };
        SceneManager.push(Scene_Chest);
    }
});

PluginManager.registerCommand(ChestSystem.pluginName, "closeChest", () => {
    if (SceneManager._scene instanceof Scene_Chest) {
        SceneManager._scene.onCancel();
    }
});

// ============================================================================
// ENGINE MAP RENDERING LAYER INTERACTION
// ============================================================================

const _Game_Map_tileId = Game_Map.prototype.tileId;
Game_Map.prototype.tileId = function(x, y, layerId) {
    if (layerId === 3) {
        const chestData = ChestSystem.getChestData(x, y);
        if (chestData) {
            const config = ChestSystem.getChestConfig(chestData.type);
            if (config.textOnly) return _Game_Map_tileId.apply(this, arguments);

            const mapEntry = ChestSystem.regionChestMap.find(m => m.chestSize === chestData.type);
            let tileId = mapEntry ? mapEntry.tileId : config.baseTileId;
            if (config.baseTileId !== 0) tileId = config.baseTileId;
            if (tileId > 0) return tileId;
        }
    }
    return _Game_Map_tileId.apply(this, arguments);
};

// ============================================================================
// SCENE IMPLEMENTATION INTERFACES (SCENE_CHEST)
// ============================================================================

function Scene_Chest() {
    this.initialize(...arguments);
}
Scene_Chest.prototype = Object.create(Scene_MenuBase.prototype);
Scene_Chest.prototype.constructor = Scene_Chest;

Scene_Chest.prototype.initialize = function() {
    Scene_MenuBase.prototype.initialize.call(this);
    const loc = $currentChestLocation || { mapId: $gameMap.mapId(), x: 0, y: 0 };
    this._mapId = loc.mapId;
    this._chestX = loc.x;
    this._chestY = loc.y;
};

Scene_Chest.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createHelpWindow();
    this.createCommandWindow();
    this.createChestWindow();
    this.createPartyWindow();
};

Scene_Chest.prototype.createHelpWindow = function() {
    const helpH = this.calcWindowHeight(2, false); // Safe native fallback for MZ MenuBase viewports
    this._helpWindow = new Window_Help(new Rectangle(0, 0, Graphics.boxWidth, helpH));
    this.addWindow(this._helpWindow);
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
    return new Rectangle(0, Graphics.boxHeight - wh, ww, wh);
};

Scene_Chest.prototype.createChestWindow = function() {
    const rect = this.chestWindowRect();
    this._chestWindow = new Window_Chest(rect);
    this._chestWindow.setHandler("ok", this.onChestOk.bind(this));
    this._chestWindow.setHandler("cancel", this.onWindowCancel.bind(this));
    this._chestWindow.setHelpWindow(this._helpWindow);
    this.addWindow(this._chestWindow);
};

Scene_Chest.prototype.chestWindowRect = function() {
    const wy = this._helpWindow.height;
    const ww = Graphics.boxWidth / 2;
    const wh = Graphics.boxHeight - wy - this._commandWindow.height;
    return new Rectangle(0, wy, ww, wh);
};

Scene_Chest.prototype.createPartyWindow = function() {
    const rect = this.partyWindowRect();
    this._partyWindow = new Window_PartyChest(rect);
    this._partyWindow.setHandler("ok", this.onPartyOk.bind(this));
    this._partyWindow.setHandler("cancel", this.onWindowCancel.bind(this));
    this._partyWindow.setHelpWindow(this._helpWindow);
    this.addWindow(this._partyWindow);
};

Scene_Chest.prototype.partyWindowRect = function() {
    const ww = Graphics.boxWidth / 2;
    const wy = this._helpWindow.height;
    const wh = Graphics.boxHeight - wy - this._commandWindow.height;
    return new Rectangle(ww, wy, ww, wh);
};

Scene_Chest.prototype.start = function() {
    Scene_MenuBase.prototype.start.call(this);
    this.refreshWindows();
    this._commandWindow.activate();
};

Scene_Chest.prototype.onCancel = function() {
    const cdKey = `${this._mapId},${this._chestX},${this._chestY}`;
    ChestSystem._chestCooldowns[cdKey] = 180; 
    console.log(`[${ChestSystem.pluginName}] Interface closed. Vector lock initialized on context key location: ${cdKey}`);
    $currentChestLocation = null;
    SceneManager.pop();
};

Scene_Chest.prototype.commandTake = function() {
    this._chestWindow.select(0);
    this._chestWindow.activate();
};

Scene_Chest.prototype.commandStore = function() {
    this._partyWindow.select(0);
    this._partyWindow.activate();
};

Scene_Chest.prototype.onWindowCancel = function() {
    this._chestWindow.deselect();
    this._partyWindow.deselect();
    this._commandWindow.activate();
};

Scene_Chest.prototype.onChestOk = function() {
    const item = this._chestWindow.item();
    if (item) {
        const itemObj = ChestSystem.getItemObject(item.id, item.type);
        this.showQuantityInput(itemObj, item.quantity, false); 
    } else {
        this._chestWindow.activate();
    }
};

Scene_Chest.prototype.onPartyOk = function() {
    const item = this._partyWindow.item();
    if (item) {
        this.showQuantityInput(item, $gameParty.numItems(item), true); 
    } else {
        this._partyWindow.activate();
    }
};

Scene_Chest.prototype.showQuantityInput = function(item, max, toChest) {
    this._item = item;
    this._toChest = toChest;
    const rect = this.quantityWindowRect();
    this._numberWindow = new Window_NumberInput(rect);
    
    this.addWindow(this._numberWindow);
    this._numberWindow.setup(item, 1, max);
    this._numberWindow.setHandler("ok", this.onNumberOk.bind(this));
    this._numberWindow.setHandler("cancel", this.onNumberCancel.bind(this));
    this._numberWindow.setHelpWindow(this._helpWindow);
    this._numberWindow.activate();

    this._partyWindow.deactivate();
    this._chestWindow.deactivate();
};

Scene_Chest.prototype.quantityWindowRect = function() {
    const ww = 480;
    const wh = this.calcWindowHeight(4, true);
    return new Rectangle((Graphics.boxWidth - ww) / 2, (Graphics.boxHeight - wh) / 2, ww, wh);
};

Scene_Chest.prototype.onNumberOk = function() {
    const number = this._numberWindow.number();
    this.doTransfer(this._item, number, this._toChest);
    this.endNumberInput();
};

Scene_Chest.prototype.onNumberCancel = function() {
    this.endNumberInput();
};

Scene_Chest.prototype.endNumberInput = function() {
    this.destroyNumberInput();
    if (this._toChest) {
        this._partyWindow.activate();
    } else {
        this._chestWindow.activate();
    }
};

Scene_Chest.prototype.destroyNumberInput = function() {
    if (this._numberWindow) {
        this.removeChild(this._numberWindow);
        this._numberWindow.destroy();
        this._numberWindow = null;
    }
    this.refreshWindows();
};

Scene_Chest.prototype.doTransfer = function(item, quantity, toChest) {
    const itemId = item.id;
    const itemType = DataManager.isItem(item) ? 'item' : DataManager.isWeapon(item) ? 'weapon' : 'armor';
    ChestSystem.transferItem(this._chestX, this._chestY, itemId, itemType, quantity, toChest);
};

Scene_Chest.prototype.refreshWindows = function() {
    const chestData = ChestSystem.getChestData(this._chestX, this._chestY);
    this._chestWindow.refresh(chestData);
    this._partyWindow.refresh();
};

// ============================================================================
// WINDOW ELEMENT STRUCTURE COMPILATIONS
// ============================================================================

function Window_ChestCommand() {
    this.initialize(...arguments);
}
Window_ChestCommand.prototype = Object.create(Window_Command.prototype);
Window_ChestCommand.prototype.constructor = Window_ChestCommand;

Window_ChestCommand.prototype.initialize = function(rect) {
    Window_Command.prototype.initialize.call(this, rect);
};
Window_ChestCommand.prototype.makeCommandList = function() {
    this.addCommand("Take From Chest", "take");
    this.addCommand("Store To Chest", "store");
    this.addCommand("Close Menu", "cancel");
};
Window_ChestCommand.prototype.maxCols = function() { return 3; };


function Window_Chest() {
    this.initialize(...arguments);
}
Window_Chest.prototype = Object.create(Window_Selectable.prototype);
Window_Chest.prototype.constructor = Window_Chest;

Window_Chest.prototype.initialize = function(rect) {
    Window_Selectable.prototype.initialize.call(this, rect);
    this._data = [];
};
Window_Chest.prototype.maxItems = function() { return this._data ? this._data.length : 0; };
Window_Chest.prototype.item = function() { return this._data && this.index() >= 0 ? this._data[this.index()] : null; };
Window_Chest.prototype.refresh = function(chestData) {
    this._data = chestData ? chestData.items : [];
    this.createContents();
    this.paint();
};
Window_Chest.prototype.paint = function() {
    if (this.contents) {
        this.contents.clear();
        this.drawAllItems();
    }
};
Window_Chest.prototype.drawItem = function(index) {
    const item = this._data[index];
    if (item) {
        const itemObj = ChestSystem.getItemObject(item.id, item.type);
        if (itemObj) {
            const rect = this.itemLineRect(index);
            this.drawItemName(itemObj, rect.x, rect.y, rect.width - this.numberWidth());
            this.drawItemNumber(item, rect.x, rect.y, rect.width);
        }
    }
};
Window_Chest.prototype.numberWidth = function() { return this.textWidth("0000"); };
Window_Chest.prototype.drawItemNumber = function(item, x, y, width) {
    this.drawText(":", x, y, width - this.textWidth("00"), "right");
    this.drawText(item.quantity, x, y, width, "right");
};
Window_Chest.prototype.updateHelp = function() {
    const entry = this.item();
    this.setHelpWindowItem(entry ? ChestSystem.getItemObject(entry.id, entry.type) : null);
};


function Window_PartyChest() {
    this.initialize(...arguments);
}
Window_PartyChest.prototype = Object.create(Window_Selectable.prototype);
Window_PartyChest.prototype.constructor = Window_PartyChest;

Window_PartyChest.prototype.initialize = function(rect) {
    Window_Selectable.prototype.initialize.call(this, rect);
    this._data = [];
};
Window_PartyChest.prototype.maxItems = function() { return this._data ? this._data.length : 0; };
Window_PartyChest.prototype.item = function() { return this._data && this.index() >= 0 ? this._data[this.index()] : null; };
Window_PartyChest.prototype.refresh = function() {
    this._data = $gameParty.allItems();
    this.createContents();
    this.paint();
};
Window_PartyChest.prototype.paint = function() {
    if (this.contents) {
        this.contents.clear();
        this.drawAllItems();
    }
};
Window_PartyChest.prototype.drawItem = function(index) {
    const item = this._data[index];
    if (item) {
        const rect = this.itemLineRect(index);
        this.drawItemName(item, rect.x, rect.y, rect.width - this.numberWidth());
        this.drawItemNumber(item, rect.x, rect.y, rect.width);
    }
};
Window_PartyChest.prototype.numberWidth = function() { return this.textWidth("0000"); };
Window_PartyChest.prototype.drawItemNumber = function(item, x, y, width) {
    this.drawText(":", x, y, width - this.textWidth("00"), "right");
    this.drawText($gameParty.numItems(item), x, y, width, "right");
};
Window_PartyChest.prototype.updateHelp = function() { this.setHelpWindowItem(this.item()); };

window.ChestSystem = ChestSystem;
