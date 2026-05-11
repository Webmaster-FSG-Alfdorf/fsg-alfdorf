import { initSportsEditor, getSportsSummary } from 'public/cms_sports';

$w.onReady(function () {
    let editor;
    editor = initSportsEditor(false, {
        onReady: () => {
            $w("#textDescription").html = getSportsSummary(editor, editor.getItem() ?? {});
        },
    });
});