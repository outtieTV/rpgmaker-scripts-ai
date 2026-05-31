/*:
 * @target MZ
 * @plugindesc HP and Energy overlay (extends CGMZ_Core) with automatic reset logic.
 * @author OuttieTV
 * @base CGMZ_Core
 * @orderAfter: CGMZ_Core
 * @orderAfter: GameTime_MZ_v1
 *
 *
 * @param LoadJson
 * @text Load JSON?
 * @type boolean
 * @on Yes
 * @off No
 * @desc Whether the plugin should load data from the JSON file.
 * @default false
 *
 * @param EnergyStorageVariableId
 * @text Energy Storage Variable ID
 * @desc The ID of the Game Variable used to store the current Energy value.
 * @type variable
 * @default 10
 *
 * @param MaxEnergyValue
 * @text Max Energy
 * @desc The maximum value for Energy.
 * @type number
 * @min 1
 * @default 100
 *
 * @param OverlayX
 * @text Overlay X Position
 * @desc X position for the overlay window.
 * @type number
 * @default 550
 *
 * @param OverlayY
 * @text Overlay Y Position
 * @desc Y position for the overlay window.
 * @type number
 * @default 0
 *
 * @command setCurrentHP
 * @text Set Current HP
 * @desc Set the party leader's current HP.
 * @arg value
 * @type number
 * @min 0
 *
 * @command getCurrentHP
 * @text Get Current HP
 * @desc Get the party leader's current HP and store it in a Game Variable (ID 1).
 *
 * @command setMaxHP
 * @text Set Max HP
 * @desc Set the party leader's maximum HP value. (Note: Only sets actor base stats).
 * @arg value
 * @type number
 * @min 1
 *
 * @command getMaxHP
 * @text Get Max HP
 * @desc Get the party leader's maximum HP and store it in a Game Variable (ID 2).
 *
 * @command setCurrentEnergy
 * @text Set Current Energy
 * @desc Set the current Energy value.
 * @arg value
 * @type number
 * @min 0
 *
 * @command getCurrentEnergy
 * @text Get Current Energy
 * @desc Get the current Energy and store it in a Game Variable (ID 3).
 *
 * @command setMaxEnergy
 * @text Set Max Energy
 * @desc Set the maximum Energy value.
 * @arg value
 * @type number
 * @min 1
 *
 * @command getMaxEnergy
 * @text Get Max Energy
 * @desc Get the maximum Energy and store it in a Game Variable (ID 4).
 *
 * @help
 * HPandEnergyOverlay_MZ_v1.js
 *
 * This plugin extends CGMZ_Core to draw a red HP gauge and a green Energy
 * gauge in the lower-left corner. It also handles automatic resets at
 * 02:00 and day-rollover when either resource reaches zero.
 *
 * NOTE: The "getMaxHP" and "setMaxHP" commands affect the party leader.
 * For MaxHP, only the actor's base parameter is changed, not equipment/class boosts.
 */

(() => {
    const PLUGIN_NAME = "oTV_HPandEnergyOverlay_MZ";
    const parameters = PluginManager.parameters(PLUGIN_NAME);

    // --- Plugin Parameters ---
	const LoadJson = parameters["LoadJson"] === "true";
    const EnergyVarId = parseInt(parameters["EnergyStorageVariableId"] || 10);
    const MaxEnergy = parseInt(parameters["MaxEnergyValue"] || 100);
    const OverlayX = parseInt(parameters["OverlayX"] || 10);
    const OverlayY = parseInt(parameters["OverlayY"] || 800);

	if (LoadJson) {
		console.log("Loading JSON...");
		loadMyJson();
	} else {
		console.log("JSON loading disabled.");
	}
	
	function loadMyJson() {
		fetch("data/myData.json")
			.then(r => r.json())
			.then(json => {
				console.log("Loaded JSON:", json);
				// store, use, etc.
			})
			.catch(err => console.error("JSON Load Error:", err));
	}

    // --- Helper Functions for Data Access ---

    const getLeader = () => $gameParty.leader();
    const leaderExists = () => $gameParty.size() > 0 && getLeader();

    // --- HP Functions (Uses built-in actor HP) ---
    const getCurrentHP = () => (leaderExists() ? getLeader().hp : 0);
    const getMaxHP = () => (leaderExists() ? getLeader().mhp : 1);

    const setCurrentHP = (value) => {
        if (leaderExists()) {
            const leader = getLeader();
            const max = leader.mhp;
            leader.setHp(Math.min(Math.max(0, value), max));
        }
    };

    // Note: MaxHP directly modifies the base parameter of Actor 1
    const setMaxHP = (value) => {
        const actor = $gameActors.actor(1);
        if (actor) {
            actor.changeParam(0, value - actor.param(0)); // 0 is MHP
        }
    };

    // --- Energy Functions (Uses Game Variable) ---
    const getCurrentEnergy = () => $gameVariables.value(EnergyVarId);

    const setCurrentEnergy = (value) => {
        const max = MaxEnergy;
        const clampedValue = Math.min(Math.max(0, value), max);
        $gameVariables.setValue(EnergyVarId, clampedValue);
    };

    const getMaxEnergy = () => MaxEnergy;

    // --- 02:00 Reset and Day Rollover Logic ---
    let _lastHour = -1;

    const performDayRollover = () => {
        if (typeof GameTimeManager === 'undefined') return; // Exit if GameTimeManager is missing

        // 1. Roll to next day, set hour to 6
        GameTimeManager.setDays(GameTimeManager.getDays() + 1);
        GameTimeManager.setHours(6);
        
        // 2. Reset resources
        setCurrentHP(getMaxHP());
        setCurrentEnergy(getMaxEnergy());
        
        console.log("Day Rollover: Resources reset and time set to Day " + GameTimeManager.getDays() + ", 06:00.");
    };

    const checkTimeAndResources = () => {
        if (!GameTimeManager || GameTimeManager.getHours() === null) {
			// Still initializing — skip until ready
			return;
		}
        const time = GameTimeManager.getTimeData();
        const currentHour = time.hour;
        
        // --- A. 02:00 Energy Reset (Check only if hour changed to 2) ---
		if (currentHour === 2 && getCurrentEnergy() > 0) {
			console.log("02:00 Reset: Energy forced to 0.");
			setCurrentEnergy(0);
		}
        _lastHour = currentHour;

        // --- B. Day Rollover Check ---
        const hpZero = getCurrentHP() <= 0;
        const energyZero = getCurrentEnergy() <= 0;

        if (hpZero || energyZero) {
            performDayRollover();
        }
    };
    
    // Hook into scene update for continuous checks
	const _Scene_Map_update = Scene_Map.prototype.update;
	Scene_Map.prototype.update = function() {
		_Scene_Map_update.call(this);
		checkTimeAndResources();
	};
    
    const _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function() {
        _Scene_Battle_update.call(this);
        checkTimeAndResources();
    };

    // --- UI/Drawing Implementation (Extends Window_Base for CGMZ functions) ---

    class Window_HPAndEnergyOverlay extends Window_Base {
        constructor(rect) {
            super(rect);
            this.opacity = 0; // Make the window invisible, only drawing contents
            this._lastHP = 0;
            this._lastEnergy = 0;
            this.refresh();
        }

		static initWindow() {
			// Create a temporary window instance just to get lineHeight and padding
			const tempWindow = new Window_Base(new Rectangle(0, 0, 0, 0));

			const lineHeight = tempWindow.lineHeight(); // instance method
			const padding = tempWindow.padding;        // property, not a method
			const lines = 2;
			const width = 250;
			const height = (lines * lineHeight) + (2 * padding) + 8; // your buffer

			return new Rectangle(OverlayX, OverlayY, width, height);
		}

        update() {
            super.update();
            if (this.shouldRefresh()) {
                this.refresh();
            }
        }

        shouldRefresh() {
            const currentHP = getCurrentHP();
            const currentEnergy = getCurrentEnergy();
            const needsRefresh = (currentHP !== this._lastHP) || (currentEnergy !== this._lastEnergy);
            
            this._lastHP = currentHP;
            this._lastEnergy = currentEnergy;
            
            return needsRefresh;
        }

        refresh() {
            this.contents.clear();
            
            const contentRect = this.innerRect;
            const gaugeWidth = contentRect.width - 20; // 250 - 20 padding

            this.drawHPGauge(10, 0, gaugeWidth);
            this.drawEnergyGauge(10, 40, gaugeWidth);
        }

        // Draws the HP Gauge using CGMZ_drawGauge
        drawHPGauge(x, y, width) {
            const current = getCurrentHP();
            const max = getMaxHP();
            const rate = max > 0 ? current / max : 0;
            
            // 1. Draw Text Label and Value
            const textY = y + 4; // Center text vertically in the line
            const gaugeHeight = 20;

            this.drawText("HP:", x, textY, 40, "left");
            this.drawText(current, x + 40, textY, 60, "center");
            
            // 2. Define Gauge Position
            const gaugeRect = new Rectangle(x + 105, y + 8, width - 105, gaugeHeight);
            
            // 3. Draw the Gauge (Red/Dark Red)
            const color1 = '#ff0000'; // Red
            const color2 = '#cc0000'; // Darker Red
            const color0 = 0;         // Background (default dark)

            this.CGMZ_drawGauge(gaugeRect, rate, color1, color2, color0); 
        }

        // Draws the Energy Gauge using CGMZ_drawGauge
        drawEnergyGauge(x, y, width) {
            const current = getCurrentEnergy();
            const max = getMaxEnergy();
            const rate = max > 0 ? current / max : 0;

            // 1. Draw Text Label and Value
            const textY = y + 4;
            const gaugeHeight = 20;

            this.drawText("NRG:", x, textY, 80, "left");
            this.drawText(current, x + 40, textY, 60, "center");
            
            // 2. Define Gauge Position
            const gaugeRect = new Rectangle(x + 105, y + 8, width - 105, gaugeHeight);
            
            // 3. Draw the Gauge (Green/Dark Green)
            const color1 = '#00ff00'; // Green
            const color2 = '#00cc00'; // Darker Green
            const color0 = 0;         // Background (default dark)
            
            this.CGMZ_drawGauge(gaugeRect, rate, color1, color2, color0);
        }
    }

    // --- Add the custom window to Scene_Map and Scene_Battle ---

    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        this.createHPAndEnergyWindow();
    };

    const _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
    Scene_Battle.prototype.createAllWindows = function() {
        _Scene_Battle_createAllWindows.call(this);
        this.createHPAndEnergyWindow();
    };
    
    // Shared method to create the overlay window
    Scene_Base.prototype.createHPAndEnergyWindow = function() {
        const rect = Window_HPAndEnergyOverlay.initWindow();
        this._hpAndEnergyWindow = new Window_HPAndEnergyOverlay(rect);
        this.addWindow(this._hpAndEnergyWindow);
    };

    // --- Plugin Command Registration ---

    PluginManager.registerCommand(PLUGIN_NAME, 'setCurrentHP', args => {
        setCurrentHP(parseInt(args.value));
    });
    
    PluginManager.registerCommand(PLUGIN_NAME, 'getCurrentHP', args => {
        // Returns the value in Game Variable ID 1 (as defined in RMMZ standard)
        $gameVariables.setValue(1, getCurrentHP());
    });
    
    PluginManager.registerCommand(PLUGIN_NAME, 'setMaxHP', args => {
        setMaxHP(parseInt(args.value));
    });

    PluginManager.registerCommand(PLUGIN_NAME, 'getMaxHP', args => {
        // Returns the value in Game Variable ID 2
        $gameVariables.setValue(2, getMaxHP());
    });

    PluginManager.registerCommand(PLUGIN_NAME, 'setCurrentEnergy', args => {
        setCurrentEnergy(parseInt(args.value));
    });

    PluginManager.registerCommand(PLUGIN_NAME, 'getCurrentEnergy', args => {
        // Returns the value in Game Variable ID 3
        $gameVariables.setValue(3, getCurrentEnergy());
    });

    PluginManager.registerCommand(PLUGIN_NAME, 'setMaxEnergy', args => {
        // Returns the value in Game Variable ID 4
        $gameVariables.setValue(4, getMaxEnergy());
    });
    
    PluginManager.registerCommand(PLUGIN_NAME, 'getMaxEnergy', args => {
        $gameVariables.setValue(4, getMaxEnergy());
    });

    // Initialize Energy on new game if the variable is zero
    const _Game_Variables_initialize = Game_Variables.prototype.initialize;
    Game_Variables.prototype.initialize = function() {
        _Game_Variables_initialize.call(this);
        if (this._data[EnergyVarId] === undefined || this._data[EnergyVarId] === 0) {
            this._data[EnergyVarId] = MaxEnergy;
        }
    };

})();
