//=============================================================================
// RPG Maker MZ - oTV_ProfessionsBridge_MZ.js (Optimized Native Connection)
//=============================================================================
/*:
 * @target MZ
 * @plugindesc v1.5.0 – Bridge linking OuttieTV Farming/Fishing to CGMZ Profession &
 * Toast systems via optimized native queues.
 * @author AI Collaborator
 * @base oTV_FarmingSystem_MZ
 * @orderAfter oTV_FarmingSystem_MZ
 * @orderAfter CGMZ_ToastManager
 *
 * @help
 * This plugin interfaces OuttieTV's Fishing and Farming systems with CGMZ 
 * Professions and Toast Manager. It relies directly on CGMZ's internal array 
 * queue to circumvent multi-toast timing conflicts and structural string splits.
 *
 * ----------------------------------------------------------------------------
 * IMPORTANT: Place this plugin BELOW CGMZ_ToastManager and oTV_FarmingSystem_MZ 
 * in your Plugin Manager hierarchy.
 * ----------------------------------------------------------------------------
 */

(() => {
    const PLUGIN_NAME = "oTV_ProfessionsBridge_MZ";

    // -------------------- CONFIGURATION --------------------
    const XP_PER_FARM_ACTION = 50;
    const XP_PER_FISH_SUCCESS = 50;

    // Default text color mappings used when making native toasts
    const COLOR_TITLE_GOLD = 16;
    const COLOR_TEXT_WHITE = 0;

    // -------------------------------------------------------
    // Core Toast Display Pipeline (CGMZ Native Object Hooks)
    // -------------------------------------------------------
    function fireNativeToast(line1Text, line2Text, line1Color = COLOR_TITLE_GOLD, line2Color = COLOR_TEXT_WHITE) {
        // Safe check to verify CGMZ's global temporal tracker is up
        if (typeof $cgmzTemp === "undefined" || typeof $cgmzTemp.createNewToast !== "function") {
            console.warn(`[${PLUGIN_NAME}] CGMZ Toast engine unavailable. Console Fallback:`);
            console.log(`[TOAST FALLBACK] ${line1Text} | ${line2Text}`);
            return;
        }

        // Build the precise data structure CGMZ_ToastManager expects internally
        const toastData = {
            isText: true,
            width: Number(PluginManager.parameters('CGMZ_ToastManager')["Width"]) || 360,
            height: 2, // Built around 2 structured lines
            lineOne: line1Text,
            lineOneColor: line1Color,
            lineOneAlignment: "center",
            lineTwo: line2Text,
            lineTwoColor: line2Color,
            lineTwoAlignment: "center",
            displayTime: 0, // 0 tells CGMZ to fall back to global plugin parameters
            backgroundStyle: "Window"
        };

        // Push directly into CGMZ's display queue array bypasses Command sequencing restrictions
        $cgmzTemp.createNewToast(toastData);
        console.log(`[${PLUGIN_NAME}] Native Toast queued: "${line1Text}" - "${line2Text}"`);
    }

    // -------------------------------------------------------
    // Core: Grant XP + Handle Level‑up & Achievements
    // -------------------------------------------------------
    function gainProfessionXP(professionName, amount) {
        console.log(`[${PLUGIN_NAME}] XP Yield Request: +${amount} to ${professionName}`);

        if (typeof $cgmz === "undefined" || typeof $cgmz.getProfession !== "function") {
            console.error(`[${PLUGIN_NAME}] $cgmz data or getProfession processing is missing.`);
            return;
        }

        const profession = $cgmz.getProfession(professionName);
        if (!profession) {
            console.error(`[${PLUGIN_NAME}] Profession configuration for '${professionName}' was not found.`);
            return;
        }

        const oldLevel = profession._level;

        // Apply experience point shift natively via CGMZ prototype logic
        if (typeof profession.changeExp === "function") {
            profession.changeExp("+", amount);
        } else {
            // Raw variable fallback assignment if core structures deviate
            profession._exp += amount;
            console.warn(`[${PLUGIN_NAME}] changeExp missing. Applied raw math fallback tracking.`);
        }

        const newLevel = profession._level;

        // 1️⃣ Queue the basic XP gains toast immediately 
        fireNativeToast("XP Gained", `+${amount} XP in ${professionName}`, COLOR_TITLE_GOLD, COLOR_TEXT_WHITE);

        // 2️⃣ If the player leveled up, natively stack the Level-Up Toast immediately behind it
        if (newLevel > oldLevel) {
            console.log(`🎉 [${PLUGIN_NAME}] Level-up detected! ${oldLevel} → ${newLevel}`);
            
            // Safe queueing allows back-to-back invocation without thread-locking timeouts
            fireNativeToast("Level Up!", `${professionName} reached Level ${newLevel}!`, 2, COLOR_TEXT_WHITE);

            // Handle Milestones/Achievements
            if (newLevel % 10 === 0 || newLevel === 99) {
                const prefix = professionName.toLowerCase().substring(0, 4);
                const achievementId = `${prefix}_lvl${newLevel}`;

                if (typeof $cgmz.earnAchievement === "function") {
                    $cgmz.earnAchievement(achievementId);
                    console.log(`🏆 [${PLUGIN_NAME}] Unlocking Milestone Achievement: "${achievementId}"`);
                    
                    fireNativeToast("Achievement Unlocked!", `Level ${newLevel} ${professionName} Mastered!`, 3, COLOR_TEXT_WHITE);
                }
            }
        }
    }

    // -------------------------------------------------------
    // FISHING INTERACTION HOOK
    // -------------------------------------------------------
    if (typeof FishingSystem !== "undefined") {
        console.log(`[${PLUGIN_NAME}] Hooking into FishingSystem minigame structures...`);
        const _FishingSystem_onMinigameComplete = FishingSystem.prototype.onMinigameComplete;
        
        FishingSystem.prototype.onMinigameComplete = function (success, regionType) {
            _FishingSystem_onMinigameComplete.call(this, success, regionType);
            if (success) {
                gainProfessionXP("Fishing", XP_PER_FISH_SUCCESS);
            }
        };
    } else {
        console.log(`[${PLUGIN_NAME}] FishingSystem missing - Skipping fisher hooks.`);
    }

    // -------------------------------------------------------
    // FARMING INTERACTION HOOKS (Delayed Setup validation)
    // -------------------------------------------------------
    setTimeout(() => {
        if (typeof window.FarmManager !== "undefined") {
            console.log(`[${PLUGIN_NAME}] Validated window.FarmManager object. Mounting agriculture hooks...`);
            const FarmManager = window.FarmManager;

            // ----- TILL ACTION -----
            const _FarmManager_till = FarmManager.till;
            FarmManager.till = function (x, y) {
                const oldData = this.getCropData(x, y);
                _FarmManager_till.call(this, x, y);
                const newData = this.getCropData(x, y);
                if (!oldData && newData && newData.state === "tilled") {
                    gainProfessionXP("Farming", XP_PER_FARM_ACTION);
                }
            };

            // ----- PLANT ACTION -----
            const _FarmManager_plant = FarmManager.plant;
            FarmManager.plant = function (x, y, cropId) {
                const oldData = this.getCropData(x, y);
                _FarmManager_plant.call(this, x, y, cropId);
                const newData = this.getCropData(x, y);
                if (oldData && oldData.state === "tilled" && newData && newData.state === "planted") {
                    gainProfessionXP("Farming", XP_PER_FARM_ACTION);
                }
            };

            // ----- WATER ACTION -----
            const _FarmManager_water = FarmManager.water;
            FarmManager.water = function (x, y) {
                const data = this.getCropData(x, y);
                if (data && !data.wateredToday) {
                    _FarmManager_water.call(this, x, y);
                    gainProfessionXP("Farming", XP_PER_FARM_ACTION);
                }
            };

            // ----- HARVEST ACTION -----
            const _FarmManager_harvest = FarmManager.harvest;
            FarmManager.harvest = function (x, y) {
                const oldData = this.getCropData(x, y);
                _FarmManager_harvest.call(this, x, y);
                const newData = this.getCropData(x, y);
                if (oldData && oldData.state === "planted" && newData && newData.state === "tilled") {
                    gainProfessionXP("Farming", XP_PER_FARM_ACTION * 2); // Harvest awards double base weight
                }
            };
        } else {
            console.error(`[${PLUGIN_NAME}] window.FarmManager is absent. Double check load-order arrangements.`);
        }
    }, 1000);
})();