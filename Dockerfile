# Wie is de Mol? — Efteling editie
# A static site: nginx serves the files, nothing else runs.

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html login.html dashboard.html test.html results.html stats.html \
     leaderboard.html admin.html admin-questions.html admin-tests.html \
     admin-players.html admin-game.html 404.html /usr/share/nginx/html/
COPY css/    /usr/share/nginx/html/css/
COPY js/     /usr/share/nginx/html/js/
COPY data/   /usr/share/nginx/html/data/
COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 80
