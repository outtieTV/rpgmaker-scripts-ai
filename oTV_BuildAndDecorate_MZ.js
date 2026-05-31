/*:
 * @target MZ
 * @plugindesc [CustomPlacement] Allows players to place and destroy objects using Tyruswoo_TileControl and CGMZ_Core for visuals.
 * @author Gemini & oTV
 *
 * @param Load Settings From JSON
 * @type boolean
 * @default false
 * @desc If true, object and confirmation rules are loaded from an external JSON file.
 *
 * @param Config JSON Path
 * @type file
 * @dir data/
 * @default data/customPlacementConfig.json
 * @desc Path to the external JSON file (relative to the project root). Used when "Load Settings From JSON" is true.
 *
 * @param Global Placement Regions
 * @type string
 * @default 0
 * @desc Comma-separated list/range of Region IDs where placement is allowed globally. Use 0 for no restriction.
 *
 * @param Grid Color
 * @type string
 * @default #00FF00
 * @desc Hex color for the placement grid overlay.
 *
 * @param Grid Opacity
 * @type number
 * @decimals 2
 * @min 0
 * @max 1
 * @default 0.5
 * @desc Opacity of the grid overlay (0.0 to 1.0).
 *
 * @param Place Command Name
 * @type string
 * @default Place
 * @desc The name for the 'Place' plugin command.
 *
 * @param Destroy Command Name
 * @type string
 * @default Destroy
 * @desc The name for the 'Destroy' plugin command.
 *
 * @help
 * ===========================================================================
 * Introduction
 * ===========================================================================
 * Requires: 
 * 1. CGMZ_Core.js (For rendering shapes/rectangles)
 * 2. Tyruswoo_TileControl.js (For tile manipulation)
 *
 * This plugin allows players to place and destroy persistent tiles.
 *
 * ===========================================================================
 * Plugin Commands
 * ===========================================================================
 *
 * @command Place
 * @text Place Object Mode
 * @desc Enters the object placement mode.
 *
 * @arg objectName
 * @type string
 * @desc The internal name of the object to be placed.
 *
 * @command Destroy
 * @text Destroy Object Mode
 * @desc Enters the object destruction mode.
 *
 * @arg objectName
 * @type string
 * @default
 * @desc The internal name of the object to be destroyed.
 */

var $customTileChanges = $customTileChanges || {};

(function() {
    'use strict';

    const PLUGIN_NAME = 'CustomPlacement';
    const parameters = PluginManager.parameters('oTV_BuildAndDecorate_MZ');

    const LOAD_FROM_JSON = parameters['Load Settings From JSON'] === 'true';
    const CONFIG_JSON_PATH = parameters['Config JSON Path'];
    const GRID_COLOR = parameters['Grid Color'] || '#00FF00';
    const GRID_OPACITY = parseFloat(parameters['Grid Opacity'] || 0.5);
    const GLOBAL_REGIONS_RAW = String(parameters['Global Placement Regions'] || '0').trim();

    let config = { destroyConfirm: [], placeableObjects: [] };

    const parseRegionString = (regionsString) => {
        const allowedRegions = new Set();
        if (regionsString === '0') return allowedRegions;
        const parts = regionsString.split(',').map(s => s.trim()).filter(s => s.length > 0);
        for (const part of parts) {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(Number);
                for (let i = start; i <= end; i++) allowedRegions.add(i);
            } else {
                allowedRegions.add(Number(part));
            }
        }
        return allowedRegions;
    };

    const GLOBAL_ALLOWED_REGIONS = parseRegionString(GLOBAL_REGIONS_RAW);

    const getPlacementObject = (name) => config.placeableObjects.find(obj => obj.name === name) || null;

    const isRegionAllowed = (regionId, placementObj) => {
        let allowedRegions = (placementObj && placementObj.regions) ? parseRegionString(String(placementObj.regions)) : GLOBAL_ALLOWED_REGIONS;
        return allowedRegions.size === 0 || allowedRegions.has(regionId);
    };

    const requiresDestroyConfirmation = (name) => config.destroyConfirm.includes(name);

    // Load JSON Config
    const _Scene_Boot_onLoad = Scene_Boot.prototype.onLoad;
    Scene_Boot.prototype.onLoad = function() {
        if (LOAD_FROM_JSON) {
            fetch(CONFIG_JSON_PATH).then(r => r.json()).then(data => {
                config = Object.assign(config, data);
                _Scene_Boot_onLoad.call(this);
            }).catch(() => _Scene_Boot_onLoad.call(this));
        } else {
            _Scene_Boot_onLoad.call(this);
        }
    };

    // Persistence Data Handlers
    const storeChange = (mapId, x, y, layer, tileId, name) => {
        if (!$customTileChanges[mapId]) $customTileChanges[mapId] = {};
        $customTileChanges[mapId][`${x},${y},${layer}`] = { tileId, name };
    };

    const removeChange = (mapId, x, y, layer) => {
        if ($customTileChanges[mapId]) delete $customTileChanges[mapId][`${x},${y},${layer}`];
    };

    const getChange = (mapId, x, y, layer) => ($customTileChanges[mapId] || {})[`${x},${y},${layer}`] || null;

    // Hook into Tyruswoo_TileControl via Game_Map
    const _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        _Game_Map_setup.call(this, mapId);
        const changes = $customTileChanges[mapId] || {};
        for (const key in changes) {
            const [x, y, layer] = key.split(',').map(Number);
            if (typeof $gameTileControl !== 'undefined') {
                $gameTileControl.setTile(x, y, layer, changes[key].tileId);
            }
        }
    };

    // Save/Load
    const _DataManager_makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function() {
        const contents = _DataManager_makeSaveContents.call(this);
        contents.customTileChanges = $customTileChanges;
        return contents;
    };

    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        _DataManager_extractSaveContents.call(this, contents);
        $customTileChanges = contents.customTileChanges || {};
    };

    // Scene Implementation
    class Scene_PlacementMode extends Scene_Map {
        constructor(mode, objectName, placementObj) {
            super();
            this._mode = mode;
            this._objectName = objectName;
            this._placementObj = placementObj;
            this._targetX = $gamePlayer.x;
            this._targetY = $gamePlayer.y;
        }

        create() {
            super.create();
            this._targetX = $gamePlayer.x + $gamePlayer.directionX();
            this._targetY = $gamePlayer.y + $gamePlayer.directionY();
        }

        update() {
            super.update();
            this.updateInput();
            this.drawVisuals();
        }

        drawVisuals() {
            if (typeof $cgmzTemp === 'undefined') return;
            // Clear previous frames CGMZ rects (CGMZ_Core handles clear/refresh usually)
            const x = $gameMap.adjustX(this._targetX) * $gameMap.tileWidth();
            const y = $gameMap.adjustY(this._targetY) * $gameMap.tileHeight();
            
            // Use CGMZ to draw a rectangle representing the cursor
            $cgmzTemp.createRect(x, y, $gameMap.tileWidth(), $gameMap.tileHeight(), GRID_COLOR, Math.floor(GRID_OPACITY * 255));
        }

        updateInput() {
            if ($gameMessage.isBusy()) return;

            const dx = Input.isTriggered('right') ? 1 : Input.isTriggered('left') ? -1 : 0;
            const dy = Input.isTriggered('down') ? 1 : Input.isTriggered('up') ? -1 : 0;

            if (dx !== 0 || dy !== 0) {
                this._targetX = $gameMap.roundX(this._targetX + dx);
                this._targetY = $gameMap.roundY(this._targetY + dy);
                SoundManager.playCursor();
            }

            if (Input.isTriggered('cancel')) {
                SoundManager.playCancel();
                SceneManager.pop();
            } else if (Input.isTriggered('ok')) {
                this._mode === 'place' ? this.tryPlace() : this.tryDestroy();
            }
        }

        tryPlace() {
            const x = this._targetX, y = this._targetY;
            const regionId = $gameMap.regionId(x, y);

            if (!isRegionAllowed(regionId, this._placementObj) || !$gameMap.isPassable(x, y, 2)) {
                SoundManager.playBuzzer();
                return;
            }

            const layer = this._placementObj.layer || 1;
            $gameTileControl.setTile(x, y, layer, this._placementObj.tileId);
            storeChange($gameMap.mapId(), x, y, layer, this._placementObj.tileId, this._objectName);
            
            SoundManager.playOk();
            SceneManager.pop();
        }

        tryDestroy() {
            const x = this._targetX, y = this._targetY, layer = 1;
            const change = getChange($gameMap.mapId(), x, y, layer);

            if (!change || (this._objectName && change.name !== this._objectName)) {
                SoundManager.playBuzzer();
                return;
            }

            if (requiresDestroyConfirmation(change.name)) {
                $gameMessage.setChoices([TextManager.commandYes, TextManager.commandNo], 0, 1);
                $gameMessage.setChoiceCallback(n => {
                    if (n === 0) this.executeDestroy(x, y, layer);
                });
            } else {
                this.executeDestroy(x, y, layer);
            }
        }

        executeDestroy(x, y, layer) {
            $gameTileControl.resetTile(x, y, layer);
            removeChange($gameMap.mapId(), x, y, layer);
            SoundManager.playOk();
            SceneManager.pop();
        }
    }

    PluginManager.registerCommand(PLUGIN_NAME, parameters['Place Command Name'], args => {
        const obj = getPlacementObject(args.objectName);
        if (obj) SceneManager.push(new Scene_PlacementMode('place', args.objectName, obj));
    });

    PluginManager.registerCommand(PLUGIN_NAME, parameters['Destroy Command Name'], args => {
        SceneManager.push(new Scene_PlacementMode('destroy', args.objectName || '', null));
    });

})();