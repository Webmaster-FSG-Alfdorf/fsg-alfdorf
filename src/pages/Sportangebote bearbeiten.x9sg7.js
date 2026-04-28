import { initSportsEditor } from 'public/cms_sports';

$w.onReady(function () {
    initSportsEditor(true, {
        itemRepeater: $w("#repeaterResults"),
        itemRepeaterSummary: $w("#textCountResults"),
        onRepeaterItemReady: ($item, rowData) => {
            let html = "<ul>";
            html += rowData.description ?? "";
            if (rowData.ownEquipment) html += `<li>🎽 ${rowData.ownEquipment}`;
            if (rowData.price) html += `<li>💶 ${rowData.price}`;
            if (rowData.contact) html += `<li>👤 ${rowData.contact}`
            $item("#textDescription").html = html + "</ul>";
        },

    });
});
