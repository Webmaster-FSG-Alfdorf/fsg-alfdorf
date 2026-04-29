import { initSportsEditor } from 'public/cms_sports';

$w.onReady(function () {
    let editor;
    editor = initSportsEditor(false, {
        itemRepeater: $w("#repeaterResults"),
        itemRepeaterSummary: $w("#textCountResults"),
        onRepeaterItemReady: ($item, rowData) => {
            $item("#textDescription").html = editor.getString(
                "{#inputDescriptionShort}\n"
                + "{?ownEquipment: 🎒\t{ownEquipment}\n}"
                + "{?price: 🪙\t{price}\n}"
                + "{?address: 📍\t{address}\n}"
                + "{?contact: 👤\t{contact}{?contactMail: ✉️{contactMail}}{?contactPhone: 📞{contactPhone}}\n}"
                + "{?alltime: 📝\t{alltime}\n}"
                + "{?weatherIndep: 🌦️\t{weatherIndep}\n}"
                + "{?season: 🍂\t{season}\n}",
                rowData, {}, {});
        },

    });
});