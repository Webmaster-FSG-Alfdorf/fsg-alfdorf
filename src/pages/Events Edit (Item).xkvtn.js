$w.onReady(function () {
    $w("#eventsDataset").onReady(() => {

        // REPEATER LOGIK: Felder und Lösch-Button verknüpfen
        $w("#datesRepeater").onItemReady(($item, itemData, index) => {
            // Werte aus dem Objekt-Array in die Eingabefelder schreiben
            $item("#pickerDatesStart").value = itemData.start;
            $item("#pickerDatesEnd").value = itemData.end;
            $item("#dropdownDatesType").value = itemData.recurrenceType || "none";
            $item("#dropdownDatesInterval").value = itemData.recurrenceInterval || 1;
            $item("#checkboxDatesDays").value = itemData.recurrenceDays || [];

            // Änderungen im Repeater sofort in das Dataset-Array zurückschreiben
            $item("#pickerDatesStart").onChange(() => updateDatesArray(index, 'start', $item("#pickerDatesStart").value));
            $item("#pickerDatesEnd").onChange(() => updateDatesArray(index, 'end', $item("#pickerDatesEnd").value));
            $item("#dropdownDatesType").onChange(() => updateDatesArray(index, 'recurrenceType', $item("#dropdownDatesType").value));
            $item("#dropdownDatesInterval").onChange(() => updateDatesArray(index, 'recurrenceInterval', $item("#dropdownDatesInterval").value));
            $item("#checkboxDatesDays").onChange(() => updateDatesArray(index, 'recurrenceDays', $item("#checkboxDatesDays").value));

            // LÖSCHEN-BUTTON (jetzt innerhalb der Repeater-Box)
            $item("#btnDateRemove").onClick(() => {
                removeDate(index);
            });
        });

        // HINZUFÜGEN-BUTTON (außerhalb)
        $w("#btnDateAdd").onClick(() => {
            addDate();
        });

        // Initiales Laden der Daten
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
        recurrenceType: "none",
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
function updateDatesArray(index, field, value) {
    let item = $w("#eventsDataset").getCurrentItem();
    let dates = item.dates;
    dates[index][field] = value;
    $w("#eventsDataset").setFieldValue("dates", dates);
}
