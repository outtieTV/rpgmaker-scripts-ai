/*:
 * @target MZ
 * @plugindesc Custom items with sprites, JSON loading, map drops, pickup, quantity, persistence, and notetag support.
 * @author OuttieTV
 *
 * ============================================================================
 * PARAMETERS
 * ============================================================================
 *
 * @param useExternalJson
 * @type boolean
 * @default true
 *
 * @param defaultConsumable
 * @type boolean
 * @default true
 *
 * @param defaultKeyItem
 * @type boolean
 * @default false
 *
 * @param defaultPrice
 * @type number
 * @default 0
 *
 * @param itemsList
 * @type struct<CustomItem>[]
 * @default []
 *
 * ============================================================================
 * PLUGIN COMMANDS
 * ============================================================================
 *
 * @command createItem
 * @text Create Item
 *
 * @arg id
 * @type number
 *
 * @arg name
 * @type text
 *
 * @arg iconIndex
 * @type number
 * @default 0
 *
 * @arg spritePath
 * @type text
 *
 * @arg consumable
 * @type boolean
 * @default true
 *
 * @arg keyItem
 * @type boolean
 * @default false
 *
 * @arg note
 * @type note
 * @text Notetags
 * @desc RPG Maker notetags (e.g. <NoSell><HotbarOnly>)
 *
 * --------------------------------------------------------------------------
 *
 * @command addItemToInv
 * @text Add Item To Inventory
 *
 * @arg id
 * @type number
 *
 * @arg quantity
 * @type number
 * @default 1
 *
 * @command delItemFromInv
 * @text Remove Item From Inventory
 *
 * @arg id
 * @type number
 *
 * @arg quantity
 * @type number
 * @default 1
 * --------------------------------------------------------------------------
 *
 * @command dropItem
 * @text Drop Item on Map
 *
 * @arg id
 * @type number
 *
 * @arg quantity
 * @type number
 * @default 1
 *
 * @arg x
 * @type number
 *
 * @arg y
 * @type number
 */

(() => {
    'use strict';

    const PLUGIN_NAME = "CustomItems_MZ";
    const P = PluginManager.parameters(PLUGIN_NAME);

    const USE_JSON = P.useExternalJson === "true";
    const DEFAULT_CONSUMABLE = P.defaultConsumable === "true";
    const DEFAULT_KEYITEM = P.defaultKeyItem === "true";
    const DEFAULT_PRICE = Number(P.defaultPrice || 0);

    if (!window.$customItemDrops) window.$customItemDrops = [];

    // -------------------------------------------------------------------------
    // UTILITIES
    // -------------------------------------------------------------------------

    const CI = {
        spritePath(item) {
            if (item.spritePath) return item.spritePath;
            return `ItemSprites/${item.name.replace(/[^a-zA-Z0-9]/g, "")}`;
        },

        register(data) {
            const id = Number(data.id);
            if (!id) return;

            const consumable = data.consumable ?? DEFAULT_CONSUMABLE;
            const keyItem = data.keyItem ?? DEFAULT_KEYITEM;

            const item = {
                id,
                name: data.name || "Unknown Item",
                iconIndex: Number(data.iconIndex || 0),
                description: data.description || "",
                price: Number(data.price ?? DEFAULT_PRICE),
                note: data.note || "",
                itypeId: keyItem ? 2 : 1,
                consumable: consumable && !keyItem,
                scope: 7,
                occasion: 0,
                effects: [],
                spritePath: data.spritePath || null,
                isCustomItem: true
            };

            while ($dataItems.length <= id) $dataItems.push(null);
            $dataItems[id] = item;

            // 🔑 CRITICAL: enable notetag parsing for compatibility
            DataManager.extractMetadata(item);
        }
    };

    // -------------------------------------------------------------------------
    // DATA LOADING
    // -------------------------------------------------------------------------

    const _isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function () {
        if (!_isDatabaseLoaded.call(this)) return false;
        if (!this._customItemsLoaded) {
            this._customItemsLoaded = true;
            this.loadCustomItems();
        }
        return true;
    };

    DataManager.loadCustomItems = function () {
        if (USE_JSON) {
            DataManager.loadDataFile("$dataCustomItems", "CustomItems.json");
            const wait = setInterval(() => {
                if (window.$dataCustomItems) {
                    clearInterval(wait);
                    window.$dataCustomItems.forEach(CI.register);
                }
            }, 10);
        } else {
            const list = JSON.parse(P.itemsList || "[]");
            list.forEach(e => CI.register(JSON.parse(e)));
        }
    };

    // -------------------------------------------------------------------------
    // SAVE / LOAD
    // -------------------------------------------------------------------------

    const _makeSave = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function () {
        const c = _makeSave.call(this);
        c.customItemDrops = window.$customItemDrops;
        return c;
    };

    const _extractSave = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (c) {
        _extractSave.call(this, c);
        window.$customItemDrops = c.customItemDrops || [];
    };

    // -------------------------------------------------------------------------
    // PLUGIN COMMANDS
    // -------------------------------------------------------------------------

    PluginManager.registerCommand(PLUGIN_NAME, "createItem", args => CI.register(args));

    PluginManager.registerCommand(PLUGIN_NAME, "addItemToInv", args => {
        const item = $dataItems[Number(args.id)];
        if (item) $gameParty.gainItem(item, Number(args.quantity || 1));
    });
	
	PluginManager.registerCommand(PLUGIN_NAME, "delItemFromInv", args => {
		const item = $dataItems[Number(args.id)];
		if (!item) return;

		const qtyArg = Number(args.quantity || 1);
		const owned = $gameParty.numItems(item);

		// Prevent invalid values
		if (qtyArg < -1) return;

		// Remove ALL
		if (qtyArg === -1) {
			if (owned > 0) {
				$gameParty.gainItem(item, -owned);
			}
			return;
		}

		// Conditional remove (only if enough)
		if (qtyArg > 0 && owned >= qtyArg) {
			$gameParty.gainItem(item, -qtyArg);
		}
	});

	
    PluginManager.registerCommand(PLUGIN_NAME, "dropItem", args => {
        window.$customItemDrops.push({
            mapId: $gameMap.mapId(),
            id: Number(args.id),
            quantity: Math.max(1, Number(args.quantity || 1)),
            x: args.x !== "" ? Number(args.x) : $gamePlayer.x,
            y: args.y !== "" ? Number(args.y) : $gamePlayer.y
        });
    });

    // -------------------------------------------------------------------------
    // MAP SPRITES
    // -------------------------------------------------------------------------

    class Sprite_CustomItem extends Sprite {
        constructor(data) {
            super();
            this._data = data;
            this.bitmap = ImageManager.loadPicture(CI.spritePath($dataItems[data.id]));
            this.anchor.set(0.5, 1);
            this.updatePosition();
        }

        update() {
            super.update();
            this.updatePosition();
            if (this.isTouched()) this.pickup();
        }

        updatePosition() {
            this.x = ($gameMap.adjustX(this._data.x) * 48) + 24;
            this.y = ($gameMap.adjustY(this._data.y) * 48) + 48;
        }

        isTouched() {
            return this._data.mapId === $gameMap.mapId() &&
                   $gamePlayer.x === this._data.x &&
                   $gamePlayer.y === this._data.y;
        }

        pickup() {
            const item = $dataItems[this._data.id];
            if (item) {
                $gameParty.gainItem(item, this._data.quantity);
                SoundManager.playOk();
            }
            window.$customItemDrops = window.$customItemDrops.filter(d => d !== this._data);
            this.parent.removeChild(this);
        }
    }

    const _createLower = Spriteset_Map.prototype.createLowerLayer;
    Spriteset_Map.prototype.createLowerLayer = function () {
        _createLower.call(this);
        this._customItemLayer = new Sprite();
        this.addChild(this._customItemLayer);
    };

    const _update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function () {
        _update.call(this);
        this.refreshCustomItems();
    };

    Spriteset_Map.prototype.refreshCustomItems = function () {
        if (!this._customItemLayer) return;
        const drops = window.$customItemDrops.filter(d => d.mapId === $gameMap.mapId());
        if (this._customItemLayer.children.length !== drops.length) {
            this._customItemLayer.removeChildren();
            drops.forEach(d => this._customItemLayer.addChild(new Sprite_CustomItem(d)));
        }
    };

})();
