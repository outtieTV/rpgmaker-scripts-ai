/*:
 * @target MZ
 * @plugindesc [CustomPlacement] Allows players to place and destroy objects (tile changes) during gameplay, with persistence and Region ID limits.
 * @author Gemini
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
 * @desc Comma-separated list/range of Region IDs where placement is allowed globally (e.g., "2-5, 10"). Use 0 for no region restriction.
 *
 * @param Grid Color
 * @type string
 * @default #00FF00
 * @desc Hex color for the placement grid overlay (e.g., #FF0000 for red).
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
 * This plugin adds player-accessible commands for placing and destroying
 * persistent objects (tile changes) on the map. It also hooks into Shaz's
 * TileChanger plugin to make its changes permanent across save/load cycles.
 *
 * Requires Shaz's TileChanger.js plugin to be installed and active.
 *
 * ===========================================================================
 * Region ID Support
 * ===========================================================================
 *
 * Placement can be restricted using **Region IDs**.
 *
 * 1. **Global Restriction:** Use the **Global Placement Regions** parameter
 * to restrict placement of ALL objects to specific regions on ANY map.
 * Example: "5, 10-15". (Use 0 to allow all regions).
 *
 * 2. **Per-Object Restriction:** If you load settings from JSON, you can add
 * a "regions" key to a placeable object to override the global setting.
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
 * @desc The internal name of the object/tile to be placed (e.g., "Chest").
 * Must match an entry in the placement configuration.
 *
 * @command Destroy
 * @text Destroy Object Mode
 * @desc Enters the object destruction mode.
 *
 * @arg objectName
 * @type string
 * @default
 * @desc The internal name of the object/tile to be destroyed (e.g., "Chest").
 * If left empty, any valid tile change can be destroyed.
 *
 * ===========================================================================
 * JSON file format example (Updated)
 * ===========================================================================
 *
 * {
 * "destroyConfirm": ["Chest", "Door"],
 * "placeableObjects": [
 * { "id": 1, "name": "Chest", "tileId": 1234, "layer": 1, **"regions": "1, 2-5"** },
 * { "id": 2, "name": "Statue", "tileId": 5678, "layer": 2 }
 * ]
 * }
 *
 */

// Global variable to hold custom tile changes that should persist
var $customTileChanges = $customTileChanges || {};

(function() {
    'use strict';

    const PLUGIN_NAME = 'CustomPlacement';
    const parameters = PluginManager.parameters(PLUGIN_NAME);

    // --- Plugin Parameters and Configuration Loading ---

    const LOAD_FROM_JSON = parameters['Load Settings From JSON'] === 'true';
    const CONFIG_JSON_PATH = parameters['Config JSON Path'];
    const GRID_COLOR = parameters['Grid Color'] || '#00FF00';
    const GRID_OPACITY = parseFloat(parameters['Grid Opacity'] || 0.5);
    // Parse global region restrictions from the new parameter
    const GLOBAL_REGIONS_RAW = String(parameters['Global Placement Regions'] || '0').trim();

    let config = {
        destroyConfirm: [],
        placeableObjects: []
    };

    /**
     * Parses a string of region IDs and ranges (e.g., "1, 5-8, 12") into a Set of allowed IDs.
     * @param {string} regionsString - The string of regions.
     * @returns {Set<number>} A set of allowed Region IDs.
     */
    const parseRegionString = (regionsString) => {
        const allowedRegions = new Set();
        if (regionsString === '0') {
            return allowedRegions; // Empty set means "no specific restriction"
        }
        const parts = regionsString.split(',').map(s => s.trim()).filter(s => s.length > 0);

        for (const part of parts) {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(Number);
                for (let i = start; i <= end; i++) {
                    allowedRegions.add(i);
                }
            } else {
                allowedRegions.add(Number(part));
            }
        }
        return allowedRegions;
    };

    // Pre-calculate the set for global restrictions
    const GLOBAL_ALLOWED_REGIONS = parseRegionString(GLOBAL_REGIONS_RAW);

    /**
     * Finds the placement object configuration by its unique name.
     * @param {string} name - The name of the object (e.g., "Chest").
     * @returns {object|null} The object configuration or null.
     */
    const getPlacementObject = (name) => {
        return config.placeableObjects.find(obj => obj.name === name) || null;
    };

    /**
     * Checks if a given tile's Region ID is allowed for placement.
     * @param {number} regionId - The Region ID of the tile.
     * @param {object|null} placementObj - The configuration object (may contain per-object region limits).
     * @returns {boolean} True if the Region ID is allowed.
     */
    const isRegionAllowed = (regionId, placementObj) => {
        let allowedRegions = GLOBAL_ALLOWED_REGIONS;

        // Check for per-object override from JSON
        if (placementObj && placementObj.regions) {
            // If the object specifies regions, use those instead of the global list
            allowedRegions = parseRegionString(String(placementObj.regions));
        }

        // If the allowedRegions set is empty (meaning global/object setting was '0'), 
        // there is no region restriction, so placement is allowed everywhere.
        if (allowedRegions.size === 0) {
            return true;
        }

        // Check if the tile's Region ID is in the allowed set.
        return allowedRegions.has(regionId);
    };

    /**
     * Checks if an object requires confirmation before destruction.
     * @param {string} name - The name of the object.
     * @returns {boolean} True if confirmation is required.
     */
    const requiresDestroyConfirmation = (name) => {
        return config.destroyConfirm.includes(name);
    };

    /**
     * Loads the external JSON configuration file.
     * @param {string} path - The path to the JSON file.
     * @returns {Promise<object>} A promise that resolves with the parsed JSON data.
     */
    const loadConfigJSON = async (path) => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', path);
            xhr.overrideMimeType('application/json');
            xhr.onload = () => {
                if (xhr.status < 400) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve(data);
                    } catch (e) {
                        console.error(`[${PLUGIN_NAME}] Failed to parse config JSON file: ${path}`, e);
                        reject(e);
                    }
                } else {
                    console.error(`[${PLUGIN_NAME}] Failed to load config JSON file: ${path}`, xhr.status);
                    reject(new Error(`Status ${xhr.status}`));
                }
            };
            xhr.onerror = () => {
                console.error(`[${PLUGIN_NAME}] Network error loading config JSON file: ${path}`);
                reject(new Error('Network Error'));
            };
            xhr.send();
        });
    };

    // Wait for the Scene_Boot to load the configuration
    const _Scene_Boot_onLoad = Scene_Boot.prototype.onLoad;
    Scene_Boot.prototype.onLoad = function() {
        if (LOAD_FROM_JSON) {
            loadConfigJSON(CONFIG_JSON_PATH)
                .then(data => {
                    config = Object.assign(config, data);
                    _Scene_Boot_onLoad.call(this);
                })
                .catch(error => {
                    console.error(`[${PLUGIN_NAME}] Falling back to internal settings due to JSON load error.`, error);
                    _Scene_Boot_onLoad.call(this); // Proceed with default config if load fails
                });
        } else {
            // Placeholder for internal configuration if needed, otherwise uses default empty config
            _Scene_Boot_onLoad.call(this);
        }
    };

    // --- Persistent Tile Changes ($customTileChanges) Management ---

    /**
     * Gets the map-specific tile changes object from the global container.
     * @param {number} mapId - The ID of the map.
     * @returns {object} The map-specific tile changes.
     */
    const getMapChanges = (mapId) => {
        if (!$customTileChanges[mapId]) {
            $customTileChanges[mapId] = {};
        }
        return $customTileChanges[mapId];
    };

    /**
     * Stores a custom tile change.
     * @param {number} mapId - The ID of the map.
     * @param {number} x - The X coordinate.
     * @param {number} y - The Y coordinate.
     * @param {number} layer - The layer (0-3) to change.
     * @param {number} tileId - The new Tile ID.
     * @param {string} name - The name of the object for future confirmation checks.
     */
    const storeChange = (mapId, x, y, layer, tileId, name) => {
        const changes = getMapChanges(mapId);
        const key = `${x},${y},${layer}`;
        changes[key] = { tileId: tileId, name: name };
    };

    /**
     * Removes a custom tile change.
     * @param {number} mapId - The ID of the map.
     * @param {number} x - The X coordinate.
     * @param {number} y - The Y coordinate.
     * @param {number} layer - The layer (0-3) to remove from.
     * @returns {object|null} The removed change object or null.
     */
    const removeChange = (mapId, x, y, layer) => {
        const changes = getMapChanges(mapId);
        const key = `${x},${y},${layer}`;
        const change = changes[key];
        if (change) {
            delete changes[key];
            return change;
        }
        return null;
    };

    /**
     * Retrieves a custom tile change.
     * @param {number} mapId - The ID of the map.
     * @param {number} x - The X coordinate.
     * @param {number} y - The Y coordinate.
     * @param {number} layer - The layer (0-3) to check.
     * @returns {object|null} The change object or null.
     */
    const getChange = (mapId, x, y, layer) => {
        const changes = getMapChanges(mapId);
        const key = `${x},${y},${layer}`;
        return changes[key] || null;
    };

    // --- Hook into Shaz's TileChanger.js for Persistence ---

    // Ensure the required function from TileChanger.js exists before patching
    if (typeof $gameMap.getTileChangeData === 'function') {
        const _Game_Map_setup = Game_Map.prototype.setup;
        Game_Map.prototype.setup = function(mapId) {
            _Game_Map_setup.call(this, mapId);

            // Apply persistent custom changes after the map is set up
            const changes = getMapChanges(mapId);
            for (const key in changes) {
                if (changes.hasOwnProperty(key)) {
                    const parts = key.split(',');
                    const x = parseInt(parts[0]);
                    const y = parseInt(parts[1]);
                    const layer = parseInt(parts[2]);
                    const change = changes[key];

                    // Use TileChanger's built-in function to apply the change
                    this.setTileChangeData(x, y, layer, change.tileId);
                }
            }
        };
    } else {
        console.warn(`[${PLUGIN_NAME}] Shaz's TileChanger.js does not appear to be loaded or is not exporting 'setTileChangeData'. Persistence feature will not work.`);
    }

    // Hook into the Data Manager for global variable persistence
    const _DataManager_makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function() {
        const contents = _DataManager_makeSaveContents.call(this);
        contents.customTileChanges = $customTileChanges; // Save the global changes
        return contents;
    };

    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        _DataManager_extractSaveContents.call(this, contents);
        $customTileChanges = contents.customTileChanges || {}; // Load the global changes
    };

    // --- Placement/Destruction Scene (Scene_PlacementMode) ---

    class Sprite_Grid extends Sprite {
        /**
         * Creates a grid overlay for the player to see placement boundaries.
         * @param {number} width - Map width in tiles.
         * @param {number} height - Map height in tiles.
         * @param {string} color - Hex color string.
         * @param {number} opacity - Opacity (0.0 to 1.0).
         */
        constructor(width, height, color, opacity) {
            super();
            this.anchor.x = 0;
            this.anchor.y = 0;
            const tileSize = $gameMap.tileWidth();
            this.bitmap = new Bitmap(width * tileSize, height * tileSize);
            this.opacity = opacity * 255;
            this.visible = false;

            this._drawGrid(width, height, tileSize, color);
        }

        _drawGrid(width, height, tileSize, color) {
            const context = this.bitmap.context;
            context.strokeStyle = color;
            context.lineWidth = 1;

            // Draw vertical lines
            for (let i = 0; i <= width; i++) {
                context.beginPath();
                context.moveTo(i * tileSize, 0);
                context.lineTo(i * tileSize, height * tileSize);
                context.stroke();
            }

            // Draw horizontal lines
            for (let j = 0; j <= height; j++) {
                context.beginPath();
                context.moveTo(0, j * tileSize);
                context.lineTo(width * tileSize, j * tileSize);
                context.stroke();
            }

            this.bitmap._setDirty();
        }
    }


    class Scene_PlacementMode extends Scene_Map {
        /**
         * Custom scene for handling placement/destruction input.
         * @param {string} mode - 'place' or 'destroy'.
         * @param {string} objectName - The specific object name being placed/destroyed.
         * @param {object|null} placementObj - The configuration object for placement, or null for destruction.
         */
        constructor(mode, objectName, placementObj) {
            super();
            this._mode = mode;
            this._objectName = objectName;
            this._placementObj = placementObj;
            this._cursorSprite = null;
            this._gridSprite = null;
            this._targetX = -1;
            this._targetY = -1;
            this._isBusy = false; // For blocking input during confirmation
        }

        create() {
            super.create();
            this.createGridOverlay();
            this.createCursorSprite();
            $gamePlayer.center($gamePlayer.x, $gamePlayer.y);
            $gameMap.updateEvents(); // Ensure map updates after setup
        }

        start() {
            super.start();
            this._gridSprite.visible = true;
            this._cursorSprite.visible = true;
            this.updateCursorPosition();
            // Start the cursor on the tile the player is facing
            this.moveCursorToPlayerDirection();
        }

        stop() {
            super.stop();
            this._gridSprite.visible = false;
            this._cursorSprite.visible = false;
        }

        terminate() {
            super.terminate();
            // Clean up sprites
            if (this._gridSprite) this._spriteset.removeChild(this._gridSprite);
            if (this._cursorSprite) this._spriteset.removeChild(this._cursorSprite);
        }

        createGridOverlay() {
            const mapW = $gameMap.width();
            const mapH = $gameMap.height();
            this._gridSprite = new Sprite_Grid(mapW, mapH, GRID_COLOR, GRID_OPACITY);
            this._spriteset.addChild(this._gridSprite); // Add to spriteset
        }

        createCursorSprite() {
            const tileSize = $gameMap.tileWidth();
            this._cursorSprite = new Sprite();
            this._cursorSprite.bitmap = new Bitmap(tileSize, tileSize);
            this._cursorSprite.bitmap.fillRect(0, 0, tileSize, tileSize, GRID_COLOR);
            this._cursorSprite.opacity = 180;
            this._spriteset.addChild(this._cursorSprite);
        }

        update() {
            super.update();
            if (!this._isBusy) {
                this.updateInput();
            }
            this.updateCursorPosition();
            this.updateMapScroll();
        }

        /**
         * Moves the cursor to the tile in the player's current direction.
         */
        moveCursorToPlayerDirection() {
            this._targetX = $gamePlayer.x + $gamePlayer.directionX();
            this._targetY = $gamePlayer.y + $gamePlayer.directionY();
            this.updateCursorPosition();
        }

        /**
         * Updates the screen position of the cursor sprite based on map scroll.
         */
        updateCursorPosition() {
            const x = $gameMap.adjustX(this._targetX) * $gameMap.tileWidth();
            const y = $gameMap.adjustY(this._targetY) * $gameMap.tileHeight();
            this._cursorSprite.x = Math.round(x);
            this._cursorSprite.y = Math.round(y);
        }

        /**
         * Manually update the map scroll based on cursor position to keep it in view.
         */
        updateMapScroll() {
            $gameMap.setDisplayPos($gameMap.adjustX(this._targetX) - 4, $gameMap.adjustY(this._targetY) - 3);
        }

        /**
         * Handles player input for movement, cancellation, and action.
         */
        updateInput() {
            const dx = Input.isTriggered('right') ? 1 : Input.isTriggered('left') ? -1 : 0;
            const dy = Input.isTriggered('down') ? 1 : Input.isTriggered('up') ? -1 : 0;

            if (dx !== 0 || dy !== 0) {
                this._targetX = $gameMap.roundX(this._targetX + dx);
                this._targetY = $gameMap.roundY(this._targetY + dy);
                SoundManager.playCursor();
            }

            if (Input.isTriggered('cancel') || TouchInput.isCancelled()) {
                SoundManager.playCancel();
                this.endPlacementMode();
            } else if (Input.isTriggered('ok') || TouchInput.isTriggered()) {
                if (this._mode === 'place') {
                    this.tryPlaceObject(this._targetX, this._targetY);
                } else if (this._mode === 'destroy') {
                    this.tryDestroyObject(this._targetX, this._targetY);
                }
            }
        }

        /**
         * Checks if the target tile is occupied or in an invalid region.
         * @param {number} x - Target map X.
         * @param {number} y - Target map Y.
         * @returns {boolean} True if the tile is occupied or placement is invalid.
         */
        isTileOccupied(x, y) {
            // Check for region restriction
            const regionId = $gameMap.regionId(x, y);
            if (!isRegionAllowed(regionId, this._placementObj)) {
                $gameMessage.add(`Placement failed: Region ID ${regionId} is not allowed for this object.`);
                return true;
            }

            // Check for events
            if ($gameMap.eventsXy(x, y).length > 0) {
                $gameMessage.add(`Placement failed: Target tile is occupied by an event.`);
                return true;
            }

            // Check for impassable tiles (basic passability check)
            if (!$gameMap.isPassable(x, y, 2)) { // Direction 2 (down) is a good general check
                $gameMessage.add(`Placement failed: Target tile is impassable.`);
                return true;
            }

            // Check for existing custom changes at the object layer (layer 1)
            // This prevents placing an object over another placed object
            if (getChange($gameMap.mapId(), x, y, 1)) {
                $gameMessage.add(`Placement failed: Another custom object already exists here.`);
                return true;
            }

            return false;
        }

        /**
         * Attempts to place the configured object on the map.
         * @param {number} x - Target map X.
         * @param {number} y - Target map Y.
         */
        tryPlaceObject(x, y) {
            if (this.isTileOccupied(x, y)) {
                SoundManager.playBuzzer();
                return;
            }

            const mapId = $gameMap.mapId();
            const tileId = this._placementObj.tileId;
            // Default to layer 1 (Object/Middle layer)
            const layer = this._placementObj.layer !== undefined ? this._placementObj.layer : 1;

            // 1. Apply the change immediately using TileChanger
            $gameMap.setTileChangeData(x, y, layer, tileId);
            // 2. Store the change for persistence across save/load
            storeChange(mapId, x, y, layer, tileId, this._objectName);

            SoundManager.playShop();
            this.endPlacementMode();
        }

        /**
         * Attempts to destroy an object (revert a tile change).
         * @param {number} x - Target map X.
         * @param {number} y - Target map Y.
         */
        tryDestroyObject(x, y) {
            // Destruction primarily targets the Object/Middle layer (layer 1)
            const mapId = $gameMap.mapId();
            const layer = 1; // Assume destruction targets the object layer
            const change = getChange(mapId, x, y, layer);

            if (!change) {
                SoundManager.playBuzzer();
                $gameMessage.add(`Destruction failed: No custom object found at (${x}, ${y}).`);
                return;
            }

            // Check if a specific object name was requested for destruction
            if (this._objectName && this._objectName !== change.name) {
                SoundManager.playBuzzer();
                $gameMessage.add(`Destruction failed: Object found is '${change.name}', but was trying to destroy '${this._objectName}'.`);
                return;
            }

            const originalTileId = $gameMap.originalTileId(x, y, layer);

            // Check for confirmation requirement
            if (requiresDestroyConfirmation(change.name)) {
                this._isBusy = true;
                $gameMessage.setChoices([TextManager.commandYes, TextManager.commandNo], 0, 1);
                $gameMessage.setChoiceCallback(responseIndex => {
                    this._isBusy = false;
                    if (responseIndex === 0) { // Yes
                        this.executeDestroy(x, y, layer, originalTileId, mapId);
                        SoundManager.playOk();
                        this.endPlacementMode();
                    } else { // No/Cancel
                        SoundManager.playCancel();
                        // Stay in destruction mode
                    }
                });
            } else {
                this.executeDestroy(x, y, layer, originalTileId, mapId);
                SoundManager.playOk();
                this.endPlacementMode();
            }
        }

        /**
         * Executes the destruction of the tile change.
         */
        executeDestroy(x, y, layer, originalTileId, mapId) {
            // 1. Revert the change immediately using TileChanger (set back to original tile)
            $gameMap.setTileChangeData(x, y, layer, originalTileId);
            // 2. Remove the persistence data
            removeChange(mapId, x, y, layer);
        }

        /**
         * Exits the custom scene and returns to the normal map scene.
         */
        endPlacementMode() {
            this.popScene();
            $gamePlayer.center($gamePlayer.x, $gamePlayer.y); // Recenter player camera
            $gameMap.updateEvents(); // Ensure events are updated after scene change
        }
    }

    // --- Plugin Command Definitions ---

    // Place Command
    PluginManager.registerCommand(PLUGIN_NAME, parameters['Place Command Name'], args => {
        const objectName = args.objectName;
        const placementObj = getPlacementObject(objectName);

        if (!placementObj) {
            console.error(`[${PLUGIN_NAME}]: Could not find placement configuration for object: ${objectName}`);
            $gameMessage.add(`Error: Placement object '${objectName}' not configured.`);
            return;
        }

        if (SceneManager.isCurrentSceneSequence()) {
            $gameMessage.add("Cannot enter placement mode during a message or choice.");
            return;
        }

        SceneManager.push(new Scene_PlacementMode('place', objectName, placementObj));
    });

    // Destroy Command
    PluginManager.registerCommand(PLUGIN_NAME, parameters['Destroy Command Name'], args => {
        const objectName = args.objectName || ''; // Optional: name of the object to destroy

        if (SceneManager.isCurrentSceneSequence()) {
            $gameMessage.add("Cannot enter destruction mode during a message or choice.");
            return;
        }

        // Pass null for placementObj since we are destroying
        SceneManager.push(new Scene_PlacementMode('destroy', objectName, null));
    });

})();