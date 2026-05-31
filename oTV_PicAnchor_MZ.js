/*:
 * @target MZ
 * @plugindesc v1.0.8 – Anchor pictures to map tiles and optionally create solid collision regions.
 * @author OuttieTV
 *
 * @param Debug
 * @type boolean
 * @default false
 *
 * @command ShowAnchoredPicture
 * @text Show Anchored Picture
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
 * @option center
 * @option top-left
 * @default top-left
 *
 * @arg tileX
 * @type number
 *
 * @arg tileY
 * @type number
 *
 * @arg origin
 * @type select
 * @option Top-Left
 * @value 0
 * @option Center
 * @value 1
 * @default 0
 *
 * @arg scaleX
 * @type number
 * @default 100
 *
 * @arg scaleY
 * @type number
 * @default 100
 *
 * @arg opacity
 * @type number
 * @default 255
 *
 * @arg blendMode
 * @type select
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
 * @default false
 *
 * @arg topLeftX
 * @type number
 * @default 0
 *
 * @arg topLeftY
 * @type number
 * @default 0
 *
 * @arg bottomRightX
 * @type number
 * @default 0
 *
 * @arg bottomRightY
 * @type number
 * @default 0
 *
 * @command EraseAnchoredPicture
 * @text Erase Anchored Picture
 *
 * @arg pictureId
 * @type number
 *
 * @help
 * ============================================================================
 * oTV_PicAnchor_MZ
 * ============================================================================
 *
 * Writes Region ID 1 directly into map region data.
 *
 * IMPORTANT:
 * Use together with oTV_StopMove_MZ configured to block Region ID 1.
 *
 * ============================================================================
 */

(() => {
    'use strict';

    //=========================================================================
    // CONFIG
    //=========================================================================

    const PLUGIN_NAME = "oTV_PicAnchor_MZ";
    const params = PluginManager.parameters(PLUGIN_NAME);
    const DEBUG = params["Debug"] === "true";

    //=========================================================================
    // HELPERS
    //=========================================================================

    const tileToScreenX = tileX =>
        Math.round($gameMap.adjustX(tileX) * $gameMap.tileWidth());

    const tileToScreenY = tileY =>
        Math.round($gameMap.adjustY(tileY) * $gameMap.tileHeight());

    //=========================================================================
    // GAME PICTURE
    //=========================================================================

    const _Game_Picture_initBasic =
        Game_Picture.prototype.initBasic;

    Game_Picture.prototype.initBasic = function() {
        _Game_Picture_initBasic.call(this);

        this._isAnchor = false;
        this._tileX = 0;
        this._tileY = 0;
        this._anchorType = "top-left";
        this._isSolid = false;
        this._origin = 0;

        this._manualTLX = 0;
        this._manualTLY = 0;
        this._manualBRX = 0;
        this._manualBRY = 0;

        this._pictureIdEx = 0;
    };

    Game_Picture.prototype.safeWidth = function() {
        return typeof this.width === "function"
            ? this.width()
            : (this._width || 0);
    };

    Game_Picture.prototype.safeHeight = function() {
        return typeof this.height === "function"
            ? this.height()
            : (this._height || 0);
    };

    Game_Picture.prototype.pixelRect = function() {

        if (!this._isAnchor) return null;

        const baseX = tileToScreenX(this._tileX);
        const baseY = tileToScreenY(this._tileY);

        const nativeW = this.safeWidth();
        const nativeH = this.safeHeight();

        const scaleX = this._scaleX / 100;
        const scaleY = this._scaleY / 100;

        const w = Math.round(nativeW * scaleX);
        const h = Math.round(nativeH * scaleY);

        let offsetX = 0;
        let offsetY = 0;

        if (this._origin === 1) {
            offsetX = Math.round(w / 2);
            offsetY = Math.round(h / 2);
        }

        return {
            tlX: baseX - offsetX,
            tlY: baseY - offsetY,
            brX: baseX - offsetX + w,
            brY: baseY - offsetY + h
        };
    };

    //=========================================================================
    // COMMANDS
    //=========================================================================

    PluginManager.registerCommand(
        PLUGIN_NAME,
        "ShowAnchoredPicture",
        args => {

            $gameScreen.showPictureAnchor(
                Number(args.pictureId),
                String(args.filename),
                String(args.anchorType),
                Number(args.tileX),
                Number(args.tileY),
                Number(args.origin),
                0,
                0,
                Number(args.scaleX),
                Number(args.scaleY),
                Number(args.opacity),
                Number(args.blendMode),
                true,
                args.isSolid === "true",
                Number(args.topLeftX),
                Number(args.topLeftY),
                Number(args.bottomRightX),
                Number(args.bottomRightY)
            );
        }
    );

    PluginManager.registerCommand(
        PLUGIN_NAME,
        "EraseAnchoredPicture",
        args => {

            $gameScreen.erasePicture(
                Number(args.pictureId)
            );
        }
    );

    //=========================================================================
    // SHOW PICTURE
    //=========================================================================

    const _Game_Screen_showPicture =
        Game_Screen.prototype.showPicture;

    Game_Screen.prototype.showPictureAnchor = function(
        pictureId,
        name,
        anchorType,
        tileX,
        tileY,
        origin,
        x,
        y,
        scaleX,
        scaleY,
        opacity,
        blendMode,
        isAnchor,
        isSolid,
        topLeftX,
        topLeftY,
        bottomRightX,
        bottomRightY
    ) {

        _Game_Screen_showPicture.call(
            this,
            pictureId,
            name,
            origin,
            x,
            y,
            scaleX,
            scaleY,
            opacity,
            blendMode
        );

        const pic = this.picture(pictureId);

        if (!pic) return;

        pic._pictureIdEx = pictureId;

        pic._isAnchor = isAnchor;
        pic._isSolid = isSolid;

        pic._anchorType = anchorType;

        pic._tileX = tileX;
        pic._tileY = tileY;

        pic._origin = origin;

        pic._manualTLX = topLeftX;
        pic._manualTLY = topLeftY;
        pic._manualBRX = bottomRightX;
        pic._manualBRY = bottomRightY;

        this.updatePictureAnchor(pic);

        if (isSolid) {
            this.markPictureRegion(pic);
        }
    };

    //=========================================================================
    // POSITION UPDATE
    //=========================================================================

    Game_Screen.prototype.updatePictureAnchor = function(pic) {

        if (!pic._isAnchor) return;

        pic._x = tileToScreenX(pic._tileX);
        pic._y = tileToScreenY(pic._tileY);
    };

    //=========================================================================
    // REGION WRITER
    //=========================================================================

    Game_Screen.prototype.markPictureRegion = function(pic) {

        let startTx;
        let startTy;
        let endTx;
        let endTy;

        const useManual =
            pic._manualTLX !== 0 ||
            pic._manualTLY !== 0 ||
            pic._manualBRX !== 0 ||
            pic._manualBRY !== 0;

        if (useManual) {

            startTx = pic._manualTLX;
            startTy = pic._manualTLY;

            endTx = pic._manualBRX;
            endTy = pic._manualBRY;

        } else {

            const rect = pic.pixelRect();

            if (!rect) return;

            const tileW = $gameMap.tileWidth();
            const tileH = $gameMap.tileHeight();

            startTx = Math.floor(rect.tlX / tileW);
            startTy = Math.floor(rect.tlY / tileH);

            endTx = Math.floor((rect.brX - 1) / tileW);
            endTy = Math.floor((rect.brY - 1) / tileH);
        }

        const mapWidth = $gameMap.width();
        const mapHeight = $gameMap.height();

        // CRITICAL FIX:
        // Use $dataMap.data instead of $gameMap._data
        // because _data may not exist in MZ.

        if (!$dataMap || !$dataMap.data) {
            console.error("PicAnchor: $dataMap.data missing.");
            return;
        }

        const data = $dataMap.data;

        const regionLayer = 5;

        for (let ty = startTy; ty <= endTy; ty++) {

            for (let tx = startTx; tx <= endTx; tx++) {

                if (
                    tx < 0 ||
                    ty < 0 ||
                    tx >= mapWidth ||
                    ty >= mapHeight
                ) {
                    continue;
                }

                const index =
                    (regionLayer * mapWidth * mapHeight) +
                    (ty * mapWidth) +
                    tx;

                // SAFETY CHECK
                if (index < 0 || index >= data.length) {
                    console.warn(
                        `PicAnchor: Invalid region index ${index}`
                    );
                    continue;
                }

                data[index] = 1;

                if (DEBUG) {
                    console.log(
                        `PicAnchor: Region 1 -> (${tx}, ${ty}) [index=${index}]`
                    );
                }
            }
        }

        if (DEBUG) {
            console.log(
                `PicAnchor: FINAL BOX (${startTx},${startTy}) -> (${endTx},${endTy})`
            );
        }
    };

    //=========================================================================
    // MAP SCROLL
    //=========================================================================

    const _Game_Map_setDisplayPos =
        Game_Map.prototype.setDisplayPos;

    Game_Map.prototype.setDisplayPos = function(x, y) {

        const oldX = this._displayX;
        const oldY = this._displayY;

        _Game_Map_setDisplayPos.call(this, x, y);

        if (
            oldX !== this._displayX ||
            oldY !== this._displayY
        ) {

            $gameScreen._pictures.forEach(pic => {

                if (pic && pic._isAnchor) {
                    $gameScreen.updatePictureAnchor(pic);
                }
            });
        }
    };

    //=========================================================================
    // PICTURE UPDATE
    //=========================================================================

    const _Game_Picture_update =
        Game_Picture.prototype.update;

    Game_Picture.prototype.update = function() {

        _Game_Picture_update.call(this);

        if (this._isAnchor) {
            $gameScreen.updatePictureAnchor(this);
        }
    };

    //=========================================================================
    // MAP SETUP
    //=========================================================================

    const _Game_Map_setup =
        Game_Map.prototype.setup;

    Game_Map.prototype.setup = function(mapId) {

        for (let i = 1; i <= 100; i++) {
            $gameScreen.erasePicture(i);
        }

        _Game_Map_setup.call(this, mapId);
    };

})();