//=============================================================================
// RPG Maker MZ - oTV_SmartFarmControls_MZ.js
//=============================================================================
/*:
 * @target MZ
 * @plugindesc v1.1.0 - Contextual smart farming logic tying Hotbar items to the tile underneath the player.
 * @author Contextual Glue Script
 * @base oTV_FarmingSystem_MZ
 * @orderAfter oTV_FarmingSystem_MZ
 *
 * @help oTV_SmartFarmControls.js
 *
 * This plugin creates a unified action command for your interaction key (e.g., E).
 * It reads the active hotbar slot, evaluates the item name text, and executes
 * the corresponding Farmland action contextually on the tile directly underneath the player.
 *
 * @command ExecuteSmartAction
 * @text Execute Smart Action
 * @desc Evaluates the active hotbar item and interacts contextually with the player's tile.
 */

(() => {
    const PLUGIN_NAME = "oTV_SmartFarmControls_MZ";

    PluginManager.registerCommand(PLUGIN_NAME, "ExecuteSmartAction", args => {
        // Ensure the FarmManager module exists before running actions
        if (typeof window.FarmManager === 'undefined') {
            console.error("SmartFarmControls Error: FarmManager is missing! Make sure oTV_FarmingSystem_MZ is turned on and placed above this plugin.");
            return;
        }
        
        const farm = window.FarmManager;

        // 1. Determine target tile coordinate directly UNDERNEATH the player
        const targetX = $gamePlayer.x;
        const targetY = $gamePlayer.y;

        // 2. Fetch the active slot index from HotbarManager
        const activeIndex = HotbarManager.getActiveSlotIndex();
        
        // Handle "Empty Hand" contextually (no slot active, index -1)
        if (activeIndex === -1) {
            handleEmptyHandAction(targetX, targetY);
            return;
        }

        const hotbarItem = HotbarManager.getSlotItem(activeIndex);
        
        // Handle explicit empty slot (index selected but slot array element is null)
        if (!hotbarItem) {
            handleEmptyHandAction(targetX, targetY);
            return;
        }

        // 3. Resolve the actual Database Object (Item, Weapon, or Armor)
        let dbItem = HotbarManager.getDBItem(hotbarItem);
        
        // Fallback: If your hotbar plugin stores type data separately (e.g., hotbarItem.type === 'weapon')
        // or if we need to search weapons when dbItem isn't found in $dataItems:
        if (!dbItem && hotbarItem && hotbarItem.id) {
            dbItem = $dataWeapons[hotbarItem.id] || $dataItems[hotbarItem.id];
        }
        
        if (!dbItem) return;

        const itemName = (dbItem.name || "").toLowerCase();

        // 4. Contextual actions targeting the tile underneath the player
        if (itemName.includes("hoe")) {
            // Till the farmland if active slot contains "hoe"
            farm.till(targetX, targetY);
        } 
		else if (itemName.includes("seed")) {
            // Extracts the base CropId by removing " Seed" or " Seeds" from item names
            let cropId = dbItem.name.replace(/\s*Seeds?\s*/i, "").trim(); 

            console.log("🌱 [SMART CONTROLS] Attempting to Plant Seed!");
            console.log(`- Hotbar Item Database Name: "${dbItem.name}"`);
            console.log(`- Calculated Crop ID to match JSON: "${cropId}"`);
            console.log(`- Party Has Seed Item ID 32?`, $gameParty.hasItem($dataItems[32], 1));
            
            farm.plant(targetX, targetY, cropId);
        } 
        else if (itemName.includes("watering can")) {
            // Water tilled farmland or planted crops if active slot contains "watering can"
            farm.water(targetX, targetY);
        } 
        else {
            // Fallback for non-farming items: allow standard empty hand mechanics or ignore
            handleEmptyHandAction(targetX, targetY);
        }
    });

    // Helper handler for empty hand harvesting
    function handleEmptyHandAction(x, y) {
        if (typeof window.FarmManager === 'undefined') return;
        const farm = window.FarmManager;
        
        const cropData = farm.getCropData(x, y);
        // If there is a crop and its state is planted, harvest it
        if (cropData && cropData.state === 'planted') {
            farm.harvest(x, y);
        }
    }
})();