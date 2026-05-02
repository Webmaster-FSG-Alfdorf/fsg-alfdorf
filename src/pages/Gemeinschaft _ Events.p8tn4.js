import { initEventsEditor, getEventsSummary } from 'public/cms_events';

$w.onReady(function () {
    let editor;
    editor = initEventsEditor(false, false, {
        itemRepeater: $w("#repeaterResults"),
        itemRepeaterSummary: $w("#textCountResults"),
        onRepeaterItemReady: ($item, rowData) => {
            $item("#textDescription").html = getEventsSummary(editor, rowData);
        },
    });
});