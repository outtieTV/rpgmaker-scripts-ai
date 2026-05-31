/*:
 * @target MZ
 * @plugindesc Binds keyboard hotkeys to Plugin Commands via Parameters or JSON, and handles mouse wheel hotbar navigation.
 * @author outtieTV
 * @url https://github.com/
 *
 * @help HotkeyCommander.js
 *
 * This plugin allows you to trigger Plugin Commands by pressing specific keys.
 * Define bindings in the Plugin Parameters or in data/HotkeyCommander.json.
 *
 * ---------------------------------------------------------------------------
 * ARGUMENTS EXPLANATION
 * ---------------------------------------------------------------------------
 * Key Name:     The key to map (e.g., 'a', '1', 'shift', 'space', 'num1').
 * Plugin Name:  Exact name of the target plugin (as registered in PluginManager).
 * Command Name: Name of the command defined in the target plugin.
 * Arguments:    JSON string representing the arguments object.
 * Example: {"text":"Hello","pos":1}
 * Use {} if the command takes no arguments.
 * Context:      Determines what 'self' is passed to the command.
 * - null:        Standard for most utility commands.
 * - interpreter: Passes the Map's event interpreter.
 *
 * ---------------------------------------------------------------------------
 * JSON FILE FORMAT (data/HotkeyCommander.json)
 * ---------------------------------------------------------------------------
 * [
 * {
 * "keyName": "i",
 * "pluginName": "MyInventory",
 * "commandName": "Open",
 * "args": {},
 * "context": "null"
 * }
 * ]
 *
 * @param loadJson
 * @text Load JSON File
 * @desc If true, attempts to load bindings from data/HotkeyCommander.json
 * @type boolean
 * @default true
 *
 * @param hotkeyBindings
 * @text Hotkey Bindings
 * @desc List of bindings defined in the editor.
 * @type struct<Binding>[]
 * @default []
 *
 */

/*~struct~Binding:
 * @param keyName
 * @text Key Name
 * @desc The key identifier (e.g., 'a', 'enter', 'num1').
 * @type string
 * @default a
 *
 * @param pluginName
 * @text Plugin Name
 * @desc The name of the plugin to call.
 * @type string
 *
 * @param commandName
 * @text Command Name
 * @desc The name of the command to call.
 * @type string
 *
 * @param args
 * @text Arguments (JSON)
 * @desc Arguments as a JSON string object (e.g., {"id":1}).
 * @type multiline_string
 * @default {}
 *
 * @param context
 * @text Context (Self)
 * @desc What to pass as 'self'. usually null or interpreter.
 * @type select
 * @option null
 * @value null
 * @option Map Interpreter
 * @value interpreter
 * @default null
 */

(() => {
    const PLUGIN_NAME = "oTV_HotkeyCommander_MZ";
    const parameters   = PluginManager.parameters(PLUGIN_NAME);
    const rawBindings  = JSON.parse(parameters['hotkeyBindings'] || '[]');
    const loadJson     = parameters['loadJson'] === 'true';

    // Track current active slot locally for scroll-wheel calculation (0 to 9)
    let currentSlotIndex = 0;

    // ------------------------------------------------------------------------
    // 1️⃣  Key Mapping – Added ["0", "48"] mapping fix below
    // ------------------------------------------------------------------------
    const keyCodes = new Map([
        ["0","48"],["1","49"],["2","50"],["3","51"],["4","52"],["5","53"],["6","54"],["7","55"],["8","56"],
        ["9","57"],["backspace","8"],["tab","9"],["ok","13"],["shift","16"],["ctrl","17"],
        ["alt","18"],["capslock","20"],["esc","27"],["space","32"],["left","37"],
        ["up","38"],["right","39"],["down","40"],["a","65"],["b","66"],
        ["c","67"],["d","68"],["e","69"],["f","70"],["g","71"],["h","72"],["i","73"],
        ["j","74"],["k","75"],["l","76"],["m","77"],["n","78"],["o","79"],["p","80"],
        ["q","81"],["r","82"],["s","83"],["t","84"],["u","85"],["v","86"],["w","87"],
        ["x","88"],["y","89"],["z","90"],["num0","96"],["num1","97"],["num2","98"],
        ["num3","99"],["num4","100"],["num5","101"],["num6","102"],["num7","103"],
        ["num8","104"],["num9","105"],["=","187"],[",","188"],["-","189"],[".", "190"],
        ["/","191"],["`","192"],["[","219"],["\\","220"],["]","221"]
    ]);

    // Preserve any existing mapper (e.g., from wasdKeyMZ or r88CustomControls)
    const currentMap = Input.keyMapper || {};
    const mergedMap   = Object.assign({}, currentMap);
    keyCodes.forEach((code, name) => {
        mergedMap[parseInt(code)] = name;   // name is lower‑case string
    });
    Input.keyMapper = mergedMap;

    // ------------------------------------------------------------------------
    // 2️⃣  Helper – normalize binding data (lower‑case key, safety checks)
    // ------------------------------------------------------------------------
    function normalizeBinding(raw) {
        const key = (raw.keyName || "").toLowerCase();
        if (!Object.values(Input.keyMapper).includes(key)) {
            console.warn(`HotkeyCommander: key "${raw.keyName}" is not mapped – check your keyMapper or use a lower‑case name.`);
        }
        return {
            keyName:    key,
            pluginName: raw.pluginName,
            commandName: raw.commandName,
            args:       raw.args || {},
            context:    raw.context || "null"
        };
    }

    // ------------------------------------------------------------------------
    // 3️⃣  Load bindings from plugin parameters
    // ------------------------------------------------------------------------
    let activeBindings = [];

    const paramBindings = rawBindings.map(b => {
        const argsObj = b.args ? JSON.parse(b.args) : {};
        return normalizeBinding({
            keyName:    b.keyName,
            pluginName: b.pluginName,
            commandName: b.commandName,
            args:       argsObj,
            context:    b.context
        });
    });
    activeBindings = activeBindings.concat(paramBindings);

    // ------------------------------------------------------------------------
    // 4️⃣  Optionally load bindings from data/HotkeyCommander.json
    // ------------------------------------------------------------------------
    if (loadJson) {
        const xhr = new XMLHttpRequest();
        const url = 'data/HotkeyCommander.json';
        xhr.open('GET', url);
        xhr.overrideMimeType('application/json');
        xhr.onload = () => {
            if (xhr.status < 400) {
                try {
                    const json = JSON.parse(xhr.responseText);
                    json.forEach(b => {
                        let args = b.args;
                        if (typeof args === "string") {
                            try { args = JSON.parse(args); } catch (e) { args = {}; }
                        }
                        activeBindings.push(normalizeBinding({
                            keyName:    b.keyName,
                            pluginName: b.pluginName,
                            commandName: b.commandName,
                            args:       args || {},
                            context:    b.context || "null"
                        }));
                    });
                    console.log("HotkeyCommander: JSON bindings loaded.");
                } catch (e) {
                    console.error("HotkeyCommander: error parsing JSON file.", e);
                }
            }
        };
        xhr.onerror = () => {
            console.warn("HotkeyCommander: data/HotkeyCommander.json not found or unreadable.");
        };
        xhr.send();
    }

    // ------------------------------------------------------------------------
    // 5️⃣  Update loop – check inputs in any scene
    // ------------------------------------------------------------------------
    const _Scene_Base_update = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function () {
        _Scene_Base_update.call(this);
        this.checkHotkeyCommander();
        this.checkScrollWheelCommander();
    };

    Scene_Base.prototype.checkHotkeyCommander = function () {
        if (!activeBindings || activeBindings.length === 0) return;

        for (const binding of activeBindings) {
            if (Input.isTriggered(binding.keyName)) {
                // Keep our internal currentSlotIndex tracking aligned with number keypresses
                if (binding.pluginName === "oTV_HotbarPlugin_MZ" && binding.commandName === "SetActiveSlot") {
                    if (binding.args && binding.args.slotIndex !== undefined) {
                        currentSlotIndex = parseInt(binding.args.slotIndex);
                    }
                }
                this.executeHotkey(binding);
            }
        }
    };

    // ------------------------------------------------------------------------
    // 🆕  Mouse Scroll Wheel Listener
    // ------------------------------------------------------------------------
    Scene_Base.prototype.checkScrollWheelCommander = function () {
        // Only trigger scroll hotbar functionality while on the map screen
        if (Utils.isFpsElement && SceneManager._scene.constructor !== Scene_Map) return; 
        
        const threshold = 20; // Prevents hyper-sensitive micro-scrolling issues
        if (Math.abs(TouchInput.wheelY) >= threshold) {
            
            if (TouchInput.wheelY > 0) {
                // Scroll DOWN: Moves slot index UP ("1-9 then selected -=1, 0 goes to 9" logic translated to 0-9 indices)
                currentSlotIndex -= 1;
                if (currentSlotIndex < 0) currentSlotIndex = 9;
            } else if (TouchInput.wheelY < 0) {
                // Scroll UP: Moves slot index DOWN
                currentSlotIndex += 1;
                if (currentSlotIndex > 9) currentSlotIndex = 0;
            }

            // Call the hotbar plugin command with the updated index
            try {
                PluginManager.callCommand(
                    null,
                    "oTV_HotbarPlugin_MZ",
                    "SetActiveSlot",
                    { "slotIndex": String(currentSlotIndex) }
                );
                console.log(`HotkeyCommander (Scroll): oTV_HotbarPlugin_MZ → SetActiveSlot (Slot ${currentSlotIndex})`);
            } catch (e) {
                console.error(`HotkeyCommander: Scroll wheel failed to execute SetActiveSlot`, e);
            }
        }
    };

    // ------------------------------------------------------------------------
    // 6️⃣  Execute the bound plugin command
    // ------------------------------------------------------------------------
    Scene_Base.prototype.executeHotkey = function (binding) {
        let contextSelf = null;

        if (binding.context === 'interpreter') {
            if (window.$gameMap && $gameMap._interpreter) {
                contextSelf = $gameMap._interpreter;
            }
        }

        try {
            PluginManager.callCommand(
                contextSelf,
                binding.pluginName,
                binding.commandName,
                binding.args
            );
            console.log(`HotkeyCommander: ${binding.pluginName} → ${binding.commandName}`);
        } catch (e) {
            console.error(`HotkeyCommander: failed to run ${binding.pluginName}.${binding.commandName}`, e);
        }
    };
})();

// Quick WASD Map Injector
(() => {
    Input.keyMapper[65] = 'left';  // A
    Input.keyMapper[87] = 'up';    // W
    Input.keyMapper[68] = 'right'; // D
    Input.keyMapper[83] = 'down';  // S
})();