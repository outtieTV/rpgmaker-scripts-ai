/*:
 * @target MZ
 * @plugindesc [MZ] A robust, time-sensitive, persistent mailbox system with auto-open on region trigger.
 * @author OuttieTV
 *
 * @param Load JSON
 * @type boolean
 * @default true
 * @desc If true, mail definitions are loaded from data/MailData.json at startup.
 *
 * @param Gametime Plugin Name
 * @type string
 * @default GameTime
 * @desc The name of the plugin that provides the Game_Time global object and methods.
 *
 * @param Region ID
 * @type number
 * @min 1
 * @max 255
 * @default 10
 * @desc The Map Region ID that will trigger the mailbox UI when the player steps onto it.
 *
 * @help
 * ---------------------------------------------------------------------------
 * Plugin Commands
 * ---------------------------------------------------------------------------
 *
 * @command checkMail
 * @text Check Mailbox
 * @desc Displays the main mailbox list window for the player to check their mail.
 *
 * @command deleteLetter
 * @text Delete Selected Letter
 * @desc Deletes the currently selected mail item from the inbox (use only within the scene).
 *
 * @command closeMail
 * @text Close Mailbox
 * @desc Closes the mailbox UI and returns to the game map.
 *
 * @command sendLetterFromString
 * @text Send Letter (JSON String)
 * @desc Adds a new mail item to the player's inbox by parsing a JSON string.
 * @arg mailJson
 * @type string
 * @desc A JSON string representing the mail object (e.g., {"subject": "Test", "body": "Hello."})
 *
 * @command sendLetterFromFile
 * @text Send Letter (JSON File)
 * @desc Loads mail definitions from a specified JSON file and adds them to the inbox.
 * @arg filePath
 * @type string
 * @desc The relative path to the JSON file (e.g., data/mail/quest1.json)
 *
 * ---------------------------------------------------------------------------
 * Usage Notes
 * ---------------------------------------------------------------------------
 * 1. Place a mailbox graphic on your map.
 * 2. Mark the tile with the Region ID specified in the plugin parameters (default 10).
 * 3. Ensure the Game Time plugin is loaded BEFORE this plugin.
 * 4. Create a file named 'data/MailData.json' in your project for mail definitions.
 */

// Global alias for the plugin
const MailboxSystem = {};
MailboxSystem.pluginName = "Mailbox_MZ_v2"; // Consistent internal name for parameters and commands

MailboxSystem.parameters = PluginManager.parameters(MailboxSystem.pluginName);

// Initialize parameters from Plugin Manager defaults
MailboxSystem.gametimePlugin = String(MailboxSystem.parameters["Gametime Plugin Name"] || "GameTime");
MailboxSystem.mailboxRegionId = Number(MailboxSystem.parameters["Region ID"] || 10);
MailboxSystem.loadJson = eval(MailboxSystem.parameters["Load JSON"] || "true");

// --- Plugin Data Storage & Cooldown Flag ---
MailboxSystem._pendingMail = [];
MailboxSystem._cooldown = false; // Flag to prevent immediate re-opening

// ============================================================================
// LOAD JSON
// ============================================================================

/**
 * Loads the MailData.json file from the data folder, handles configuration, and separates mail.
 */
MailboxSystem.loadMailData = function() {
    MailboxSystem._pendingMail = []; 

    if (MailboxSystem.loadJson) {
        const xhr = new XMLHttpRequest();
        const url = "data/MailData.json";
        xhr.open("GET", url);
        xhr.overrideMimeType("application/json");
        xhr.onload = function() {
            if (xhr.status === 200 || xhr.status === 0) {
                try {
                    const data = JSON.parse(xhr.responseText);

                    // 1. Check for and apply configuration overrides (if needed)
                    if (data.configuration) {
                        const config = data.configuration;
                        if (config["Gametime Plugin Name"]) {
                            MailboxSystem.gametimePlugin = String(config["Gametime Plugin Name"]);
                        }
                        if (config["Region ID"]) {
                            MailboxSystem.mailboxRegionId = Number(config["Region ID"]);
                        }
                    }

                    // 2. Set the mail definitions
                    const mailArray = Array.isArray(data.mail) ? data.mail : [];
                    MailboxSystem._pendingMail = mailArray;

                    MailboxSystem._pendingMail.forEach(mail => {
                        mail.read = false; 
                        mail.deleted = false;
                    });
                } catch (e) {
                    console.error("[MailboxSystem] Failed to parse MailData.json:", e);
                }
            } else {
                console.error("[MailboxSystem] Failed to load MailData.json. Status:", xhr.status);
            }
        };
        xhr.onerror = function() {
            console.error("[MailboxSystem] Error loading MailData.json.");
        };
        xhr.send();
    }
};

// Call the loading function once the scene is ready
(function() {
    const _Scene_Boot_loadSystemImages = Scene_Boot.prototype.loadSystemImages;
    Scene_Boot.prototype.loadSystemImages = function() {
        _Scene_Boot_loadSystemImages.call(this);
        MailboxSystem.loadMailData();
    };
})();

// ============================================================================
// GAME SYSTEM EXTENSIONS
// ============================================================================

const _Game_System_initialize = Game_System.prototype.initialize;
Game_System.prototype.initialize = function() {
    _Game_System_initialize.call(this);
    this.mailbox = {
        inbox: [], 
        deletedMailIds: [], 
    };
};

// ============================================================================
// TIME CHECK AND DELIVERY LOGIC
// ============================================================================

/**
 * Internal helper to look up the Game Time API object based on the plugin parameter.
 */
MailboxSystem._getGameTimeAPI = function() {
    return (
        window.GameTimeManager ||
        window.GameTime ||
        window[MailboxSystem.gametimePlugin] ||
        null
    );
};

/**
 * Compares the current game time with a mail item's timestamp.
 */
MailboxSystem.isMailReady = function(mail) {
    const GT = MailboxSystem._getGameTimeAPI();

    if (!GT || typeof GT.getYears !== 'function') {
        return true; 
    }

    const current = {
        year: GT.getYears(),
        month: GT.getMonths(),
        day: GT.getDays(),
        hour: GT.getHours(),
        minute: GT.getMinutes(),
        second: GT.getSeconds(),
    };

    const mailTime = {
        year: mail.year || 0,
        month: mail.month || 0,
        day: mail.day || 0,
        hour: mail.hour || 0,
        minute: mail.minute || 0,
        second: mail.second || 0,
    };

    const compareTime = (c, m) => c > m ? 1 : (c < m ? -1 : 0);

    let comparison = 0;

    comparison = compareTime(current.year, mailTime.year);
    if (comparison !== 0) return comparison > 0;

    comparison = compareTime(current.month, mailTime.month);
    if (comparison !== 0) return comparison > 0;

    comparison = compareTime(current.day, mailTime.day);
    if (comparison !== 0) return comparison > 0;

    comparison = compareTime(current.hour, mailTime.hour);
    if (comparison !== 0) return comparison > 0;

    comparison = compareTime(current.minute, mailTime.minute);
    if (comparison !== 0) return comparison > 0;

    comparison = compareTime(current.second, mailTime.second);
    return comparison >= 0;
};

/**
 * Checks pending mail and moves eligible items to the player's inbox.
 */
MailboxSystem.checkMailDelivery = function() {
    if (!$gameSystem || !$gameSystem.mailbox) return;

    const deliveredMail = [];
    const newPendingMail = [];

    for (const mail of MailboxSystem._pendingMail) {
        if (MailboxSystem.isMailReady(mail)) {
            mail.mailId = mail.mailId || Date.now() + Math.random();
            deliveredMail.push(mail);
        } else {
            newPendingMail.push(mail);
        }
    }

    MailboxSystem._pendingMail = newPendingMail;

    deliveredMail.forEach(mail => {
        if (!$gameSystem.mailbox.inbox.find(m => m.mailId === mail.mailId) &&
            !$gameSystem.mailbox.deletedMailIds.includes(mail.mailId)) {
            $gameSystem.mailbox.inbox.push(mail);
        }
    });
};

// ============================================================================
// AUTO OPEN AND MAP HOOK
// ============================================================================

/**
 * Checks if the player is on the mailbox region and automatically opens the UI.
 */
MailboxSystem.checkAutoOpenMailbox = function() {
    // 1. Check if the player is currently on the designated Region ID
    if ($gamePlayer.regionId() === MailboxSystem.mailboxRegionId) {

        const scene = SceneManager._scene;

        // 2. Skip auto-open if the cooldown is active
        if (MailboxSystem._cooldown) return;

        // 3. Check scene context: must be on map, not in the mailbox, and not busy
        if (scene instanceof Scene_Map && !(scene instanceof Scene_Mailbox) && !scene.isBusy()) {

            // 4. Prevent opening the mailbox during movement (robust trigger on step stop)
            if (!$gamePlayer.isMoving()) {
                // Halt player movement immediately and push the scene
                $gamePlayer._stopCount = 1;
                SceneManager.push(Scene_Mailbox);
            }
        }
    } else {
        // If player moves off the region, clear the cooldown flag
        if (MailboxSystem._cooldown) {
            MailboxSystem._cooldown = false;
        }
    }
};

// Hook into the scene update loop to regularly check for new mail AND auto-open
const _Scene_Map_update = Scene_Map.prototype.update;
Scene_Map.prototype.update = function() {
    _Scene_Map_update.call(this);

    // Check for mail delivery (e.g., every 60 frames)
    if (Graphics.frameCount % 60 === 0) {
        MailboxSystem.checkMailDelivery();
    }

    // Check for auto-open every frame
    MailboxSystem.checkAutoOpenMailbox();
};

// ============================================================================
// SCENE MAILBOX UI
// ============================================================================

/**
 * A custom Scene class to manage the mailbox UI.
 */
function Scene_Mailbox() {
    this.initialize(...arguments);
}

Scene_Mailbox.prototype = Object.create(Scene_MenuBase.prototype);
Scene_Mailbox.prototype.constructor = Scene_Mailbox;

Scene_Mailbox.prototype.initialize = function() {
    Scene_MenuBase.prototype.initialize.call(this);
};

Scene_Mailbox.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createMailListWindow();
    this.createReadWindow(); // Now creates the command window
    this.createBodyWindow(); // NEW: Creates the scrollable text window
    this.updateMailList(); 

    this._mailListWindow.activate();
    if (this._mailListWindow.maxItems() > 0) {
        this._mailListWindow.select(0);
    }
};

// Hook into popScene to set the cooldown when the scene is closed.
const _Scene_Mailbox_popScene = Scene_Mailbox.prototype.popScene;
Scene_Mailbox.prototype.popScene = function() {
    _Scene_Mailbox_popScene.call(this);
    MailboxSystem._cooldown = true;
};

// --- Window Rectangles ---

Scene_Mailbox.prototype.mailListWindowRect = function() {
    const ww = Graphics.boxWidth * 0.4;
    const wh = Graphics.boxHeight;
    const wx = 0;
    const wy = 0;
    return new Rectangle(wx, wy, ww, wh);
};

// Rect for the Header and Commands (top/bottom bar of the right side)
Scene_Mailbox.prototype.readWindowRect = function() {
    const listRect = this.mailListWindowRect();
    const ww = Graphics.boxWidth - listRect.width;
    const wh = Graphics.boxHeight;
    const wx = listRect.width;
    const wy = 0;
    return new Rectangle(wx, wy, ww, wh);
};

// Rect for the Scrollable Body text (middle section of the right side)
Scene_Mailbox.prototype.bodyWindowRect = function() {
    const rect = this.readWindowRect();
    const lh = this._readWindow ? this._readWindow.lineHeight() : 36;
    const headerLines = 3; // Subject, From, Time
    const commandLines = 1; // Close, Delete commands

    const wy = lh * headerLines + this._readWindow.padding * 2;
    const wh = rect.height - wy - (lh * commandLines + this._readWindow.padding * 2);

    return new Rectangle(rect.x, wy, rect.width, wh);
};

// --- Window Creation ---

Scene_Mailbox.prototype.createMailListWindow = function() {
    const rect = this.mailListWindowRect();
    this._mailListWindow = new Window_MailList(rect);
    this._mailListWindow.setHandler('ok', this.onMailListOk.bind(this));
    this._mailListWindow.setHandler('cancel', this.popScene.bind(this)); 
    this.addWindow(this._mailListWindow);
};

// Renamed from createReadWindow to createCommandWindow for clarity
Scene_Mailbox.prototype.createReadWindow = function() {
    const rect = this.readWindowRect();
    // Renamed the class from Window_ReadMail to Window_MailCommands
    this._readWindow = new Window_MailCommands(rect); 
    this._readWindow.deactivate();
    this._readWindow.hide();
    this.addWindow(this._readWindow);
};

// NEW: Create the scrollable body window
Scene_Mailbox.prototype.createBodyWindow = function() {
    const rect = this.bodyWindowRect();
    this._bodyWindow = new Window_MailBody(rect);
    this._bodyWindow.deactivate();
    this._bodyWindow.hide();
    this.addWindow(this._bodyWindow);
};

Scene_Mailbox.prototype.updateMailList = function() {
    this._mailListWindow.setupMailList($gameSystem.mailbox.inbox);
    this._mailListWindow.refresh();
};

Scene_Mailbox.prototype.onMailListOk = function() {
    const mail = this._mailListWindow.selectedMail();
    if (mail) {
        if (!mail.read) {
            mail.read = true;
            this._mailListWindow.refresh(); 
        }
        
        // Pass mail to both windows
        this._readWindow.setMail(mail);
        this._bodyWindow.setMail(mail); // NEW: Set mail body text

        this._readWindow.setHandler('cancel', this.onReadCancel.bind(this));
        this._readWindow.setHandler('delete', this.onDeleteMail.bind(this));

        this._readWindow.show();
        this._bodyWindow.show(); // Show the body window
        
        this._readWindow.activate(); // Command window gets initial focus
        this._mailListWindow.deactivate();
    } else {
        this._mailListWindow.activate();
    }
};

Scene_Mailbox.prototype.onReadCancel = function() {
    this._readWindow.hide();
    this._readWindow.deactivate();
    this._bodyWindow.hide(); // Hide the body window
    this._mailListWindow.activate();
};

Scene_Mailbox.prototype.onDeleteMail = function() {
    const index = this._mailListWindow.index();
    const mail = this._mailListWindow.selectedMail();

    if (mail) {
        if (!$gameSystem.mailbox.deletedMailIds.includes(mail.mailId)) {
             $gameSystem.mailbox.deletedMailIds.push(mail.mailId);
        }
        $gameSystem.mailbox.inbox.splice($gameSystem.mailbox.inbox.indexOf(mail), 1);

        this._readWindow.hide();
        this._readWindow.deactivate();
        this._bodyWindow.hide(); // Hide the body window
        this.updateMailList();

        const newIndex = Math.min(index, this._mailListWindow.maxItems() - 1);
        this._mailListWindow.select(newIndex);
        this._mailListWindow.activate();
    } else {
        this.onReadCancel();
    }
};

// ============================================================================
// WINDOW: MAIL LIST
// ============================================================================

/**
 * Custom Window to display the list of mail subjects.
 */
function Window_MailList() {
    this.initialize(...arguments);
}

Window_MailList.prototype = Object.create(Window_Selectable.prototype);
Window_MailList.prototype.constructor = Window_MailList;

Window_MailList.prototype.initialize = function(rect) {
    Window_Selectable.prototype.initialize.call(this, rect);
    this._mailList = [];
    this.refresh();
};

Window_MailList.prototype.setupMailList = function(mailArray) {
    this._mailList = mailArray.slice().reverse();
};

Window_MailList.prototype.maxItems = function() {
    return this._mailList && this._mailList.length > 0 ? this._mailList.length : 1;
};

Window_MailList.prototype.selectedMail = function() {
    if (!this._mailList || this._mailList.length === 0) return null;
    return this._mailList[this.index()];
};

Window_MailList.prototype.drawItem = function(index) {
    if (!this._mailList || this._mailList.length === 0) {
        const rect = this.itemLineRect(index);
        this.changeTextColor(ColorManager.textColor(7));
        this.drawText("No Mail", rect.x, rect.y, rect.width, "center");
        return;
    }

    const mail = this._mailList[index];
    if (mail) {
        const rect = this.itemLineRect(index);
        const iconBoxWidth = 24;

        this.resetTextColor();

        if (!mail.read) {
            this.changeTextColor(ColorManager.crisisColor());
            this.drawText("•", rect.x, rect.y, iconBoxWidth, "left");
            this.changeTextColor(ColorManager.normalColor());
        }

        const textX = rect.x + iconBoxWidth;
        const textW = rect.width - iconBoxWidth;

        if (!mail.read) {
            this.changeTextColor(ColorManager.textColor(0));
        } else {
            this.changeTextColor(ColorManager.textColor(7));
        }

        this.drawText(mail.subject || "(No Subject)", textX, rect.y, textW);
    }
};

// ============================================================================
// NEW WINDOW: MAIL BODY (Scrollable Text)
// ============================================================================

/**
 * NEW: Custom window purely for displaying the scrollable mail content.
 */
function Window_MailBody() {
    this.initialize(...arguments);
}

Window_MailBody.prototype = Object.create(Window_Base.prototype);
Window_MailBody.prototype.constructor = Window_MailBody;

Window_MailBody.prototype.initialize = function(rect) {
    Window_Base.prototype.initialize.call(this, rect);
    this._mail = null;
    this._scrollY = 0;
    this._maxTextHeight = 0;
    this.opacity = 255;
    this.createContents();
};

Window_MailBody.prototype.setMail = function(mail) {
    if (this._mail !== mail) {
        this._mail = mail;
        this.refresh();
    }
};

Window_MailBody.prototype.refresh = function() {
    this.contents.clear();
    this._scrollY = 0;

    if (!this._mail) return;

    // redrawMailBody() now calculates _maxTextHeight itself
    this.redrawMailBody();

    // Prevent negative scroll max
    this._maxTextHeight = Math.max(this._maxTextHeight, this.contentsHeight());
};


// Redraws the text based on the current scroll position
Window_MailBody.prototype.redrawMailBody = function() {
    this.contents.clear();
    if (!this._mail) return;

    const text = this._mail.body || "";
    const maxWidth = this.contentsWidth();
    const lineHeight = this.lineHeight();

    const wrappedLines = [];
    const words = text.split(" ");

    let current = "";

    // Simple word-wrap algorithm
    words.forEach(word => {
        const test = current.length > 0 ? current + " " + word : word;
        if (this.textWidth(test) > maxWidth) {
            wrappedLines.push(current);
            current = word;
        } else {
            current = test;
        }
    });

    if (current.length > 0) wrappedLines.push(current);

    // Calculate full height
    this._maxTextHeight = wrappedLines.length * lineHeight;

    // Draw lines respecting scrollY offset
    this.contents.y = -this._scrollY;

    let y = 0;
    for (let i = 0; i < wrappedLines.length; i++) {
        this.drawTextEx(wrappedLines[i], 0, y, maxWidth);
        y += lineHeight;
    }
};

Window_MailBody.prototype.update = function() {
    Window_Base.prototype.update.call(this);
    if (this.visible && this._mail) {
        this.updateScrolling();
    }
};

Window_MailBody.prototype.updateScrolling = function() {
    const scrollAmount = 8; // Pixels per step

    if (Input.isPressed('down')) {
        this._scrollY += scrollAmount;
        if (this._scrollY > this._maxScrollY()) {
            this._scrollY = this._maxScrollY();
        }
        this.redrawMailBody();
    }
    if (Input.isPressed('up')) {
        this._scrollY -= scrollAmount;
        if (this._scrollY < 0) {
            this._scrollY = 0;
        }
        this.redrawMailBody();
    }
    // Mouse wheel scrolling
    const wheelY = Input.wheelY;
    if (wheelY !== 0) {
        this._scrollY += wheelY * scrollAmount;
        this._scrollY = this._scrollY.clamp(0, this._maxScrollY());
        this.redrawMailBody();
    }
};

Window_MailBody.prototype._maxScrollY = function() {
    return Math.max(0, this._maxTextHeight - this.contentsHeight());
};

// ============================================================================
// WINDOW: MAIL COMMANDS (formerly Window_ReadMail)
// ============================================================================

/**
 * Custom Window to display the mail header and commands (no body text now).
 */
function Window_MailCommands() {
    this.initialize(...arguments);
}

Window_MailCommands.prototype = Object.create(Window_Command.prototype);
Window_MailCommands.prototype.constructor = Window_MailCommands;

Window_MailCommands.prototype.maxItems = function() {
    return this._list ? this._list.length : 0;
};

Window_MailCommands.prototype.initialize = function(rect) {
    Window_Command.prototype.initialize.call(this, rect);
    this._mail = null;
    this.opacity = 255;
};

Window_MailCommands.prototype.setMail = function(mail) {
    this._mail = mail;
    this.refresh();
};

Window_MailCommands.prototype.makeCommandList = function() {
    this.addCommand("Close", "cancel");
    this.addCommand("Delete", "delete");
};

Window_MailCommands.prototype.refresh = function() {
    // Clear the whole window content area (including commands)
    this.contents.clear();
    if (!this._mail) return;

    // Rebuild the command list and set contents size
    this.clearCommandList();
    this.makeCommandList();
    this.createContents();

    const mail = this._mail;
    const lh = this.lineHeight();

    // --- Draw Header in the top section ---
    this.drawText("Subject: " + (mail.subject || ""), 0, 0, this.contents.width, "left");
    this.drawText("From: " + (mail.sender || "Unknown"), 0, lh, this.contents.width, "left");

    const timestamp = `${mail.year}/${String(mail.month).padStart(2,'0')}/${String(mail.day).padStart(2,'0')} ${String(mail.hour).padStart(2,'0')}:${String(mail.minute).padStart(2,'0')}`;
    this.drawText("Time: " + timestamp, 0, lh * 2, this.contents.width, "left");

    // Separator line between header and body area
    this.contents.fillRect(0, lh * 3 - 1, this.contents.width, 1, ColorManager.normalColor());

    // Separator line between body area and commands
    const commandY = this.contentsHeight() - this.lineHeight();
    this.contents.fillRect(0, commandY - 1, this.contents.width, 1, ColorManager.normalColor());
    
    // --- Draw Commands in the bottom section ---
    this.repositionCommands();
    this.drawAllItems();
};

/** Repositions the commands to the bottom of the window. */
Window_MailCommands.prototype.repositionCommands = function() {
    const y = this.contentsHeight() - this.lineHeight();
    this._list.forEach(command => {
        command.y = y;
    });
};

/** Ensures command items are drawn at the bottom. */
Window_MailCommands.prototype.drawItem = function(index) {
    const rect = this.itemRectWithPadding(index);
    rect.y = this.contentsHeight() - this.lineHeight(); // Force Y position to bottom
    this.drawBackgroundRect(rect);
    this.drawText(this.commandName(index), rect.x, rect.y, rect.width, this.itemTextAlign());
};

Window_MailCommands.prototype.itemRectWithPadding = function(index) {
    const max = this.maxItems();
    const width = this.contents.width / max;
    const rect = new Rectangle(0, 0, width, this.lineHeight());
    rect.x = index * width;
    return rect;
};

// ============================================================================
// NEW HELPER FUNCTIONS
// ============================================================================

/**
 * Standardizes a mail object and adds it to the player's inbox.
 */
MailboxSystem.addMailToInbox = function(mail) {
    if (!$gameSystem || !$gameSystem.mailbox || typeof mail !== 'object' || Array.isArray(mail)) {
        console.warn("[MailboxSystem] Attempted to add invalid mail object:", mail);
        return;
    }

    // Set necessary persistent/state flags
    mail.mailId = mail.mailId || Date.now() + Math.random();
    mail.read = false; 
    mail.deleted = false;

    // Only add if not already in the inbox and not previously deleted
    if (!$gameSystem.mailbox.inbox.find(m => m.mailId === mail.mailId) &&
        !$gameSystem.mailbox.deletedMailIds.includes(mail.mailId)) {
        $gameSystem.mailbox.inbox.push(mail);
    } else {
        console.info("[MailboxSystem] Mail with ID", mail.mailId, "already exists or was deleted. Skipping.");
    }
};

/**
 * Loads a JSON file from the project's data directory.
 */
MailboxSystem._loadDataFile = function(filePath, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", filePath);
    xhr.overrideMimeType("application/json");

    xhr.onload = function() {
        if (xhr.status === 200 || xhr.status === 0) {
            try {
                const data = JSON.parse(xhr.responseText);
                callback(data);
            } catch (e) {
                console.error(`[MailboxSystem] Failed to parse JSON file '${filePath}':`, e);
            }
        } else {
            console.error(`[MailboxSystem] Failed to load JSON file '${filePath}'. Status:`, xhr.status);
        }
    };
    
    xhr.onerror = function() {
        console.error(`[MailboxSystem] Error loading JSON file '${filePath}'.`);
    };
    
    xhr.send();
};

// ============================================================================
// PLUGIN COMMAND HANDLERS
// ============================================================================

PluginManager.registerCommand(MailboxSystem.pluginName, "checkMail", () => {
    SceneManager.push(Scene_Mailbox);
});

PluginManager.registerCommand(MailboxSystem.pluginName, "deleteLetter", () => {
    const scene = SceneManager._scene;
    if (scene instanceof Scene_Mailbox) {
        scene.onDeleteMail();
    }
});

PluginManager.registerCommand(MailboxSystem.pluginName, "closeMail", () => {
    if (SceneManager._scene instanceof Scene_Mailbox) {
        SceneManager.pop();
    }
});

/**
 * Registers the 'sendLetterFromString' command to parse a JSON string and add the mail.
 */
PluginManager.registerCommand(MailboxSystem.pluginName, "sendLetterFromString", args => {
    const mailJsonString = args.mailJson;
    if (mailJsonString) {
        try {
            const mail = JSON.parse(mailJsonString);
            MailboxSystem.addMailToInbox(mail);
        } catch (e) {
            console.error("[MailboxSystem] Plugin Command Error: Failed to parse mailJson string.", e);
        }
    }
});

/* -------------------------------------------------------------
   Helper – resolve a filename to the path used by loadDataFile
   ------------------------------------------------------------- */
MailboxSystem._resolveMailPath = function (fileName) {
    // Remove any leading/trailing spaces
    const trimmed = fileName.trim();

    // If the argument already contains a folder separator, keep it,
    // otherwise prepend the default "mail/" folder.
    const hasFolder = trimmed.includes('/') || trimmed.includes('\\');
    const baseFolder = hasFolder ? '' : 'data/mail/';

    // Strip the .json extension (case‑insensitive)
    const cleanName = trimmed.replace(/\.json$/i, '');

    return baseFolder + cleanName + ".json";
};

/* -------------------------------------------------------------
   Updated command – sendLetterFromFile
   ------------------------------------------------------------- */
PluginManager.registerCommand(
    MailboxSystem.pluginName,
    "sendLetterFromFile",
    args => {
        const rawPath = args.filePath;
        if (!rawPath) {
            console.warn("[MailboxSystem] sendLetterFromFile called with empty path.");
            return;
        }

        const resolvedPath = MailboxSystem._resolveMailPath(rawPath); // e.g. "mail/quest1.json"

        // Use your helper which accepts a callback
        MailboxSystem._loadDataFile(resolvedPath, (data) => {
            if (!data) {
                console.warn(`[MailboxSystem] Could not load file '${resolvedPath}'`);
                return;
            }
            const mails = Array.isArray(data) ? data : [data];
            mails.forEach(mail => MailboxSystem.addMailToInbox(mail));
            console.log(`[MailboxSystem] sendLetterFromFile loaded ${mails.length} mail(s) from ${resolvedPath}`);
        });
    }
);


// Expose the global object
window.MailboxSystem = MailboxSystem;
