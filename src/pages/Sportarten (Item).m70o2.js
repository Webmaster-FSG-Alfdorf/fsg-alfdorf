import { insertLocation, insertContact } from 'public/cms.js';
import { CmsEditor } from 'public/cms_edit';

$w.onReady(function () {
    $w("#sportsDataset").getItems(0, 1).then(async result => {
        if (!result.items || result.items.length == 0) {
            console.log("No items found for #sportsDataset");
            return;
        }
        const sport = result.items[0];
        console.log(sport);

        let html = "";

        if (sport.descriptionRich) {
            html += sport.descriptionRich; //FIXME text is too small on mobile
            html += "<br><br>";
        }

        html += "<ul>";

        if (sport.ownEquipment)
            html += `<li><div>🎽 ${sport.ownEquipment}</div>`;

        if (sport.price)
            html += `<li><div>💶 ${sport.price}</div>`;

        html = insertLocation(html, sport.onGround, sport.address);

        html = insertContact(html, sport.contact, sport.contactMail, sport.contactPhone);

        if (sport.alltime)
            html += `<li><div>📝 ${sport.alltime}</div>`;

        if (sport.weatherIndep)
            html += `<li><div>🌥️ Wetter unabhängig</div>`;
        else
            html += `<li><div>🌥️ Nur bei gutem Wetter</div>`;

        if (Array.isArray(sport.season) && sport.season.length == 1) {
            if (sport.season[0] == "main")
                html += `<li><div>🌡️ Nur Sommersaison</div>`;
            else if (sport.season[0] == "off")
                html += `<li><div>🌡️ Nur Wintersaison</div>`;
            else
                html += `<li><div>🌡️ ???</div>`;
        } else
            html += `<li><div>🌡️ Sommer- und Wintersaison</div>`;

        if (sport.whatsapp && sport.whatsappCode)
            html += `<li><div><a href="https://chat.whatsapp.com/${sport.whatsappCode}" target="_blank"><img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="24" alt="WhatsApp">${sport.whatsapp}</a>`;

        //TODO Events

        html += "</ul>";
        $w("#textDescription").html = html;

        const editor = new CmsEditor();
        editor.setupEditButton("#buttonEdit", "sports-edit", "3ef4ffaa-79b2-440c-9872-802287e9407b", sport);
    })
        .catch(error => { console.log(error); });
});