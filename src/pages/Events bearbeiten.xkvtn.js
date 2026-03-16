import { CmsEditor, FieldType } from 'public/cms_edit.js';
import { dateRangeToString, listAllRanges, printRanges } from 'public/cms.js';

let editor;

$w.onReady(function () {
    editor = new CmsEditor({
        cmsName: "events",
        dataSetName: "datasetEvents",
        cmsSchema: {
            "#titleField": { field: "title", type: FieldType.STRING },
            "#subTitleField": { field: "subTitle", type: FieldType.STRING },
            //"#input2": { field: "sportarten", type: FieldType.MULTI_REFERENCE }, // TODO: Sportarten Logik
            "#mainImageField": { field: "mainImage", type: FieldType.IMAGE },
            "#galleryField": { field: "gallery", type: FieldType.IMAGES },
            "#descriptionField": { field: "description", type: FieldType.RICH_TEXT },
            "#priceField": { field: "price", type: FieldType.STRING },
            "#onGroundField": { field: "onGround", type: FieldType.BOOLEAN },
            "#addressField": { field: "address", type: FieldType.ADDRESS },
            "#typeField": { field: "type", type: FieldType.SELECT },
            "#youthField": { field: "youth", type: FieldType.BOOLEAN },
            "#registrationField": { field: "registration", type: FieldType.DATE },
            "#responsibleField": { field: "responsible", type: FieldType.STRING },
            "#responsibleMailField": { field: "responsibleMail", type: FieldType.STRING },
            "#responsiblePhoneField": { field: "responsiblePhone", type: FieldType.STRING }
        },
        onRefreshUI: refreshDatesUI,
        onQueryUpdate: doQueryUpdate
    });

    $w("#datesRepeater").onItemReady(($item, itemData, index) => {
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
    $w("#btnDateAdd").onClick(() => { addDate() });

    editor.init();
});

function addDate() {
    console.log("Adding new date to event");
    let dates = editor.ds.getCurrentItem().dates || [];
    dates.push({
        start: new Date(),
        end: new Date(),
        recurrenceType: "daily",
        recurrenceInterval: 1,
        recurrenceDays: []
    });
    editor.ds.setFieldValue("dates", dates);
    refreshDatesUI();
}

function removeDate(index) {
    console.log("Removing date from event");
    let dates = editor.ds.getCurrentItem().dates;
    dates.splice(index, 1);
    editor.ds.setFieldValue("dates", dates);
    refreshDatesUI();
}

function refreshDatesUI() {
    const item = editor.ds.getCurrentItem();
    const dates = (item && item.dates) ? item.dates : [];
    $w("#datesRepeater").data = dates.map((d, i) => ({ ...d, _id: i.toString() }));
    refreshDateRangeText();
}

function updateDatesArray(index, field, value) {
    let dates = [...editor.ds.getCurrentItem().dates]; // use a copy
    dates[index][field] = value;
    editor.ds.setFieldValue("dates", dates);
    refreshDateRangeText();
}

function updateDatesArrayTime(index, field, date, time) {
    let dates = [...editor.ds.getCurrentItem().dates]; // use a copy
    let finalDate = new Date(date);
    const [hours, minutes] = (time || "00:00").split(':');
    finalDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
    dates[index][field] = finalDate;
    editor.ds.setFieldValue("dates", dates);
    refreshDateRangeText();
}

function refreshDateRangeText() {
    const item = editor.ds.getCurrentItem();
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

async function doQueryUpdate(searchText) {
    let q = wixData.query("events").ascending("title").limit(1000);

    //TODO have to use the dates struct
    //if (!$w('#filterAlsoPast').checked) q = q.ge("dateTo", incUTCDate(new Date(), 1));

    const type = $w("#filterType").value;
    if (type && type != "*") q = q.eq("type", type);

    const sport = $w("#filterSport").value;
    if (sport && sport != "*") q = q.hasSome("sportarten", [sport]); //TODO

    const s = normalize(searchText).trim();
    if (s) {
        let qOr = wixData.query("events").contains("title", s);
        ["subTitle", "description", "price", "address", "dates", "registration",
            "responsible", "responsibleMail", "responsiblePhone"].forEach(f => {
                qOr = qOr.or(wixData.query("events").contains(f, s));
            });
        q = q.and(qOr);
    }

    console.log(`doQueryUpdate query:\n${JSON.stringify(q, null, 2)}`);
    try {
        const res = await q.find();
        return res.items;
    } catch (err) {
        console.error("Query failed", err);
        return [];
    }
}
