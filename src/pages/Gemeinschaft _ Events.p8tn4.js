import { initEventsEditor } from 'public/cms_events';

$w.onReady(function () {
    let editor;
    editor = initEventsEditor(false, false, {
        itemRepeater: $w("#repeaterResults"),
        itemRepeaterSummary: $w("#textCountResults"),
        onRepeaterItemReady: ($item, rowData) => {
            $item("#textDescription").html = editor.getString(
                "{description}\n"
                + "🏷️\t{type}\n"
                + "📅\t{dates}\n"
                + "{?price: 🪙\t{price}\n}"
                + "{?address: 📍\t{address}\n}"
                + "{?onGround: 📍\tAuf unserem Gelände\n}"
                + "{?registration: 📝\tAnmeldung bis {registration}\n}"
                + "{?responsible: 👤\t{rsp}\n}"
                + "",
                rowData,
                { rsp: "{responsible}{?responsibleMail:\n✉️{responsibleMail}}{?responsiblePhone:\n📞{responsiblePhone}}" },
                {}
            );
        },

    });
});