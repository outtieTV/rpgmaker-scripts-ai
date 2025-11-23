/*:
 * @plugindesc Real‑time clock & calendar with seconds‑minutes‑hours‑days‑months‑seasons‑years.
 * Uses real‑world time, supports configurable day length, and persists with saves.
 * @author  OuttieTV
 *
 * @param   DayScale
 * @text    Seconds per Real‑World Second
 * @type    number
 * @min     1
 * @default 72
 * @desc   How many in‑game seconds pass each real second.
 * Example: 72 → 1 in‑game day = 20 real minutes.
 *
 * @param   DayNightTint
 * @text    Day/Night Tint?
 * @type    boolean
 * @on      Yes
 * @off     No
 * @default true
 * @desc    Enables automatic screen tinting based on the current in-game hour.
 *
 * @help
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
 * None. Use Script calls for manipulation:
 *
 * // Advance time by 1 hour (60 minutes)
 * GameTimeManager.addMinutes(60);
 *
 * // Set the time to 1:30 PM on the 10th day of the 3rd month
 * GameTimeManager.setTime(13, 30, 0, 10, 3);
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
                    // New: Track last hour to trigger tinting only when hour changes
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
            
            // NEW: Check if the hour has changed and apply tint if needed
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
            const wait = false;   // No wait for completion
            
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

            // Only apply tint if the hour is one of the transition times or if the tint is changing
            $gameScreen.startTint(tint, duration, wait);
        }

        static getSeason(month) {
            if (month >= 1 && month <= 3) return 1; // Spring
            if (month >= 6 && month <= 4) return 2; // Summer
            if (month >= 9 && month <= 7) return 3; // Fall
            return 4; // December, January, February (Winter)
        }

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
        }

        static addHours(hours) {
            const t = $gameSystem._gameTime;
            t.hour += hours;

            if (t.hour >= 24) {
                this.addDays(Math.floor(t.hour / 24));
                t.hour %= 24;
            }
        }

        static addDays(days) {
            const t = $gameSystem._gameTime;
            t.day += days;

            // Assuming a fixed 30 days per month for simplicity
            while (t.day > 30) {
                t.day -= 30;
                this.addMonths(1);
            }
        }

        static addMonths(months) {
            const t = $gameSystem._gameTime;
            t.month += months;

            if (t.month > 12) {
                this.addYears(Math.floor((t.month - 1) / 12));
                t.month = (t.month - 1) % 12 + 1;
            }
        }

        static addYears(years) {
            $gameSystem._gameTime.year += years;
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
            $gameVariables.setValue(ids.season, this.getSeason(t.month));
        }
        
        static getTimeData() {
            const t = $gameSystem._gameTime;
            return {
                ...t,
                season: this.getSeason(t.month)
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

})();