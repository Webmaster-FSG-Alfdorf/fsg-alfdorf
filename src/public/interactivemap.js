/* global google */

const flashDelay = 500;
const polyFillOpacity = 0.2;
const polyBorderWidth = 0.3;

const categories = {
    sport: { color: "#ffcc00", legend: "Sportplätze" },
    infra: { color: "#2196f3", legend: "Infrastruktur" },
    places: { color: "#9e9e9e", legend: "Wohnwagen-Plätze", flashColor: "#ff0000" },
};

const areas = [
    {
        name: "Tischtennis",
        url: "sportarten/volleyball",
        descr: "6 Tischtennisplatten und Gerätehäuschen mit Ausrüstung",
        category: "sport",
        path: [
            { lat: 48.8370765, lng: 9.7663122 },
            { lat: 48.8369557, lng: 9.7666099 },
            { lat: 48.8368523, lng: 9.7665455 },
            { lat: 48.8369904, lng: 9.7662396 },
        ]
    },
    {
        name: "Volleyball",
        url: "sportarten/volleyball",
        descr: "Zwei 9x9m Hartplatz-Felder und ein 8x8m Beachfeld",
        category: "sport",
        path: [
            { lat: 48.836962726928824, lng: 9.766190828726653 },
            { lat: 48.83681642693739, lng: 9.766491732022612 },
            { lat: 48.8364757995251, lng: 9.766168387360926 },
            { lat: 48.836526294116425, lng: 9.76603718998561 },
            { lat: 48.83673704617807, lng: 9.766208214748204 },
            { lat: 48.836805456324555, lng: 9.76604572449007 },
        ]
    },
    {
        name: "Minigolf",
        url: "sportarten/minigolf",
        descr: "18 Löcher Minigolf Platz",
        category: "sport",
        path: [
            { lat: 48.837296557424715, lng: 9.76654362324287 },
            { lat: 48.8371952579206, lng: 9.7668131693689 },
            { lat: 48.8369476265866, lng: 9.76672771715063 },
            { lat: 48.83709475213431, lng: 9.766376555831942 },
        ]
    },
    {
        name: "Tennis",
        url: "sportarten/tennis",
        descr: "Tennis Platz (1 Feld)",
        category: "sport",
        path: [
            { lat: 48.836931085914756, lng: 9.766651019756068 },
            { lat: 48.83690146255555, lng: 9.766753071577112 },
            { lat: 48.83692912534639, lng: 9.76676756039444 },
            { lat: 48.83691045394675, lng: 9.766862643697936 },
            { lat: 48.83661227714967, lng: 9.76666875745546 },
            { lat: 48.8366634100171, lng: 9.766447074914948 },
        ]
    },
    {
        name: "Badminton",
        url: "sportarten/badminton",
        descr: "Badminton Platz (2 Felder)",
        category: "sport",
        path: [
            { lat: 48.83706850217714, lng: 9.765868412859678 },
            { lat: 48.837004780716974, lng: 9.766046518158802 },
            { lat: 48.83682726856211, lng: 9.765852094746965 },
            { lat: 48.836911861975594, lng: 9.76567470857783 },
        ]
    },
    {
        name: "Ringtennis",
        url: "sportarten/ringtennis",
        descr: "Ringtennis Platz (2 Felder)",
        category: "sport",
        path: [
            { lat: 48.83690640167751, lng: 9.765669179312532 },
            { lat: 48.83682361253277, lng: 9.765846532550048 },
            { lat: 48.83669009554013, lng: 9.76570197624823 },
            { lat: 48.83676963791743, lng: 9.765522328057408 },
        ]
    },
    {
        name: "Boule",
        url: "sportarten/boule",
        descr: "Boule Platz",
        category: "sport",
        path: [
            { lat: 48.83678497562178, lng: 9.765879983462597 },
            { lat: 48.83669091909413, lng: 9.766092119527833 },
            { lat: 48.836579238546314, lng: 9.766002727709909 },
            { lat: 48.836648645432994, lng: 9.76577228554688 },
        ]
    },
    {
        name: "Spielplatz",
        url: "",
        descr: "Kinderspielplatz mit Klettergerüst, Rutsche und Spielhütte",
        category: "infra",
        path: [
            { lat: 48.83678084369419, lng: 9.765423724660081 },
            { lat: 48.836621704062516, lng: 9.765756138252202 },
            { lat: 48.83651251046276, lng: 9.765650577084198 },
            { lat: 48.83662531915487, lng: 9.765412417148317 },
            { lat: 48.836688812017506, lng: 9.76540311537318 },
        ]
    },
    {
        name: "Spielplatz",
        url: "",
        descr: "Kinderspielplatz mit Schaukel und Trampolin",
        category: "infra",
        path: [
            { lat: 48.83655779880306, lng: 9.765238928297075 },
            { lat: 48.83649238920531, lng: 9.765365594667179 },
            { lat: 48.836332119279476, lng: 9.765209265550341 },
            { lat: 48.836370731010625, lng: 9.765046712613806 },
            { lat: 48.83648122160954, lng: 9.765133697199744 },
        ]
    },
    {
        name: "Bädle",
        url: "",
        descr: "Kleines Schwimmbecken mit Dusche und Babybecken",
        category: "infra",
        path: [
            { lat: 48.83653406344804, lng: 9.765787959528103 },
            { lat: 48.836465917148075, lng: 9.76599630878448 },
            { lat: 48.83640746833705, lng: 9.765935256779619 },
            { lat: 48.83645186055335, lng: 9.76572368709192 },
        ]
    },
    {
        name: "Bogenschießplatz",
        url: "sportarten/bogenschießen",
        descr: "Bogenschießplatz",
        category: "sport",
        path: [
            { lat: 48.83648658425139, lng: 9.766773379006619 },
            { lat: 48.83643098233424, lng: 9.767080113382647 },
            { lat: 48.83605683053172, lng: 9.766721740053793 },
            { lat: 48.83621902790036, lng: 9.766380074826392 },
            { lat: 48.83635880952422, lng: 9.766493188808656 },
            { lat: 48.836425343851744, lng: 9.766616541236306 },
            { lat: 48.83646144753585, lng: 9.766696337559337 },
        ]
    },
    {
        name: "Grünschnittentsorgung",
        url: "",
        descr: "Grünschnittentsorgung (weitere Zwischenlager auch auf dem Gelände verfügbar)",
        category: "infra",
        path: [
            { lat: 48.837480746336915, lng: 9.766808581908872 },
            { lat: 48.83748835725747, lng: 9.767193542680959 },
            { lat: 48.837270101074125, lng: 9.767069179552257 },
            { lat: 48.83727606863944, lng: 9.7668187046659 },
        ]
    },
    {
        name: "Schachbrett",
        url: "sportarten/schach",
        descr: "Schachbrett",
        category: "sport",
        path: [
            { lat: 48.836801790067156, lng: 9.765143881387717 },
            { lat: 48.83678366392951, lng: 9.765187636577801 },
            { lat: 48.83675283924034, lng: 9.765168319626728 },
            { lat: 48.836767385362144, lng: 9.765119200514643 },
        ]
    },
    {
        name: "Feuerstelle",
        url: "",
        descr: "Feuerstelle mit Stühle- und Holzlager",
        category: "infra",
        path: [
            { lat: 48.83697155983455, lng: 9.76520242121346 },
            { lat: 48.83696270105569, lng: 9.765237845724744 },
            { lat: 48.836859736349325, lng: 9.765196213668176 },
            { lat: 48.83684353430508, lng: 9.765275572139144 },
            { lat: 48.83679816644979, lng: 9.765248061255843 },
            { lat: 48.83682531059638, lng: 9.765138692261148 },
            { lat: 48.83690121049798, lng: 9.765171970369297 },
        ]
    },
    {
        name: "Fröschle",
        url: "",
        descr: "Fröschle Vereinsgaststätte mit Tanzfläche und Biergarten",
        category: "infra",
        path: [
            { lat: 48.83719724693381, lng: 9.765430185526736 },
            { lat: 48.83714430566397, lng: 9.765523641322654 },
            { lat: 48.83706111923067, lng: 9.765504388446791 },
            { lat: 48.8369215288293, lng: 9.765416201140644 },
            { lat: 48.83696988472957, lng: 9.765237912722146 },
            { lat: 48.83711214390607, lng: 9.765312334936288 },
            { lat: 48.83717885415178, lng: 9.765364438285097 },
        ]
    },
    {
        name: "Winterwaschhaus",
        url: "",
        descr: "Winterwaschhaus mit WCs, Duschbereich, Spülbereich, Waschmaschinen und Trockner",
        category: "infra",
        path: [
            { lat: 48.83641985978718, lng: 9.763933139503067 },
            { lat: 48.83635294413979, lng: 9.764042715827653 },
            { lat: 48.83627286260097, lng: 9.763951025343916 },
            { lat: 48.836349189935575, lng: 9.763842126123057 },
        ]
    },
    {
        name: "Sommerwaschhaus",
        url: "",
        descr: "Sommerwaschhaus mit WCs, Duschbereich Außen-Spülbereich und Behinderten-WC/Dusche sowie Jugend-Matratzenlager im DG",
        category: "infra",
        path: [
            { lat: 48.83747646374687, lng: 9.765055139200014 },
            { lat: 48.8374383261253, lng: 9.765191333238871 },
            { lat: 48.83734203376822, lng: 9.765108212372343 },
            { lat: 48.83738072997342, lng: 9.764975752270287 },
        ]
    },
    {
        name: "Gästewiese",
        url: "",
        descr: "Gästewiese mit 10 Stellplätzen",
        category: "infra",
        path: [
            { lat: 48.837918992101976, lng: 9.765563618233003 },
            { lat: 48.83788021258046, lng: 9.765706858784608 },
            { lat: 48.8377241707256, lng: 9.765682086822606 },
            { lat: 48.83742224201804, lng: 9.765265207595633 },
            { lat: 48.83750478656, lng: 9.765020866866514 },
            { lat: 48.837638376577694, lng: 9.765118938647374 },
            { lat: 48.83785188377649, lng: 9.76550319481457 },
        ]
    },
    {
        name: "Parkplatz",
        url: "",
        descr: "",
        category: "infra",
        path: [
            { lat: 48.838011690740146, lng: 9.76342625110989 },
            { lat: 48.83800640923195, lng: 9.764337118120476 },
            { lat: 48.83781984120088, lng: 9.764320844886113 },
            { lat: 48.83744651297528, lng: 9.764283811679627 },
            { lat: 48.83743207861916, lng: 9.764086970094171 },
            { lat: 48.83766147209491, lng: 9.764108320380826 },
            { lat: 48.83766725671208, lng: 9.763903203569019 },
            { lat: 48.83775999943274, lng: 9.763922854085557 },
            { lat: 48.83775752759735, lng: 9.763826057294015 },
            { lat: 48.83762480508985, lng: 9.763818888649277 },
            { lat: 48.83754051593349, lng: 9.763683051497175 },
            { lat: 48.837540303700926, lng: 9.763476916865725 },
            { lat: 48.83784171491765, lng: 9.763442391929113 },
            { lat: 48.83792285162917, lng: 9.76342881613934 },
        ]
    },
    {
        name: "Eingangstor",
        url: "",
        descr: "",
        category: "infra",
        path: [
            { lat: 48.8379804628346, lng: 9.763296165030084 },
            { lat: 48.83797336907696, lng: 9.76335472817903 },
            { lat: 48.837917573164376, lng: 9.763357463276911 },
            { lat: 48.83791594514851, lng: 9.763288297918157 },
        ]
    },
    {
        name: "Schranke",
        url: "",
        descr: "ab hier PKW freier Bereich, Durchfahrt nur mit Ausnahmegenehmigung",
        category: "infra",
        path: [
            { lat: 48.83744277260884, lng: 9.764131947172979 },
            { lat: 48.83744826283494, lng: 9.764273274672421 },
            { lat: 48.837419820071844, lng: 9.76428352914741 },
            { lat: 48.83740907713513, lng: 9.764144815598675 },
        ]
    },
    {
        name: "Frogcar Station",
        url: "",
        descr: "Obere Station für 2 Frogcars",
        category: "infra",
        path: [
            { lat: 48.837496224792545, lng: 9.763328782954563 },
            { lat: 48.83749831809086, lng: 9.763486593964124 },
            { lat: 48.837429945978435, lng: 9.763488064747891 },
            { lat: 48.83743155844591, lng: 9.763322627463147 },
        ]
    },
    {
        name: "Frogcar Station",
        url: "",
        descr: "Untere Station für 2 Frogcars",
        category: "infra",
        path: [
            { lat: 48.837347282773344, lng: 9.765009684222912 },
            { lat: 48.83731769485433, lng: 9.765091474881341 },
            { lat: 48.83727170004721, lng: 9.765041160510163 },
            { lat: 48.83729587693986, lng: 9.764984738667081 },
        ]
    },
    {
        name: "Mülllager",
        url: "",
        descr: "Lager für Glas, Papier, Bio, Gelber und Restmüll",
        category: "infra",
        path: [
            { lat: 48.83763084092995, lng: 9.763342102116086 },
            { lat: 48.837629465232496, lng: 9.763438261711954 },
            { lat: 48.83755603565734, lng: 9.763442645007716 },
            { lat: 48.8375522236624, lng: 9.763338937834073 },
        ]
    },
    {
        name: "Büro",
        url: "",
        descr: "Eingang zum FSG Büro",
        category: "infra",
        path: [
            { lat: 48.83760207086029, lng: 9.763826489937195 },
            { lat: 48.83755850279775, lng: 9.763910087977687 },
            { lat: 48.83750916141324, lng: 9.76384646476333 },
            { lat: 48.837556417670015, lng: 9.763791751093361 },
        ]
    },
    {
        name: "Betriebsmittelgaragen",
        url: "",
        descr: "Betriebsmittelgaragen und Leih-Werkzeug (auf Anfrage beim Platzwart)",
        category: "infra",
        path: [
            { lat: 48.83757094394827, lng: 9.763954966178067 },
            { lat: 48.83755012217706, lng: 9.764009616546007 },
            { lat: 48.83750952460779, lng: 9.763974873569039 },
            { lat: 48.83752864413115, lng: 9.763912391217445 },
        ]
    },
    {
        name: "Fitnessraum",
        url: "",
        descr: "Fitnessraum mit Sportgeräten (Einweisung in die Geräte auf Anfrage)",
        category: "infra",
        path: [
            { lat: 48.83752864413115, lng: 9.763912391217445 },
            { lat: 48.83750952460779, lng: 9.763974873569039 },
            { lat: 48.83746360003016, lng: 9.76392729029383 },
            { lat: 48.83747573770866, lng: 9.763849218410451 },
        ]
    },
    {
        name: "Eingang",
        url: "",
        descr: "Sauna, Jugendraum und Kegelbahn sowie WCs und Duschen sowie Durchgang zur Festhalle (Winter Tischtennis, Winter Lince Dance, ...)",
        category: "infra",
        path: [
            { lat: 48.837465356759495, lng: 9.763924684466808 },
            { lat: 48.83741959423186, lng: 9.763992341456118 },
            { lat: 48.83732430128245, lng: 9.763865253201939 },
            { lat: 48.83740535615494, lng: 9.763668034966782 },
            { lat: 48.83748824933851, lng: 9.763756352080897 },
            { lat: 48.83739952866823, lng: 9.763880477436759 },
        ]
    },
    {
        name: "Schießstand",
        url: "sportarten/luftgewehr",
        descr: "Luftgewehr Schießstand (Zugang nur auf Anfrage)",
        category: "infra",
        path: [
            { lat: 48.837308602113254, lng: 9.763776273007712 },
            { lat: 48.837281997993934, lng: 9.763814571375534 },
            { lat: 48.837146897469125, lng: 9.763689119873922 },
            { lat: 48.83719006628463, lng: 9.763641758044738 },
        ]
    },
    {
        name: "Motorradstellplätze",
        url: "",
        descr: "Motorradstellplätze",
        category: "infra",
        path: [
            { lat: 48.837664443549365, lng: 9.763332417531883 },
            { lat: 48.8376732994377, lng: 9.763431627727785 },
            { lat: 48.83763639835013, lng: 9.763433918439288 },
            { lat: 48.83762759998626, lng: 9.763329463857499 },
        ]
    },
    {
        name: "See",
        descr: "Badesee mit Seerosen-Teich, über eine Steinbrücke verbunden",
        url: "",
        category: "infra",
        path: [
            { lat: 48.836480735375964, lng: 9.76542220477662 },
            { lat: 48.83642299434768, lng: 9.76564164608839 },
            { lat: 48.83631957450664, lng: 9.765649124693063 },
            { lat: 48.83622905729343, lng: 9.765596828288396 },
            { lat: 48.836215983002376, lng: 9.765501992799805 },
            { lat: 48.8361320236057, lng: 9.765437466465501 },
            { lat: 48.83607321348764, lng: 9.765345621160762 },
            { lat: 48.83607950584284, lng: 9.765193099267785 },
            { lat: 48.835997217920784, lng: 9.765168096553088 },
            { lat: 48.83597733143625, lng: 9.765065463528334 },
            { lat: 48.83606910865185, lng: 9.765032453785581 },
            { lat: 48.83608133422372, lng: 9.765131980140447 },
            { lat: 48.836108763515774, lng: 9.765137536223122 },
            { lat: 48.836136271715446, lng: 9.765115373982775 },
            { lat: 48.83615461681409, lng: 9.765104315016261 },
            { lat: 48.836191065043, lng: 9.765126434951345 },
            { lat: 48.83625890403812, lng: 9.765173823699714 },
            { lat: 48.83634125364527, lng: 9.765259991359034 },
            { lat: 48.83635215609034, lng: 9.765315469533105 },
            { lat: 48.8364088323127, lng: 9.765365462367562 },
        ]
    },
];

// an array of array with [place nr first, place nr last, latitude of center point first, longitude of center point first, latitude of center point last, longitude of center point last, ]
// each such array defines a stripe of equaly distributed places
const places = [
    [1, 18, 48.83575977980719, 9.763329800116484, 48.8373670028252, 9.763395194141582, { 16: "16a", 17: "16b", 18: "16c" }],
    [17, 26, 48.83633097514284, 9.763506424511618, 48.837156055803014, 9.763597303632862],
    [26, 32, 48.836539221564585, 9.763718603912853, 48.837062440499906, 9.763793679924333, { 26: "27a", 27: "27b" }],
    [33, 34, 48.83715799798317, 9.763844313668455, 48.83725602968279, 9.763948928670361],
    [35, 42, 48.83661293301137, 9.763862864599455, 48.83719817579144, 9.764027775468218],
    [43, 49, 48.83650495368246, 9.764006995755722, 48.837099327277585, 9.764124142956964],
    [50, 52, 48.83662401888115, 9.76416343005434, 48.836870631921, 9.764220931828527, { 51: "51a", 52: "51b" }],
    [52, 55, 48.835620446732456, 9.76350271323776, 48.83594508147658, 9.763574468528457],
    [56, 60, 48.83558995854129, 9.763796659884786, 48.836092986240914, 9.763869306728248],
    [61, 61, 48.83617907642538, 9.763747294938572],
    [62, 64, 48.835754238521616, 9.76396339024913, 48.835997439541615, 9.764025779538816],
    // 65 ???
    [66, 68, 48.83602927244979, 9.764188067168485, 48.836233158800944, 9.764272979454592],
    [69, 70, 48.83567000006237, 9.764180332312964, 48.83567445026981, 9.764337888210795],
    // 71 ???
    [88, 88, 48.83635976830587, 9.764333386670462, null, null, { 88: "88 ???" }],
    [72, 75, 48.83595075634674, 9.76429645585823, 48.836227941473815, 9.764410298332301, { 75: "75a" }],
    [75, 75, 48.836315232020254, 9.764486022962728, null, null, { 75: "75b" }],
    [75, 75, 48.83642155709868, 9.764661630195354, null, null, { 75: "75c" }],
    [76, 82, 48.83579648910798, 9.764333734514906, 48.83629219884369, 9.76460345990195],
    [83, 89, 48.838025890354764, 9.76456286434779, 48.83841502919975, 9.76526876253226, { 88: "88a ???", 89: "88b ???" }],
    [89, 96, 48.836933553520986, 9.764451193381408, 48.83762380215355, 9.764576598975896, { "93_name": "Oliver Hoffmann und Katrin Feisst - EDV<br>WLAN/Wifi<br>Kegelbahn<br>Volleyball" }],
    [97, 104, 48.8377249811905, 9.764658473445385, 48.83814164930723, 9.765360277010771, { 103: "103 ???", 104: "104 ???" }],
    [104, 111, 48.83699352256115, 9.764613652257806, 48.83760122032082, 9.764759719592085, { 104: "105a", 105: "105b" }],
    [112, 117, 48.83767668884647, 9.764802689616243, 48.837981295644944, 9.765297655986885],
    [118, 119, 48.836727887064, 9.76457178467303, 48.836810959549055, 9.76465863902205],
    [120, 127, 48.83689394878972, 9.76473713452227, 48.837559011855504, 9.76490722029549],
    [128, 131, 48.83764616043329, 9.764968001370395, 48.83782678000071, 9.765231027350131],
    [132, 132, 48.83784481912853, 9.765380907264296],
    [133, 138, 48.836420285283516, 9.764444586292592, 48.83673339516497, 9.764889523228835],
    [139, 145, 48.836804115454484, 9.764927423184337, 48.83727276209053, 9.765210035720376],
    [146, 152, 48.837368510735025, 9.765361530210294, 48.83777405489207, 9.765877761912517],
    [153, 159, 48.83731775102703, 9.765514153377355, 48.83769677797568, 9.76605968694413],
    [160, 166, 48.83726178811318, 9.765663880136582, 48.83763687323549, 9.766165263913743],
    [167, 172, 48.83722620032888, 9.765809580793688, 48.837553734924086, 9.766240303100558],
    [173, 178, 48.83716461725875, 9.76593715048998, 48.83747789876839, 9.766354434445368],
    [179, 184, 48.83709901873594, 9.766099422942647, 48.83738943752883, 9.766454759125988],
    // 185 ???
    [186, 192, 48.83578471569172, 9.764527334244633, 48.836260254053336, 9.76475913677535],
    [193, 195, 48.8363337301438, 9.76480585296901, 48.83652347387646, 9.764980093732714],
    // 196 .. 200 ???
    [201, 203, 48.83803844576284, 9.76541169526301, 48.83825327454763, 9.765561853059593],
    // 204 .. 213 ???
    [214, 218, 48.83790859853366, 9.765516024404873, 48.83822771573304, 9.765690480873301],
    [219, 224, 48.83831717427098, 9.765745926387021, 48.838724806594236, 9.766034640374722],
    [225, 228, 48.838782351034176, 9.766112895799285, 48.83897525192222, 9.766346218812256],
    [229, 235, 48.838467541784105, 9.766018164081338, 48.838882115066916, 9.766430605159279],
    [236, 240, 48.83854851024745, 9.76624427110358, 48.83880778534419, 9.766529292898875],
];

function initMap() {
    if (typeof google === "undefined") return;

    class TooltipOverlay extends google.maps.OverlayView {
        constructor(position, name, descr) {
            super();
            this.position = position;
            this.name = name;
            this.descr = descr;
            this.div = null;
        }

        onAdd() {
            this.div = document.createElement('div');
            this.div.style.position = 'absolute';
            this.div.style.background = 'rgba(255, 255, 255, 0.9)';
            this.div.style.border = '1px solid #999';
            this.div.style.borderRadius = '8px';
            this.div.style.padding = '8px 12px';
            this.div.style.fontSize = '14px';
            this.div.style.color = '#333';
            this.div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
            this.div.style.pointerEvents = 'none';
            this.div.style.maxWidth = '220px';
            this.div.style.lineHeight = '1.4';
            this.div.innerHTML = `<strong>${this.name}</strong><br>${this.descr}`;

            this.getPanes().overlayMouseTarget.appendChild(this.div);
        }

        draw() {
            if (this.div) {
                const pos = this.getProjection().fromLatLngToDivPixel(this.position);
                this.div.style.left = `${pos.x}px`;
                this.div.style.top = `${pos.y - 30}px`;
            }
        }

        onRemove() {
            if (this.div) this.div.remove();
            this.div = null;
        }
    }

    function drawPoly(map, bounds, cat, name, descr, url, paths) {

        const poly = new google.maps.Polygon({
            paths: paths,
            map,
            fillColor: categories[cat].color,
            fillOpacity: polyFillOpacity,
            strokeWeight: polyBorderWidth,
        });
        // handle a tooltip when moving mouse over the place
        let tooltip;
        poly.addListener("mouseover", (e) => {
            tooltip = new TooltipOverlay(e.latLng, name, descr);
            tooltip.setMap(map);
        });
        poly.addListener("mouseout", () => {
            if (tooltip) {
                tooltip.setMap(null);
                tooltip = null;
            }
        });

        if (url != "")
            poly.addListener("click", () => { window.open("https://webmaster98234.wixsite.com/fsg-alfdorf/" + url, "self"); });

        poly.getPath().forEach(latlng => bounds.extend(latlng));

        return poly;
    }

    function createLegend() {
        const legend = document.getElementById("legend");
        for (const category of Object.values(categories)) {
            const item = document.createElement("div");
            item.innerHTML = `
              <span style="display:inline-block; width:14px; height:14px; background:${category.color}; margin-right:8px; vertical-align:middle; border:1px solid #ccc;"></span>
              ${capitalize(category.legend)}
            `;
            legend.appendChild(item);
        }
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function startSearch(map) {
        const bounds = new google.maps.LatLngBounds();
        const s = document.getElementById("search").value.trim().toLowerCase();
        if (s) areas.forEach(area => {
            if (area.poly && (area.name.toLowerCase().includes(s) || area.descr.toLowerCase().includes(s)))
                flashPoly(bounds, area.poly, categories[area.category].color, categories[area.category].flashColor);
        });
        if (s) places.forEach(stripe => {
            const opts = stripe[6];
            if (opts && opts["poly"]) {
                if (opts["nrs"]) opts["nrs"].forEach((nr, i) => {
                    const c = nr[s.length];
                    if (nr.startsWith(s) && !(c >= '0' && c <= '9'))
                        flashPoly(bounds, opts["poly"][i], categories["places"].color, categories["places"].flashColor);
                });
                if (opts["names"]) opts["names"].forEach((name, i) => {
                    if (name.toLowerCase().includes(s))
                        flashPoly(bounds, opts["poly"][i], categories["places"].color, categories["places"].flashColor);
                });
            }
        });
        map.fitBounds(bounds);
    }

    function flashPoly(bounds, poly, orgColor, flashColor = orgColor) {
        const optFlash = { fillOpacity: 1, fillColor: flashColor };
        const optOrg = { fillOpacity: polyFillOpacity, fillColor: orgColor };
        poly.setOptions(optFlash);
        setTimeout(() => { poly.setOptions(optOrg); }, flashDelay);
        setTimeout(() => { poly.setOptions(optFlash); }, flashDelay * 2);
        setTimeout(() => { poly.setOptions(optOrg); }, flashDelay * 3);
        setTimeout(() => { poly.setOptions(optFlash); }, flashDelay * 4);
        setTimeout(() => { poly.setOptions(optOrg); }, flashDelay * 5);
        poly.getPath().forEach(latlng => bounds.extend(latlng));
    }

    const mobile = window.innerWidth <= 768;
    const map = new google.maps.Map(document.getElementById("map"), {
        zoom: mobile ? 17 : 18,
        center: mobile ? { lat: 48.832, lng: 9.77395 } : { lat: 48.8357, lng: 9.768 },
        mapTypeId: "satellite",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
    });

    const bounds = new google.maps.LatLngBounds();

    areas.forEach(area => {
        area.poly = drawPoly(map, bounds, area.category, area.name, area.descr, area.url, area.path);
    });

    const defWidthLat = 9.0 / 111320; // width of the stripe in case of latitude: 9m
    const defWidthLng = 9.0 / (111320 * Math.cos(48.84 * Math.PI / 180)); // width of the stripe in case of longitude: 9m at ~49°
    places.forEach(stripe => {
        const [nr0, nrN, lat0, lng0, latN = lat0, lngN = lng0, opts = {}] = stripe;
        const cnt = nrN - nr0; // number of places between
        const latDiff = latN - lat0;
        const lngDiff = lngN - lng0;
        // check in which direction we want to distribute our places (in none, if we only have one)
        const distributeLng = lngDiff > latDiff && cnt > 0;
        const distributeLat = lngDiff < latDiff && cnt > 0;
        const poly = [];
        const names = [];
        const nrs = [];
        for (let i = 0; i <= cnt; ++i) {
            const latC = cnt == 0 ? lat0 : lat0 + latDiff / cnt * i;
            const lngC = cnt == 0 ? lng0 : lng0 + lngDiff / cnt * i;
            const latS = distributeLat ? latDiff / cnt : defWidthLat; // latitude size of the rectangle
            const lngS = distributeLng ? lngDiff / cnt : defWidthLng; // longitude size of the rectangle
            const nr = `${opts[nr0 + i] ?? nr0 + i}`;
            const name = opts[`${nr0 + i}_name`] ?? opts[`${nr}_name`] ?? "";
            names.push(name);
            nrs.push(nr);
            poly.push(drawPoly(map, bounds, "places", nr, name || "Stellplatz", "", [
                { lat: latC - latS / 2, lng: lngC - lngS / 2 },
                { lat: latC + latS / 2, lng: lngC - lngS / 2 },
                { lat: latC + latS / 2, lng: lngC + lngS / 2 },
                { lat: latC - latS / 2, lng: lngC + lngS / 2 },
            ]));
        }
        opts["poly"] = poly;
        opts["nrs"] = nrs;
        opts["names"] = names;
        stripe[6] = opts; // in case it was null at stripe
    });

    map.fitBounds(bounds);

    createLegend();

    if (mobile) document.getElementById("legend").hidden = true;

    //document.getElementById("search").value = `${window.innerWidth}px x ${window.innerHeight}px`
    //      document.getElementById("map").style.width = `${window.innerWidth}px`;
    if (mobile) document.getElementById("map").style.height = `50dvh`;

    document.getElementById("search").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            this.blur();
            startSearch(map);
        }
    });
}
