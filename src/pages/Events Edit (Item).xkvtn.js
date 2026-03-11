import wixData from 'wix-data';
import wixLocation from 'wix-location-frontend';
import { dateRangeToString, listAllRanges, printRanges } from 'public/cms.js';

$w.onReady(function () {
    $w("#itemSelector").onChange(() => {
        const val = $w("#itemSelector").value;
        console.log("Selected value:", val);
        if (val == "new_event")
            $w("#eventsDataset").new().then(() => {
                $w("#itemSelector").value = undefined;
                refreshDatesUI();
            });
        else
            wixData.query("events").eq("_id", val).find().then((results) => {
                if (results.items.length > 0) {
                    const dynamicUrl = results.items[0]['link-events-1-edit-title'];
                    console.log("URL aus DB:", dynamicUrl);
                    console.log("Aktuelle URL:", wixLocation.url);
                    if (dynamicUrl && wixLocation.url.includes(dynamicUrl))
                        wixLocation.to(wixLocation.url);
                    else if (dynamicUrl)
                        wixLocation.to(dynamicUrl);
                }
            });
    });

    $w("#eventsDataset").onReady(() => {
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

        updateSelectorList();
        refreshDatesUI();
    });

    $w("#eventsDataset").onAfterSave(() => {
        $w("#textResponse").html = `<p style="color: #2ECC71; font-size: 16px; text-align: center;">✔ Erfolgreich gespeichert!</p>`;
        $w("#textResponse").expand();
        updateSelectorList();
        refreshDatesUI();
    });

    $w("#eventsDataset").onError((error) => {
        let msg = "✖ Fehler beim Speichern.";
        const errStr = (JSON.stringify(error) + String(error.stack) + String(error.message)).toLowerCase();
        if (errStr.includes("validation")) msg = "✖ Bitte fülle alle Pflichtfelder korrekt aus.";
        else if (errStr.includes("email")) msg = "✖ Die E-Mail-Adresse ist ungültig.";
        else if (errStr.includes("not allowed during save")) msg = "✖ Speichervorgang noch nicht abgeschlossen.";
        $w("#textResponse").html = `<p style="color: #E74C3C; font-size: 16px; text-align: center;">${msg}</p>`;
        $w("#textResponse").expand();
    });

});

function updateSelectorList() {
    wixData.query("events").ascending("title").limit(1000).find().then((result) => {
        $w("#itemSelector").options = [
            { label: "➕ Neuer Event", value: "new_event" },
            ...result.items.map(item => ({ label: item.title, value: item._id }))
        ];
        const currentItem = $w("#eventsDataset").getCurrentItem();
        if (currentItem) $w("#itemSelector").value = currentItem._id;
    });
}

function addDate() {
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
    let dates = $w("#eventsDataset").getCurrentItem().dates;
    dates.splice(index, 1);
    $w("#eventsDataset").setFieldValue("dates", dates);
    refreshDatesUI();
}

function refreshDatesUI() {
    let dates = $w("#eventsDataset").getCurrentItem().dates || [];
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
    let item = $w("#eventsDataset").getCurrentItem();
    let dates = item.dates;
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
