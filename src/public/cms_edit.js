export class CmsEditor {
    constructor(config) {
        this.cmsName = config.cmsName;
        this.dataSetName = config.dataSetName || `${config.cmsName}Dataset`;
        this.cmsSchema = config.cmsSchema || {};
        this.linkField = config.linkField;
        this.onRefreshUI = config.onRefreshUI || (() => { });
        this.onBeforeSave = config.onBeforeSave || (async () => true);
        this.onAfterSave = config.onAfterSave || (() => { });
        this.onAfterReverted = config.onAfterReverted || (() => { });
        this.onAfterDelete = config.onAfterDelete || (() => { });
        this.onQueryUpdate = config.onQueryUpdate || ((searchText) => { });
        this.generateTitle = config.generateTitle || ((item) => item?.title || "(Unbenannt)");

        this.messageTimer = null;
        this.ds = $w(`#${this.dataSetName}`);
    }

    init() {
        console.log("Initializing CMS Editor for", this.cmsName, "with dataset", this.dataSetName);

        this.ds.onReady(() => {
            this.refreshUI();
            this._setupTwoWayBinding();
        });
        this.ds.onError((error) => { this.showError(error); });

        if ($w("#filterSearch").id) {
            $w("#filterSearch").onKeyPress((event) => { if (event.key == "Enter") this.updateSelectorList(); });
            $w("#filterSearch").onBlur(() => { this.updateSelectorList() });
        }

        if ($w("#itemSelector").id) $w("#itemSelector").onChange(() => {
            const val = $w("#itemSelector").value;
            console.log("selected value:", val);
            if (val === "--new--") this.ds.new().then(() => {
                console.log("item created");
                this.refreshUI();
            });
            else if (val) this.navigateTo(val);
        }); else console.warn("itemSelector not found in DOM");

        if ($w("#buttonSave").id) $w("#buttonSave").onClick(async () => this.saveItem());
        else console.warn("buttonSave not found in DOM");

        if ($w("#buttonRevert").id) $w("#buttonRevert").onClick(() => this.revertItem());
        else console.warn("buttonRevert not found in DOM");

        if ($w("#buttonNew").id) $w("#buttonNew").onClick(() => this.newItem());
        else console.warn("buttonNew not found in DOM");

        if ($w("#buttonRemove").id) $w("#buttonRemove").onClick(() => this.removeItem());
        else console.warn("buttonRemove not found in DOM");

        if ($w("#buttonPrev").id) $w("#buttonPrev").onClick(() => this.navigateRelative(-1));
        else console.warn("buttonPrev not found in DOM");

        if ($w("#buttonNext").id) $w("#buttonNext").onClick(() => this.navigateRelative(1));
        else console.warn("buttonNext not found in DOM");
    }

    refreshUI() {
        this.updateUiFromData();
        this.updateSelectorList();
        this.onRefreshUI();
    }

    _setupTwoWayBinding() {
        Object.keys(this.cmsSchema).forEach(id => {
            const cfg = this.cmsSchema[id];
            const el = $w(id);
            if (!el || !el.id) return;

            // Automatische Wahl des Events
            const event = (cfg.type === 'boolean' || cfg.type === 'address' || id.includes('State')) ? 'onChange' : 'onInput';

            el[event]((e) => {
                let val;
                if (cfg.type === 'boolean') val = el.checked;
                else if (cfg.type === 'address') val = el.value;
                else if (cfg.type === 'number') val = Number(el.value || 0);
                else val = el.value;

                this.ds.setFieldValue(cfg.field, val);

                // Falls im Schema eine zusätzliche Aktion definiert wurde (z.B. updateCostsTable)
                if (cfg.onChange) cfg.onChange(val);
            });
        });
    }

    updateUiFromData() {
        const item = this.ds.getCurrentItem();
        Object.keys(this.cmsSchema).forEach(id => {
            const cfg = this.cmsSchema[id];
            const el = $w(id);
            const val = item ? item[cfg.field] : null;

            if (cfg.type === 'boolean') el.checked = !!val;
            else if (cfg.type === 'address') el.value = val || {};
            else if (cfg.type === 'number') el.value = (val ?? 0).toString();
            else el.value = val || "";

            if (el.resetValidityIndication) el.resetValidityIndication();
        });
    }

    getDiff(originalItem) {
        const current = this.ds.getCurrentItem();
        let diff = [];

        Object.keys(this.cmsSchema).forEach(id => {
            const cfg = this.cmsSchema[id];
            if (!cfg.label) return; // Nur Felder mit Label kommen in den Diff

            let v1 = originalItem ? originalItem[cfg.field] : null;
            let v2 = current ? current[cfg.field] : null;

            // Formatierung für die Anzeige im Diff
            if (cfg.type === 'number') {
                v1 = Number(v1 || 0).toFixed(2);
                v2 = Number(v2 || 0).toFixed(2);
            }

            if (v1 != v2) {
                diff.push([cfg.label, v1, v2]);
            }
        });
        return diff;
    }

    navigateRelative(offset) {
        const currentItem = this.ds.getCurrentItem();
        if (!currentItem) return;
        const currentId = this.ds.getCurrentItem()?._id;

        const options = $w("#itemSelector").options;
        const idx = options.findIndex(opt => opt.value == currentId);
        const nextIdx = idx == -1 ? -1 : idx + offset;
        const nextId = nextIdx < 0 || nextIdx >= options.length ? null : options[nextIdx].value;
        if (nextId && nextId != "--new--")
            this.navigateTo(nextId);
        else
            console.log("Navigation reached 'New Entry' placeholder.");
    }

    async saveItem() {
        this.collapseResponse();
        this.beforeSafeResult = await this.onBeforeSave();
        this.ds.save().then(() => {
            console.log("item saved");
            this.onAfterSave(this.beforeSafeResult);
            this.showMessage("Erfolgreich gespeichert.");
        });
    }

    revertItem() {
        this.collapseResponse();
        this.ds.revert().then(() => {
            console.log("item reverted");
            this.refreshUI();
            this.onAfterReverted();
            this.showMessage("Änderungen verworfen.");
        });
    }

    newItem() {
        this.collapseResponse();
        this.ds.save().then(() => {
            console.log("item saved before creating new item");
            this.ds.new().then(() => {
                console.log("item created");
                this.refreshUI();
                this.showMessage("Erfolgreich erstellt.");
            });
        });
    }

    removeItem() {
        this.collapseResponse();
        const itemToDelete = this.ds.getCurrentItem();

        const options = $w("#itemSelector").options;
        const idx = options.findIndex(opt => opt.value === itemToDelete._id);
        const nextId = idx != -1 && idx < options.length - 1 ? options[idx + 1].value : idx > 0 ? options[idx - 1].value : null;

        this.ds.remove().then(() => {
            console.log("item removed"); // Filtern (Name, Unterkunft, Datum, ...)
            this.onAfterDelete(itemToDelete);
            this.showMessage("Erfolgreich gelöscht.");

            if (nextId && nextId != "--new--") {
                this.navigateTo(nextId);
            } else {
                console.log("No items left to navigate to, creating new.");
                this.ds.new().then(() => { this.refreshUI(); });
            }
        });
    }

    async navigateTo(id) {
        this.ds.getItems(0, this.ds.getTotalCount()).then((result) => {
            const index = result.items.findIndex(item => item._id == id);
            if (index != -1) {
                console.log("navigateTo:", id, "index:", index);
                this.ds.setCurrentItemIndex(index).then(() => { this.refreshUI(); });
            } else {
                console.warn("navigateTo cannot find item with ID", id, "among", result.items.length, "items");
            }
        });
    }

    updateSelectorList() {
        const searchText = $w("#filterSearch").id ? $w("#filterSearch").value.trim() : "";
        console.log("Updating itemSelector based on search text:", searchText);

        this.onQueryUpdate(searchText).then((items) => {
            const currentItem = this.ds.getCurrentItem();
            console.log("current item:", currentItem?._id, "query results:\n", items.map(i => `${i._id}: ${this.generateTitle(i)}`).join("\n"));
            $w("#itemSelector").options = [
                { label: "➕ Neuer Eintrag", value: "--new--" },
                ...items.map(item => ({ label: this.generateTitle(item), value: item._id }))
            ];
            $w("#itemSelector").value = currentItem?._id ?? undefined;
        });

        //wixData.query(this.cmsName).ascending("title").limit(1000).find().then((result) => {
    }

    showError(error) {
        const errStr = (JSON.stringify(error) + String(error.stack) + String(error.message)).toLowerCase();
        console.error("Error saving item:", errStr);

        let msg = "Fehler beim Speichern.";
        if (errStr.includes("validation")) msg = "Bitte fülle alle Pflichtfelder korrekt aus.";
        else if (errStr.includes("email")) msg = "Die E-Mail-Adresse ist ungültig.";
        else if (errStr.includes("not allowed during save")) msg = "Speichervorgang noch nicht abgeschlossen.";

        this.showMessage(msg, true);
    }

    showMessage(message, isError = false) {
        if (!$w("#textResponse").id) return;
        if (this.messageTimer) clearTimeout(this.messageTimer);
        const color = isError ? "#E74C3C" : "#2ECC71";
        $w("#textResponse").html = `<p style="color: ${color}; font-size: 16px; text-align: center;">${isError ? "✖ " : "✔ "}${message}</p>`;
        $w("#textResponse").expand();
        this.messageTimer = setTimeout(() => { this.collapseResponse(); }, 20000);
    }

    collapseResponse() {
        if (!$w("#textResponse").id) return;
        $w("#textResponse").collapse();
        if (this.messageTimer) {
            clearTimeout(this.messageTimer);
            this.messageTimer = null;
        }
    }

}
