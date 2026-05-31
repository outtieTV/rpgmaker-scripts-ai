/*====================================================================
  Limited‑Stock Shop for RPG Maker MZ
  • Supports per‑item stock limits.
  • Stock = -1 → unlimited quantity.
  • Two plugin commands:
      • Open Shop          – normal shop (no stock tracking)
      • Open Limited Shop  – shop with mixed limited/unlimited items
====================================================================*/
/*:
 * @plugindesc Shop with per‑item stock limits (‑1 = unlimited).
 * @target MZ
 * @author OuttieTV
 *
 * @command openShop
 * @text Open Shop (no stock limit)
 * @desc Opens a normal shop using a goods list passed as JSON.
 *
 * @arg goods
 * @type struct<ShopItem>[]
 * @text Goods List
 * @desc Items/weapons/armors to sell (no stock tracking).
 *
 * @command openLimitedShop
 * @text Open Limited Shop
 * @desc Opens a shop that respects per‑item stock limits.
 *
 * @arg limitedGoods
 * @type struct<LimitedShopItem>[]
 * @text Limited Goods List
 * @desc Items with stock limits (‑1 = unlimited).
 */

/*~struct~ShopItem:
 *
 * @param type
 * @type select
 * @option Item
 * @option Weapon
 * @option Armor
 * @default Item
 *
 * @param id
 * @type number
 * @min 1
 *
 * @param price
 * @type number
 * @min 0
 */

/*~struct~LimitedShopItem:
 *
 * @param type
 * @type select
 * @option Item
 * @option Weapon
 * @option Armor
 * @default Item
 *
 * @param id
 * @type number
 * @min 1
 *
 * @param price
 * @type number
 * @min 0
 *
 * @param stock
 * @type number
 * @min -1
 * @desc How many units are available. Use -1 for unlimited.
 */

(() => {
    // -----------------------------------------------------------------
    // 1️⃣ Helper: prepare shop data with stock limits (‑1 = unlimited)
    // -----------------------------------------------------------------
    window.prepareLimitedShop = function (goods) {
        $gameTemp._limitedShopGoods = goods.map(g => ({
            type:  Number(g.type),
            id:    Number(g.id),
            price: Number(g.price),
            stock: Number(g.stock)   // -1 → unlimited
        }));
    };

    // -----------------------------------------------------------------
    // 2️⃣ Helper: open the shop using the prepared limited data
    // -----------------------------------------------------------------
    window.openLimitedShop = function () {
        $gameTemp._shopGoods = $gameTemp._limitedShopGoods.map(g => [
            g.type, g.id, g.price
        ]);
        SceneManager.push(Scene_Shop);
    };

    // -----------------------------------------------------------------
    // 3️⃣ Hook into the purchase process to enforce stock limits
    // -----------------------------------------------------------------
    const _Window_ShopBuy_doBuy = Window_ShopBuy.prototype.doBuy;
    Window_ShopBuy.prototype.doBuy = function (number) {
        const index = this._index;
        const goods = $gameTemp._limitedShopGoods?.[index];

        // No limited‑stock data → default behaviour
        if (!goods) {
            return _Window_ShopBuy_doBuy.call(this, number);
        }

        // Unlimited items (stock < 0) skip all checks
        if (goods.stock < 0) {
            return _Window_ShopBuy_doBuy.call(this, number);
        }

        // Out of stock → cancel purchase
        if (goods.stock === 0) {
            $gameMessage.add("\\c[2]No more stock left for that item.");
            return;
        }

        // Cap purchase at available stock
        const maxBuy = Math.min(number, goods.stock);
        if (maxBuy < number) {
            $gameMessage.add(`\\c[2]Only ${maxBuy} left; buying that many.`);
        }

        // Perform the original purchase with the capped amount
        _Window_ShopBuy_doBuy.call(this, maxBuy);

        // Reduce stock after a successful purchase
        if (this._money >= goods.price * maxBuy) {
            goods.stock -= maxBuy;
        }
    };

    // -----------------------------------------------------------------
    // 4️⃣ Plugin command – normal shop (no stock tracking)
    // -----------------------------------------------------------------
    PluginManager.registerCommand('SimpleShop', 'openShop', args => {
        const goods = JSON.parse(args.goods);
        $gameTemp._shopGoods = goods.map(g => [
            Number(g.type), Number(g.id), Number(g.price)
        ]);
        SceneManager.push(Scene_Shop);
    });

    // -----------------------------------------------------------------
    // 5️⃣ Plugin command – limited‑stock shop (mixed unlimited items)
    // -----------------------------------------------------------------
    PluginManager.registerCommand('SimpleShop', 'openLimitedShop', args => {
        const goods = JSON.parse(args.limitedGoods);
        prepareLimitedShop(goods);
        openLimitedShop();
    });
})();
