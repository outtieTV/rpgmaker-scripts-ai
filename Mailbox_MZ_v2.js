/*:
 * @target MZ
 * @plugindesc [MZ] A robust, location-specific persistent mailbox system.
 * @author OuttieTV
 *
 * @param Load JSON
 * @type boolean
 * @default true
 * @desc If true, mail definitions are loaded from data/MailData.json at startup.
 *
 * @param Gametime Plugin Name
 * @type string
 * @default GameTime_MZ_v1
 * @desc The name of the plugin that provides the Game_Time global object.
 *
 * @param Default Region ID
 * @type number
 * @min 1
 * @max 255
 * @default 10
 * @desc The Map Region ID that triggers the mailbox if no specific ID is provided.
 *
 * @help
 * ---------------------------------------------------------------------------
 * Location-Based Logic
 * ---------------------------------------------------------------------------
 * You can now restrict letters to specific mailboxes. In your JSON or
 * Plugin Command, include:
 * - "mapId": 5 (or [5, 6])
 * - "regionId": 10 (or [10, 11])
 *
 * If these are omitted, the letter appears in ALL mailboxes.
 *
 * ---------------------------------------------------------------------------
 * Plugin Commands
 * ---------------------------------------------------------------------------
 *
 * @command checkMail
 * @text Check Mailbox
 * @desc Opens mailbox. Optionally filter by specific map/region.
 * @arg mapId
 * @type number
 * @desc Optional: Only show mail for this Map ID. Leave 0 for current map.
 * @arg regionId
 * @type number
 * @desc Optional: Only show mail for this Region ID. Leave 0 for current region.
 *
 * @command sendLetterFromString
 * @text Send Letter (JSON String)
 * @desc Adds a letter. Include mapId/regionId in JSON for localization.
 * @arg mailJson
 * @type string
 * @desc {"subject": "Local News", "body": "Hello!", "mapId": 1, "regionId": 10}
 *
 * @command sendLetterFromFile
 * @text Send Letter (JSON File)
 * @desc Loads letters from file. Letters can have mapId/regionId arrays.
 * @arg filePath
 * @type string
 * @desc The relative path (e.g., data/mail/quest1.json)
 */

const MailboxSystem = {};
MailboxSystem.pluginName = "Mailbox_MZ_v2";
MailboxSystem.parameters = PluginManager.parameters(MailboxSystem.pluginName);

MailboxSystem.gametimePlugin = String(MailboxSystem.parameters["Gametime Plugin Name"] || "GameTime_MZ_v1");
MailboxSystem.mailboxRegionId = Number(MailboxSystem.parameters["Default Region ID"] || 10);
MailboxSystem.loadJson = eval(MailboxSystem.parameters["Load JSON"] || "true");

MailboxSystem._pendingMail = [];
MailboxSystem._cooldown = false;

// ============================================================================
// DATA HANDLING
// ============================================================================

MailboxSystem.loadMailData = function () {
    MailboxSystem._pendingMail = [];
    if (!MailboxSystem.loadJson) return;

    const path = "data/MailData.json";

    fetch(path)
        .then(response => {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.json();
        })
        .then(json => {
            const mailArray = Array.isArray(json.mail)
                ? json.mail
                : Array.isArray(json)
                ? json
                : [json];

            mailArray.forEach(mail => {
                mail.read = false;
                mail.deleted = false;
            });

            MailboxSystem._pendingMail = mailArray;
            console.log("Mailbox loaded:", mailArray);
        })
        .catch(err => {
            console.error("Failed to load MailData.json", err);
        });
};

(function() {
    const _Scene_Boot_loadSystemImages = Scene_Boot.prototype.loadSystemImages;
    Scene_Boot.prototype.loadSystemImages = function() {
        _Scene_Boot_loadSystemImages.call(this);
        MailboxSystem.loadMailData();
    };
})();

const _Game_System_initialize = Game_System.prototype.initialize;
Game_System.prototype.initialize = function() {
    _Game_System_initialize.call(this);
    this.mailbox = { inbox: [], deletedMailIds: [] };
};

// ============================================================================
// LOCATION & TIME LOGIC
// ============================================================================

MailboxSystem.isLocationValid = function(mail, mapId, regionId) {
    const checkMatch = (required, current) => {
        if (required === undefined || required === null) return true;
        if (Array.isArray(required)) return required.includes(current);
        return required === current;
    };

    const mapMatch = checkMatch(mail.mapId, mapId);
    const regionMatch = checkMatch(mail.regionId, regionId);
    
    return mapMatch && regionMatch;
};

MailboxSystem.isMailReady = function(mail) {
    const GT = window.GameTimeManager || window.GameTime || window[MailboxSystem.gametimePlugin] || null;
    if (!GT || typeof GT.getYears !== 'function') return true; 

    const current = { yr: GT.getYears(), mon: GT.getMonths(), day: GT.getDays(), hr: GT.getHours(), min: GT.getMinutes() };
    const m = { yr: mail.year || 0, mon: mail.month || 0, day: mail.day || 0, hr: mail.hour || 0, min: mail.minute || 0 };

    if (current.yr !== m.yr) return current.yr > m.yr;
    if (current.mon !== m.mon) return current.mon > m.mon;
    if (current.day !== m.day) return current.day > m.day;
    if (current.hr !== m.hr) return current.hr > m.hr;
    return current.min >= m.min;
};

MailboxSystem.checkMailDelivery = function() {
    if (!$gameSystem || !$gameSystem.mailbox) return;
    const delivered = [];
    const remaining = [];

    for (const mail of MailboxSystem._pendingMail) {
        if (MailboxSystem.isMailReady(mail)) {
            mail.mailId = mail.mailId || Date.now() + Math.random();
            delivered.push(mail);
        } else {
            remaining.push(mail);
        }
    }

    MailboxSystem._pendingMail = remaining;
    delivered.forEach(mail => {
        if (!$gameSystem.mailbox.inbox.find(m => m.mailId === mail.mailId) &&
            !$gameSystem.mailbox.deletedMailIds.includes(mail.mailId)) {
            $gameSystem.mailbox.inbox.push(mail);
        }
    });
};

// ============================================================================
// SCENE & AUTO-OPEN
// ============================================================================

MailboxSystem.checkAutoOpenMailbox = function() {
    const rId = $gamePlayer.regionId();
    // In this version, we trigger if the region is the default OR if mail exists for this specific region
    if (rId > 0) {
        const scene = SceneManager._scene;
        if (MailboxSystem._cooldown) return;

        if (scene instanceof Scene_Map && !scene.isBusy() && !$gamePlayer.isMoving()) {
            // Only auto-open if it's the default region OR if there is mail waiting specifically for this map/region
            const hasLocalMail = $gameSystem.mailbox.inbox.some(m => 
                !m.read && MailboxSystem.isLocationValid(m, $gameMap.mapId(), rId)
            );

            if (rId === MailboxSystem.mailboxRegionId || hasLocalMail) {
                $gamePlayer._stopCount = 1;
				SceneManager.push(Scene_Mailbox);
				SceneManager.prepareNextScene($gameMap.mapId(), rId);
            }
        }
    } else {
        MailboxSystem._cooldown = false;
    }
};

const _Scene_Map_update = Scene_Map.prototype.update;
Scene_Map.prototype.update = function() {
    _Scene_Map_update.call(this);
    if (Graphics.frameCount % 60 === 0) MailboxSystem.checkMailDelivery();
    MailboxSystem.checkAutoOpenMailbox();
};

// ============================================================================
// SCENE MAILBOX
// ============================================================================

function Scene_Mailbox() { this.initialize(...arguments); }
Scene_Mailbox.prototype = Object.create(Scene_MenuBase.prototype);
Scene_Mailbox.prototype.constructor = Scene_Mailbox;

Scene_Mailbox.prototype.prepare = function(mapId, regionId) {
    this._filterMapId = mapId || $gameMap.mapId();
    this._filterRegionId = regionId || $gamePlayer.regionId();
};

Scene_Mailbox.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    this.createMailListWindow();
    this.createReadWindow();
    this.createBodyWindow();
    this.refreshMail();
};

Scene_Mailbox.prototype.refreshMail = function() {
    const filtered = $gameSystem.mailbox.inbox.filter(m => 
        MailboxSystem.isLocationValid(m, this._filterMapId, this._filterRegionId)
    );
    this._mailListWindow.setupMailList(filtered);
    this._mailListWindow.activate();
    if (this._mailListWindow.maxItems() > 0) this._mailListWindow.select(0);
};
Scene_Mailbox.prototype.mailListWindowRect = function() { return new Rectangle(0, 0, Graphics.boxWidth * 0.4, Graphics.boxHeight); };
Scene_Mailbox.prototype.readWindowRect = function() {
    return new Rectangle(
        Graphics.boxWidth * 0.4,
        0,
        Graphics.boxWidth * 0.6,
        144
    );
};
Scene_Mailbox.prototype.bodyWindowRect = function() {
    return new Rectangle(
        Graphics.boxWidth * 0.4,
        144,
        Graphics.boxWidth * 0.6,
        Graphics.boxHeight - 144
    );
};

Scene_Mailbox.prototype.createMailListWindow = function() {
    this._mailListWindow = new Window_MailList(this.mailListWindowRect());
    this._mailListWindow.setHandler('ok', this.onMailListOk.bind(this));
    this._mailListWindow.setHandler('cancel', this.popScene.bind(this));
    this.addWindow(this._mailListWindow);
};

Scene_Mailbox.prototype.createReadWindow = function() {
    this._readWindow = new Window_MailCommands(this.readWindowRect());
    this._readWindow.hide();
    this.addWindow(this._readWindow);
};

Scene_Mailbox.prototype.createBodyWindow = function() {
    this._bodyWindow = new Window_MailBody(this.bodyWindowRect());
    this._bodyWindow.hide();
    this.addWindow(this._bodyWindow);
};

Scene_Mailbox.prototype.onMailListOk = function() {
    const mail = this._mailListWindow.selectedMail();
    if (mail) {
        mail.read = true;
        this._mailListWindow.refresh();
        this._readWindow.setMail(mail);
        this._bodyWindow.setMail(mail);
        this._readWindow.setHandler('cancel', this.onReadCancel.bind(this));
        this._readWindow.setHandler('delete', this.onDeleteMail.bind(this));
        this._readWindow.show();
        this._bodyWindow.show();
        this._readWindow.activate();
    }
};

Scene_Mailbox.prototype.onReadCancel = function() {
    this._readWindow.hide();
    this._bodyWindow.hide();
    this._mailListWindow.activate();
};

Scene_Mailbox.prototype.onDeleteMail = function() {
    const mail = this._mailListWindow.selectedMail();
    if (mail) {
        $gameSystem.mailbox.deletedMailIds.push(mail.mailId);
        $gameSystem.mailbox.inbox.splice($gameSystem.mailbox.inbox.indexOf(mail), 1);
        this.onReadCancel();
        this.refreshMail();
    }
};

Scene_Mailbox.prototype.popScene = function() {
    Scene_MenuBase.prototype.popScene.call(this);
    MailboxSystem._cooldown = true;
};

// ============================================================================
// WINDOW CLASSES
// ============================================================================

function Window_MailList() { this.initialize(...arguments); }
Window_MailList.prototype = Object.create(Window_Selectable.prototype);
Window_MailList.prototype.constructor = Window_MailList;
Window_MailList.prototype.initialize = function(r) { Window_Selectable.prototype.initialize.call(this, r); this._data = []; };
Window_MailList.prototype.setupMailList = function(d) { this._data = d.slice().reverse(); this.refresh(); };
Window_MailList.prototype.maxItems = function() { return Math.max(1, this._data.length); };
Window_MailList.prototype.selectedMail = function() { return this._data[this.index()]; };
Window_MailList.prototype.drawItem = function(index) {
    const mail = this._data[index];
    const rect = this.itemLineRect(index);
    if (!mail) return this.drawText("No Mail", rect.x, rect.y, rect.width, "center");
    this.changeTextColor(mail.read ? ColorManager.textColor(7) : ColorManager.normalColor());
    this.drawText((mail.read ? "" : "• ") + (mail.subject || "No Subject"), rect.x, rect.y, rect.width);
};

function Window_MailBody() { this.initialize(...arguments); }
Window_MailBody.prototype = Object.create(Window_Base.prototype);
Window_MailBody.prototype.constructor = Window_MailBody;

Window_MailBody.prototype.initialize = function(r) { 
    Window_Base.prototype.initialize.call(this, r); 
    this._scrollY = 0; 
    this._mail = null;
    this._maxScrollY = 0;
};

Window_MailBody.prototype.setMail = function(m) { 
    if (this._mail !== m) {
        this._mail = m; 
        this._scrollY = 0; 
        this.refresh(); 
    }
};

// Helper to wrap text before drawing
Window_MailBody.prototype.processWordWrap = function(text) {
    const maxWidth = this.contentsWidth() - 20; // Margin for scrollbar
    const words = text.split(" ");
    let lines = [];
    let currentLine = "";

    words.forEach(word => {
        // Handle manual line breaks within words/strings
        if (word.includes("\n")) {
            const parts = word.split("\n");
            parts.forEach((part, i) => {
                if (this.textSizeEx(currentLine + " " + part).width < maxWidth) {
                    currentLine += (currentLine === "" ? "" : " ") + part;
                } else {
                    lines.push(currentLine);
                    currentLine = part;
                }
                if (i < parts.length - 1) {
                    lines.push(currentLine);
                    currentLine = "";
                }
            });
        } else {
            const testLine = currentLine === "" ? word : currentLine + " " + word;
            if (this.textSizeEx(testLine).width < maxWidth) {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
    });
    lines.push(currentLine);
    return lines.join("\n");
};

Window_MailBody.prototype.refresh = function() {
    this.contents.clear();
    if (!this._mail || !this._mail.body) return;

    this.resetFontSettings();
    const wrappedText = this.processWordWrap(this._mail.body);
    
    // Calculate total height to set scroll limits
    const textState = this.createTextState(wrappedText, 0, 0, this.contentsWidth());
    this._maxScrollY = Math.max(0, textState.height - this.contentsHeight() + 20);

    this.drawTextEx(wrappedText, 4, 4 - this._scrollY);
    this.drawScrollIndicator();
};

Window_MailBody.prototype.drawScrollIndicator = function() {
    if (this._maxScrollY <= 0) return;
    const x = this.contentsWidth() - 10;
    const height = 40;
    const scrollPercent = this._scrollY / this._maxScrollY;
    const y = (this.contentsHeight() - height) * scrollPercent;
    
    this.contents.fillRect(x, 0, 4, this.contentsHeight(), ColorManager.gaugeBackColor());
    this.contents.fillRect(x, y, 4, height, ColorManager.accentColor ? ColorManager.accentColor() : ColorManager.normalColor());
};

Window_MailBody.prototype.update = function() {
    Window_Base.prototype.update.call(this);
    if (this.visible && this._mail) {
        const lastScroll = this._scrollY;
        if (Input.isPressed('down')) this._scrollY += 6;
        if (Input.isPressed('up')) this._scrollY -= 6;
        if (TouchInput.wheelY !== 0) this._scrollY += TouchInput.wheelY / 2;
        
        this._scrollY = Math.max(0, Math.min(this._scrollY, this._maxScrollY));
        if (this._scrollY !== lastScroll) this.refresh();
    }
};

Window_MailBody.prototype.updateScroll = function() {
    const lastScrollY = this._scrollY;
    const speed = 8;

    if (Input.isPressed('down')) this._scrollY += speed;
    if (Input.isPressed('up')) this._scrollY -= speed;
    
    // Support for mouse wheel
    if (TouchInput.wheelY !== 0) {
        this._scrollY += TouchInput.wheelY / 2;
    }

    this._scrollY = Math.max(0, this._scrollY);

    if (this._scrollY !== lastScrollY) {
        this.refresh();
    }
};

function Window_MailCommands() { this.initialize(...arguments); }
Window_MailCommands.prototype = Object.create(Window_Command.prototype);
Window_MailCommands.prototype.constructor = Window_MailCommands;
Window_MailCommands.prototype.setMail = function(m) { this._mail = m; this.refresh(); };
Window_MailCommands.prototype.makeCommandList = function() { this.addCommand("Back", "cancel"); this.addCommand("Delete", "delete"); };
Window_MailCommands.prototype.refresh = function() {
    Window_Command.prototype.refresh.call(this);
    if (!this._mail) return;
    this.drawText("Subject: " + (this._mail.subject || ""), 10, 0, this.contentsWidth());
    this.drawText("From: " + (this._mail.sender || "Unknown"), 10, this.lineHeight(), this.contentsWidth());
};
Window_MailCommands.prototype.itemRect = function(index) {
    const rect = Window_Command.prototype.itemRect.call(this, index);
    rect.y = this.contentsHeight() - this.lineHeight();
    rect.width = this.contentsWidth() / 2;
    rect.x = index * rect.width;
    return rect;
};

// ============================================================================
// PLUGIN COMMANDS
// ============================================================================

PluginManager.registerCommand(MailboxSystem.pluginName, "checkMail", args => {
    const mId = Number(args.mapId) || $gameMap.mapId();
    const rId = Number(args.regionId) || $gamePlayer.regionId();
    SceneManager.push(Scene_Mailbox);
    SceneManager._scene.prepare(mId, rId);
});

PluginManager.registerCommand(MailboxSystem.pluginName, "sendLetterFromString", args => {
    try {
        const mail = JSON.parse(args.mailJson);
        MailboxSystem.addMailToInbox(mail);
    } catch (e) { console.error("JSON Parse Error", e); }
});

PluginManager.registerCommand(MailboxSystem.pluginName, "sendLetterFromFile", args => {
    const path = args.filePath.includes('/') ? args.filePath : "data/mail/" + args.filePath.replace(/\.json$/i, '') + ".json";
    const xhr = new XMLHttpRequest();
    xhr.open("GET", path);
    xhr.onload = function() {
        if (xhr.status < 400) {
            const data = JSON.parse(xhr.responseText);
            const mails = Array.isArray(data) ? data : [data];
            mails.forEach(m => MailboxSystem.addMailToInbox(m));
        }
    };
    xhr.send();
});

MailboxSystem.addMailToInbox = function(mail) {
    mail.mailId = mail.mailId || Date.now() + Math.random();
    mail.read = false;
    if (!$gameSystem.mailbox.inbox.find(m => m.mailId === mail.mailId)) {
        $gameSystem.mailbox.inbox.push(mail);
    }
};

window.MailboxSystem = MailboxSystem;
