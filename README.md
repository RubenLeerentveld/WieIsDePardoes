# Wie is Pardoes? — Efteling editie

Een privé *Wie is Pardoes?*-website voor een groep vrienden of familie tijdens een dag
(of vier) in de Efteling. Eén van de spelers is Pardoes. Elke dag krijgt iedereen een
test van tien vragen over wat er die dag gebeurde: wie stond waar, wie zei wat, wie
deed iets vreemds. Wie de meeste vragen goed heeft ziet het meest — maar het gaat er
uiteindelijk om wie Pardoes vindt.

De site is opzettelijk **volledig statisch**: HTML, CSS en vanilla JavaScript, meer
niet. Geen build, geen backend, geen database. Je kunt hem serveren met nginx, met
`python -m http.server`, of vanaf elke willekeurige statische host.

---

## 1. Wat dit project is

| | |
|---|---|
| **Techniek** | HTML + CSS + vanilla JS (ES2017), geen frameworks, geen build step |
| **Externe afhankelijkheden** | Alleen Google Fonts via CDN (met lokale fallbacks) |
| **Data** | JSON-bestanden in `data/` |
| **Server** | nginx serveert statische bestanden — er draait geen applicatie |
| **Taal** | Nederlands |

---

## 2. Architectuur

```
index.html              Cover: sfeer, huidige dag, pot
login.html              Inloggen als speler of spelleider
dashboard.html          Persoonlijk dossier van de speler
test.html               De test van de dag (10 vragen)
results.html            Uitslag per dag, vraag voor vraag
stats.html              Persoonlijke statistieken
leaderboard.html        Klassement + onderzoeksbord
admin.html              Overzicht voor de spelleider
admin-questions.html    Vragen aanmaken en bewerken
admin-tests.html        Testdagen openen, sluiten, vullen
admin-players.html      Spelers en pincodes
admin-game.html         Dag, pot en zichtbaarheid
404.html                Vriendelijke foutpagina

css/main.css            Design tokens, reset, typografie, layout, sfeerlagen
css/components.css      Herbruikbare componenten (kaarten, knoppen, bord, test-UI)
css/animations.css      Keyframes + volledige reduced-motion ondersteuning

js/app.js               Namespace, helpers, header/footer, sfeer, page-boot
js/data.js              Datalaag: JSON laden, lokale overlay, export/import
js/auth.js              Lichtgewicht login en page guard
js/game.js              Speldomein: scores, statistieken, klassement
js/gate.js              index.html + login.html
js/dashboard.js         dashboard.html
js/test.js              test.html
js/results.js           results.html
js/stats.js             stats.html + leaderboard.html
js/admin.js             Admin-shell, exportpaneel, overzichtspagina
js/admin-editors.js     De vier editors (vragen, tests, spelers, spel)

data/*.json             Alle speldata
assets/favicon.svg      Het enige beeldbestand — de rest is CSS en inline SVG
```

Elke pagina laadt dezelfde vier basisscripts plus één paginascript. `WIDM.page()` in
`app.js` regelt het opstarten: sfeerlagen plaatsen, sessie controleren, data laden,
header en footer renderen, fouten netjes afvangen.

**Scores staan nergens opgeslagen.** Een uitslag bevat alleen de gegeven antwoorden.
Score, gemiddelde en klassement worden altijd opnieuw berekend in `js/game.js`. Corrigeer
je achteraf een fout antwoord in een vraag, dan kloppen alle scores meteen weer.

---

## 3. Lokaal draaien

Je hebt een webserver nodig. Openen via `file://` werkt **niet**: browsers weigeren dan
JSON-bestanden in te lezen. De site laat in dat geval een duidelijke melding zien.

```bash
python -m http.server 8123
```

Open daarna <http://localhost:8123>. Elke andere statische server werkt ook, bijvoorbeeld
`npx serve` of de Live Server-extensie van VS Code.

---

## 4. Draaien met Docker

```bash
docker compose up -d
```

De site staat dan op <http://localhost:8080>.

`docker-compose.yml` mount `./data` als read-only volume in de container. Je kunt dus een
JSON-bestand op de host vervangen en de pagina verversen — geen rebuild, geen herstart.
Alleen bij wijzigingen in HTML, CSS of JS is `docker compose up -d --build` nodig.

Poort aanpassen? Wijzig `"8080:80"` in `docker-compose.yml`.

---

## 5. Hoe de JSON-data werkt

Alle speldata staat in `data/`. Dit is de enige bron van waarheid.

### `game.json`
```json
{
  "title": "Wie is Pardoes?",
  "subtitle": "Iedereen heeft een geheim.",
  "location": "Efteling",
  "edition": "Editie 2026",
  "currentDay": 3,
  "totalDays": 4,
  "pot": 1240,
  "maxPot": 2400
}
```

### `players.json`
```json
[
  { "id": "ruben", "name": "Ruben", "pin": "1234",
    "initials": "RB", "joined": "2026-08-15",
    "note": "Houdt alles bij in een zwart notitieblok." }
]
```
`id` is uniek en verandert nooit — uitslagen verwijzen ernaar. `note` verschijnt
handgeschreven op het onderzoeksbord.

### `questions.json`
```json
[
  { "id": "q301", "day": 3, "category": "locatie",
    "question": "Wie stond het langst bij de ingang van Villa Volta?",
    "answers": ["Ruben", "Lisa", "Thomas", "Sophie"],
    "correctAnswer": 0,
    "explanation": "Ruben bleef bij de ingang staan." }
]
```
`correctAnswer` is een **index**: 0 = A, 1 = B, 2 = C, 3 = D. Categorieën
(`gedrag`, `opdracht`, `feiten`, `uitspraken`, `geld`, `locatie`) voeden de grafiek
"Waar je op let" op de statistiekenpagina.

### `tests.json`
```json
[
  { "day": 3, "title": "De Betovering",
    "subtitle": "Eén van jullie speelt een ander spel.",
    "date": "2026-08-17",
    "available": true,
    "resultsVisible": false,
    "leaderboardVisible": true,
    "questionIds": ["q301", "q302", "…"] }
]
```
`questionIds` bepaalt welke vragen in de test staan én in welke volgorde. Is de lijst
leeg, dan vallen we terug op alle vragen met dat dagnummer.

| Vlag | Betekenis |
|---|---|
| `available` | De test staat open; spelers kunnen hem maken |
| `resultsVisible` | De uitslag van deze dag is vrijgegeven |
| `leaderboardVisible` | Deze dag telt mee in de zichtbare dagstand |

### `results.json`
```json
[
  { "playerId": "ruben", "day": 1,
    "answers": [2, 1, 3, 1, 1, 0, 3, 0, 2, 1],
    "submittedAt": "2026-08-15T21:12:00Z",
    "durationSeconds": 214 }
]
```
`answers[i]` hoort bij `questionIds[i]`. De waarde `-1` betekent "niet beantwoord" en
telt als fout.

### `settings.json`
```json
{
  "adminPin": "9310",
  "leaderboardVisible": true,
  "showScoresToPlayers": true,
  "showRankToPlayers": true,
  "showCorrectAnswers": false,
  "allowRetake": false,
  "showSuspicionMeter": true
}
```

---

## 6. Beperking van statische hosting — en de werkwijze

**Een browser kan geen bestanden op de server schrijven.** Er is geen backend, dus er is
niets dat `data/questions.json` kan aanpassen. Dat is een bewuste keuze: het houdt de
deploy triviaal.

De adminpagina's doen daarom dit:

1. Wijzigingen worden opgeslagen in **localStorage**, in een aparte "overlay".
2. Bij het lezen wordt de overlay over de JSON-bestanden heen gelegd.
3. Zolang er een overlay bestaat, staat er bovenaan elke adminpagina een rode balk.
4. Je exporteert de gewijzigde bestanden en zet ze zelf op de server.

```
data/*.json     canonieke data — voor iedereen, blijft bestaan
localStorage    lokale wijzigingen — alleen deze browser, deze computer
```

De volledige cyclus:

1. Pas iets aan in de admin (vraag toevoegen, test openzetten, pot bijwerken).
2. Klik op **Exporteer** in de rode balk of in het paneel *Gegevens*.
3. Vervang het gedownloade bestand in `data/` op de server (of in de gemounte map).
4. Klik op **Alles terugdraaien** om de overlay te wissen — je leest nu weer de
   serverbestanden, met jouw wijzigingen erin.

Stap 4 is belangrijk: zolang de overlay bestaat, ziet **alleen jouw browser** die versie.

> **Let op:** tests die spelers inleveren belanden in de localStorage van *hun eigen
> telefoon*. Om ze te verzamelen laat je de speler op de adminpagina inloggen en
> `results.json` exporteren, of je vult de antwoorden zelf in. Voor een spel met zes
> mensen is dat prima te doen; wil je het automatisch, dan heb je een backend nodig —
> en dat is precies wat dit project níet wil zijn.

Het paneel *Gegevens* biedt ook **Volledige back-up**: één bestand met alles erin, dat
je later weer kunt importeren.

---

## 7. Een speler toevoegen

**Via de admin:** *Spelers → Nieuwe speler*. Vul naam, pincode en eventueel een
aantekening in. Exporteer daarna `players.json` en zet het bestand op de server.

**Met de hand:** voeg een blok toe aan `data/players.json`:

```json
{ "id": "noor", "name": "Noor", "pin": "4821", "initials": "NR",
  "joined": "2026-08-15", "note": "Zegt weinig, ziet veel." }
```

Houd `id` in kleine letters zonder spaties. Verander een bestaande `id` nooit: uitslagen
in `results.json` verwijzen ernaar.

---

## 8. Een vraag toevoegen

**Via de admin:** *Vragen → Nieuwe vraag*. Kies de dag, typ de vraag, vul vier antwoorden
in en kies welk antwoord juist is. De vraag wordt automatisch gekoppeld aan de testdag met
dat dagnummer. Met het oog-icoon zie je precies wat de speler te zien krijgt.

Je kunt vragen ook **dupliceren** — handig als je vier varianten op "wie stond waar" maakt.

**Met de hand:** voeg een object toe aan `data/questions.json` en zet het `id` erbij in
`questionIds` van de juiste test in `data/tests.json`.

---

## 9. Een test aanmaken

1. Ga naar *Tests → Nieuwe testdag*.
2. Geef een dagnummer, een titel ("Het Vuur") en een sfeervolle ondertitel.
3. Maak tien vragen aan voor die dag.
4. Klik op **Vragen koppelen** en vink aan welke vragen meedoen.
5. Zet **Test beschikbaar** aan zodra de dag voorbij is.
6. Exporteer `tests.json` en `questions.json` en zet ze op de server.

Zet **Uitslag zichtbaar** pas aan wanneer je wilt dat spelers hun score zien. Zolang die
uit staat, krijgen ze na het inleveren netjes te horen dat hun waarnemingen verzegeld zijn.

---

## 10. De huidige dag wijzigen

*Spel → Huidige dag*, of pas `currentDay` in `data/game.json` aan. Dat bepaalt welke test
het dashboard als "de test van vandaag" aanbiedt. Pot bijwerken gaat op dezelfde plek;
`maxPot` voedt de voortgangsbalk onder het bedrag.

---

## 11. Hoe uitslagen werken

- Een speler maakt de test in één keer; er is geen tussentijds opslaan.
- Bij inleveren wordt een record toegevoegd aan `results` met de gegeven antwoorden.
- De score wordt **berekend**, niet opgeslagen.
- `allowRetake` in `settings.json` bepaalt of iemand een test opnieuw mag maken.
- Wil je iemand een tweede kans geven zonder dat voor iedereen open te zetten: ga naar
  *Spelers → Ingeleverde tests* en verwijder die ene inzending.
- Punten in het klassement zijn simpelweg alle juiste antwoorden bij elkaar. Bij gelijke
  stand telt eerst het aantal gemaakte tests, dan de snelste totaaltijd.

---

## 12. Beveiliging

**Er is geen beveiliging.** Dit is een spelletje voor onder elkaar, geen applicatie.

- Alle pincodes staan leesbaar in `data/players.json`, dat iedereen kan downloaden.
- De code van de spelleider staat in `data/settings.json`.
- De juiste antwoorden staan in `data/questions.json`.
- De sessie is een regel in localStorage; die kan iedereen bewerken.

Iemand die wil vals spelen, kan dat moeiteloos. Gebruik daarom:

- geen pincode die je ergens anders ook gebruikt;
- geen echte persoonsgegevens in de aantekeningen;
- bij voorkeur een niet-geïndexeerde URL of een adres in je eigen netwerk.

Wil je het spannender houden: zet de site pas online op de ochtend van dag 1, en houd
`showCorrectAnswers` uit tot na de finale.

---

## 13. Het thema aanpassen

Alle kleuren, ruimtes en fonts zijn CSS-variabelen bovenin `css/main.css`:

```css
:root {
  --forest-950: #0a1310;   /* basis van de achtergrond */
  --emerald-700: #1b4232;  /* accenten in kaarten */
  --burgundy-500: #8c2438; /* zegels, waarschuwingen, draad op het bord */
  --gold-500: #c9a227;     /* kaarslicht: knoppen, cijfers, randen */
  --parchment-100: #f6edd8;/* papier */
  --font-display: "Cinzel", Georgia, serif;
  --font-body: "Spectral", Georgia, serif;
  --font-hand: "Caveat", cursive;
}
```

Andere sfeer? Vervang de vier hoofdkleuren en de site volgt vanzelf.

- **Sfeerlagen** (maan, mist, silhouet, vignet, korrel) worden opgebouwd in
  `mountAtmosphere()` in `js/app.js`. Het kasteel en de bomen zijn gegenereerde SVG-paden,
  geen afbeeldingen.
- **Stofdeeltjes** staan in `startDust()`. Minder deeltjes? Pas de aantallen `22` en `46`
  aan. Ze pauzeren automatisch als het tabblad op de achtergrond staat.
- **Animaties** staan in `css/animations.css` en worden volledig uitgeschakeld bij
  `prefers-reduced-motion: reduce`.
- **Fonts** zitten in één `<link>` per pagina. Haal je die weg, dan valt de site terug op
  Georgia — nog steeds prima leesbaar, handig als er in het park geen internet is.

---

## 14. Toegankelijkheid

- Semantische HTML met `<main>`, `<nav>`, `<header>`, koppenstructuur en `aria-label`s.
- Skip-link naar de inhoud op elke pagina.
- Zichtbare focusrand op alles wat focus kan krijgen.
- De test is volledig met het toetsenbord te maken: **A–D** of **1–4** om te kiezen,
  pijltjestoetsen om te navigeren, **Esc** sluit een dialoog.
- Antwoordknoppen zijn echte `<button>`s met `aria-pressed`.
- Alle animaties respecteren `prefers-reduced-motion`.
- Tekstcontrast is getest op de donkere achtergrond; tabellen scrollen binnen hun eigen
  kader in plaats van de pagina.

---

## 15. Demodata

Het project komt met een compleet ingevuld spel: 6 spelers, 4 speeldagen, 40 vragen,
16 ingeleverde tests en een gevulde pot. Ruben (pin `1234`) heeft de test van dag 3 nog
openstaan, zodat je de testflow meteen kunt proberen.

| Speler | Pin | | Speler | Pin |
|---|---|---|---|---|
| Ruben | 1234 | | Sophie | 8642 |
| Lisa | 2468 | | Mark | 7531 |
| Thomas | 1357 | | Emma | 9876 |

Spelleider: **9310**

Namen en gebeurtenissen zijn verzonnen. Vervang ze door je eigen groep voordat je begint.

---

## 16. Over de Efteling

Dit is een privéproject en geen product van de Efteling. Er zijn geen logo's, beelden of
andere materialen van de Efteling gebruikt; de vormgeving is een eigen interpretatie van
een donker sprookjesbos. Attractienamen in de demovragen zijn puur beschrijvend en
vervang je sowieso door je eigen dagverslag.
