/*:
 * @target MZ
 * @plugindesc [MZ] Adds a time-sensitive, persistent mailbox system with auto-open on region trigger.
 * @author Gemini RPG Dev
 *
 * @param Gametime Plugin Name
 * @type string
 * @default GameTime
 * @desc The name of the plugin that provides the Game_Time global object and methods. This is the default if not overridden by JSON.
 *
 * @param Region ID
 * @type number
 * @min 1
 * @max 255
 * @default 10
 * @desc The Map Region ID that will act as the mailbox interaction location. Default if not overridden by JSON.
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
 * @command readLetter
 * @text Read Selected Letter
 * @desc Opens the selected mail item to display its full content.
 *
 * @command deleteLetter
 * @text Delete Selected Letter
 * @desc Deletes the currently selected mail item from the inbox.
 *
 * @command closeMail
 * @text Close Mailbox
 * @desc Closes the mailbox UI and returns to the game map.
 *
 * ---------------------------------------------------------------------------
 * Auto-Open Feature (New)
 * ---------------------------------------------------------------------------
 * This plugin now automatically opens the mailbox scene whenever the player
 * steps onto a tile marked with the configured Region ID.
 *
 * ---------------------------------------------------------------------------
 * Configuration via JSON
 * ---------------------------------------------------------------------------
 * The MailData.json file can contain a top-level 'configuration' object
 * to override the Gametime Plugin Name and Region ID set in the Plugin Manager.
 */

// Global alias for the plugin
const MailboxSystem = {};
MailboxSystem.parameters = PluginManager.parameters("MailboxSystem");

// Initialize parameters from Plugin Manager defaults
MailboxSystem.gametimePlugin = String(MailboxSystem.parameters["Gametime Plugin Name"] || "GameTime");
MailboxSystem.mailboxRegionId = Number(MailboxSystem.parameters["Region ID"] || 10);
MailboxSystem.loadJson = eval(MailboxSystem.parameters["Load JSON"] || "true");

// --- Plugin Data Storage ---
MailboxSystem._pendingMail = [];

/**
 * Loads the MailData.json file from the data folder, handles configuration, and separates mail.
 */
MailboxSystem.loadMailData = function() {
    if (MailboxSystem.loadJson) {
        const xhr = new XMLHttpRequest();
        const url = "data/MailData.json";
        xhr.open("GET", url);
        xhr.overrideMimeType("application/json");
        xhr.onload = function() {
            if (xhr.status === 200 || xhr.status === 0) {
                const data = JSON.parse(xhr.responseText);
                
                // 1. Check for and apply configuration overrides
                if (data.configuration) {
                    const config = data.configuration;
                    if (config["Gametime Plugin Name"]) {
                        MailboxSystem.gametimePlugin = String(config["Gametime Plugin Name"]);
                        console.log("[MailboxSystem] Gametime Plugin Name overridden by JSON:", MailboxSystem.gametimePlugin);
                    }
                    if (config["Region ID"]) {
                        MailboxSystem.mailboxRegionId = Number(config["Region ID"]);
                        console.log("[MailboxSystem] Region ID overridden by JSON:", MailboxSystem.mailboxRegionId);
                    }
                }

                // 2. Set the mail definitions (assuming the mail array is under the 'mail' key)
                const mailArray = Array.isArray(data.mail) ? data.mail : [];
                MailboxSystem._pendingMail = mailArray;
                
                MailboxSystem._pendingMail.forEach(mail => {
                    mail.read = false;
                    mail.deleted = false;
                });
            } else {
                console.error("Failed to load MailData.json. Status:", xhr.status);
            }
        };
        xhr.onerror = function() {
            console.error("Error loading MailData.json.");
        };
        xhr.send();
    }
};

// Call the loading function once the scene is ready
(() => {
    const _Scene_Boot_loadSystemImages = Scene_Boot.prototype.loadSystemImages;
    Scene_Boot.prototype.loadSystemImages = function() {
        _Scene_Boot_loadSystemImages.call(this);
        MailboxSystem.loadMailData();
    };
})();

// --- Game_System Extensions for Persistence ---

const _Game_System_initialize = Game_System.prototype.initialize;
Game_System.prototype.initialize = function() {
    _Game_System_initialize.call(this);
    this.mailbox = {
        inbox: [],
        deletedMailIds: [],
    };
};

// --- Time Check and Mail Delivery Logic ---

/**
 * Compares the current game time with a mail item's timestamp.
 */
MailboxSystem.isMailReady = function(mail) {
    // Correctly reference the global GameTimeManager object (as fixed previously)
    const GameTime = window.GameTimeManager; 
    
    if (!GameTime || typeof GameTime.getYears !== 'function') {
        console.warn(`[MailboxSystem] Game Time API (GameTimeManager) not found. Is '${MailboxSystem.gametimePlugin}' loaded BEFORE this plugin? Skipping time check.`);
        return false;
    }

    const current = {
        year: GameTime.getYears(),
        month: GameTime.getMonths(),
        day: GameTime.getDays(),
        hour: GameTime.getHours(),
        minute: GameTime.getMinutes(),
        second: GameTime.getSeconds(),
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

    if (deliveredMail.length > 0) {
        console.log(`[MailboxSystem] Delivered ${deliveredMail.length} new mail items.`);
    }
};

/**
 * NEW: Checks if the player is on the mailbox region and automatically opens the UI.
 */
MailboxSystem.checkAutoOpenMailbox = function() {
    // 1. Check if the player is currently on the designated Region ID
    if ($gamePlayer.regionId() === MailboxSystem.mailboxRegionId) {
        // 2. Check if we are already in the mailbox scene or if the scene transition is busy
        const scene = SceneManager._scene;
		if (!(scene instanceof Scene_Mailbox) && !scene.isBusy()) {
            // 3. Prevent opening the mailbox during movement
            if (!$gamePlayer.isMoving()) {
                SceneManager.push(Scene_Mailbox);
                // Halt player movement immediately
                $gamePlayer._stopCount = 1; // Keeping user's specific stop code
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

// --- Mailbox UI Windows (Rest of the UI logic remains the same) ---

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
    this.updateMailList();
};

Scene_Mailbox.prototype.createMailListWindow = function() {
    const rect = this.mailListWindowRect();
    this._mailListWindow = new Window_MailList(rect);
    this._mailListWindow.setHandler('ok', this.onMailListOk.bind(this));
    this._mailListWindow.setHandler('cancel', this.popScene.bind(this));
    this._mailListWindow.select(0);
    this._mailListWindow.activate();
    this.addWindow(this._mailListWindow);
};

Scene_Mailbox.prototype.mailListWindowRect = function() {
    const ww = Graphics.boxWidth * 0.4;
    const wh = Graphics.boxHeight;
    const wx = 0;
    const wy = 0;
    return new Rectangle(wx, wy, ww, wh);
};

Scene_Mailbox.prototype.createReadWindow = function() {
    const rect = this.readWindowRect();
    this._readWindow = new Window_ReadMail(rect);
    this._readWindow.deactivate();
    this._readWindow.hide();
    this.addWindow(this._readWindow);
};

Scene_Mailbox.prototype.readWindowRect = function() {
    const listRect = this.mailListWindowRect();
    const ww = Graphics.boxWidth - listRect.width;
    const wh = Graphics.boxHeight;
    const wx = listRect.width;
    const wy = 0;
    return new Rectangle(wx, wy, ww, wh);
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
        this._readWindow.setMail(mail);
        this._readWindow.setHandler('cancel', this.onReadCancel.bind(this));
        this._readWindow.setHandler('delete', this.onDeleteMail.bind(this));

        this._readWindow.show();
        this._readWindow.activate();
        this._mailListWindow.deactivate();
    } else {
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
        $gameSystem.mailbox.inbox.splice(index, 1);
        
        this._readWindow.hide();
        this._readWindow.deactivate();
        this.updateMailList();
        this._mailListWindow.select(Math.min(index, this._mailListWindow.maxItems() - 1));
        this._mailListWindow.activate();
    } else {
        this._readWindow.hide();
        this._readWindow.deactivate();
        this._mailListWindow.activate();
    }
};

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
        const iconBoxWidth = this.innerHeight / this.maxItems() * 0.8;
        
        this.resetTextColor();
        
        if (!mail.read) {
            this.changeTextColor(ColorManager.crisisColor());
            this.drawText("•", rect.x, rect.y, iconBoxWidth, "left");
            this.changeTextColor(ColorManager.normalColor());
        }

        const textX = rect.x + iconBoxWidth;
        const textW = rect.width - iconBoxWidth;
        const subject = mail.subject || "No Subject";
        
        if (!mail.read) {
            this.changeTextColor(ColorManager.textColor(0));
        } else {
             this.changeTextColor(ColorManager.textColor(7));
        }
        
        this.drawText(subject, textX, rect.y, textW);
    }
};

/**
 * Custom Window to display the full mail content.
 */
function Window_ReadMail() {
    this.initialize(...arguments);
}

Window_ReadMail.prototype = Object.create(Window_Command.prototype);
Window_ReadMail.prototype.constructor = Window_ReadMail;

// FIX: Add safe maxItems override to prevent 'length' of undefined error
Window_ReadMail.prototype.maxItems = function() {
    return this._list ? this._list.length : 0;
};

Window_ReadMail.prototype.initialize = function(rect) {
    Window_Command.prototype.initialize.call(this, rect);
    this._mail = null;
    this._page = 0;
    this.opacity = 255;
};

Window_ReadMail.prototype.setMail = function(mail) {
    this._mail = mail;
    this._page = 0;
    this.refresh();
};

Window_ReadMail.prototype.makeCommandList = function() {
    this.addCommand("Close", "cancel");
    this.addCommand("Delete", "delete");
};

Window_ReadMail.prototype.refresh = function() {
    this.contents.clear();
    if (!this._mail) return;

    const mail = this._mail;
    const bodyText = mail.body || "No body content.";
    const headerH = this.lineHeight() * 4;

    // --- Draw Header ---
    this.drawText("Subject: " + (mail.subject || ""), 0, 0, this.contents.width, "left");
    this.drawText("From: " + (mail.sender || "Unknown"), 0, this.lineHeight(), this.contents.width, "left");
    
    const timestamp = `${mail.year}/${String(mail.month).padStart(2, '0')}/${String(mail.day).padStart(2, '0')} ${String(mail.hour).padStart(2, '0')}:${String(mail.minute).padStart(2, '0')}`;
    this.drawText("Time: " + timestamp, 0, this.lineHeight() * 2, this.contents.width, "left");
    
    // Separator
    this.drawRect(0, this.lineHeight() * 3, this.contents.width, 1, ColorManager.normalColor());
    
    // --- Draw Body (with text wrapping) ---
    const bodyY = headerH;
    const bodyW = this.contents.width;
    
    this.drawTextEx(bodyText, 0, bodyY, bodyW);
    
    this.repositionCommands();
    this.drawAllItems();
};

Window_ReadMail.prototype.repositionCommands = function() {
    const y = this.contentsHeight() - this.lineHeight(); 
    this._list.forEach(command => {
        command.y = y;
    });
};

Window_ReadMail.prototype.drawItem = function(index) {
    const rect = this.itemRectWithPadding(index);
    rect.y = this.contentsHeight() - this.lineHeight();
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

// --- Plugin Command Handlers ---

/**
 * Opens the Mailbox UI (still available for manual event calls).
 */
PluginManager.registerCommand("MailboxSystem", "checkMail", args => {
    SceneManager.push(Scene_Mailbox);
});

PluginManager.registerCommand("MailboxSystem", "readLetter", args => {
    // UI selection handles this
});

PluginManager.registerCommand("MailboxSystem", "deleteLetter", args => {
    const scene = SceneManager._scene;
    if (scene instanceof Scene_Mailbox) {
        scene.onDeleteMail();
    }
});

/**
 * Closes the Mailbox UI.
 */
PluginManager.registerCommand("MailboxSystem", "closeMail", args => {
	if (SceneManager._scene instanceof Scene_Mailbox) {
		SceneManager.pop();
	}
});

// --- Player Region Check (Utility) ---

MailboxSystem.playerOnMailboxRegion = function() {
    return $gamePlayer.regionId() === MailboxSystem.mailboxRegionId;
};

// Expose for use in Conditional Branches/Script Calls
window.MailboxSystem = MailboxSystem;
