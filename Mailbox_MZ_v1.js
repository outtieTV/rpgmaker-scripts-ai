/*:
 * @target MZ
 * @plugindesc [MZ] A robust, time-sensitive, persistent mailbox system with auto-open on region trigger.
 * @author Gemini RPG Dev
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
 * @param Load JSON
 * @type boolean
 * @default true
 * @desc If true, mail definitions are loaded from data/MailData.json at startup.
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
MailboxSystem.pluginName = "Mailbox_MZ_v1"; // Consistent internal name for parameters and commands

MailboxSystem.parameters = PluginManager.parameters(MailboxSystem.pluginName);

// Initialize parameters from Plugin Manager defaults
MailboxSystem.gametimePlugin = String(MailboxSystem.parameters["Gametime Plugin Name"] || "GameTime");
MailboxSystem.mailboxRegionId = Number(MailboxSystem.parameters["Region ID"] || 10);
MailboxSystem.loadJson = eval(MailboxSystem.parameters["Load JSON"] || "true");

// --- Plugin Data Storage ---
MailboxSystem._pendingMail = [];

// ============================================================================
// LOAD JSON
// ============================================================================

/**
 * Loads the MailData.json file from the data folder, handles configuration, and separates mail.
 */
MailboxSystem.loadMailData = function() {
    MailboxSystem._pendingMail = []; // Reset in case of multiple loads (safety)

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

                    // This forEach loop is now safe as MailboxSystem._pendingMail is an array
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
    // Check common names and the name from plugin parameters
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

    // **FIXED:** If GameTime API is not available, assume mail is ready for delivery.
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

    // Helper function to compare time components
    const compareTime = (c, m) => c > m ? 1 : (c < m ? -1 : 0);

    let comparison = 0;

    // Compare in descending order of time granularity (Year -> Second)
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
    return comparison >= 0; // >= check for the smallest unit (seconds)
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
            // Assign a unique ID if one doesn't exist
            mail.mailId = mail.mailId || Date.now() + Math.random();
            deliveredMail.push(mail);
        } else {
            newPendingMail.push(mail);
        }
    }

    MailboxSystem._pendingMail = newPendingMail;

    deliveredMail.forEach(mail => {
        // Only deliver if not already in inbox AND not marked as deleted
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
        // 2. We only care if the player has mail
        if ($gameSystem.mailbox.inbox.length === 0) return;

        const scene = SceneManager._scene;

        // 3. Check scene context: must be on map, not in the mailbox, and not busy
        if (scene instanceof Scene_Map && !(scene instanceof Scene_Mailbox) && !scene.isBusy()) {

            // 4. Prevent opening the mailbox during movement (robust trigger on step stop)
            if (!$gamePlayer.isMoving()) {
                // Halt player movement immediately and push the scene
                $gamePlayer._stopCount = 1;
                SceneManager.push(Scene_Mailbox);
            }
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
    this.createReadWindow();
    this.updateMailList(); // Initial list refresh

    // CRITICAL FIX: Activate the list window and select the first item
    this._mailListWindow.activate();
    if (this._mailListWindow.maxItems() > 0) {
        this._mailListWindow.select(0);
    }
};

Scene_Mailbox.prototype.mailListWindowRect = function() {
    const ww = Graphics.boxWidth * 0.4;
    const wh = Graphics.boxHeight;
    const wx = 0;
    const wy = 0;
    return new Rectangle(wx, wy, ww, wh);
};

Scene_Mailbox.prototype.readWindowRect = function() {
    const listRect = this.mailListWindowRect();
    const ww = Graphics.boxWidth - listRect.width;
    const wh = Graphics.boxHeight;
    const wx = listRect.width;
    const wy = 0;
    return new Rectangle(wx, wy, ww, wh);
};

Scene_Mailbox.prototype.createMailListWindow = function() {
    const rect = this.mailListWindowRect();
    this._mailListWindow = new Window_MailList(rect);
    this._mailListWindow.setHandler('ok', this.onMailListOk.bind(this));
    this._mailListWindow.setHandler('cancel', this.popScene.bind(this));
    this.addWindow(this._mailListWindow);
};

Scene_Mailbox.prototype.createReadWindow = function() {
    const rect = this.readWindowRect();
    this._readWindow = new Window_ReadMail(rect);
    this._readWindow.deactivate();
    this._readWindow.hide();
    this.addWindow(this._readWindow);
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
            this._mailListWindow.refresh(); // Update the icon/color
        }
        this._readWindow.setMail(mail);
        this._readWindow.setHandler('cancel', this.onReadCancel.bind(this));
        this._readWindow.setHandler('delete', this.onDeleteMail.bind(this));

        this._readWindow.show();
        this._readWindow.activate();
        this._mailListWindow.deactivate();
    } else {
        // If no mail, stay active but do nothing on OK
        this._mailListWindow.activate();
    }
};

Scene_Mailbox.prototype.onReadCancel = function() {
    this._readWindow.hide();
    this._readWindow.deactivate();
    this._mailListWindow.activate();
};

Scene_Mailbox.prototype.onDeleteMail = function() {
    const index = this._mailListWindow.index();
    const mail = this._mailListWindow.selectedMail();

    if (mail) {
        if (!$gameSystem.mailbox.deletedMailIds.includes(mail.mailId)) {
             $gameSystem.mailbox.deletedMailIds.push(mail.mailId);
        }
        // Remove from inbox
        $gameSystem.mailbox.inbox.splice($gameSystem.mailbox.inbox.indexOf(mail), 1);

        this._readWindow.hide();
        this._readWindow.deactivate();
        this.updateMailList();

        // Select the next available item
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
    // Reverse array so latest mail is at the top (index 0)
    this._mailList = mailArray.slice().reverse();
};

Window_MailList.prototype.maxItems = function() {
    return this._mailList ? this._mailList.length : 0;
};

Window_MailList.prototype.selectedMail = function() {
    const index = this.index();
    return this._mailList && index >= 0 ? this._mailList[index] : null;
};

Window_MailList.prototype.drawItem = function(index) {
    const mail = this._mailList[index];
    if (mail) {
        const rect = this.itemLineRect(index);
        const iconBoxWidth = 24; // Width for the 'unread' indicator

        this.resetTextColor();

        // Draw unread indicator
        if (!mail.read) {
            this.changeTextColor(ColorManager.crisisColor());
            this.drawText("•", rect.x, rect.y, iconBoxWidth, "left");
            this.changeTextColor(ColorManager.normalColor());
        }

        const textX = rect.x + iconBoxWidth;
        const textW = rect.width - iconBoxWidth;
        const subject = mail.subject || "(No Subject)";

        // Change text color based on read status
        if (!mail.read) {
            this.changeTextColor(ColorManager.textColor(0)); // Brighter color for unread
        } else {
            this.changeTextColor(ColorManager.textColor(7)); // Dimmer color for read
        }

        this.drawText(subject, textX, rect.y, textW);
    }
};

// ============================================================================
// WINDOW: READ MAIL
// ============================================================================

/**
 * Custom Window to display the full mail content and commands.
 */
function Window_ReadMail() {
    this.initialize(...arguments);
}

Window_ReadMail.prototype = Object.create(Window_Command.prototype);
Window_ReadMail.prototype.constructor = Window_ReadMail;

Window_ReadMail.prototype.maxItems = function() {
    return this._list ? this._list.length : 0;
};

Window_ReadMail.prototype.initialize = function(rect) {
    Window_Command.prototype.initialize.call(this, rect);
    this._mail = null;
    this.opacity = 255;
};

Window_ReadMail.prototype.setMail = function(mail) {
    this._mail = mail;
    this.refresh();
};

Window_ReadMail.prototype.makeCommandList = function() {
    this.addCommand("Close", "cancel");
    this.addCommand("Delete", "delete");
};

Window_ReadMail.prototype.refresh = function() {
    // Clear window contents
    this.contents.clear();

    if (!this._mail) return;

    // -------------------------------------------------------------------------
    // FIX: Rebuild command list BEFORE drawing or repositioning
    // -------------------------------------------------------------------------
    this.clearCommandList();       // resets this._list
    this.makeCommandList();        // repopulates this._list
    this.createContents();         // sets correct contents size
    // -------------------------------------------------------------------------

    const mail = this._mail;
    const bodyText = mail.body || "No body content.";
    const lh = this.lineHeight();
    const headerH = lh * 4;

    // --- Header ---
    this.drawText("Subject: " + (mail.subject || ""), 0, 0, this.contents.width, "left");
    this.drawText("From: " + (mail.sender || "Unknown"), 0, lh, this.contents.width, "left");

    const timestamp = `${mail.year}/${String(mail.month).padStart(2,'0')}/${String(mail.day).padStart(2,'0')} ${String(mail.hour).padStart(2,'0')}:${String(mail.minute).padStart(2,'0')}`;
    this.drawText("Time: " + timestamp, 0, lh * 2, this.contents.width, "left");

    // Separator
    this.contents.fillRect(0, lh * 3 - 1, this.contents.width, 1, ColorManager.normalColor());

    // --- Body ---
    const bodyY = headerH;
    const bodyW = this.contents.width;
    this.drawTextEx(bodyText, 0, bodyY, bodyW);

    // --- Commands ---
    this.repositionCommands();
    this.drawAllItems();
};

/** Repositions the commands to the bottom of the window. */
Window_ReadMail.prototype.repositionCommands = function() {
    const y = this.contentsHeight() - this.lineHeight();
    this._list.forEach(command => {
        command.y = y;
    });
};

/** Ensures command items are drawn at the bottom. */
Window_ReadMail.prototype.drawItem = function(index) {
    const rect = this.itemRectWithPadding(index);
    rect.y = this.contentsHeight() - this.lineHeight(); // Force Y position to bottom
    this.drawBackgroundRect(rect);
    this.drawText(this.commandName(index), rect.x, rect.y, rect.width, this.itemTextAlign());
};

Window_ReadMail.prototype.itemRectWithPadding = function(index) {
    const max = this.maxItems();
    const width = this.contents.width / max;
    const rect = new Rectangle(0, 0, width, this.lineHeight());
    rect.x = index * width;
    return rect;
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

// Expose the global object
window.MailboxSystem = MailboxSystem;
