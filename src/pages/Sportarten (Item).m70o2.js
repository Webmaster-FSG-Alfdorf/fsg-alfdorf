import { initSportsEditor } from 'public/cms_sports';
import { SafeHTML } from 'public/cms_edit';

$w.onReady(function () {
    let editor;
    editor = initSportsEditor(false, {
        dataSetName: "sportsDataset",  //TODO rename to datasetSports
        onReady: () => {
            $w("#textDescription").html = editor.getString(
                "{#inputDescriptionFull}\n"
                + "{?ownEquipment: 🎒\t{ownEquipment}\n}"
                + "{?price: 🪙\t{price}\n}"
                + "{?address: 📍\t{address}\n}"
                + "{?contact: 👤\t{contact}{?contactMail: ✉️{contactMail}}{?contactPhone: 📞{contactPhone}}\n}"
                + "{?alltime: 📝\t{alltime}\n}"
                + "{?weatherIndep: 🌦️\t{weatherIndep}\n}"
                + "{?season: 🍂\t{season}\n}"
                + "{?whatsappCode: {whatsAppIcon}\t{whatsappCode}\n}"
                + "{?events: 📅\t{events}\n}", //TODO events              
                editor.getItem() ?? {},
                { whatsAppIcon: new SafeHTML('<img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="24" alt="WhatsApp">', "WhatsApp"), },
                {}
            );
        },
    });
});