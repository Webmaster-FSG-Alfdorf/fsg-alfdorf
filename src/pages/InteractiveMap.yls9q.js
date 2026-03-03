import wixData from 'wix-data';

$w.onReady(async function () {
	$w("#htmlMap").onMessage(async (event) => {
		if (event.data === "ready") {
			const { items } = await wixData.query("mapAreas").find();
			$w("#htmlMap").postMessage(items);
		}
	});
});
