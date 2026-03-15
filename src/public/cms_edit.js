import { dateRangeToString, stringToDateRange, toUTC, toLocal } from 'public/cms.js';

export const FieldType = Object.freeze({
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    ADDRESS: 'address',
    DATE: 'date',
    HOURS_OF_DATE: 'hoursOfDate',
    MULTI_SELECT: 'multiSelect',
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
            case FieldType.MULTI_SELECT:
                val = Array.isArray(el.value) ? el.value : el.value ? [el.value] : [];
                break;
            default: val = el.value; // STRING
        }
        if (cfg.onParseUserInput) val = cfg.onParseUserInput(val);

        const curVal = await this.formatValue(item, cfg);
        if (JSON.stringify(curVal) == JSON.stringify(val)) {
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

    async updateUiFromData() {
        const item = this.ds.getCurrentItem();
        for (const [id, cfg] of Object.entries(this.cmsSchema)) {
            const el = $w(id);
            if (!el) return;
            let val = await this.formatValue(item, cfg);
            let done = false;
            switch (cfg.type) {
                case FieldType.BOOLEAN:
                    if ("checked" in el) {
                        el.checked = !!val;
                        done = true;
                    }
                    break;
                case FieldType.ADDRESS:
                    val = val && typeof val === 'object' ? val : {};
                    break;
                case FieldType.HOURS_OF_DATE:
                    if (!val && "selectedIndex" in el) {
                        el.selectedIndex = 0;
                        done = true;
                    }
                    break;
                case FieldType.DATE:
                    if (item && Array.isArray(cfg.field) && cfg.field.length == 2)
                        val = await this.displayValue(item, cfg);
                    break;
            }
            console.log("Updating user input", id, "from", cfg.field, "with value:", val);
            if (!done) {
                // if no special set function has been used, try to use the default 
                if ("value" in el)
                    el.value = val;
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
        }
    }

    asString(cfg, v) {
        const formatters = {
            [FieldType.BOOLEAN]: () => v ? (cfg.boolTrue ?? BOOL_TRUE) : (cfg.boolFalse ?? BOOL_FALSE),
            [FieldType.NUMBER]: () => Number(v).toLocaleString('de-DE', { minimumFractionDigits: cfg.fractionDigits ?? 0 }),
            [FieldType.ADDRESS]: () => v.formatted || String(v),
            [FieldType.DATE]: () => {
                const [s, e] = Array.isArray(v) ? v : [v, null];
                return dateRangeToString(s, e, cfg.format ?? { hour: null, minute: null });
            },
            [FieldType.HOURS_OF_DATE]: () => v ? `${toLocal(new Date(v)).getHours()}:00` : "",
            [FieldType.MULTI_SELECT]: () => Array.isArray(v) ? v.join(", ") : String(v)
        };
        const res = v == null || v == "" ? null : (formatters[cfg.type] || (() => String(v)))();
        return res ? `${cfg.prefix ?? ""}${res}${cfg.suffix ?? ""}` : "";
    }

    async formatValue(item, cfg) {
        if (!cfg) return null;
        if (cfg.onFormatValue) return await cfg.onFormatValue(item);
        if (!item) return null;
        const val = Array.isArray(cfg.field) ? cfg.field.map(f => item[f]) : item[cfg.field];
        if (cfg.type === FieldType.HOURS_OF_DATE && val)
            return toLocal(new Date(val)).getHours().toString();
        if (cfg.type === FieldType.NUMBER)
            return val || 0;
        return val;
    }

    async displayValue(item, cfg) {
        if (!cfg) return "";
        if (cfg.onDisplayValue) return await cfg.onDisplayValue(item);
        if (!item) return "";
        const val = this.formatValue(item, cfg);
        return Array.isArray(val) && cfg.type != FieldType.DATE // DATE type will be combined in one dateRangeToString() call
            ? val.map(v => this.asString(cfg, v)).join(", ")
            : this.asString(cfg, val);
    }

    async getDiff(originalItem) {
        const currentItem = this.ds.getCurrentItem();
        let diffIntern = [];
        let diffUser = [];

        await Promise.all(Object.values(this.cmsSchema).map(async (cfg) => {
            if (!cfg.label) return;
            const [vOrg, vCur] = await Promise.all([this.formatValue(originalItem, cfg), this.formatValue(currentItem, cfg)]);
            if (JSON.stringify(vOrg) != JSON.stringify(vCur)) {
                const [dOrg, dCur] = await Promise.all([this.displayValue(originalItem, cfg), this.displayValue(currentItem, cfg)]);
                diffIntern.push([cfg.label, dOrg, dCur]);
                if (cfg.showToUser) diffUser.push([cfg.label, dOrg, dCur]);
            }
        }));
        return { diffIntern, diffUser };
    }

    async listAllValues() {
        const item = this.ds.getCurrentItem();
        return await Promise.all(Object.values(this.cmsSchema).filter(cfg => cfg.label).map(async (cfg) =>
            [cfg.label, await this.displayValue(item, cfg)]));
    }

    flushDebounce(update = true) {
        Object.keys(this.debounceTimers).forEach(id => {
            if (this.debounceTimers[id]) {
                clearTimeout(this.debounceTimers[id]);
                this.debounceTimers[id] = null;
                if (update) this.updateDataFromUi(id);
            }
        });
    }

    async saveItem() {
        this.flushDebounce();
        console.log("saveItem", await this.listAllValues());
        this.collapseResponse();
        const beforeSafeResult = await this.onBeforeSave();
        if (beforeSafeResult == null) return;
        await this.ds.save();
        console.log("item saved");
        this.updateSelectorList();
        this.onAfterSave(beforeSafeResult);
        this.showMessage("Erfolgreich gespeichert.");
    }

    async revertItem() {
        this.flushDebounce(false);
        console.log("revertItem");
        this.collapseResponse();
        await this.ds.revert();
        console.log("item reverted");
        this.refreshUI();
        this.onAfterReverted();
        this.showMessage("Änderungen verworfen.");
    }

    async newItem() {
        this.flushDebounce();
        console.log("newItem");
        this.collapseResponse();
        await this.ds.save();
        console.log("item saved before creating new item");
        await this.ds.new();
        console.log("item created");
        this.refreshUI();
        this.showMessage("Erfolgreich erstellt.");
    }

    async removeItem() {
        this.flushDebounce();
        console.log("removeItem");
        this.collapseResponse();
        const itemToDelete = this.ds.getCurrentItem();

        const options = $w("#itemSelector").options;
        const idx = options.findIndex(opt => opt.value === itemToDelete._id);
        const nextId = idx != -1 && idx < options.length - 1 ? options[idx + 1].value : idx > 0 ? options[idx - 1].value : null;

        await this.ds.remove();
        console.log("item removed");
        this.onAfterDelete(itemToDelete);
        this.showMessage("Erfolgreich gelöscht.");
        if (nextId == "--new--") this.newItem(); else this.navigateTo(nextId);
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
        if (id && id != "--new--") {
            const result = await this.ds.getItems(0, this.ds.getTotalCount());
            const index = result.items.findIndex(item => item._id == id);
            if (index != -1) {
                console.log("navigateTo current item index", index);
                await this.ds.setCurrentItemIndex(index);
                this.refreshUI();
            } else {
                console.warn("navigateTo cannot find among", result.items.length, "items");
            }
        }
    }

    async updateSelectorList() {
        const searchText = $w("#filterSearch").id ? $w("#filterSearch").value.trim() : "";
        console.log("Updating itemSelector based on search text:", searchText);

        const items = await this.onQueryUpdate(searchText);
        const currentItem = this.ds.getCurrentItem();
        console.log("current item:", currentItem?._id, "query results:\n", items.map(i => `${i._id}: ${this.generateTitle(i)}`).join("\n"));
        $w("#itemSelector").options = [
            { label: "➕ Neuer Eintrag", value: "--new--" },
            ...items.map(item => ({ label: this.generateTitle(item), value: item._id }))
        ];
        $w("#itemSelector").value = currentItem?._id ?? undefined;
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
