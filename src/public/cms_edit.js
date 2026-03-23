import wixData from 'wix-data';

import { dateRangeToString, stringToDateRange, toUTC, toLocal } from 'public/cms.js';

/**
 * @typedef {Object} CmsFieldConfig
 * @property {string} field - The CMS field key in case there is only one field.
 * @property {string[]} fields - A list of CMS field keys for types that support multiple (like DATE_RANGE). Overwrites field property.
 * @property {string} type - FieldType constant.
 * @property {Object} [el] - The Wix UI element $w (automatically assigned during init).
 * @property {string} [label] - Display label for logs and diffs (defaults to 'label' property of 'el'.
 * @property {boolean} [required] - Item can only be stored if data has been entered (default false).
 * @property {boolean} [readOnly] - Data cannot be edited by the user (default false).
 * @property {number} [delay] - Debounce delay in ms (default 500ms).
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
 * @property {boolean} [dataSet] - For FieldType.REFERENCE/MULTI_REFERENCE: Name of the dataset to which the references shall point.
 * @property {boolean} [onGenerateLabel] - (item) => string: For FieldType.REFERENCE/MULTI_REFERENCE: Label for entries of the dataset.
 */

export const FieldType = Object.freeze({
    STRING: 'STRING',
    RICH_TEXT: 'RICH_TEXT',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
    ADDRESS: 'ADDRESS',
    DATE: 'DATE',
    DATE_RANGE: 'DATE_RANGE',
    TIME_OF_DATE: 'TIME_OF_DATE',
    HOURS_OF_DATE: 'HOURS_OF_DATE',
    IMAGE: 'IMAGE',
    IMAGES: 'IMAGES',
    SELECT: 'SELECT',
    MULTI_SELECT: 'MULTI_SELECT',
    REFERENCE: 'REFERENCE',
    MULTI_REFERENCE: 'MULTI_REFERENCE',
    CUSTOM: 'CUSTOM',
    REPEATER: 'REPEATER',
});

export const FilterType = Object.freeze({
    EQ: 'EQ',
    CONTAINS: 'CONTAINS',
    HAS_SOME: 'HAS_SOME',
    GE: 'GE',
    LE: 'LE',
    IS_NOT_EMPTY: 'IS_NOT_EMPTY'
});

const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

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
        this.generateTitle = config.generateTitle || ((item) => item?.title || "(Unbenannt)");

        this.filterSchema = config.filterSchema || {};
        this.filterLimit = config.filterLimit || 1000;
        this.filterSortField = config.filterSortField || "_id";
        this.filterSortAscending = config.filterSortAscending || true;

        this.instanceId = Math.random().toString(36).substring(2, 9);
        this.ds = $w(`#${this.dataSetName}`);
        this.originalItem = null;
        this.messageTimer = null;
        this.debounceTimers = {};
        this.isSaving = false;
    }

    /**
     * Initializes the editor, sets default schema values, and binds UI events.
     */
    init() {
        console.log("Initializing CMS Editor for", this.cmsName, "with dataset", this.dataSetName);

        for (const [id, cfg] of Object.entries(this.cmsSchema)) this._initCMSConfig(id, cfg);
        for (const [key, cfg] of Object.entries(this.filterSchema)) this._initFilterConfig(key, cfg);

        this.ds.onReady(async () => {
            try {
                for (const cfg of Object.values(this.cmsSchema)) this._initCMSElement(cfg, $w);
                const boundIDs = new Set();
                for (const cfg of Object.values(this.filterSchema)) this._initFilterElement(cfg, $w, boundIDs);
                await this.refreshUI();
                const options = $w("#itemSelector").options;
                if (options.length > 1) await this.navigateTo(options[1].value);
            } catch (e) {
                console.error(e);
                throw e;
            }
        });

        this.ds.onError((error) => { this.showError(error); });

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

        for (const [id, action] of Object.entries(uiButtons)) {
            const el = $w(id);
            if (el.id) el.onClick(async () => await action()); else console.warn(id, "not found in DOM");
        }

        this.updateSelectorList().then(() => this.updateButtonStates());
    }

    _initCMSConfig(id, cfg) {
        cfg.id ??= id;
        if (Array.isArray(cfg.fields)) {
            cfg.field = cfg.fields[0];
        } else
            cfg.fields = null;
        if (!cfg.label) cfg.label = $w(cfg.id)?.label || cfg.field;
        cfg.required ??= false;
        cfg.readOnly ??= false;
        cfg.delay ??= 500;
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
            case FieldType.IMAGES:
                cfg.selIdx = -1;
                break;
            case FieldType.REPEATER:
                cfg.inputs ??= {};
                for (const [idSub, cfgSub] of Object.entries(cfg.inputs)) this._initCMSConfig(idSub, cfgSub);
                break;
        }
    }

    _initFilterConfig(key, cfg) {
        cfg.id ??= key;
        cfg.fields ??= this.ensureArray(cfg.field);
        cfg.type ??= FilterType.EQ;
        cfg.orCombined ??= false;
        cfg.value ??= (val) => val;
        cfg.skip ??= (val) => val === null || val === "" || val === "*";
        cfg.delay ??= 500;
    }

    _bind(trg, scope, cfg, parentCfg, index, events, delay, callback) {
        for (const s of events) if (typeof trg[s] == "function") {
            //console.log("Binding", s, "to", cfg.id);
            trg[s]((event) => {
                if (s != "onKeyPress" || event.key == "Enter") {
                    console.log("Triggering", s, "on", cfg.id, "with delay", delay);
                    if (this.debounceTimers[cfg.id]) clearTimeout(this.debounceTimers[cfg.id].timer);
                    this.debounceTimers[cfg.id] = {
                        timer: setTimeout(callback, delay),
                        scope,
                        cfg,
                        parentCfg,
                        index
                    };
                }
            });
        } else {
            //console.warn("Cannot bind", s, "to", id, ":", typeof trg[s]);
        }
    }

    async _initCMSElement(cfg, scope) {
        const el = scope(cfg.id);
        if (!el) {
            console.warn("No such input element:", cfg.id);
            return;
        }

        if (cfg.type == FieldType.REPEATER) {
            el.onItemReady(($item, itemData, index) => {
                try {
                    console.log("onItemReady", { id: cfg.id, index });
                    for (const cfgSub of Object.values(cfg.inputs)) {
                        this._initCMSElement(cfgSub, $item);
                        this._updateUiFromData(cfgSub, $item, itemData, null);
                        this._bind(
                            $item(cfgSub.id), $item, cfgSub, cfg, index,
                            ['onBlur', 'onKeyPress', 'onInput', 'onChange'],
                            cfgSub.delay || 0,
                            (() => this._updateDataFromUI(cfgSub, $item, cfg, index))
                        );
                    }
                } catch (e) {
                    console.error(e);
                    throw e;
                }

            });
            return;
        }

        this._bind(el, scope, cfg, null, null, ['onBlur', 'onKeyPress'], 0, () => this._updateDataFromUI(cfg, scope, null, null));
        this._bind(el, scope, cfg, null, null, ['onInput', 'onChange'], cfg.delay, () => this._updateDataFromUI(cfg, scope, null, null));

        let requiredApplied = false;
        let readOnlyApplied = false;
        let customValidationApplied = false;
        const appplyAttrs = (el) => {
            if (cfg.required && "required" in el) {
                el.required = cfg.required;
                requiredApplied = true;
            }
            if (cfg.readOnly && typeof el.disable == "function") {
                el.disable();
                readOnlyApplied = true;
            }
            if (cfg.onCustomValidation && "onCustomValidation" in el) {
                el.onCustomValidation(cfg.onCustomValidation);
                customValidationApplied = true;
            }
        };
        appplyAttrs(el);

        if (cfg.type == FieldType.IMAGES) {
            const gallery = this._findRecursive(el, "$w.Gallery");
            if (gallery && !cfg.readOnly) gallery.onItemClicked((event) => {
                cfg.selIdx = event.itemIndex;
                console.log("Selected media index on", cfg.id, ":", cfg.selIdx);
                this._updateUiFromData(cfg, scope, this.ds.getCurrentItem(), null); // just to update selection marker
            });

            const updateMedia = async (action) => {
                const item = this.ds.getCurrentItem();
                const val = this.ensureArray(item?.[cfg.field]);
                console.log("Executing", action, "on", cfg.id, "with", val.length, "items for index", cfg.selIdx);
                if (cfg.selIdx < 0 || cfg.selIdx >= val.length) return;
                if (action == "moveleft" && cfg.selIdx > 0) {
                    [val[cfg.selIdx - 1], val[cfg.selIdx]] = [val[cfg.selIdx], val[cfg.selIdx - 1]];
                    cfg.selIdx--;
                } else if (action == "moveright" && cfg.selIdx < val.length - 1) {
                    [val[cfg.selIdx + 1], val[cfg.selIdx]] = [val[cfg.selIdx], val[cfg.selIdx + 1]];
                    cfg.selIdx++;
                } else if (action == "remove") {
                    val.splice(cfg.selIdx, 1);
                    cfg.selIdx = -1;
                }
                console.log("Selected media index on", cfg.id, ":", cfg.selIdx);
                this.ds.setFieldValue(cfg.field, val);
                await this._updateUiFromData(cfg, scope, item, val);
                await this.updateButtonStates();
            };
            for (const namePart of ['moveleft', 'moveright', 'remove']) {
                const btn = this._findRecursive(el, "$w.Button", namePart);
                if (btn) btn.onClick(() => updateMedia(namePart));
                appplyAttrs(btn);
            }
        }

        if (cfg.type == FieldType.IMAGE || cfg.type == FieldType.IMAGES) {
            if (cfg.required) {
                const lbl = this._findRecursive(el, "$w.Text", "name");
                if (lbl && "text" in lbl) {
                    lbl.text += " *";
                    requiredApplied = true;
                }
            }
            const btn = this._findRecursive(el, "$w.UploadButton");
            if (btn) this._bind(btn, scope, cfg, null, null, ['onChange'], 0, () => this._updateDataFromUI(cfg, scope, null, null));
            appplyAttrs(btn);
        }

        if (cfg.dataSet && (cfg.type == FieldType.REFERENCE || cfg.type == FieldType.MULTI_REFERENCE)) {
            const data = await wixData.query(cfg.dataSet).find();
            const options = data.items.map(item => ({ label: cfg.onGenerateLabel(item), value: item._id }));
            if ("options" in el)
                el.options = options;
            else
                console.error("Cannot assign options list to", cfg.id);

            //must also be applied to filters for those fields
            for (const fCfg of Object.values(this.filterSchema)) if (fCfg.fields.includes(cfg.field)) {
                const elFilter = $w(fCfg.id);
                if (elFilter && "options" in elFilter)
                    elFilter.options = [{ label: "(Alle)", value: "*" }, ...options];
                else
                    console.error("Cannot assign options list to", fCfg.id);
            }
        }

        if (cfg.required && !requiredApplied) console.error("Cannot assign required attribute to", cfg.id);
        if (cfg.readOnly && !readOnlyApplied) console.error("Cannot assign readonly attribute to", cfg.id);
        if (cfg.onCustomValidation && !customValidationApplied) console.error("Cannot assign onCustomValidation attribute to", cfg.id);
    }

    _initFilterElement(cfg, scope, boundIDs) {
        const el = scope(cfg.id);
        if (!el)
            console.warn("No such filter element:", cfg.id);
        else if (!boundIDs.has(cfg.id)) {
            boundIDs.add(cfg.id);
            this._bind(el, scope, cfg, null, null, ['onBlur', 'onKeyPress'], 0, () => this.updateSelectorList());
            this._bind(el, scope, cfg, null, null, ['onInput', 'onChange'], cfg.delay, () => this.updateSelectorList());
        }
    }

    /**
     * Synchronizes the UI with the current dataset item.
     */
    async refreshUI() {
        const item = this.ds.getCurrentItem();
        console.log("refreshUI", item);

        if (item) await Promise.all((Object.values(this.cmsSchema).filter(cfg => cfg.type == FieldType.MULTI_REFERENCE)).map(async (cfg) => {
            try {
                const refResult = await wixData.queryReferenced(this.cmsName, item._id, cfg.field);
                item[cfg.field] = refResult.items.map(refItem => refItem._id);
                await this.ds.setFieldValue(cfg.field, item[cfg.field]);
            } catch (e) {
                console.error("Failed to fetch references for", cfg.field, ":", e);
                console.error(e);
                throw e;
            }
        }));

        await Promise.all(Object.keys(this.cmsSchema).map(id => this._updateUiFromData(this.cmsSchema[id], $w, item, null)));
        this.originalItem = item ? structuredClone(item) : null;
        for (const cfg of Object.values(this.cmsSchema)) if ("selIdx" in cfg) cfg.selIdx = -1;
        await this.onRefreshUI();
        await this.updateSelectorList();
        await this.updateButtonStates();
    }

    async _getUiValue(cfg, scope, item) {
        const el = scope(cfg.id);
        if (!cfg) {
            console.error("Cannot assign from input", cfg.id, ": CMS schema not found in configuration")
            return;
        }

        if (!el || !el.id) {
            console.error("Cannot assign from input", cfg.id, ": Input element not found")
            return;
        }

        let val = item?.[cfg.field];
        let needRefresh = false;
        switch (cfg.type) {
            case FieldType.BOOLEAN:
                val = el.checked;
                break;
            case FieldType.NUMBER:
                val = Number(el.value ?? 0);
                break;
            case FieldType.ADDRESS:
                val = el.value;
                break;
            case FieldType.TIME_OF_DATE: {
                let dt = new Date(val);
                if (isNaN(dt.getTime()))
                    val = null;
                else {
                    dt = toLocal(dt);
                    const [hours, minutes] = (el.value.toString() || "00:00").split(':');
                    dt.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
                    val = toUTC(dt);
                }
                break;
            }
            case FieldType.HOURS_OF_DATE: {
                let dt = new Date(val);
                if (isNaN(dt.getTime()))
                    val = null;
                else {
                    dt.setUTCHours(0, 0, 0, 0);
                    dt = toLocal(dt);
                    dt.setHours(Number(el.value ?? 0), 0, 0, 0);
                    val = toUTC(dt);
                }
                break;
            }
            case FieldType.DATE: { // update date with new value but keep hours
                const local = el.value;
                if (!local || isNaN(new Date(local).getTime())) {
                    val = null;
                } else {
                    const oldDate = val;
                    val = new Date(local.getFullYear(), local.getMonth(), local.getDate());
                    val.setHours(oldDate ? new Date(oldDate).getHours() : 0, 0, 0, 0);
                }
                break;
            }
            case FieldType.DATE_RANGE: { // update date with new value but keep hours
                const range = stringToDateRange(el.value) || [];
                const oldDate0 = val;
                val = new Date(range[0]);
                val.setUTCHours(oldDate0 ? new Date(oldDate0).getUTCHours() : 0, 0, 0, 0);
                const dt1 = new Date(range[1]);
                const oldDate1 = item?.[cfg.fields[1]];
                dt1.setUTCHours(oldDate1 ? new Date(oldDate1).getUTCHours() : 0, 0, 0, 0);
                this.ds.setFieldValue(cfg.fields[1], dt1); //TODO not working if scoped
                break;
            }
            case FieldType.SELECT:
            case FieldType.REFERENCE:
                val = el.value;
                break;
            case FieldType.MULTI_SELECT:
            case FieldType.MULTI_REFERENCE:
                val = this.ensureArray(el.value);
                break;
            case FieldType.STRING:
                val = cfg.trim ? String(el.value).trim() : String(el.value);
                break;
            case FieldType.IMAGE:
                const btn = this._findRecursive(el, "$w.UploadButton");
                if (btn?.value?.length > 0) {
                    const files = this.ensureArray(await btn.uploadFiles());
                    val = files[0].fileUrl;
                    btn.reset();
                    needRefresh = true;
                } else
                    // keep existing image
                    break;
            case FieldType.IMAGES: {
                const btn = this._findRecursive(el, "$w.UploadButton");
                const currentImages = this.ensureArray(val);
                if (btn?.value?.length > 0) {
                    const files = this.ensureArray(await btn.uploadFiles());
                    val = [...currentImages, ...files.map((file, i) => this._createMediaStruct(cfg, i, file.fileUrl, file.fileName))];
                    btn.reset();
                    needRefresh = true;
                } else {
                    val = currentImages;
                }
                break;
            }
            case FieldType.CUSTOM:
                try {
                    val = await cfg.onParseUserInput(el.value);
                } catch (e) {
                    console.warn("Error in onParseUserInput for", cfg.id, ":", e);
                }
                break;
            case FieldType.REPEATER:
                val = this.ensureArray(item?.[cfg.field]);
                break;
            default:
                val = el.value;
        }
        return { val, needRefresh };
    }

    /**
     * Reads values from the UI and updates the dataset fields.
     */
    async _updateDataFromUI(cfg, scope, parentCfg, index) {
        const item = this.ds.getCurrentItem();
        const masterArray = parentCfg ? [...this.ensureArray(item[parentCfg.field])] : null;
        const itemData = masterArray ? masterArray[index] : item;
        const curVal = itemData?.[cfg.field];
        const { val, needRefresh } = await this._getUiValue(cfg, scope, itemData);
        if (JSON.stringify(val) == JSON.stringify(curVal)) {
            console.log("No change in input of", cfg.id, "for", cfg.field, index == null ? "" : "at", index == null ? "" : index);
            return;
        }
        if (masterArray) masterArray[index] = { ...masterArray[index], [cfg.field]: val };
        console.log("Writing user input of", cfg.id, "to", cfg.field, index == null ? "" : "at", index == null ? "" : index, "with value:", val);
        if (masterArray) {
            this.ds.setFieldValue(parentCfg.field, masterArray);
        } else {
            this.ds.setFieldValue(cfg.field, val);
        }
        if (cfg.onChanged) await cfg.onChanged(val, parentCfg, index);
        this._validate(cfg, scope, itemData);
        await this.updateButtonStates();
        if (needRefresh || masterArray) await this._updateUiFromData(cfg, scope, itemData, val);
    }

    /**
     * Populates UI elements with data from an item or a given value.
     */
    async _updateUiFromData(cfg, scope, item, val) {
        const el = scope(cfg.id);
        if (!cfg) {
            console.error("Cannot assign to input", cfg.id, ": CMS schema not found in configuration")
            return;
        }

        if (!el || !el.id) {
            console.error("Cannot assign to input", cfg.id, ": Input element not found")
            return;
        }

        val ??= item?.[cfg.field];
        let done = false;
        switch (cfg.type) {
            case FieldType.BOOLEAN:
                val = !!val;
                if ("checked" in el) {
                    el.checked = val;
                    done = true;
                }
                break;
            case FieldType.ADDRESS:
                val = val && typeof val == 'object' ? val : { formatted: "" };
                break;
            case FieldType.TIME_OF_DATE:
                if (val != null) {
                    const dt = new Date(val);
                    val = dt.getHours().toString().padStart(2, '0') + ":" + dt.getMinutes().toString().padStart(2, '0');
                } else
                    val = "";
                break;
            case FieldType.HOURS_OF_DATE:
                if (!val && "selectedIndex" in el) {
                    el.selectedIndex = 0;
                    done = true;
                }
                break;
            case FieldType.DATE:
                if (val) val = new Date(val);
                if (val && isNaN(val.getTime())) val = null;
                break;
            case FieldType.DATE_RANGE:
                val = dateRangeToString(val, item?.[cfg.fields[1]], { hour: null, minute: null });
                break;
            case FieldType.IMAGE:
                val ||= TRANSPARENT_PIXEL;
                const img = this._findRecursive(el, "$w.Image");
                if (img && "src" in img) {
                    img.src = val;
                    done = true;
                }
                break;
            case FieldType.IMAGES:
                val = this.ensureArray(val).map((v, i) => this._createMediaStruct(cfg, i, v));
                const gallery = this._findRecursive(el, "$w.Gallery");
                if (gallery && "items" in gallery) {
                    gallery.items = val;
                    if (gallery.items.length == 0) gallery.collapse(); else gallery.expand();
                    done = true;
                }
                break;
            case FieldType.CUSTOM:
                try {
                    val = await cfg.onFormatValue(item);
                } catch (e) {
                    console.warn("Error in onFormatValue for", cfg.id, ":", e);
                    val = null;
                }
                break;
            case FieldType.REPEATER:
                val = this.ensureArray(val);
                el.data = val.map((d, i) => ({ ...d, _id: d._id || `row-${i}-${this.instanceId}` }));
                break;
        }
        console.log("Updating user input", cfg.id, "from", cfg.field, "with value:", val);
        if (!done) {
            // if no special set function has been used, try to use the default 
            if ("value" in el)
                el.value = val;
            else
                console.error("Cannot assign to user input", cfg.id, "from field", cfg.field, ": No 'value' property")
        }

        const btn = cfg.linkButton ? scope(cfg.linkButton) : null;
        if (btn && btn.id) {
            if (val) btn.link = `${cfg.linkPrefix ?? ""}${val}`;
            if (val) btn.enable(); else btn.disable();
            btn.target = "_blank";
        }

        this._validate(cfg, scope);
    }

    _createMediaStruct(cfg, idx, v, namePart = null) {
        return typeof v != "string"
            ? { ...v, description: idx == cfg.selIdx ? "✅" : "" }
            : {
                src: v,
                title: namePart ?? (v.split('/').pop()?.split('?')[0] || ""),
                type: /\.(mp4|mov|webm|video)/i.test(v) ? "video" : "image",
                description: idx == cfg.selIdx ? "✅" : "",
            };
    }

    /**
     * Returns the user-friendly string representation of an item's field, currently used only in diff.
     * @param {Object} item - CMS Item.
     * @param {CmsFieldConfig} cfg - Field configuration.
     * @returns {Promise<string>}
     */
    async _displayValue(item, cfg) {
        if (!cfg) return "";
        if (cfg.onDisplayValue) return await cfg.onDisplayValue(item);
        if (!item) return "";
        const v = item[cfg.field];
        const formatters = {
            [FieldType.BOOLEAN]: () => v ? cfg.boolTrue : cfg.boolFalse,
            [FieldType.NUMBER]: () => Number(v).toLocaleString('de-DE', { minimumFractionDigits: cfg.fractionDigits }),
            [FieldType.ADDRESS]: () => v.formatted || String(v),
            [FieldType.DATE]: () => dateRangeToString(v, null, cfg.format),
            [FieldType.DATE_RANGE]: () => dateRangeToString(v, item[cfg.fields[1]], cfg.format),
            [FieldType.HOURS_OF_DATE]: () => v ? `${toLocal(new Date(v)).getHours()}:00` : "",
            [FieldType.TIME_OF_DATE]: () => v ? `${toLocal(new Date(v)).getHours()}:${toLocal(new Date(v)).getMinutes()}` : "",
            [FieldType.MULTI_SELECT]: () => this.ensureArray(v).join(", "),
            [FieldType.IMAGES]: () => `${this.ensureArray(v).length} Bilder`,
            [FieldType.CUSTOM]: () => cfg.onFormatValue(item),
        };
        const res = v == null || v === "" ? null : (formatters[cfg.type] || (() => String(v)))();
        return res !== null ? `${cfg.prefix}${res}${cfg.suffix}` : "";
    }

    /**
      * Compares the original item with the current state to find changes.
      * @returns {Promise<Object>} Object containing internal and user-facing diff arrays.
      */
    async getDiff() {
        const currentItem = this.ds.getCurrentItem();
        let diffIntern = [];
        let diffUser = [];

        await Promise.all(Object.values(this.cmsSchema).map(async (cfg) => {
            if (!cfg.collectDiff) return;
            const [vOrg, vCur] = await Promise.all([this._displayValue(this.originalItem, cfg), this._displayValue(currentItem, cfg)]);
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
            const ctx = this.debounceTimers[id];
            if (ctx) {
                clearTimeout(ctx.timer);
                this.debounceTimers[id] = null;
                if (update) await this._updateDataFromUI(ctx.cfg, ctx.scope, ctx.parentCfg, ctx.index);
            }
        }));
    }

    async saveItem() {
        console.log("saveItem");
        this.isSaving = true;
        let savedItem = false;
        try {
            await this.updateButtonStates();
            await this.flushDebounce();
            console.log(`saveItem:\n${JSON.stringify(this.ds.getCurrentItem(), null, 2)}`);

            let allValid = true;
            for (const cfg of Object.values(this.cmsSchema)) if (!this._validate(cfg, $w)) allValid = false;
            if (!allValid) {
                this.showError("Bitte Eingaben auf Fehler prüfen");
                return false;
            }

            this.collapseResponse();
            let diff = await this.getDiff();
            console.log("saveItem diff:", diff.diffIntern);
            const beforeSafeResult = await this.onBeforeSave();
            if (beforeSafeResult == null) return false;
            savedItem = await this.ds.save();
            if (savedItem) for (const cfg of Object.values(this.cmsSchema))
                if (cfg.type == FieldType.MULTI_REFERENCE) {
                    const val = this.ensureArray($w(cfg.id)?.value);
                    console.log("saveItem replaceReferences", cfg.field, savedItem._id, val);
                    await wixData.replaceReferences(this.cmsName, cfg.field, savedItem._id, val);
                    //TODO need recursion for REPETAER type
                }
            console.log("item saved");
            this.onAfterSave(diff, beforeSafeResult);
            this.showMessage("Erfolgreich gespeichert.");
            await this.refreshUI();
        } finally {
            this.isSaving = false;
            await this.updateButtonStates();
        }
        return savedItem; //TODO or always true?
    }

    async revertItem() {
        console.log("revertItem");
        await this.flushDebounce(false);
        this.collapseResponse();
        await this.ds.revert();
        console.log("item reverted");
        this.onAfterReverted();
        this.showMessage("Änderungen verworfen.");
        await this.refreshUI();
    }

    async newItem() {
        console.log("newItem");
        const saveSuccessful = await this.saveItem();
        if (saveSuccessful) {
            console.log("item saved before creating new item");
            await this.ds.new();
            console.log("item created");
            this.showMessage("Erfolgreich erstellt.");
            await this.refreshUI();
        } else
            console.warn("New item aborted: Save failed.");
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
                await this.refreshUI();
            } else {
                console.warn("navigateTo cannot find among", result.items.length, "items");
            }
        } else
            console.warn("navigateTo will ignore entry", id);
    }

    async updateSelectorList() {
        console.log("updateSelectorList");

        let q = wixData.query(this.cmsName);

        for (const cfg of Object.values(this.filterSchema)) {
            const applyOp = (q, f, v) => {
                switch (cfg.type) {
                    case FilterType.EQ: return q.eq(f, v);
                    case FilterType.CONTAINS: return q.contains(f, v);
                    case FilterType.GE: return q.ge(f, v);
                    case FilterType.LE: return q.le(f, v);
                    case FilterType.HAS_SOME: return q.hasSome(f, Array.isArray(v) ? v : [v]);
                    case FilterType.IS_NOT_EMPTY: return q.isNotEmpty(f);
                    default: return q;
                }
            };

            const el = $w(cfg.id);
            if (!el && cfg.type != FilterType.IS_NOT_EMPTY) continue;

            const val = "checked" in el ? el.checked : el.value;
            if (cfg.skip(val)) continue;

            const pVal = cfg.value(val);
            if (cfg.orCombined) {
                // ONE value vs MANY fields (OR)
                let qOr = null;
                for (let i = 0; i < cfg.fields.length; i++) {
                    const qI = applyOp(wixData.query(this.cmsName), cfg.fields[i], pVal);
                    qOr = i == 0 ? qI : qOr.or(qI);
                }
                if (qOr) q = q.and(qOr);
            }
            else if (cfg.fields.length > 1 && Array.isArray(pVal) && pVal.length == cfg.fields.length)
                // Parallel Mapping (Many-to-Many)
                q = cfg.fields.reduce((q0, f, i) => applyOp(q0, f, pVal[i]), q);
            else
                // Broadcasting (One-to-Many) or Standard (One-to-One)
                q = cfg.fields.reduce((q0, f) => applyOp(q0, f, pVal), q);
        }

        q = this.filterSortAscending ? q.ascending(this.filterSortField) : q.descending(this.filterSortField);
        q = q.limit(this.filterLimit);

        try {
            console.log(`updateSelectorList query:\n${JSON.stringify(q, null, 2)}`);
            const res = await q.find();
            //console.log(`updateSelectorList result:\n${JSON.stringify(res, null, 2)}`);
            $w("#itemSelector").options = [
                { label: "➕ Neuer Eintrag", value: "--new--" },
                ...res.items.map(item => ({ label: this.generateTitle(item), value: item._id }))
            ];
            $w("#itemSelector").value = this.ds.getCurrentItem()?._id;
        } catch (err) {
            console.error("updateSelectorList failed", err);
        }
    }

    _validate(cfg, scope, item) {
        const el = scope(cfg.id);
        if (!cfg) {
            console.error("Cannot assign to input", cfg.id, ": CMS schema not found in configuration")
            return;
        }

        if (!el || !el.id || cfg.readOnly) return true; // treat non-existing and readonly as valid so don't block saving

        const isUiValid = el.validity ? el.validity.valid : true;
        let isDataValid = true;
        const val = cfg.required || cfg.onCustomValidation ? this.ds.getCurrentItem()?.[cfg.field] : null;
        if (cfg.required)
            isDataValid = val !== undefined && val !== null && val !== "" && val != TRANSPARENT_PIXEL && (!Array.isArray(val) || val.length > 0);
        if (cfg.onCustomValidation) cfg.onCustomValidation(val, (errorMessage) => {
            isDataValid = false;
            if (el.setCustomValidity) el.setCustomValidity(errorMessage);
            console.warn(`Custom rejection for ${cfg.field}: ${errorMessage}`);
        })
        if (!isUiValid || !isDataValid)
            console.warn(`Validation failed for ${cfg.field}: UI Valid: ${isUiValid}, Data Valid: ${isDataValid}`);
        if (el.updateValidityIndication)
            el.updateValidityIndication();
        else {
            if (el.style) el.style.borderColor = isUiValid && isDataValid ? "rgba(0,0,0,0)" : "red";
            const lbl = this._findRecursive(el, "$w.Text", "name");
            if (lbl) lbl.html = `<p style="color: ${isUiValid && isDataValid ? "#000000" : "#FF0000"}; font-size: 16px;">${lbl.text}</p>`;
        }

        if (cfg.type == FieldType.REPEATER) el.forEachItem(($item, itemData, index) => {
            for (const cfgSub of Object.values(cfg.inputs))
                if (!this._validate(cfgSub, $item)) isDataValid = false;
        });


        return isUiValid && isDataValid;
    }

    async updateButtonStates() {
        const selector = $w("#itemSelector");
        const currentIndex = selector.selectedIndex;
        const totalCount = selector.options.length;

        const { diffIntern } = await this.getDiff();
        const hasChanges = diffIntern.length > 0;

        const isNew = !this.ds.getCurrentItem()?._createdDate;
        const isBusy = this.isSaving;

        console.log("updateButtonStates", { currentIndex, totalCount, hasChanges, diffIntern, isNew, isBusy });
        for (const [id, enabled] of Object.entries({
            "#buttonSave": hasChanges && !isBusy,
            "#buttonRevert": hasChanges && !isBusy,
            "#buttonNew": !isNew && !isBusy,
            "#buttonRemove": !isNew && !isBusy,
            "#buttonPrev": !hasChanges && !isBusy && currentIndex > 1, // don't navigate to -- new--
            "#buttonNext": !hasChanges && !isBusy && currentIndex < totalCount - 1,
            "#itemSelector": !hasChanges && !isBusy,
        })) {
            const btn = $w(id);
            if (btn.id) enabled ? btn.enable() : btn.disable();
        }
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
        if (Array.isArray(val)) return val;
        if (val === undefined || val === null) return [];
        return [val];
    }

    _findRecursive(element, type = null, namePart = null) {
        if (!element.children) return null;
        let found = element.children.find(c => (!type || c.type === type) && (!namePart || c.id.toLowerCase().includes(namePart)));
        if (found) return found;
        for (const child of element.children) {
            found = this._findRecursive(child, type, namePart);
            if (found) return found;
        }
        return null;
    }

}
