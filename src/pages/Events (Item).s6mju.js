import { initEventsEditor, getEventsSummary } from 'public/cms_events';
import { listAllRanges, generateICS } from 'public/cms.js';

$w.onReady(function () {
    let editor;
    editor = initEventsEditor(false, false, {
        onReady: () => {
            const item = editor.getItem() ?? {};
            $w("#textDescription").html = getEventsSummary(editor, item);
            updateDatesButton(item);
        },
    });

    $w('#htmlIcsHelper').onMessage((event) => {
        console.log("#htmlIcsHelper onMessage in velo:");
        console.log(event);
    })
});

function updateDatesButton(item) {
    let allDates = new Map();
    (item.dates || []).forEach(ed => listAllRanges(ed).forEach(dr => { allDates.set(dr.start.getTime(), dr) }));
    console.log("onReady", { item, allDates });
    if (allDates.size == 0)
        $w("#buttonSaveIcs").hide();
    else {
        $w("#buttonSaveIcs").label = allDates.size == 1 ? "Termin übernehmen (FIXME)" : `${allDates.size} Termine übernehmen (FIXME)`;
        $w("#buttonSaveIcs").show();
        $w("#buttonSaveIcs").onClick(async () => {
            const events = [{
                start: new Date("2025-05-01T10:00:00Z"),
                end: new Date("2025-05-01T12:00:00Z"),
                title: "Demo Event"
            }
                // TODO
            ];
            const icsData = generateICS(events);
            console.log("Sending to #htmlIcsHelper:");
            //console.log(icsData);
            $w("#htmlIcsHelper").postMessage({ type: "downloadICS", data: "Test" });
        });
    }
}