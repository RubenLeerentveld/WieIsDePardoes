# Wie is Pardoes? — Efteling editie
# Statische site: nginx serveert de bestanden en accepteert PUT op /live/ en
# /inbox/. Er draait verder geen applicatie.

FROM nginx:1.27-alpine

# Wachtwoord waarmee de spelleider naar /live/ mag schrijven. Overschrijf dit
# bij het bouwen:  docker build --build-arg WRITE_PASSWORD=iets-eigens .
ARG WRITE_USER=spelleider
ARG WRITE_PASSWORD=pardoes-archief

# Zonder de DAV-module accepteert nginx geen PUT en kan de site niets opslaan.
# Liever nu hard falen dan later een stille 405 in het park.
RUN nginx -V 2>&1 | tr ' ' '\n' | grep -q -- '--with-http_dav_module' \
    || (echo "FOUT: deze nginx is gebouwd zonder --with-http_dav_module" >&2 && exit 1)

# htpasswd-bestand aanmaken. nginx begrijpt {SHA} sinds 1.3.13, dus we hebben
# apache2-utils niet nodig; openssl kan weer weg na gebruik.
RUN apk add --no-cache openssl \
    && printf '%s:{SHA}%s\n' "$WRITE_USER" \
       "$(printf '%s' "$WRITE_PASSWORD" | openssl sha1 -binary | openssl base64)" \
       > /etc/nginx/.htpasswd \
    && chmod 640 /etc/nginx/.htpasswd \
    && chown root:nginx /etc/nginx/.htpasswd \
    && apk del openssl

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html login.html dashboard.html test.html results.html stats.html \
     leaderboard.html archief.html admin.html admin-questions.html \
     admin-tests.html admin-players.html admin-game.html admin-archief.html \
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
