import { CmsEditor, FieldType, FilterType, FilterCombine } from 'public/cms_edit.js';
import { dateRangeToString, listAllRanges, printRanges, incUTCDate } from 'public/cms.js';

let editor;

$w.onReady(function () {
    $w("#datesRepeater").value = {};
    editor = new CmsEditor({
        cmsName: "events",
        dataSetName: "datasetEvents",

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
                type: FieldType.STRING
            },
            "#responsiblePhoneField": {
                field: "responsiblePhone",
                type: FieldType.STRING
            },
        },

        filterSortField: "title",
        filterSchema: {
            "#filterSearch": {
                type: FilterType.CONTAINS,
                combine: FilterCombine.OR,
                fields: ["title", "subTitle", "description", "price", "address", "dates", "registration", "responsible", "responsibleMail", "responsiblePhone"],
                value: (val) => val.toString().trim(),
            },
            "#filterAlsoPast": {
                type: FilterType.GE,
                skip: (val) => val, // only apply if not checked
                value: () => incUTCDate(new Date(), 1),
                field: "dateTo",
            },
            "#filterType": {
                type: FilterType.EQ,
                field: "type"
            },
            "#filterSport": {
                type: FilterType.HAS_SOME,
                field: "sports"
            },
        },

        onRefreshUI: (item) => { refreshDateRangeText(item?.dates || []) },
    });

    editor.init();
});

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
