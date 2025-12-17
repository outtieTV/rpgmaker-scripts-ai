/*:
 * @target MZ
 * @plugindesc [v1.0] A comprehensive Faction Reputation system with UI and Map Overlay.
 * @author Gemini
 * * @help
 * ============================================================================
 * HOW TO USE
 * ============================================================================
 * 1. Create a FactionConfig.json file in your project's /data/ folder.
 * 2. Use the Plugin Commands to modify reputation.
 * 3. Open the UI via Script: SceneManager.push(FactionReputationScene);
 * * @param loadFromConfig
 * @text Load From Config
 * @type boolean
 * @desc If true, loads faction data from data/FactionConfig.json.
 * @default true
 * * @param showOverlay
 * @text Show Map Overlay
 * @type boolean
 * @desc Show the reputation overlay on maps associated with factions.
 * @default true
 * * @param overlayX
 * @text Overlay X
 * @type number
 * @desc X coordinate of the map overlay.
 * @default 600
 * * @param overlayY
 * @text Overlay Y
 * @type number
 * @desc Y coordinate of the map overlay.
 * @default 550
 * * @command AddFactionReputation
 * @text Add Reputation
 * @desc Increases a faction's reputation.
 * * @arg factionId
 * @text Faction ID
 * @type string
 * @desc The ID of the faction (e.g., "Knights").
 * * @arg amount
 * @text Amount
 * @type number
 * @min 1
 * @desc Amount to add (0-100).
 * * @command SubtractFactionReputation
 * @text Subtract Reputation
 * @desc Decreases a faction's reputation.
 * * @arg factionId
 * @text Faction ID
 * @type string
 * * @arg amount
 * @text Amount
 * @type number
 * @min 1
 * * @command SetFactionReputation
 * @text Set Reputation
 * @desc Sets a faction's reputation to a specific value.
 * * @arg factionId
 * @text Faction ID
 * @type string
 * * @arg value
 * @text Value
 * @type number
 * @min 0
 * @max 100
 * * @command GetFactionReputation
 * @text Get Reputation
 * @desc Returns current reputation to a Game Variable.
 * * @arg factionId
 * @text Faction ID
 * @type string
 * * @arg variableId
 * @text Variable ID
 * @type variable
 * @desc The variable to store the result in.
 */

(() => {
    const pluginName = "FactionReputation_MZ_v1";
    const parameters = PluginManager.parameters(pluginName);
    const loadFromConfig = parameters['loadFromConfig'] === 'true';
    const showOverlayParam = parameters['showOverlay'] === 'true';
    const overlayX = Number(parameters['overlayX'] || 600);
    const overlayY = Number(parameters['overlayY'] || 550);

    // --- DATA MANAGEMENT ---

    DataManager._databaseFiles.push({ name: '$dataFactions', src: 'FactionConfig.json' });

    const _DataManager_createGameObjects = DataManager.createGameObjects;
    DataManager.createGameObjects = function() {
        _DataManager_createGameObjects.call(this);
        $gameFactions = new Game_Factions();
    };

    const _DataManager_makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function() {
        const contents = _DataManager_makeSaveContents.call(this);
        contents.factions = $gameFactions.getData();
        return contents;
    };

    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        _DataManager_extractSaveContents.call(this, contents);
        if (contents.factions) {
            $gameFactions.setData(contents.factions);
        }
    };

    class Game_Factions {
        constructor() {
            this._data = [];
            this._initialized = false;
        }

        initialize() {
            if (loadFromConfig && $dataFactions) {
                this._data = JSON.parse(JSON.stringify($dataFactions));
            }
            this._initialized = true;
        }

        getData() { return this._data; }
        setData(data) { 
            this._data = data; 
            this._initialized = true;
        }

        findFaction(id) {
            if (!this._initialized) this.initialize();
            return this._data.find(f => f.id === id);
        }

        updateRep(id, value, mode = 'set') {
            const faction = this.findFaction(id);
            if (faction) {
                if (mode === 'add') faction.reputation += value;
                else if (mode === 'sub') faction.reputation -= value;
                else faction.reputation = value;
                faction.reputation = Math.max(0, Math.min(100, faction.reputation));
            }
        }
    }

    let $gameFactions = null;

    // --- PLUGIN COMMANDS ---

    PluginManager.registerCommand(pluginName, "AddFactionReputation", args => {
        $gameFactions.updateRep(args.factionId, Number(args.amount), 'add');
    });

    PluginManager.registerCommand(pluginName, "SubtractFactionReputation", args => {
        $gameFactions.updateRep(args.factionId, Number(args.amount), 'sub');
    });

    PluginManager.registerCommand(pluginName, "SetFactionReputation", args => {
        $gameFactions.updateRep(args.factionId, Number(args.value), 'set');
    });

    PluginManager.registerCommand(pluginName, "GetFactionReputation", args => {
        const faction = $gameFactions.findFaction(args.factionId);
        const value = faction ? faction.reputation : 0;
        $gameVariables.setValue(Number(args.variableId), value);
    });

    // --- SCENE: FactionReputationScene ---

    window.FactionReputationScene = class extends Scene_MenuBase {
        create() {
            super.create();
            this.createWindowLayer();
            this.createFactionWindow();
        }

        createFactionWindow() {
            const rect = this.factionWindowRect();
            this._factionWindow = new Window_FactionList(rect);
            this._factionWindow.setHandler("cancel", this.popScene.bind(this));
            this.addWindow(this._factionWindow);
        }

        factionWindowRect() {
            const ww = 600;
            const wh = 400;
            const wx = (Graphics.boxWidth - ww) / 2;
            const wy = (Graphics.boxHeight - wh) / 2;
            return new Rectangle(wx, wy, ww, wh);
        }
    };

    class Window_FactionList extends Window_Selectable {
        constructor(rect) {
            super(rect);
            this.refresh();
            this.activate();
        }

        maxItems() { return $gameFactions.getData().length; }

        drawItem(index) {
            const faction = $gameFactions.getData()[index];
            const rect = this.itemLineRect(index);
            this.drawText(faction.name, rect.x, rect.y, rect.width / 3);
            this.drawText(`${faction.reputation}%`, rect.x + 200, rect.y, 80, "right");
            
            this.changePaintOpacity(false);
            this.contents.fontSize = 18;
            this.drawText(faction.maps.join(", "), rect.x + 300, rect.y, rect.width - 310);
            this.contents.fontSize = $gameSystem.mainFontSize();
            this.changePaintOpacity(true);
        }
    }

    // --- MAP OVERLAY ---

    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        if (showOverlayParam) {
            this.createFactionOverlay();
        }
    };

    Scene_Map.prototype.createFactionOverlay = function() {
        const rect = new Rectangle(overlayX, overlayY, 200, 60);
        this._factionOverlay = new Window_FactionOverlay(rect);
        this.addWindow(this._factionOverlay);
    };

    class Window_FactionOverlay extends Window_Base {
        constructor(rect) {
            super(rect);
            this.opacity = 180;
            this._lastRep = -1;
            this.refresh();
        }

        update() {
            super.update();
            const faction = this.getCurrentFaction();
            const currentRep = faction ? faction.reputation : -1;
            if (this._lastRep !== currentRep) {
                this.refresh();
            }
        }

        getCurrentFaction() {
            const mapName = $dataMapInfos[$gameMap.mapId()].name;
            return $gameFactions.getData().find(f => f.maps.includes(mapName));
        }

        refresh() {
            this.contents.clear();
            const faction = this.getCurrentFaction();
            if (faction) {
                this._lastRep = faction.reputation;
                this.drawText(`${faction.name}: ${faction.reputation}%`, 0, 0, this.contentsWidth(), "center");
                this.show();
            } else {
                this._lastRep = -1;
                this.hide();
            }
        }
    }
})();