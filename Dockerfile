# Wie is Pardoes? — Efteling editie
# Statische site: nginx serveert de bestanden en accepteert PUT op /live/ en
# /inbox/. Er draait verder geen applicatie.

FROM nginx:1.27-alpine

# Zonder de DAV-module accepteert nginx geen PUT en kan de site niets opslaan.
# Liever nu hard falen dan later een stille 405 in het park.
RUN nginx -V 2>&1 | tr ' ' '\n' | grep -q -- '--with-http_dav_module' \
    || (echo "FOUT: deze nginx is gebouwd zonder --with-http_dav_module" >&2 && exit 1)

# openssl blijft staan: het entrypoint gebruikt het om bij elke start het
# htpasswd-bestand op te bouwen uit de omgevingsvariabelen.
RUN apk add --no-cache openssl

# Wachtwoord waarmee de spelleider mag opslaan. Aanpasbaar zonder rebuild:
# zet WRITE_PASSWORD in Container Manager en herstart de container.
ENV WRITE_USER=spelleider
ENV WRITE_PASSWORD=password

COPY docker-entrypoint.d/10-htpasswd.sh /docker-entrypoint.d/10-htpasswd.sh
RUN chmod +x /docker-entrypoint.d/10-htpasswd.sh

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html login.html dashboard.html test.html results.html stats.html \
     leaderboard.html archief.html admin.html admin-questions.html \
     admin-tests.html admin-players.html admin-game.html admin-archief.html \
     admin-executie.html \
     404.html /usr/share/nginx/html/
COPY css/    /usr/share/nginx/html/css/
COPY js/     /usr/share/nginx/html/js/
COPY data/   /usr/share/nginx/html/data/
COPY assets/ /usr/share/nginx/html/assets/

# Schrijfbare mappen. Ze mogen leeg blijven: de site leest /live/ eerst en valt
# terug op /data/ zolang er nog niets is opgeslagen.
RUN mkdir -p /usr/share/nginx/html/live /usr/share/nginx/html/inbox \
    && chown -R nginx:nginx /usr/share/nginx/html/live /usr/share/nginx/html/inbox

EXPOSE 80
