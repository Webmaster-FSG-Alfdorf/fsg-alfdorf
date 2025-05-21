import wixLocation from 'wix-location';

$w.onReady(function () {
    $w("#datasetLodgings").getItems(0, 1).then(async result => {
            if (!result.items || result.items.length == 0) {
                console.log("No items found for #datasetLodgings");
                return;
            }
            const lodging = result.items[0];

            let html = "";

            if (lodging.description) {
                html += lodging.description; //FIXME text is too small on mobile ?
                html += "<br><br>";
            }

            $w("#textDescription").html = html;

            $w("#buttonReservation").onClick(() => {
                wixLocation.to(`/guests?lodging=${lodging.lodgingID}`);
            });
        })
        .catch(error => { console.log(error); });

});