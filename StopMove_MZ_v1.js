//=============================================================================
// StopMove_MZ_v2.js
//=============================================================================

/*:
 * @target MZ
 * @plugindesc [v1.0.0] Prevents the player character from moving onto map tiles with specific Region IDs.
 * @author OuttieTV
 *
 * @param Blocked Regions
 * @type string
 * @default 1,3-5,8
 * @desc A comma-separated list of Region IDs and ranges to block player movement (e.g., 1,3-5,8).
 *
 * @param Load From JSON
 * @type boolean
 * @default false
 * @on Load
 * @off Use Parameter
 * @desc If TRUE, the plugin loads the list from 'data/StopMove.json' and ignores the 'Blocked Regions' parameter.
 *
 * @help
 * ---------------------------------------------------------------------------
 * Plugin Command Reference
 * ---------------------------------------------------------------------------
 * This plugin has no direct plugin commands. Functionality is managed via
 * the Plugin Manager parameters.
 *
 * ---------------------------------------------------------------------------
 * Parameter Usage
 * ---------------------------------------------------------------------------
 * 1. **Blocked Regions:**
 * Enter a string of Region IDs and ranges, separated by commas (e.g., 1,3-5,8).
 * This parameter is ignored if 'Load From JSON' is set to TRUE.
 *
 * 2. **Load From JSON:**
 * - If set to **TRUE** ('Load'), the plugin will read the blocked regions list
 * from the predefined file **'data/StopMove.json'**.
 * - If set to **FALSE** ('Use Parameter'), the plugin uses the list
 * specified in the 'Blocked Regions' parameter.
 *
 * ---------------------------------------------------------------------------
 * JSON File Format Example (`data/StopMove.json`)
 * ---------------------------------------------------------------------------
 * The file must contain a single JSON array of numbers or strings
 * representing region IDs/ranges, placed in the project's `data/` folder.
 *
 * Example:
 * [
 * 1,
 * "3-5",
 * 8,
 * "10-12"
 * ]
 * ---------------------------------------------------------------------------
 * Compatibility
 * ---------------------------------------------------------------------------
 * This plugin only intercepts player movement (`Game_Player.prototype.canPass`).
 * It preserves the movement logic for all other events and vehicles.
 */

(() => {
    'use strict';

    const pluginName = 'StopMove_MZ_v1';
    const parameters = PluginManager.parameters(pluginName);
    const paramBlockedRegions = String(parameters['Blocked Regions'] || '');
    // Boolean parameter conversion
    const paramLoadJson = parameters['Load From JSON'] === 'true';
    const JSON_FILE_PATH = 'data/StopMove.json';

    // --- Core Logic: Parsing and Validation ---

    /**
     * Parses a string of comma-separated region IDs and ranges into a Set of numbers.
     * @param {string} listString - The input string (e.g., "1,3-5,8").
     * @returns {Set<number>} A Set of blocked Region IDs.
     */
    const parseRegionList = (listString) => {
        const blockedRegions = new Set();
        if (!listString) return blockedRegions;

        const parts = listString.split(',').map(part => part.trim()).filter(part => part.length > 0);

        for (const part of parts) {
            try {
                if (part.includes('-')) {
                    // Handle range (e.g., "3-5")
                    const rangeParts = part.split('-').map(p => parseInt(p, 10));
                    if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
                        const start = Math.min(rangeParts[0], rangeParts[1]);
                        const end = Math.max(rangeParts[0], rangeParts[1]);
                        for (let i = start; i <= end; i++) {
                            blockedRegions.add(i);
                        }
                    } else {
                        console.error(`${pluginName}: Malformed range part ignored: ${part}`);
                    }
                } else {
                    // Handle single ID (e.g., "1" or "8")
                    const regionId = parseInt(part, 10);
                    if (!isNaN(regionId) && regionId >= 0) {
                        blockedRegions.add(regionId);
                    } else {
                        console.error(`${pluginName}: Malformed single ID part ignored: ${part}`);
                    }
                }
            } catch (e) {
                console.error(`${pluginName}: Failed to parse part "${part}". Error: ${e.message}`);
            }
        }
        return blockedRegions;
    };

    /**
     * Converts a raw array (from JSON) of numbers/strings (IDs/ranges) into a Set.
     * @param {Array<number|string>} rawArray - The array loaded from the JSON file.
     * @returns {Set<number>} A Set of blocked Region IDs.
     */
    const convertJsonArrayToSet = (rawArray) => {
        if (!Array.isArray(rawArray)) {
            console.error(`${pluginName}: JSON file content is not a valid array. Falling back to an empty list.`);
            return new Set();
        }
        // Convert array content to the expected comma-separated string format for reuse of parseRegionList
        const listString = rawArray.map(item => String(item).trim()).join(',');
        return parseRegionList(listString);
    };

    // --- Global State Management ---

    let $blockedRegions = new Set();

    /**
     * Loads the blocked region list, either from GUI parameter or predefined JSON file.
     */
    const loadBlockedRegions = async () => {
        $blockedRegions = new Set(); // Reset the list

        if (paramLoadJson) {
            // Load from predefined JSON file
            try {
                const url = JSON_FILE_PATH;
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const rawJson = await response.json();
                $blockedRegions = convertJsonArrayToSet(rawJson);
                console.info(`${pluginName}: Successfully loaded ${$blockedRegions.size} blocked regions from JSON: ${url}`);
            } catch (e) {
                console.error(`${pluginName}: Failed to load/parse JSON file "${JSON_FILE_PATH}". Error: ${e.message}. Falling back to an empty list.`);
            }
        } else {
            // Load from GUI parameter
            $blockedRegions = parseRegionList(paramBlockedRegions);
            console.info(`${pluginName}: Loaded ${$blockedRegions.size} blocked regions from GUI parameter.`);
        }
    };

    // --- Plugin Hooks (MZ Core Overrides) ---

    // 1. Initial Load and New Game Load
    const _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.call(this);
        loadBlockedRegions(); // Load on game start
    };

    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function() {
        _DataManager_setupNewGame.call(this);
        loadBlockedRegions(); // Load on new game
    };

    // 2. Intercept Player Movement
    const _Game_Player_canPass = Game_Player.prototype.canPass;
    Game_Player.prototype.canPass = function(x, y, d) {
        // Calculate the destination coordinates
        const x2 = $gameMap.roundXWithDirection(x, d);
        const y2 = $gameMap.roundYWithDirection(y, d);

        // Get the Region ID of the destination tile
        const destRegionId = $gameMap.regionId(x2, y2);

        // Check if the destination region ID is in our blocked set
        if ($blockedRegions.has(destRegionId)) {
            // Log when movement is blocked (optional, for debugging)
            // console.info(`${pluginName}: Player movement blocked to tile (${x2}, ${y2}) with Region ID ${destRegionId}.`);
            return false; // Block movement
        }

        // If not blocked by this plugin, defer to the original logic
        return _Game_Player_canPass.call(this, x, y, d);
    };

})();