import { CmsEditor, FieldType, FilterType, FilterCombine, SafeHTML } from 'public/cms_edit.js';
import { dateRangeToString, listAllRanges, printRanges } from 'public/cms.js';
import { ROLES } from "public/cms.js";
import wixLocation from 'wix-location';

export function initEventsEditor(editMode, youth, cfg) {
    const editor = new CmsEditor({
        editMode,
        cmsName: "events",
        dataSetName: "datasetEvents",
        viewModeURL: "events",

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
                label: "Titel",
                type: FieldType.STRING,
                required: true
            },
            "#subTitleField": {
                field: "subTitle",
                label: "Untertitel",
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
                        default: (() => {
                            const d = new Date();
                            return new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        })(),
                        onChanged: (item, values) => {
                            const start = new Date(item?.start);
                            const end = new Date(item?.end);
                            if (!isNaN(start) && (isNaN(end) || end < start)) {
                                item.end = start;
                                editor.updateUIFromData("#datesRepeater");
                            }
                        },
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
                        default: (() => {
                            const d = new Date();
                            return new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        })(),
                    },
                    "#pickerDatesEndTime": {
                        field: "end",
                        type: FieldType.TIME_OF_DATE,
                        required: true
                    },
                },
                addButton: "#btnDateAdd",
                removeButton: "#btnDateRemove",
                onPrintValue: (item) => {
                    const gcalIcon = "https://www.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_16_2x.png";
                    const outlookIcon = "https://img.icons8.com/color/48/000000/outlook-calendar.png";
                    const title = encodeURIComponent(item.title);
                    const details = encodeURIComponent(editor.getString(
                        `{source}\n{eventsSummary}`, item, {
                        source: new SafeHTML(`Quelle: <a href="${wixLocation.url}">www.fsg-alfdorf.de</a>`),
                        eventsSummary: new SafeHTML(getEventsSummary(editor, item, false))
                    }, {}));
                    const location = encodeURIComponent(item.address?.formatted || "");
                    const formatIso = (date) => new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
                    const formatOutlook = (date) => {
                        const d = new Date(date);
                        const pad = n => String(n).padStart(2, "0");
                        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                    };

                    let allDates = new Map();
                    (item?.dates || []).forEach(ed => listAllRanges(ed).forEach(dr => { allDates.set(dr.start.getTime(), dr) }));
                    return [...allDates.values()].sort((dr0, dr1) => dr0.start - dr1.start).map(dr => {
                        const s = printRanges(dr);
                        const gcalUrl =
                            `https://calendar.google.com/calendar/render?action=TEMPLATE` +
                            `&text=${title}` +
                            `&details=${details}` +
                            `&location=${location}` +
                            `&dates=${formatIso(dr.start)}/${formatIso(dr.end)}`;
                        const outlookUrl =
                            `https://outlook.live.com/calendar/0/deeplink/compose` +
                            `?subject=${title}` +
                            `&body=${details}` +
                            `&location=${location}` +
                            `&startdt=${encodeURIComponent(formatOutlook(dr.start))}` +
                            `&enddt=${encodeURIComponent(formatOutlook(dr.end))}` +
                            `&tz=Europe%2FBerlin&allday=false`;
                        return new SafeHTML(
                            `${s}&nbsp;<a href="${gcalUrl}" target="_blank"><img width="22" src="${gcalIcon}"></a>` +
                            `&nbsp;<a href="${outlookUrl}" target="_blank"><img width="22" src="${outlookIcon}"></a>`,
                            s
                        );
                    });
                },
                onChanged: (item, values) => refreshDateRangeText(values),
            },
            "#sportsField": {
                field: "sports",
                label: "Sportarten",
                type: FieldType.MULTI_REFERENCE,
                dataSet: "sports",
                onGenerateLabel: (item) => item.name,
                required: true
            },
            "#mainImageField": {
                field: "mainImage",
                label: "Hauptbild",
                type: FieldType.IMAGE,
                required: true
            },
            "#galleryField": {
                field: "gallery",
                label: "Galerie",
                type: FieldType.IMAGES
            },
            "#descriptionField": {
                field: "description",
                label: "Beschreibung",
                type: FieldType.RICH_TEXT,
                required: true
            },
            "#priceField": {
                field: "price",
                label: "Preis",
                type: FieldType.STRING
            },
            "#onGroundField": {
                field: "onGround",
                label: "Auf unserem Gelände?",
                type: FieldType.BOOLEAN
            },
            "#addressField": {
                field: "address",
                label: "Ort",
                type: FieldType.ADDRESS
            },
            "#typeField": {
                field: "type",
                label: "Art der Veranstaltung",
                type: FieldType.SELECT,
                required: true,
                options: ["Offizielles", "Fest", "Ausflug", "Gemeinschaftsevent", "Sportveranstaltung", "Sport-Turnier"],
            },
            "#youthField": {
                field: "youth",
                label: "Jugend?",
                type: FieldType.BOOLEAN,
            },
            "#registrationField": {
                field: "registration",
                label: "Anmeldung bis",
                type: FieldType.DATE,
                resetButton: "#registrationFieldReset"
            },
            "#responsibleField": {
                field: "responsible",
                label: "Verantwortlicher",
                type: FieldType.STRING
            },
            "#responsibleMailField": {
                field: "responsibleMail",
                label: "E-Mail des Verantwortlichen",
                type: FieldType.STRING_MAIL
            },
            "#responsiblePhoneField": {
                field: "responsiblePhone",
                label: "Telefonnummer des Verantwortlichen",
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
                skip: (val) => !val || val == "*",
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

export function getEventsSummary(editor, item, includeDates = true) {
    return editor.getString(
        "{description}\n"
        + "{@width=0:🏷️}\t{type}\n"
        + (includeDates ? "{?dates:{@width=0:📅}\t{dates}\n}" : "")
        + "{?price:{@width=0:🪙}\t{price}\n}"
        + "{?address:{@width=0:📍}\t{address}\n}"
        + "{?onGround:{@width=0:📍}\tAuf unserem Gelände\n}"
        + "{?registration:{@width=0:📝}\tAnmeldung bis {registration}\n}"
        + "{?responsible:{@width=0:👤}\t{responsible}{?responsibleMail:\n✉️{responsibleMail}}{?responsiblePhone: \n📞{responsiblePhone}}\n}"
        + "",
        item,
        { rsp: "{responsible}{?responsibleMail:\n✉️{responsibleMail}}{?responsiblePhone:\n📞{responsiblePhone}}" }, //TODO
        {}
    );
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
