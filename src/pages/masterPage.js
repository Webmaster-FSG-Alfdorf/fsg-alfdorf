import { currentMember, authentication } from "wix-members-frontend";

$w.onReady(function () {
    authentication.onLogin(() => update());
    authentication.onLogout(() => update());
    update();
});

function update() {
    currentMember.getRoles().then((roles) => {
        // Role is "Gästerverwalter"
        if (roles.some((role) => role._id == "276cacd9-b43e-4e4e-8e3f-92192eb8eba7")) {
            let mi = $w("#expandableMenu").menuItems;
            mi.push({
                id: "guest-management",
                link: "/guests-management/new",
                label: "Gästeverwaltung",
                target: "_self",
                "selected": false,
                "menuItems": []
            });
            $w("#expandableMenu").menuItems = mi;
        }
    });
}