import wixData from 'wix-data';
import wixWindow from 'wix-window';
import wixLocation from 'wix-location';
import { currentMember, authentication } from "wix-members-frontend";

import { dateRangeToString, stringToDateRange } from 'public/cms.js';
import { sendMail } from 'backend/common.jsw';

const LOG_CMSEDIT = true;
const VERBOSE_CMSEDIT = true;

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
 * @property {boolean} [trim] - For FieldType.STRING/STRING_...: Whether to trim whitespace (default true).
 * @property {boolean} [dataSet] - For FieldType.REFERENCE/MULTI_REFERENCE: Name of the dataset to which the references shall point.
 * @property {boolean} [onGenerateLabel] - (item) => string: For FieldType.REFERENCE/MULTI_REFERENCE: Label for entries of the dataset.
 * //TODO needs update as some are missing
 */

export const FieldType = Object.freeze({
    STRING: "STRING",
    STRING_MAIL: "STRING_MAIL",
    STRING_PHONE: "STRING_PHONE",
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
    IS_EMPTY: "IS_EMPTY",
    CUSTOM: "CUSTOM",
});

export const FilterCombine = Object.freeze({
    OR: "OR",
    AND: "AND",
    PARALLEL_AND: "PARALLEL_AND",
});


const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export class SafeHTML {
    constructor(html, plain = null) {
        this.html = html;
        this.plain = plain ?? html;
    }
};

export class TableHeader {
    constructor(label, formatHTML = {}) {
        this.label = label;
        this.formatHTML = formatHTML;
    }
};

export class TableCell {
    constructor(value, formatHTML = {}) {
        this.value = value;
        this.formatHTML = formatHTML;
    }
}

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
        this.editMode = config.editMode ?? true;
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
        this.generateTitle = config.generateTitle || ((item) => item?.title || this._str_key("title_null", {}, item));
        this.onGenerateEmailOptions = config.onGenerateEmailOptions || (async () => { return {} });
        this.onRepeaterItemReady = config.onRepeaterItemReady || (() => { });
        this.onReady = config.onReady || ((query) => { });

        this.filterSchema = config.filterSchema || {};
        this.filterLimit = config.filterLimit || 1000;
        this.filterSortField = config.filterSortField || "_id";
        this.filterSortAscending = config.filterSortAscending || true;

        const ifValid = (el) => this.isElement(el) ? el : null;
        this.itemSelector = ifValid(config.itemSelector);
        this.itemRepeater = ifValid(config.itemRepeater);
        this.itemRepeaterSummary = ifValid(config.itemRepeaterSummary);
        this.textResponse = ifValid(config.textResponse);
        this.buttonSave = ifValid(config.buttonSave);
        this.buttonRevert = ifValid(config.buttonRevert);
        this.buttonNew = ifValid(config.buttonNew);
        this.buttonRemove = ifValid(config.buttonRemove);
        this.buttonPrev = ifValid(config.buttonPrev);
        this.buttonNext = ifValid(config.buttonNext);
        this.buttonView = ifValid(config.buttonView);

        this.collapseTextResponse = this.textResponse?.collapsed;

        this.ds = null;
        this.originalItem = null;
        this.isSaving = false;

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
                itemNamePlural: "Einträge",
                itemNameAll: "(Alle)",

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
                    itemRevertedDetails: "{diff}",
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
                },

                repeaterSummaries: {
                    none: "Leider keine passenden {itemNamePlural}",
                    one: "1 passender {itemName}",
                    some: "{count} passende {itemNamePlural}",
                    all: "Alle {count} {itemNamePlural}",
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
            },
            repeaterSummaries: {
                ...defaults.repeaterSummaries,
                ...overrides?.repeaterSummaries
            },
        };
    }

    isElement(el) {
        return el != null && !Array.isArray(el);
    }

    /**
     * Initializes the editor, sets default schema values, and binds UI events.
     * @returns {void}
     */
    init() {
        // always log this line:
        console.log("Initializing CMS Editor for", this.cmsName, "with dataset", this.dataSetName);
        if (this.ds) {
            this.error("Already initialized");
            return;
        }

        this.ds = $w(`#${this.dataSetName}`);
        if (!this.ds || typeof this.ds.onReady != "function") {
            this.ds = null;
            this.error("Cannnot initialize CMS dataset ", this.dataSetName);
            return;
        }

        for (const [id, cfg] of Object.entries(this.cmsSchema)) this._initCMSConfig(id, cfg);
        for (const [key, cfg] of Object.entries(this.filterSchema)) this._initFilterConfig(key, cfg);

        this.ds.onReady(async () => {
            try {
                for (const cfg of Object.values(this.cmsSchema)) this._initCMSElement(cfg, $w, null, null);
                const boundIDs = new Set();
                for (const cfg of Object.values(this.filterSchema)) this._initFilterElement(cfg, $w, boundIDs, null, null);
                if (this.editMode)
                    for (const cfg of Object.values(this.cmsSchema)) this.resetField(cfg, $w, null, null);
                await this.refreshUI();
                const query = wixLocation.query;
                await this.onReady?.(query);
                if (query.id) await this.navigateTo(query.id);
            } catch (e) {
                this.error(e);
                throw e;
            }
        });

        this.ds.onError(async (error) => {
            this.error("onError", error);
            await this.showMessage("generalError", this.getItem(), true, { error });
        });

        this.itemSelector?.onChange(() => {
            if (this._updatingSelector) return;
            const val = this.itemSelector?.value;
            if (val == "--new--") this.newItem(); else this.navigateTo(val);
        });

        this.itemRepeater?.onItemReady(($item, rowData) => this.onRepeaterItemReady($item, rowData));

        this.buttonSave?.onClick(() => this.saveItem());
        this.buttonRevert?.onClick(() => this.revertItem());
        this.buttonNew?.onClick(() => this.newItem());
        this.buttonRemove?.onClick(() => this.removeItem());
        this.buttonPrev?.onClick(() => this.navigateRelative(-1));
        this.buttonNext?.onClick(() => this.navigateRelative(1));
        this.buttonView?.onClick(() => this.showItem());
    }

    /**
     * Ensures defaults for CMS schema field config.
     * @param {string} id
     * @param {CmsFieldConfig} cfg
     */
    _initCMSConfig(id, cfg) {
        this.log("_initCMSConfig", id, cfg);
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
        cfg.collectDiff ??= true;
        cfg.collectSummary ??= true;
        cfg.showToUser ??= true;
        cfg.onEqualData ??= (cfg, item, uiValues, dataValues) => JSON.stringify(uiValues ?? "") == JSON.stringify(dataValues ?? "");
        switch (cfg.type) {
            case FieldType.BOOLEAN:
                cfg.boolTrue ??= this._str_key("booolean_yes", cfg);
                cfg.boolFalse ??= this._str_key("booolean_no", cfg);
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
            case FieldType.STRING_MAIL:
            case FieldType.STRING_PHONE:
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
        this.log("_initFilterConfig", key, cfg);
        cfg.id ??= key;
        cfg.fields ??= this.ensureArray(cfg.field);
        cfg.type ??= FilterType.EQ;
        cfg.combine ??= FilterCombine.AND;
        cfg.value ??= (val) => val;
        cfg.skip ??= (val) => val == null || val == false || val === "" || val === "*" || (Array.isArray(val) && val.length == 0);
        cfg.countsAsFiltered ??= true;
        cfg.delay ??= 500;
        switch (cfg.type) {
            case FilterType.CUSTOM:
                cfg.onFilter ??= (q, f, v) => q;
                cfg.onFilterResults ??= (items) => items;
                break;
        }
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
        if (trg) for (const s of events)
            if (typeof trg[s] == "function") {
                this.debug("Binding", s, "to", cfg.id);
                trg[s]((event) => {
                    if (s != "onKeyPress" || event.key == "Enter") {
                        this.log("Triggering", s, "on", cfg.id, "with delay", delay);
                        if (this._debounceTimers[cfg.id]) clearTimeout(this._debounceTimers[cfg.id].timer);
                        const timer = setTimeout(callback, delay);
                        this._debounceTimers[cfg.id] = { timer, scope, cfg, parentCfg, masterArrayID };
                    }
                });
            } else this.debug("Cannot bind", s, "to", cfg.id, ":", typeof trg[s]);
    }

    async _initCMSElement(cfg, scope, parentCfg, masterArrayID) {
        this.log("_initCMSElement", { cfg, scope, parentCfg, masterArrayID });
        let el = scope(cfg.id);

        const applyOptions = (optionsToApply) => {
            this.log("Assigning options for", cfg.id, ":", el?.options, "=>", optionsToApply);
            cfg.options = optionsToApply;
            if (el && "options" in el)
                el.options = optionsToApply;
            else
                this.error("Cannot assign options list to", cfg.id);

            //must also be applied to filters for those fields
            const optionsForFilter = [{ label: this._str_key("itemNameAll", cfg), value: "*" }, ...optionsToApply];
            for (const fCfg of Object.values(this.filterSchema)) if (fCfg.fields.includes(cfg.field)) {
                const elFilter = $w(fCfg.id);
                this.log("Assigning options also for", fCfg.id, ":", elFilter?.options, "=>", optionsForFilter);
                if (elFilter && "options" in elFilter) {
                    elFilter.options = optionsForFilter;
                    if ("value" in elFilter) {
                        this.log("Setting default filter option for", fCfg.id, "to *");
                        elFilter.value = "*"; // reset filter value to default (show all)
                    }
                } else
                    this.error("Cannot assign options list to", fCfg.id);
            }
        }

        if (this.isElement(el)) {
            if (el._cmsInitialized) return;
            el._cmsInitialized = true;
        } else {
            el = null;
            if (LOG_CMSEDIT) {
                if (this.editMode)
                    this.warn("No such input element:", cfg.id);
                else
                    this.log("No such input element:", cfg.id);
            }
        }

        if (cfg.options != null) {
            if (Array.isArray(cfg.options) && cfg.options.length > 0) {
                applyOptions(cfg.options.map(opt => typeof opt == "object" && opt.label && opt.value ? opt : { label: opt, value: opt }));
            } else this.error("Invalid options for", cfg.id, ":", cfg.options);
        }

        cfg.elements = [];
        const _find = (element) => {
            cfg.elements.push(element);
            if (element.children) for (const child of element.children) _find(child);
        }
        if (el) _find(el);
        this.debug("elements for", cfg.id, ":", cfg.elements);

        cfg.titleElement = cfg.elements.find(c => (c.type == "$w.Text") && (c.id.toLowerCase().includes("name")));

        if (cfg.resetButton) {
            const resetEl = scope(cfg.resetButton);
            if (this.isElement(resetEl)) resetEl.onClick(async () => await this.resetField(cfg, scope, parentCfg, masterArrayID));
            else this.warn(cfg.resetButton, "not found in DOM");
        }

        if (cfg.type == FieldType.REPEATER) {
            el?.onItemReady(($item, rowData) => {
                try {
                    this.log("onItemReady", { id: cfg.id, rowData });
                    for (const cfgSub of Object.values(cfg.inputs)) {
                        this._initCMSElement(cfgSub, $item, cfg, rowData._id);
                        this._updateUiFromData(cfgSub, $item, rowData, null, rowData._id);
                    }
                    if (cfg.removeButton) {
                        const elRemove = $item(cfg.removeButton);
                        if (this.isElement(elRemove)) elRemove.onClick(async () => await this.removeRepeaterItem($item, cfg, rowData._id, masterArrayID));
                        else this.warn(cfg.removeButton, "not found in DOM");
                    }
                } catch (e) {
                    this.error(e);
                    throw e;
                }
            });
            if (cfg.addButton) {
                const addEl = scope(cfg.addButton);
                if (this.isElement(addEl)) addEl.onClick(async () => await this.addRepeaterItem(scope, cfg, masterArrayID));
                else this.warn(cfg.addButton, "not found in DOM");
            }
            return;
        }

        this._bind(el, scope, cfg, parentCfg, masterArrayID, ["onBlur", "onKeyPress"], 0, () => this._updateDataFromUI(cfg, scope, parentCfg, masterArrayID));
        this._bind(el, scope, cfg, parentCfg, masterArrayID, ["onInput", "onChange"], cfg.delay, () => this._updateDataFromUI(cfg, scope, parentCfg, masterArrayID));
        //TODO onChange does not work for RichTextBox

        switch (cfg.type) {
            case FieldType.IMAGES:
                cfg.gallery = cfg.elements.find(c => c.type == "$w.Gallery");
                if (cfg.gallery) cfg.gallery.onItemClicked((event) => {
                    cfg.selIdx = event.itemIndex;
                    this.log("Selected media index on", cfg.id, ":", cfg.selIdx);
                    this._updateUiFromData(cfg, scope, this.getItem(), null, masterArrayID); // just to update selection marker
                });

                for (const action of ["moveleft", "moveright", "remove"]) {
                    const btn = cfg.elements.find(c => (c.type == "$w.Button") && (c.id.toLowerCase().includes(action)));
                    if (btn) btn.onClick(async () => {
                        const { item, masterArray, values } = this._resolveContext(cfg, masterArrayID, parentCfg);
                        const val = this.ensureArray(values[0]);
                        this.log("Executing", action, "on", cfg.id, "with", val.length, "items for index", cfg.selIdx);
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
                        this.log("Selected media index on", cfg.id, ":", cfg.selIdx);
                        await this._persistAndRefresh(cfg, scope, item, masterArray, [val], masterArrayID, parentCfg, true);
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
                    applyOptions(data.items.map(item => ({ label: cfg.onGenerateLabel(item), value: item._id })));
                }
                break;

            case FieldType.NUMBER:
                if (cfg.minAllowed != null) {
                    if (el && "min" in el) el.min = cfg.minAllowed; else this.error("Cannot assign min to ", cfg.id);
                }
                if (cfg.maxAllowed != null) {
                    if (el && "max" in el) el.max = cfg.maxAllowed; else this.error("Cannot assign max to ", cfg.id);
                }
                break;

            case FieldType.DATE_RANGE:
                if (cfg.datePicker) {
                    this.postMessageToDatePicker(cfg, scope, { minDate: cfg.minAllowed, maxDate: cfg.maxAllowed });
                    const elPicker = scope(cfg.datePicker);
                    if (this.isElement(elPicker)) elPicker.onMessage(async (event) => {
                        this.log("received message from picker for ", cfg.id, ":", event.data);
                        const { selectedDates, displayedMonth, displayedYear } = event.data || {};
                        if (selectedDates?.length == 2) {
                            await this._updateUiFromData(cfg, scope, this.getItem(), selectedDates, masterArrayID);
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
                        this.error("Cannot find datePicker element", cfg.datePicker);
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
        this.log("_initFilterElement", { cfg, scope, boundIDs, parentCfg, masterArrayID });
        const el = scope(cfg.id);
        if (!this.isElement(el))
            this.warn("No such filter element:", cfg.id);
        else if (!boundIDs.has(cfg.id)) {
            boundIDs.add(cfg.id);
            this._bind(el, scope, cfg, parentCfg, masterArrayID, ["onBlur", "onKeyPress"], 0, () => this.updateSelectorList());
            this._bind(el, scope, cfg, parentCfg, masterArrayID, ["onInput", "onChange"], cfg.delay, () => this.updateSelectorList());
        }
        else this.debug("Filter element already bound:", cfg.id);
    }

    getItem() {
        return this.ds?.getCurrentItem();
    }

    /**
     * Synchronizes the UI with the current dataset item.
     * @returns {Promise<void>}
     */
    async refreshUI() {
        const item = this.getItem();
        this.log("refreshUI", item);

        if (item && this.ds) try {
            await Promise.all((Object.values(this.cmsSchema).filter(cfg => cfg.type == FieldType.MULTI_REFERENCE)).map(async (cfg) => {
                try {
                    const refResult = await wixData.queryReferenced(this.cmsName, item._id, cfg.field);
                    item[cfg.field] = refResult.items.map(refItem => refItem._id);
                    if (this.editMode) await this.ds.setFieldValue(cfg.field, item[cfg.field]);
                } catch (e) {
                    this.error("Failed to fetch references for", cfg.field, ":", e);
                    throw e;
                }
            }));
            for (const cfg of Object.values(this.cmsSchema)) if (cfg.type == FieldType.REPEATER) {
                const now = Date.now();
                item[cfg.field] = (item[cfg.field] || []).map((d, i) => ({ ...d, _id: d._id || `row-${i}-${now}` }));
                if (this.editMode) await this.ds.setFieldValue(cfg.field, item[cfg.field]);
            }
        } catch (e) {
            this.error(e);
        }

        try {
            await Promise.all(Object.keys(this.cmsSchema).map(id => this._updateUiFromData(this.cmsSchema[id], $w, item, null, null)));
        } catch (e) {
            this.error(e);
        }
        this.log("refreshUI now", item);
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
            this.error("Cannot assign from input: CMS schema not found in configuration")
            return { values: null, needRefresh: false };
        }

        const el = scope(cfg.id);
        if (!this.isElement(el)) return { values: null, needRefresh: false };

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
                case FieldType.STRING_MAIL:
                case FieldType.STRING_PHONE:
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
                        this.warn("Error in onParseCustomUserInput for", cfg.id, ":", e);
                        return { val: item?.[cfg.field] };
                    }
                //            case FieldType.REPEATER:
                //                return { val: this.ensureArray(item?.[cfg.field]) };
                case FieldType.CAPTCHA:
                    return { val: el.token };
                case FieldType.TAGS:
                    return { val: el.value };
                default:
                    return { val: el.value };
            }
        };

        // if we have no fields, we expect no values at all,
        // if only one field is defined, we expect a single value,
        // otherwise we expect values for each defined field
        const result = await parse();
        const val = result?.val;
        const needRefresh = !!result?.needRefresh;
        const values = cfg.fields.length == 0 ? [] : cfg.fields.length > 1 ? val : [val];
        if (values.length != cfg.fields.length) {
            this.error("Unexpected number of values:", { values, cfg, scope, item, needRefresh, val, el_value: el.value });
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
            this.error("Cannot assign from input: CMS schema not found in configuration")
            return false;
        }

        const el = scope(cfg.id);
        if (!this.isElement(el)) return false;

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
     * @returns {{item:Object|null,masterArray:Array|null,values:any[]}}
     */
    _resolveContext(cfg, masterArrayID, parentCfg) {
        let item = this.getItem();
        let masterArray = parentCfg == null || masterArrayID == null ? null : [...this.ensureArray(item[parentCfg.field])];
        const idx = masterArray?.findIndex(v => v._id == masterArrayID);
        if (idx == -1) {
            this.errorIfLog("Cannot find masterArrayID", { cfg, masterArray, masterArrayID, parentCfg });
            item = null;
        }
        if (idx >= 0) item = masterArray[idx];
        return { item, masterArray, values: cfg.fields.map(f => item?.[f]) };
    }

    /**
     * Persist field changes to dataset and update UI+validation.
     * @param {CmsFieldConfig} cfg
     * @param {*} scope
     * @param {Object|null} item
     * @param {Array|null} masterArray
     * @param {Array} values
     * @param {string|null} masterArrayID
     * @param {CmsFieldConfig|null} parentCfg
     * @param {boolean} needRefresh
     */
    async _persistAndRefresh(cfg, scope, item, masterArray, values, masterArrayID, parentCfg, needRefresh) {
        this.debug("_persistAndRefresh", { cfg, scope, item, masterArray, values, masterArrayID, parentCfg, needRefresh });
        if (!this.ds || !this.editMode) return;

        if (masterArray != null && masterArrayID != null) {
            const idx = masterArray.findIndex(v => v._id == masterArrayID);
            if (idx == -1)
                this.errorIfLog("Cannot find masterArrayID", { cfg, scope, item, masterArray, values, masterArrayID, parentCfg, needRefresh });
            else {
                masterArray[idx] = { ...masterArray[idx] };
                for (let i = 0; i < cfg.fields.length; i++)
                    masterArray[idx][cfg.fields[i]] = values[i];
                item = masterArray[idx];
                await this.ds.setFieldValue((parentCfg || cfg).field, masterArray);
            }
        } else {
            for (let i = 0; i < cfg.fields.length; i++)
                await this.ds.setFieldValue(cfg.fields[i], values[i]);
            item = this.getItem(); // update after using setFieldValue
        }

        if (cfg.onChanged) try {
            await cfg.onChanged(item, values[0]);
        } catch (e) {
            this.error("Error in onChanged for", cfg.id, ":", e);
        }
        if (parentCfg?.onChanged) try {
            await parentCfg.onChanged(item, masterArray || values[0]);
        } catch (e) {
            this.error("Error in onChanged for", parentCfg.id, ":", e);
        }

        if (needRefresh)
            await this._updateUiFromData(cfg, scope, item, values, masterArrayID);
        else
            await this._validate(cfg, scope, item);

        for (const sameLevelCfg of parentCfg ? Object.values(parentCfg.inputs) : Object.values(this.cmsSchema))
            if (sameLevelCfg != cfg) await this._validate(sameLevelCfg, scope, item);

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
        if (!this.ds || !this.editMode) return;

        const { item, masterArray, values: dataValues } = this._resolveContext(cfg, masterArrayID, parentCfg);
        const { values: uiValues, needRefresh } = await this._parseUiValue(cfg, scope, item);
        if (cfg.onEqualData(cfg, item, uiValues, dataValues)) {
            this.debug(`No change in UI ${cfg.id} for field ${cfg.field}${masterArrayID == null ? "" : ` at ${masterArrayID}`}`);
            if (!wasTouched) this._validate(cfg, scope, item); // now missing values on required fields shall trigger error
        } else {
            this.log(`Writing UI ${cfg.id} to field ${cfg.fields}${masterArrayID == null ? "" : ` at ${masterArrayID}`} with value:`, uiValues);
            await this._persistAndRefresh(cfg, scope, item, masterArray, uiValues, masterArrayID, parentCfg, needRefresh || masterArray);
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
        this.log("resetField", { cfg, scope, parentCfg, masterArrayID });
        cfg._touched = false;
        if (!this.ds || !this.editMode) return;

        const { item, masterArray, values: dataValues } = this._resolveContext(cfg, masterArrayID, parentCfg);
        const uiValues = [cfg.default];
        if (LOG_CMSEDIT || VERBOSE_CMSEDIT) {
            if (cfg.onEqualData(cfg, item, uiValues, dataValues)) {
                this.debug(`Already in reset state ${cfg.id} for field ${cfg.field}${masterArrayID == null ? "" : ` at ${masterArrayID}`}`);
            } else
                this.log(`Resetting UI ${cfg.id} to field ${cfg.fields}${masterArrayID == null ? "" : ` at ${masterArrayID}`} with value:`, uiValues);
        }
        await this._persistAndRefresh(cfg, scope, item, masterArray, uiValues, masterArrayID, parentCfg, true);
    }

    /**
     * Add row to repeater array and persist.
     * @param {*} scope
     * @param {CmsFieldConfig} cfg
     * @param {string|null} masterArrayID
     */
    async addRepeaterItem(scope, cfg, masterArrayID) {
        this.log("addRepeaterItem for", cfg.id);
        if (!this.ds || !this.editMode) return;
        const len = values?.[0]?.length ?? 0;

        const { item, masterArray, values } = this._resolveContext(cfg, masterArrayID, null);
        this.debug({ scope, cfg, masterArrayID, item, masterArray, values });
        const newItem = { _id: `row-${len}-${Date.now()}` };
        for (const subCfg of Object.values(cfg.inputs)) newItem[subCfg.field] ??= subCfg.default;
        const newValues = [[...(values?.[0] ?? []), newItem]];
        await this._persistAndRefresh(cfg, scope, item, masterArray, newValues, masterArrayID, null, true);
    }

    /**
     * Remove row from repeater array and persist.
     * @param {*} scope
     * @param {CmsFieldConfig} cfg
     * @param {string} id
     * @param {string|null} masterArrayID
     */
    async removeRepeaterItem(scope, cfg, id, masterArrayID) {
        this.log("removeRepeaterItem from", cfg.id, "with id", id);
        if (!this.ds || !this.editMode) return;

        const { item, masterArray, values } = this._resolveContext(cfg, masterArrayID, null);
        this.debug({ scope, cfg, id, masterArrayID, item, masterArray, values });
        const newValues = [values[0].filter(v => v._id != id)];
        await this._persistAndRefresh(cfg, scope, item, masterArray, newValues, masterArrayID, null, true);
    }

    async updateUIFromData(id, valuesToUse = null) {
        await this._updateUiFromData(this.cmsSchema[id], $w, null, valuesToUse, null);
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
            this.error("Cannot assign to input: CMS schema not found in configuration")
            return;
        }

        const el = scope(cfg.id);
        if (!this.isElement(el)) return;

        let prevValue = undefined;
        const values = valuesToUse ?? cfg.fields.map(f => item?.[f]);
        let val0 = values[0];
        let done = false;
        switch (cfg.type) {
            case FieldType.BOOLEAN:
                val0 = !!val0;
                if ("checked" in el) {
                    prevValue = el.checked;
                    el.checked = val0;
                    done = true;
                }
                break;
            case FieldType.ADDRESS:
                val0 = val0 && typeof val0 == "object" ? val0 : { formatted: "" };
                break;
            case FieldType.TIME_OF_DATE:
                if (val0 != null) {
                    const dt = new Date(val0); // local time
                    val0 = this._padTime(dt.getHours()) + ":" + this._padTime(dt.getMinutes());
                } else
                    val0 = "";
                break;
            case FieldType.HOURS_OF_DATE:
                if (val0 != null) {
                    const dt = new Date(val0); // local time
                    const opts = cfg.options ?? [];
                    const hours = dt.getHours();
                    val0 = opts.find(o => o.value == hours)?.value;
                    if (val0 == null && opts.length > 0) {
                        //if no fitting, use the nearest value depending on cfg.roundUp
                        const values = opts.map(o => o.value);
                        values.sort((a, b) => cfg.roundUp ? a - b : b - a);
                        val0 = cfg.roundUp
                            ? values.find(v => v >= hours) ?? values[values.length - 1]
                            : values.find(v => v <= hours) ?? values[0];
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
                    prevValue = cfg.image.src;
                    cfg.image.src = val0;
                    done = true;
                }
                break;
            case FieldType.IMAGES:
                val0 = this.ensureArray(val0).map((v, i) => this._createMediaStruct(cfg, i, v));
                if (cfg.gallery && "items" in cfg.gallery) {
                    prevValue = cfg.gallery.items;
                    cfg.gallery.items = val0;
                    if (cfg.gallery.items.length == 0) cfg.gallery.collapse(); else cfg.gallery.expand();
                    done = true;
                }
                break;
            case FieldType.CUSTOM:
                try {
                    val0 = await cfg.onFormatCustomValue?.(values);
                } catch (e) {
                    this.warn("Error in onFormatCustomValue for", cfg.id, ":", e);
                    val0 = null;
                }
                break;
            case FieldType.REPEATER:
                val0 = this.ensureArray(val0);
                prevValue = el.data;
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
            if ("value" in el) {
                prevValue = el.value;
                el.value = val0;
            } else
                this.error("Cannot assign to UI", cfg.id, "from field", cfg.field, ": No 'value' property", { cfg, scope, item, el })
        }
        this.log(`Updated UI ${cfg.id} from field ${cfg.field}${masterArrayID == null ? "" : ` at ${masterArrayID}`} with value:`, val0, "was:", prevValue);

        const btn = cfg.linkButton ? scope(cfg.linkButton) : null;
        if (btn && this.isElement(btn)) {
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
     * Generates an <image> tag from a URL or path.
     * @param {string} url - The URL or path.
     * @returns {string} The generated HTML string.
     */
    _generateImageTag(url, w = 300, h = 200) {
        if (!url) return "";
        if (url.startsWith("wix:image://v1/")) {
            const match = url.match(/^wix:image:\/\/v1\/([^\/#]+)(?:\/([^#]+))?/);
            if (match) {
                const mediaId = match[1];
                url = `https://static.wixstatic.com/media/${mediaId}/v1/fill/w_${w},h_${h},al_c,q_85,enc_auto/${mediaId}`;
            }
        }
        return `<img src="${url}" style="display:block;margin:4px;">`;
    }

    /**
     * Formats the values for diff or summary output.
     * @param {CmsFieldConfig} cfg
     * @param {*} scope
     * @param {Object} item
     * @returns {string}
     */
    _printValue(cfg, scope, item, values, forUser, formatHTML) {

        const getFileName = (url) => url ? url.split('/').pop()?.split('#')[0] || url : "";

        if (!cfg) return "";
        if (cfg.onPrintValue) try {
            const pv = cfg.onPrintValue(item, values, forUser, formatHTML);
            if (pv != null) return pv;
        } catch (e) {
            this.warn("Error in onPrintValue for", cfg.id, ":", e);
            return "";
        }
        const val0 = values[0];
        const formatters = {
            [FieldType.BOOLEAN]: () => val0 ? cfg.boolTrue : cfg.boolFalse,
            [FieldType.NUMBER]: () => Number(val0).toLocaleString("de-DE", { minimumFractionDigits: cfg.fractionDigits }),
            [FieldType.ADDRESS]: () => {
                const loc = val0?.location ?? {};
                const f = val0?.formatted ?? "";
                return loc.latitude && loc.longitude ?
                    new SafeHTML(`<a href="https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}">${f}</a>`, f)
                    : f;
            },
            [FieldType.DATE]: () => dateRangeToString(val0, null, cfg.format),
            [FieldType.DATE_RANGE]: () => dateRangeToString(val0, values[1], cfg.format),
            [FieldType.HOURS_OF_DATE]: () => {
                const hours = val0 ? new Date(val0).getHours() : null;
                return hours == null ? "" : cfg.options?.[hours] ?? `${this._padTime(hours)}:00`;
            },
            [FieldType.TIME_OF_DATE]: () => val0 ? `${this._padTime(new Date(val0).getHours())}:${this._padTime(new Date(val0).getMinutes())}` : "",
            [FieldType.MULTI_SELECT]: () => this.ensureArray(val0),
            [FieldType.IMAGE]: () => [forUser ? new SafeHTML(this._generateImageTag(val0), getFileName(val0)) : getFileName(val0)],
            [FieldType.IMAGES]: () => this.ensureArray(val0)
                .map(img => {
                    const url = img?.src || img?.fileUrl || "";
                    return forUser ? new SafeHTML(this._generateImageTag(url), getFileName(url)) : getFileName(url);
                }),
            [FieldType.CUSTOM]: () => cfg.onFormatCustomValue?.(values),
            [FieldType.TAGS]: () => this.ensureArray(val0).map(v => cfg.options?.[v] ?? v),
            [FieldType.REFERENCE]: () => cfg.options?.find(opt => opt.value == val0)?.label ?? val0,
            [FieldType.MULTI_REFERENCE]: () => this.ensureArray(val0).map(v => cfg.options?.find(opt => opt.value == v)?.label ?? v),
            [FieldType.RICH_TEXT]: () => new SafeHTML(val0, val0),
            [FieldType.STRING_MAIL]: () => val0 ? new SafeHTML(`<a href="mailto:${val0}">${val0}</a>`, val0) : "",
            [FieldType.STRING_PHONE]: () => {
                const phone = val0.replace(/\D/g, "");
                return phone ? new SafeHTML(`<a href="tel:${phone}">${val0}</a>`, val0) : "";
            },
        };
        let res = val0 == null ? null : (formatters[cfg.type] || (() => String(val0)))();
        if (cfg.onPrintedValue) res = cfg.onPrintedValue(res);
        return res ?? "";
    }

    /**
     * Compare original item and current item for changed fields.
     * @param {*} scope
     * @returns {boolean}
     */
    hasChanges(scope) {
        const item = this.getItem();
        for (const cfg of Object.values(this.cmsSchema)) {
            this.log("Checking changes for", cfg);
            if (cfg.collectDiff) {
                const orgVal = cfg.fields.map(f => this.originalItem?.[f] ?? "");
                const curVal = cfg.fields.map(f => item?.[f] ?? "");
                if (!cfg.onEqualData(cfg, item, curVal, orgVal)) return true;
            }
        }
        return false;
    }

    /**
     * Compare original item and current item for changed fields.
     * @param {*} scope
     * @param {Object} item
     * @param {boolean} [forUser] if true, only fields with showToUser == true will be returned, 
     *   and they will be formatted for the user.
     * @returns {any[]}
     */
    getDiff(scope, item, forUser, formatHTML) {
        const caption = [
            new TableHeader(this._str_key("diff_caption", {}, item), { align: "right", bold: true }),
            new TableHeader(this._str_key("diff_from", {}, item), { align: "right", bold: true }),
            new TableHeader("", { align: "center" }),
            new TableHeader(this._str_key("diff_to", {}, item), { bold: true }),
        ];
        const diff = [caption];
        for (const cfg of Object.values(this.cmsSchema)) {
            if (cfg.collectDiff && (!forUser || cfg.showToUser)) {
                const orgVal = cfg.fields.map(f => this.originalItem?.[f] ?? "");
                const curVal = cfg.fields.map(f => item?.[f] ?? "");
                if (!cfg.onEqualData(cfg, item, curVal, orgVal)) diff.push([
                    (typeof cfg.diffLabel == "function" ? cfg.diffLabel(item, forUser, formatHTML) : cfg.diffLabel) + ":",
                    this._printValue(cfg, scope, this.originalItem, orgVal, forUser, formatHTML),
                    { value: "->", bold: true },
                    this._printValue(cfg, scope, item, curVal, forUser, formatHTML)
                ]);
            }
        }
        return diff;
    }

    /**
     * List all fields.
     * @param {*} scope
     * @param {Object} item
     * @param {boolean} [forUser] if true, only fields with showToUser == true will be returned, 
     *   and they will be formatted for the user.
     * @returns {Promise<any[]>}
     */
    getSummary(scope, item, forUser, formatHTML = null) {
        const res = [
            [
                new TableHeader(this._str_key("input_caption", {}, item), { align: "right", bold: true }),
                new TableHeader(this._str_key("input_value", {}, item), { bold: true }),
            ]
        ];
        for (const cfg of Object.values(this.cmsSchema))
            if (cfg.collectSummary && (!forUser || cfg.showToUser)) res.push(
                [
                    new TableCell((typeof cfg.summaryLabel == "function" ? cfg.summaryLabel(forUser, formatHTML) : cfg.summaryLabel) + ":", {
                        color: cfg.lastValidationFailed ? "#E74C3C" : formatHTML?.color ?? "",
                    }),
                    new TableCell(this._printValue(cfg, scope, item, cfg.fields.map(f => item?.[f]), forUser, formatHTML), {
                        color: cfg.lastValidationFailed ? "#E74C3C" : formatHTML?.color ?? "",
                    }),
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
        if (!this.ds || !this.editMode) return;
        this.isSaving = true;
        let savedItem = null;
        try {
            await this.flushDebounce();
            const item = this.getItem();
            this.log("saveItem", item);
            for (const cfg of Object.values(this.cmsSchema)) cfg._touched = true; //TODO recurse? also on other places?

            let allErrors = [];
            for (const cfg of Object.values(this.cmsSchema)) allErrors.push(...await this._validate(cfg, $w, item));
            if (allErrors.length > 0) {
                await this.showMessage("itemSaveError", item, true, { error: allErrors });
                await this.updateButtonStates();
                return false;
            }
            await this.updateButtonStates();

            this.collapseResponse();
            this.log("saveItem diff:", this.getDiff($w, item, false, null));
            const beforeSafeResult = await this.onBeforeSave(item);
            if (beforeSafeResult == null) return false;
            savedItem = await this.ds.save();
            if (savedItem) for (const cfg of Object.values(this.cmsSchema))
                if (cfg.type == FieldType.MULTI_REFERENCE) {
                    const val = this.ensureArray($w(cfg.id)?.value);
                    this.log("saveItem replaceReferences", cfg.field, savedItem._id, val);
                    await wixData.replaceReferences(this.cmsName, cfg.field, savedItem._id, val);
                }
            this.log("item saved");
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
        if (!this.ds || !this.editMode) return;
        this.log("revertItem");
        await this.flushDebounce(false);
        this.collapseResponse();
        await this.ds.revert(); //TODO this kills the diff output of the showMessage() below
        this.log("item reverted");
        this.onAfterReverted();
        await this.showMessage("itemReverted", this.getItem());
        for (const cfg of Object.values(this.cmsSchema)) cfg._touched = false; //TODO recurse? also on other places?
        await this.refreshUI();
    }

    /**
     * Create new item after saving current.
     */
    async newItem() {
        if (!this.ds || !this.editMode) return;
        this.log("newItem", this.getDiff($w, this.getItem(), false, null));
        if (!this.hasChanges($w) || await this.saveItem()) {
            this.log("item saved before creating new item");
            const newItem = await this.ds.new();
            this.log("item created");
            await this.showMessage("itemCreated", newItem);
            await this.refreshUI();
            for (const cfg of Object.values(this.cmsSchema)) this.resetField(cfg, $w, null, null);
        } else
            this.error("New item aborted: Save failed.");
    }

    /**
     * Remove item and select next/previous.
     */
    async removeItem() {
        if (!this.ds || !this.editMode) return;
        this.log("removeItem");
        await this.flushDebounce();
        this.collapseResponse();
        const itemToDelete = this.getItem();

        let nextId = null;
        const options = this.itemSelector?.options;
        if (options) {
            const idx = options.findIndex(opt => opt.value == itemToDelete._id);
            nextId = idx != -1 && idx < options.length - 1 ? options[idx + 1].value : idx > 0 ? options[idx - 1].value : null;
        };

        await this.ds.remove();
        this.log("item removed");
        this.onAfterDelete(itemToDelete);
        await this.showMessage("itemRemoved", itemToDelete);
        if (!nextId || nextId == "--new--") this.newItem(); else this.navigateTo(nextId);
    }

    /**
     * Shows the current item in reader mode in a new window.
     */
    showItem() {
        const item = this.getItem();
        const url = `/${this.viewModeURL}/${item?._id}`;
        this.log("Showing item:", url);
        if (item && item._id) wixLocation.to(url, { target: '_blank' });
    }

    /**
     * Change selector by offset.
     * @param {number} offset
     */
    navigateRelative(offset) {
        this.log("navigateRelative", offset);
        const currentId = this.getItem()?._id;
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
        this.log("navigateTo", id);
        if (id && id != "--new--" && this.ds) {
            const result = await this.ds.getItems(0, this.ds.getTotalCount());
            const index = result.items.findIndex(item => item._id == id);
            if (index != -1) {
                this.log("navigateTo item index", index);
                await this.ds.setCurrentItemIndex(index);
                await this.refreshUI();
                this.log("navigated to item");
            } else {
                this.errorIfLog("navigateTo cannot find among", result.items.length, "items");
            }
        } else
            this.warn("navigateTo will ignore entry", id);
    }

    /**
     * Query dataset based on filter inputs and update selector options.
     */
    async updateSelectorList() {
        this.log("updateSelectorList");
        if (!this.itemSelector && !this.itemRepeater) {
            this.log("no itemSelector or itemRepeater");
            return;
        }

        let q = wixData.query(this.cmsName);
        let filtered = false;
        const customChecks = [];

        for (const cfg of Object.values(this.filterSchema)) {
            const applyOp = (q, f, v) => {
                this.debug("updateSelectorList applyOp", { q, f, v });
                switch (cfg.type) {
                    case FilterType.EQ: return q.eq(f, v);
                    case FilterType.CONTAINS: return q.contains(f, v);
                    case FilterType.GE: return q.ge(f, v);
                    case FilterType.LE: return q.le(f, v);
                    case FilterType.HAS_SOME: return q.hasSome(f, this.ensureArray(v));
                    case FilterType.IS_EMPTY: return q.isEmpty(f).or(wixData.query(this.cmsName).eq(f, ""));
                    case FilterType.CUSTOM: return cfg.onFilter(q, f, v);
                    default: return q;
                }
            };

            const getElementValue = () => {
                const el = $w(cfg.id);
                return el && "checked" in el ? el.checked : el && "value" in el ? el.value : null;
            };
            const val = typeof cfg.value == "function" ? cfg.value(getElementValue()) : cfg.value;
            const skipped = cfg.skip(val);
            this.debug("updateSelectorList", { cfg, valType: typeof val, val, skipped });
            if (!skipped) {
                if (cfg.countsAsFiltered) filtered = true;
                if (cfg.type == FilterType.CUSTOM) customChecks.push(cfg);
                switch (cfg.combine) {
                    case FilterCombine.OR:
                        // ONE value vs MANY fields (OR)
                        let qOr = null;
                        for (let i = 0; i < cfg.fields.length; i++) {
                            const qI = applyOp(wixData.query(this.cmsName), cfg.fields[i], val);
                            qOr = i == 0 ? qI : qOr.or(qI);
                        }
                        if (qOr) q = q.and(qOr);
                        break;
                    case FilterCombine.PARALLEL_AND:
                        // Parallel Mapping (Many-to-Many)
                        if (!Array.isArray(val) || cfg.fields.length != val.length) {
                            this.error("Unexpected result from value() function: Expected array of equal length as cfg.fields", { pVal: val, cfg });
                        } else
                            q = cfg.fields.reduce((q0, f, i) => applyOp(q0, f, val[i]), q);
                        break;
                    case FilterCombine.AND:
                    default:
                        // Broadcasting (One-to-Many) or Standard (One-to-One)
                        q = cfg.fields.reduce((q0, f) => applyOp(q0, f, val), q);
                        break;
                }
            }
        }

        q = this.filterSortAscending ? q.ascending(this.filterSortField) : q.descending(this.filterSortField);
        q = q.limit(this.filterLimit);
        this.log("updateSelectorList query:", q);

        this._updatingSelector = true;
        try {
            let items = (await q.find()).items;
            for (const cfg of customChecks) {
                const cntBefore = items.length;
                items = cfg.onFilterResults(items);
                this.log("onFilterResults filtered", cntBefore, "to", items.length);
            }
            if (this.filterSortResults) items.sort(this.filterSortResults);
            this.debug("updateSelectorList result:", items);

            try {
                if (this.itemSelector) {
                    this.itemSelector.options = [
                        { label: this._str_key("itemSelector_createNew"), value: "--new--" },
                        ...items.map(item => ({ label: this.generateTitle(item), value: item._id }))
                    ];
                    this.itemSelector.value = this.getItem()?._id;
                }

                if (this.itemRepeater)
                    this.itemRepeater.data = items;

                if (this.itemRepeaterSummary) {
                    const count = items.length;
                    const key = count == 0 ? "none" : count == 1 ? "one" : filtered ? "some" : "all";
                    this.itemRepeaterSummary.html = this._str_key(key, {}, {}, this.translatedMessages.repeaterSummaries, { count }, {});
                }
            } catch (err) { this.error("updateSelectorList failed", err); }
        } finally {
            this._updatingSelector = false;
        }

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
            this.error("Cannot validate input: CMS schema not found in configuration")
            return [this._str_key("error_no_config", cfg, item, null, {}, { color: "#E74C3C" })];
        }
        let el = scope(cfg.id);
        if (!this.isElement(el)) el = null;

        const visible = typeof cfg.visible == "function" ? await cfg.visible(item) : cfg.visible;
        const required = typeof cfg.required == "function" ? await cfg.required(item) : cfg.required;
        const readOnly = typeof cfg.readOnly == "function" ? await cfg.readOnly(item) : cfg.readOnly;
        this.debug("validate", { cfg, scope, item, visible, required, readOnly });

        // process "visible" attribute
        if (visible === true) el?.expand();
        if (visible === false) el?.collapse();

        // process "required" attribute //TODO does not work for RichTextBox or SelectionTags
        if (el && (required === true || required === false)) {
            if ("label" in el && el.label) el.label = cfg.label + (required ? " *" : "");
            if (cfg.titleElement) cfg.titleElement.text = cfg.label + (required ? " *" : "");
        }

        // process "readOnly" attribute
        this._setEnabled(el, !readOnly);
        for (const sub of cfg.elements) this._setEnabled(sub, !readOnly);

        if (visible === false) return []; // treat invisible as valid 
        if (readOnly === true) return [];  // treat readonly as valid 

        const errors = [];
        let validity = {}
        if (el && cfg._touched) { // ignore until the user touched this field
            let customErrorMessage = null;
            let values = null;
            validity = { ...el.validity };
            if (cfg.onCustomValidation || cfg.minAllowed != null || cfg.maxAllowed != null) {
                values = await this._parseUiValue(cfg, scope, item).values;
                customErrorMessage = await cfg.onCustomValidation?.(item, values);
                validity.rangeUnderflow ||= cfg.minAllowed != null && (values.some((v) => v != null && !Number.isNaN(v) && v < cfg.minAllowed));
                validity.rangeOverflow ||= cfg.maxAllowed != null && (values.some((v) => v != null && !Number.isNaN(v) && v > cfg.maxAllowed));
            }
            validity.customError = !!customErrorMessage; // we overwrite onCustomValidation, so ignore the one from el.validity
            validity.valueMissing ||= cfg.required && !this._hasUiValue(cfg, scope, item);
            //validity.badInput ||= numericValues.some(v => v !== null && Number.isNaN(v)); //TODO support ?

            for (const [attr, failure] of Object.entries(validity)) if (attr != "valid" && failure)
                errors.push(this._str_key(attr, cfg, item, this.translatedMessages.validityChecks, {
                    message: customErrorMessage || this._str_key("no_validationMessage", cfg, item, null, {})
                }));
            this.debug("_validate", { values, customErrorMessage, validity, errors });
            if (errors.length == 0) {
                this.log("UI Validation succeeded for UI", cfg.id, ":", { values, validity, value: el.value });
                if (el.setCustomValidity) el.setCustomValidity("");
                if (el.onCustomValidation) el.onCustomValidation((_1, _2) => { });
            } else {
                this.warn("UI Validation failed for UI", cfg.id, ":", { values, validity, value: el.value, customErrorMessage, errors });
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

        if (el && cfg.type == FieldType.REPEATER) {
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

        const hasChanges = this.hasChanges($w);

        const isNew = !this.getItem()?._createdDate;
        const isBusy = this.isSaving;
        const allValid = true; // Object.values(this.cmsSchema).every(cfg => !cfg.lastValidationFailed); TODO

        this.log("updateButtonStates", { currentIndex, totalCount, hasChanges, isNew, isBusy, allValid });
        this._setEnabled(this.buttonSave, this.editMode && !isBusy && hasChanges && allValid);
        this._setEnabled(this.buttonRevert, this.editMode && !isBusy && hasChanges);
        this._setEnabled(this.buttonNew, this.editMode && !isBusy && !isNew);
        this._setEnabled(this.buttonRemove, this.editMode && !isBusy && !isNew);
        this._setEnabled(this.buttonPrev, !isBusy && !hasChanges && currentIndex > 1); // don't navigate to -- new--
        this._setEnabled(this.buttonNext, !isBusy && !hasChanges && currentIndex < totalCount - 1);
        this._setEnabled(this.buttonView, !isBusy && !hasChanges && !isNew);
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

        const sMsg = this._str_key(msgId, {}, item, this.translatedMessages.messageIds, replacements, { color: isError ? "#E74C3C" : "#2ECC71", align: "center" });
        const sDetails = this._str_key(msgId + "Details", {}, item, this.translatedMessages.messageIds, replacements, {});

        const canSendMail = message?.emailId && item.email;
        const emailOptions = canSendMail ? await (message?.onGenerateEmailOptions ?? this.onGenerateEmailOptions)?.(item, message.emailId) : {}

        this.log("showMessage", { msgId, isError, message, sMsg, sDetails, canSendMail, emailOptions });

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

    _clsStyle(v = {}) {
        const n = (val) => {
            if (val == null) return null;
            const num = Number(val);
            return Number.isNaN(num) ? val : num;
        };
        const padding = n(v.padding);
        const width = n(v.width);

        this.debug("_clsStyle", v);
        const styles = [];

        if (padding != null) styles.push(`padding:${padding}px`);
        if (v.align && ["left", "right", "center"].includes(v.align)) styles.push(`text-align:${v.align}`);
        if (v.color && /^[#a-zA-Z0-9(),.\s-]+$/.test(v.color)) styles.push(`color:${v.color}`);
        if (v.bold) styles.push(`font-weight:bold`);
        if (v.italic) styles.push(`font-style:italic`);
        if (v.nowrap) styles.push(`white-space:nowrap`);
        if (width && /^[0-9.]+(px|%|em|rem|vw|vh)?$/.test(String(width))) styles.push(`width:${width}`);
        const styleAttr = styles.length ? ` style="${styles.join(";")}"` : "";
        return ` class="font_7"${styleAttr}`;
    }

    /**
     * Get translated message with placeholder replacements.
     * @param {string} msg - The message.
     * @param {Object} [replacements={}] - Object with placeholder keys and values.
     * @param {Object} [formatHTML=null] - Object with default style parameters (color, bold, italic, align) if HTML format shall be used.
     * @returns {string}
     */
    getString(msg, item = this.getItem() ?? {}, replacements = {}, formatHTML = null) {
        return this._str_msg(msg, {}, item, replacements, formatHTML);
    }

    /**
     * Get message of a key with placeholder replacements.
     * @param {string} key - The message key.
     * @param {CmsFieldConfig} [cfg={}]
     * @param {Object} [item={}]
     * @param {Object} [source=null] - An optional source for the message key - defaults to translatedMessages.
     * @param {Object} [replacements={}] - Object with placeholder keys and values.
     * @param {Object} [formatHTML=null] - Object with default style parameters (color, bold, italic, align) if HTML format shall be used.
     * @returns {string}
     */
    _str_key(key, cfg = {}, item = {}, source = null, replacements = {}, formatHTML = null) {
        let msg = (source ?? this.translatedMessages)[key];
        if (msg == null) this.errorIfLog("Missing key in translation matrix:", key, { source });
        return this._str_msg(msg ?? `<${key}???>`, cfg, item, replacements, formatHTML);
    }

    /**
     * Get message with placeholder replacements.
     * @param {*} msg - The message (converted to a string) or a SafeHTML text.
     * @param {CmsFieldConfig} [cfg={}]
     * @param {Object} [item={}]
     * @param {Object} [replacements={}] - Object with placeholder keys and values.
     * @param {Object} [formatHTML=null] - Object with default style parameters (color, bold, italic, align) if HTML format shall be used.
     * @returns {string}
     */
    _str_msg(msg, cfg, item, replacements, formatHTML) {
        const combined = {
            ...cfg,
            ...item,
            itemName: this.translatedMessages.itemName,
            itemNamePlural: this.translatedMessages.itemNamePlural,
            diff: () => this.getDiff($w, item, true, formatHTML),
            diffUser: () => this.getDiff($w, item, true, formatHTML),
            diffIntern: () => this.getDiff($w, item, false, formatHTML),
            summary: () => this.getSummary($w, item, true, formatHTML),
            summaryUser: () => this.getSummary($w, item, true, formatHTML),
            summaryIntern: () => this.getSummary($w, item, false, formatHTML),
            item: () => Object.entries(item),
            itemKeys: () => Object.keys(item),
            ...replacements,
        };

        for (const cfg of Object.values(this.cmsSchema)) {
            const fn = () => this._printValue(cfg, $w, item, cfg.fields.map(f => item?.[f]), true, formatHTML);;
            combined[cfg.id] = fn;
            combined[cfg.label] = fn;
            combined[cfg.field] = fn;
        }

        return this._str_msg_replace(msg, combined, formatHTML);
    }

    /**
     * Get message with placeholder replacements. 
     * @param {*} msg - The message (converted to a string) or a SafeHTML text.
     * @param {Object} [replacements] - Object with placeholder keys and values.
     * @param {Object} [formatHTML=null] - Object with default style parameters (color, bold, italic, align) if HTML format shall be used.
     * @returns {string}
     */
    _str_msg_replace(msg, replacements, formatHTML = null) {
        class Text {
            constructor() {
                this.parts = []; // string | object | SafeHTML | Text
            }
            add(value) {
                if (typeof value == "string") {
                    // keep the parts list small by merging consecutive strings
                    if (this.parts.length > 0 && typeof this.parts[this.parts.length - 1] == "string")
                        this.parts[this.parts.length - 1] += value;
                    else
                        this.parts.push(value);
                } else if (value instanceof Text) {
                    for (const v of value.parts) this.add(v);
                } else if (Array.isArray(value)) {
                    for (const v of value) this.add(new List([v]));
                } else if (value != null) {
                    this.parts.push(value);
                }
            }
        }
        class List {
            constructor(items = []) {
                this.items = items; // Text | List | Table | string | object
            }
        }
        class TableRow {
            constructor(cells = []) {
                this.cells = cells; // Text | object | string | List
            }
        }
        class Table {
            constructor(rows = []) {
                this.rows = rows; // TableRow[]
            }
            isInline() { return this.rows.length == 1 && this.rows[0].cells.length == 1; }
        }
        const parse = (v) => {
            this.debug("parse", typeof v, v);
            if (v instanceof SafeHTML) return v;
            if (v instanceof TableHeader) return v;
            if (v instanceof TableCell) return v;
            if (Array.isArray(v)) return v.map(s => parse(s));

            let curCell = new Text();
            let curLine = new TableRow();
            let res = new Table();
            const s = typeof v == "object" ? JSON.stringify(v, null, 2) : String(v ?? "");

            let i = 0;
            while (i < s.length) {
                const ch = s[i];
                if (ch == "\n") {
                    curLine.cells.push(curCell);
                    res.rows.push(curLine);
                    curCell = new Text();
                    curLine = new TableRow();
                    ++i;
                } else if (ch == "\t") {
                    curLine.cells.push(curCell);
                    curCell = new Text();
                    ++i;
                } else if (ch == "{") {
                    let depth = 1;
                    let optionalBlock = false;
                    let inlineBlock = false;
                    let styleConfig = {};
                    let contentBuf = "";
                    let styleBuf = null;
                    let optBuf = null;
                    let j = i + 1;
                    let o = 0;
                    while (j < s.length) {
                        const chJ = s[j];
                        const isPrefix = j == i + 1 + o && depth == 1;
                        if (isPrefix && chJ == "?" && !optionalBlock) {
                            optionalBlock = true;
                            ++o;
                        } else if (isPrefix && chJ == "-" && !inlineBlock) {
                            inlineBlock = true;
                            ++o;
                        } else if (isPrefix && chJ == "@") {
                            let k = j + 1;
                            let inStyleKey = true;
                            let styleKey = "";
                            let styleVal = "";
                            while (k < s.length) {
                                const chK = s[k];
                                if (chK == "}") {
                                    this.errorIfLog("Missing ':' after '@' operator:", s.slice(j));
                                    break;
                                } else if (chK == ":") {
                                    if (styleKey.length > 0) styleConfig[styleKey] = inStyleKey ? true : styleVal;
                                    j = k;
                                    styleBuf = "";
                                    break;
                                } else if (chK == "=" && inStyleKey) {
                                    inStyleKey = false;
                                } else if (chK == ",") {
                                    styleConfig[styleKey] = inStyleKey ? true : styleVal;
                                    inStyleKey = true;
                                    styleKey = "";
                                    styleVal = "";
                                } else if (inStyleKey) styleKey += chK; else styleVal += chK;
                                ++k;
                            }
                        } else if (chJ == ":" && depth == 1 && optionalBlock && optBuf == null) {
                            optBuf = "";
                        } else {
                            if (chJ == "{") ++depth; else if (chJ == "}") --depth;
                            if (depth <= 0) {
                                ++j
                                break;
                            }
                            if (optBuf != null) optBuf += chJ;
                            else if (styleBuf != null) styleBuf += chJ;
                            else contentBuf += chJ;
                        }
                        ++j;
                    }
                    if (depth != 0) {
                        this.errorIfLog("Missing closing '}':", s.slice(i));
                        curCell.add(ch);
                        ++i;
                        continue;
                    }
                    if (optionalBlock && optBuf == null) {
                        this.errorIfLog("Missing ':' for {? placeholder:", s.slice(i));
                        curCell.add(ch);
                        ++i;
                        continue;
                    }
                    this.debug("got placeholder", { i, j, o, inlineBlock, styleConfig, contentBuf, styleBuf, optBuf });
                    let val = contentBuf;
                    if (contentBuf.length > 0) {
                        const valueOrFunc = replacements[contentBuf];
                        if (valueOrFunc == null) this.warn("Unknown placeholder, using as is:", contentBuf);
                        else val = typeof valueOrFunc == "function" ? valueOrFunc() : valueOrFunc;
                        this.debug("resolved placeholder", { contentBuf, val });
                    }
                    let parsed = null;
                    if (optBuf != null) {
                        if (val == null || val === "" || (Array.isArray(val) && val.length == 0)) {
                            this.debug("skipped parsing as content is empty");
                            i = j;
                            continue;
                        }
                        parsed = parse(optBuf);
                    } else if (Object.keys(styleConfig).length > 0) {
                        this.debug("got style config", { styleConfig });
                        parsed = new TableCell(parse(styleBuf), styleConfig);
                    } else
                        parsed = parse(val);
                    this.debug("parsed", parsed);
                    if (Array.isArray(parsed)) {
                        if (parsed.length > 0 && parsed.every(v => Array.isArray(v)) && parsed.some(v => v.length > 1)) {
                            // array of arrays -> table
                            const table = new Table();
                            for (const r of parsed) {
                                table.rows.push(new TableRow(r));
                            }
                            parsed = table;
                            this.debug("converted parsed to", { parsed });
                        }
                    }

                    if (inlineBlock) {
                        curLine.cells.push(curCell);
                        if (curLine.cells.length > 0) res.rows.push(curLine);
                        const flat = parsed instanceof Table ? parsed.rows : Array.isArray(parsed) ? parsed : [parsed];
                        for (const r of flat) {
                            if (r instanceof TableRow) {
                                res.rows.push(r);
                            } else {
                                const row = new TableRow();
                                row.cells = Array.isArray(r)
                                    ? r.map(c => c instanceof Text ? c : parse(c))
                                    : [r instanceof Text ? r : parse(r)];
                                res.rows.push(row);
                            }
                        }
                        curCell = new Text();
                        curLine = new TableRow();
                    } else if (parsed instanceof Table) {
                        if (parsed.isInline()) {
                            const cell = parsed.rows[0].cells[0];
                            if (typeof cell == "string" || cell instanceof Text || cell instanceof SafeHTML)
                                curCell.add(cell);
                            else {
                                if (curCell.parts.length > 0) {
                                    curLine.cells.push(curCell);
                                    curCell = new Text();
                                }
                                if (curLine.cells.length > 0) {
                                    res.rows.push(curLine);
                                    curLine = new TableRow();
                                }
                                const row = new TableRow();
                                row.cells = [parse(cell)];
                                res.rows.push(row);
                            }
                        } else {
                            if (curCell.parts.length > 0) {
                                curLine.cells.push(curCell);
                                curCell = new Text();
                            }
                            if (curLine.cells.length > 0) {
                                res.rows.push(curLine);
                                curLine = new TableRow();
                            }
                            for (const r of parsed.rows) res.rows.push(r);
                        }
                    } else
                        curCell.add(parsed);
                    i = j;
                } else {
                    curCell.add(ch);
                    ++i;
                }
            }
            if (curLine.cells.length > 0 || curCell.parts.length > 0) {
                curLine.cells.push(curCell);
                res.rows.push(curLine);
            }
            this.debug("parse result", res);

            return res;
        }

        const render = (value, formatHTML) => {
            this.debug("render", { value, formatHTML });
            if (value instanceof List) {
                if (formatHTML == null) return value.items.map(item => ` - ${render(item, null)}`).join("\n");
                return "</span><ul>\n" +
                    value.items.map(item => `<li${this._clsStyle(formatHTML)}>${render(item, formatHTML)}</li>`).join("") +
                    `</ul><span${this._clsStyle(formatHTML)}>\n`;
            }

            if (value instanceof Table) {
                if (formatHTML == null) return value.rows.map(row => render(row, null)).join("\n");
                if (value.isInline()) return render(value.rows[0].cells[0], formatHTML); // avoid unnecessary table for single cell
                let res = `</span><table>\n`;
                let alignments = [];
                //let prevColCount = -1;
                let maxColumns = 0;
                for (const row of value.rows) maxColumns = Math.max(maxColumns, row.cells.length);
                for (const row of value.rows) {
                    this.debug("render row", { row, formatHTML });
                    //let colCount = row.cells.length;
                    //if (prevColCount != -1 && prevColCount != colCount) {
                    // start a new table TODO
                    //res += `</table><table>\n`;
                    //alignments = [];
                    //}
                    //prevColCount = colCount;
                    if (row.cells.some((cell) => cell instanceof TableHeader)) alignments = row.cells.map(cell => cell instanceof TableHeader ? cell.formatHTML?.align : null);
                    res += render(row, Object.assign({}, formatHTML, { alignments, maxColumns }));
                }
                res += `</table><span${this._clsStyle(formatHTML)}>`;
                return res;
            }

            if (value instanceof TableRow) {
                if (formatHTML == null) return value.cells.map(cell => render(cell, null)).join("\t");
                const isHeaderRow = value.cells.some((cell) => cell instanceof TableHeader);
                const tag = isHeaderRow ? "th" : "td";
                let res = "<tr>";
                for (let ci = 0; ci < value.cells.length; ci++) {
                    const format = { ...formatHTML, padding: formatHTML?.padding ?? 8 };
                    let merge = Math.max(0, (format.maxColumns ?? 0) - value.cells.length);
                    while (ci + merge + 1 < value.cells.length && value.cells[ci + merge + 1] == null) ++merge;
                    const colspan = merge > 0 ? ` colspan="${merge + 1}"` : "";
                    if (format.alignments?.[ci]) format.align = format.alignments[ci];
                    const cell = value.cells[ci];
                    if ((cell instanceof TableHeader || cell instanceof TableCell) && cell?.formatHTML)
                        for (const k in cell.formatHTML) format[k] = cell.formatHTML[k];
                    if (cell != null) {
                        const alignTopHack = "&#8203;"; // TODO only if needed
                        res += `<${tag}${this._clsStyle(format)}${colspan}>${alignTopHack}${render(cell, format)}</${tag}>`;
                        ci += merge;
                    }
                }
                res += "</tr>\n";
                return res;
            }

            if (value instanceof Text)
                return value.parts.map(p => render(p, formatHTML)).join("");

            if (value instanceof SafeHTML)
                return formatHTML == null ? render(value.plain, null) : value.html;

            if (value instanceof TableHeader)
                return render(value.label, formatHTML == null ? null : { ...formatHTML, ...value.formatHTML });

            if (value instanceof TableCell)
                return render(value.value, formatHTML == null ? null : { ...formatHTML, ...value.formatHTML });

            if (Array.isArray(value)) {
                return value.map(v => render(v, formatHTML)).join(formatHTML ? "<br>" : "\n");
            }

            const s = typeof value == "object" ? JSON.stringify(value, null, 2) : String(value ?? "");
            return formatHTML == null ? s :
                s
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#39;");
        };

        const parsed = parse(msg);
        this.log("finally parsed\n", debugStructure(parsed));
        const res = formatHTML == null ? render(parsed, null) : `<span${this._clsStyle(formatHTML)}>${render(parsed, formatHTML)}</span>\n`;
        this.log("finally rendered", res);
        return res;

        function debugStructure(value, indent = 0) {
            const pad = "  ".repeat(indent);

            if (value instanceof Table) {
                return `${pad}Table\n` +
                    value.rows.map(r => debugStructure(r, indent + 1)).join("");
            }

            if (value instanceof TableRow) {
                return `${pad}Row\n` +
                    value.cells.map(c => debugStructure(c, indent + 1)).join("");
            }

            if (value instanceof Text) {
                return `${pad}Text\n` +
                    value.parts.map(p => debugStructure(p, indent + 1)).join("");
            }

            if (value instanceof List) {
                return `${pad}List\n` +
                    value.items.map(i => debugStructure(i, indent + 1)).join("");
            }

            if (value instanceof SafeHTML) {
                return `${pad}SafeHTML(html=${value.html?.slice(0, 40) ?? ""}...)\n`;
            }

            if (value instanceof TableHeader) {
                return `${pad}Header(label=${typeof value.label}: ${JSON.stringify(value.label)}, formatHTML=${JSON.stringify(value.formatHTML)})\n`;
            }

            if (value instanceof TableCell) {
                return `${pad}Cell(value=${typeof value.value}: ${JSON.stringify(value.value)}, formatHTML=${JSON.stringify(value.formatHTML)})\n`;
            }

            if (Array.isArray(value)) {
                return `${pad}Array\n` +
                    value.map(v => debugStructure(v, indent + 1)).join("");
            }

            return `${pad}${JSON.stringify(value)}\n`;
        }
    }

    postMessageToDatePicker(cfg, scope, message) {
        const elPicker = scope(cfg.datePicker);
        if (this.isElement(elPicker)) {
            this.log("postMessage to", cfg.datePicker, ":", message);
            elPicker.postMessage(message);
        } else
            this.errorIfLog("Cannot find datePicker element", cfg.datePicker);
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
        const el = $w(buttonName);
        if (!this.isElement(el)) {
            this.warn("Edit-button does not exist:", buttonName);
            return;
        }
        const update = async () => {
            const roles = await currentMember.getRoles();
            const showButton = roles.some((role) => role._id == roleID);
            if (showButton) el.show(); else el.hide();
        };
        if (el) {
            authentication.onLogin(() => update());
            authentication.onLogout(() => update());
            update();
            el.onClick(() => {
                const item_ = item ?? this.getItem();
                this.log("Clicked on", buttonName, ": Navigating to", location, "with", item_?._id);
                if (item_) wixLocation.to(`/${location}?id=${item_._id}`, { target: '_blank' });
            });
        }
    }

    errorIfLog(...args) {
        if (LOG_CMSEDIT) console.error(...args.map(a => this._safeLog(a)));
    }

    error(...args) {
        console.error(...args.map(a => this._safeLog(a)));
    }

    warn(...args) {
        if (LOG_CMSEDIT) console.warn(...args.map(a => this._safeLog(a)));
    }

    log(...args) {
        if (LOG_CMSEDIT) console.log(...args.map(a => this._safeLog(a)));
    }

    debug(...args) {
        if (VERBOSE_CMSEDIT) console.debug(...args.map(a => this._safeLog(a)));
    }

    _safeLog(v, depth = 0, seenOnPath = new Set()) {
        if (depth > 6) return "...";
        if (v == null) return "[null]";
        if (typeof v == "function") return `[Function: ${v.toString().slice(0, 30)}...]`;
        if (typeof v != "object") return v;

        if (seenOnPath.has(v)) return "[Circular]";
        seenOnPath.add(v);
        try {
            if (Array.isArray(v)) return v.map(v => this._safeLog(v, depth + 1, seenOnPath));
            if ("id" in v && "show" in v && "hide" in v && "parent" in v)
                return { "WixElement": "", id: v.id, type: v.type, value: v.value };
            const res = {};
            for (const k of Object.keys(v)) try {
                res[k] = this._safeLog(v[k], depth + 1, seenOnPath);
            } catch (e) {
                res[k] = `[Unloggable: ${e}]`;
            }
            return res;
        } finally {
            seenOnPath.delete(v);
        }
    }

}
