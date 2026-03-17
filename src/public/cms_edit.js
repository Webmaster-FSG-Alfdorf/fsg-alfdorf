import wixData from 'wix-data';

import { dateRangeToString, stringToDateRange, toUTC, toLocal } from 'public/cms.js';

/**
 * @typedef {Object} CmsFieldConfig
 * @property {string} field - The CMS field key.
 * @property {string[]} fieldsAdditonal - Additional CMS field keys for types that support multiple (like DATE_RANGE).
 * @property {string} type - FieldType constant (e.g., STRING, DATE, RICH_TEXT).
 * @property {Object} [el] - The Wix UI element $w (automatically assigned during init).
 * @property {string} [label] - Display label for logs and diffs (defaults to 'label' property of 'el'.
 * @property {boolean} [required] - Item can only be stored if data has been entered (default false).
 * @property {boolean} [readOnly] - Data cannot be edited by the user (default false).
 * @property {number} [delay] - Debounce delay in ms (default 1500ms, or 3000ms for RICH_TEXT).
 * @property {string} [prefix] - String prepended to the display value (default "").
 * @property {string} [suffix] - String appended to the display value (default "").
 * @property {boolean} [collectDiff] - Whether to include this field in change tracking (default true).
 * @property {boolean} [showToUser] - Whether to show changes in this field to the end user (default true).
 * @property {string} [linkButton] - ID of a button (e.g., "#btn") to link to the field's value.
 * @property {string} [linkPrefix] - Prefix for the URL in linkButton (e.g., "mailto:").
 * @property {Function} [onDisplayValue] - (item) => string: Custom logic to format the value for display/logs.
 * @property {Function} [onChanged] - (val) => void: Callback triggered after the field value has been updated.
 * @property {Function} [onFormatValue] - (item) => any: For FieldType.CUSTOM: Custom logic to extract data from the CMS item.
 * @property {Function} [onParseUserInput] - (val) => any: For FieldType.CUSTOM: Custom logic to clean/transform input before saving.
 * @property {number} [fractionDigits] - For FieldType.NUMBER: Number of decimals (default 0).
 * @property {string} [boolTrue] - For FieldType.BOOLEAN: Label for true (default "Ja").
 * @property {string} [boolFalse] - For FieldType.BOOLEAN: Label for false (default "Nein").
 * @property {Object} [format] - For FieldType.DATE: Options for dateRangeToString.
 * @property {boolean} [trim] - For FieldType.STRING: Whether to trim whitespace (default true).
 * @property {boolean} [dataSet] - For FieldType.REFERENCE and FieldType.MULTI_REFERENCE: Name of the dataset to which the references shall point.
 * @property {boolean} [onGenerateLabel] - (item) => string: For FieldType.REFERENCE and FieldType.MULTI_REFERENCE: Label for entries of the dataset.
 */

export const FieldType = Object.freeze({
    STRING: 'STRING',
    RICH_TEXT: 'RICH_TEXT',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
    ADDRESS: 'ADDRESS',
    DATE: 'DATE',
    DATE_RANGE: 'DATE_RANGE',
    HOURS_OF_DATE: 'HOURS_OF_DATE',
    IMAGE: 'IMAGE',
    IMAGES: 'IMAGES', //TODO
    SELECT: 'SELECT',
    MULTI_SELECT: 'MULTI_SELECT',
    REFERENCE: 'REFERENCE',
    MULTI_REFERENCE: 'MULTI_REFERENCE',
    CUSTOM: 'CUSTOM',
});

const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

let selIdx = -1; //TODO in class and based on ID, maybe part of cfg?

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

    /**
     * Initializes the editor, sets default schema values, and binds UI events.
     */
    init() {
        console.log("Initializing CMS Editor for", this.cmsName, "with dataset", this.dataSetName);

        for (const [id, cfg] of Object.entries(this.cmsSchema)) {
            cfg.el = $w(id);
            if (!cfg.label) cfg.label = cfg.el?.label || cfg.field;
            cfg.fieldsAdditonal ??= [];
            cfg.required ??= false; //TODO
            cfg.readOnly ??= false; //TODO
            cfg.delay ??= cfg.type == FieldType.RICH_TEXT ? 3000 : 1500;
            cfg.prefix ??= "";
            cfg.suffix ??= "";
            cfg.collectDiff ??= true;
            cfg.showToUser ??= true;
            switch (cfg.type) {
                case FieldType.BOOLEAN:
                    cfg.boolTrue ??= "Ja";
                    cfg.boolFalse ??= "Nein";
                    break;
                case FieldType.NUMBER:
                    cfg.fractionDigits ??= 0;
                    break;
                case FieldType.DATE:
                    cfg.format ??= { hour: null, minute: null };
                    break;
                case FieldType.STRING:
                    cfg.trim ??= true;
                    break;
                case FieldType.REFERENCE:
                case FieldType.MULTI_REFERENCE:
                    cfg.onGenerateLabel ??= (item) => item._id;
                    break;
            }
        }

        this.ds.onReady(async () => {
            this.refreshUI();

            for (const [id, cfg] of Object.entries(this.cmsSchema)) {
                const bind = (trg, events, delay = 0) => {
                    events.forEach(s => {
                        if (typeof trg[s] == 'function') {
                            //console.log("Binding", s, "to", id);
                            trg[s]((event) => {
                                if (s != "onKeyPress" || event.key == "Enter") {
                                    if (this.debounceTimers[id]) clearTimeout(this.debounceTimers[id]);
                                    if (delay > 0) this.debounceTimers[id] = setTimeout(() => this.updateDataFromUi(id), delay);
                                    else this.updateDataFromUi(id);
                                }
                            });
                        } else {
                            //console.warn("Cannot bind", s, "to", id, ":", typeof trg[s]);
                        }
                    });
                };
                if (cfg.el) {
                    bind(cfg.el, ['onBlur', 'onKeyPress']);
                    bind(cfg.el, ['onInput', 'onChange'], cfg.delay);

                    if (cfg.type == FieldType.IMAGES) {
                        const gallery = this.findRecursive(cfg.el, "$w.Gallery");
                        if (gallery) gallery.onItemClicked((event) => {
                            selIdx = event.itemIndex;
                            console.log("Selected media index on", id, ":", selIdx);
                            this.updateUiFromData(id, this.ds.getCurrentItem()); // just to update selection marker
                        });

                        const updateMedia = (action) => {
                            const val = this.ensureArray(this.ds.getCurrentItem()?.[cfg.field]);
                            console.log("Executing", action, "on", id, "with", val.length, "items for index", selIdx);
                            if (selIdx < 0 || selIdx >= val.length) return;
                            if (action == "moveleft" && selIdx > 0) {
                                [val[selIdx - 1], val[selIdx]] = [val[selIdx], val[selIdx - 1]];
                                selIdx--;
                            } else if (action == "moveright" && selIdx < val.length - 1) {
                                [val[selIdx + 1], val[selIdx]] = [val[selIdx], val[selIdx + 1]];
                                selIdx++;
                            } else if (action == "remove") {
                                val.splice(selIdx, 1);
                                selIdx = -1;
                            }
                            console.log("Selected media index on", id, ":", selIdx);
                            this.ds.setFieldValue(cfg.field, val);
                            this.updateUiFromData(id, null, val);
                        };
                        ['moveleft', 'moveright', 'remove'].forEach(namePart => {
                            const btn = this.findRecursive(cfg.el, "$w.Button", namePart);
                            if (btn) btn.onClick(() => updateMedia(namePart));
                        });
                    }

                    if (cfg.type == FieldType.IMAGE || cfg.type == FieldType.IMAGES) {
                        const btn = this.findRecursive(cfg.el, "$w.UploadButton");
                        if (btn) bind(btn, ['onChange']);
                    }

                    if (cfg.dataSet && (cfg.type == FieldType.REFERENCE || cfg.type == FieldType.MULTI_REFERENCE)) {
                        const data = await wixData.query(cfg.dataSet).find();
                        cfg.el.options = data.items.map(item => ({ label: cfg.onGenerateLabel(item), value: item._id }));
                    }

                } else console.warn("No such input element:", id);
            }
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

        const uiButtons = {
            "#buttonSave": () => this.saveItem(),
            "#buttonRevert": () => this.revertItem(),
            "#buttonNew": () => this.newItem(),
            "#buttonRemove": () => this.removeItem(),
            "#buttonPrev": () => this.navigateRelative(-1),
            "#buttonNext": () => this.navigateRelative(1)
        };

        Object.entries(uiButtons).forEach(([id, action]) => {
            const el = $w(id);
            if (el.id) el.onClick(async () => await action()); else console.warn(id, "not found in DOM");
        });
    }

    /**
     * Synchronizes the UI with the current dataset item.
     */
    refreshUI() {
        console.log("refreshUI");
        const item = this.ds.getCurrentItem();
        if (item) for (const id of Object.keys(this.cmsSchema))
            this.updateUiFromData(id, item);
        else console.log("No current item - skipping UI update");
        this.updateSelectorList();
        this.onRefreshUI();
    }

    /**
     * Reads values from the UI and updates the dataset fields.
     * @param {string} id - The ID of the element in cmsSchema.
     */
    async updateDataFromUi(id) {
        this.debounceTimers[id] = null;
        const cfg = this.cmsSchema[id];
        if (!cfg) {
            console.error("Cannot assign from input", id, ": CMS schema not found in configuration")
            return;
        }

        if (!cfg.el || !cfg.el.id) {
            console.error("Cannot assign from input", id, ": Input element not found")
            return;
        }

        let needRefresh = false;
        let val;
        switch (cfg.type) {
            case FieldType.BOOLEAN:
                val = cfg.el.checked;
                break;
            case FieldType.NUMBER:
                val = Number(cfg.el.value || 0);
                break;
            case FieldType.ADDRESS:
                val = cfg.el.value;
                break;
            case FieldType.HOURS_OF_DATE: {
                const utcDate = this.ds.getCurrentItem()[cfg.field];
                let dt = new Date(utcDate);
                if (isNaN(dt.getTime()))
                    val = null;
                else {
                    dt.setUTCHours(0, 0, 0, 0);
                    dt = toLocal(dt);
                    dt.setHours(Number(cfg.el.value || 0), 0, 0, 0);
                    val = toUTC(dt);
                }
                break;
            }
            case FieldType.DATE: { // update date with new value but keep hours
                const local = cfg.el.value;
                if (!local || isNaN(new Date(local).getTime())) {
                    val = null;
                } else {
                    val = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
                    const cur = this.ds.getCurrentItem();
                    const oldDate = cur ? cur[cfg.field] : null;
                    val.setUTCHours(oldDate ? new Date(oldDate).getUTCHours() : 0, 0, 0, 0);
                }
                break;
            }
            case FieldType.DATE_RANGE: { // update date with new value but keep hours
                const range = stringToDateRange(cfg.el.value) || [];
                val = new Date(range[0]);
                const oldDate0 = this.ds.getCurrentItem()[cfg.field];
                val.setUTCHours(oldDate0 ? new Date(oldDate0).getUTCHours() : 0, 0, 0, 0);
                const dt1 = new Date(range[1]);
                const oldDate1 = this.ds.getCurrentItem()[cfg.fieldsAdditonal[0]];
                dt1.setUTCHours(oldDate1 ? new Date(oldDate1).getUTCHours() : 0, 0, 0, 0);
                this.ds.setFieldValue(cfg.fieldsAdditonal[0], dt1);
                break;
            }
            case FieldType.SELECT:
            case FieldType.REFERENCE:
                val = cfg.el.value;
                break;
            case FieldType.MULTI_SELECT:
            case FieldType.MULTI_REFERENCE:
                val = this.ensureArray(cfg.el.value);
                break;
            case FieldType.STRING:
                val = cfg.trim ? String(cfg.el.value).trim() : String(cfg.el.value);
                break;
            case FieldType.IMAGE:
                const btn = this.findRecursive(cfg.el, "$w.UploadButton");
                if (btn?.value?.length > 0) {
                    const files = await btn.uploadFiles();
                    val = files[0].fileUrl;
                    btn.value = [];
                    needRefresh = true;
                } else
                    val = this.ds.getCurrentItem()?.[cfg.field] || ""; // keep existing image
                break;
            case FieldType.IMAGES: {
                const btn = this.findRecursive(cfg.el, "$w.UploadButton");
                const currentImages = this.ensureArray(this.ds.getCurrentItem()?.[cfg.field]);
                if (btn?.value?.length > 0) {
                    const files = await btn.uploadFiles();
                    val = [...currentImages, ...files.map(file => this.createMediaStruct(file.fileUrl, file.fileName))];
                    btn.value = [];
                    needRefresh = true;
                } else {
                    val = currentImages;
                }
                break;
            }
            case FieldType.CUSTOM:
                try {
                    val = await cfg.onParseUserInput(cfg.el.value);
                } catch (e) {
                    console.warn("Error in onParseUserInput for", id, ":", e);
                }
                break;
            default:
                val = cfg.el.value;
        }

        console.log("Writing user input of", id, "to", cfg.field, "with value:", val);
        this.ds.setFieldValue(cfg.field, val);
        if (cfg.onChanged) await cfg.onChanged(val);

        if (needRefresh) await this.updateUiFromData(id, null, val);
    }

    createMediaStruct(v, namePart = null) {
        return typeof v != "string" ? v : {
            src: v,
            title: namePart ?? (v.split('/').pop()?.split('?')[0] || ""),
            type: /\.(mp4|mov|webm|video)/i.test(v) ? "video" : "image"
        };
    }

    /**
     * Populates UI elements with data from an item or a given value.
     * @param {string} id - The ID of the element in cmsSchema.
     */
    async updateUiFromData(id, item = null, val = null) {
        const cfg = this.cmsSchema[id];
        if (!cfg) {
            console.error("Cannot assign to input", id, ": CMS schema not found in configuration")
            return;
        }

        if (!cfg.el || !cfg.el.id) {
            console.error("Cannot assign to input", id, ": Input element not found")
            return;
        }

        val ??= item?.[cfg.field];
        let done = false;
        switch (cfg.type) {
            case FieldType.BOOLEAN:
                val = !!val;
                if ("checked" in cfg.el) {
                    cfg.el.checked = val;
                    done = true;
                }
                break;
            case FieldType.ADDRESS:
                val = val && typeof val == 'object' ? val : { formatted: "" };
                break;
            case FieldType.HOURS_OF_DATE:
                if (!val && "selectedIndex" in cfg.el) {
                    cfg.el.selectedIndex = 0;
                    done = true;
                }
                break;
            case FieldType.DATE:
                if (val) val = toLocal(new Date(val));
                if (val && isNaN(val.getTime())) val = null;
                break;
            case FieldType.DATE_RANGE:
                val = dateRangeToString(val, item?.[cfg.fieldsAdditonal[0]], { hour: null, minute: null });
                break;
            case FieldType.IMAGE:
                val ||= TRANSPARENT_PIXEL;
                const img = this.findRecursive(cfg.el, "$w.Image");
                if (img && "src" in img) {
                    img.src = val;
                    done = true;
                }
                break;
            case FieldType.IMAGES:
                val = this.ensureArray(val).map(v => this.createMediaStruct(v));
                const gallery = this.findRecursive(cfg.el, "$w.Gallery");
                if (gallery && "items" in gallery) {
                    gallery.items = val.map((item, idx) => ({
                        ...item,
                        description: idx == selIdx ? "✅" : ""
                    }));
                    done = true;
                }
                break;
            case FieldType.MULTI_REFERENCE: {
                if (!val) try {
                    const refResult = await wixData.queryReferenced(this.cmsName, item?._id, cfg.field);
                    //console.log(`updateUiFromData MULTI_REFERENCE:\n${JSON.stringify(refResult, null, 2)}`);
                    val = this.ensureArray(refResult.items.map(refItem => refItem._id));
                    this.ds.setFieldValue(cfg.field, val);
                } catch (e) {
                    console.error("Failed to fetch references for", cfg.field, ":", e);
                    val = [];
                }
                break;
            }
            case FieldType.CUSTOM:
                try {
                    val = await cfg.onFormatValue(item);
                } catch (e) {
                    console.warn("Error in onFormatValue for", id, ":", e);
                    val = null;
                }
                break;
        }
        console.log("Updating user input", id, "from", cfg.field, "with value:", val);
        if (!done) {
            // if no special set function has been used, try to use the default 
            if ("value" in cfg.el)
                cfg.el.value = val;
            else
                console.error("Cannot assign to user input", id, "from field", cfg.field, ": No 'value' property")
        }

        const btn = cfg.linkButton ? $w(cfg.linkButton) : null;
        if (btn && btn.id) {
            if (val) btn.link = `${cfg.linkPrefix ?? ""}${val}`;
            if (val) btn.enable(); else btn.disable();
            btn.target = "_blank";
        }

        if (cfg.el.resetValidityIndication) cfg.el.resetValidityIndication();
    }

    /**
     * Returns the user-friendly string representation of an item's field.
     * @param {Object} item - CMS Item.
     * @param {CmsFieldConfig} cfg - Field configuration.
     * @returns {Promise<string>}
     */
    async displayValue(item, cfg) {
        if (!cfg) return "";
        if (cfg.onDisplayValue) return await cfg.onDisplayValue(item);
        if (!item) return "";
        const v = item[cfg.field];
        const formatters = {
            [FieldType.BOOLEAN]: () => v ? cfg.boolTrue : cfg.boolFalse,
            [FieldType.NUMBER]: () => Number(v).toLocaleString('de-DE', { minimumFractionDigits: cfg.fractionDigits }),
            [FieldType.ADDRESS]: () => v.formatted || String(v),
            [FieldType.DATE]: () => dateRangeToString(v, null, cfg.format),
            [FieldType.DATE_RANGE]: () => dateRangeToString(v, item[cfg.fieldsAdditonal[0]], cfg.format),
            [FieldType.HOURS_OF_DATE]: () => v ? `${toLocal(new Date(v)).getHours()}:00` : "",
            [FieldType.MULTI_SELECT]: () => this.ensureArray(v).join(", "),
            [FieldType.IMAGES]: () => `${this.ensureArray(v).length} Bilder`,
            [FieldType.CUSTOM]: () => cfg.onFormatValue(item),
        };
        const res = v == null || v === "" ? null : (formatters[cfg.type] || (() => String(v)))();
        return res !== null ? `${cfg.prefix}${res}${cfg.suffix}` : "";
    }

    /**
      * Compares the original item with the current state to find changes.
      * @param {Object} originalItem - Item before changes.
      * @returns {Promise<Object>} Object containing internal and user-facing diff arrays.
      */
    async getDiff(originalItem) {
        const currentItem = this.ds.getCurrentItem();
        let diffIntern = [];
        let diffUser = [];

        await Promise.all(Object.values(this.cmsSchema).map(async (cfg) => {
            if (!cfg.collectDiff) return;
            const [vOrg, vCur] = await Promise.all([this.displayValue(originalItem, cfg), this.displayValue(currentItem, cfg)]);
            if (vOrg != vCur) {
                diffIntern.push([cfg.label, vOrg, vCur]);
                if (cfg.showToUser) diffUser.push([cfg.label, vOrg, vCur]);
            }
        }));
        return { diffIntern, diffUser };
    }

    /**
     * Immediately executes any pending debounced updates.
     * @param {boolean} [update=true] - Whether to perform the data update.
     */
    async flushDebounce(update = true) {
        await Promise.all(Object.keys(this.debounceTimers).map(async (id) => {
            if (this.debounceTimers[id]) {
                clearTimeout(this.debounceTimers[id]);
                this.debounceTimers[id] = null;
                if (update) await this.updateDataFromUi(id);
            }
        }));
    }

    async saveItem() {
        console.log("saveItem");
        await this.flushDebounce();
        console.log(`saveItem:\n${JSON.stringify(this.ds.getCurrentItem(), null, 2)}`);
        this.collapseResponse();
        const beforeSafeResult = await this.onBeforeSave();
        if (beforeSafeResult == null) return;
        const savedItem = await this.ds.save();
        if (savedItem) for (const cfg of Object.values(this.cmsSchema))
            if (cfg.type == FieldType.MULTI_REFERENCE) {
                const val = this.ensureArray(cfg.el.value);
                console.log("saveItem replaceReferences", cfg.field, savedItem._id, val);
                await wixData.replaceReferences(this.cmsName, cfg.field, savedItem._id, val);
            }
        console.log("item saved");
        this.updateSelectorList();
        this.onAfterSave(beforeSafeResult);
        this.showMessage("Erfolgreich gespeichert.");
    }

    async revertItem() {
        console.log("revertItem");
        await this.flushDebounce(false);
        this.collapseResponse();
        await this.ds.revert();
        console.log("item reverted");
        this.refreshUI();
        this.onAfterReverted();
        this.showMessage("Änderungen verworfen.");
    }

    async newItem() {
        console.log("newItem");
        await this.flushDebounce();
        this.collapseResponse();
        await this.ds.save();
        console.log("item saved before creating new item");
        await this.ds.new();
        console.log("item created");
        this.refreshUI();
        this.showMessage("Erfolgreich erstellt.");
    }

    async removeItem() {
        console.log("removeItem");
        await this.flushDebounce();
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

        const items = await this.onQueryUpdate(searchText) || [];
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

    /**
     * If val already is an array, returns it, 
     * if val is null, returns [],
     * else returns val as a single-length array.
     * @param {any} val 
     * @returns any[] 
     */
    ensureArray(val) {
        return Array.isArray(val) ? val : (val ? [val] : []);
    }

    findRecursive(element, type = null, namePart = null) {
        if (!element.children) return null;
        let found = element.children.find(c => (!type || c.type === type) && (!namePart || c.id.toLowerCase().includes(namePart)));
        if (found) return found;
        for (const child of element.children) {
            found = this.findRecursive(child, type, namePart);
            if (found) return found;
        }
        return null;
    }

}
