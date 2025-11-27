/*:
 * @target MZ
 * @plugindesc A complete fishing system with a timed bar mini-game and optional JSON data loading.
 * @author OuttieTV
 *
 * @param loadJson
 * @type boolean
 * @text Load JSON
 * @desc If true, fish data is loaded from data/FishData.json. If false, built-in data is used.
 * @default false
 *
 * @param regionFreshwater
 * @type number
 * @min 1
 * @text Freshwater Region ID
 * @desc Map Region ID corresponding to freshwater bodies (e.g., lakes, ponds).
 * @default 10
 *
 * @param regionRiver
 * @type number
 * @min 1
 * @text River Region ID
 * @desc Map Region ID corresponding to rivers or streams.
 * @default 11
 *
 * @param regionOcean
 * @type number
 * @min 1
 * @text Ocean/Saltwater Region ID
 * @desc Map Region ID corresponding to oceans or seas.
 * @default 12
 *
 * @param FishData
 * @type struct<FishData>[]
 * @text Built-in Fish Data
 * @desc Define fish, their item IDs, habitat, and base drop chance (0-100). Used if Load JSON is false or if JSON loading fails.
 * @default []
 *
 * @help
 * ===========================================================================
 * Plugin: FishingSystem
 * Author: Gemini
 * ---------------------------------------------------------------------------
 * * This plugin implements a comprehensive fishing system for RPG Maker MZ.
 * * **Features:**
 * - Configurable fish habitats using Map Region IDs.
 * - Supports loading fish data from built-in parameters or an external 
 * 'data/FishData.json' file.
 * - Simple "timed bar" mini-game to determine catch success chance.
 * - Adds a caught fish item directly to the party inventory.
 * * **How to Use:**
 * * 1. **Setup Fish Items:** Create the corresponding "Fish" items in your 
 * database and note their Item IDs.
 * 2. **Configure Regions:** Set the Region IDs for Freshwater, River, and Ocean 
 * in the plugin parameters. Place these Region IDs on your maps.
 * 3. **Define Fish Data:** Fill out the built-in Fish Data or prepare your 
 * 'data/FishData.json' file.
 * * **Plugin Commands:**
 * * To start fishing, use the 'Cast' command. This initiates the mini-game.
 * The 'Catch' command is typically called *after* the mini-game resolves (e.g., 
 * in a Common Event triggered by the mini-game scene closing) to process the 
 * catch and update inventory.
 * * ===========================================================================
 * * @command Cast
 * @text Cast Fishing Line
 * @desc Initiates the fishing attempt, checks the current region, and starts the mini-game.
 *
 * @command Catch
 * @text Resolve Catch
 * @desc Resolves the catch based on the mini-game result, adds the item to the inventory, and shows a message.
 *
 * @command Stop
 * @text Abort Fishing
 * @desc Immediately stops the active fishing process without resolving a catch.
 */
/*~struct~FishData:
 * @param name
 * @type string
 * @text Fish Name
 * @desc The display name of the fish.
 *
 * @param itemId
 * @type number
 * @min 1
 * @text Item ID
 * @desc The database Item ID that is added to the inventory upon catching.
 *
 * @param type
 * @type select
 * @option freshwater
 * @option river
 * @option saltwater
 * @text Habitat Type
 * @desc The type of water this fish is found in.
 * @default freshwater
 *
 * @param dropChance
 * @type number
 * @min 0
 * @max 100
 * @text Base Drop Chance (%)
 * @desc Base percent chance (0-100) to catch this fish in its matching region.
 * @default 50
 */

(function() {
    'use strict';

    // --- Plugin Parameters and Data Loading ---
    const PLUGIN_NAME = 'FishingSystem_MZ_v1';
    const parameters = PluginManager.parameters(PLUGIN_NAME);

    const params = {
        loadJson: String(parameters.loadJson) === 'true',
        regionFreshwater: parseInt(parameters.regionFreshwater || 10),
        regionRiver: parseInt(parameters.regionRiver || 11),
        regionOcean: parseInt(parameters.regionOcean || 12),
        builtInFishData: JSON.parse(parameters.FishData || '[]').map(data => {
            const parsed = JSON.parse(data);
            return {
                name: parsed.name,
                itemId: parseInt(parsed.itemId),
                type: parsed.type,
                dropChance: parseInt(parsed.dropChance)
            };
        })
    };

    let _fishData = params.builtInFishData;
    let _activeHabitat = null; // Stores the current habitat type
    let _catchSuccessRate = 0; // Success rate from 0.0 to 1.0 determined by mini-game
    let _caughtFish = null; // The specific fish object caught

    // Validates region IDs
    if (params.regionFreshwater <= 0 || params.regionRiver <= 0 || params.regionOcean <= 0) {
        throw new Error(`[${PLUGIN_NAME}] Region IDs must be positive integers.`);
    }

    /**
     * Loads fish data from data/FishData.json if enabled.
     */
    function loadExternalData() {
        if (!params.loadJson) return;

        const path = 'data/FishData.json';
        const xhr = new XMLHttpRequest();
        xhr.open('GET', path);
        xhr.overrideMimeType('application/json');
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (Array.isArray(data)) {
                        _fishData = data;
                        console.log(`[${PLUGIN_NAME}] Loaded fish data from ${path}`);
                    } else {
                        console.warn(`[${PLUGIN_NAME}] FishData.json is not an array. Using built-in data.`);
                    }
                } catch (e) {
                    console.error(`[${PLUGIN_NAME}] Error parsing FishData.json: ${e}. Using built-in data.`);
                }
            } else {
                console.warn(`[${PLUGIN_NAME}] Failed to load ${path}. Status: ${xhr.status}. Using built-in data.`);
            }
        };
        xhr.onerror = function() {
            console.error(`[${PLUGIN_NAME}] Network error loading ${path}. Using built-in data.`);
        };
        xhr.send();
    }

    // Call this before loading the map data
    loadExternalData();
    
    // Global variable to hold mini-game status/result for access across scenes
    window.FishingSystem = window.FishingSystem || {};
    window.FishingSystem.CatchSuccessRate = 0; // Global success rate (0.0 - 1.0)
    window.FishingSystem.IsFishingActive = false;

    // --- Mini-game Scene ---

    /**
     * A simple scene for the timed bar mini-game.
     */
    class Scene_FishingMinigame extends Scene_Base {
        create() {
            super.create();
            this._gameDuration = 180; // Total frames for the bar to cycle
            this._elapsedTime = 0;
            this._isSuccess = false;
            this._isStopped = false;
            this._successMultiplier = 0; // 0.0 to 1.0 based on stop position
            this._barSprite = new Sprite_FishingBar();
            this.addChild(this._barSprite);
        }

        start() {
            super.start();
        }

        update() {
            super.update();
            if (this._isStopped) {
                this.updateSuccessRate();
                this.terminateMinigame();
                return;
            }

            this._elapsedTime++;
            const cycleTime = this._gameDuration / 2; // Time to go one way (e.g., 90 frames)

            // Normalized position (0.0 to 1.0)
            let normalizedPos;
            const t = this._elapsedTime % this._gameDuration;

            if (t <= cycleTime) {
                // Moving right (0 to 1)
                normalizedPos = t / cycleTime;
            } else {
                // Moving left (1 to 0)
                normalizedPos = 1 - ((t - cycleTime) / cycleTime);
            }

            this._barSprite.updatePosition(normalizedPos);

            if (Input.isTriggered('ok') || TouchInput.isTriggered()) {
                this._isStopped = true;
            }
        }

        /**
         * Calculates the success multiplier based on where the indicator stopped.
         */
        updateSuccessRate() {
            const pos = this._barSprite.indicatorPosition; // 0.0 to 1.0
            const center = 0.5;
            const distance = Math.abs(pos - center);
            
            // Formula: Success is 1.0 at center (distance 0), 0.0 at edges (distance 0.5)
            // success = 1.0 - (distance / 0.5) = 1.0 - (distance * 2)
            this._successMultiplier = Math.max(0, 1.0 - (distance * 2));
            
            // Store the final success rate globally
            window.FishingSystem.CatchSuccessRate = this._successMultiplier;
        }

        /**
         * Closes the mini-game scene.
         */
        terminateMinigame() {
            SceneManager.pop();
            // Optional: Start a Common Event here if needed for post-minigame logic
        }
    }

    // --- Mini-game Graphics Sprite ---

    /**
     * Sprite for the fishing bar mini-game.
     */
    class Sprite_FishingBar extends Sprite {
        constructor() {
            super();
            this.width = 400;
            this.height = 40;
            this.bitmap = new Bitmap(this.width, this.height);
            this.anchor.x = 0.5;
            this.anchor.y = 0.5;
            this.x = Graphics.width / 2;
            this.y = Graphics.height / 2;
            this._normalizedPos = 0; // 0.0 to 1.0
            this.drawGauge();
        }

        /**
         * Draws the static background of the gauge.
         */
        drawGauge() {
            const b = this.bitmap;
            b.clear();

            // Background of the gauge (the bar)
            b.fillRect(0, 0, this.width, this.height, 'rgba(0, 0, 0, 0.7)');

            // Success Zone (center)
            const successWidth = this.width * 0.4; // 40% in the middle
            const successX = (this.width - successWidth) / 2;
            b.fillRect(successX, 0, successWidth, this.height, 'rgba(0, 255, 0, 0.5)');

            // Target Zone (exact center line)
            b.fillRect(this.width / 2 - 2, 0, 4, this.height, 'rgba(255, 255, 0, 1)');
        }

        /**
         * Updates the position of the moving indicator.
         * @param {number} normalizedPos - A value from 0.0 (left) to 1.0 (right).
         */
        updatePosition(normalizedPos) {
            this._normalizedPos = normalizedPos;
            this.bitmap.clearRect(0, 0, this.width, this.height);
            this.drawGauge();
            this.drawIndicator();
        }
        
        get indicatorPosition() {
            return this._normalizedPos;
        }

        /**
         * Draws the moving indicator.
         */
        drawIndicator() {
            const b = this.bitmap;
            const indicatorWidth = 10;
            const indicatorX = Math.round(this._normalizedPos * (this.width - indicatorWidth));
            
            // Moving Indicator
            b.fillRect(indicatorX, 0, indicatorWidth, this.height, 'rgba(255, 0, 0, 1)');
        }
    }

    // --- Plugin Commands ---

    /**
     * Determines the fishing habitat based on the player's current region ID.
     * @returns {string|null} The habitat type ("freshwater", "river", "saltwater") or null.
     */
    function getCurrentHabitat() {
        if (!$gamePlayer) return null;
        const regionId = $gamePlayer.regionId();
        
        if (regionId === params.regionFreshwater) {
            return 'freshwater';
        } else if (regionId === params.regionRiver) {
            return 'river';
        } else if (regionId === params.regionOcean) {
            return 'saltwater';
        }
        return null; // Not a fishing spot
    }

    PluginManager.registerCommand(PLUGIN_NAME, 'Cast', args => {
        _activeHabitat = getCurrentHabitat();

        if (!_activeHabitat) {
            $gameMessage.add("You can't fish here.");
            return;
        }
        
        window.FishingSystem.IsFishingActive = true;
        _catchSuccessRate = 0; // Reset
        _caughtFish = null; // Reset

        $gameMessage.add(`You started fishing [${_activeHabitat}].`);
        
        // Start the mini-game scene
        SceneManager.push(Scene_FishingMinigame);
    });

    PluginManager.registerCommand(PLUGIN_NAME, 'Catch', args => {
        if (!window.FishingSystem.IsFishingActive) {
            console.warn(`[${PLUGIN_NAME}] 'Catch' command called when fishing is not active.`);
            return;
        }

        window.FishingSystem.IsFishingActive = false;

        // Get success rate from the mini-game result
        const minigameSuccessRate = window.FishingSystem.CatchSuccessRate;
        const fishList = _fishData.filter(fish => fish.type === _activeHabitat);

        if (fishList.length === 0) {
            $gameMessage.add(`Nothing seems to be biting here.`);
            return;
        }

        // --- Catch Logic ---
        let totalDropChance = fishList.reduce((sum, fish) => sum + fish.dropChance, 0);
        let catchAttempt = Math.random() * totalDropChance;
        let caughtFishCandidate = null;

        // Determine which fish is 'hooked' based on drop chances
        for (const fish of fishList) {
            if (catchAttempt < fish.dropChance) {
                caughtFishCandidate = fish;
                break;
            }
            catchAttempt -= fish.dropChance;
        }

        if (!caughtFishCandidate) {
            // Should not happen if totalDropChance > 0, but as a safeguard
             $gameMessage.add(`Nothing seems to be biting here.`);
            return;
        }
        
        // The probability of a successful catch is the base drop chance of the 
        // hooked fish, multiplied by the mini-game success rate.
        const finalCatchChance = (caughtFishCandidate.dropChance / 100) * minigameSuccessRate;
        const successRoll = Math.random();

        if (successRoll < finalCatchChance) {
            _caughtFish = caughtFishCandidate;
            $gameParty.gainItem($dataItems[_caughtFish.itemId], 1);
            $gameMessage.add(`You caught a ${_caughtFish.name}.`);
        } else {
            $gameMessage.add("It got away...");
        }
        
        _activeHabitat = null; // Reset habitat
        _caughtFish = null; // Reset fish
    });
    
    PluginManager.registerCommand(PLUGIN_NAME, 'Stop', args => {
        if (window.FishingSystem.IsFishingActive) {
            window.FishingSystem.IsFishingActive = false;
            _activeHabitat = null;
            _catchSuccessRate = 0;
            _caughtFish = null;
            $gameMessage.add("You reeled in your line.");

            // If the mini-game is currently active, pop the scene
            if (SceneManager.isCurrentSceneInstanceOf(Scene_FishingMinigame)) {
                SceneManager.pop();
            }
        }
    });
})();