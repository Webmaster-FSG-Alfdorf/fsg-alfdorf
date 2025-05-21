import wixData from 'wix-data';
import wixLocation from 'wix-location';
import { dateRangeToString, listAllRanges, generateICS, insertLocation, insertContact } from 'public/cms.js';

$w.onReady(function () {
    $w("#eventsDataset").getItems(0, 1).then(async result => {
            if (!result.items || result.items.length == 0) {
                console.log("No items found for #eventsDataset");
                return;
            }

            // need to query data again and include EventDates collection references
            const itemsWEvents = (await wixData.query("events").eq("_id", result.items[0]._id).include("dates").find()).items;
            if (!itemsWEvents || itemsWEvents.length == 0) {
                console.log(`Could not include eventDates collection to event ID ${result.items[0]._id}`);
                return;
            }
            const event = itemsWEvents[0];

            let html = "";

            if (event.description) {
                html += event.description;
                html += "<br><br>";
            }

            html += "<ul>";

            html = insertLocation(html, event.onGround, event.address);

            html = insertContact(html, event.responsible, event.responsibleMail, event.responsiblePhone);

            if (event.registration) //TODO what to use as link? calendar entry as reminder, or contact mail/phone ?
                html += `<li><div>📝 Voranmeldung bis ${dateRangeToString({start: new Date(event.registration)})}</div>`;

            let dates = event.dates || [];
            let allDates = new Map();
            dates.forEach(ed => listAllRanges(ed).forEach(dr => { allDates.set(dr.start.getTime(), dr) }));
            html += "<li><div>📅 ";
            if (allDates.size == 0) html += "<i>Diesem Event ist kein spezifischer Termin zugeordnet.</i></div>";
            if (allDates.size > 1) html += `Zu den folgenden ${allDates.size} Terminen: <ul>`;
            // combine all found date-ranges of each event-date but ignore duplicates, then print them in ascending order
            Array.from(allDates.values()).sort((dr0, dr1) => dr0.start - dr1.start).forEach((dr, i) => {
                if (allDates.size > 1) html += "<li>";
                html += `${dateRangeToString(dr)}`;
                html += `&nbsp;<a href="https://calendar.google.com/calendar/render?` +
                    `action=TEMPLATE&` +
                    `text=${encodeURIComponent(event.eventName)}&` +
                    `dates=${formatIso(dr.start)}/${formatIso(dr.end)}&` +
                    `details=${encodeURIComponent(`Quelle: <a href="${wixLocation.url}">www.fsg-alfdorf.de</a><br><br>` + event.description)}&` +
                    `location=${encodeURIComponent(event.address?.formatted || "")}&` +
                    `ctz=Europe%2FBerlin" target="_blank"><img width="22" src="https://www.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_16_2x.png"></a>`;
                html += `&nbsp;<a href="https://outlook.live.com/calendar/0/deeplink/compose?` +
                    `subject=${encodeURIComponent(event.eventName)}&` +
                    `startdt=${encodeURIComponent(new Date(dr.start).toISOString())}&` +
                    `enddt=${encodeURIComponent(new Date(dr.end).toISOString())}&` +
                    `body=${encodeURIComponent(`Quelle: <a href="${wixLocation.url}">www.fsg-alfdorf.de</a><br><br>` + event.description)}&` +
                    `location=${encodeURIComponent(event.address?.formatted || "")}&` +
                    `tz=Europe%2FBerlin&allday=false" target="_blank"><img width="22" src="https://img.icons8.com/color/48/000000/outlook-calendar.png"></a>`;
            });
            if (allDates.size > 1) html += "</ul>";
            html += "</div>";

            html += "</ul>";
            $w("#textDescription").html = html;

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
                        // beliebig viele
                    ];
                    const icsData = generateICS(events);
                    console.log("Sending to #htmlIcsHelper:");
                    //console.log(icsData);
                    $w("#htmlIcsHelper").postMessage({ type: "downloadICS", data: "Test" });
                });
            }
        })
        .catch(error => { console.log(error); });
});

function formatIso(date) {
    return new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

$w('#htmlIcsHelper').onMessage((event) => {
    console.log("#htmlIcsHelper onMessage in velo:");
    console.log(event);
})