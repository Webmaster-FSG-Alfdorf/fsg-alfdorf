import { dateRangeToString, stringToDateRange, toUTC, toLocal } from 'public/cms.js';

export const FieldType = Object.freeze({
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    ADDRESS: 'address',
    DATE: 'date',
    HOURS_OF_DATE: 'hoursOfDate',
});

const BOOL_TRUE = "Ja";
const BOOL_FALSE = "Nein";

export class CmsEditor {
    constructor(config) {
        this.cmsName = config.cmsName;
        this.dataSetName = config.dataSetName || `${config.cmsName}Dataset`;
        this.cmsSchema = config.cmsSchema || {};
        this.onRefreshUI = config.onRefreshUI || (() => { });
        this.onBeforeSave = config.onBeforeSave || (async () => true);
        this.onAfterSave = config.onAfterSave || (() => { });
        this.onAfterReverted = config.onAfterReverted || (() => { });
        this.onAfterDelete = config.onAfterDelete || (() => { });
        this.onQueryUpdate = config.onQueryUpdate || ((searchText) => { });
        this.generateTitle = config.generateTitle || ((item) => item?.title || "(Unbenannt)");

        this.ds = $w(`#${this.dataSetName}`);
        this.messageTimer = null;
        this.debounceTimers = {};
    }

    init() {
        console.log("Initializing CMS Editor for", this.cmsName, "with dataset", this.dataSetName);

        this.ds.onReady(() => {
            this.refreshUI();

            Object.keys(this.cmsSchema).forEach(id => {
                const el = $w(id);
                const bind = (events, delay = 0) => {
                    events.forEach(s => {
                        if (typeof el[s] == 'function') {
                            //console.log("Binding", s, "to", id);
                            el[s]((event) => {
                                if (s != "onKeyPress" || event.key == "Enter") {
                                    if (this.debounceTimers[id]) clearTimeout(this.debounceTimers[id]);
                                    if (delay > 0) this.debounceTimers[id] = setTimeout(() => this.updateDataFromUi(id), delay);
                                    else this.updateDataFromUi(id);
                                }
                            });
                        } else {
                            console.warn("Cannot bind", s, "to", id, ":", typeof el[s]);
                        }
                    });
                };
                if (el) {
                    bind(['onBlur', 'onKeyPress']);
                    bind(['onInput', 'onChange'], 2000);
                } else console.warn("No such input element:", id);
            });
        });

        this.ds.onError((error) => { this.showError(error); });

        if ($w("#filterSearch").id) {
            $w("#filterSearch").onKeyPress((event) => { if (event.key == "Enter") this.updateSelectorList(); });
            $w("#filterSearch").onBlur(() => { this.updateSelectorList() });
        }

        if ($w("#itemSelector").id) $w("#itemSelector").onChange(() => {
            const val = $w("#itemSelector").value;
            if (val == "--new--") this.newItem(); else this.navigateTo(val);
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
        console.log("refreshUI");
        this.updateUiFromData();
        this.updateSelectorList();
        this.onRefreshUI();
    }

    async updateDataFromUi(id) {
        this.debounceTimers[id] = null;

        const el = $w(id);
        if (!el || !el.id) {
            console.error("Cannot assign from input", id, ": Input element not found")
            return;
        }
        const cfg = this.cmsSchema[id];
        if (!cfg) {
            console.error("Cannot assign from input", id, ": CMS schema not found in configuration")
            return;
        }
        let val;
        switch (cfg.type) {
            case FieldType.BOOLEAN: val = el.checked; break;
            case FieldType.NUMBER: val = Number(el.value || 0); break;
            case FieldType.ADDRESS: val = el.value; break;
            case FieldType.HOURS_OF_DATE: {
                const utcDate = this.ds.getCurrentItem()[cfg.field];
                let dt = new Date(utcDate);
                dt.setUTCHours(0, 0, 0, 0);
                dt = toLocal(dt);
                dt.setHours(Number(el.value || 0), 0, 0, 0);
                val = toUTC(dt);
                break;
            }
            case FieldType.DATE: { // update date with new value but keep hours
                const range = stringToDateRange(el.value);
                val = range.map((date, i) => {
                    const dt = new Date(date);
                    const oldDate = this.ds.getCurrentItem()[cfg.field[i]];
                    dt.setUTCHours(oldDate ? new Date(oldDate).getUTCHours() : 0, 0, 0, 0);
                    return dt;
                });
                break;
            }
            default: val = el.value; // STRING
        }
        if (cfg.onParseUserInput) val = cfg.onParseUserInput(val);

        const item = this.ds.getCurrentItem();
        if ((Array.isArray(cfg.field) ? cfg.field : [cfg.field]).map(f => item[f]).join('|') == (Array.isArray(val) ? val : [val]).join('|')) {
            console.log("No change detected for", id);
            return;
        }

        console.log("Writing user input of", id, "to", cfg.field, "with value:", val);
        if (Array.isArray(cfg.field))
            this.ds.setFieldValues(Object.fromEntries(cfg.field.map((field, i) => [field, Array.isArray(val) ? val[i] : val])));
        else
            this.ds.setFieldValue(cfg.field, val);
        if (cfg.onChanged) cfg.onChanged(val);
    }

    updateUiFromData() {
        const item = this.ds.getCurrentItem();
        Object.entries(this.cmsSchema).forEach(([id, cfg]) => {
            const el = $w(id);
            if (!el) return;

            const val = !item ? null : Array.isArray(cfg.field) ? item[cfg.field[0]] : item[cfg.field];
            let formatted = this.formatValue(item, cfg);

            let done = false;
            switch (cfg.type) {
                case FieldType.BOOLEAN:
                    if ("checked" in el) {
                        el.checked = formatted == cfg.boolTrue ?? BOOL_TRUE;
                        done = true;
                    }
                    break;
                case FieldType.NUMBER:
                    formatted = Number(formatted || "0")
                    break;
                case FieldType.ADDRESS:
                    formatted = val && typeof val === 'object' ? val : {};
                    break;
                case FieldType.HOURS_OF_DATE:
                    if (val)
                        formatted = toLocal(new Date(val)).getHours().toString();
                    else if ("selectedIndex" in el) {
                        el.selectedIndex = 0;
                        done = true;
                    }
                    break;
                case FieldType.DATE:
                    if (item && Array.isArray(cfg.field) && cfg.field.length == 2)
                        formatted = dateRangeToString(item[cfg.field[0]], item[cfg.field[1]], { hour: null, minute: null });
                    break;
            }
            console.log("Updating user input", id, "from", cfg.field, "with value:", formatted);
            if (!done) {
                // if no special set function has been used, try to use the default 
                if ("value" in el)
                    el.value = formatted;
                else
                    console.error("Cannot assign to user input", id, "from field", cfg.field, ": No 'value' property")
            }

            const btn = cfg.linkButton ? $w(cfg.linkButton) : null;
            if (btn && btn.id) {
                if (val) btn.link = `${cfg.linkPrefix ?? ""}${val}`;
                if (val) btn.enable(); else btn.disable();
                btn.target = "_blank";
            }

            if (el.resetValidityIndication) el.resetValidityIndication();
        });
    }

    asString(cfg, v) {
        if (v == null || v == undefined) return "";
        switch (cfg.type) {
            case FieldType.BOOLEAN:
                return v ? (cfg.boolTrue ?? BOOL_TRUE) : (cfg.boolFalse ?? BOOL_FALSE);
            case FieldType.NUMBER:
                return Number(v).toFixed(cfg.fractionDigits ?? 0);
            case FieldType.ADDRESS:
                return v.formatted || String(v);
            case FieldType.DATE:
                return v instanceof Date ? v.toLocaleDateString('de-DE') : String(v);
            case FieldType.HOURS_OF_DATE:
                return v ? `${toLocal(new Date(v)).getHours()}:00` : "";
            default:
                return String(v);
        }
    }

    formatValue(item, cfg) {
        let val;
        if (!cfg)
            val = null;
        else if (cfg.onFormatValue)
            val = cfg.onFormatValue(item);
        else if (!item)
            val = null
        else if (Array.isArray(cfg.field))
            val = cfg.field.map(f => item[f]);
        else
            val = item[cfg.field];

        return Array.isArray(val) ?
            val.map(v => this.asString(cfg, v)).join(", ") :
            this.asString(cfg, val);
    }

    getDiff(originalItem) {
        const currentItem = this.ds.getCurrentItem();
        let diff = [];

        Object.values(this.cmsSchema).forEach(cfg => {
            if (!cfg.label) return;

            const v1 = this.formatValue(originalItem, cfg);
            const v2 = this.formatValue(currentItem, cfg);

            if (v1 != v2) {
                diff.push([cfg.label, v1, v2]);
            }
        });
        return diff;
    }

    listAllValues() {
        const item = this.ds.getCurrentItem();
        let res = [];
        Object.values(this.cmsSchema).forEach(cfg => {
            if (!cfg.label) return;
            res.push([cfg.label, this.formatValue(item, cfg)]);
        });
        return res;
    }

    async saveItem() {
        console.log("saveItem", this.listAllValues());
        this.collapseResponse();
        const beforeSafeResult = await this.onBeforeSave();
        this.ds.save().then(() => {
            console.log("item saved");
            this.updateSelectorList();
            this.onAfterSave(beforeSafeResult);
            this.showMessage("Erfolgreich gespeichert.");
        });
    }

    revertItem() {
        console.log("revertItem");
        this.collapseResponse();
        this.ds.revert().then(() => {
            console.log("item reverted");
            this.refreshUI();
            this.onAfterReverted();
            this.showMessage("Änderungen verworfen.");
        });
    }

    newItem() {
        console.log("newItem");
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
        console.log("removeItem");
        this.collapseResponse();
        const itemToDelete = this.ds.getCurrentItem();

        const options = $w("#itemSelector").options;
        const idx = options.findIndex(opt => opt.value === itemToDelete._id);
        const nextId = idx != -1 && idx < options.length - 1 ? options[idx + 1].value : idx > 0 ? options[idx - 1].value : null;

        this.ds.remove().then(() => {
            console.log("item removed");
            this.onAfterDelete(itemToDelete);
            this.showMessage("Erfolgreich gelöscht.");
            if (nextId == "--new--") this.newItem(); else this.navigateTo(nextId);
        });
    }

    navigateRelative(offset) {
        console.log("navigateRelative", offset);
        const currentId = this.ds.getCurrentItem()?._id;
        const options = $w("#itemSelector").options;
        const idx = options.findIndex(opt => opt.value == currentId);
        const nextIdx = idx == -1 ? -1 : idx + offset;
        this.navigateTo(nextIdx < 0 || nextIdx >= options.length ? null : options[nextIdx].value);
    }

    async navigateTo(id) {
        console.log("navigateTo", id);
        if (id && id != "--new--") this.ds.getItems(0, this.ds.getTotalCount()).then((result) => {
            const index = result.items.findIndex(item => item._id == id);
            if (index != -1) {
                console.log("navigateTo current item index", index);
                this.ds.setCurrentItemIndex(index).then(() => { this.refreshUI(); });
            } else {
                console.warn("navigateTo cannot find among", result.items.length, "items");
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
        $w("#textResponse").show();
        this.messageTimer = setTimeout(() => { this.collapseResponse(); }, 20000);
    }

    collapseResponse() {
        if (!$w("#textResponse").id) return;
        $w("#textResponse").hide();
        if (this.messageTimer) {
            clearTimeout(this.messageTimer);
            this.messageTimer = null;
        }
    }

}
