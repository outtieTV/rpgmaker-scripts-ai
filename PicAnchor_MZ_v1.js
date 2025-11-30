/*:
 * @target MZ
 * @plugindesc v1.0.0: Anchor Pictures to Map Tiles
 * @author OuttieTV
 *
 * @help
 * PicAnchor_MZ_v1
 *
 * This plugin adds commands + a script-call API to show pictures anchored
 * to map tiles. Anchored pictures scroll with the map.
 *
 * === Plugin Commands ===
 * 1. Show Anchored Picture
 * 2. Erase Anchored Picture
 *
 * === Script Call Version ===
 *
 * $gameScreen.showPictureAnchor(
 *   pictureId, filename, anchorType, tileX, tileY,
 *   origin, x, y, scaleX, scaleY, opacity, blendMode, isAnchor
 * )
 *
 * === Terms ===
 * Free for commercial and non-commercial use. No credit required.
 *
 *
 * @command ShowAnchoredPicture
 * @text Show Anchored Picture
 * @desc Shows a picture anchored to a map tile.
 *
 * @arg pictureId
 * @type number
 * @text Picture ID
 * @desc The picture slot (1–100)
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
 * @option Top-Left
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
 * @text Opacity (0–255)
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
 *
 * @command EraseAnchoredPicture
 * @text Erase Anchored Picture
 * @desc Erases a picture by ID.
 *
 * @arg pictureId
 * @type number
 * @text Picture ID
 * @desc Picture slot to erase.
 */

(function() {
    'use strict';

    //=====================================================
    //  Plugin Commands
    //=====================================================

    const pluginName = "PicAnchor_MZ_v1";

    PluginManager.registerCommand(pluginName, "ShowAnchoredPicture", args => {
        const pictureId = Number(args.pictureId);
        const filename = String(args.filename);
        const anchorType = String(args.anchorType);
        const tileX = Number(args.tileX);
        const tileY = Number(args.tileY);

        const origin = Number(args.origin);
        const scaleX = Number(args.scaleX);
        const scaleY = Number(args.scaleY);
        const opacity = Number(args.opacity);
        const blendMode = Number(args.blendMode);

        // x/y ignored because anchored
        $gameScreen.showPictureAnchor(
            pictureId, filename, anchorType, tileX, tileY,
            origin, 0, 0, scaleX, scaleY, opacity, blendMode, true
        );
    });

    PluginManager.registerCommand(pluginName, "EraseAnchoredPicture", args => {
        const pictureId = Number(args.pictureId);
        $gameScreen.erasePicture(pictureId);
    });


    //=====================================================
    //  Anchoring System
    //=====================================================

    const _Game_Screen_showPicture = Game_Screen.prototype.showPicture;

    Game_Screen.prototype.showPictureAnchor = function(
        pictureId, name, anchorType, tileX, tileY,
        origin, x, y, scaleX, scaleY, opacity, blendMode, isAnchor
    ) {
        _Game_Screen_showPicture.call(
            this, pictureId, name, origin, x, y,
            scaleX, scaleY, opacity, blendMode
        );

        if (isAnchor) {
            const picture = this.picture(pictureId);
            if (picture) {
                picture._anchorType = anchorType.toLowerCase();
                picture._tileX = tileX;
                picture._tileY = tileY;
                picture._isAnchor = true;

                this.updatePictureAnchor(picture);
            }
        }
    };

    const tileToScreenX = (tileX) => {
        return Math.round($gameMap.adjustX(tileX) * $gameMap.tileWidth());
    };
    const tileToScreenY = (tileY) => {
        return Math.round($gameMap.adjustY(tileY) * $gameMap.tileHeight());
    };

    Game_Screen.prototype.updatePictureAnchor = function(picture) {
        if (!picture._isAnchor) return;

        const screenX = tileToScreenX(picture._tileX);
        const screenY = tileToScreenY(picture._tileY);

        picture._x = screenX;
        picture._y = screenY;
    };

    const _Game_Picture_update = Game_Picture.prototype.update;
    Game_Picture.prototype.update = function() {
        _Game_Picture_update.call(this);
        if (this._isAnchor) {
            $gameScreen.updatePictureAnchor(this);
        }
    };

    const _Game_Picture_initBasic = Game_Picture.prototype.initBasic;
    Game_Picture.prototype.initBasic = function() {
        _Game_Picture_initBasic.call(this);
        this._isAnchor = false;
        this._tileX = 0;
        this._tileY = 0;
        this._anchorType = "";
    };

    const _Game_Map_setDisplayPos = Game_Map.prototype.setDisplayPos;
    Game_Map.prototype.setDisplayPos = function(x, y) {
        const oldX = this._displayX;
        const oldY = this._displayY;

        _Game_Map_setDisplayPos.call(this, x, y);

        if (oldX !== this._displayX || oldY !== this._displayY) {
            $gameScreen._pictures.forEach(pic => {
                if (pic && pic._isAnchor) {
                    $gameScreen.updatePictureAnchor(pic);
                }
            });
        }
    };

})();
