/*:
 * @target MZ
 * @plugindesc v1.0.5 – Anchor pictures to map tiles. Allows manual specification of Region ID 1 bounding box instead of calculating from picture size.
 * @author OuttieTV
 *
 * @param Debug
 * @type boolean
 * @default false
 * @desc When true, the plugin logs tile and pixel coordinates for each solid picture.
 *
 * @command ShowAnchoredPicture
 * @text Show Anchored Picture
 * @desc Shows a picture anchored to a map tile.
 *
 * @arg pictureId
 * @type number
 * @text Picture ID
 *
 * @arg filename
 * @type file
 * @dir img/pictures
 * @text Picture File
 *
 * @arg anchorType
 * @type select
 * @text Anchor Type
 * @option center
 * @option top-left
 *
 * @arg tileX
 * @type number
 * @text Tile X
 *
 * @arg tileY
 * @type number
 * @text Tile Y
 *
 * @arg origin
 * @type select
 * @text Origin
 * @option Top‑Left
 * @value 0
 * @option Center
 * @value 1
 * @default 0
 *
 * @arg scaleX
 * @type number
 * @text Scale X (%)
 * @default 100
 *
 * @arg scaleY
 * @type number
 * @text Scale Y (%)
 * @default 100
 *
 * @arg opacity
 * @type number
 * @text Opacity (0‑255)
 * @default 255
 *
 * @arg blendMode
 * @type select
 * @text Blend Mode
 * @option Normal
 * @value 0
 * @option Add
 * @value 1
 * @option Multiply
 * @value 2
 * @option Screen
 * @value 3
 * @default 0
 *
 * @arg isSolid
 * @type boolean
 * @text Is Solid?
 * @desc If true, prevents the player from moving onto any tile the picture occupies.
 * @default false
 *
 * // --- ADDED ARGUMENTS START ---
 * @arg topLeftX
 * @type number
 * @min -9999
 * @default 0
 * @text Region TL Tile X
 * @desc Manually set the top-left X tile coordinate for the solid region (0 to disable manual setting).
 *
 * @arg topLeftY
 * @type number
 * @min -9999
 * @default 0
 * @text Region TL Tile Y
 * @desc Manually set the top-left Y tile coordinate for the solid region (0 to disable manual setting).
 *
 * @arg bottomRightX
 * @type number
 * @min -9999
 * @default 0
 * @text Region BR Tile X
 * @desc Manually set the bottom-right X tile coordinate for the solid region (0 to disable manual setting).
 *
 * @arg bottomRightY
 * @type number
 * @min -9999
 * @default 0
 * @text Region BR Tile Y
 * @desc Manually set the bottom-right Y tile coordinate for the solid region (0 to disable manual setting).
 * // --- ADDED ARGUMENTS END ---
 *
 * @command EraseAnchoredPicture
 * @text Erase Anchored Picture
 * @desc Erases a picture by ID.
 *
 * @arg pictureId
 * @type number
 * @text Picture ID
 *
 * @help
 * This version works like the original PicAnchor_MZ_v1, but instead of
 * blocking movement via `Game_Player.canPass`, it **writes Region ID 1**
 * to every map tile that a solid picture occupies.
 *
 * **v1.0.5 Feature:** You can now manually specify the exact bounding box
 * for the Region ID 1 set by a solid picture using the new arguments:
 * Region TL Tile X/Y and Region BR Tile X/Y. Set any of them to a
 * non-zero value to activate manual bounding.
 *
 * All other commands (Show/Erase picture, erase‑all‑on‑map‑change) are
 * unchanged.
 *
 * -------------------------------------------------------------------------
 * Plugin Commands
 * -------------------------------------------------------------------------
 * Show Anchored Picture – same arguments as the original plugin, plus
 * four new arguments for manually setting the Region ID bounding box.
 * Erase Anchored Picture – same arguments as the original plugin.
 *
 * -------------------------------------------------------------------------
 * Parameters
 * -------------------------------------------------------------------------
 * Debug – true/false. When true the console will show:
 *    • Tile X,Y that are being set to region 1
 *    • Pixel rectangle of the picture (TL/BR)
 */

(() => {
    'use strict';

    //=====================================================================
    //  Parameters
    //=====================================================================
    const PLUGIN_NAME = "PicAnchor_MZ_v1";
    const params = PluginManager.parameters(PLUGIN_NAME);
    const DEBUG = params['Debug'] === 'true';

    //=====================================================================
    //  Helpers
    //=====================================================================
    const tileToScreenX = tileX => Math.round($gameMap.adjustX(tileX) * $gameMap.tileWidth());
    const tileToScreenY = tileY => Math.round($gameMap.adjustY(tileY) * $gameMap.tileHeight());

    // --------------------------------------------------------------------
    // Returns the pixel rectangle of an anchored picture.
    // --------------------------------------------------------------------
    Game_Picture.prototype.pixelRect = function () {
        if (!this._isAnchor) return null;

        const baseX = tileToScreenX(this._tileX);
        const baseY = tileToScreenY(this._tileY);

        const nativeW = this.safeWidth();
        const nativeH = this.safeHeight();

        const scaleX = this._scaleX / 100;
        const scaleY = this._scaleY / 100;
        const w = Math.round(nativeW * scaleX);
        const h = Math.round(nativeH * scaleY);

        let offsetX = 0, offsetY = 0;
        if (this._origin === 1) { // centre
            offsetX = Math.round(w / 2);
            offsetY = Math.round(h / 2);
        }

        const tlX = baseX - offsetX;
        const tlY = baseY - offsetY;
        const brX = tlX + w;
        const brY = tlY + h;

        return { tlX, tlY, brX, brY, w, h };
    };

    // --------------------------------------------------------------------
    // Debug printer (only runs when DEBUG === true)
    // --------------------------------------------------------------------
    Game_Picture.prototype.debugPrint = function () {
        if (!DEBUG) return;
        const rect = this.pixelRect();
        if (!rect) return;
        //console.log(
            //`Picture #${this._pictureId || '??'} pixel bounds:` +
            //` TL(${rect.tlX},${rect.tlY}) – BR(${rect.brX},${rect.brY})`
        //);
    };

    //=====================================================================
    //  Plugin Commands
    //=====================================================================
    PluginManager.registerCommand(PLUGIN_NAME, "ShowAnchoredPicture", args => {
        const pictureId = Number(args.pictureId);
        const filename   = String(args.filename);
        const anchorType = String(args.anchorType);
        const tileX      = Number(args.tileX);
        const tileY      = Number(args.tileY);
        const origin     = Number(args.origin);
        const scaleX     = Number(args.scaleX);
        const scaleY     = Number(args.scaleY);
        const opacity    = Number(args.opacity);
        const blendMode  = Number(args.blendMode);
        const isSolid    = args.isSolid === 'true';
        // --- ADDED ARGUMENTS RETRIEVAL START ---
        const topLeftX   = Number(args.topLeftX);
        const topLeftY   = Number(args.topLeftY);
        const bottomRightX = Number(args.bottomRightX);
        const bottomRightY = Number(args.bottomRightY);
        // --- ADDED ARGUMENTS RETRIEVAL END ---

        $gameScreen.showPictureAnchor(
            pictureId, filename, anchorType, tileX, tileY,
            origin, 0, 0, scaleX, scaleY, opacity, blendMode, true, isSolid,
            // --- PASSING NEW ARGUMENTS START ---
            topLeftX, topLeftY, bottomRightX, bottomRightY
            // --- PASSING NEW ARGUMENTS END ---
        );
    });

    PluginManager.registerCommand(PLUGIN_NAME, "EraseAnchoredPicture", args => {
        $gameScreen.erasePicture(Number(args.pictureId));
    });

    //=====================================================================
    //  Core Anchoring (unchanged except for region marking)
    //=====================================================================
    const _Game_Screen_showPicture = Game_Screen.prototype.showPicture;

    Game_Screen.prototype.showPictureAnchor = function(
        pictureId, name, anchorType, tileX, tileY,
        origin, x, y, scaleX, scaleY, opacity, blendMode,
        isAnchor, isSolid,
        // --- RECEIVING NEW ARGUMENTS START ---
        topLeftX, topLeftY, bottomRightX, bottomRightY
        // --- RECEIVING NEW ARGUMENTS END ---
    ) {
        // Create a normal picture first
        _Game_Screen_showPicture.call(
            this, pictureId, name, origin, x, y,
            scaleX, scaleY, opacity, blendMode
        );

        if (isAnchor) {
            const pic = this.picture(pictureId);
            if (pic) {
                pic._anchorType = anchorType.toLowerCase();
                pic._tileX      = tileX;
                pic._tileY      = tileY;
                pic._isAnchor   = true;
                pic._isSolid    = isSolid;
                pic._origin     = origin;
                // --- STORING NEW ARGUMENTS START ---
                pic._manualTLX = topLeftX;
                pic._manualTLY = topLeftY;
                pic._manualBRX = bottomRightX;
                pic._manualBRY = bottomRightY;
                // --- STORING NEW ARGUMENTS END ---
                this.updatePictureAnchor(pic);

                // ---- Debug output for this picture ----
                pic.debugPrint();

                // ---- If solid, mark every occupied tile with Region ID 1 ----
                if (isSolid) {
                    this.markPictureRegion(pic);
                }
            }
        }
    };

    // Keep picture position synced with map scrolling
    Game_Screen.prototype.updatePictureAnchor = function(picture) {
        if (!picture._isAnchor) return;
        picture._x = tileToScreenX(picture._tileX);
        picture._y = tileToScreenY(picture._tileY);
    };

    //=====================================================================
    //  Mark tiles occupied by a solid picture (Region ID 1)
    //=====================================================================
    Game_Screen.prototype.markPictureRegion = function (picture) {
        // --- MODIFIED LOGIC START: Check for manual arguments ---
        const useManual = (picture._manualTLX !== 0 || picture._manualTLY !== 0 ||
                         picture._manualBRX !== 0 || picture._manualBRY !== 0);

        let startTx, startTy, endTx, endTy;

        if (useManual) {
            // Use manual arguments if provided
            startTx = picture._manualTLX;
            startTy = picture._manualTLY;
            endTx   = picture._manualBRX;
            endTy   = picture._manualBRY;

            if (DEBUG) {
                console.log(`PicAnchor: Using manual region bounds for picture #${picture._pictureId || '??'}`);
            }
        } else {
            // Fallback to calculation based on picture size (original logic)
            const rect = picture.pixelRect();
            if (!rect) return;

            const tileW = $gameMap.tileWidth();
            const tileH = $gameMap.tileHeight();

            // Convert pixel rectangle to tile range (inclusive)
            startTx = Math.floor(rect.tlX / tileW);
            startTy = Math.floor(rect.tlY / tileH);
            endTx   = Math.floor((rect.brX - 1) / tileW); // -1 to stay inside the last tile
            endTy   = Math.floor((rect.brY - 1) / tileH);
        }

        // Call setTileSquareId with either calculated or manual bounds
        $gameMap.setTileSquareId(startTx, endTx, startTy, endTy, 1);
        
        if (DEBUG) {
            console.log(`PicAnchor: set Region 1 at tile (${startTx},${startTy}) – (${endTx},${endTy})`);
        }
        // --- MODIFIED LOGIC END ---
    };

    //=====================================================================
    //  Erase pictures when the player changes maps
    //=====================================================================
    const _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        // Clear picture slots (1‑100) before loading the new map
        for (let i = 1; i <= 100; i++) $gameScreen.erasePicture(i);
        _Game_Map_setup.call(this, mapId);
    };

    const _Game_Map_setDisplayPos = Game_Map.prototype.setDisplayPos;
    Game_Map.prototype.setDisplayPos = function(x, y) {
        const oldX = this._displayX;
        const oldY = this._displayY;
        _Game_Map_setDisplayPos.call(this, x, y);
        if (oldX !== this._displayX || oldY !== this._displayY) {
            // Re‑position anchored pictures after scrolling
            $gameScreen._pictures.forEach(pic => {
                if (pic && pic._isAnchor) $gameScreen.updatePictureAnchor(pic);
            });
        }
    };

    //=====================================================================
    //  Picture property extensions (unchanged, but added new properties)
    //=====================================================================
    const _Game_Picture_initBasic = Game_Picture.prototype.initBasic;
    Game_Picture.prototype.initBasic = function() {
        _Game_Picture_initBasic.call(this);
        this._isAnchor   = false;
        this._tileX      = 0;
        this._tileY      = 0;
        this._anchorType = "";
        this._isSolid    = false;
        this._origin     = 0;   // 0 = top‑left, 1 = centre
        // --- ADDED MANUAL REGION PROPERTIES START ---
        this._manualTLX  = 0;
        this._manualTLY  = 0;
        this._manualBRX  = 0;
        this._manualBRY  = 0;
        // --- ADDED MANUAL REGION PROPERTIES END ---
    };

    const _Game_Picture_update = Game_Picture.prototype.update;
    Game_Picture.prototype.update = function() {
        _Game_Picture_update.call(this);
        if (this._isAnchor) {
            $gameScreen.updatePictureAnchor(this);
        }
    };

    // --------------------------------------------------------------------
    // Safe width / height helpers (covers both function & property cases)
    // --------------------------------------------------------------------
    Game_Picture.prototype.safeWidth = function () {
        return typeof this.width === "function" ? this.width() : this._width || 0;
    };
    Game_Picture.prototype.safeHeight = function () {
        return typeof this.height === "function" ? this.height() : this._height || 0;
    };

    //=====================================================================
    //  No longer need custom canPass logic – original RPG Maker handling
    //  remains untouched.
    //=====================================================================

})(); // end of IIFE
