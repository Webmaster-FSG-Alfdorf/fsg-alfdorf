import { CmsEditor, FieldType, FilterType, FilterCombine } from 'public/cms_edit.js';
import { dateRangeToString, listAllRanges, printRanges, incUTCDate } from 'public/cms.js';
import { ROLES } from "public/cms.js";

export function initEventsEditor(editMode, youth, cfg) {
    const editor = new CmsEditor({
        editMode,
        cmsName: "events",
        dataSetName: "datasetEvents",
        viewModeURL: "event",

        itemSelector: $w("#itemSelector"),
        textResponse: $w("#textResponse"),
        buttonSave: $w("#buttonSave"),
        buttonRevert: $w("#buttonRevert"),
        buttonNew: $w("#buttonNew"),
        buttonRemove: $w("#buttonRemove"),
        buttonPrev: $w("#buttonPrev"),
        buttonNext: $w("#buttonNext"),
        buttonView: $w("#buttonView"),

        translatedMessages: {
            itemName: "Veranstaltung",
            itemNamePlural: "Veranstaltungen",
            repeaterSummaries: {
                one: "1 passende {itemName}",
            },
        },

        generateTitle: (item) => item?.title,
        onRefreshUI: (item) => { refreshDateRangeText(item?.dates || []) },

        cmsSchema: {
            "#titleField": {
                field: "title",
                type: FieldType.STRING,
                required: true
            },
            "#subTitleField": {
                field: "subTitle",
                type: FieldType.STRING
            },
            "#datesRepeater": {
                field: "dates",
                type: FieldType.REPEATER,
                inputs: {
                    "#pickerDatesStart": {
                        field: "start",
                        type: FieldType.DATE,
                        required: true,
                        default: new Date()
                    },
                    "#pickerDatesStartTime": {
                        field: "start",
                        type: FieldType.TIME_OF_DATE,
                        required: true
                    },
                    "#dropdownDatesInterval": {
                        field: "recurrenceInterval",
                        type: FieldType.NUMBER,
                        default: 0
                    },
                    "#dropdownDatesType": {
                        field: "recurrenceType",
                        type: FieldType.SELECT,
                        default: "daily",
                        visible: (item) => item?.recurrenceInterval > 0
                    },
                    "#checkboxDatesWeekdays": {
                        field: "recurrenceDays",
                        type: FieldType.MULTI_SELECT,
                        required: true,
                        visible: (item) => item?.recurrenceInterval > 0 && item?.recurrenceType == "weekly"
                    },
                    "#dropdownMonthlyRepetition": {
                        field: "monthlyRepetition",
                        type: FieldType.SELECT,
                        default: "weekday",
                        visible: (item) => item?.recurrenceInterval > 0 && item?.recurrenceType == "monthly"
                    },
                    "#pickerDatesEnd": {
                        field: "end",
                        type: FieldType.DATE,
                        required: true,
                        default: new Date()
                    },
                    "#pickerDatesEndTime": {
                        field: "end",
                        type: FieldType.TIME_OF_DATE,
                        required: true
                    },
                },
                addButton: "#btnDateAdd",
                removeButton: "#btnDateRemove",
                onPrintValue: (item) => editor.ensureArray(item?.dates).map(ed => printRanges(ed)).join(", "),
                onChanged: (item, values) => refreshDateRangeText(values),
            },
            "#sportsField": {
                field: "sports",
                type: FieldType.MULTI_REFERENCE,
                dataSet: "sports",
                onGenerateLabel: (item) => item.name,
                required: true
            },
            "#mainImageField": {
                field: "mainImage",
                type: FieldType.IMAGE,
                required: true
            },
            "#galleryField": {
                field: "gallery",
                type: FieldType.IMAGES
            },
            "#descriptionField": {
                field: "description",
                type: FieldType.RICH_TEXT,
                required: true
            },
            "#priceField": {
                field: "price",
                type: FieldType.STRING
            },
            "#onGroundField": {
                field: "onGround",
                type: FieldType.BOOLEAN
            },
            "#addressField": {
                field: "address",
                type: FieldType.ADDRESS
            },
            "#typeField": {
                field: "type",
                type: FieldType.SELECT,
                required: true
            },
            "#youthField": {
                field: "youth",
                type: FieldType.BOOLEAN,
            },
            "#registrationField": {
                field: "registration",
                type: FieldType.DATE,
                resetButton: "#registrationFieldReset"
            },
            "#responsibleField": {
                field: "responsible",
                type: FieldType.STRING
            },
            "#responsibleMailField": {
                field: "responsibleMail",
                type: FieldType.STRING_MAIL
            },
            "#responsiblePhoneField": {
                field: "responsiblePhone",
                type: FieldType.STRING_PHONE
            },
        },

        filterSortResults: (a, b) => {
            const aMin = a.dates && a.dates.length > 0 ? Math.min(...a.dates.map(d => new Date(d.start))) : Infinity;
            const bMin = b.dates && b.dates.length > 0 ? Math.min(...b.dates.map(d => new Date(d.start))) : Infinity;
            return aMin - bMin;
        },
        filterSchema: {
            "#filterSearch": {
                type: FilterType.CONTAINS,
                combine: FilterCombine.OR,
                fields: ["title", "subTitle", "description", "price", "address", "dates", "registration", "responsible", "responsibleMail", "responsiblePhone"],
                value: (val) => val ? val.toString().trim() : "",
            },
            "#filterSport": {
                type: FilterType.HAS_SOME,
                field: "sports"
            },
            "#checkboxOnGround": {
                type: FilterType.EQ,
                skip: (val) => !val,
                field: "onGround"
            },
            "#checkboxNoReservation": {
                type: FilterType.IS_EMPTY,
                field: "alltime"
            },
            "#checkboxNoPrice": {
                type: FilterType.IS_EMPTY,
                field: "price"
            },
            "#dropdownType": {
                type: FilterType.HAS_SOME,
                skip: (val) => !val || val == "Alle",
                value: (val) => val == "Sport-Event" ? [val, "Sport-Turnier"] : [val],
                field: "type"
            },
            "#checkboxAlsoPast": {
                type: FilterType.CUSTOM,
                skip: (val) => val, // only apply if not checked
                onFilterResults: (items) => {
                    const now = new Date();
                    return items.filter(v => {
                        const firstStart = v.dates && v.dates.length > 0 ? new Date(v.dates[0].start) : null;
                        return firstStart && firstStart >= now;
                    });
                }
            },
            "youth-filter": {
                id: "",
                type: FilterType.EQ,
                field: "youth",
                value: true,
                skip: () => !youth,
                countsAsFiltered: false
            },
        },

        ...cfg
    });
    editor.init();
    editor.setupEditButton("#buttonEdit", ROLES.EVENTS_EDIT.slug, ROLES.EVENTS_EDIT.id, editor.getItem());
    return editor;
}

function refreshDateRangeText(values) {
    if (Array.isArray(values) && values.length > 0 && Array.isArray(values[0])) {
        console.trace("Error in parameter", values);
    }
    console.log("refreshDateRangeText", values);
    if (!Array.isArray(values)) return;
    let allDates = new Map();
    values.forEach(ed => listAllRanges(ed).forEach(dr => { allDates.set(`${dr.start?.getTime()}-${dr.end?.getTime()}`, dr) }));
    let html = "Übersicht:<ul>";
    values.forEach(ed => { html += `<li>${printRanges(ed)}</li>`; });
    html += `</ul><br><br>Detailierte Ausgabe:<ul>`;
    Array.from(allDates.values()).sort((dr0, dr1) => dr0.start - dr1.start).forEach(dr => {
        html += `<li>${dateRangeToString(dr.start, dr.end)}</li>`;
    });
    $w("#textDateRange").html = html + "</ul>";
}
