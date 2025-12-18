/*:
 * @target MZ
 * @plugindesc [MZ] Location-based persistent mailbox system with global mail, region triggers, delivery dates, deletions, and attachments.
 * @author OuttieTV
 *
 * @param Load JSON
 * @type boolean
 * @default true
 *
 * @param Gametime Plugin Name
 * @type string
 * @default GameTime_MZ_v1
 *
 * @param Default Region ID
 * @type number
 * @default 10
 * * @command sendFromFile
 * @text Send Mail From File
 * @desc Manually injects mail from a specific JSON file in data/mail/.
 * @arg fileName
 * @text File Name
 * @desc The name of the file (e.g., Special_Event.json).
 *
 * @command sendFromJson
 * @text Send Mail From JSON String
 * @desc Manually injects mail via a raw JSON string.
 * @arg jsonString
 * @text JSON String
 * @desc The raw JSON data for the mail object.
 *
 * @command checkMail
 * @text Check Mailbox
 * @desc Manually checks for mail. Can override location parameters.
 * @arg mapId
 * @text Map ID
 * @desc Leave at 0 to use current map.
 * @type number
 * @default 0
 * @arg regionId
 * @text Region ID
 * @desc Leave at 0 to use current player region.
 * @type number
 * @default 0
 */

const MailboxSystem = {};
MailboxSystem.pluginName = "Mailbox_MZ_v2";
MailboxSystem.parameters = PluginManager.parameters(MailboxSystem.pluginName);

MailboxSystem.loadJson = eval(MailboxSystem.parameters["Load JSON"] || "true");
MailboxSystem.mailboxRegionId = Number(MailboxSystem.parameters["Default Region ID"] || 10);
MailboxSystem.gametimePlugin = String(MailboxSystem.parameters["Gametime Plugin Name"] || "");

MailboxSystem._pendingMail = [];
MailboxSystem._cooldown = false;

// ============================================================================
// DATA HANDLING
// ============================================================================

MailboxSystem.loadJsonFile = function (fileName) {
    return new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "data/mail/" + fileName);
        xhr.overrideMimeType("application/json");
        xhr.onload = function () {
            if (xhr.status < 400) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    console.error("Mailbox JSON parse error:", fileName, e);
                    resolve(null);
                }
            } else resolve(null);
        };
        xhr.onerror = () => resolve(null);
        xhr.send();
    });
};

MailboxSystem.loadMailData = function () {
    MailboxSystem._pendingMail = [];
    if (!MailboxSystem.loadJson) return;

    if (!$dataMapInfos) {
        const _onLoad = DataManager.onLoad;
        DataManager.onLoad = function (obj) {
            _onLoad.call(this, obj);
            if (obj === $dataMapInfos) MailboxSystem.loadMailData();
        };
        return;
    }

    const promises = [];

    // GLOBAL
    promises.push(
        this.loadJsonFile("GLOBAL_Mail.json").then(data => {
            if (!data) return;
            const mails = Array.isArray(data) ? data : (data.mail || []);
            mails.forEach(mail => this.processNewMail(mail, "GLOBAL"));
        })
    );

    // MAP SPECIFIC
    $dataMapInfos.forEach(info => {
        if (!info) return;
        const mapIdPadded = String(info.id).padStart(3, "0");
        promises.push(
            this.loadJsonFile(`MAP${mapIdPadded}_Mail.json`).then(data => {
                if (!data) return;
                const mails = Array.isArray(data) ? data : (data.mail || []);
                mails.forEach(mail => {
                    mail.mapId ??= info.id;
                    this.processNewMail(mail, `MAP${mapIdPadded}`);
                });
            })
        );
    });

    Promise.all(promises).then(() => {
        console.log(`Mailbox loaded ${MailboxSystem._pendingMail.length} mail items`);
    });
};

MailboxSystem.processNewMail = function(mail, prefix) {
    mail.mailId ??= `${prefix}-${Date.now()}-${Math.random()}`;
    mail.regionId ??= MailboxSystem.mailboxRegionId;
    mail.read = false;
    mail.attachmentsClaimed = false;
    MailboxSystem._pendingMail.push(mail);
};

(() => {
    const _load = Scene_Boot.prototype.loadSystemImages;
    Scene_Boot.prototype.loadSystemImages = function () {
        _load.call(this);
        MailboxSystem.loadMailData();
    };
})();

// ============================================================================
// SAVE DATA
// ============================================================================

const _Game_System_init = Game_System.prototype.initialize;
Game_System.prototype.initialize = function () {
    _Game_System_init.call(this);
    this.mailbox = {
        inbox: [],
        deletedMailIds: []
    };
};

// ============================================================================
// DELIVERY LOGIC
// ============================================================================

MailboxSystem.isMailReady = function (mail) {
    if (!mail.deliverAt) return true;
    if (!window.GameTime) return true;

    const d = mail.deliverAt;
    const dayNow  = GameTime.getDays?.() || 0;
    const hourNow = GameTime.getHours?.() || 0;

    if (dayNow > (d.day || 0)) return true;
    if (dayNow === (d.day || 0) && hourNow >= (d.hour || 0)) return true;

    return false;
};

MailboxSystem.checkMailDelivery = function () {
    const delivered = [];
    const remaining = [];

    MailboxSystem._pendingMail.forEach(mail => {
        if (MailboxSystem.isMailReady(mail)) delivered.push(mail);
        else remaining.push(mail);
    });

    MailboxSystem._pendingMail = remaining;

    delivered.forEach(mail => {
        if (!$gameSystem.mailbox.deletedMailIds.includes(mail.mailId) &&
            !$gameSystem.mailbox.inbox.find(m => m.mailId === mail.mailId)) {
            $gameSystem.mailbox.inbox.push(mail);
        }
    });
};

MailboxSystem.openMailboxIfNeeded = function (targetMapId, targetRegionId) {
    if (MailboxSystem._cooldown || SceneManager._scene instanceof Scene_Mailbox) return;

    const mapId = targetMapId || $gameMap.mapId();
    const regionId = targetRegionId || $gamePlayer.regionId();

    if (!regionId) return;

    const hasMail = $gameSystem.mailbox.inbox.some(m =>
        m.regionId === regionId &&
        (!m.mapId || m.mapId === mapId)
    );

    if (!hasMail) return;

    MailboxSystem._cooldown = true;
    SceneManager.push(Scene_Mailbox);
    setTimeout(() => MailboxSystem._cooldown = false, 3000); 
};

const _Scene_Map_update = Scene_Map.prototype.update;
Scene_Map.prototype.update = function () {
    _Scene_Map_update.call(this);
    if (Graphics.frameCount % 30 === 0) {
        MailboxSystem.checkMailDelivery();
        MailboxSystem.openMailboxIfNeeded();
    }
};

// ============================================================================
// SCENE: MAILBOX
// ============================================================================

function Scene_Mailbox() { this.initialize(...arguments); }
Scene_Mailbox.prototype = Object.create(Scene_MenuBase.prototype);
Scene_Mailbox.prototype.constructor = Scene_Mailbox;

Scene_Mailbox.prototype.create = function () {
    Scene_MenuBase.prototype.create.call(this);
    const listW = Math.floor(Graphics.boxWidth * 0.4);
    const cmdH = 120;

    this._list = new Window_MailList(new Rectangle(0, 0, listW, Graphics.boxHeight));
    this._cmd  = new Window_MailCommands(new Rectangle(listW, 0, Graphics.boxWidth - listW, cmdH));
    this._body = new Window_MailBody(new Rectangle(listW, cmdH, Graphics.boxWidth - listW, Graphics.boxHeight - cmdH));

    this._list.setHandler("ok", this.onSelect.bind(this));
    this._list.setHandler("cancel", this.popScene.bind(this));

    this._cmd.setHandler("cancel", this.onCommandCancel.bind(this));
    this._cmd.setHandler("claim", this.onCommandClaim.bind(this));
    this._cmd.setHandler("delete", this.onCommandDelete.bind(this));

    this.addWindow(this._list);
    this.addWindow(this._cmd);
    this.addWindow(this._body);

    this.refresh();
    this._list.activate();
    this._list.select(0);
};

Scene_Mailbox.prototype.refresh = function () {
    this._list.setData($gameSystem.mailbox.inbox);
};

Scene_Mailbox.prototype.onSelect = function () {
    const mail = this._list.current();
    if (mail) {
        mail.read = true;
        this._cmd.setMail(mail);
        this._body.setMail(mail);
        this._cmd.activate();
        this._cmd.select(0);
        this._list.refresh();
    } else {
        this._list.activate();
    }
};

Scene_Mailbox.prototype.onCommandCancel = function() {
    this._cmd.deselect();
    this._cmd.clearMail();
    this._body.clear();
    this._list.activate();
};

Scene_Mailbox.prototype.onCommandClaim = function() {
    const mail = this._list.current();
    if (mail && mail.attachments && !mail.attachmentsClaimed) {
        mail.attachments.forEach(a => {
            const n = a.amount || 1;
            if (a.type === "gold") $gameParty.gainGold(n);
            if (a.type === "item") $gameParty.gainItem($dataItems[a.id], n);
            if (a.type === "weapon") $gameParty.gainItem($dataWeapons[a.id], n);
            if (a.type === "armor") $gameParty.gainItem($dataArmors[a.id], n);
        });
        mail.attachmentsClaimed = true;
        SoundManager.playItem();
    }
    this._cmd.refresh();
    this._cmd.activate();
};

Scene_Mailbox.prototype.onCommandDelete = function() {
    const mail = this._list.current();
    if (mail) {
        $gameSystem.mailbox.deletedMailIds.push(mail.mailId);
        const index = $gameSystem.mailbox.inbox.indexOf(mail);
        $gameSystem.mailbox.inbox.splice(index, 1);
    }
    this.onCommandCancel();
    this.refresh();
};

// ============================================================================
// WINDOWS
// ============================================================================

function Window_MailList(r){this.initialize(...arguments);}
Window_MailList.prototype = Object.create(Window_Selectable.prototype);
Window_MailList.prototype.constructor = Window_MailList;
Window_MailList.prototype.initialize = function(r){Window_Selectable.prototype.initialize.call(this,r); this._data = [];}
Window_MailList.prototype.setData = function(d){this._data=d.slice().reverse();this.refresh();}
Window_MailList.prototype.maxItems=function(){return this._data ? this._data.length : 0;}
Window_MailList.prototype.current=function(){return this._data[this.index()];}
Window_MailList.prototype.drawItem=function(i){
    const m=this._data[i]; if(!m)return;
    const r=this.itemLineRect(i);
    this.drawText((m.read?"":"• ")+(m.subject||"No Subject"),r.x,r.y,r.width);
};

function Window_MailCommands(r){this.initialize(...arguments);}
Window_MailCommands.prototype = Object.create(Window_Command.prototype);
Window_MailCommands.prototype.constructor = Window_MailCommands;
Window_MailCommands.prototype.setMail=function(m){this._mail=m;this.refresh();}
Window_MailCommands.prototype.clearMail=function(){this._mail=null;this.refresh();}
Window_MailCommands.prototype.makeCommandList=function(){
    this.addCommand("Back","cancel");
    if(this._mail?.attachments && !this._mail.attachmentsClaimed){
        this.addCommand("Claim","claim");
    }
    if(this._mail) this.addCommand("Delete","delete");
};
Window_MailCommands.prototype.maxCols = function() { return 3; };

function Window_MailBody(r){this.initialize(...arguments);}
Window_MailBody.prototype = Object.create(Window_Base.prototype);
Window_MailBody.prototype.constructor = Window_MailBody;
Window_MailBody.prototype.setMail=function(m){this._mail=m;this.refresh();}
Window_MailBody.prototype.clear=function(){this._mail = null;this.contents.clear();}
Window_MailBody.prototype.refresh=function(){
    this.contents.clear();
    if(!this._mail) return;
    let y = 0;
    const lh = this.lineHeight();
    this.changeTextColor(ColorManager.systemColor());
    this.drawText(`From: ${this._mail.sender || "Unknown"}`, 0, y, this.contentsWidth());
    y += lh;
    this.drawText(`Subject: ${this._mail.subject || "No Subject"}`, 0, y, this.contentsWidth());
    y += lh + 10;
    this.contents.fillRect(0, y - 5, this.contentsWidth(), 2, ColorManager.normalColor());
    this.resetTextColor();
    this.drawTextEx(this._mail.body || "", 0, y, this.contentsWidth());
};

// ============================================================================
// PLUGIN COMMANDS
// ============================================================================

PluginManager.registerCommand(MailboxSystem.pluginName, "sendFromFile", args => {
    const fileName = String(args.fileName);
    MailboxSystem.loadJsonFile(fileName).then(data => {
        if (!data) return;
        const mails = Array.isArray(data) ? data : (data.mail || []);
        mails.forEach(mail => {
            MailboxSystem.processNewMail(mail, "MANUAL");
            MailboxSystem.checkMailDelivery();
        });
    });
});

PluginManager.registerCommand(MailboxSystem.pluginName, "sendFromJson", args => {
    try {
        const mail = JSON.parse(args.jsonString);
        MailboxSystem.processNewMail(mail, "INJECT");
        MailboxSystem.checkMailDelivery();
    } catch (e) {
        console.error("Mailbox: Invalid JSON string in sendFromJson command", e);
    }
});

PluginManager.registerCommand(MailboxSystem.pluginName, "checkMail", args => {
    const mapId = Number(args.mapId) || $gameMap.mapId();
    const regionId = Number(args.regionId) || $gamePlayer.regionId();
    MailboxSystem.checkMailDelivery();
    MailboxSystem.openMailboxIfNeeded(mapId, regionId);
});

window.MailboxSystem = MailboxSystem;
