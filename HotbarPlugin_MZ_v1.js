/*:
 * @target MZ
 * @plugindesc v1.0.1 - Adds a fully-featured, draggable (optional), savable 10-slot hot-bar (keys 1-0) with a simple API and expanded Plugin Commands.
 *
 * @param loadJson
 * @text Load JSON?
 * @type boolean
 * @on Yes
 * @off No
 * @desc If true, the plugin will attempt to load hotbar data from an external JSON file.
 * @default false
 *
 * @param slotSize
 * @text Slot Size
 * @type number
 * @min 16
 * @max 128
 * @desc Width/height in pixels of each square hotbar slot.
 * @default 48
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
 * @desc Allow the designer/player to drag the hotbar when playtesting. Position will be saved in save files.
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
 * Hotbar Plugin (MZ) - v1.0.1
 * --------------------------
 * Features:
 * - 10 slots labeled 1..9 and 0 (0 is the tenth slot).
 * - Each slot displays the icon of an assigned item/skill (uses IconSet).
 * - Press keys 1-0 to swap the player's currently selected item (Item/Skill scenes) 
 * or the plugin-managed "active item" with the hotbar slot.
 * - Bar can be draggable (controlled by plugin parameter 'draggable'). 
 * Position is saved/loaded with save files.
 * - Slot is highlighted when its corresponding key (1-0) is pressed.
 * - Full API access for other plugins.
 * * * API Functions (Use in Script calls):
 * HotbarManager.addItemToHotbar(itemDescriptor, slotIndex)   // place item/skill into slot (0..9)
 * HotbarManager.removeItemFromHotbar(slotIndex)              // clear a slot
 * HotbarManager.getHotbarItem(slotIndex)                     // returns descriptor or null
 * HotbarManager.setActiveItem(itemDescriptor)                // set plugin-managed active item
 * HotbarManager.getActiveItem()                              // get plugin-managed active item
 * HotbarManager.setActiveSlotIndex(slotIndex)                // NEW: Manually set the active hotbar slot index (0-9)
 * HotbarManager.getActiveSlotIndex()                         // NEW: Get the currently stored active hotbar slot index (0-9)
 *
 * ItemDescriptor accepted formats (can be used in addItemToHotbar):
 * - number -> treated as item id (item)
 * - "item:4", "skill:12", "weapon:3", "armor:2"
 * - { type: 'item'|'skill'|'weapon'|'armor', id: number }
 *
 * Plugin Commands:
 * - SetHotbarItem: Sets an item or skill into a specific hotbar slot.
 * @arg slotIndex
 * @type number
 * @min 0
 * @max 9
 * @default 0
 * @text Slot Index (0-9)
 * @desc The hotbar slot index (0-9) to modify.
 * @arg itemType
 * @type select
 * @option Item
 * @value item
 * @option Weapon
 * @value weapon
 * @option Armor
 * @value armor
 * @option Skill
 * @value skill
 * @default item
 * @text Item Type
 * @desc The database type of the item/skill.
 * @arg itemId
 * @type number
 * @min 1
 * @default 1
 * @text Item/Skill ID
 * @desc The ID of the item/skill in the database.
 *
 * - ClearHotbarItem: Clears a specific hotbar slot.
 * @arg slotIndex
 * @type number
 * @min 0
 * @max 9
 * @default 0
 * @text Slot Index (0-9)
 * @desc The hotbar slot index (0-9) to clear.
 *
 * - SetActiveSlot: Sets the currently "active" slot index (0-9).
 * @arg slotIndex
 * @type number
 * @min 0
 * @max 9
 * @default 0
 * @text Active Slot Index (0-9)
 * @desc The hotbar slot index (0-9) to set as active.
 *
 * - GetActiveSlot: Retrieves the currently "active" slot index (0-9) into a Game Variable.
 * @arg variableId
 * @type variable
 * @default 1
 * @text Game Variable ID
 * @desc The ID of the Game Variable to store the active slot index (0-9).
  *
 * @command SetHotbarItem
 * @text Set Hotbar Item
 * @desc Set an item/skill into a specific hotbar slot.
 *
 * @arg slotIndex
 * @type number
 * @min 0
 * @max 9
 * @default 0
 * @text Slot Index (0-9)
 *
 * @arg itemType
 * @type select
 * @text Item Type
 * @option Item
 * @value item
 * @option Weapon
 * @value weapon
 * @option Armor
 * @value armor
 * @option Skill
 * @value skill
 * @default item
 *
 * @arg itemId
 * @type number
 * @min 1
 * @default 1
 * @text Item/Skill ID
 *
 * @command ClearHotbarItem
 * @text Clear Hotbar Item
 * @desc Clears a specific hotbar slot.
 *
 * @arg slotIndex
 * @type number
 * @min 0
 * @max 9
 * @default 0
 * @text Slot Index (0-9)
 *
 * @command SetActiveSlot
 * @text Set Active Slot
 * @desc Sets the currently active hotbar slot index.
 *
 * @arg slotIndex
 * @type number
 * @min 0
 * @max 9
 * @default 0
 * @text Active Slot Index (0-9)
 *
 * @command GetActiveSlot
 * @text Get Active Slot
 * @desc Stores the active slot index into a game variable.
 *
 * @arg variableId
 * @type variable
 * @default 1
 * @text Game Variable ID
 * @desc Variable to store the active slot index.
 *
 */

(() => {
    // --- 1. Plugin Constants and Parameters ---
    const PLUGIN_NAME = "HotbarPlugin_MZ_v1";
    const HOTBAR_SLOTS = 10;
    
    // Key codes for 1, 2, 3, 4, 5, 6, 7, 8, 9, 0 (Key Code 48 is '0', 49 is '1')
    const KEY_CODES = [49, 50, 51, 52, 53, 54, 55, 56, 57, 48]; 

    // Parse Plugin Parameters
    const parameters = PluginManager.parameters(PLUGIN_NAME);
	const LoadJson = (parameters.loadJson === "true");
    const SlotSize = Number(parameters.slotSize || 48);
    const Spacing = Number(parameters.spacing || 4);
    const Margin = Number(parameters.margin || 12);
    const BarOpacity = Number(parameters.opacity || 200);
    const DrawBackground = (parameters.background === "true");
    const Draggable = (parameters.draggable === "true");
    const DefaultX = Number(parameters.defaultX || 0);
    const DefaultY = Number(parameters.defaultY || 0);

    // --- 2. Hotbar Data Manager (Singleton) ---
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
            // New: Position data
            if (!$gameSystem._hotbarPos) {
                $gameSystem._hotbarPos = { x: 0, y: 0 }; // Will be calculated in Scene_Map
            }
            // NEW: Active Slot Index
            if (typeof $gameSystem._hotbarActiveSlotIndex !== 'number') {
                $gameSystem._hotbarActiveSlotIndex = -1; // -1 means no slot is explicitly active
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

					if (Array.isArray(data.slots)) {
						$gameSystem._hotbarData = data.slots;
					}
					if (data.activeSlot !== undefined) {
						$gameSystem._hotbarActiveSlotIndex = data.activeSlot;
					}
					console.log("[Hotbar] Loaded JSON successfully.");
				} else {
					console.warn("[Hotbar] JSON file not found:", filePath);
				}

			} catch (err) {
				console.error("[Hotbar] Failed to load JSON:", err);
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
            // When the active item changes, reset the active slot index (unless logic demands otherwise)
            // For now, let's keep active slot index independent of active item unless explicitly set.
            if (_hotbarSpriteInstance) _hotbarSpriteInstance.refresh();
        }
        
        // NEW: Get/Set Active Slot Index
        static getActiveSlotIndex() {
            this.ensureData();
            return $gameSystem._hotbarActiveSlotIndex;
        }

        static setActiveSlotIndex(index) {
            this.ensureData();
            const slotIndex = index >= 0 && index < HOTBAR_SLOTS ? index : -1;
            $gameSystem._hotbarActiveSlotIndex = slotIndex;
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
        
        // Converts various inputs into a standardized { type: string, id: number } descriptor
        static normalizeItem(itemInput) {
            if (typeof itemInput === 'number') {
                return { type: 'item', id: itemInput };
            }
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

        // Helper to get the actual database object from the hotbar item type/id
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

        // --- PUBLIC API WRAPPERS ---
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
                return true;
            }
            return false;
        }
        
        static getHotbarItem(slotIndex) {
            return HotbarManager.getSlotItem(slotIndex);
        }

        // --- SWAPPING LOGIC (Key press) ---
        static handleHotbarSwap(slotIndex) {
            if (slotIndex < 0 || slotIndex >= HOTBAR_SLOTS) return;
            
            const currentSlotItem = HotbarManager.getSlotItem(slotIndex);
            let activeItem = HotbarManager.getActiveItem();
            
            // 1. Check for Scene_Item (or Scene_Skill) context
            const scene = SceneManager._scene;
            const isItemScene = (scene instanceof Scene_Item || scene instanceof Scene_Skill);
            
            if (isItemScene) {
                // If in an item/skill menu, swap with the currently selected item/skill
                const selectedItem = scene._itemWindow.item();
                if (selectedItem) {
                    // Convert selected item to descriptor
                    let selectedDescriptor = null;
                    if (DataManager.isItem(selectedItem)) selectedDescriptor = { type: 'item', id: selectedItem.id };
                    else if (DataManager.isWeapon(selectedItem)) selectedDescriptor = { type: 'weapon', id: selectedItem.id };
                    else if (DataManager.isArmor(selectedItem)) selectedDescriptor = { type: 'armor', id: selectedItem.id };
                    else if (DataManager.isSkill(selectedItem)) selectedDescriptor = { type: 'skill', id: selectedItem.id };

                    if (selectedDescriptor) {
                        // Perform the swap in the hotbar (slot gets the selected item)
                        HotbarManager.setSlotItem(slotIndex, selectedDescriptor);
                        
                        // Update the selected item in the window (it gets the old hotbar item)
                        scene._itemWindow.select(0); // Deselecting prevents errors if index is broken
                        scene._itemWindow.select(scene._itemWindow.find(HotbarManager.getDBItem(currentSlotItem)));
                        scene._itemWindow.refresh();
                        
                        // Note: Inventory changes (losing/gaining 1 item) are complex and usually handled
                        // by custom core inventory plugins. Here, we just handle the descriptor swap.
                    }
                    return; // Done if in a menu scene
                }
            } 
            
            // 2. Default Swap (Map Scene or no item selected)
            // Slot gets the active item, active item gets the old slot item
            HotbarManager.setActiveItem(currentSlotItem);
            HotbarManager.setSlotItem(slotIndex, activeItem);
            
            // Additionally, set the slot as the currently active slot index
            HotbarManager.setActiveSlotIndex(slotIndex);

            // Optional: Show a message when swapping the active item
            const newActiveDBItem = HotbarManager.getDBItem(HotbarManager.getActiveItem());
            const activeName = newActiveDBItem ? newActiveDBItem.name : "Nothing";
            $gameMessage.add(`Active item swapped to: ${activeName}`);
        }
    }
    
    // Global exposure
    window.HotbarManager = HotbarManager;
    let _hotbarSpriteInstance = null; // Store a global reference

    // --- 3. Custom Sprite Class (The Hotbar UI + Dragging) ---
    class Sprite_Hotbar extends Sprite {
        static get TotalWidth() {
            return (HOTBAR_SLOTS * SlotSize) + ((HOTBAR_SLOTS - 1) * Spacing);
        }
        static get TotalHeight() {
            return SlotSize;
        }

        constructor() {
            super(); 
            this.bitmap = new Bitmap(Sprite_Hotbar.TotalWidth + 4, Sprite_Hotbar.TotalHeight + 4); // +4 for border space
            this.opacity = BarOpacity;
            this.anchor.set(0.5, 0.5); 
            this._needsRefresh = true;
            this._dragging = false;
            this._highlightedSlot = -1; // Property for key-press highlighting
            
            this.refresh();
            
            if (Draggable) {
                this.setupDragging();
            }
        }

        // --- Draggable Setup ---
        setupDragging() {
            // Adjust hit area slightly to allow for the small 2px translation in refresh()
            this.hitArea = new Rectangle(0, 0, this.width, this.height);
            this.interactive = true;

            // Mouse/Touch start
            this.on('pointerdown', this.onPointerDown, this);
            // Mouse/Touch end
            this.on('pointerup', this.onPointerUp, this);
            this.on('pointerupoutside', this.onPointerUp, this);
            // Mouse/Touch move
            this.on('pointermove', this.onPointerMove, this);
        }
        
        onPointerDown(event) {
            if (event.data.originalEvent.button === 0) { // Only allow left click/touch
                this._dragging = true;
                this._dragPoint = new PIXI.Point();
                this.parent.toLocal(event.data.global, null, this._dragPoint);
                this._dragPoint.x -= this.x;
                this._dragPoint.y -= this.y;
                SceneManager.requestUpdate(); // Ensure update loop runs while dragging
            }
        }
        
        onPointerUp(event) {
            if (this._dragging) {
                this._dragging = false;
                // Save the new position
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

        // --- Update and Drawing ---

        // Check for key presses and update highlight
        update() {
            super.update();
            this.updateHighlight();
            if (this._needsRefresh && ImageManager.isReady()) {
                this.refresh();
            }
        }
        
        // Checks key input and sets the highlighted slot
        updateHighlight() {
            let newHighlight = -1;
            for (let i = 0; i < HOTBAR_SLOTS; i++) {
                // Check if the key for this slot is currently being pressed
                if (Input.isPressed(KEY_CODES[i])) {
                    newHighlight = i;
                    // If the key was JUST triggered (not just held), perform the swap
                    if (Input.isTriggered(KEY_CODES[i]) && !SceneManager.isSceneChanging() && SceneManager._scene instanceof Scene_Map) {
                        HotbarManager.handleHotbarSwap(i);
                    }
                }
            }

            // Also check for the explicitly set active slot
            const activeSlotIndex = HotbarManager.getActiveSlotIndex();
            // If no key is pressed, use the active slot index for highlight
            if (newHighlight === -1 && activeSlotIndex !== -1) {
                newHighlight = activeSlotIndex;
            }

            if (this._highlightedSlot !== newHighlight) {
                this._highlightedSlot = newHighlight;
                this._needsRefresh = true; // Force redraw to show/hide highlight
            }
        }


        // Draws the hotbar contents: background, slots, and icons
        refresh() {
            this.bitmap.clear();
            const bw = Sprite_Hotbar.TotalWidth;
            const bh = Sprite_Hotbar.TotalHeight;
            const context = this.bitmap.context;

            // Move context origin slightly if border is drawn (to accommodate strokeRect)
            context.save();
            context.translate(2, 2); // Shift drawing to account for 4px border space

            // Draw Background (Optional)
            if (DrawBackground) {
                context.fillStyle = "rgba(0, 0, 0, 0.7)";
                const radius = 8;
                // Draw a rectangle sized for the total slots
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

            // Draw Slots and Icons
            for (let i = 0; i < HOTBAR_SLOTS; i++) {
                const x = i * (SlotSize + Spacing);
                const y = 0;

                // 1. Draw Slot Highlight (NEW FEATURE)
                if (i === this._highlightedSlot) {
                    context.fillStyle = "rgba(255, 255, 0, 0.5)"; // Bright yellow highlight
                    context.fillRect(x, y, SlotSize, SlotSize);
                }

                // 2. Draw Slot Border
                context.strokeStyle = "rgba(255, 255, 255, 0.5)";
                context.lineWidth = 2;
                context.strokeRect(x + 1, y + 1, SlotSize - 2, SlotSize - 2);

                // 3. Draw Slot Icon
                const hotbarItem = HotbarManager.getSlotItem(i);
                if (hotbarItem) {
                    const item = HotbarManager.getDBItem(hotbarItem);
                    if (item) {
                        const iconIndex = item.iconIndex;
                        const iconBitmap = ImageManager.loadSystem('IconSet');
                        
                        // Wait for icon set to load before drawing
                        if (iconBitmap.isReady()) {
                            const rect = new Rectangle(
                                (iconIndex % 16) * 32, 
                                Math.floor(iconIndex / 16) * 32, 
                                32, 
                                32
                            );
                            // Draw the icon centered inside the slot, scaling it up or down
                            this.bitmap.blt(iconBitmap, rect.x, rect.y, rect.width, rect.height, 
                                            x + (SlotSize / 2) - 16 + 2, y + (SlotSize / 2) - 16 + 2, 32, 32);
                        } else {
                            this._needsRefresh = true; 
                            iconBitmap.addLoadListener(this.refresh.bind(this));
                            context.restore(); // Restore context before early return
                            this.bitmap.baseTexture.update();
                            return; 
                        }
                    }
                }

                // 4. Draw Key Label (1-9, 0 for slot 10)
                this.bitmap.textColor = 'white';
                const keyText = i === 9 ? '0' : (i + 1).toString();
                this.bitmap.drawText(keyText, x + 2, y + SlotSize - 16 + 2, SlotSize, 16, 'center');
            }
            
            context.restore(); // Restore context
            this.bitmap.baseTexture.update(); // Update the texture for rendering
            this._needsRefresh = false;
        }
    }
    
    // --- 4. Scene Hook and Initialization ---

    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function() {
        _Scene_Map_onMapLoaded.call(this);
        this.createHotbarSprite();
    };

    Scene_Map.prototype.createHotbarSprite = function() {
        HotbarManager.ensureData();
        
        this._hotbarSprite = new Sprite_Hotbar();
        _hotbarSpriteInstance = this._hotbarSprite; 

        // Set initial position based on saved data or defaults
        const savedPos = HotbarManager.getPosition();
        let x = savedPos.x;
        let y = savedPos.y;
        
        // If not saved, calculate default position
        if (x === 0 && y === 0) {
            x = DefaultX > 0 ? DefaultX : Graphics.width / 2;
            y = DefaultY > 0 ? DefaultY : Graphics.height - SlotSize - Margin; // Fixed calculation to use SlotSize (TotalHeight)
            HotbarManager.setPosition(x, y);
        }
        
        this._hotbarSprite.x = x;
        this._hotbarSprite.y = y;

        // Add to the Scene's _windowLayer for correct Z-indexing
        if (this._windowLayer) {
            this._windowLayer.addChild(this._hotbarSprite);
        } else {
            this.addChild(this._hotbarSprite);
        }
        
        // Log final position for debugging
        console.log(`[${PLUGIN_NAME}]: Hotbar UI created and added at (${this._hotbarSprite.x}, ${this._hotbarSprite.y}).`);
    };

    // --- 5. Data Manager Hooks (Saving/Loading Position) ---
    
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
        // NEW: Save the active slot index
        contents.system.hotbarActiveSlotIndex = $gameSystem._hotbarActiveSlotIndex; 
        return contents;
    };

    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (contents) {
        _DataManager_extractSaveContents.apply(this, arguments);
        $gameSystem._hotbarData = contents.system.hotbarData || new Array(HOTBAR_SLOTS).fill(null);
        $gameSystem._hotbarActiveItem = contents.system.hotbarActiveItem || null;
        $gameSystem._hotbarPos = contents.system.hotbarPos || { x: 0, y: 0 };
        // NEW: Load the active slot index
        $gameSystem._hotbarActiveSlotIndex = contents.system.hotbarActiveSlotIndex !== undefined 
            ? contents.system.hotbarActiveSlotIndex 
            : -1;
        
        if (_hotbarSpriteInstance) _hotbarSpriteInstance.refresh();
    };

    // --- 6. Input Handling (The 1-0 Keys) ---
    // We add the key codes to the Input map so Input.isPressed() works.
    Input.keyMapper[KEY_CODES[0]] = 'hotbar1';
    Input.keyMapper[KEY_CODES[1]] = 'hotbar2';
    Input.keyMapper[KEY_CODES[2]] = 'hotbar3';
    Input.keyMapper[KEY_CODES[3]] = 'hotbar4';
    Input.keyMapper[KEY_CODES[4]] = 'hotbar5';
    Input.keyMapper[KEY_CODES[5]] = 'hotbar6';
    Input.keyMapper[KEY_CODES[6]] = 'hotbar7';
    Input.keyMapper[KEY_CODES[7]] = 'hotbar8';
    Input.keyMapper[KEY_CODES[8]] = 'hotbar9';
    Input.keyMapper[KEY_CODES[9]] = 'hotbar0';
    
    // The actual swapping happens inside Sprite_Hotbar.updateHighlight().
    
    // --- 7. Plugin Commands (for Events) ---
    
    PluginManager.registerCommand(PLUGIN_NAME, "SetHotbarItem", args => {
        const slotIndex = Number(args.slotIndex || 0);
        const itemType = String(args.itemType || 'item');
        const itemId = Number(args.itemId || 0);
        
        if (itemId > 0) {
            HotbarManager.addItemToHotbar({ type: itemType, id: itemId }, slotIndex);
        } else {
             console.warn(`[${PLUGIN_NAME}] SetHotbarItem failed: Item ID must be greater than 0.`);
        }
    });

    PluginManager.registerCommand(PLUGIN_NAME, "ClearHotbarItem", args => {
        const slotIndex = Number(args.slotIndex || 0);
        HotbarManager.removeItemFromHotbar(slotIndex);
    });
    
    // NEW PLUGIN COMMAND: SetActiveSlot
    PluginManager.registerCommand(PLUGIN_NAME, "SetActiveSlot", args => {
        const slotIndex = Number(args.slotIndex || 0);
        HotbarManager.setActiveSlotIndex(slotIndex);
        if (_hotbarSpriteInstance) _hotbarSpriteInstance._needsRefresh = true;
    });

    // NEW PLUGIN COMMAND: GetActiveSlot
    PluginManager.registerCommand(PLUGIN_NAME, "GetActiveSlot", args => {
        const variableId = Number(args.variableId || 0);
        const activeSlotIndex = HotbarManager.getActiveSlotIndex();
        
        if (variableId > 0) {
            $gameVariables.setValue(variableId, activeSlotIndex);
            console.log(`[${PLUGIN_NAME}] GetActiveSlot: Stored active slot index (${activeSlotIndex}) into Game Variable ${variableId}.`);
        } else {
            console.warn(`[${PLUGIN_NAME}] GetActiveSlot failed: Game Variable ID must be greater than 0.`);
        }
    });

})();
