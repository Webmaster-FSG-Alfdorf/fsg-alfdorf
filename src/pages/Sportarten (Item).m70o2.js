import { initSportsEditor } from 'public/cms_sports';
import { SafeHTML } from 'public/cms_edit';

$w.onReady(function () {
    let editor;
    editor = initSportsEditor(false, {
        dataSetName: "sportsDataset",  //TODO rename to datasetSports
        onReady: () => {
            $w("#textDescription").html = editor.getString(
                "{#inputDescriptionFull}\n"
                + "{?🎒}\t{ownEquipment}\n"
                + "{?🪙}\t{price}\n"
                + "{?📍}\t{address}\n"
                + "{?👤}\t{contact} {?✉️}{contactMail} {?📞}{contactPhone}\n"
                + "{?📝}\t{alltime}\n"
                + "{?🌦️}\t{weatherIndep}\n"
                + "{?🍂}\t{season}\n"
                + "{?{whatsAppIcon}}\t{whatsappCode}\n"
                + "{?📅}\t{events}\n", //TODO events
                {
                    whatsAppIcon: new SafeHTML('<img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="24" alt="WhatsApp">', "WhatsApp"),
                }, {});
        },
    });
});