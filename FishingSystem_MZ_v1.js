/*:
 * @target MZ
 * @plugindesc v1.0.0 - Fishing system with vertical gauge minigame. Loads config from data/FishingConfig.json. Ready for js/plugins/.
 * @author OuttieTV (adapted)
 *
 * @command FishingSystemTest
 * @text FishingSystemTest
 * @desc Force-start the fishing minigame (ignores region).
 *
 * @command cast
 * @text Cast
 * @desc Force-cast/start the fishing attempt (alias of FishingSystemTest).
 *
 * @command stop
 * @text Stop
 * @desc Force-stop the fishing minigame or cancel a pending cast/pause.
 *
 * @command moveIndicatorBar
 * @text MoveIndicatorBar
 * @desc Move the player indicator bar by a delta (floating number -0.2..0.2). Parameters: delta
 *
 * @help
 * FishingSystem_MZ_v1.js
 *
 * - Loads data/FishingConfig.json into window.FishingConfig at game boot.
 * - Detects fishing when player presses OK (or your mapped "ok" button) while facing a tile
 *   whose region ID matches one of regionFreshwater/regionRiver/regionOcean from the config.
 * - Runs a vertical-gauge minigame (three bars) using settings from the config.
 * - If enableVerticalMinigame is "false", falls back to a simple "press OK to catch" mechanic.
 * - Adds items to party inventory on success, displays messages, and enforces a random pause between casts.
 *
 * NOTE: This plugin uses DataManager.loadDataFile to load the JSON file and then maps it to
 * window.FishingConfig via the $dataFishingConfig global created by RPG Maker's loader.
 *
 * Based on SimpleGauge_MZ_v1.js (original demo), adapted and expanded.
 * Source reference (original file used as a starting point): :contentReference[oaicite:0]{index=0}
 */

(() => {
    const PLUGIN_NAME = "FishingSystem_MZ_v1";

    // -----------------------------------------------------------------------
    // Helper: hex -> rgba string (keeps the small helper from original script)
    // -----------------------------------------------------------------------
    function hexToRgba(hex) {
        if (typeof hex !== "string") return "rgba(0,0,0,1)";
        const n = parseInt(hex.replace("#", ""), 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        return `rgba(${r},${g},${b},1)`;
    }

    // -----------------------------------------------------------------------
    // Load FishingConfig.json using DataManager.loadDataFile during DB load.
    // The file will be available as $dataFishingConfig once loaded.
    // Map it to window.FishingConfig for plugin use.
    // -----------------------------------------------------------------------
    const _DataManager_loadDatabase = DataManager.loadDatabase;
    DataManager.loadDatabase = function() {
        _DataManager_loadDatabase.call(this);
        // Request RPG Maker to load the JSON file -- this will populate $dataFishingConfig
        // Note: we rely on the engine's loader to create $dataFishingConfig and then
        // assign it to window.FishingConfig inside isDatabaseLoaded (below).
        DataManager.loadDataFile('$dataFishingConfig', 'FishingConfig.json');
    };

    // Ensure window.FishingConfig is set once the JSON has been loaded into $dataFishingConfig
    const _DataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function() {
        const prev = _DataManager_isDatabaseLoaded.call(this);
        if (!prev) return false;
        // If the engine has created $dataFishingConfig, map it to window.FishingConfig
        if (typeof $dataFishingConfig !== 'undefined' && !window.FishingConfig) {
            try {
                // Validate minimal structure and set defaults for missing fields.
                const cfg = $dataFishingConfig;
                // Simple type coercion for boolean-like flags written as strings in JSON
                cfg.enableVerticalMinigame = String(cfg.enableVerticalMinigame || "true");
                cfg.miniGameSpeed = Number(cfg.miniGameSpeed || 4);
                cfg.fishSpeed = Number(cfg.fishSpeed || 2);
                cfg.backgroundColor = String(cfg.backgroundColor || "#808080");
                cfg.barColor = String(cfg.barColor || "#00FF00");
                cfg.timerDuration = Number(cfg.timerDuration || 4);
                cfg.maxPauseTime = Number(cfg.maxPauseTime || 2);
                cfg.regionFreshwater = Number(cfg.regionFreshwater || 0);
                cfg.regionRiver = Number(cfg.regionRiver || 0);
                cfg.regionOcean = Number(cfg.regionOcean || 0);
                cfg.FishData = Array.isArray(cfg.FishData) ? cfg.FishData : [];
                window.FishingConfig = cfg;
                console.log('[FishingSystem] FishingConfig loaded', window.FishingConfig);
            } catch (e) {
                console.error('[FishingSystem] Failed to parse FishingConfig.json', e);
                window.FishingConfig = null;
            }
        }
        return true;
    };

    // -----------------------------------------------------------------------
    // FishingSystem singleton: manages attempts, pause timer, region detection,
    // and public API for plugin commands / external scripts.
    // -----------------------------------------------------------------------
    class FishingSystem {
        constructor() {
            this._canFish = true;         // is player allowed to start a cast?
            this._inMinigame = false;     // is the minigame currently active?
            this._lastAttemptTime = 0;
            this._pendingMoveDelta = 0;   // external requested delta for green bar
        }

        // Attempt to cast from the player's current facing tile.
        // If force=true, ignore region checks.
        attemptCast(force = false) {
            if (!window.FishingConfig) {
                $gameMessage.add("Fishing configuration not loaded.");
                return;
            }
            if (!this._canFish) {
                // ignore while paused
                return;
            }
            if (this._inMinigame) {
                return;
            }

            // Determine region ID of the tile player is facing
            const player = $gamePlayer;
            const direction = player.direction();
            let x = player.x;
            let y = player.y;
            if (direction === 2) y += 1;      // down
            else if (direction === 4) x -= 1; // left
            else if (direction === 6) x += 1; // right
            else if (direction === 8) y -= 1; // up

            const regionId = $gameMap.regionId(x, y);
            // map region id to type string
            let regionType = null;
            const cfg = window.FishingConfig;
            if (regionId === cfg.regionFreshwater) regionType = "freshwater";
            else if (regionId === cfg.regionRiver) regionType = "river";
            else if (regionId === cfg.regionOcean) regionType = "ocean";

            if (!force && !regionType) {
                $gameMessage.add("You can't fish here.");
                return;
            }

            // start the minigame; pass regionType (may be null if force=true)
            this.startMinigame(regionType || this._inferRegionFromId(regionId) || "freshwater");
        }

        // A small helper to prefer river/ocean/freshwater if region id equals configured values
        _inferRegionFromId(regionId) {
            if (!window.FishingConfig) return null;
            const cfg = window.FishingConfig;
            if (regionId === cfg.regionFreshwater) return "freshwater";
            if (regionId === cfg.regionRiver) return "river";
            if (regionId === cfg.regionOcean) return "ocean";
            return null;
        }

        // Start the minigame scene and mark state
        startMinigame(regionType) {
            this._inMinigame = true;
            // push the fishing scene with region type argument
            SceneManager.push(Scene_FishingMinigame);
            // store the region type on the Scene for later consumption
            SceneManager.prepareNextScene({ fishingRegionType: regionType });
        }

        // Called when minigame finished (success boolean, regionType)
        onMinigameComplete(success, regionType) {
            this._inMinigame = false;
            const cfg = window.FishingConfig;
            if (!cfg) return;
            if (success) {
                // resolve catch and give item
                const fish = this._selectFishForRegion(regionType);
                if (fish) {
                    const itemId = Number(fish.itemId || 0);
                    if ($dataItems[itemId]) {
                        $gameParty.gainItem($dataItems[itemId], 1);
                        $gameMessage.add(`You caught a ${fish.name}!`);
                    } else {
                        $gameMessage.add(`You caught a ${fish.name}! (item ${itemId} not found)`);
                    }
                } else {
                    $gameMessage.add("You caught something... but it's not in the config.");
                }
            } else {
                $gameMessage.add("The fish got away.");
            }

            // Enforce a pause before next cast
            const pause = Math.random() * cfg.maxPauseTime;
            this._canFish = false;
            this._lastAttemptTime = performance.now();
            if (pause > 0) {
                setTimeout(() => {
                    this._canFish = true;
                }, Math.floor(pause * 1000));
            } else {
                // immediate re-enable
                this._canFish = true;
            }
        }

        // Random weighted selection from FishData for the given regionType
        _selectFishForRegion(regionType) {
            const cfg = window.FishingConfig;
            if (!cfg || !Array.isArray(cfg.FishData)) return null;
            // Filter by type match
            const pool = cfg.FishData.filter(f => String(f.type) === String(regionType));
            if (pool.length === 0) return null;
            // Build cumulative chances
            let total = 0;
            for (const f of pool) {
                const c = Number(f.dropChance) || 0;
                total += c;
            }
            // If total is 0, pick uniformly
            if (total <= 0) return pool[Math.floor(Math.random() * pool.length)];
            const roll = Math.floor(Math.random() * total);
            let acc = 0;
            for (const f of pool) {
                acc += Number(f.dropChance) || 0;
                if (roll < acc) return f;
            }
            // fallback
            return pool[pool.length - 1];
        }

        // External API for plugin command to forcibly stop
        stopMinigame() {
            // If Scene_FishingMinigame is active, ask it to end
            const scene = SceneManager._scene;
            if (scene && scene instanceof Scene_FishingMinigame) {
                scene.forceStop();
            }
            this._inMinigame = false;
            this._canFish = true;
        }

        // Allow external scripts to nudge the green indicator (scene will read _pendingMoveDelta)
        moveIndicator(delta) {
            // queue up a pending move delta the scene can consume
            this._pendingMoveDelta = Number(delta) || 0;
        }

        // internal accessor used by scene
        _consumePendingMoveDelta() {
            const d = this._pendingMoveDelta;
            this._pendingMoveDelta = 0;
            return d;
        }
    }

    // single global instance
    const fishingSystem = new FishingSystem();
    window.FishingSystem = fishingSystem;

    // -----------------------------------------------------------------------
    // Sprite: draws the three-bar vertical gauge (outer background, player bar, fish bar)
    // - Configurable sizes and colors via FishingConfig.
    // - Exposes methods to update indicator positions from the scene.
    // -----------------------------------------------------------------------
    class Sprite_FishingGauge extends Sprite {
        constructor(cfg) {
            super();
            this.cfg = cfg || window.FishingConfig || {};
            // size parameters (these can be widened if desired)
            this.barWidth = 48;
            this.barHeight = 220;
            this.playerBarHeight = 60;
            this.fishBarHeight = 36;

            // create bitmap a bit larger for text
            this.bitmap = new Bitmap(this.barWidth + 40, this.barHeight + 80);

            // state rates (0..1)
            this._playerRate = 0; // vertical position of player's green bar (0 top -> 1 bottom)
            this._playerDir = 1;
            this._fishRate = 0;   // fish autonomous position
            this._fishDir = 1;

            // speeds (multipliers from config)
            this._playerSpeedMultiplier = Number(this.cfg.miniGameSpeed || 4);
            this._fishSpeedMultiplier = Number(this.cfg.fishSpeed || 2);

            // whether player is currently holding OK (scene sets this flag)
            this._playerHolding = false;

            // draw initial frame
            this.refresh();
        }

        update() {
            super.update();

            // Apply external nudges (if any)
            if (typeof window.FishingSystem !== 'undefined') {
                const delta = window.FishingSystem._consumePendingMoveDelta();
                if (delta && !isNaN(delta)) {
                    // apply directly to player rate
                    this._playerRate = Math.min(1, Math.max(0, this._playerRate + Number(delta)));
                }
            }

            // Player bar: only moves while holding OK (or scene sets _playerHolding)
            if (this._playerHolding) {
                // original script used 0.01; multiply by config value
                const increment = 0.01 * (this._playerSpeedMultiplier || 1);
                this._playerRate += increment * this._playerDir;
                if (this._playerRate >= 1) { this._playerRate = 1; this._playerDir = -1; }
                if (this._playerRate <= 0) { this._playerRate = 0; this._playerDir = 1; }
            }

            // Fish bar autonomous bounce
            const finc = 0.008 * (this._fishSpeedMultiplier || 1);
            this._fishRate += finc * this._fishDir;
            if (this._fishRate >= 1) { this._fishRate = 1; this._fishDir = -1; }
            if (this._fishRate <= 0) { this._fishRate = 0; this._fishDir = 1; }

            this.refresh();
        }

        // set whether player is holding the button
        setPlayerHolding(holding) {
            this._playerHolding = !!holding;
        }

        // force set player rate (0..1)
        setPlayerRate(r) {
            this._playerRate = Math.min(1, Math.max(0, r));
        }

        // return raw rates for hit testing
        playerRate() { return this._playerRate; }
        fishRate() { return this._fishRate; }

        // draw current frame
        refresh() {
            const b = this.bitmap;
            b.clear();

            // text title
            b.drawText("Fishing", 0, 0, b.width, "center");

            // outer bar dims
            const x = 20;
            const y = 28;
            const w = this.barWidth;
            const h = this.barHeight;

            // outer background color from config
            const bgc = this.cfg.backgroundColor || "#808080";
            b.fillRect(x, y, w, h, bgc);

            // draw border (blue)
            b.fillRect(x - 1, y - 1, 1, h + 2, "#0000AA");
            b.fillRect(x + w, y - 1, 1, h + 2, "#0000AA");
            b.fillRect(x - 1, y - 1, w + 2, 1, "#0000AA");
            b.fillRect(x - 1, y + h, w + 2, 1, "#0000AA");

            // travel ranges for bars
            const travelRangePlayer = h - this.playerBarHeight;
            const travelRangeFish = h - this.fishBarHeight;

            // compute pixel offsets
            const playerOffset = Math.floor(travelRangePlayer * this._playerRate);
            const fishOffset = Math.floor(travelRangeFish * this._fishRate);

            // player bar (barColor)
            const playerColor = this.cfg.barColor || "#00FF00";
            b.fillRect(x, y + playerOffset, w, this.playerBarHeight, playerColor);

            // fish bar (blue)
            b.fillRect(x, y + fishOffset, w, this.fishBarHeight, "#0000FF");

            // numeric readout and instructions beneath
            b.drawText(`Time:`, 0, y + h + 2, b.width, "center");
        }
    }

    // -----------------------------------------------------------------------
    // Scene: Scene_FishingMinigame
    // - Runs the timer, listens to input, and resolves success/failure.
    // - Uses Sprite_FishingGauge for visuals.
    // -----------------------------------------------------------------------
    class Scene_FishingMinigame extends Scene_Base {
        constructor() {
            super();
            // prepared parameters are set by SceneManager.prepareNextScene
            this._regionType = (SceneManager._nextSceneArgs && SceneManager._nextSceneArgs.fishingRegionType) || "river";
        }

        // Scene_Base lifecycle
        create() {
            super.create();
            this._cfg = window.FishingConfig || {};
            this._gauge = new Sprite_FishingGauge(this._cfg);
            // position at center
            this._gauge.x = (Graphics.width - this._gauge.width) / 2;
            this._gauge.y = (Graphics.height - this._gauge.height) / 2 - 20;
            this.addChild(this._gauge);

            // timer
            this._timeLeft = Number(this._cfg.timerDuration || 4); // seconds
            this._startTime = performance.now();

            // whether player has currently held OK at least once
            this._playerHolding = false;
            // whether an overlap occurred while player was holding
            this._overlapOccurred = false;
            // whether we've already resolved success to prevent double-resolve
            this._resolved = false;

            // display a small help window text (we'll use a simple Sprite with text rendering)
            this._timerSprite = new Sprite(new Bitmap(220, 48));
            this._timerSprite.x = (Graphics.width - this._timerSprite.width) / 2;
            this._timerSprite.y = this._gauge.y + this._gauge.height + 12;
            this.addChild(this._timerSprite);

            // If vertical minigame is disabled in config, we will use fallback mechanic
            this._useVertical = String(this._cfg.enableVerticalMinigame || "true") !== "false";

            // If fallback, display a message prompt to press OK to attempt
            if (!this._useVertical) {
                $gameMessage.add("Press OK to attempt to catch the fish!");
            }

            // ensure input repeat is allowed (we rely on Input)
            this._gauge.setPlayerHolding(false);
        }

        start() {
            super.start();
            // Force input focus
            Input.clear();
            TouchInput.clear();
        }

        update() {
            super.update();
            if (this._resolved) return;

            // update time left
            const elapsed = (performance.now() - this._startTime) / 1000;
            this._timeLeft = Math.max(0, Number(this._cfg.timerDuration || 4) - elapsed);

            // update timer display
            const b = this._timerSprite.bitmap;
            b.clear();
            b.drawText(`Time left: ${this._timeLeft.toFixed(1)}s`, 0, 0, b.width, "center");

            if (!this._useVertical) {
                // fallback: wait for OK press within timer
                if (Input.isTriggered('ok')) {
                    this._resolve(true);
                    return;
                }
                if (this._timeLeft <= 0) {
                    this._resolve(false);
                    return;
                }
                return;
            }

            // NORMAL vertical minigame behavior

            // set gauge's player holding based on whether OK is currently pressed
            const holding = Input.isPressed('ok');
            this._gauge.setPlayerHolding(holding);

            // track if player has been holding at any point (we require a release after an overlap)
            if (holding) this._playerHolding = true;

            // check overlap between green( player ) and blue( fish ) bars in pixel coordinates
            // compute positions relative to gauge's inner box (same math as sprite)
            const h = this._gauge.barHeight;
            const playerH = this._gauge.playerBarHeight;
            const fishH = this._gauge.fishBarHeight;
            const travelP = h - playerH;
            const travelF = h - fishH;
            const playerY = this._gauge.y + 28 + Math.floor(travelP * this._gauge.playerRate());
            const playerTop = playerY;
            const playerBottom = playerY + playerH;
            const fishY = this._gauge.y + 28 + Math.floor(travelF * this._gauge.fishRate());
            const fishTop = fishY;
            const fishBottom = fishY + fishH;

            // basic rectangle overlap test
            const overlap = !(playerBottom < fishTop || playerTop > fishBottom);

            // mark if overlap occurred while player holding
            if (overlap && holding) {
                this._overlapOccurred = true;
            }

            // Successful catch condition: overlap occurred previously (or currently) while holding,
            // and the player releases OK before time runs out.
            if (this._overlapOccurred && !holding && this._playerHolding) {
                // player released after overlapping => success
                this._resolve(true);
                return;
            }

            // allow external move requests to nudge the player indicator (consumed in sprite.update)
            // The sprite's internal update will consume any pending moves; here we just call update for it to process.

            // timer expire -> failure
            if (this._timeLeft <= 0) {
                this._resolve(false);
                return;
            }
        }

        // Force-stop (plugin command)
        forceStop() {
            if (!this._resolved) {
                this._resolve(false);
            }
        }

        // When resolved, pop scene and notify FishingSystem
        _resolve(success) {
            this._resolved = true;
            // determine region type: try to get from prepared scene args, else fallback
            const regionType = (SceneManager._nextSceneArgs && SceneManager._nextSceneArgs.fishingRegionType) || this._regionType || "river";
            // Pop this scene after a small delay to ensure messages display properly.
            SceneManager.pop();
            // Notify the global system
            if (window.FishingSystem && typeof window.FishingSystem.onMinigameComplete === 'function') {
                window.FishingSystem.onMinigameComplete(success, regionType);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Hook into Scene_Map to detect OK presses and start fishing.
    // We alias the update method to check for Input.isTriggered('ok').
    // -----------------------------------------------------------------------
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);

        // Only attempt fishing if the scene is active and player not moving, player not in event or message
		if (SceneManager._scene instanceof Scene_Map) {
			// do not attempt if a message is showing or scenes like menu are open
			if ($gameMessage.isBusy()) return;
			if ($gamePlayer.isMoving()) return;

			// Detect OK trigger: this is the default interaction key
			if (Input.isTriggered('ok')) {
				// Attempt to cast (this will show "You can't fish here." if invalid)
				if (window.FishingSystem) {
					window.FishingSystem.attemptCast(false);
				}
			}
		}
    };

    // -----------------------------------------------------------------------
    // Plugin commands registration
    // -----------------------------------------------------------------------
    PluginManager.registerCommand(PLUGIN_NAME, "FishingSystemTest", args => {
        if (window.FishingSystem) window.FishingSystem.attemptCast(true);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "cast", args => {
        if (window.FishingSystem) window.FishingSystem.attemptCast(true);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "stop", args => {
        if (window.FishingSystem) window.FishingSystem.stopMinigame();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "moveIndicatorBar", args => {
        // accept an argument named 'delta' passed via plugin command; PluginManager will pass a map of args
        const delta = (args && (args.delta || args.DELTA || args.d)) ? Number(args.delta || args.DELTA || args.d) : 0;
        if (window.FishingSystem) window.FishingSystem.moveIndicator(delta);
    });

    // -----------------------------------------------------------------------
    // Expose a programmatic API via $gameSystem for scripts that prefer that
    // -----------------------------------------------------------------------
    Game_System.prototype.startFishingTest = function() {
        if (window.FishingSystem) window.FishingSystem.attemptCast(true);
    };

    // -----------------------------------------------------------------------
    // Done.
    // -----------------------------------------------------------------------
    console.log('[FishingSystem] Plugin loaded. Waiting for FishingConfig.json to be available as $dataFishingConfig.');
})();
