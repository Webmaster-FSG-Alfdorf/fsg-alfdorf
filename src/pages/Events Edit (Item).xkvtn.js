$w.onReady(function () {
    $w("#eventsDataset").onReady(() => {

        // REPEATER LOGIK: Felder und Lösch-Button verknüpfen
        $w("#datesRepeater").onItemReady(($item, itemData, index) => {
            const togglePickers = () => {
                if ($item("#dropdownDatesType").value === "weekly") $item("#checkboxDatesWeekdays").expand(); else $item("#checkboxDatesWeekdays").collapse();
                if (parseInt($item("#dropdownDatesInterval").value, 10) != 0) $item("#dropdownDatesType").expand(); else $item("#dropdownDatesType").collapse();
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

            $item("#btnDateRemove").onClick(() => { removeDate(index); });

            togglePickers();
        });

        $w("#btnDateAdd").onClick(() => { addDate(); });

        refreshDatesUI();
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
}

// Hilfsfunktion: Einzelne Feldänderungen ins Dataset schreiben
function updateDatesArray(index, field, value, timeValue = null) {
    let item = $w("#eventsDataset").getCurrentItem();
    let dates = item.dates;

    if (timeValue != null) {
        let finalDate = new Date(value);
        const [hours, minutes] = timeValue.split(':');
        finalDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        dates[index][field] = finalDate;
    } else {
        dates[index][field] = value;
    }

    $w("#eventsDataset").setFieldValue("dates", dates);
}
