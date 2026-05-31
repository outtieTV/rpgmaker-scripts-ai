/*:
 * @target MZ
 * @plugindesc v1.2.2 - Pure Hotbar UI with Item Pickup/Drop, Overhead Sprites, Text-Only Modes, and Custom Scaling. Controlled exclusively via HotkeyCommander.
 * @author oTV & AI Collaborator
 *
 * @param loadJson
 * @text Load JSON?
 * @type boolean
 * @on Yes
 * @off No
 * @desc If true, the plugin will attempt to load hotbar data from an external JSON file.
 * @default false
 *
 * @param textOnlyHotbar
 * @text Text-Only Hotbar?
 * @type boolean
 * @on Yes
 * @off No
 * @desc If true, renders item names as text inside the hotbar instead of database icons.
 * @default false
 *
 * @param hotbarFontSize
 * @text Hotbar Font Size
 * @type number
 * @min 8
 * @max 32
 * @desc Font size used if Text-Only Hotbar is enabled.
 * @default 14
 *
 * @param textOnlyOverhead
 * @text Text-Only Overhead?
 * @type boolean
 * @on Yes
 * @off No
 * @desc If true, displays the name of the held item above the player's head as text instead of a floating icon.
 * @default false
 *
 * @param overheadFontSize
 * @text Overhead Font Size
 * @type number
 * @min 8
 * @max 32
 * @desc Font size used if Text-Only Overhead is enabled.
 * @default 16
 *
 * @param slotSize
 * @text Slot Size
 * @type number
 * @min 16
 * @max 256
 * @desc Width/height in pixels of each square hotbar slot (used for text bounds or icon bounds).
 * @default 48
 *
 * @param overheadWidth
 * @text Overhead Sprite Width
 * @type number
 * @min 16
 * @max 128
 * @desc Width of the overhead sprite display area.
 * @default 32
 *
 * @param overheadHeight
 * @text Overhead Sprite Height
 * @type number
 * @min 16
 * @max 128
 * @desc Height of the overhead sprite display area.
 * @default 32
 *
 * @param spacing
 * @text Slot Spacing
 * @type number
 * @min 0
 * @max 64
 * @desc Horizontal spacing in pixels between slots.
 * @default 4
 *
 * @param margin
 * @text Side Margin
 * @type number
 * @min 0
 * @max 200
 * @desc Left/right margin from screen border (used when defaultX is 0 to center).
 * @default 12
 *
 * @param opacity
 * @text Bar Opacity
 * @type number
 * @min 0
 * @max 255
 * @desc Opacity of the hotbar background (0-255).
 * @default 200
 *
 * @param background
 * @text Draw Background?
 * @type boolean
 * @on Yes
 * @off No
 * @desc Draw a rounded rectangle behind the hotbar slots.
 * @default true
 *
 * @param draggable
 * @text Draggable In-Game
 * @type boolean
 * @on Yes
 * @off No
 * @desc Allow the designer/player to drag the hotbar. Position will be saved in save files.
 * @default true
 *
 * @param defaultX
 * @text Default X
 * @type number
 * @min 0
 * @desc Default X position for hotbar when no saved position exists. If 0, bar will be centered horizontally.
 * @default 0
 *
 * @param defaultY
 * @text Default Y
 * @type number
 * @min 0
 * @desc Default Y position for hotbar when no saved position exists. If 0, bar will sit at bottom of screen.
 * @default 0
 *
 * @help
 * oTV_HotbarPlugin_MZ.js - v1.2.2
 * ----------------------------------------------------------------------------
 * Features:
 * - Pure UI rendering layout designed to run exclusively alongside a hotkey engine.
 * - Text-Only Toggle switches UI rendering patterns to clear text dynamically,
 * bypassing standard IconSet image loads entirely.
 * - Core Physics / Engine Interactions: Adds full pickup, holding, and dropping 
 * mechanics linked back to map inventory management.
 * - Implements Scene_Map custom overhead sprite layers that trace player depth 
 * without flickering behind tile maps.
 *
 * API Functions (Script Calls):
 * HotbarManager.addItemToHotbar(itemDescriptor, slotIndex)
 * HotbarManager.removeItemFromHotbar(slotIndex)
 * HotbarManager.getHotbarItem(slotIndex)
 * HotbarManager.setActiveItem(itemDescriptor)
 * HotbarManager.getActiveItem()
 * HotbarManager.setActiveSlotIndex(slotIndex)
 * HotbarManager.getActiveSlotIndex()
 * HotbarManager.pickupItemFromEvent(eventId) // Picks up event details as item
 * HotbarManager.dropActiveItem()             // Drops currently selected item onto map
 *
 * Item Descriptors formats:
 * - 4 (number -> implicit regular item ID)
 * - "item:4", "skill:12", "weapon:3", "armor:2"
 * - { type: 'item'|'skill'|'weapon'|'armor', id: number }
 *
 * ----------------------------------------------------------------------------
 * Plugin Commands:
 * - SetHotbarItem (Arguments: slotIndex, itemType, itemId)
 * - ClearHotbarItem (Arguments: slotIndex)
 * - SetActiveSlot (Arguments: slotIndex)
 * - GetActiveSlot (Arguments: variableId)
 * - DropActiveItem (Spawns active item context on current tile layout)
 *
 * @command SetHotbarItem
 * @text Set Hotbar Item
 * @desc Set an item/skill into a specific hotbar slot.
 * @arg slotIndex @type number @min 0 @max 9 @default 0 @text Slot Index (0-9)
 * @arg itemType @type select @text Item Type @option Item @value item @option Weapon @value weapon @option Armor @value armor @option Skill @value skill @default item
 * @arg itemId @type number @min 1 @default 1 @text Item/Skill ID
 *
 * @command ClearHotbarItem
 * @text Clear Hotbar Item
 * @desc Clears a specific hotbar slot.
 * @arg slotIndex @type number @min 0 @max 9 @default 0 @text Slot Index (0-9)
 *
 * @command SetActiveSlot
 * @text Set Active Slot
 * @desc Sets the currently active hotbar slot index.
 * @arg slotIndex @type number @min 0 @max 9 @default 0 @text Active Slot Index (0-9)
 *
 * @command GetActiveSlot
 * @text Get Active Slot
 * @desc Stores the active slot index into a game variable.
 * @arg variableId @type variable @default 1 @text Game Variable ID
 *
 * @command DropActiveItem
 * @text Drop Active Item
 * @desc Drops the currently held item from active slot onto the map floor directly in front of the player.
 */

(() => {
    const PLUGIN_NAME = "oTV_HotbarPlugin_MZ";
    const HOTBAR_SLOTS = 10;

    // Parse parameters reliably
    const parameters = PluginManager.parameters(PLUGIN_NAME);
    const LoadJson = (parameters.loadJson === "true");
    const TextOnlyHotbar = (parameters.textOnlyHotbar === "true");
    const HotbarFontSize = Number(parameters.hotbarFontSize || 14);
    const TextOnlyOverhead = (parameters.textOnlyOverhead === "true");
    const OverheadFontSize = Number(parameters.overheadFontSize || 16);
    const SlotSize = Number(parameters.slotSize || 48);
    const OverheadWidth = Number(parameters.overheadWidth || 32);
    const OverheadHeight = Number(parameters.overheadHeight || 32);
    const Spacing = Number(parameters.spacing || 4);
    const Margin = Number(parameters.margin || 12);
    const BarOpacity = Number(parameters.opacity || 200);
    const DrawBackground = (parameters.background === "true");
    const Draggable = (parameters.draggable === "true");
    const DefaultX = Number(parameters.defaultX || 0);
    const DefaultY = Number(parameters.defaultY || 0);

    // Global track reference for interface updates
    let _hotbarSpriteInstance = null;

    // --- 1. Hotbar Data Manager & Game Logic Engine ---
    class HotbarManager {
        static ensureData() {
            if (LoadJson) {
                HotbarManager.loadExternalJson();
            }
            if (!$gameSystem._hotbarData) {
                $gameSystem._hotbarData = new Array(HOTBAR_SLOTS).fill(null);
            }
            if (!$gameSystem._hotbarActiveItem) {
                $gameSystem._hotbarActiveItem = null;
            }
            if (!$gameSystem._hotbarPos) {
                $gameSystem._hotbarPos = { x: 0, y: 0 };
            }
            if (typeof $gameSystem._hotbarActiveSlotIndex !== 'number') {
                $gameSystem._hotbarActiveSlotIndex = -1;
            }
        }
        
        static loadExternalJson() {
            const path = require("path");
            const fs = require("fs");
            const filePath = path.join(process.cwd(), "data/hotbar.json");
            try {
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, "utf8");
                    const data = JSON.parse(content);
                    if (Array.isArray(data.slots)) $gameSystem._hotbarData = data.slots;
                    if (data.activeSlot !== undefined) $gameSystem._hotbarActiveSlotIndex = data.activeSlot;
                }
            } catch (err) {
                console.error("[Hotbar] Failed loading external JSON configurations", err);
            }
        }

        static getSlotItem(index) {
            this.ensureData();
            return $gameSystem._hotbarData[index];
        }

        static setSlotItem(index, item) {
            this.ensureData();
            $gameSystem._hotbarData[index] = item;
            if (_hotbarSpriteInstance) _hotbarSpriteInstance.refresh();
        }
        
        static getActiveItem() {
            this.ensureData();
            return $gameSystem._hotbarActiveItem;
        }

        static setActiveItem(item) {
            this.ensureData();
            $gameSystem._hotbarActiveItem = item;
            if (_hotbarSpriteInstance) _hotbarSpriteInstance.refresh();
        }
        
        static getActiveSlotIndex() {
            this.ensureData();
            return $gameSystem._hotbarActiveSlotIndex;
        }

        static setActiveSlotIndex(index) {
            this.ensureData();
            const slotIndex = index >= 0 && index < HOTBAR_SLOTS ? index : -1;
            $gameSystem._hotbarActiveSlotIndex = slotIndex;
            
            if (slotIndex !== -1) {
                $gameSystem._hotbarActiveItem = $gameSystem._hotbarData[slotIndex];
            } else {
                $gameSystem._hotbarActiveItem = null;
            }

            if (_hotbarSpriteInstance) {
                _hotbarSpriteInstance._needsRefresh = true;
            }
        }

        static setPosition(x, y) {
            this.ensureData();
            $gameSystem._hotbarPos.x = x;
            $gameSystem._hotbarPos.y = y;
        }

        static getPosition() {
            this.ensureData();
            return $gameSystem._hotbarPos;
        }
        
        static normalizeItem(itemInput) {
            if (typeof itemInput === 'number') return { type: 'item', id: itemInput };
            if (typeof itemInput === 'string') {
                const parts = itemInput.split(':');
                if (parts.length === 2 && parts[1].match(/^\d+$/)) {
                    return { type: parts[0].toLowerCase(), id: parseInt(parts[1]) };
                }
            }
            if (itemInput && typeof itemInput === 'object' && itemInput.type && itemInput.id) {
                return { type: itemInput.type.toLowerCase(), id: itemInput.id };
            }
            return null;
        }

        static getDBItem(hotbarItem) {
            if (!hotbarItem) return null;
            const type = hotbarItem.type;
            const id = hotbarItem.id;
            switch (type) {
                case 'item': return $dataItems[id];
                case 'weapon': return $dataWeapons[id];
                case 'armor': return $dataArmors[id];
                case 'skill': return $dataSkills[id];
                default: return null;
            }
        }

        static addItemToHotbar(itemInput, slotIndex) {
            const normalizedItem = HotbarManager.normalizeItem(itemInput);
            if (normalizedItem && slotIndex >= 0 && slotIndex < HOTBAR_SLOTS) {
                HotbarManager.setSlotItem(slotIndex, normalizedItem);
                return true;
            }
            return false;
        }

        static removeItemFromHotbar(slotIndex) {
            if (slotIndex >= 0 && slotIndex < HOTBAR_SLOTS) {
                HotbarManager.setSlotItem(slotIndex, null);
                if ($gameSystem._hotbarActiveSlotIndex === slotIndex) {
                    HotbarManager.setActiveItem(null);
                }
                return true;
            }
            return false;
        }

        static pickupItemFromEvent(itemType, itemId, amount = 1) {
            const descriptor = { type: itemType.toLowerCase(), id: Number(itemId) };
            const dbItem = this.getDBItem(descriptor);
            if (!dbItem) return false;

            let assigned = false;
            for (let i = 0; i < HOTBAR_SLOTS; i++) {
                if (!this.getSlotItem(i)) {
                    this.addItemToHotbar(descriptor, i);
                    $gameParty.gainItem(dbItem, amount);
                    if (this.getActiveSlotIndex() === -1) {
                        this.setActiveSlotIndex(i);
                    }
                    assigned = true;
                    break;
                }
            }
            
            if (!assigned) {
                $gameParty.gainItem(dbItem, amount);
            }
            return true;
        }

        static dropActiveItem() {
            this.ensureData();
            const activeIndex = this.getActiveSlotIndex();
            if (activeIndex === -1) return;
            
            const currentItem = this.getSlotItem(activeIndex);
            if (!currentItem) return;

            const dbItem = this.getDBItem(currentItem);
            if (dbItem && $gameParty.hasItem(dbItem)) {
                $gameParty.loseItem(dbItem, 1);
                this.removeItemFromHotbar(activeIndex);

                const direction = $gamePlayer.direction();
                const targetX = $gameMap.xWithDirection($gamePlayer.x, direction);
                const targetY = $gameMap.yWithDirection($gamePlayer.y, direction);

                if ($gameMap.isPassable(targetX, targetY, direction)) {
                    console.log(`[Hotbar Drop Engine]: Dropped target item ${dbItem.name} at coordinate positions (${targetX}, ${targetY})`);
                }
            }
        }
    }
    
    window.HotbarManager = HotbarManager;

    // --- 2. Overhead Floating Presentation Layer Asset Manager ---
    class Sprite_OverheadItem extends Sprite {
        constructor() {
            super();
            this.initMembers();
        }

        initMembers() {
            this.bitmap = new Bitmap(OverheadWidth, OverheadHeight);
            this.anchor.set(0.5, 1.0); 
            this._lastItem = null;
            this.z = 6; 
        }

        update() {
            super.update();
            this.updatePosition();
            this.updateTrackingItem();
        }

        updatePosition() {
            this.x = $gamePlayer.screenX();
            this.y = $gamePlayer.screenY() - $gameMap.tileHeight() - 4; 
        }

        updateTrackingItem() {
            const activeItem = HotbarManager.getActiveItem();
            if (this._lastItem !== activeItem) {
                this._lastItem = activeItem;
                this.refreshDisplay();
            }
        }

        refreshDisplay() {
            this.bitmap.clear();
            if (!this._lastItem) return;

            const dbItem = HotbarManager.getDBItem(this._lastItem);
            if (!dbItem) return;

            if (TextOnlyOverhead) {
                this.bitmap.fontSize = OverheadFontSize;
                this.bitmap.textColor = '#ffffff';
                this.bitmap.outlineColor = 'rgba(0,0,0,0.8)';
                this.bitmap.outlineWidth = 4;
                this.bitmap.drawText(dbItem.name, 0, 0, OverheadWidth, OverheadHeight, 'center');
            } else {
                const iconIndex = dbItem.iconIndex;
                const iconBitmap = ImageManager.loadSystem('IconSet');
                if (iconBitmap.isReady()) {
                    const sx = (iconIndex % 16) * 32;
                    const sy = Math.floor(iconIndex / 16) * 32;
                    this.bitmap.blt(iconBitmap, sx, sy, 32, 32, 0, 0, OverheadWidth, OverheadHeight);
                } else {
                    iconBitmap.addLoadListener(() => this.refreshDisplay());
                }
            }
        }
    }

    // --- 3. Custom Sprite Class (Hotbar UI Rendering Component) ---
    class Sprite_Hotbar extends Sprite {
        static get TotalWidth() {
            return (HOTBAR_SLOTS * SlotSize) + ((HOTBAR_SLOTS - 1) * Spacing);
        }
        static get TotalHeight() {
            return SlotSize;
        }

        constructor() {
            super(); 
            this.bitmap = new Bitmap(Sprite_Hotbar.TotalWidth + 4, Sprite_Hotbar.TotalHeight + 4);
            this.opacity = BarOpacity;
            this.anchor.set(0.5, 0.5); 
            this._needsRefresh = true;
            this._dragging = false;
            
            this.refresh();
            if (Draggable) this.setupDragging();
        }

        setupDragging() {
            this.hitArea = new Rectangle(0, 0, this.width, this.height);
            this.interactive = true;
            this.on('pointerdown', this.onPointerDown, this);
            this.on('pointerup', this.onPointerUp, this);
            this.on('pointerupoutside', this.onPointerUp, this);
            this.on('pointermove', this.onPointerMove, this);
        }
        
        onPointerDown(event) {
            if (event.data.originalEvent.button === 0) {
                this._dragging = true;
                this._dragPoint = new PIXI.Point();
                this.parent.toLocal(event.data.global, null, this._dragPoint);
                this._dragPoint.x -= this.x;
                this._dragPoint.y -= this.y;
                SceneManager.requestUpdate();
            }
        }
        
        onPointerUp(event) {
            if (this._dragging) {
                this._dragging = false;
                HotbarManager.setPosition(this.x, this.y);
            }
        }
        
        onPointerMove(event) {
            if (this._dragging) {
                const newPos = this.parent.toLocal(event.data.global);
                this.x = newPos.x - this._dragPoint.x;
                this.y = newPos.y - this._dragPoint.y;
            }
        }

        update() {
            super.update();
            if (this._needsRefresh && ImageManager.isReady()) {
                this.refresh();
            }
        }

        refresh() {
            this.bitmap.clear();
            const bw = Sprite_Hotbar.TotalWidth;
            const bh = Sprite_Hotbar.TotalHeight;
            const context = this.bitmap.context;
            const activeSlotIndex = HotbarManager.getActiveSlotIndex();

            context.save();
            context.translate(2, 2); 

            if (DrawBackground) {
                context.fillStyle = "rgba(0, 0, 0, 0.7)";
                const radius = 8;
                context.beginPath();
                context.moveTo(radius, 0);
                context.lineTo(bw - radius, 0);
                context.arcTo(bw, 0, bw, radius, radius);
                context.lineTo(bw, bh - radius);
                context.arcTo(bw, bh, bw - radius, bh, radius);
                context.lineTo(radius, bh);
                context.arcTo(0, bh, 0, bh - radius, radius);
                context.lineTo(0, radius);
                context.arcTo(0, 0, radius, 0, radius);
                context.fill();
            }

            for (let i = 0; i < HOTBAR_SLOTS; i++) {
                const x = i * (SlotSize + Spacing);
                const y = 0;

                if (i === activeSlotIndex) {
                    context.fillStyle = "rgba(255, 255, 0, 0.4)"; 
                    context.fillRect(x, y, SlotSize, SlotSize);
                }

                context.strokeStyle = "rgba(255, 255, 255, 0.4)";
                context.lineWidth = 2;
                context.strokeRect(x + 1, y + 1, SlotSize - 2, SlotSize - 2);

                const hotbarItem = HotbarManager.getSlotItem(i);
                if (hotbarItem) {
                    const item = HotbarManager.getDBItem(hotbarItem);
                    if (item) {
                        if (TextOnlyHotbar) {
                            this.bitmap.fontSize = HotbarFontSize;
                            this.bitmap.textColor = '#ffffff';
                            this.bitmap.drawText(item.name, x + 2, y + (SlotSize / 2) - (HotbarFontSize / 2) - 4, SlotSize - 4, HotbarFontSize, 'center');
                        } else {
                            const iconIndex = item.iconIndex;
                            const iconBitmap = ImageManager.loadSystem('IconSet');
                            if (iconBitmap.isReady()) {
                                const rect = new Rectangle((iconIndex % 16) * 32, Math.floor(iconIndex / 16) * 32, 32, 32);
                                this.bitmap.blt(iconBitmap, rect.x, rect.y, rect.width, rect.height, 
                                                x + (SlotSize / 2) - 16, y + (SlotSize / 2) - 16, 32, 32);
                            } else {
                                this._needsRefresh = true; 
                                iconBitmap.addLoadListener(this.refresh.bind(this));
                                context.restore();
                                this.bitmap.baseTexture.update();
                                return; 
                            }
                        }
                    }
                }

                this.bitmap.fontSize = 12;
                this.bitmap.textColor = 'rgba(200, 200, 200, 0.8)';
                const keyText = i === 9 ? '0' : (i + 1).toString();
                this.bitmap.drawText(keyText, x + 2, y + SlotSize - 14, SlotSize - 4, 12, 'right');
            }
            
            context.restore(); 
            this.bitmap.baseTexture.update(); 
            this._needsRefresh = false;
        }
    }

    // --- 4. Scene Hooks, Setup, and Layer Integration ---
    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function() {
        _Scene_Map_onMapLoaded.call(this);
        this.createHotbarSprite();
        this.createOverheadItemSprite();
    };

    Scene_Map.prototype.createHotbarSprite = function() {
        HotbarManager.ensureData();
        this._hotbarSprite = new Sprite_Hotbar();
        _hotbarSpriteInstance = this._hotbarSprite; 

        const savedPos = HotbarManager.getPosition();
        let x = savedPos.x;
        let y = savedPos.y;
        
        if (x === 0 && y === 0) {
            x = DefaultX > 0 ? DefaultX : Graphics.width / 2;
            y = DefaultY > 0 ? DefaultY : Graphics.height - SlotSize - Margin;
            HotbarManager.setPosition(x, y);
        }
        
        this._hotbarSprite.x = x;
        this._hotbarSprite.y = y;

        if (this._windowLayer) {
            this._windowLayer.addChild(this._hotbarSprite);
        } else {
            this.addChild(this._hotbarSprite);
        }
    };

    Scene_Map.prototype.createOverheadItemSprite = function() {
        this._overheadItemSprite = new Sprite_OverheadItem();
        this._spriteset.addChild(this._overheadItemSprite);
    };

    // --- 5. Data Manager Hooks (Save/Load Operations) ---
    const _DataManager_createGameObjects = DataManager.createGameObjects;
    DataManager.createGameObjects = function () {
        _DataManager_createGameObjects.apply(this, arguments);
        HotbarManager.ensureData();
    };
    
    const _DataManager_makeSaveContents = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function () {
        const contents = _DataManager_makeSaveContents.apply(this, arguments);
        contents.system.hotbarData = $gameSystem._hotbarData;
        contents.system.hotbarActiveItem = $gameSystem._hotbarActiveItem;
        contents.system.hotbarPos = $gameSystem._hotbarPos; 
        contents.system.hotbarActiveSlotIndex = $gameSystem._hotbarActiveSlotIndex; 
        return contents;
    };

    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (contents) {
        _DataManager_extractSaveContents.apply(this, arguments);
        $gameSystem._hotbarData = contents.system.hotbarData || new Array(HOTBAR_SLOTS).fill(null);
        $gameSystem._hotbarActiveItem = contents.system.hotbarActiveItem || null;
        $gameSystem._hotbarPos = contents.system.hotbarPos || { x: 0, y: 0 };
        $gameSystem._hotbarActiveSlotIndex = contents.system.hotbarActiveSlotIndex !== undefined ? contents.system.hotbarActiveSlotIndex : -1;
        
        if (_hotbarSpriteInstance) _hotbarSpriteInstance.refresh();
    };
    
    // --- 6. Plugin Command Implementations ---
    PluginManager.registerCommand(PLUGIN_NAME, "SetHotbarItem", args => {
        const slotIndex = Number(args.slotIndex || 0);
        const itemType = String(args.itemType || 'item');
        const itemId = Number(args.itemId || 0);
        if (itemId > 0) {
            HotbarManager.addItemToHotbar({ type: itemType, id: itemId }, slotIndex);
        }
    });

    PluginManager.registerCommand(PLUGIN_NAME, "ClearHotbarItem", args => {
        const slotIndex = Number(args.slotIndex || 0);
        HotbarManager.removeItemFromHotbar(slotIndex);
    });
    
    PluginManager.registerCommand(PLUGIN_NAME, "SetActiveSlot", args => {
        const slotIndex = Number(args.slotIndex || 0);
        HotbarManager.setActiveSlotIndex(slotIndex);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "GetActiveSlot", args => {
        const variableId = Number(args.variableId || 0);
        const activeSlotIndex = HotbarManager.getActiveSlotIndex();
        if (variableId > 0) {
            $gameVariables.setValue(variableId, activeSlotIndex);
        }
    });

    PluginManager.registerCommand(PLUGIN_NAME, "DropActiveItem", () => {
        HotbarManager.dropActiveItem();
    });

})();