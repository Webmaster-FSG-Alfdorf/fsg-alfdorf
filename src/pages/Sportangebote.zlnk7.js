import { initSportsEditor, getSportsSummary } from 'public/cms_sports';

$w.onReady(function () {
    let editor;
    editor = initSportsEditor(false, {
        itemRepeater: $w("#repeaterResults"),
        itemRepeaterSummary: $w("#textCountResults"),
        onRepeaterItemReady: ($item, rowData) => {
            $item("#textDescription").html = getSportsSummary(editor, rowData);
        },

    });
});