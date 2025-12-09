/*:
 * @target MZ
 * @plugindesc v1.0.0 - Simple moving gauge using CGMZ Core drawing helpers.
 * @author OuttieTV
 *
 * @help
 * A minimal example showing how to draw and animate a gauge using
 * CGMZ Core's drawing functions (drawRect, drawGauge). No bitmap.fillRect.
 *
 * Plugin Command:
 *   SimpleGaugeTest  - Opens the test scene with the moving gauge.
 */

(() => {
    const PLUGIN_NAME = "SimpleGauge_MZ_v1";

    // --------------------------------------------------------------
    // Helper – hex → rgba (used for manual drawing)
    // --------------------------------------------------------------
    function hexToRgba(hex) {
        if (typeof hex !== "string") return "rgba(0,0,0,1)";
        const n = parseInt(hex.replace("#", ""), 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        return `rgba(${r},${g},${b},1)`;
    }

    // --------------------------------------------------------------
    // Sprite that draws the two‑gauge display (vertical)
    // --------------------------------------------------------------
    class Sprite_TwoVerticalGauges extends Sprite {
        constructor() {
            super();

            // ---- dimensions -------------------------------------------------
            this.barWidth   = 32;   // width of both bars
            this.barHeight  = 180;  // total height of the outer (gray‑blue) bar
            this.innerHeight = 80;  // fixed height of the moving green bar

            // bitmap a little larger to hold the bars + a title / % text
            this.bitmap = new Bitmap(this.barWidth + 20, this.barHeight + 50);

            // ---- animation state --------------------------------------------
            this._rate = 0;   // 0 → 1, controls vertical offset of the green bar
            this._dir  = 1;   // direction of travel

            this.update();   // draw first frame
        }

        update() {
            super.update();

            // bounce the offset
            this._rate += 0.01 * this._dir;
            if (this._rate >= 1) { this._rate = 1; this._dir = -1; }
            if (this._rate <= 0) { this._rate = 0; this._dir = 1; }

            this.refresh();
        }

        refresh() {
            const b = this.bitmap;
            b.clear();

            // ---- title -------------------------------------------------
            b.drawText("Vertical Gauges", 0, 0, b.width, "center");

            // ---- outer bar (gray background, blue border) ---------------
            const x = 10;                     // left margin inside bitmap
            const y = 20;                     // top margin
            const w = this.barWidth;
            const h = this.barHeight;

            // gray fill
            b.fillRect(x, y, w, h, "#808080");
            // blue border (1‑pixel thick)
            //b.drawRect(x, y, w, h, "#0000FF");

            // ---- inner green bar (smaller, moves inside outer) -------
            // The green bar can travel only inside the outer bar, so its
            // top edge ranges from y (fully up) to y + (h - innerHeight) (fully down).
            const travelRange = h - this.innerHeight;               // max vertical travel
            const offsetY = Math.floor(travelRange * this._rate);   // current offset

            // draw the green bar
            b.fillRect(x, y + offsetY, w, this.innerHeight, "#00FF00");

            // ---- numeric read‑out --------------------------------------
            b.drawText(`${Math.floor(this._rate * 100)}%`,
                0, y + h + 4, b.width, "center");
        }
    }

    // --------------------------------------------------------------
    // Simple scene that just shows the sprite
    // --------------------------------------------------------------
    class Scene_TwoVerticalGaugesTest extends Scene_Base {
        create() {
            super.create();
            const gauges = new Sprite_TwoVerticalGauges();
            gauges.x = (Graphics.width  - gauges.width)  / 2;
            gauges.y = (Graphics.height - gauges.height) / 2;
            this.addChild(gauges);
        }
    }

    // --------------------------------------------------------------
    // Register the command (same name as before)
    // --------------------------------------------------------------
    PluginManager.registerCommand(PLUGIN_NAME, "SimpleGaugeTest", () => {
        SceneManager.push(Scene_TwoVerticalGaugesTest);
    });
})();
