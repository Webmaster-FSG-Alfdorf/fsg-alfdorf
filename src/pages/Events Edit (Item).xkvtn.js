import { dateRangeToString, listAllRanges, printRanges } from 'public/cms.js';

$w.onReady(function () {
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

            $item("#pickerDatesStart").onChange(() => updateDatesArray(index, 'start', $item("#pickerDatesStart").value, $item("#pickerDatesStartTime").value));
            $item("#pickerDatesEnd").onChange(() => updateDatesArray(index, 'end', $item("#pickerDatesEnd").value, $item("#pickerDatesEndTime").value));
            $item("#pickerDatesStartTime").onChange(() => updateDatesArray(index, 'start', $item("#pickerDatesStart").value, $item("#pickerDatesStartTime").value));
            $item("#pickerDatesEndTime").onChange(() => updateDatesArray(index, 'end', $item("#pickerDatesEnd").value, $item("#pickerDatesEndTime").value));
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

        refreshDatesUI();
    });

    $w("#eventsDataset").onAfterSave(() => {
        $w("#textResponse").html = `<p style="color: #2ECC71; font-size: 16px; text-align: center;">✔ Erfolgreich gespeichert!</p>`;
        $w("#textResponse").expand();
    });

    $w("#eventsDataset").onError((error) => {
        let msg = "✖ Fehler beim Speichern.";
        if (error.code === "DS_VALIDATION_ERROR") msg = "✖ Bitte fülle alle Pflichtfelder korrekt aus.";
        if (error.message.includes("is not a valid email")) msg = "✖ Die E-Mail-Adresse ist ungültig.";
        $w("#textResponse").html = `<p style="color: #E74C3C; font-size: 16px; text-align: center;">${msg}</p>`;
        $w("#textResponse").expand();
    });

});

// Funktion: Neuen leeren Termin hinzufügen
function addDate() {
    let item = $w("#eventsDataset").getCurrentItem();
    let dates = item.dates || [];

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

// Funktion: Spezifischen Termin anhand des Index löschen
function removeDate(index) {
    let item = $w("#eventsDataset").getCurrentItem();
    let dates = item.dates;
    dates.splice(index, 1);
    $w("#eventsDataset").setFieldValue("dates", dates);
    refreshDatesUI();
}

// Funktion: UI-Refresh (sortiert die IDs neu, damit der Repeater stabil bleibt)
function refreshDatesUI() {
    const item = $w("#eventsDataset").getCurrentItem();
    const dates = item.dates || [];
    // Wir mappen die Daten neu, damit der index im onItemReady immer korrekt ist
    $w("#datesRepeater").data = dates.map((d, i) => ({ ...d, _id: i.toString() }));
    refreshDateRangeText();
}

// Hilfsfunktion: Einzelne Feldänderungen ins Dataset schreiben
function updateDatesArray(index, field, value, timeValue = null) {
    let item = $w("#eventsDataset").getCurrentItem();
    let dates = item.dates;

    if (timeValue != null) {
        let finalDate = new Date(value);
        const [hours, minutes] = (timeValue || "00:00").split(':');
        finalDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
        dates[index][field] = finalDate;
    } else {
        dates[index][field] = value;
    }

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
