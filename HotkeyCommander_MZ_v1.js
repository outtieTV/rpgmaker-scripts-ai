/*:
 * @target MZ
 * @plugindesc Binds keyboard hotkeys to Plugin Commands via Parameters or JSON.
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
 *               Example: {"text":"Hello","pos":1}
 *               Use {} if the command takes no arguments.
 * Context:      Determines what 'self' is passed to the command.
 *               - null:        Standard for most utility commands.
 *               - interpreter: Passes the Map's event interpreter.
 *
 * ---------------------------------------------------------------------------
 * JSON FILE FORMAT (data/HotkeyCommander.json)
 * ---------------------------------------------------------------------------
 * [
 *   {
 *     "keyName": "i",
 *     "pluginName": "MyInventory",
 *     "commandName": "Open",
 *     "args": {},
 *     "context": "null"
 *   }
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
    const PLUGIN_NAME = "HotkeyCommander_MZ_v1";
    const parameters   = PluginManager.parameters(PLUGIN_NAME);
    const rawBindings  = JSON.parse(parameters['hotkeyBindings'] || '[]');
    const loadJson     = parameters['loadJson'] === 'true';

    // ------------------------------------------------------------------------
    // 1️⃣  Key Mapping – merge with any existing mapper (WASD, r88, etc.)
    // ------------------------------------------------------------------------
    const keyCodes = new Map([
        ["1","49"],["2","50"],["3","51"],["4","52"],["5","53"],["6","54"],["7","55"],["8","56"],
        ["9","57"],["backspace","8"],["tab","9"],["enter","13"],["shift","16"],["ctrl","17"],
        ["alt","18"],["capslock","20"],["esc","27"],["space","32"],["arrowleft","37"],
        ["arrowup","38"],["arrowright","39"],["arrowdown","40"],["a","65"],["b","66"],
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
                        // Ensure args is an object (it may be a JSON string)
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
    };

    Scene_Base.prototype.checkHotkeyCommander = function () {
        if (!activeBindings || activeBindings.length === 0) return;

        for (const binding of activeBindings) {
            if (Input.isTriggered(binding.keyName)) {
                this.executeHotkey(binding);
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
            // Example message – you can remove or replace it
            $gameMessage.add(binding.commandName.charAt(0).toUpperCase() + binding.commandName.slice(1));
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
