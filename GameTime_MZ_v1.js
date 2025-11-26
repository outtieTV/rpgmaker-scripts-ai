/*:
 * @plugindesc Real‑time clock & calendar with seconds‑minutes‑hours‑days‑months‑seasons‑years.
 * Uses real‑world time, supports configurable day length, and persists with saves.
 * @author  OuttieTV
 *
 * @param   DayScale
 * @text    Seconds per Real‑World Second
 * @type    number
 * @min     1
 * @default 72
 * @desc   How many in‑game seconds pass each real second.
 * Example: 72 → 1 in‑game day = 20 real minutes.
 *
 * @param   DayNightTint
 * @text    Day/Night Tint?
 * @type    boolean
 * @on      Yes
 * @off     No
 * @default true
 * @desc    Enables automatic screen tinting based on the current in-game hour.
 *
 * @help
 *
 * @command AddMinutes
 * @text Add Minutes
 * @desc Adds minutes to the game clock.
 * @arg value
 * @type number
 * @default 1
 *
 * @command AddHours
 * @text Add Hours
 * @desc Adds hours to the game clock.
 * @arg value
 * @type number
 * @default 1
 *
 * @command AddDays
 * @text Add Days
 * @desc Adds days to the game date.
 * @arg value
 * @type number
 * @default 1
 *
 * @command AddMonths
 * @text Add Months
 * @desc Adds months to the date.
 * @arg value
 * @type number
 * @default 1
 *
 * @command AddYears
 * @text Add Years
 * @desc Adds years to the date.
 * @arg value
 * @type number
 * @default 1
 *
 * @command SetTime
 * @text Set Time/Date
 * @desc Set a specific time and date.
 * @arg hour
 * @type number
 * @min 0
 * @max 23
 *
 * @arg minute
 * @type number
 * @min 0
 * @max 59
 *
 * @arg second
 * @type number
 * @min 0
 * @max 59
 *
 * @arg day
 * @type number
 * @min 1
 * @max 30
 *
 * @arg month
 * @type number
 * @min 1
 * @max 12
 *
 * @arg year
 * @type number
 * @min 1
 * @default 1
 *
 * @command getSeconds
 * @text Get Seconds (Var)
 * @desc Stores the current second value (0-59) into a Game Variable.
 * @arg variableId
 * @type variable
 * @default 1
 *
 * @command getMinutes
 * @text Get Minutes (Var)
 * @desc Stores the current minute value (0-59) into a Game Variable.
 * @arg variableId
 * @type variable
 * @default 2
 *
 * @command getHours
 * @text Get Hours (Var)
 * @desc Stores the current hour value (0-23) into a Game Variable.
 * @arg variableId
 * @type variable
 * @default 3
 *
 * @command getDays
 * @text Get Days (Var)
 * @desc Stores the current day value (1-30) into a Game Variable.
 * @arg variableId
 * @type variable
 * @default 4
 *
 * @command getMonths
 * @text Get Months (Var)
 * @desc Stores the current month value (1-12) into a Game Variable.
 * @arg variableId
 * @type variable
 * @default 5
 *
 * @command getSeasons
 * @text Get Seasons (Var)
 * @desc Stores the current season value (1-4) into a Game Variable.
 * @arg variableId
 * @type variable
 * @default 7
 *
 * @command getYears
 * @text Get Years (Var)
 * @desc Stores the current year value (>=1) into a Game Variable.
 * @arg variableId
 * @type variable
 * @default 6
 *
 * @command setSeconds
 * @text Set Seconds
 * @desc Sets the current second value (0-59).
 * @arg value
 * @type number
 * @min 0
 * @max 59
 * @default 0
 *
 * @command setMinutes
 * @text Set Minutes
 * @desc Sets the current minute value (0-59).
 * @arg value
 * @type number
 * @min 0
 * @max 59
 * @default 0
 *
 * @command setHours
 * @text Set Hours
 * @desc Sets the current hour value (0-23).
 * @arg value
 * @type number
 * @min 0
 * @max 23
 * @default 0
 *
 * @command setDays
 * @text Set Days
 * @desc Sets the current day value (1-30).
 * @arg value
 * @type number
 * @min 1
 * @max 30
 * @default 1
 *
 * @command setMonths
 * @text Set Months
 * @desc Sets the current month value (1-12).
 * @arg value
 * @type number
 * @min 1
 * @max 12
 * @default 1
 *
 * @command setSeasons
 * @text Set Seasons
 * @desc Sets the current season (1=Spring, 2=Summer, 3=Fall, 4=Winter). Sets to the first month of the season.
 * @arg value
 * @type select
 * @option Spring (Month 1)
 * @value 1
 * @option Summer (Month 4)
 * @value 2
 * @option Fall (Month 7)
 * @value 3
 * @option Winter (Month 10)
 * @value 4
 * @default 1
 *
 * @command setYears
 * @text Set Years
 * @desc Sets the current year value (>=1).
 * @arg value
 * @type number
 * @min 1
 * @default 1
 * ----------------------------------------------------------------------
 * Features
 * ----------------------------------------------------------------------
 * • Tracks seconds, minutes, hours, days, months, seasons, years.
 * • Seasons: 1‑3 = Spring, 4‑6 = Summer, 7‑9 = Fall, 10‑12 = Winter.
 * • Displays a clock/calendar in the top‑left corner.
 * • Day length is configurable via the **DayScale** parameter.
 * • All data is saved/loaded with the normal player save file.
 * • **NEW:** Automatic Day/Night screen tinting based on hour.
 *
 * ----------------------------------------------------------------------
 * Usage
 * ----------------------------------------------------------------------
 * The plugin runs automatically. If you want to read the values in events,
 * use the following game variables (created automatically on first run):
 *
 * Variable 1 – Seconds (0‑59)
 * Variable 2 – Minutes (0‑59)
 * Variable 3 – Hours (0‑23)
 * Variable 4 – Day (1‑30)
 * Variable 5 – Month (1‑12)
 * Variable 6 – Year (starting at 1)
 * Variable 7 – Season (1=Spring, 2=Summer, 3=Fall, 4=Winter)
 *
 * ----------------------------------------------------------------------
 * Plugin Commands
 * ----------------------------------------------------------------------
 * Use the Plugin Commands listed above to manipulate or read the time.
 * Script calls for manipulation:
 *
 * // Advance time by 1 hour (60 minutes)
 * GameTimeManager.addMinutes(60);
 *
 * // Set the time to 1:30 PM on the 10th day of the 3rd month
 * GameTimeManager.setTime(13, 30, 0, 10, 3);
 *
 * // Get the current month via script
 * const currentMonth = GameTimeManager.getMonths();
 * ----------------------------------------------------------------------
 */

(() => {
	// --- 1. Plugin Constants and Parameters ---
	const PLUGIN_NAME = "GameTime_MZ_v1";
	const parameters = PluginManager.parameters(PLUGIN_NAME);
	const DayScale = Number(parameters.DayScale || 72);
	const DayNightTint = (parameters.DayNightTint === "true");

	// --- 2. GameTime Manager (Singleton Data/Logic) ---
	class GameTimeManager {
		static ensureData() {
			if (!$gameSystem._gameTime) {
				// Initialize all time variables
				$gameSystem._gameTime = {
					second: 0, minute: 0, hour: 0,
					day: 1, month: 1, year: 1,
					lastRealTime: Date.now(),
					// Track last hour to trigger tinting only when hour changes
					lastTintHour: -1 
				};
				// Variable IDs used for persistence/access by events
				$gameSystem._gameTimeVarIds = {
					second: 1, minute: 2, hour: 3,
					day: 4, month: 5, year: 6, season: 7
				};
			}
		}

		static initialize() {
			this.ensureData();
			// Update initial game variables
			this.updateGameVariables();
			// Ensure the initial tint is applied immediately upon loading/starting
			this.applyDayNightTint();
		}

		static update() {
			const now = Date.now();
			const timeData = $gameSystem._gameTime;
			const realTimeElapsed = now - timeData.lastRealTime;

			// Calculate the total in-game seconds passed
			const gameSecondsElapsed = Math.floor(realTimeElapsed * (DayScale / 1000));

			if (gameSecondsElapsed > 0) {
				this.addSeconds(gameSecondsElapsed);
				timeData.lastRealTime = now; // Reset timer
			}
			 
			// Check if the hour has changed and apply tint if needed
			if (timeData.hour !== timeData.lastTintHour) {
				this.applyDayNightTint();
				timeData.lastTintHour = timeData.hour;
			}
		}
		 
		// --- Day/Night Tinting Logic ---
		static applyDayNightTint() {
			if (!DayNightTint || !$gameScreen) {
				return;
			}
			 
			const hour = $gameSystem._gameTime.hour;
			const duration = 120; // 120 frames (2 seconds at 60fps)
			const wait = false;   // No wait for completion
			 
			let tint = [0, 0, 0, 0]; // Default: No tint

			// Hour 0 (Midnight): Heavy Blue/Night Tint
			if (hour === 0) {
				tint = [-68, -68, -34, 0];
			} 
			// Hour 5 (Dawn): Cooler, slightly dimmed
			else if (hour === 5) {
				tint = [-34, 0, 17, 0];
			} 
			// Hour 8 (Morning/Day): Normal
			else if (hour === 8) {
				tint = [0, 0, 0, 0];
			} 
			// Hour 18 (Dusk): Warm/Orange Tint
			else if (hour === 18) {
				tint = [17, 17, -34, 0];
			} 
			// Hour 20 (Early Night): Heavy Night Blue
			else if (hour === 20) {
				tint = [-68, -68, 0, 68];
			}

			// Only apply tint if the hour is one of the transition times
			$gameScreen.startTint(tint, duration, wait);
		}

		// --- GETTER Methods ---
		static getSeconds() { return $gameSystem._gameTime.second; }
		static getMinutes() { return $gameSystem._gameTime.minute; }
		static getHours() { return $gameSystem._gameTime.hour; }
		static getDays() { return $gameSystem._gameTime.day; }
		static getMonths() { return $gameSystem._gameTime.month; }
		static getYears() { return $gameSystem._gameTime.year; }
		static getSeasons() {
			const month = this.getMonths();
			if (month >= 1 && month <= 3) return 1; // Spring
			if (month >= 4 && month <= 6) return 2; // Summer
			if (month >= 7 && month <= 9) return 3; // Fall
			return 4; // Winter (10, 11, 12)
		}

		// --- SETTER Methods ---
		static setSeconds(value) {
			const t = $gameSystem._gameTime;
			t.second = Math.min(Math.max(0, value), 59);
			this.updateGameVariables();
		}

		static setMinutes(value) {
			const t = $gameSystem._gameTime;
			t.minute = Math.min(Math.max(0, value), 59);
			this.updateGameVariables();
		}

		static setHours(value) {
			const t = $gameSystem._gameTime;
			t.hour = Math.min(Math.max(0, value), 23);
			t.lastTintHour = -1; // Force tint update
			this.updateGameVariables();
			this.applyDayNightTint();
		}

		static setDays(value) {
			const t = $gameSystem._gameTime;
			t.day = Math.min(Math.max(1, value), 30);
			this.updateGameVariables();
		}

		static setMonths(value) {
			const t = $gameSystem._gameTime;
			t.month = Math.min(Math.max(1, value), 12);
			this.updateGameVariables();
		}

		static setSeasons(value) {
			const monthStarts = { 1: 1, 2: 4, 3: 7, 4: 10 }; // Spring=1, Summer=4, Fall=7, Winter=10
			const season = Math.min(Math.max(1, value), 4);
			this.setMonths(monthStarts[season]);
		}

		static setYears(value) {
			const t = $gameSystem._gameTime;
			t.year = Math.max(1, value);
			this.updateGameVariables();
		}

		// --- ADDER Methods ---
		static addSeconds(seconds) {
			const t = $gameSystem._gameTime;
			t.second += seconds;

			if (t.second >= 60) {
				this.addMinutes(Math.floor(t.second / 60));
				t.second %= 60;
			}
			this.updateGameVariables();
		}

		static addMinutes(minutes) {
			const t = $gameSystem._gameTime;
			t.minute += minutes;

			if (t.minute >= 60) {
				// Hour change happens here, which will trigger tint in GameTimeManager.update
				this.addHours(Math.floor(t.minute / 60)); 
				t.minute %= 60;
			}
			// Update variables here to ensure minutes/seconds are displayed correctly even if hours/days change
			this.updateGameVariables();
		}

		static addHours(hours) {
			const t = $gameSystem._gameTime;
			t.hour += hours;

			if (t.hour >= 24) {
				this.addDays(Math.floor(t.hour / 24));
				t.hour %= 24;
			}
			// Update variables here to ensure hours are displayed correctly even if days change
			this.updateGameVariables();
		}

		static addDays(days) {
			const t = $gameSystem._gameTime;
			t.day += days;

			// Assuming a fixed 30 days per month for simplicity
			while (t.day > 30) {
				t.day -= 30;
				this.addMonths(1);
			}
			this.updateGameVariables();
		}

		static addMonths(months) {
			const t = $gameSystem._gameTime;
			t.month += months;

			if (t.month > 12) {
				this.addYears(Math.floor((t.month - 1) / 12));
				t.month = (t.month - 1) % 12 + 1;
			}
			this.updateGameVariables();
		}

		static addYears(years) {
			$gameSystem._gameTime.year += years;
			this.updateGameVariables();
		}

		// Set specific time (utility for event script calls)
		static setTime(hour, minute, second, day, month, year = $gameSystem._gameTime.year) {
			const t = $gameSystem._gameTime;
			t.hour = Math.min(Math.max(0, hour), 23);
			t.minute = Math.min(Math.max(0, minute), 59);
			t.second = Math.min(Math.max(0, second), 59);
			t.day = Math.min(Math.max(1, day), 30);
			t.month = Math.min(Math.max(1, month), 12);
			t.year = Math.max(1, year);
			 
			// Force tint update immediately after setting time
			t.lastTintHour = -1; 
			this.updateGameVariables();
			this.applyDayNightTint();
		}

		static updateGameVariables() {
			const t = $gameSystem._gameTime;
			const ids = $gameSystem._gameTimeVarIds;
			 
			// Set time variables
			$gameVariables.setValue(ids.second, t.second);
			$gameVariables.setValue(ids.minute, t.minute);
			$gameVariables.setValue(ids.hour, t.hour);
			 
			// Set date variables
			$gameVariables.setValue(ids.day, t.day);
			$gameVariables.setValue(ids.month, t.month);
			$gameVariables.setValue(ids.year, t.year);
			 
			// Set season variable (1-4)
			$gameVariables.setValue(ids.season, this.getSeasons());
		}
		 
		static getTimeData() {
			const t = $gameSystem._gameTime;
			return {
				...t,
				season: this.getSeasons()
			};
		}
	}
	 
	// Global exposure for script calls
	window.GameTimeManager = GameTimeManager;

	// --- 3. RPG Maker Hooks ---

	// Initialize data on new game/load
	const _DataManager_createGameObjects = DataManager.createGameObjects;
	DataManager.createGameObjects = function() {
		_DataManager_createGameObjects.call(this);
		GameTimeManager.initialize();
	};

	// Update the clock during map and battle scenes
	const _Scene_Map_update = Scene_Map.prototype.update;
	Scene_Map.prototype.update = function() {
		_Scene_Map_update.call(this);
		GameTimeManager.update();
	};

	const _Scene_Battle_update = Scene_Battle.prototype.update;
	Scene_Battle.prototype.update = function() {
		_Scene_Battle_update.call(this);
		GameTimeManager.update();
	};

	// --- 4. Window for displaying the clock ---
	class Window_RealTimeClock extends Window_Base {
		constructor() {
			const width = 200;
			const estimatedHeight = 144; 
			const x = 0;
			const y = 0;
			 
			super(new Rectangle(x, y, width, estimatedHeight)); 
			 
			this._time = GameTimeManager.getTimeData(); // Initialize with current data
			 
			this.height = this.fittingHeight(3);
			 
			this.refresh();
		}

		refresh() {
			this.contents.clear();
			const t = GameTimeManager.getTimeData();
			const seasonNames = ["", "Spring", "Summer", "Fall", "Winter"];

			const timeStr = `${this.pad(t.hour)}:${this.pad(t.minute)}:${this.pad(t.second)}`;
			const dateStr = `${this.pad(t.day)}/${this.pad(t.month)}/${t.year}`;
			const seasonStr = seasonNames[t.season];

			this.drawText(`Time: ${timeStr}`, 0, 0, this.contentsWidth());
			this.drawText(`Date: ${dateStr}`, 0, this.lineHeight(), this.contentsWidth());
			this.drawText(`Season: ${seasonStr}`, 0, this.lineHeight() * 2, this.contentsWidth());
		}

		pad(num) {
			return num.toString().padStart(2, "0");
		}

		update() {
			super.update();
			// We refresh the clock display on every frame to show real-time seconds ticking up
			this.refresh();
		}
	}

	// Add the window to map and battle scenes
	const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
	Scene_Map.prototype.createAllWindows = function () {
		_Scene_Map_createAllWindows.call(this);
		this._rtClockWindow = new Window_RealTimeClock();
		this.addWindow(this._rtClockWindow);
	};

	const _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
	Scene_Battle.prototype.createAllWindows = function () {
		_Scene_Battle_createAllWindows.call(this);
		this._rtClockWindow = new Window_RealTimeClock();
		this.addWindow(this._rtClockWindow);
	};

	// --- 5. Plugin Commands ---

	// ADDERS (Existing)
	PluginManager.registerCommand(PLUGIN_NAME, "AddMinutes", args => {
		GameTimeManager.addMinutes(Number(args.value || 0));
	});

	PluginManager.registerCommand(PLUGIN_NAME, "AddHours", args => {
		GameTimeManager.addHours(Number(args.value || 0));
	});

	PluginManager.registerCommand(PLUGIN_NAME, "AddDays", args => {
		GameTimeManager.addDays(Number(args.value || 0));
	});

	PluginManager.registerCommand(PLUGIN_NAME, "AddMonths", args => {
		GameTimeManager.addMonths(Number(args.value || 0));
	});

	PluginManager.registerCommand(PLUGIN_NAME, "AddYears", args => {
		GameTimeManager.addYears(Number(args.value || 0));
	});

	PluginManager.registerCommand(PLUGIN_NAME, "SetTime", args => {
		GameTimeManager.setTime(
			Number(args.hour || 0),
			Number(args.minute || 0),
			Number(args.second || 0),
			Number(args.day || 1),
			Number(args.month || 1),
			Number(args.year || $gameSystem._gameTime.year)
		);
	});

	// GETTERS (New)
	PluginManager.registerCommand(PLUGIN_NAME, "getSeconds", args => {
		$gameVariables.setValue(Number(args.variableId), GameTimeManager.getSeconds());
	});

	PluginManager.registerCommand(PLUGIN_NAME, "getMinutes", args => {
		$gameVariables.setValue(Number(args.variableId), GameTimeManager.getMinutes());
	});

	PluginManager.registerCommand(PLUGIN_NAME, "getHours", args => {
		$gameVariables.setValue(Number(args.variableId), GameTimeManager.getHours());
	});

	PluginManager.registerCommand(PLUGIN_NAME, "getDays", args => {
		$gameVariables.setValue(Number(args.variableId), GameTimeManager.getDays());
	});

	PluginManager.registerCommand(PLUGIN_NAME, "getMonths", args => {
		$gameVariables.setValue(Number(args.variableId), GameTimeManager.getMonths());
	});

	PluginManager.registerCommand(PLUGIN_NAME, "getSeasons", args => {
		$gameVariables.setValue(Number(args.variableId), GameTimeManager.getSeasons());
	});

	PluginManager.registerCommand(PLUGIN_NAME, "getYears", args => {
		$gameVariables.setValue(Number(args.variableId), GameTimeManager.getYears());
	});

	// SETTERS (New)
	PluginManager.registerCommand(PLUGIN_NAME, "setSeconds", args => {
		GameTimeManager.setSeconds(Number(args.value || 0));
	});

	PluginManager.registerCommand(PLUGIN_NAME, "setMinutes", args => {
		GameTimeManager.setMinutes(Number(args.value || 0));
	});

	PluginManager.registerCommand(PLUGIN_NAME, "setHours", args => {
		GameTimeManager.setHours(Number(args.value || 0));
	});

	PluginManager.registerCommand(PLUGIN_NAME, "setDays", args => {
		GameTimeManager.setDays(Number(args.value || 1));
	});

	PluginManager.registerCommand(PLUGIN_NAME, "setMonths", args => {
		GameTimeManager.setMonths(Number(args.value || 1));
	});

	PluginManager.registerCommand(PLUGIN_NAME, "setSeasons", args => {
		GameTimeManager.setSeasons(Number(args.value || 1));
	});

	PluginManager.registerCommand(PLUGIN_NAME, "setYears", args => {
		GameTimeManager.setYears(Number(args.value || 1));
	});

})();
