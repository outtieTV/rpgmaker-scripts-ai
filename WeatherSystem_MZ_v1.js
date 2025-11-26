/*:
 * @target MZ
 * @plugindesc v1.2.0 Dynamic Weather System based on GameTime_MZ_v1.js, with Plugin Commands for control.
 * @author OuttieTV
 *
 * @param SpringRainChance
 * @type number
 * @min 0
 * @max 100
 * @default 40
 * @text Spring Rain Chance (%)
 * @desc Chance of Light/Medium Rain during Spring (0-100).
 *
 * @param SummerRainChance
 * @type number
 * @min 0
 * @max 100
 * @default 15
 * @text Summer Rain Chance (%)
 * @desc Chance of Light/Medium Rain during Summer (0-100). (Only if Thunderstorm fails)
 *
 * @param SummerThunderstormChance
 * @type number
 * @min 0
 * @max 100
 * @default 10
 * @text Summer Thunderstorm Chance (%)
 * @desc Chance of Heavy Rain (Thunderstorm) during Summer (0-100). This check runs BEFORE regular rain.
 *
 * @param FallRainChance
 * @type number
 * @min 0
 * @max 100
 * @default 40
 * @text Fall Rain Chance (%)
 * @desc Chance of Light/Medium Rain during Fall (0-100). (Only if Fog fails)
 *
 * @param FallFogChance
 * @type number
 * @min 0
 * @max 100
 * @default 25
 * @text Fall Fog Chance (%)
 * @desc Chance of Fog during Fall (0-100). This check runs BEFORE regular rain.
 *
 * @param WinterSnowChance
 * @type number
 * @min 0
 * @max 100
 * @default 60
 * @text Winter Snow Chance (%)
 * @desc Chance of Snow during Winter (0-100).
 *
 * @command getWeather
 * @text Get Current Weather
 * @desc Stores the current day's weather type into a specified Game Variable.
 *
 * @arg variableId
 * @type variable
 * @default 1
 * @text Game Variable ID
 * @desc The ID of the Game Variable to store the weather string into.
 *
 * @command setWeather
 * @text Set Weather Manually
 * @desc Manually overrides and sets the weather type and intensity for the rest of the day.
 *
 * @arg type
 * @type select
 * @option Clear
 * @value none
 * @option Rain
 * @value rain
 * @option Thunderstorm (Heavy Rain)
 * @value thunderstorm
 * @option Fog
 * @value fog
 * @option Snow
 * @value snow
 * @default none
 * @text Weather Type
 * @desc The type of weather to set. 'Thunderstorm' and 'Fog' map to specific types/powers.
 *
 * @arg power
 * @type number
 * @min 0
 * @max 9
 * @default 5
 * @text Intensity (0-9)
 * @desc The intensity of the weather effect. 0 is clear, 9 is heavy. Ignored for 'Thunderstorm' and 'Fog'.
 *
 * @command toggleWeather
 * @text Toggle Auto Weather
 * @desc Turns the automatic daily weather change system on or off.
 *
 * @arg state
 * @type select
 * @option On (Enable)
 * @value true
 * @option Off (Disable)
 * @value false
 * @default true
 * @text Enable/Disable Auto Weather
 * @desc Choose whether to enable or disable the daily automated weather system.
 *
 * @help
 * ===========================================================================
 * WeatherSystem_MZ_v1.js - v1.2.0
 * ===========================================================================
 * This plugin creates a dynamic, day-long weather system based on the
 * season and day provided by the GameTime_MZ_v1.js plugin.
 *
 * **Plugin Commands:**
 *
 * 1. getWeather [variableId]
 * - Gets the current active weather type and stores its string value 
 * in the specified Game Variable.
 * - Possible Values: 'none', 'rain', 'thunderstorm', 'fog', 'snow'
 *
 * 2. setWeather [type] [power]
 * - Manually overrides the current weather. This does NOT disable the
 * automatic weather for the next day.
 * - Setting 'thunderstorm' automatically sets power to 8-9 and triggers flash.
 * - Setting 'fog' automatically sets type to 'storm' and power to 1-3.
 *
 * 3. toggleWeather [state]
 * - Enables (true) or disables (false) the automatic daily weather update.
 * - When disabled, weather stays the same until manually changed or re-enabled.
 *
 * **Execution:** The weather change runs in parallel over 120 frames (2 seconds).
 * ===========================================================================
 */

(function() {
    // --- Plugin Parameters ---
    const parameters = PluginManager.parameters('WeatherSystem_MZ_v1');
    const SPRING_RAIN_CHANCE = Number(parameters['SpringRainChance'] || 40);
    const SUMMER_RAIN_CHANCE = Number(parameters['SummerRainChance'] || 15);
    const SUMMER_THUNDERSTORM_CHANCE = Number(parameters['SummerThunderstormChance'] || 10);
    const FALL_RAIN_CHANCE = Number(parameters['FallRainChance'] || 40);
    const FALL_FOG_CHANCE = Number(parameters['FallFogChance'] || 25);
    const WINTER_SNOW_CHANCE = Number(parameters['WinterSnowChance'] || 60);

    // --- Global Variables for Tracking and State ---
    let _lastCheckedDay = -1;
    let _isAutoWeatherEnabled = true; // State for the toggleWeather command
    let _currentWeatherType = 'none'; // Stores the current weather string for getWeather command

    // =======================================================================
    // ** Core Logic: Determine and Apply Weather **
    // =======================================================================

    /**
     * Determines the weather for the current day based on the season.
     * @returns {object} { type: string, power: number, flash: boolean, commandType: string }
     */
    function determineWeather() {
        if (typeof GameTimeManager === 'undefined' || typeof GameTimeManager.getSeasons !== 'function') {
            console.error('GameTimeManager or getSeasons() is not defined. Is GameTime_MZ_v1.js installed?');
            return { type: 'none', power: 0, flash: false, commandType: 'none' };
        }

        const currentSeason = GameTimeManager.getSeasons();
        const rand = Math.random() * 100;

        let chance = 0;
        let weatherType = 'none'; // RPG Maker API Type ('none', 'rain', 'snow', 'storm')
        let weatherPower = 0;
        let needsFlash = false;
        let commandType = 'none'; // Weather System Type ('rain', 'thunderstorm', 'fog', 'snow')

        switch (currentSeason) {
            case 1: // Spring
                chance = SPRING_RAIN_CHANCE;
                weatherType = 'rain';
                commandType = 'rain';
                if (rand < chance) {
                    weatherPower = Math.floor(Math.random() * 3) + 5; 
                } else { commandType = 'none'; }
                break;

            case 2: // Summer
                if (rand < SUMMER_THUNDERSTORM_CHANCE) {
                    weatherType = 'rain';
                    weatherPower = Math.floor(Math.random() * 2) + 8;
                    needsFlash = true;
                    commandType = 'thunderstorm';
                } else if (rand < (SUMMER_THUNDERSTORM_CHANCE + SUMMER_RAIN_CHANCE)) {
                    weatherType = 'rain';
                    weatherPower = Math.floor(Math.random() * 3) + 5;
                    commandType = 'rain';
                } else { commandType = 'none'; }
                break;

            case 3: // Fall
                if (rand < FALL_FOG_CHANCE) {
                    weatherType = 'storm'; 
                    weatherPower = Math.floor(Math.random() * 3) + 1;
                    commandType = 'fog';
                } else if (rand < (FALL_FOG_CHANCE + FALL_RAIN_CHANCE)) {
                    weatherType = 'rain';
                    weatherPower = Math.floor(Math.random() * 3) + 5;
                    commandType = 'rain';
                } else { commandType = 'none'; }
                break;
                
            case 4: // Winter
                chance = WINTER_SNOW_CHANCE;
                weatherType = 'snow';
                commandType = 'snow';
                if (rand < chance) {
                    weatherPower = Math.floor(Math.random() * 5) + 5;
                } else { commandType = 'none'; }
                break;

            default:
                // Clear weather
                break;
        }

        return { type: weatherType, power: weatherPower, flash: needsFlash, commandType: commandType };
    }

    /**
     * Applies the weather effect and screen flash (if needed).
     * @param {string} type - 'none', 'rain', 'snow', or 'storm'.
     * @param {number} power - Intensity of the weather (0-9).
     * @param {boolean} flash - True if screen should flash (for thunderstorms).
     * @param {string} commandType - The user-friendly weather type (e.g., 'thunderstorm').
     */
    function applyWeather(type, power, flash, commandType) {
        $gameScreen.changeWeather(type, power, 120);
        _currentWeatherType = commandType; // Update the global tracker

        if (flash) {
            const flashColor = [255, 255, 255, 128]; 
            const flashDuration = 10;
            // Immediate flash for effect when weather changes to storm
            $gameScreen.startFlash(flashColor, flashDuration);
        }

        console.log(`Weather set: ${commandType} (${type} P:${power})`);
    }

    // =======================================================================
    // ** Aliasing: Daily Check in Scene_Map.update() **
    // =======================================================================

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        this.updateWeatherSystem();
    };

    /**
     * Custom method to check and update the weather once per game day.
     */
    Scene_Map.prototype.updateWeatherSystem = function() {
        if (typeof GameTimeManager === 'undefined' || !_isAutoWeatherEnabled) {
            return;
        }

        const currentDay = GameTimeManager.getDays();
        
        if (_lastCheckedDay !== currentDay) {
            _lastCheckedDay = currentDay;
            
            const weather = determineWeather();
            
            applyWeather(weather.type, weather.power, weather.flash, weather.commandType);
        }
    };

    // =======================================================================
    // ** Plugin Commands **
    // =======================================================================

    /**
     * Command: getWeather
     * Stores the current weather string into a Game Variable.
     */
    PluginManager.registerCommand('WeatherSystem_MZ_v1', 'getWeather', args => {
        const variableId = Number(args.variableId);
        if (variableId > 0) {
            // Stores one of: 'none', 'rain', 'thunderstorm', 'fog', 'snow'
            $gameVariables.setValue(variableId, _currentWeatherType);
            console.log(`Weather stored in Variable ${variableId}: ${_currentWeatherType}`);
        }
    });

    /**
     * Command: setWeather
     * Manually overrides the current weather.
     */
    PluginManager.registerCommand('WeatherSystem_MZ_v1', 'setWeather', args => {
        const type = String(args.type).toLowerCase();
        let power = Number(args.power || 0);

        let rmzType = 'none';
        let rmzPower = 0;
        let flash = false;
        let commandType = 'none';

        switch (type) {
            case 'rain':
                rmzType = 'rain';
                rmzPower = Math.min(9, Math.max(0, power));
                commandType = 'rain';
                break;
            case 'thunderstorm':
                rmzType = 'rain';
                rmzPower = Math.floor(Math.random() * 2) + 8; // Heavy Rain (8-9)
                flash = true;
                commandType = 'thunderstorm';
                break;
            case 'fog':
                rmzType = 'storm';
                rmzPower = Math.floor(Math.random() * 3) + 1; // Light Storm/Dust (1-3)
                commandType = 'fog';
                break;
            case 'snow':
                rmzType = 'snow';
                rmzPower = Math.min(9, Math.max(0, power));
                commandType = 'snow';
                break;
            case 'none':
            default:
                rmzType = 'none';
                rmzPower = 0;
                commandType = 'none';
                break;
        }

        // Apply manual weather change
        applyWeather(rmzType, rmzPower, flash, commandType);
        // Do NOT update _lastCheckedDay, as this is a manual override, not a daily check.
    });

    /**
     * Command: toggleWeather
     * Turns the daily weather check system on or off.
     */
    PluginManager.registerCommand('WeatherSystem_MZ_v1', 'toggleWeather', args => {
        const state = args.state === 'true'; // Args are strings, convert to boolean
        _isAutoWeatherEnabled = state;
        console.log(`Automatic Weather System set to: ${state ? 'ENABLED' : 'DISABLED'}`);
    });

    // =======================================================================
    // ** Persistence: Save and Load State **
    // =======================================================================

    const _Game_System_makeSaveContents = Game_System.prototype.makeSaveContents;
    Game_System.prototype.makeSaveContents = function() {
        const contents = _Game_System_makeSaveContents.call(this);
        contents.weatherSystemLastDay = _lastCheckedDay;
        contents.weatherSystemAutoEnabled = _isAutoWeatherEnabled; // Save new state
        contents.weatherSystemCurrentType = _currentWeatherType; // Save current type
        return contents;
    };

    const _Game_System_extractSaveContents = Game_System.prototype.extractSaveContents;
    Game_System.prototype.extractSaveContents = function(contents) {
        _Game_System_extractSaveContents.call(this, contents);
        _lastCheckedDay = contents.weatherSystemLastDay !== undefined ? contents.weatherSystemLastDay : -1;
        _isAutoWeatherEnabled = contents.weatherSystemAutoEnabled !== undefined ? contents.weatherSystemAutoEnabled : true;
        _currentWeatherType = contents.weatherSystemCurrentType !== undefined ? contents.weatherSystemCurrentType : 'none';

        if (typeof GameTimeManager !== 'undefined') {
             const currentDay = GameTimeManager.getDays();
             if (_lastCheckedDay === currentDay) {
                // Re-apply the weather immediately upon loading the save file to ensure visual fidelity
                const weather = determineWeather();
                // Find the appropriate settings based on the stored type
                const typeToApply = (_currentWeatherType === 'fog' || _currentWeatherType === 'thunderstorm') ? weather.commandType : _currentWeatherType;

                let rmzType = 'none';
                let rmzPower = 0;
                let flash = false;

                switch (typeToApply) {
                    case 'rain':
                        rmzType = 'rain';
                        rmzPower = weather.power; // Use determined power
                        break;
                    case 'thunderstorm':
                        rmzType = 'rain';
                        rmzPower = weather.power; 
                        flash = true;
                        break;
                    case 'fog':
                        rmzType = 'storm';
                        rmzPower = weather.power;
                        break;
                    case 'snow':
                        rmzType = 'snow';
                        rmzPower = weather.power;
                        break;
                    default:
                        break;
                }

                $gameScreen.changeWeather(rmzType, rmzPower, 1); // Instant application on load
             }
        }
    };

})();
