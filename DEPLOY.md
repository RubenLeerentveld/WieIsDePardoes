# Uitrollen via Portainer

Deze handleiding gaat uit van de situatie: **Docker draait op een server die je
alleen via de Portainer-webinterface kunt bereiken**, en de site moet vanaf
telefoons in het park bereikbaar zijn.

Samengevat: de code komt in een privé Git-repository, Portainer haalt hem daar op
en bouwt de container. Je hebt geen terminal op de server nodig — ook niet voor de
updates tijdens de reis.

---

## 1. Zet de code in een privé repository

> **Maak de repository privé.** In `data/players.json` staan de pincodes en in
> `data/questions.json` de juiste antwoorden. Wie de site bezoekt kan die sowieso
> ophalen (zie README §12), maar een openbare repo wordt ook nog eens
> geïndexeerd en doorzoekbaar. Dat wil je niet.

1. Ga naar <https://github.com/new>.
2. Naam: bijvoorbeeld `wie-is-de-mol-efteling`.
3. Kies **Private**.
4. Maak géén README, `.gitignore` of licentie aan — die staan er al in.
5. Druk op *Create repository*.

Koppel daarna deze map aan die repository:

```bash
git remote add origin https://github.com/<jouw-gebruikersnaam>/wie-is-de-mol-efteling.git
```

```bash
git push -u origin main
```

Vraagt Git om een wachtwoord: dat is niet je GitHub-wachtwoord maar een
*personal access token*. Maak er een aan via
*GitHub → Settings → Developer settings → Personal access tokens → Fine-grained
tokens*, met **Contents: Read and write** op alleen deze repository.

---

## 2. Laat Portainer de stack bouwen

In Portainer:

1. **Stacks → Add stack**.
2. Naam: `wie-is-de-mol`.
3. Build method: **Repository**.
4. Repository URL: de HTTPS-URL van je repo.
5. Repository reference: `refs/heads/main`.
6. Compose path: `docker-compose.yml`.
7. Is de repo privé: zet **Authentication** aan en vul je gebruikersnaam en het
   token uit stap 1 in.
8. Zet **GitOps updates** aan als je wilt dat Portainer zelf periodiek nieuwe
   commits ophaalt. Anders gebruik je later de knop *Pull and redeploy*.
9. **Deploy the stack**.

Portainer kloont de repo, draait de build uit `Dockerfile` en start de container.
De eerste keer duurt dat ongeveer een minuut; daarna is het een paar seconden.

Controleer bij *Containers* of `wie-is-de-mol` op **healthy** staat. Die
healthcheck haalt `data/game.json` op, dus groen betekent dat nginx draait én dat
de speldata daadwerkelijk geserveerd wordt.

De site staat nu op `http://<server-ip>:8080`.

---

## 3. Bereikbaar maken vanaf het park

Poort 8080 op een thuisserver is vanaf mobiel internet niet bereikbaar. Drie
manieren om dat op te lossen, van meest naar minst aan te raden.

### a. Cloudflare Tunnel (geen poorten openzetten)

Je server maakt zelf een uitgaande verbinding met Cloudflare; er hoeft niets in je
router open. Je krijgt een HTTPS-adres op je eigen domein.

1. Ga naar het Cloudflare Zero Trust-dashboard → *Networks → Tunnels → Create a
   tunnel* → type **Cloudflared**.
2. Geef de tunnel een naam en kopieer het **token**.
3. In Portainer: **Stacks → Add stack**, methode *Web editor*, plak:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=plak-hier-je-token
```

4. Terug in Cloudflare: voeg onder *Public Hostnames* een hostname toe, bijvoorbeeld
   `mol.jouwdomein.nl`, met als service `http://wie-is-de-mol:80`.

Zorg dat beide stacks in hetzelfde Docker-netwerk zitten, anders vindt cloudflared
de container niet. Het simpelst is om de `cloudflared`-service in dezelfde stack te
zetten als `widm`; dan staan ze automatisch samen.

### b. Reverse proxy die je al hebt

Draai je al Nginx Proxy Manager, Traefik of Caddy: verwijs een subdomein naar
`wie-is-de-mol:80` en laat die proxy het TLS-certificaat regelen. Dit is de nette
oplossing als je server al een publiek IP heeft.

### c. Poort doorsturen in de router

Kan, maar dan staat de site zonder HTTPS open op het internet. Alleen doen als de
reis morgen begint en je niets anders werkend krijgt.

> **Test dit vóór vertrek.** Zet je telefoon op mobiel internet — wifi
> uitschakelen — en open de URL. Werkt hij daar, dan werkt hij in het park.

---

## 4. Data bijwerken tijdens de reis

Dit is de routine voor elke avond. Geen terminal op de server nodig.

1. Log in de site in als spelleider.
2. Maak de vragen voor de dag aan, koppel ze aan de testdag en zet die op
   *beschikbaar*.
3. Klik in de rode balk op **Exporteer**. Je krijgt de gewijzigde JSON-bestanden.
4. Zet die bestanden in `data/` op je laptop, over de oude heen.
5. Commit en push:

```bash
git add data && git commit -m "Dag 4: vragen en pot bijgewerkt" && git push
```

6. In Portainer: open de stack en klik op **Pull and redeploy**.
7. Klik in de admin op **Alles terugdraaien** om je lokale overlay te wissen. Vanaf
   nu lees je dezelfde data als de rest.

Stap 7 wordt makkelijk vergeten. Sla je hem over, dan zie jij je wijzigingen wel en
de spelers niet — precies het soort verwarring waar je op dag 4 geen zin in hebt.

---

## 5. Als er iets misgaat

| Wat je ziet | Wat er aan de hand is |
|---|---|
| **"Het archief blijft gesloten"** | De JSON-bestanden worden niet geserveerd. Meestal een bind-mount die een lege map over `data/` heen legt — controleer of het `volumes:`-blok in `docker-compose.yml` uitgecommentarieerd staat. |
| Container blijft **unhealthy** | Bekijk de containerlogs in Portainer. Zelfde oorzaak als hierboven: de healthcheck haalt `data/game.json` op. |
| **Oude versie** na een push | Portainer heeft de repo niet opnieuw opgehaald. Gebruik *Pull and redeploy*, niet *Restart*. |
| Werkt op wifi, **niet op mobiel** | De tunnel of proxy uit stap 3 is niet actief. Test opnieuw met wifi uit. |
| Speler ziet zijn score niet | Bedoeld gedrag zolang *Uitslag zichtbaar* uit staat voor die dag. Zet hem aan bij *Tests*. |
| Ingeleverde tests zijn **verdwenen** | Ze staan in de localStorage van de telefoon van die speler, niet op de server. Zie README §6. |

---

## 6. Zonder server, als het toch spannend wordt

Deze site is puur statisch. Loopt het uitrollen vast en staat de reis voor de deur:
sleep de projectmap naar <https://app.netlify.com/drop> of maak een project aan op
Cloudflare Pages. Je hebt binnen een minuut een HTTPS-adres dat vanaf elke telefoon
werkt, zonder Docker en zonder server. Bijwerken doe je dan door de map opnieuw te
slepen of, bij Cloudflare Pages, door naar dezelfde repo te pushen.
