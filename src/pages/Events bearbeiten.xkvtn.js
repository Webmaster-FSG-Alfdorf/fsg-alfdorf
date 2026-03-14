import { CmsEditor } from 'public/cms_edit.js';
import { dateRangeToString, listAllRanges, printRanges } from 'public/cms.js';

let editor;

$w.onReady(function () {
    editor = new CmsEditor({
        cmsName: "events",
        dataSetName: "datasetEvents",
        cmsSchema: {

        },
        onRefreshUI: refreshDatesUI
    });

    $w("#datesRepeater").onItemReady(($item, itemData, index) => {
        const togglePickers = () => {
            if ($item("#dropdownDatesType").value === "weekly") $item("#checkboxDatesWeekdays").expand(); else $item("#checkboxDatesWeekdays").collapse();
            if (parseInt($item("#dropdownDatesInterval").value) != 0) $item("#dropdownDatesType").expand(); else $item("#dropdownDatesType").collapse();
            if ($item("#dropdownDatesType").value === "monthly") $item("#dropdownMonthlyRepetition").expand(); else $item("#dropdownMonthlyRepetition").collapse();
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

        $item("#btnDateRemove").onClick(() => { removeDate(index); });

        togglePickers();
    });

    $w("#btnDateAdd").onClick(() => { addDate(); });

    editor.init();
});

function addDate() {
    console.log("Adding new date to event");
    let dates = $w("#eventsDataset").getCurrentItem().dates || [];
    dates.push({
        start: new Date(),
        end: new Date(),
        recurrenceType: "daily",
        recurrenceInterval: 1,
        recurrenceDays: []
    });
    $w("#eventsDataset").setFieldValue("dates", dates);
    refreshDatesUI();
}

function removeDate(index) {
    console.log("Removing date from event");
    let dates = $w("#eventsDataset").getCurrentItem().dates;
    dates.splice(index, 1);
    $w("#eventsDataset").setFieldValue("dates", dates);
    refreshDatesUI();
}

function refreshDatesUI() {
    const item = $w("#eventsDataset").getCurrentItem();
    const dates = (item && item.dates) ? item.dates : [];
    $w("#datesRepeater").data = dates.map((d, i) => ({ ...d, _id: i.toString() }));
    refreshDateRangeText();
}

function updateDatesArray(index, field, value, timeValue = null) {
    let dates = $w("#eventsDataset").getCurrentItem().dates;
    dates[index][field] = value;
    $w("#eventsDataset").setFieldValue("dates", dates);
    refreshDateRangeText();
}

function updateDatesArrayTime(index, field, date, time) {
    let dates = $w("#eventsDataset").getCurrentItem().dates;
    let finalDate = new Date(date);
    const [hours, minutes] = (time || "00:00").split(':');
    finalDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
    dates[index][field] = finalDate;
    $w("#eventsDataset").setFieldValue("dates", dates);
    refreshDateRangeText();
}

function refreshDateRangeText() {
    const item = $w("#eventsDataset").getCurrentItem();
    const dates = (item && item.dates) ? item.dates : [];
    let allDates = new Map();
    (dates || []).forEach(ed => listAllRanges(ed).forEach(dr => { allDates.set(dr.start.getTime(), dr) }));
    let html = "Übersicht:<ul>";
    (dates || []).forEach(ed => { html += "<li>" + printRanges(ed); });
    html += `</ul><br><br>Detailierte Ausgabe:<ul>`;
    Array.from(allDates.values()).sort((dr0, dr1) => dr0.start - dr1.start).forEach(dr => {
        html += "<li>" + `${dateRangeToString(dr.start, dr.end)}`;
    });
    $w("#textDateRange").html = html + "</ul>";
}
