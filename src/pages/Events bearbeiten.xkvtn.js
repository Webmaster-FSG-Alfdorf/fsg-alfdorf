import { CmsEditor, FieldType, FilterType } from 'public/cms_edit.js';
import { dateRangeToString, listAllRanges, printRanges, incUTCDate } from 'public/cms.js';

let editor;

$w.onReady(function () {
    $w("#datesRepeater").value = {};
    editor = new CmsEditor({
        cmsName: "events",
        dataSetName: "datasetEvents",

        cmsSchema: {
            "#titleField": { field: "title", type: FieldType.STRING, required: true },
            "#subTitleField": { field: "subTitle", type: FieldType.STRING },
            "#datesRepeater": {
                field: "dates",
                type: FieldType.REPEATER,
                inputs: {
                    "#pickerDatesStart": { field: "start", type: FieldType.DATE },
                    "#pickerDatesStartTime": { field: "start", type: FieldType.TIME_OF_DATE },
                    "#pickerDatesEnd": { field: "end", type: FieldType.DATE },
                    "#pickerDatesEndTime": { field: "end", type: FieldType.TIME_OF_DATE },
                    "#dropdownDatesType": { field: "recurrenceType", type: FieldType.SELECT },
                    "#dropdownDatesInterval": { field: "recurrenceInterval", type: FieldType.NUMBER },
                    "#checkboxDatesWeekdays": { field: "recurrenceDays", type: FieldType.CHECKBOX_GROUP }
                },
                onDisplayValue: (item) => editor.ensureArray(item?.dates).map(ed => printRanges(ed)).join(", "),
                onChanged: () => refreshDateRangeText(),
            },
            "#sportsField": { field: "sports", type: FieldType.MULTI_REFERENCE, dataSet: "sports", onGenerateLabel: (item) => item.name, required: true },
            "#mainImageField": { field: "mainImage", type: FieldType.IMAGE, required: true },
            "#galleryField": { field: "gallery", type: FieldType.IMAGES },
            "#descriptionField": { field: "description", type: FieldType.RICH_TEXT, required: true },
            "#priceField": { field: "price", type: FieldType.STRING },
            "#onGroundField": { field: "onGround", type: FieldType.BOOLEAN },
            "#addressField": { field: "address", type: FieldType.ADDRESS },
            "#typeField": { field: "type", type: FieldType.SELECT, required: true },
            "#youthField": { field: "youth", type: FieldType.BOOLEAN, },
            "#registrationField": { field: "registration", type: FieldType.DATE },
            "#responsibleField": { field: "responsible", type: FieldType.STRING },
            "#responsibleMailField": { field: "responsibleMail", type: FieldType.STRING },
            "#responsiblePhoneField": { field: "responsiblePhone", type: FieldType.STRING },
        },

        filterSortField: "title",
        filterSchema: {
            "#filterSearch": {
                type: FilterType.CONTAINS,
                orCombined: true,
                fields: ["title", "subTitle", "description", "price", "address", "dates", "registration", "responsible", "responsibleMail", "responsiblePhone"],
                skip: (val) => !val,
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
                skip: (val) => !val || val == "*",
                field: "type"
            },
            "#filterSport": {
                type: FilterType.HAS_SOME,
                skip: (val) => !val || val == "*",
                field: "sports"
            },
        },

        onRefreshUI: refreshDateRangeText,
    });

    if (false) $w("#datesRepeater").onItemReady(($item, itemData, index) => {
        const togglePickers = () => {
            const type = $item("#dropdownDatesType").value;
            const interval = parseInt($item("#dropdownDatesInterval").value) || 0;
            if (interval > 0 && type == "weekly") $item("#checkboxDatesWeekdays").expand(); else $item("#checkboxDatesWeekdays").collapse();
            if (interval > 0) $item("#dropdownDatesType").expand(); else $item("#dropdownDatesType").collapse();
            if (interval > 0 && type == "monthly") $item("#dropdownMonthlyRepetition").expand(); else $item("#dropdownMonthlyRepetition").collapse();
        };

        const setDateTime = (pickerDate, pickerTime, date) => {
            pickerDate.value = date;
            pickerTime.value = date ? date.getHours().toString().padStart(2, '0') + ":" + date.getMinutes().toString().padStart(2, '0') : "";
        };
        setDateTime($item("#pickerDatesStart"), $item("#pickerDatesStartTime"), itemData.start);
        setDateTime($item("#pickerDatesEnd"), $item("#pickerDatesEndTime"), itemData.end);
        $item("#dropdownDatesType").value = itemData.recurrenceType || "daily";
        $item("#dropdownDatesInterval").value = itemData.recurrenceInterval || 0;
        $item("#checkboxDatesWeekdays").value = itemData.recurrenceDays || [];
        $item("#dropdownMonthlyRepetition").value = itemData.monthlyRepetition || "weekday";

        $item("#pickerDatesStart").onChange(() => updateDatesArrayTime(index, 'start', $item("#pickerDatesStart").value, $item("#pickerDatesStartTime").value));
        $item("#pickerDatesEnd").onChange(() => updateDatesArrayTime(index, 'end', $item("#pickerDatesEnd").value, $item("#pickerDatesEndTime").value));
        $item("#pickerDatesStartTime").onChange(() => updateDatesArrayTime(index, 'start', $item("#pickerDatesStart").value, $item("#pickerDatesStartTime").value));
        $item("#pickerDatesEndTime").onChange(() => updateDatesArrayTime(index, 'end', $item("#pickerDatesEnd").value, $item("#pickerDatesEndTime").value));
        $item("#dropdownDatesType").onChange(() => {
            togglePickers();
            updateDatesArray(index, 'recurrenceType', $item("#dropdownDatesType").value);
        });
        $item("#dropdownDatesInterval").onChange(() => {
            togglePickers();
            updateDatesArray(index, 'recurrenceInterval', $item("#dropdownDatesInterval").value);
        });
        $item("#checkboxDatesWeekdays").onChange(() => updateDatesArray(index, 'recurrenceDays', $item("#checkboxDatesWeekdays").value));
        $item("#dropdownMonthlyRepetition").onChange(() => updateDatesArray(index, 'monthlyRepetition', $item("#dropdownMonthlyRepetition").value));

        $item("#btnDateRemove").onClick(() => { removeDate(index) });

        togglePickers();
    });
    if (false) $w("#btnDateAdd").onClick(() => { addDate() });

    editor.init();
});

function addDate() {
    console.log("Adding new date to event");
    $w("#datesRepeater").value.push({
        start: new Date(),
        end: new Date(),
        recurrenceType: "daily",
        recurrenceInterval: 1,
        recurrenceDays: []
    });
    editor.updateDataFromUI("#datesRepeater");
}

function removeDate(index) {
    console.log("Removing date from event");
    $w("#datesRepeater").value.splice(index, 1);
    editor.updateDataFromUI("#datesRepeater");
}

function updateDatesArray(index, field, value) {
    $w("#datesRepeater").value[index][field] = value;
    editor.updateDataFromUI("#datesRepeater");
}

function updateDatesArrayTime(index, field, date, time) {
    let finalDate = new Date(date);
    const [hours, minutes] = (time || "00:00").split(':');
    finalDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
    $w("#datesRepeater").value[index][field] = finalDate;
    editor.updateDataFromUI("#datesRepeater");
}

function refreshDateRangeText() {
    let allDates = new Map();
    $w("#datesRepeater").value?.forEach(ed => listAllRanges(ed).forEach(dr => { allDates.set(dr.start.getTime(), dr) }));
    let html = "Übersicht:<ul>";
    $w("#datesRepeater").value?.forEach(ed => { html += "<li>" + printRanges(ed); });
    html += `</ul><br><br>Detailierte Ausgabe:<ul>`;
    Array.from(allDates.values()).sort((dr0, dr1) => dr0.start - dr1.start).forEach(dr => {
        html += "<li>" + `${dateRangeToString(dr.start, dr.end)}`;
    });
    $w("#textDateRange").html = html + "</ul>";

    $w("#datesRepeater").forEachItem(($item, itemData, index) => {
        const type = $item("#dropdownDatesType").value;
        const interval = parseInt($item("#dropdownDatesInterval").value) || 0;
        if (interval > 0 && type == "weekly") $item("#checkboxDatesWeekdays").expand(); else $item("#checkboxDatesWeekdays").collapse();
        if (interval > 0) $item("#dropdownDatesType").expand(); else $item("#dropdownDatesType").collapse();
        if (interval > 0 && type == "monthly") $item("#dropdownMonthlyRepetition").expand(); else $item("#dropdownMonthlyRepetition").collapse();
    });
}
