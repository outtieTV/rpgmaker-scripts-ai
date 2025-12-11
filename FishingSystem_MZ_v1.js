/*:
 * @target MZ
 * @plugindesc v1.0.1 - Fishing system with vertical gauge minigame. Loads config from data/FishingConfig.json. Ready for js/plugins/.
 * @author OuttieTV
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
 * @param LoadJSON
 * @text Load JSON?
 * @type boolean
 * @on Yes
 * @off No
 * @default true
 * @desc If true, loads data/FishingConfig.json. If false, only plugin parameters are used.
 *
 * @param CatchTimeRequired
 * @text Catch Time (Seconds)
 * @type number
 * @min 0.1
 * @decimals 1
 * @default 1.0
 * @desc Number of seconds the green bar must overlap the fish bar to succeed.
 *
 * @param EnableVerticalMinigame
 * @text Use Vertical Minigame?
 * @type boolean
 * @on Yes
 * @off No
 * @default true
 * @desc If disabled, fishing becomes a simple “Press OK to catch” system.
 *
 * @param MiniGameSpeed
 * @text Player Bar Speed
 * @type number
 * @min 0.1
 * @decimals 2
 * @default 4
 * @desc Speed multiplier for the player's moving green bar.
 *
 * @param FishSpeed
 * @text Fish Bar Speed
 * @type number
 * @min 0.1
 * @decimals 2
 * @default 2
 * @desc Speed of the fish’s blue bar.
 *
 * @param BackgroundColor
 * @text Gauge Background Color
 * @type string
 * @default #808080
 * @desc The color of the gauge's background fill.
 *
 * @param BarColor
 * @text Player Bar Color
 * @type string
 * @default #00FF00
 * @desc The color of the player (green) indicator bar.
 *
 * @param TimerDuration
 * @text Timer Duration
 * @type number
 * @min 0.1
 * @decimals 1
 * @default 4
 * @desc How many seconds the player has to catch a fish before time runs out.
 *
 * @param MaxPauseTime
 * @text Max Pause Time
 * @type number
 * @min 0
 * @decimals 1
 * @default 2
 * @desc Random cooldown after each fishing attempt (0–X seconds).
 *
 * @param RegionFreshwater
 * @text Region ID: Freshwater
 * @type number
 * @min 0
 * @default 0
 * @desc Region ID for freshwater fishing spots.
 *
 * @param RegionRiver
 * @text Region ID: River
 * @type number
 * @min 0
 * @default 0
 * @desc Region ID for river fishing spots.
 *
 * @param RegionOcean
 * @text Region ID: Ocean
 * @type number
 * @min 0
 * @default 0
 * @desc Region ID for ocean fishing spots.
 *
 * @param FishData
 * @text Fish Data
 * @type struct<FishItem>[]
 * @default []
 * @desc Array of fish definitions used when LoadJSON is false.
 *
 * @command FishingSystemTest
 * @text FishingSystemTest
 * @desc Force-start the fishing minigame anywhere (ignores regions).
 *
 * @command cast
 * @text Cast
 * @desc Alias of FishingSystemTest. Forces casting.
 *
 * @command stop
 * @text Stop
 * @desc Forcibly stops the fishing minigame.
 *
 * @command moveIndicatorBar
 * @text Move Indicator Bar
 * @desc Moves the player's green bar by a delta value.
 *
 * @arg delta
 * @text Delta
 * @type number
 * @min -0.5
 * @max 0.5
 * @decimals 2
 * @default 0
 * @desc How much to move the green indicator bar (negative = down, positive = up).
 *
 * @help
 * FishingSystem_MZ_v1.js
 *
 * - Loads data/FishingConfig.json into window.FishingConfig at game boot.
 * - Detects fishing when player presses OK while facing a tile whose region ID matches
 *   one of regionFreshwater/regionRiver/regionOcean from the config.
 * - Runs a vertical-gauge minigame using settings from the config.
 * - Falls back to a simple "press OK to catch" mechanic when enableVerticalMinigame is "false".
 * - Adds items to party inventory on success, displays messages, and enforces a random pause.
 *
 * Place the JSON at data/FishingConfig.json (exact structure expected in the plugin prompt).
 */

(() => {
    const PLUGIN_NAME = "FishingSystem_MZ_v1";

    // ------------------------------
    // Utility: hex -> rgba fallback
    // ------------------------------
    function hexToRgba(hex) {
        if (typeof hex !== "string") return "rgba(0,0,0,1)";
        const n = parseInt(hex.replace("#", ""), 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        return `rgba(${r},${g},${b},1)`;
    }

    // -----------------------------------------------------
    // Load FishingConfig.json via DataManager during DB load
    // result assigned to window.FishingConfig
    // -----------------------------------------------------
    const _DataManager_loadDatabase = DataManager.loadDatabase;
    DataManager.loadDatabase = function() {
        _DataManager_loadDatabase.call(this);
        DataManager.loadDataFile('$dataFishingConfig', 'FishingConfig.json');
    };

    const _DataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function() {
        const ready = _DataManager_isDatabaseLoaded.call(this);
        if (!ready) return false;

        // Map $dataFishingConfig -> window.FishingConfig once available
        if (typeof $dataFishingConfig !== 'undefined' && !window.FishingConfig) {
            try {
                const cfg = $dataFishingConfig;
                cfg.enableVerticalMinigame = String(cfg.enableVerticalMinigame || "true");
                cfg.miniGameSpeed = Number(cfg.miniGameSpeed || 4);
                cfg.fishSpeed = Number(cfg.fishSpeed || 2);
                cfg.backgroundColor = String(cfg.backgroundColor || "#808080");
                cfg.barColor = String(cfg.barColor || "#00FF00");
                cfg.timerDuration = Number(cfg.timerDuration || 4);
				cfg.catchTimeRequired = Number(cfg.catchTimeRequired || 1.0);
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

    // -----------------------------------------------------
    // FishingSystem: manages attempts, pauses, selection, API
    // -----------------------------------------------------
    class FishingSystem {
        constructor() {
            this._canFish = true;
            this._inMinigame = false;
            this._pendingMoveDelta = 0;
        }

        attemptCast(force = false) {
            if (!window.FishingConfig) {
                $gameMessage.add("Fishing configuration not loaded.");
                return;
            }
            if (!this._canFish) {
                // do nothing during enforced pause
                return;
            }
            if (this._inMinigame) {
                return;
            }

            // get tile player is facing
            const player = $gamePlayer;
            const direction = player.direction();
            let x = player.x;
            let y = player.y;
            if (direction === 2) y += 1;
            else if (direction === 4) x -= 1;
            else if (direction === 6) x += 1;
            else if (direction === 8) y -= 1;

            const regionId = $gameMap.regionId(x, y);
            const cfg = window.FishingConfig;

            let regionType = null;
            if (regionId === cfg.regionFreshwater) regionType = "freshwater";
            else if (regionId === cfg.regionRiver) regionType = "river";
            else if (regionId === cfg.regionOcean) regionType = "ocean";

            if (!force && !regionType) {
                $gameMessage.add("You can't fish here.");
                return;
            }

            // start minigame (force or region match)
            this.startMinigame(regionType || "freshwater");
        }

        startMinigame(regionType) {
            this._inMinigame = true;
            // Proper MZ pattern: set static property on scene, then push scene
            Scene_FishingMinigame.initFishing(regionType);
            SceneManager.push(Scene_FishingMinigame);
        }

        onMinigameComplete(success, regionType) {
            this._inMinigame = false;
            const cfg = window.FishingConfig;
            if (!cfg) return;

            if (success) {
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

            const pause = Math.random() * (cfg.maxPauseTime || 0);
            this._canFish = false;
            if (pause > 0) {
                setTimeout(() => {
                    this._canFish = true;
                }, Math.floor(pause * 1000));
            } else {
                this._canFish = true;
            }
        }

        _selectFishForRegion(regionType) {
            const cfg = window.FishingConfig;
            if (!cfg || !Array.isArray(cfg.FishData)) return null;
            const pool = cfg.FishData.filter(f => String(f.type) === String(regionType));
            if (pool.length === 0) return null;
            let total = 0;
            for (const p of pool) total += Number(p.dropChance || 0);
            if (total <= 0) return pool[Math.floor(Math.random() * pool.length)];
            const roll = Math.floor(Math.random() * total);
            let acc = 0;
            for (const p of pool) {
                acc += Number(p.dropChance || 0);
                if (roll < acc) return p;
            }
            return pool[pool.length - 1];
        }

        stopMinigame() {
            const scene = SceneManager._scene;
            if (scene && scene instanceof Scene_FishingMinigame) {
                scene.forceStop();
            }
            this._inMinigame = false;
            this._canFish = true;
        }

        moveIndicator(delta) {
            this._pendingMoveDelta = Number(delta || 0);
        }

        _consumePendingMoveDelta() {
            const d = this._pendingMoveDelta;
            this._pendingMoveDelta = 0;
            return d;
        }
    }

    const fishingSystem = new FishingSystem();
    window.FishingSystem = fishingSystem;

    // -----------------------------------------------------
    // Sprite drawing the three-bar vertical gauge
    // -----------------------------------------------------
    class Sprite_FishingGauge extends Sprite {
        constructor(cfg) {
            super();
            this.cfg = cfg || window.FishingConfig || {};
            this.barWidth = 48;
            this.barHeight = 220;
            this.playerBarHeight = 60;
            this.fishBarHeight = 36;
            this.bitmap = new Bitmap(this.barWidth + 40, this.barHeight + 80);

            this._playerRate = 0;
            this._playerDir = 1;
            this._fishRate = 0;
            this._fishDir = 1;

            this._playerSpeedMultiplier = Number(this.cfg.miniGameSpeed || 4);
            this._fishSpeedMultiplier = Number(this.cfg.fishSpeed || 2);
            this._playerHolding = false;

            this.refresh();
        }

        update() {
            super.update();

            // Consume any external nudge
            if (typeof window.FishingSystem !== 'undefined') {
                const delta = window.FishingSystem._consumePendingMoveDelta();
                if (delta && !isNaN(delta)) {
                    this._playerRate = Math.min(1, Math.max(0, this._playerRate + Number(delta)));
                }
            }

            if (this._playerHolding) {
                const increment = 0.01 * (this._playerSpeedMultiplier || 1);
                this._playerRate += increment * this._playerDir;
                if (this._playerRate >= 1) { this._playerRate = 1; this._playerDir = -1; }
                if (this._playerRate <= 0) { this._playerRate = 0; this._playerDir = 1; }
            }

            const finc = 0.008 * (this._fishSpeedMultiplier || 1);
            this._fishRate += finc * this._fishDir;
            if (this._fishRate >= 1) { this._fishRate = 1; this._fishDir = -1; }
            if (this._fishRate <= 0) { this._fishRate = 0; this._fishDir = 1; }

            this.refresh();
        }

        setPlayerHolding(holding) {
            this._playerHolding = !!holding;
        }

        setPlayerRate(r) {
            this._playerRate = Math.min(1, Math.max(0, r));
        }

        playerRate() { return this._playerRate; }
        fishRate() { return this._fishRate; }

        refresh() {
            const b = this.bitmap;
            b.clear();
            b.fontSize = 18;
            b.drawText("Fishing", 0, 0, b.width, "center");

            const x = 20;
            const y = 28;
            const w = this.barWidth;
            const h = this.barHeight;

            const bgc = this.cfg.backgroundColor || "#808080";
            b.fillRect(x, y, w, h, bgc);

            // border
            b.fillRect(x - 1, y - 1, 1, h + 2, "#0000AA");
            b.fillRect(x + w, y - 1, 1, h + 2, "#0000AA");
            b.fillRect(x - 1, y - 1, w + 2, 1, "#0000AA");
            b.fillRect(x - 1, y + h, w + 2, 1, "#0000AA");

            const travelRangePlayer = h - this.playerBarHeight;
            const travelRangeFish = h - this.fishBarHeight;

            const playerOffset = Math.floor(travelRangePlayer * this._playerRate);
            const fishOffset = Math.floor(travelRangeFish * this._fishRate);

            const playerColor = this.cfg.barColor || "#00FF00";
            b.fillRect(x, y + playerOffset, w, this.playerBarHeight, playerColor);

            b.fillRect(x, y + fishOffset, w, this.fishBarHeight, "#0000FF");
        }
    }

    // -----------------------------------------------------
    // Scene: Scene_FishingMinigame
    // - static initFishing to pass regionType safely in MZ
    // -----------------------------------------------------
	class Scene_FishingMinigame extends Scene_Base {
		static initFishing(regionType, bgSnapshot) {
			this._regionType = regionType;
			this._bgSnapshot = bgSnapshot; // may be null
		}

		constructor() {
			super();
			this._regionType = Scene_FishingMinigame._regionType || "river";
			this._bgSnapshot = Bitmap.snap(SceneManager._scene);
		}

		create() {
			super.create();
			this._cfg = window.FishingConfig || {};

			// background
			if (this._bgSnapshot) {
				const bgSprite = new Sprite(this._bgSnapshot);
				this.addChild(bgSprite);
			} else {
				const filler = new Sprite(new Bitmap(Graphics.width, Graphics.height));
				filler.bitmap.fillAll(this._cfg.backgroundColor || "#404040");
				this.addChild(filler);
			}

			// gauge
			this._gauge = new Sprite_FishingGauge(this._cfg);
			this._gauge.x = (Graphics.width - this._gauge.width) / 2;
			this._gauge.y = (Graphics.height - this._gauge.height) / 2 - 20;
			this.addChild(this._gauge);

			// timer display
			this._timerSprite = new Sprite(new Bitmap(220, 48));
			this._timerSprite.x = (Graphics.width - this._timerSprite.width) / 2;
			this._timerSprite.y = this._gauge.y + this._gauge.height + 12;
			this.addChild(this._timerSprite);

			this._useVertical = !!this._cfg.enableVerticalMinigame;
			if (!this._useVertical) $gameMessage.add("Press OK to attempt to catch the fish!");

			this._gauge.setPlayerHolding(false);
			this._timeLeft   = Number(this._cfg.timerDuration || 4);
			this._startTime  = performance.now();
			this._playerHolding = false;
			this._resolved   = false;
			this._successTimer = null;
		}

		start() {
			super.start();
			Input.clear();
			TouchInput.clear();
		}

		update() {
			super.update();
			if (this._resolved) return;

			const elapsed   = (performance.now() - this._startTime) / 1000;
			this._timeLeft  = Math.max(0, Number(this._cfg.timerDuration || 4) - elapsed);

			// draw timer text
			const b = this._timerSprite.bitmap;
			b.clear(); b.fontSize = 18;
			b.drawText(`Time left: ${this._timeLeft.toFixed(1)}s`, 0, 0, b.width, "center");

			if (!this._useVertical) {
				if (Input.isTriggered('ok')) this._resolve(true);
				else if (this._timeLeft <= 0) this._resolve(false);
				return;
			}

			// vertical minigame logic …
			const holding = Input.isPressed('ok');
			this._gauge.setPlayerHolding(holding);
			if (holding) this._playerHolding = true;

			const h = this._gauge.barHeight;
			const travelP = h - this._gauge.playerBarHeight;
			const travelF = h - this._gauge.fishBarHeight;

			const playerY = this._gauge.y + 28 + Math.floor(travelP * this._gauge.playerRate());
			const fishY   = this._gauge.y + 28 + Math.floor(travelF * this._gauge.fishRate());

			const overlap = !(playerY + this._gauge.playerBarHeight < fishY ||
							  playerY > fishY + this._gauge.fishBarHeight);

			if (overlap) {
				if (this._successTimer === null) this._successTimer = performance.now();
			} else {
				this._successTimer = null;
			}

			if (this._successTimer !== null) {
				const overlappedSec = (performance.now() - this._successTimer) / 1000;
				if (overlappedSec >= (this._cfg.catchTimeRequired || 1.0)) {
					this._resolve(true);
					return;
				}
			}

			if (this._timeLeft <= 0) this._resolve(false);
		}

		forceStop() {
			if (!this._resolved) this._resolve(false);
		}

        _resolve(success) {
            this._resolved = true;
            const regionType = this._regionType || "river";
            // Pop scene immediately; messages and inventory updates happen after
            SceneManager.pop();
            if (window.FishingSystem && typeof window.FishingSystem.onMinigameComplete === 'function') {
                window.FishingSystem.onMinigameComplete(success, regionType);
            }
        }
    }

    // -----------------------------------------------------
    // Hook Scene_Map to attempt fishing on OK (default interact)
    // -----------------------------------------------------
	const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);

		if (SceneManager._scene instanceof Scene_Map) {
			// do not attempt if a message is showing or scenes like menu are open
			if ($gameMessage.isBusy()) return;
			if ($gamePlayer.isMoving()) return;

			// Detect OK trigger: this is the default interaction key
			if (Input.isTriggered('ok')) {
				
				// ** Capture logic starts here **
                const player = $gamePlayer;
                const direction = player.direction();
                let x = player.x;
                let y = player.y;
                if (direction === 2) y += 1;
                else if (direction === 4) x -= 1;
                else if (direction === 6) x += 1;
                else if (direction === 8) y -= 1;

                const regionId = $gameMap.regionId(x, y);
                const cfg = window.FishingConfig;

                let regionType = null;
                if (cfg) { // Ensure cfg is loaded before checking regions
                    if (regionId === cfg.regionFreshwater) regionType = "freshwater";
                    else if (regionId === cfg.regionRiver) regionType = "river";
                    else if (regionId === cfg.regionOcean) regionType = "ocean";
                }

                // Only perform the snapshot if fishing is possible
                if (window.FishingSystem && regionType) {
                    // Capture the current screen as a bitmap
                    const snapshot = SceneManager.snap();
                    // Initialize the next scene *before* the push happens in attemptCast
                    Scene_FishingMinigame.initFishing(regionType, snapshot.bitmap); 
                    // Now attemptCast will check region and push the scene
                    window.FishingSystem.attemptCast(false);
                    return; // Prevent further processing in this frame
                }
                
                // If fishing is not possible, call attemptCast without snapshot 
                // so it can display "You can't fish here." message.
				if (window.FishingSystem) {
					window.FishingSystem.attemptCast(false);
				}
                // ** Capture logic ends here **

			}
		}
    };

    // -----------------------------------------------------
    // Plugin commands
    // -----------------------------------------------------
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
        const delta = (args && args.delta) ? Number(args.delta) : 0;
        if (window.FishingSystem) window.FishingSystem.moveIndicator(delta);
    });

    // convenience method on $gameSystem
    Game_System.prototype.startFishingTest = function() {
        if (window.FishingSystem) window.FishingSystem.attemptCast(true);
    };

    console.log('[FishingSystem] Plugin loaded.');
})();
