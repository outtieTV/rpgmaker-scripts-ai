/*:
 * @target MZ
 * @plugindesc v1.0.0 - Simple moving gauge using CGMZ Core drawing helpers.
 * @author OuttieTV
 *
 * @command SimpleGaugeTest
 * @text Simple Gauge Test
 * @desc Simple Gauge Test
 *
 * @help
 * A minimal example showing how to draw and animate a gauge using
 * CGMZ Core's drawing functions (drawGauge). No bitmap.fillRect.
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
    // Sprite that draws the three‑gauge display (vertical)
    // --------------------------------------------------------------
    class Sprite_ThreeVerticalGauges extends Sprite {
        constructor() {
            super();

            // ---- dimensions -------------------------------------------------
            this.barWidth    = 32;   // width of all bars
            this.barHeight   = 180;  // outer (gray‑blue) bar height
            this.greenHeight = 80;   // green bar height
            this.blueHeight  = 40;   // blue bar height (smaller than green)

            // bitmap a little larger for title / % text
            this.bitmap = new Bitmap(this.barWidth + 20, this.barHeight + 60);

            // ---- animation state --------------------------------------------
            // green bar (button‑controlled)
            this._greenRate = 0;
            this._greenDir  = 1;

            // blue bar (autonomous)
            this._blueRate = 0;
            this._blueDir  = 1;

            this.update();   // draw first frame
        }

        update() {
            super.update();

            // ----- GREEN BAR – moves only while OK is held -----------------
            if (Input.isPressed('ok')) {
                this._greenRate += 0.01 * this._greenDir;
                if (this._greenRate >= 1) { this._greenRate = 1; this._greenDir = -1; }
                if (this._greenRate <= 0) { this._greenRate = 0; this._greenDir = 1; }
            }

            // ----- BLUE BAR – autonomous bounce ----------------------------
            this._blueRate += 0.008 * this._blueDir;   // slightly slower than green
            if (this._blueRate >= 1) { this._blueRate = 1; this._blueDir = -1; }
            if (this._blueRate <= 0) { this._blueRate = 0; this._blueDir = 1; }

            this.refresh();
        }

        refresh() {
            const b = this.bitmap;
            b.clear();

            // ---- title -------------------------------------------------
            b.drawText("Three Vertical Gauges", 0, 0, b.width, "center");

            // ---- outer bar (gray background, blue border) ---------------
            const x = 10;                     // left margin inside bitmap
            const y = 20;                     // top margin
            const w = this.barWidth;
            const h = this.barHeight;

            // gray fill
            b.fillRect(x, y, w, h, "#808080");

            // ---- helper to compute vertical offset inside outer bar -----
            const travelRange = h - this.greenHeight; // max travel for green
            const travelRangeBlue = h - this.blueHeight; // max travel for blue

            // ----- GREEN BAR (button‑controlled) -------------------------
            const greenOffset = Math.floor(travelRange * this._greenRate);
            b.fillRect(x, y + greenOffset, w, this.greenHeight, "#00FF00");

            // ----- BLUE BAR (autonomous) --------------------------------
            const blueOffset = Math.floor(travelRangeBlue * this._blueRate);
            b.fillRect(x, y + blueOffset, w, this.blueHeight, "#0000FF");

            // ---- numeric read‑outs (optional) ---------------------------
            b.drawText(`G:${Math.floor(this._greenRate*100)}%  B:${Math.floor(this._blueRate*100)}%`,
                0, y + h + 4, b.width, "center");
        }
    }

    // --------------------------------------------------------------
    // Simple scene that just shows the sprite
    // --------------------------------------------------------------
    class Scene_ThreeVerticalGaugesTest extends Scene_Base {
        create() {
            super.create();
            const gauges = new Sprite_ThreeVerticalGauges();
            gauges.x = (Graphics.width  - gauges.width)  / 2;
            gauges.y = (Graphics.height - gauges.height) / 2;
            this.addChild(gauges);
        }
    }

    // --------------------------------------------------------------
    // Register the command (same name as before)
    // --------------------------------------------------------------
    PluginManager.registerCommand(PLUGIN_NAME, "SimpleGaugeTest", () => {
        SceneManager.push(Scene_ThreeVerticalGaugesTest);
    });
})();

