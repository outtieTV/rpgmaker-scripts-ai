/*:
 * @target MZ
 * @plugindesc v1.5.1 - Feature-rich Hot‑bar manager scene with fixed precise mouse hitboxes for all modes.
 * Opens with SceneManager.push(CGMZ_Scene_HotbarManager);
 * @author oTV & AI Collaborator
 *
 * @help
 * This scene lets the player add / remove / select items, weapons, armors, or skills
 * to the hot‑bar slots defined by oTV_HotbarPlugin_MZ.js.
 *
 * Left Side: Inventory List. Click an item to open the interactive action prompt.
 * Box Prompt: Choose to Add or Clear, cycle slots with native [◀] / [▶] buttons, 
 * and see duplicate tracking warnings automatically. Fully responsive to mouse/touch clicks!
 * Right Side: Hotbar Preview. Click a slot to make it your active hand selection!
 * Press Cancel/ESC on the right side to wipe a slot clean.
 */

(() => {
    const Hotbar = HotbarManager; // alias for brevity

    function keyToSlot(key) {
        return key === 0 ? 9 : key - 1;
    }

    const BaseScene = (typeof CGMZ_Scene_MenuBase !== 'undefined') ? CGMZ_Scene_MenuBase : Scene_MenuBase;

    class Scene_CGMZ_Scene_HotbarManager extends BaseScene {
        create() {
            super.create();
            this.createHelpWindow();
            this.createItemWindow();
            this.createHotbarWindow();
            this.createSlotInputWindow();
        }

        /** -------------------------------------------------------------
         * Left Side: Inventory Window
         * ---------------------------------------------------------- */
        createItemWindow() {
            const rect = this.itemWindowRect();
            this._itemWindow = new Window_ItemList(rect);
            this._itemWindow.setHelpWindow(this._helpWindow);
            this._itemWindow.setCategory("item"); 
            
            this._itemWindow.setHandler("ok", this.onItemOk.bind(this));
            this._itemWindow.setHandler("cancel", this.onSceneCancel.bind(this));
            
            this.addWindow(this._itemWindow);
            this._itemWindow.activate();
            this._itemWindow.select(0);
        }

        itemWindowRect() {
            const wx = 0;
            const wy = this.mainAreaTop();
            const ww = Graphics.boxWidth / 2;
            const wh = this.mainAreaHeight();
            return new Rectangle(wx, wy, ww, wh);
        }

        /** -------------------------------------------------------------
         * Right Side: Hot-bar Preview Window
         * ---------------------------------------------------------- */
        createHotbarWindow() {
            const rect = this.hotbarWindowRect();
            this._hotbarWindow = new Window_HotbarPreview(rect);
            
            this._hotbarWindow.setHandler("ok", this.onHotbarSlotOk.bind(this));
            this._hotbarWindow.setHandler("cancel", this.onHotbarCancel.bind(this));
            
            this.addWindow(this._hotbarWindow);
            this._hotbarWindow.refresh();
        }

        hotbarWindowRect() {
            const ww = Graphics.boxWidth / 2;
            const wh = this.mainAreaHeight();
            const wx = Graphics.boxWidth - ww;
            const wy = this.mainAreaTop();
            return new Rectangle(wx, wy, ww, wh);
        }

        createHelpWindow() {
            const rect = this.helpWindowRect();
            this._helpWindow = new Window_Help(rect);
            this.addWindow(this._helpWindow);
            this.updateHelpText("left");
        }

        helpWindowRect() {
            const ww = Graphics.boxWidth;
            const wh = this.calcWindowHeight(1, true);
            const wx = 0;
            const wy = Graphics.boxHeight - wh;
            return new Rectangle(wx, wy, ww, wh);
        }

        updateHelpText(side) {
            if (side === "left") {
                this._helpWindow.setText("Left Side: Click an item to assign or clear it. Press [Right Arrow] to navigate right.");
            } else if (side === "right") {
                this._helpWindow.setText("Right Side: Click a slot to EQUIP active item. Press [ESC/Cancel] to CLEAR a slot.");
            }
        }

        /** -------------------------------------------------------------
         * Center: Action Picker & Assignment Prompt Window
         * ---------------------------------------------------------- */
        createSlotInputWindow() {
            this._inputWindow = new Window_SlotNumberInput(this.slotInputRect());
            this._inputWindow.setHandler("actionAdd", this.onActionAdd.bind(this));
            this._inputWindow.setHandler("actionClear", this.onActionClear.bind(this));
            this._inputWindow.setHandler("ok", this.onSlotConfirmOk.bind(this));
            this._inputWindow.setHandler("cancel", this.onSlotConfirmCancel.bind(this));
            this._inputWindow.hide();
            this._inputWindow.deactivate();
            this.addWindow(this._inputWindow);
        }

        /** -------------------------------------------------------------
         * Left Side Interaction Logic
         * ---------------------------------------------------------- */
        onItemOk() {
            const item = this._itemWindow.item();
            if (!item) {
                this._itemWindow.activate();
                return;
            }
            const descriptor = this.makeDescriptor(item);
            this._inputWindow.setDescriptor(descriptor);
            
            this._inputWindow.show();
            this._inputWindow.activate();
            this._inputWindow.select(0); 
        }

        onActionAdd() {
            this._inputWindow.changeMode("assign");
        }

        onActionClear() {
            const descriptor = this._inputWindow.descriptor();
            let clearedCount = 0;
            for (let i = 0; i < 10; i++) {
                const hotbarItem = Hotbar.getSlotItem(i);
                if (hotbarItem && hotbarItem.type === descriptor.type && hotbarItem.id === descriptor.id) {
                    Hotbar.removeItemFromHotbar(i);
                    clearedCount++;
                }
            }
            if (clearedCount > 0) {
                SoundManager.playCancel();
            } else {
                SoundManager.playBuzzer();
            }
            this.refreshAllDisplayPanels();
            this._inputWindow.hide();
            this._inputWindow.deactivate();
            this._itemWindow.activate();
        }

        onSlotConfirmOk() {
            const slotIndex = this._inputWindow.targetSlot();
            const descriptor = this._inputWindow.descriptor();
            
            for (let i = 0; i < 10; i++) {
                const hotbarItem = Hotbar.getSlotItem(i);
                if (hotbarItem && hotbarItem.type === descriptor.type && hotbarItem.id === descriptor.id) {
                    Hotbar.removeItemFromHotbar(i);
                }
            }

            Hotbar.addItemToHotbar(descriptor, slotIndex);
            
            if (Hotbar.getActiveSlotIndex() === slotIndex) {
                Hotbar.setActiveItem(descriptor);
            }
            
            this.refreshAllDisplayPanels();
            
            this._inputWindow.hide();
            this._inputWindow.deactivate();
            this._itemWindow.activate();
        }

        onSlotConfirmCancel() {
            if (this._inputWindow.currentMode() === "assign") {
                this._inputWindow.changeMode("chooseAction");
            } else {
                this._inputWindow.hide();
                this._inputWindow.deactivate();
                this._itemWindow.activate();
            }
        }

        /** -------------------------------------------------------------
         * Right Side Interaction Logic
         * ---------------------------------------------------------- */
        onHotbarSlotOk() {
            const index = this._hotbarWindow.index();
            if (index >= 0) {
                const hotbarItem = Hotbar.getSlotItem(index);
                if (hotbarItem) {
                    Hotbar.setActiveSlotIndex(index);
                    SoundManager.playEquip();
                } else {
                    SoundManager.playBuzzer();
                }
            }
            this.refreshAllDisplayPanels();
            this._hotbarWindow.activate();
        }

        onHotbarCancel() {
            const index = this._hotbarWindow.index();
            if (index >= 0 && Hotbar.getSlotItem(index)) {
                Hotbar.removeItemFromHotbar(index);
                SoundManager.playCancel();
                this.refreshAllDisplayPanels();
                this._hotbarWindow.activate();
            } else {
                this._hotbarWindow.deselect();
                this._hotbarWindow.deactivate();
                this._itemWindow.activate();
                this.updateHelpText("left");
            }
        }

        refreshAllDisplayPanels() {
            this._hotbarWindow.refresh();
            this._itemWindow.refresh(); 
        }

        update() {
            super.update();
            if (this._itemWindow.active && Input.isTriggered("right")) {
                this._itemWindow.deactivate();
                this._hotbarWindow.activate();
                this._hotbarWindow.select(0);
                this.updateHelpText("right");
            } else if (this._hotbarWindow.active && Input.isTriggered("left")) {
                this._hotbarWindow.deselect();
                this._hotbarWindow.deactivate();
                this._itemWindow.activate();
                this.updateHelpText("left");
            }
        }

        onSceneCancel() {
            this.popScene();
        }

        makeDescriptor(item) {
            if (DataManager.isItem(item)) return { type: "item", id: item.id };
            if (DataManager.isWeapon(item)) return { type: "weapon", id: item.id };
            if (DataManager.isArmor(item)) return { type: "armor", id: item.id };
            if (DataManager.isSkill(item)) return { type: "skill", id: item.id };
            return { type: "item", id: item.id };
        }

        slotInputRect() {
            const w = 360; 
            const h = this.calcWindowHeight(5, true);
            const x = (Graphics.boxWidth - w) / 2;
            const y = (Graphics.boxHeight - h) / 2;
            return new Rectangle(x, y, w, h);
        }
    }

    // -------------------------------------------------------------------------
    // Window_HotbarPreview
    // -------------------------------------------------------------------------
    class Window_HotbarPreview extends Window_Selectable {
        initialize(rect) {
            super.initialize(rect);
            this.refresh();
            this.deselect(); 
        }

        maxCols() { return 5; }
        maxItems() { return 10; }

        itemRect(index) {
            const rect = super.itemRect(index);
            rect.width = Math.max(rect.width - 8, 0);
            rect.height = Math.max(rect.height - 8, 0);
            return rect;
        }

        drawItem(index) {
            const hotbarItem = Hotbar.getSlotItem(index); 
            const rect = this.itemRect(index);
            this.drawBackgroundRect(rect, index);
            
            if (index === Hotbar.getActiveSlotIndex()) {
                this.contents.fillRect(rect.x, rect.y, rect.width, rect.height, "rgba(0, 255, 255, 0.25)");
            }

            if (hotbarItem) {
                const item = Hotbar.getDBItem(hotbarItem);
                if (item) {
                    const params = PluginManager.parameters("oTV_HotbarPlugin_MZ");
                    const textOnly = (params.textOnlyHotbar === "true");

                    if (!textOnly && item.iconIndex) {
                        const icon = item.iconIndex;
                        const pw = ImageManager.iconWidth;  
                        const ph = ImageManager.iconHeight; 
                        const cx = rect.x + (rect.width - pw) / 2;
                        const cy = rect.y + (rect.height - ph) / 2;
                        this.drawIcon(icon, cx, cy);
                    } else {
                        const name = item.name || "???";
                        this.drawText(name, rect.x, rect.y, rect.width, "center");
                    }
                }
            } else {
                this.changePaintOpacity(false);
                this.drawText("- empty -", rect.x, rect.y, rect.width, "center");
                this.changePaintOpacity(true);
            }
            
            this.contents.fontSize = 12;
            this.changeTextColor(ColorManager.systemColor());
            const displayLabel = index === 9 ? "0" : String(index + 1);
            this.drawText(displayLabel, rect.x + 2, rect.y + rect.height - 16, rect.width - 4, "right");
            this.resetFontSettings();
        }

        drawBackgroundRect(rect, index) {
            const bgColor = ColorManager.windowColor; 
            this.contents.fillRect(rect.x, rect.y, rect.width, rect.height, bgColor);
        }

        refresh() {
            this.createContents();
            this.drawAllItems();
        }
    }

    // -------------------------------------------------------------------------
    // Window_SlotNumberInput (CRITICAL FIX: Precise Variable Mouse Hitboxes)
    // -------------------------------------------------------------------------
	class Window_SlotNumberInput extends Window_Command {
		initialize(rect) {
			this._targetSlot = 0;
			this._descriptor = null;
			this._mode = "chooseAction";
			super.initialize(rect);

			this.createArrowButtons();
			this.updateButtonVisibility();
		}

		setDescriptor(descriptor) {
			this._descriptor = descriptor;
			this._targetSlot = 0;
			this._mode = "chooseAction";

			this.refresh();
			this.updateButtonVisibility();
			this.select(0);
		}

		descriptor() {
			return this._descriptor;
		}

		targetSlot() {
			return this._targetSlot;
		}

		currentMode() {
			return this._mode;
		}

		changeMode(mode) {
			this._mode = mode;

			this.refresh();
			this.updateButtonVisibility();

			this.select(0);
			this.activate();
		}

		makeCommandList() {
			if (this._mode === "chooseAction") {
				this.addCommand("➕ Add item to a slot", "actionAdd");
				this.addCommand("❌ Remove item from bar", "actionClear");
			} else {
				this.addCommand("✔ Confirm Assignment", "ok");
				this.addCommand("✖ Cancel Assignment", "cancel");
			}
		}

		refresh() {
			this.clearCommandList();
			this.makeCommandList();
			super.refresh();
		}

		createArrowButtons() {
			this._leftButton = new Sprite_Button("pageup");
			this._leftButton.x = 12;
			this._leftButton.y = this.lineHeight() * 2 + 8;
			this._leftButton.setClickHandler(this.onLeftArrowClick.bind(this));
			this.addInnerChild(this._leftButton);

			this._rightButton = new Sprite_Button("pagedown");
			this._rightButton.x = this.width - 60;
			this._rightButton.y = this.lineHeight() * 2 + 8;
			this._rightButton.setClickHandler(this.onRightArrowClick.bind(this));
			this.addInnerChild(this._rightButton);
		}

		updateButtonVisibility() {
			const visible = this._mode === "assign";

			if (this._leftButton) {
				visible ? this._leftButton.show() : this._leftButton.hide();
			}

			if (this._rightButton) {
				visible ? this._rightButton.show() : this._rightButton.hide();
			}
		}

		onLeftArrowClick() {
			if (!this.isOpenAndActive()) return;
			if (this._mode !== "assign") return;

			this._targetSlot = (this._targetSlot + 9) % 10;
			SoundManager.playCursor();
			this.refresh();
		}

		onRightArrowClick() {
			if (!this.isOpenAndActive()) return;
			if (this._mode !== "assign") return;

			this._targetSlot = (this._targetSlot + 1) % 10;
			SoundManager.playCursor();
			this.refresh();
		}

		processHandling() {
			if (this.isOpenAndActive()) {
				if (this._mode === "assign") {
					for (let i = 0; i <= 9; i++) {
						if (Input.isTriggered(String(i))) {
							this._targetSlot = keyToSlot(i);
							SoundManager.playOk();
							this.callHandler("ok");
							return;
						}
					}

					if (Input.isTriggered("cancel")) {
						this.callHandler("cancel");
						return;
					}

					if (Input.isRepeated("right") || Input.isRepeated("up")) {
						this.onRightArrowClick();
						return;
					}

					if (Input.isRepeated("left") || Input.isRepeated("down")) {
						this.onLeftArrowClick();
						return;
					}
				}
			}

			super.processHandling();
		}

		show() {
			super.show();
			this.updateButtonVisibility();
		}

		hide() {
			super.hide();

			if (this._leftButton) {
				this._leftButton.hide();
			}

			if (this._rightButton) {
				this._rightButton.hide();
			}
		}

		headerHeight() {
			return this._mode === "chooseAction"
				? this.lineHeight() * 2
				: this.lineHeight() * 3;
		}

		itemRect(index) {
			const rect = super.itemRect(index);
			rect.y += this.headerHeight();
			return rect;
		}

		drawAllItems() {
			if (!this._descriptor) {
				super.drawAllItems();
				return;
			}

			const item = Hotbar.getDBItem(this._descriptor);
			const name = item ? item.name : "???";

			let matchingSlotIndex = -1;

			for (let i = 0; i < 10; i++) {
				const hotbarItem = Hotbar.getSlotItem(i);

				if (
					hotbarItem &&
					hotbarItem.type === this._descriptor.type &&
					hotbarItem.id === this._descriptor.id
				) {
					matchingSlotIndex = i;
					break;
				}
			}

			this.changeTextColor(ColorManager.normalColor());
			this.drawText(
				`Managing: ${name}`,
				0,
				0,
				this.contentsWidth(),
				"center"
			);

			if (this._mode === "chooseAction") {
				if (matchingSlotIndex >= 0) {
					this.changeTextColor(ColorManager.powerUpColor());

					const slotDisplay =
						matchingSlotIndex === 9
							? "10"
							: String(matchingSlotIndex + 1);

					this.drawText(
						`Currently on Slot ${slotDisplay}`,
						0,
						this.lineHeight(),
						this.contentsWidth(),
						"center"
					);
				} else {
					this.changeTextColor(ColorManager.systemColor());

					this.drawText(
						"Not currently assigned.",
						0,
						this.lineHeight(),
						this.contentsWidth(),
						"center"
					);
				}
			} else {
				const slotDisplay =
					this._targetSlot === 9
						? "10 (Key 0)"
						: String(this._targetSlot + 1);

				this.changeTextColor(ColorManager.normalColor());

				this.drawText(
					"Choose Destination Slot",
					0,
					this.lineHeight(),
					this.contentsWidth(),
					"center"
				);

				this.changeTextColor(ColorManager.systemColor());

				this.drawText(
					`Slot [ ${slotDisplay} ]`,
					0,
					this.lineHeight() * 2,
					this.contentsWidth(),
					"center"
				);
			}

			super.drawAllItems();
		}
	}

    window.CGMZ_Scene_HotbarManager = Scene_CGMZ_Scene_HotbarManager;
})();