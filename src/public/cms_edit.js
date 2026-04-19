import wixData from 'wix-data';
import wixWindow from 'wix-window';
import wixLocation from 'wix-location';
import { currentMember, authentication } from "wix-members-frontend";

import { dateRangeToString, stringToDateRange } from 'public/cms.js';
import { sendMail } from 'backend/common.jsw';

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
 * @property {boolean} [collectSummary] - Whether to include this field in summaries (default true).
 * @property {boolean} [showToUser] - Whether to show diff and summary for this field to the end user (default true).
 * @property {string} [linkButton] - ID of a button (e.g., "#btn") to link to the field's value.
 * @property {string} [linkPrefix] - Prefix for the URL in linkButton (e.g., "mailto:").
 * @property {Function} [onPrintValue] - (item) => string: Custom logic to format the value for diff and summary display.
 * @property {Function} [onChanged] - (item, values) => void: Callback triggered after the field value has been updated.
 * @property {Function} [onFormatCustomValue] - (values) => any: For FieldType.CUSTOM: Extract data from the CMS item to be displayed in the UI element.
 * @property {Function} [onParseCustomUserInput] - (value) => any: For FieldType.CUSTOM: Extract data from the UI element to be stored in the CMS item.
 * @property {number} [fractionDigits] - For FieldType.NUMBER: Number of decimals (default 0).
 * @property {string} [boolTrue] - For FieldType.BOOLEAN: Label for true (default "Ja").
 * @property {string} [boolFalse] - For FieldType.BOOLEAN: Label for false (default "Nein").
 * @property {Object} [format] - For FieldType.DATE/DATE_RANGE: Options for dateRangeToString.
 * @property {boolean} [trim] - For FieldType.STRING: Whether to trim whitespace (default true).
 * @property {boolean} [dataSet] - For FieldType.REFERENCE/MULTI_REFERENCE: Name of the dataset to which the references shall point.
 * @property {boolean} [onGenerateLabel] - (item) => string: For FieldType.REFERENCE/MULTI_REFERENCE: Label for entries of the dataset.
 * //TODO needs update as some are missing
 */

export const FieldType = Object.freeze({
    STRING: "STRING",
    RICH_TEXT: "RICH_TEXT",
    NUMBER: "NUMBER",
    BOOLEAN: "BOOLEAN",
    ADDRESS: "ADDRESS",
    DATE: "DATE",
    DATE_RANGE: "DATE_RANGE",
    TIME_OF_DATE: "TIME_OF_DATE",
    HOURS_OF_DATE: "HOURS_OF_DATE",
    IMAGE: "IMAGE",
    IMAGES: "IMAGES",
    SELECT: "SELECT",
    MULTI_SELECT: "MULTI_SELECT",
    REFERENCE: "REFERENCE",
    MULTI_REFERENCE: "MULTI_REFERENCE",
    CUSTOM: "CUSTOM",
    REPEATER: "REPEATER",
    CAPTCHA: "CAPTCHA",
    TAGS: "TAGS",
});

export const FilterType = Object.freeze({
    EQ: "EQ",
    CONTAINS: "CONTAINS",
    HAS_SOME: "HAS_SOME",
    GE: "GE",
    LE: "LE",
    IS_NOT_EMPTY: "IS_NOT_EMPTY"
});

export const FilterCombine = Object.freeze({
    OR: "OR",
    AND: "AND",
    PARALLEL_AND: "PARALLEL_AND",
});


const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export class CmsEditor {
    /**
     * @param {Object} config
     * @param {string} config.cmsName
     * @param {string} [config.dataSetName]
     * @param {Object} [config.cmsSchema]
     * @param {Object} [config.filterSchema]
     * @param {number} [config.filterLimit]
     * @param {string} [config.filterSortField]
     * @param {boolean} [config.filterSortAscending]
     * @param {function(Object):Promise<boolean>} [config.onBeforeSave]
     * @param {function(Object):void} [config.onAfterSave]
     * @param {function():void} [config.onAfterReverted]
     * @param {function(Object):void} [config.onAfterDelete]
     * @param {function(Object):string} [config.generateTitle]
     */
    constructor(config = {}) {
        this.cmsName = config.cmsName;
        this.dataSetName = config.dataSetName || `${config.cmsName}Dataset`;
        this.cmsSchema = config.cmsSchema || {};
        this.emailId = config.emailId;
        this.viewModeURL = config.viewModeURL ?? config.cmsName;

        this.onRefreshUI = config.onRefreshUI || (() => { });
        this.onBeforeSave = config.onBeforeSave || (async () => true);
        this.onAfterSave = config.onAfterSave || (() => { });
        this.onAfterReverted = config.onAfterReverted || (() => { });
        this.onAfterDelete = config.onAfterDelete || (() => { });
        this.generateTitle = config.generateTitle || ((item) => item?.title || this._getTranslatedMessage("title_null", {}, item));
        this.onGenerateEmailOptions = config.onGenerateEmailOptions || (async () => { return {} });

        this.filterSchema = config.filterSchema || {};
        this.filterLimit = config.filterLimit || 1000;
        this.filterSortField = config.filterSortField || "_id";
        this.filterSortAscending = config.filterSortAscending || true;

        this.itemSelector = config.itemSelector;
        this.textResponse = config.textResponse;
        this.buttonSave = config.buttonSave;
        this.buttonRevert = config.buttonRevert;
        this.buttonNew = config.buttonNew;
        this.buttonRemove = config.buttonRemove;
        this.buttonPrev = config.buttonPrev;
        this.buttonNext = config.buttonNext;
        this.buttonView = config.buttonView;

        this.collapseTextResponse = this.textResponse?.collapsed;

        this.ds = $w(`#${this.dataSetName}`);
        this.originalItem = null;
        this.isSaving = false;
        this.lastDiff = { diffUser: {}, diffIntern: {} };

        this.messages = {
            itemSaved: { emailId: "", dialog: true, automaticMail: false, customizableMail: false },
            itemReverted: { emailId: "", dialog: true, automaticMail: false, customizableMail: false },
            itemCreated: { emailId: "", dialog: true, automaticMail: false, customizableMail: false },
            itemRemoved: { emailId: "", dialog: true, automaticMail: false, customizableMail: false },
            itemSaveError: { emailId: "", dialog: true, automaticMail: false, customizableMail: false },
            generalError: { emailId: "", dialog: true, automaticMail: false, customizableMail: false },

            // must be the last line
            ...config.messages
        };
        this.translatedMessages = this._mergeTranslations(
            {
                booolean_yes: "Ja",
                booolean_no: "Nein",
                title_null: "(Unbenannt)",
                itemSelector_createNew: "➕ Neuer Eintrag",
                error_no_config: "Konfiguration nicht gefunden",
                itemName: "Eintrag",

                diff_caption: "Änderung",
                diff_from: "Von",
                diff_to: "Nach",
                input_caption: "Datum",
                input_value: "Wert",

                no_validationMessage: "Benutzerdefinierter Fehler",

                messageIds: {
                    itemSaved: "✔ Änderungen wurden gespeichert.",
                    itemSavedDetails: "{diff}",
                    itemReverted: "✔ Änderungen wurden verworfen.",
                    itemRevertedDetails: "",
                    itemCreated: "✔ {itemName} wurde new erstellt.",
                    itemCreatedDetails: "",
                    itemRemoved: "✔ {itemName} wurde gelöscht.",
                    itemRemovedDetails: "",
                    itemSaveError: "✖ Änderungen konnten nicht gespeichert werden.",
                    itemSaveErrorDetails: "{error}",
                    generalError: "✖ Es ist ein Fehler aufgetreten.",
                    generalErrorDetails: "{error}",
                },

                validityChecks: {
                    badInput: "{label}: hat ungültige Eingabe",
                    customError: "{label}: {message}",
                    exceedsFilesLimit: "{label}: überschreitet Dateilimit",
                    fileNotUploaded: "{label}: Datei nicht hochgeladen",
                    fileSizeExceedsLimit: "{label}: Dateigröße überschreitet Limit",
                    fileTypeNotAllowed: "{label}: Dateityp nicht erlaubt",
                    invalidDate: "{label}: hat ungültiges Datum",
                    invalidTime: "{label}: hat ungültige Zeit",
                    patternMismatch: "{label}: entspricht nicht dem erwarteten Muster",
                    rangeOverflow: "{label}: ist zu groß",
                    rangeUnderflow: "{label}: ist zu klein",
                    stepMismatch: "{label}: entspricht nicht dem Schritt",
                    tooLong: "{label}: ist zu lang",
                    tooShort: "{label}: ist zu kurz",
                    typeMismatch: "{label}: hat ungültigen Typ",
                    valueMissing: "{label}: ist erforderlich",
                }
            },
            config.translatedMessages
        );

        this._messageTimer = null;
        this._debounceTimers = {};
        this._uploading = new Set();
        this._updatingSelector = false;
    }

    _mergeTranslations(defaults, overrides) {
        return {
            ...defaults,
            ...overrides,
            messageIds: {
                ...defaults.messageIds,
                ...overrides?.messageIds
            },
            validityChecks: {
                ...defaults.validityChecks,
                ...overrides?.validityChecks
            }
        };
    }

    /**
     * Initializes the editor, sets default schema values, and binds UI events.
     * @returns {void}
     */
    init() {
        console.log("Initializing CMS Editor for", this.cmsName, "with dataset", this.dataSetName);

        if (!this.ds) {
            console.error("Cannnot initialize CMS dataset ", this.dataSetName);
            return;
        }

        for (const [id, cfg] of Object.entries(this.cmsSchema)) this._initCMSConfig(id, cfg);
        for (const [key, cfg] of Object.entries(this.filterSchema)) this._initFilterConfig(key, cfg);

        this.ds.onReady(async () => {
            try {
                for (const cfg of Object.values(this.cmsSchema)) this._initCMSElement(cfg, $w, null, null);
                const boundIDs = new Set();
                for (const cfg of Object.values(this.filterSchema)) this._initFilterElement(cfg, $w, boundIDs, null, null);
                await this.refreshUI();
                const query = wixLocation.query;
                if (query.id)
                    await this.navigateTo(query.id);
                else {
                    //const options = this.itemSelector?.options;
                    //if (options?.length > 1) await this.navigateTo(options[1].value);
                }
            } catch (e) {
                console.error(e);
                throw e;
            }
        });

        this.ds.onError(async (error) => {
            await this.showMessage("generalError", this.ds.getCurrentItem(), true, { error });
        });

        this.itemSelector?.onChange(() => {
            if (this._updatingSelector) return;
            const val = this.itemSelector?.value;
            if (val == "--new--") this.newItem(); else this.navigateTo(val);
        });

        this.buttonSave?.onClick(() => this.saveItem());
        this.buttonRevert?.onClick(() => this.revertItem());
        this.buttonNew?.onClick(() => this.newItem());
        this.buttonRemove?.onClick(() => this.removeItem());
        this.buttonPrev?.onClick(() => this.navigateRelative(-1));
        this.buttonNext?.onClick(() => this.navigateRelative(1));
        this.buttonView?.onClick(() => this.showItem());

        this.updateSelectorList();
    }

    /**
     * Ensures defaults for CMS schema field config.
     * @param {string} id
     * @param {CmsFieldConfig} cfg
     */
    _initCMSConfig(id, cfg) {
        cfg.id ??= id;
        if (Array.isArray(cfg.fields) && cfg.fields.length >= 1)
            cfg.field = cfg.fields[0]; // if we have fields defined, field points to the first one
        else
            cfg.fields = this.ensureArray(cfg.field); // we have none or only one field
        if (!cfg.label) cfg.label = $w(cfg.id)?.label || cfg.field;
        cfg.elements = [];
        cfg.summaryLabel ??= cfg.label;
        cfg.diffLabel ??= cfg.label;
        cfg.visible ??= true;
        cfg.required ??= false;
        cfg.readOnly ??= false;
        cfg.delay ??= 500;
        cfg.prefix ??= "";
        cfg.suffix ??= "";
        cfg.collectDiff ??= true;
        cfg.collectSummary ??= true;
        cfg.showToUser ??= true;
        switch (cfg.type) {
            case FieldType.BOOLEAN:
                cfg.boolTrue ??= this._getTranslatedMessage("booolean_yes", cfg);
                cfg.boolFalse ??= this._getTranslatedMessage("booolean_no", cfg);
                break;
            case FieldType.NUMBER:
                cfg.fractionDigits ??= 0;
                cfg.minAllowed ??= null;
                cfg.maxAllowed ??= null;
                break;
            case FieldType.DATE:
                cfg.format ??= { hour: null, minute: null };
                break;
            case FieldType.DATE_RANGE:
                cfg.format ??= { hour: null, minute: null };
                cfg.minAllowed ??= null;
                cfg.maxAllowed ??= null;
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
            case FieldType.CUSTOM:
                cfg.onFormatCustomValue ??= (values) => values;
                cfg.onParseCustomUserInput ??= (value) => value;
                cfg.onCheckCustomHasValue ??= (item) => true;
                break;
            case FieldType.REPEATER:
                cfg.inputs ??= {};
                for (const [idSub, cfgSub] of Object.entries(cfg.inputs)) this._initCMSConfig(idSub, cfgSub);
                break;
        }
    }

    /**
     * Ensures defaults for filter schema config.
     * @param {string} key
     * @param {Object} cfg
     */
    _initFilterConfig(key, cfg) {
        cfg.id ??= key;
        cfg.fields ??= this.ensureArray(cfg.field);
        cfg.type ??= FilterType.EQ;
        cfg.orCombined ??= false;
        cfg.value ??= (val) => val;
        cfg.skip ??= (val) => val == null || val == "" || val == "*";
        cfg.delay ??= 500;
    }

    /**
     * Debounced binding helper for events on elements.
     * @param {*} trg
     * @param {*} scope
     * @param {CmsFieldConfig} cfg
     * @param {*} parentCfg
     * @param {*} masterArrayID
     * @param {string[]} events
     * @param {number} delay
     * @param {function():Promise<void>} callback
     */
    _bind(trg, scope, cfg, parentCfg, masterArrayID, events, delay, callback) {
        for (const s of events) if (typeof trg[s] == "function") {
            console.debug("Binding", s, "to", cfg.id);
            trg[s]((event) => {
                if (s != "onKeyPress" || event.key == "Enter") {
                    console.log("Triggering", s, "on", cfg.id, "with delay", delay);
                    if (this._debounceTimers[cfg.id]) clearTimeout(this._debounceTimers[cfg.id].timer);
                    const timer = setTimeout(callback, delay);
                    this._debounceTimers[cfg.id] = { timer, scope, cfg, parentCfg, masterArrayID };
                }
            });
        } else {
            //console.warn("Cannot bind", s, "to", id, ":", typeof trg[s]);
        }
    }

    async _initCMSElement(cfg, scope, parentCfg, masterArrayID) {
        const el = scope(cfg.id);
        if (!el) {
            console.warn("No such input element:", cfg.id);
            return;
        }
        if (el._cmsInitialized) return;
        el._cmsInitialized = true;

        if (cfg.resetButton) {
            const resetEl = scope(cfg.resetButton);
            if (resetEl.id) resetEl.onClick(async () => await this.resetField(cfg, scope, parentCfg, masterArrayID));
            else console.warn(cfg.resetButton, "not found in DOM");
        }

        if (cfg.type == FieldType.REPEATER) {
            el.onItemReady(($item, rowData) => {
                try {
                    console.log("onItemReady", { id: cfg.id, rowData });
                    for (const cfgSub of Object.values(cfg.inputs)) {
                        this._initCMSElement(cfgSub, $item, cfg, rowData._id);
                        this._updateUiFromData(cfgSub, $item, rowData, null, rowData._id);
                    }
                    if (cfg.removeButton) {
                        const elRemove = $item(cfg.removeButton);
                        if (elRemove.id) elRemove.onClick(async () => await this.removeRepeaterItem($item, cfg, rowData._id, masterArrayID));
                        else console.warn(cfg.removeButton, "not found in DOM");
                    }
                } catch (e) {
                    console.error(e);
                    throw e;
                }
            });
            if (cfg.addButton) {
                const addEl = scope(cfg.addButton);
                if (addEl.id) addEl.onClick(async () => await this.addRepeaterItem(scope, cfg, masterArrayID));
                else console.warn(cfg.addButton, "not found in DOM");
            }
            return;
        }

        this._bind(el, scope, cfg, parentCfg, masterArrayID, ["onBlur", "onKeyPress"], 0, () => this._updateDataFromUI(cfg, scope, parentCfg, masterArrayID));
        this._bind(el, scope, cfg, parentCfg, masterArrayID, ["onInput", "onChange"], cfg.delay, () => this._updateDataFromUI(cfg, scope, parentCfg, masterArrayID));
        //TODO onChange does not work for RichTextBox

        cfg.elements = [];
        const _find = (element) => {
            cfg.elements.push(element);
            if (element.children) for (const child of element.children) _find(child);
        }
        _find(el);
        console.log("elements for", cfg.id, ":", cfg.elements.map(e => e.type + ": " + e.id));

        cfg.titleElement = cfg.elements.find(c => (c.type == "$w.Text") && (c.id.toLowerCase().includes("name")));

        switch (cfg.type) {
            case FieldType.IMAGES:
                cfg.gallery = cfg.elements.find(c => c.type == "$w.Gallery");
                if (cfg.gallery) cfg.gallery.onItemClicked((event) => {
                    cfg.selIdx = event.itemIndex;
                    console.log("Selected media index on", cfg.id, ":", cfg.selIdx);
                    this._updateUiFromData(cfg, scope, this.ds.getCurrentItem(), null, masterArrayID); // just to update selection marker
                });

                for (const action of ["moveleft", "moveright", "remove"]) {
                    const btn = cfg.elements.find(c => (c.type == "$w.Button") && (c.id.toLowerCase().includes(action)));
                    if (btn) btn.onClick(async () => {
                        const { itemData, masterArray, values } = this._resolveContext(cfg, masterArrayID, parentCfg);
                        const val = this.ensureArray(values[0]);
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
                        await this._persistAndRefresh(cfg, scope, itemData, masterArray, [val], masterArrayID, parentCfg, true);
                    });
                }
                cfg.uploadButton = cfg.elements.find(c => c.type == "$w.UploadButton");
                this._bind(cfg.uploadButton, scope, cfg, parentCfg, masterArrayID, ["onChange"], 0, () => this._updateDataFromUI(cfg, scope, parentCfg, masterArrayID));
                break;

            case FieldType.IMAGE:
                cfg.image = cfg.elements.find(c => c.type == "$w.Image");
                cfg.uploadButton = cfg.elements.find(c => c.type == "$w.UploadButton");
                this._bind(cfg.uploadButton, scope, cfg, parentCfg, masterArrayID, ["onChange"], 0, () => this._updateDataFromUI(cfg, scope, parentCfg, masterArrayID));
                break;

            case FieldType.REFERENCE:
            case FieldType.MULTI_REFERENCE:
                if (cfg.dataSet) {
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
                break;

            case FieldType.NUMBER:
                if (cfg.minAllowed != null) {
                    if ("min" in el) el.min = cfg.minAllowed; else console.error("Cannot assign min to ", cfg.id);
                }
                if (cfg.maxAllowed != null) {
                    if ("max" in el) el.max = cfg.maxAllowed; else console.error("Cannot assign max to ", cfg.id);
                }
                break;

            case FieldType.DATE_RANGE:
                if (cfg.datePicker) {
                    this.postMessageToDatePicker(cfg, scope, { minDate: cfg.minAllowed, maxDate: cfg.maxAllowed });
                    const elPicker = scope(cfg.datePicker);
                    if (elPicker) elPicker.onMessage(async (event) => {
                        console.log("received message from picker for ", cfg.id, ":", event.data);
                        const { selectedDates, displayedMonth, displayedYear } = event.data || {};
                        if (selectedDates?.length == 2) {
                            await this._updateUiFromData(cfg, scope, this.ds.getCurrentItem(), selectedDates, masterArrayID);
                            await this._updateDataFromUI(cfg, scope, parentCfg, masterArrayID);
                        }
                        const changedDM = displayedMonth != null && displayedMonth != cfg.displayedMonth;
                        const changedDY = displayedYear != null && displayedYear != cfg.displayedYear;
                        if (changedDM || changedDY) {
                            cfg.displayedMonth = displayedMonth;
                            cfg.displayedYear = displayedYear;
                            await cfg.onDisplayedDateChanged?.();
                        }
                    });
                    else
                        console.error("Cannot find datePicker element", cfg.datePicker);
                }
                break;

            case FieldType.CAPTCHA:
                this._bind(el, scope, cfg, parentCfg, masterArrayID, ["onVerified", "onError", "onTimeout"], 0, () => this._updateDataFromUI(cfg, scope, parentCfg, masterArrayID));
                break;
        }
    }

    /**
     * Attach filter UI element event binding.
     * @param {*} cfg
     * @param {*} scope
     * @param {Set<string>} boundIDs
     * @param {*} parentCfg
     * @param {*} masterArrayID
     */
    _initFilterElement(cfg, scope, boundIDs, parentCfg, masterArrayID) {
        const el = scope(cfg.id);
        if (!el)
            console.warn("No such filter element:", cfg.id);
        else if (!boundIDs.has(cfg.id)) {
            boundIDs.add(cfg.id);
            this._bind(el, scope, cfg, parentCfg, masterArrayID, ["onBlur", "onKeyPress"], 0, () => this.updateSelectorList());
            this._bind(el, scope, cfg, parentCfg, masterArrayID, ["onInput", "onChange"], cfg.delay, () => this.updateSelectorList());
        }
    }

    /**
     * Synchronizes the UI with the current dataset item.
     * @returns {Promise<void>}
     */
    async refreshUI() {
        const item = this.ds.getCurrentItem();
        console.log("refreshUI", item);

        if (item) try {
            await Promise.all((Object.values(this.cmsSchema).filter(cfg => cfg.type == FieldType.MULTI_REFERENCE)).map(async (cfg) => {
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
            for (const cfg of Object.values(this.cmsSchema)) if (cfg.type == FieldType.REPEATER) {
                const now = Date.now();
                item[cfg.field] = (item[cfg.field] || []).map((d, i) => ({ ...d, _id: d._id || `row-${i}-${now}` }));
                await this.ds.setFieldValue(cfg.field, item[cfg.field]);
            }
        } catch (e) {
            console.error(e);
        }

        try {
            await Promise.all(Object.keys(this.cmsSchema).map(id => this._updateUiFromData(this.cmsSchema[id], $w, item, null, null)));
        } catch (e) {
            console.error(e);
        }
        console.log("refreshUI now", item);
        this.originalItem = item ? structuredClone(item) : null;
        for (const cfg of Object.values(this.cmsSchema)) if ("selIdx" in cfg) cfg.selIdx = -1;
        await this.onRefreshUI(this.originalItem);
        await this.updateSelectorList();
    }

    /**
     * Reads a value from a UI form control.
     * @private
     * @async
     * @param {CmsFieldConfig} cfg - The field config.
     * @param {function(string):$w.Element} scope - The scope function.
     * @param {Object} item - The current item.
     * @returns {Promise<{values:any[],needRefresh:boolean}>} the value converted to format suitable for CMS assignment
     */
    async _parseUiValue(cfg, scope, item) {
        if (!cfg) {
            console.error("Cannot assign from input: CMS schema not found in configuration")
            return { values: null, needRefresh: false };
        }

        const el = scope(cfg.id);
        if (!el || !el.id) {
            console.error("Cannot assign from input", cfg.id, ": Input element not found")
            return { values: null, needRefresh: false };
        }

        const parse = async () => {
            switch (cfg.type) {
                case FieldType.BOOLEAN:
                    return { val: el.checked };
                case FieldType.NUMBER:
                    return { val: Number(el.value ?? 0) };
                case FieldType.ADDRESS:
                    return { val: el.value };
                case FieldType.TIME_OF_DATE: {
                    let val = new Date(item?.[cfg.field]);
                    if (isNaN(val.getTime())) return { val: null };
                    const [hours, minutes] = (el.value?.toString() || "00:00").split(":");
                    val.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
                    return { val };
                }
                case FieldType.HOURS_OF_DATE: {
                    let val = new Date(item?.[cfg.field]);
                    if (isNaN(val.getTime())) return { val: null };
                    val.setHours(Number(el.value ?? 0), 0, 0, 0);
                    return { val };
                }
                case FieldType.DATE: {
                    return { val: this._updateDateKeepTime(el.value, item?.[cfg.field]) };
                }
                case FieldType.DATE_RANGE: {
                    return { val: (stringToDateRange(el.value) || []).map((dt, i) => this._updateDateKeepTime(dt, item?.[cfg.fields[i]])) };
                }
                case FieldType.MULTI_SELECT:
                case FieldType.MULTI_REFERENCE:
                    return { val: this.ensureArray(el.value) };
                case FieldType.STRING:
                    return { val: cfg.trim ? String(el.value).trim() : String(el.value) };
                case FieldType.IMAGE: {
                    if (cfg.uploadButton?.value?.length > 0 && !this._uploading.has(cfg.id)) try {
                        this._uploading.add(cfg.id);
                        const files = this.ensureArray(await cfg.uploadButton.uploadFiles());
                        const val = files[0].fileUrl;
                        cfg.uploadButton.reset();
                        return { val, needRefresh: true };
                    } finally {
                        this._uploading.delete(cfg.id);
                    }
                    return { val: item?.[cfg.field] };
                }
                case FieldType.IMAGES: {
                    if (cfg.uploadButton?.value?.length > 0 && !this._uploading.has(cfg.id)) try {
                        const files = this.ensureArray(await cfg.uploadButton.uploadFiles());
                        const val = [...this.ensureArray(item?.[cfg.field]), ...files.map((file, i) => this._createMediaStruct(cfg, i, file.fileUrl, file.fileName))];
                        cfg.uploadButton.reset();
                        return { val, needRefresh: true };
                    } finally {
                        this._uploading.delete(cfg.id);
                    }
                    return { val: item?.[cfg.field] };
                }
                case FieldType.CUSTOM:
                    try {
                        return { val: await cfg.onParseCustomUserInput?.(el.value) };
                    } catch (e) {
                        console.warn("Error in onParseCustomUserInput for", cfg.id, ":", e);
                        return { val: item?.[cfg.field] };
                    }
                //            case FieldType.REPEATER:
                //                return { val: this.ensureArray(item?.[cfg.field]) };
                case FieldType.CAPTCHA:
                    return { val: el.token }; //TODO only to detect change?
                case FieldType.TAGS:
                    return { val: el.value };
                default:
                    return { val: el.value };
            }
        };

        // if we have no fields, we expect no values at all,
        // if only one field is defined, we expect a single value,
        // otherwise we expect values for each defined field
        const { val, needRefresh = false } = await parse();
        const values = cfg.fields.length == 0 ? [] : cfg.fields.length > 1 ? val : [val];
        if (values.length != cfg.fields.length) {
            console.error("Unexpected number of values:", { values, cfg, scope, item, needRefresh, val, el_value: el.value });
        }
        return { values, needRefresh };
    }

    /**
     * Checks if a value of a UI form control has been entered.
     * @private
     * @async
     * @param {CmsFieldConfig} cfg - The field config.
     * @param {function(string):$w.Element} scope - The scope function.
     * @returns {boolean} true if a value has been entered, false if value is missing or invalid cfg
     */
    _hasUiValue(cfg, scope, item) {
        if (!cfg) {
            console.error("Cannot assign from input: CMS schema not found in configuration")
            return false;
        }

        const el = scope(cfg.id);
        if (!el || !el.id) {
            console.error("Cannot assign from input", cfg.id, ": Input element not found")
            return false;
        }

        switch (cfg.type) {
            case FieldType.BOOLEAN:
                return el.checked;
            case FieldType.IMAGE:
                return el.src != TRANSPARENT_PIXEL;
            case FieldType.IMAGES:
                return cfg.gallery && "items" in cfg.gallery && cfg.gallery.items.length > 0;
            case FieldType.CUSTOM:
                return !!cfg.onCheckCustomHasValue?.(item);
            case FieldType.REPEATER:
                return el.data.length > 0; //TODO resurse into elements?
            case FieldType.CAPTCHA:
                return !!el.token;
            case FieldType.TAGS:
                return this.ensureArray(el.value).length > 0;
            default:
                return el.value !== null && el.value !== undefined && el.value !== "";
        }
    }


    /**
     * Resolves editing item context for (repeater) nested fields.
     * @param {CmsFieldConfig} cfg
     * @param {string|null} masterArrayID
     * @param {CmsFieldConfig|null} parentCfg
     * @returns {{itemData:Object|null,masterArray:Array|null,values:any[]}}
     */
    _resolveContext(cfg, masterArrayID, parentCfg) {
        const item = this.ds.getCurrentItem();
        if (parentCfg == null || masterArrayID == null)
            return { itemData: item, masterArray: null, values: cfg.fields.map(f => item?.[f]) };

        const masterArray = [...this.ensureArray(item[parentCfg.field])];
        const idx = masterArray.findIndex(v => v._id == masterArrayID);
        if (idx == -1) {
            console.error("Cannot find masterArrayID", { cfg, masterArray, masterArrayID, parentCfg });
            return { itemData: null, masterArray, values: null };
        }
        const itemData = masterArray[idx];
        return { itemData, masterArray, values: cfg.fields.map(f => itemData?.[f]) };
    }

    /**
     * Persist field changes to dataset and update UI+validation.
     * @param {CmsFieldConfig} cfg
     * @param {*} scope
     * @param {Object|null} itemData
     * @param {Array|null} masterArray
     * @param {Array} values
     * @param {string|null} masterArrayID
     * @param {CmsFieldConfig|null} parentCfg
     * @param {boolean} needRefresh
     */
    async _persistAndRefresh(cfg, scope, itemData, masterArray, values, masterArrayID, parentCfg, needRefresh) {
        console.info("_persistAndRefresh", { cfg, scope, itemData, masterArray, values, masterArrayID, parentCfg, needRefresh });
        if (masterArray != null && masterArrayID != null) {
            const idx = masterArray.findIndex(v => v._id == masterArrayID);
            if (idx == -1)
                console.error("Cannot find masterArrayID", { cfg, scope, itemData, masterArray, values, masterArrayID, parentCfg, needRefresh });
            else {
                masterArray[idx] = { ...masterArray[idx] };
                for (let i = 0; i < cfg.fields.length; i++)
                    masterArray[idx][cfg.fields[i]] = values[i];
                itemData = masterArray[idx];
                await this.ds.setFieldValue((parentCfg || cfg).field, masterArray);
            }
        } else {
            for (let i = 0; i < cfg.fields.length; i++)
                await this.ds.setFieldValue(cfg.fields[i], values[i]);
            itemData = this.ds.getCurrentItem(); // update after using setFieldValue
        }

        await cfg.onChanged?.(itemData, values[0]);
        await parentCfg?.onChanged?.(itemData, masterArray || values[0]);

        if (needRefresh)
            await this._updateUiFromData(cfg, scope, itemData, values, masterArrayID);
        else
            await this._validate(cfg, scope, itemData);

        for (const sameLevelCfg of parentCfg ? Object.values(parentCfg.inputs) : Object.values(this.cmsSchema))
            if (sameLevelCfg != cfg) await this._validate(sameLevelCfg, scope, itemData);

        await this.updateButtonStates();
    }

    async updateDataFromUI(id) {
        await this._updateDataFromUI(this.cmsSchema[id], $w, null, null);
    }

    /**
     * Read UI values, detect change, and persist to dataset.
     * @param {CmsFieldConfig} cfg
     * @param {*} scope
     * @param {*} parentCfg
     * @param {string|null} masterArrayID
     */
    async _updateDataFromUI(cfg, scope, parentCfg, masterArrayID) {
        const wasTouched = cfg._touched;
        cfg._touched = true;
        const { itemData, masterArray, values: curVal } = this._resolveContext(cfg, masterArrayID, parentCfg);
        const { values, needRefresh } = await this._parseUiValue(cfg, scope, itemData);
        if (JSON.stringify(values ?? "") == JSON.stringify(curVal ?? "")) {
            console.debug(`No change in UI ${cfg.id} for field ${cfg.field}${masterArrayID == null ? "" : ` at ${masterArrayID}`}`);
            if (!wasTouched) this._validate(cfg, scope, itemData); // now missing values on required fields shall trigger error
        } else {
            console.log(`Writing UI ${cfg.id} to field ${cfg.fields}${masterArrayID == null ? "" : ` at ${masterArrayID}`} with value:`, values);
            await this._persistAndRefresh(cfg, scope, itemData, masterArray, values, masterArrayID, parentCfg, needRefresh || masterArray);
        }
    }

    /**
     * Reset field to default value and persist.
     * @param {CmsFieldConfig} cfg
     * @param {*} scope
     * @param {*} parentCfg
     * @param {string|null} masterArrayID
     */
    async resetField(cfg, scope, parentCfg, masterArrayID) {
        console.log("resetField for", cfg.id);
        cfg._touched = false;
        const { itemData, masterArray, values: curVal } = this._resolveContext(cfg, masterArrayID, parentCfg);
        const values = [cfg.default];
        if (JSON.stringify(values ?? "") == JSON.stringify(curVal ?? "")) {
            console.debug(`Already in reset state ${cfg.id} for field ${cfg.field}${masterArrayID == null ? "" : ` at ${masterArrayID}`}`);
            return;
        }

        console.log(`Resetting UI ${cfg.id} to field ${cfg.fields}${masterArrayID == null ? "" : ` at ${masterArrayID}`} with value:`, values);
        await this._persistAndRefresh(cfg, scope, itemData, masterArray, values, masterArrayID, parentCfg, true);
    }

    /**
     * Add row to repeater array and persist.
     * @param {*} scope
     * @param {CmsFieldConfig} cfg
     * @param {string|null} masterArrayID
     */
    async addRepeaterItem(scope, cfg, masterArrayID) {
        console.log("addRepeaterItem for", cfg.id);
        const { itemData, masterArray, values } = this._resolveContext(cfg, masterArrayID, null);
        console.info({ scope, cfg, masterArrayID, itemData, masterArray, values });
        const newItem = { _id: `row-${values[0].length}-${Date.now()}` };
        for (const subCfg of Object.values(cfg.inputs)) newItem[subCfg.field] ??= subCfg.default;
        const newValues = [[...values[0], newItem]];
        await this._persistAndRefresh(cfg, scope, itemData, masterArray, newValues, masterArrayID, null, true);
    }

    /**
     * Remove row from repeater array and persist.
     * @param {*} scope
     * @param {CmsFieldConfig} cfg
     * @param {string} id
     * @param {string|null} masterArrayID
     */
    async removeRepeaterItem(scope, cfg, id, masterArrayID) {
        console.log("removeRepeaterItem from", cfg.id, "with id", id);
        const { itemData, masterArray, values } = this._resolveContext(cfg, masterArrayID, null);
        console.info({ scope, cfg, id, masterArrayID, itemData, masterArray, values });
        const newValues = [values[0].filter(v => v._id != id)];
        await this._persistAndRefresh(cfg, scope, itemData, masterArray, newValues, masterArrayID, null, true);
    }

    /**
     * Write values from model into UI controls.
     * @param {CmsFieldConfig} cfg
     * @param {*} scope
     * @param {Object} item
     * @param {any[]} valuesToUse
     * @param {string|null} masterArrayID
     */
    async _updateUiFromData(cfg, scope, item, valuesToUse, masterArrayID) {
        if (!cfg) {
            console.error("Cannot assign to input: CMS schema not found in configuration")
            return;
        }

        const el = scope(cfg.id);
        if (!el || !el.id) {
            console.error("Cannot assign to input", cfg.id, ": Input element not found")
            return;
        }

        const prevValue = el.value;
        const values = valuesToUse ?? cfg.fields.map(f => item?.[f]);
        let val0 = values[0];
        let done = false;
        switch (cfg.type) {
            case FieldType.BOOLEAN:
                val0 = !!val0;
                if ("checked" in el) {
                    el.checked = val0;
                    done = true;
                }
                break;
            case FieldType.ADDRESS:
                val0 = val0 && typeof val0 == "object" ? val0 : { formatted: "" };
                break;
            case FieldType.TIME_OF_DATE:
                if (val0 != null) {
                    const dt = new Date(val0);
                    // local time
                    val0 = this._padTime(dt.getHours()) + ":" + this._padTime(dt.getMinutes());
                } else
                    val0 = "";
                break;
            case FieldType.HOURS_OF_DATE:
                if (val0 != null) {
                    const dt = new Date(val0);
                    // local time
                    val0 = dt.getHours();
                    if ("options" in el) { //TODO if no fitting, use the next smaller / greater depending on cfg.roundUp (TODO naming?)
                        const idx = el.options.findIndex(opt => opt.value == val0);
                        if (idx != -1) val0 = el.options[idx].value;
                    }
                }
                break;
            case FieldType.DATE:
                if (val0) val0 = new Date(val0);
                if (val0 && isNaN(val0.getTime())) val0 = null;
                break;
            case FieldType.DATE_RANGE:
                val0 = dateRangeToString(values[0], values[1], cfg.format);
                //TODO really assign to val0?
                this.postMessageToDatePicker(cfg, scope, { utcDates: values[0] && values[1] ? [new Date(values[0]), new Date(values[1])] : [null, null] });
                break;
            case FieldType.IMAGE:
                val0 ||= TRANSPARENT_PIXEL;
                if (cfg.image && "src" in cfg.image) {
                    cfg.image.src = val0;
                    done = true;
                }
                break;
            case FieldType.IMAGES:
                val0 = this.ensureArray(val0).map((v, i) => this._createMediaStruct(cfg, i, v));
                if (cfg.gallery && "items" in cfg.gallery) {
                    cfg.gallery.items = val0;
                    if (cfg.gallery.items.length == 0) cfg.gallery.collapse(); else cfg.gallery.expand();
                    done = true;
                }
                break;
            case FieldType.CUSTOM:
                try {
                    val0 = await cfg.onFormatCustomValue?.(values);
                } catch (e) {
                    console.warn("Error in onFormatCustomValue for", cfg.id, ":", e);
                    val0 = null;
                }
                break;
            case FieldType.REPEATER:
                val0 = this.ensureArray(val0);
                el.data = []; // force refresh
                el.data = val0;
                done = true;
                break;
            case FieldType.CAPTCHA:
                done = true; // Captcha only supports UI -> database direction
                break;
        }
        if (!done) {
            // if no special set function has been used, try to use the default 
            if ("value" in el)
                el.value = val0;
            else
                console.error("Cannot assign to UI", cfg.id, "from field", cfg.field, ": No 'value' property")
        }
        //values[0] = val0; TOODO needed as a side effect? hopefully not
        const newValue = el.value;
        const s0 = JSON.stringify(prevValue);
        const s1 = JSON.stringify(newValue);
        if (s0 == s1)
            console.debug(`No change in data of UI ${cfg.id} for field ${cfg.field}${masterArrayID == null ? "" : ` at ${masterArrayID}`}:`, s0);
        else
            console.log(`Updated UI ${cfg.id} from field ${cfg.field}${masterArrayID == null ? "" : ` at ${masterArrayID}`} with value:`, newValue, "was:", prevValue, { s0, s1 });

        const btn = cfg.linkButton ? scope(cfg.linkButton) : null;
        if (btn && btn.id) {
            if (val0) btn.link = `${cfg.linkPrefix ?? ""}${val0}`;
            this._setEnabled(btn, val0);
            btn.target = "_blank";
        }

        await this._validate(cfg, scope, item);
    }

    /**
     * Creates structure for media item for galleries.
     * @param {CmsFieldConfig} cfg
     * @param {number} idx
     * @param {string|Object} v
     * @param {string|null} namePart
     * @returns {Object}
     */
    _createMediaStruct(cfg, idx, v, namePart = null) {
        return typeof v != "string"
            ? { ...v, description: idx == cfg.selIdx ? "✅" : "" }
            : {
                src: v,
                title: namePart ?? (v.split("/").pop()?.split("?")[0] || ""),
                type: /\.(mp4|mov|webm|video)/i.test(v) ? "video" : "image",
                description: idx == cfg.selIdx ? "✅" : "",
            };
    }

    /**
     * Formats the value from in item for diff or summary output.
     * @param {CmsFieldConfig} cfg
     * @param {*} scope
     * @param {Object} item
     * @returns {string}
     */
    _printValue(cfg, scope, item, values) {
        if (!cfg) return "";
        if (cfg.onPrintValue) return cfg.onPrintValue(item);
        if (!item) return "";
        const val0 = values[0];
        const formatters = {
            [FieldType.BOOLEAN]: () => val0 ? cfg.boolTrue : cfg.boolFalse,
            [FieldType.NUMBER]: () => Number(val0).toLocaleString("de-DE", { minimumFractionDigits: cfg.fractionDigits }),
            [FieldType.ADDRESS]: () => val0.formatted || "",
            [FieldType.DATE]: () => dateRangeToString(val0, null, cfg.format),
            [FieldType.DATE_RANGE]: () => dateRangeToString(val0, values[1], cfg.format),
            [FieldType.HOURS_OF_DATE]: () => {
                const hours = new Date(val0).getHours();
                return val0 ? (scope(cfg.id)?.options?.find(opt => opt.value == hours)?.label ?? `${this._padTime(hours)}:00`) : "";
            },
            [FieldType.TIME_OF_DATE]: () => val0 ? `${this._padTime(new Date(val0).getHours())}:${this._padTime(new Date(val0).getMinutes())}` : "",
            [FieldType.MULTI_SELECT]: () => this.ensureArray(val0).join("\n"),
            [FieldType.IMAGE]: () => this._extractFileName(val0),
            [FieldType.IMAGES]: () => this.ensureArray(val0).map((img) => this._extractFileName(img?.src || img?.fileUrl || "")).join("\n"),
            [FieldType.CUSTOM]: () => cfg.onFormatCustomValue?.(values),
            [FieldType.TAGS]: () => this.ensureArray(val0).map(v => scope(cfg.id)?.options?.find(opt => opt.value == v)?.label).join("\n"),
        };
        const res = val0 == null ? null : (formatters[cfg.type] || (() => String(val0)))();
        return res != null ? `${cfg.prefix}${res}${cfg.suffix}` : "";
    }

    /**
     * Extracts the file name from a URL or path.
     * @param {string} url - The URL or path to extract the file name from.
     * @returns {string} The extracted file name.
     */
    _extractFileName(url) {
        return url ? url.split('/').pop()?.split('#')[0] || url : "";
    }

    /**
     * Compare original item and current item for changed fields.
     * @param {*} scope
     * @returns {{diffIntern:any[],diffUser:any[]}}
     */
    getDiff(scope) {
        const item = this.ds.getCurrentItem();
        const caption = [
            { label: this._getTranslatedMessage("diff_caption", {}, item), align: "right", bold: true },
            { label: this._getTranslatedMessage("diff_from", {}, item), align: "right", bold: true },
            { label: "", align: "center" },
            { label: this._getTranslatedMessage("diff_to", {}, item), bold: true },
        ];
        const diff = { diffIntern: [caption], diffUser: [caption], hasChanges: false };
        for (const cfg of Object.values(this.cmsSchema)) {
            if (cfg.collectDiff) {
                const orgVal = cfg.fields.map(f => this.originalItem?.[f] ?? "");
                const curVal = cfg.fields.map(f => item?.[f] ?? "");
                if (JSON.stringify(orgVal) != JSON.stringify(curVal)) {
                    const vOrg = this._printValue(cfg, scope, this.originalItem, orgVal);
                    const vCur = this._printValue(cfg, scope, item, curVal);
                    const row = [
                        (typeof cfg.diffLabel == "function" ? cfg.diffLabel(item, vOrg, vCur) : cfg.diffLabel) + ":",
                        vOrg,
                        { value: "->", bold: true },
                        vCur];
                    diff.hasChanges = true;
                    diff.diffIntern.push(row);
                    if (cfg.showToUser) diff.diffUser.push(row);
                }
            }
        }
        this.lastDiff = diff;
        return diff;
    }

    /**
     * List all fields.
     * @param {*} scope
     * @param {Object} item
     * @param {boolean} [onlyShowToUserFields=false] if true, only fields with showToUser == true will be returned
     * @returns {Promise<any[]>}
     */
    getSummary(scope, item, onlyShowToUserFields = false, formatHTML = null) {
        const res = [
            [
                { label: this._getTranslatedMessage("input_caption", {}, item), align: "right", bold: true },
                { label: this._getTranslatedMessage("input_value", {}, item), bold: true },
            ]
        ];
        for (const cfg of Object.values(this.cmsSchema))
            if (cfg.collectSummary && (!onlyShowToUserFields || cfg.showToUser)) res.push(
                [
                    {
                        color: cfg.lastValidationFailed ? "#E74C3C" : formatHTML?.color ?? "",
                        value: (typeof cfg.summaryLabel == "function" ? cfg.summaryLabel() : cfg.summaryLabel) + ":"
                    },
                    {
                        color: cfg.lastValidationFailed ? "#E74C3C" : formatHTML?.color ?? "",
                        value: this._printValue(cfg, scope, item, cfg.fields.map(f => item?.[f]))
                    }
                ]
            );
        return res;
    }

    /**
     * Executes pending debounced update timers.
     * @param {boolean} [update=true]
     */
    async flushDebounce(update = true) {
        await Promise.all(Object.keys(this._debounceTimers).map(async (id) => {
            const ctx = this._debounceTimers[id];
            if (ctx) {
                clearTimeout(ctx.timer);
                this._debounceTimers[id] = null;
                if (update) await this._updateDataFromUI(ctx.cfg, ctx.scope, ctx.parentCfg, ctx.masterArrayID);
            }
        }));
    }

    /**
     * Saves the current item through dataset and handles references.
     * @returns {Promise<Object|false>}
     */
    async saveItem() {
        this.isSaving = true;
        let savedItem = null;
        try {
            await this.flushDebounce();
            const item = this.ds.getCurrentItem();
            console.debug(`saveItem:\n${JSON.stringify(item, null, 2)}`);
            for (const cfg of Object.values(this.cmsSchema)) cfg._touched = true; //TODO recurse? also on other places?

            let allErrors = [];
            for (const cfg of Object.values(this.cmsSchema)) allErrors.push(...await this._validate(cfg, $w, item));
            if (allErrors.length > 0) {
                await this.showMessage("itemSaveError", item, true, { allErrors, error: allErrors.join("\n") });
                await this.updateButtonStates();
                return false;
            }
            await this.updateButtonStates();

            this.collapseResponse();
            this.getDiff($w);
            console.log("saveItem diff:", this.lastDiff.diffIntern);
            const beforeSafeResult = await this.onBeforeSave(item);
            if (beforeSafeResult == null) return false;
            savedItem = await this.ds.save();
            if (savedItem) for (const cfg of Object.values(this.cmsSchema))
                if (cfg.type == FieldType.MULTI_REFERENCE) {
                    const val = this.ensureArray($w(cfg.id)?.value);
                    console.log("saveItem replaceReferences", cfg.field, savedItem._id, val);
                    await wixData.replaceReferences(this.cmsName, cfg.field, savedItem._id, val);
                }
            console.log("item saved");
            this.onAfterSave(beforeSafeResult);
            await this.showMessage("itemSaved", item);
            await this.refreshUI();
        } finally {
            this.isSaving = false;
            await this.updateButtonStates();
        }
        return savedItem;
    }

    /**
     * Revert changes on dataset item and refresh UI.
     */
    async revertItem() {
        console.log("revertItem");
        await this.flushDebounce(false);
        this.collapseResponse();
        await this.ds.revert();
        console.log("item reverted");
        this.onAfterReverted();
        await this.showMessage("itemReverted", this.ds.getCurrentItem());
        for (const cfg of Object.values(this.cmsSchema)) cfg._touched = false; //TODO recurse? also on other places?
        await this.refreshUI();
    }

    /**
     * Create new item after saving current.
     */
    async newItem() {
        console.log("newItem");
        this.getDiff($w);
        if (!this.lastDiff.hasChanges || await this.saveItem()) {
            console.log("item saved before creating new item");
            const newItem = await this.ds.new();
            console.log("item created");
            await this.showMessage("itemCreated", newItem);
            await this.refreshUI();
            for (const cfg of Object.values(this.cmsSchema)) cfg._touched = false; //TODO recurse? also on other places?
        } else
            console.warn("New item aborted: Save failed.");
    }

    /**
     * Remove item and select next/previous.
     */
    async removeItem() {
        console.log("removeItem");
        await this.flushDebounce();
        this.collapseResponse();
        const itemToDelete = this.ds.getCurrentItem();

        let nextId = null;
        const options = this.itemSelector?.options;
        if (options) {
            const idx = options.findIndex(opt => opt.value == itemToDelete._id);
            nextId = idx != -1 && idx < options.length - 1 ? options[idx + 1].value : idx > 0 ? options[idx - 1].value : null;
        };

        await this.ds.remove();
        console.log("item removed");
        this.onAfterDelete(itemToDelete);
        await this.showMessage("itemRemoved", itemToDelete);
        if (!nextId || nextId == "--new--") this.newItem(); else this.navigateTo(nextId);
    }

    /**
     * Shows the current item in reader mode in a new window.
     */
    showItem() {
        const item = this.ds.getCurrentItem();
        const url = `/${this.viewModeURL}/${item?._id}`;
        console.log("Showing item:", url);
        if (item && item._id) wixLocation.to(url, { target: '_blank' });
    }

    /**
     * Change selector by offset.
     * @param {number} offset
     */
    navigateRelative(offset) {
        console.log("navigateRelative", offset);
        const currentId = this.ds.getCurrentItem()?._id;
        const options = this.itemSelector?.options;
        if (options) {
            const idx = options.findIndex(opt => opt.value == currentId);
            const nextIdx = idx == -1 ? -1 : idx + offset;
            this.navigateTo(nextIdx < 0 || nextIdx >= options.length ? null : options[nextIdx].value);
        }
    }

    /**
     * Navigate to item ID from selector.
     * @param {string|null} id
     */
    async navigateTo(id) {
        console.log("navigateTo", id);
        if (id && id != "--new--") {
            const result = await this.ds.getItems(0, this.ds.getTotalCount());
            const index = result.items.findIndex(item => item._id == id);
            if (index != -1) {
                console.log("navigateTo item index", index);
                await this.ds.setCurrentItemIndex(index);
                await this.refreshUI();
                console.log("navigated to item");
            } else {
                console.error("navigateTo cannot find among", result.items.length, "items");
            }
        } else
            console.warn("navigateTo will ignore entry", id);
    }

    /**
     * Query dataset based on filter inputs and update selector options.
     */
    async updateSelectorList() {
        console.log("updateSelectorList");
        if (!this.itemSelector) {
            console.log("no itemSelector");
            return;
        }

        let q = wixData.query(this.cmsName);

        for (const cfg of Object.values(this.filterSchema)) {
            const applyOp = (q, f, v) => {
                switch (cfg.type) {
                    case FilterType.EQ: return q.eq(f, v);
                    case FilterType.CONTAINS: return q.contains(f, v);
                    case FilterType.GE: return q.ge(f, v);
                    case FilterType.LE: return q.le(f, v);
                    case FilterType.HAS_SOME: return q.hasSome(f, this.ensureArray(v));
                    case FilterType.IS_NOT_EMPTY: return q.isNotEmpty(f);
                    default: return q;
                }
            };

            const el = $w(cfg.id);
            if (!el && cfg.type != FilterType.IS_NOT_EMPTY) continue;

            const val = "checked" in el ? el.checked : el.value;
            if (cfg.skip(val)) continue;

            const pVal = cfg.value(val);
            switch (cfg.combine) {
                case FilterCombine.OR:
                    // ONE value vs MANY fields (OR)
                    let qOr = null;
                    for (let i = 0; i < cfg.fields.length; i++) {
                        const qI = applyOp(wixData.query(this.cmsName), cfg.fields[i], pVal);
                        qOr = i == 0 ? qI : qOr.or(qI);
                    }
                    if (qOr) q = q.and(qOr);
                    break;
                case FilterCombine.PARALLEL_AND:
                    // Parallel Mapping (Many-to-Many)
                    if (!Array.isArray(pVal) || cfg.fields.length != pVal.length) {
                        console.error("Unexpected result from value() function: Expected array of equal length as cfg.fields", { pVal, cfg });
                    } else
                        q = cfg.fields.reduce((q0, f, i) => applyOp(q0, f, pVal[i]), q);
                    break;
                case FilterCombine.AND:
                default:
                    // Broadcasting (One-to-Many) or Standard (One-to-One)
                    q = cfg.fields.reduce((q0, f) => applyOp(q0, f, pVal), q);
                    break;
            }
            if (cfg.fields.length > 1 && Array.isArray(pVal) && pVal.length == cfg.fields.length) { }
        }

        q = this.filterSortAscending ? q.ascending(this.filterSortField) : q.descending(this.filterSortField);
        q = q.limit(this.filterLimit);

        if (this.itemSelector) try {
            console.debug(`updateSelectorList query:\n${JSON.stringify(q, null, 2)}`);
            const res = await q.find();
            //console.debug(`updateSelectorList result:\n${JSON.stringify(res, null, 2)}`);
            this._updatingSelector = true;
            this.itemSelector.options = [
                { label: this._getTranslatedMessage("itemSelector_createNew"), value: "--new--" },
                ...res.items.map(item => ({ label: this.generateTitle(item), value: item._id }))
            ];
            this.itemSelector.value = this.ds.getCurrentItem()?._id;
            this._updatingSelector = false;
            await this.updateButtonStates();
        } catch (err) {
            console.error("updateSelectorList failed", err);
            this._updatingSelector = false;
            } else
            await this.updateButtonStates();
    }

    /**
     * Validate a field against it's user input.
     * @param {CmsFieldConfig} cfg
     * @param {*} scope
     * @param {Object} item
     * @returns {Promise<string[]>} - Empty array means no errors
     */
    async _validate(cfg, scope, item) {
        if (!cfg) {
            console.error("Cannot validate input: CMS schema not found in configuration")
            return [this._getTranslatedMessage("error_no_config", cfg, item, null, {}, { color: "#E74C3C" })];
        }
        let el = scope(cfg.id);
        if (el && !el.id) {
            console.error("Unexpected element type -- no 'id' attribute", { el, scope, cfg })
            el = null;
        }

        const visible = typeof cfg.visible == "function" ? await cfg.visible(item) : cfg.visible;
        const required = typeof cfg.required == "function" ? await cfg.required(item) : cfg.required;
        const readOnly = typeof cfg.readOnly == "function" ? await cfg.readOnly(item) : cfg.readOnly;
        console.info("validate", { cfg, scope, item, el, visible, required, readOnly });

        // process "visible" attribute
        if (visible === true) el?.expand();
        if (visible === false) el?.collapse();

        // process "required" attribute //TODO does not work for RichTextBox or SelectionTags
        if (el && (required === true || required === false)) {
            if ("label" in el) el.label = el.label.replaceAll(" *", "") + (required ? " *" : "");
            if (cfg.titleElement) cfg.titleElement.text = cfg.titleElement.text.replaceAll(" *", "") + (required ? " *" : "");
        }

        // process "readOnly" attribute
        this._setEnabled(el, !readOnly);
        for (const sub of cfg.elements) this._setEnabled(sub, !readOnly);

        if (visible === false) return []; // treat invisible as valid 
        if (readOnly === true) return [];  // treat readonly as valid 

        const errors = [];
        let validity = {}
        if (cfg._touched) { // ignore until the user touched this field
            const { values } = await this._parseUiValue(cfg, scope, item);
            const customErrorMessage = await cfg.onCustomValidation?.(item, values);
            validity = { ...el.validity };
            validity.customError = !!customErrorMessage; // we overwrite onCustomValidation, so ignore the one from el.validity
            validity.valueMissing ||= cfg.required && !this._hasUiValue(cfg, scope, item);
            validity.rangeUnderflow ||= cfg.minAllowed != null && (values.some((v) => v != null && !Number.isNaN(v) && v < cfg.minAllowed));
            validity.rangeOverflow ||= cfg.maxAllowed != null && (values.some((v) => v != null && !Number.isNaN(v) && v > cfg.maxAllowed));
            //validity.badInput ||= numericValues.some(v => v !== null && Number.isNaN(v)); //TODO support ?

            for (const [attr, failure] of Object.entries(validity)) if (attr != "valid" && failure)
                errors.push(this._getTranslatedMessage(attr, cfg, item, this.translatedMessages.validityChecks, {
                    message: customErrorMessage || this._getTranslatedMessage("no_validationMessage", cfg, item, null, {})
                }));
            console.info("_validate", { values, customErrorMessage, validity, errors });
            if (errors.length == 0) {
                console.info("UI Validation succeeded for UI", cfg.id, ":", { values, validity, value: el.value });
                if (el.setCustomValidity) el.setCustomValidity("");
                if (el.onCustomValidation) el.onCustomValidation((_1, _2) => { });
            } else {
                console.warn("UI Validation failed for UI", cfg.id, ":", { values, validity, value: el.value, customErrorMessage, errors });
                if (el.setCustomValidity) el.setCustomValidity(errors.join(", "));
                if (el.onCustomValidation) el.onCustomValidation((_, reject) => { reject(errors.join(", ")) });
            }

            if (el.updateValidityIndication)
                el.updateValidityIndication();
            else {
                if (el.style) el.style.borderColor = errors.length == 0 ? "rgba(0,0,0,0)" : "#E74C3C";
                if (cfg.titleElement) cfg.titleElement.html = `<p${this._clsStyle({ color: errors.length == 0 ? "" : "#E74C3C" })}>${cfg.titleElement.text}</p>`;
            }
        }

        if (cfg.type == FieldType.REPEATER) {
            const promises = [];
            el.forEachItem(($item, itemData) => {
                for (const cfgSub of Object.values(cfg.inputs))
                    promises.push(this._validate(cfgSub, $item, itemData).then(subErrors => { errors.push(...subErrors) }));
            });
            await Promise.all(promises);
        }

        cfg.lastValidationFailed = errors.length > 0;
        return errors;
    }

    /**
     * Toggle buttons based on current item state.
     */
    async updateButtonStates() {
        const currentIndex = this.itemSelector?.selectedIndex;
        const totalCount = this.itemSelector?.options?.length;

        const hasChanges = this.getDiff($w).hasChanges;

        const isNew = !this.ds.getCurrentItem()?._createdDate;
        const isBusy = this.isSaving;
        const allValid = true; // Object.values(this.cmsSchema).every(cfg => !cfg.lastValidationFailed); TODO

        console.log("updateButtonStates", { currentIndex, totalCount, hasChanges, diffIntern: this.lastDiff.diffIntern, isNew, isBusy, allValid });
        this._setEnabled(this.buttonSave, !isBusy && hasChanges && allValid);
        this._setEnabled(this.buttonRevert, !isBusy && hasChanges);
        this._setEnabled(this.buttonNew, !isBusy && !isNew);
        this._setEnabled(this.buttonRemove, !isBusy && !isNew);
        this._setEnabled(this.buttonPrev, !isBusy && !hasChanges && currentIndex > 1); // don't navigate to -- new--
        this._setEnabled(this.buttonNext, !isBusy && !hasChanges && currentIndex < totalCount - 1);
        this._setEnabled(this.itemSelector, !isBusy && !hasChanges);
    }

    _setEnabled(element, enabled) {
        if (enabled === true && element && "enable" in element) element.enable();
        if (enabled === false && element && "disable" in element) element.disable();
    }

    /**
     * Display status or error message in response field and modal dialog.
     * @param {string} msgId one of the (without Details suffix) IDs as defined in this.translatedMessages.messageIds
     * @param {Object} item
     * @param {boolean} [isError=false] true to color the message in red
     * @param {Object} [replacements={}]
     */
    async showMessage(msgId, item = {}, isError = false, replacements = {}) {
        const message = this.messages[msgId] ?? {};

        const sMsg = this._getTranslatedMessage(msgId, {}, item, this.translatedMessages.messageIds, replacements, { color: isError ? "#E74C3C" : "#2ECC71", align: "center" });
        const sDetails = this._getTranslatedMessage(msgId + "Details", {}, item, this.translatedMessages.messageIds, replacements, {});

        const canSendMail = message?.emailId && item.email;
        const emailOptions = canSendMail ? await (message?.onGenerateEmailOptions ?? this.onGenerateEmailOptions)?.(item, message.emailId) : {}

        console.log("showMessage", { msgId, isError, message, sMsg, sDetails, canSendMail, emailOptions });

        if (canSendMail && message?.automaticMail)
            sendMail(message.emailId, item, emailOptions || {});

        if (this.textResponse) this.textResponse.html = sMsg;
        this.textResponse?.show();
        this.textResponse?.expand();
        if (this._messageTimer) clearTimeout(this._messageTimer);
        this._messageTimer = setTimeout(() => { this.collapseResponse(); }, 20000);

        if (message?.dialog !== false) wixWindow.openLightbox("CMSEditorLightbox", {
            emailId: canSendMail && !message?.automaticMail ? message.emailId : null,
            emailOptions,
            emailCustomizable: canSendMail && message?.customizableMail,
            item,
            msg: sMsg,
            details: sDetails,
        });
    }

    /**
     * Hide response message from response field. Does not affect any opened modal dialog.
     */
    collapseResponse() {
        if (this.collapseTextResponse) this.textResponse?.collapse(); else this.textResponse?.hide();
        if (this._messageTimer) {
            clearTimeout(this._messageTimer);
            this._messageTimer = null;
        }
    }

    /**
     * If val already is an array, returns it, 
     * if val is null, returns [],
     * else returns val as a single-length array.
     * @param {*} val
     * @returns {*[]}
     */
    ensureArray(val) {
        if (Array.isArray(val)) return val;
        if (val == null) return [];
        return [val];
    }

    /**
     * Update date keeping time part from old value.
     * @param {Date} local
     * @param {Date} oldVal
     * @returns {Date|null}
     */
    _updateDateKeepTime(local, oldVal) {
        if (!local || isNaN(new Date(local).getTime())) return null;
        const prev = oldVal ? new Date(oldVal) : null;
        const res = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), 0, 0, 0, 0));
        if (prev)
            res.setUTCHours(prev.getUTCHours(), prev.getUTCMinutes(), prev.getUTCSeconds(), 0);
        return res;
    }

    /**
     * Return a 0 padded two-digit version.
     * @param {any} v
     * @returns {string}
     */
    _padTime(v) {
        return v ? v.toString().padStart(2, "0") : "00";
    }

    _clsStyle(v) {
        return ` class="font_7" style="${v.padding ? `padding: ${v.padding}px; ` : ""}${v.align ? `text-align: ${v.align}; ` : ""}${v.color ? `color: ${v.color}; ` : ""}${v.bold ? `font-weight: bold; ` : ""}${v.italic ? `font-style: italic; ` : ""}"`;
    }

    /**
     * Get translated message with placeholder replacements.
     * @param {string} msg - The message.
     * @param {Object} [replacements={}] - Object with placeholder keys and values or functions that return a value, 
     * value arrays wil be converted into lines, and nested arrays into columns of lines
     * @param {Object} [formatHTML=null] - Object with default style parameters (color, bold, italic, align) if HTML format shall be used.
     * @returns {string}
     */
    getTranslatedMessage(msg, replacements = {}, formatHTML = null) {

        const escape = (s) => (typeof s == "object" || Array.isArray(s) ? JSON.stringify(s, null, 2) : String(s))
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/\n/g, "<br>");

        const formatAsList = (value) => {
            return `</span><ul>${value.map(v => `<li${this._clsStyle(formatHTML)}>${escape(v)}</li>`).join("")}</ul><span${this._clsStyle(formatHTML)}>`;
        }

        const formatAsTable = (value) => {
            const alignments = [];
            let res = "</span><table>";
            // first line is a header if it contains at least one dictionary with label: as entry
            const hasHeader = value[0].some(v => typeof v == "object" && v && "label" in v);
            if (hasHeader) {
                res += "<thead><tr>";
                for (const v of value[0]) {
                    if (typeof v == "object" && v && "label" in v) {
                        res += `<th${this._clsStyle({ padding: 8, ...formatHTML, ...v })}>${escape(v.label)}</th>`;
                        alignments.push(v.align);
                    } else {
                        res += `<th${this._clsStyle({ padding: 8, ...formatHTML })}>${escape(v)}</th>`;
                        alignments.push("");
                    }
                }
                res += "</tr></thead>";
            }
            res += "<tbody>";
            for (let ri = 0; ri < value.length; ri++) {
                if (hasHeader && ri === 0) continue;
                const row = value[ri];
                res += "<tr>";
                for (let ci = 0; ci < row.length; ci++) {
                    const v = row[ci];
                    if (v != null) {
                        let merge = 0;
                        while (ci + merge + 1 < row.length && row[ci + merge + 1] == null) merge++;
                        const colspan = `${merge > 0 ? ` colspan="${merge + 1}"` : ""}`;
                        if (typeof v == "object" && v && "value" in v)
                            res += `<td${this._clsStyle({ padding: 8, ...formatHTML, ...v, align: v.align ?? alignments[ci] ?? "" })}${colspan}>${escape(v.value)}</td>`;
                        else
                            res += `<td${this._clsStyle({ padding: 8, ...formatHTML, align: alignments[ci] ?? "" })}${colspan}>${escape(v)}</td>`;
                        ci += merge;
                    }
                }
                res += "</tr>";
            }
            res += `</tbody></table><span${this._clsStyle(formatHTML)}>`;
            return res;
        }

        if (formatHTML != null) msg = `<span${this._clsStyle(formatHTML)}>${escape(msg)}</span>`;
        for (const [placeholder, valueOrFunc] of Object.entries(replacements)) {
            const pattern = `{${placeholder}}`;
            if (msg.includes(pattern)) {
                const value = typeof valueOrFunc == "function" ? valueOrFunc() : valueOrFunc;
                let formatted = "";
                if (formatHTML == null)
                    formatted = Array.isArray(value) ? value.map(l => Array.isArray(l) ? l.join("\t") : String(l)).join("\n") : String(value);
                else if (Array.isArray(value) && value.length > 0)
                    formatted = Array.isArray(value[0]) ? formatAsTable(value) : formatAsList(value);
                else
                    formatted = escape(value);
                msg = msg.replaceAll(pattern, formatted);
            }
        }
        return msg;
    }

    /**
     * Get translated message with placeholder replacements.
     * @param {string} key - The message key.
     * @param {CmsFieldConfig} [cfg={}]
     * @param {Object} [item={}]
     * @param {Object} [source=null]
     * @param {Object} [replacements={}] - Object with placeholder keys and values.
     * @param {Object} [formatHTML=null] - Object with default style parameters (color, bold, italic, align) if HTML format shall be used.
     * @returns {string}
     */
    _getTranslatedMessage(key, cfg = {}, item = {}, source = null, replacements = {}, formatHTML = null) {
        const msg = (source ?? this.translatedMessages)[key];
        if (msg == null) console.error("Missing key in translation matrix:", key, { source });
        return this.getTranslatedMessage(
            msg ?? `<${key}???>`,
            {
                ...cfg,
                ...item,
                ...replacements,
                itemName: this.translatedMessages.itemName,
                diff: this.lastDiff.diffUser,
                diffUser: this.lastDiff.diffUser,
                diffIntern: this.lastDiff.diffIntern,
                summary: () => this.getSummary($w, item, true, formatHTML),
                summaryUser: () => this.getSummary($w, item, true, formatHTML),
                summaryIntern: () => this.getSummary($w, item, false, formatHTML),
                item: Object.entries(item),
                itemKeys: Object.keys(item)
            },
            formatHTML);
    }

    postMessageToDatePicker(cfg, scope, message) {
        const elPicker = scope(cfg.datePicker);
        if (elPicker) {
            console.log("postMessage to", cfg.datePicker, ":", message);
            elPicker.postMessage(message);
        } else
            console.error("Cannot find datePicker element", cfg.datePicker);
    }

    convertToEmailOptions(prefix, rows, maxRows = 8, maxCols = 4) {
        const options = {};
        let ri = 0;
        if (Array.isArray(rows)) for (let i = 0; i < rows.length && ri < maxRows; i++) {
            const row = rows[i];
            if (!Array.isArray(row)) continue;
            const hasHeader = row.some(v => typeof v == "object" && v && "label" in v);
            if (hasHeader) continue; // assume headers are printed directly in the triggered email
            for (let ci = 0; ci < row.length && ci <= maxCols; ci++) {
                const v = row[ci];
                if (v != null) {
                    const s = typeof v == "object" && v && "value" in v ? v.value : v;
                    options[`${prefix}${ri + 1}${ci + 1}`] = typeof s == "object" || Array.isArray(s) ? JSON.stringify(s, null, 2) : String(s);
                }
            }
            ++ri;
        }
        return options;
    }

    setupEditButton(buttonName, location, roleID, item = null) {
        const update = async () => {
            const roles = await currentMember.getRoles();
            const showButton = roles.some((role) => role._id == roleID);
            if (showButton) $w(buttonName).show(); else $w(buttonName).hide();
        };
        authentication.onLogin(() => update());
        authentication.onLogout(() => update());
        update();
        $w(buttonName).onClick(() => {
            item ??= this.ds.getCurrentItem();
            console.log("Clicked on", buttonName, ": Navigating to", location, "with", item?._id);
            if (item) wixLocation.to(`/${location}?id=${item._id}`, { target: '_blank' });
        });
    }
}
