#!/bin/sh
# Maakt bij het starten het htpasswd-bestand aan waarmee de spelleider naar
# /live/ mag schrijven. Draait automatisch: de officiele nginx-image voert
# alles in /docker-entrypoint.d/ uit voordat nginx start.
#
# Wachtwoord wijzigen? Pas de omgevingsvariabele WRITE_PASSWORD aan en start de
# container opnieuw. Geen rebuild nodig.
#
# BEWUST GEEN `set -e`. De entrypoint van nginx draait zelf met set -e, dus een
# fout hier zou de hele container laten stoppen voordat nginx ook maar start.
# Opslaan is belangrijk, maar niet belangrijker dan een werkende site: als dit
# misgaat draait de site gewoon door, alleen kan de spelleider niets opslaan.

WRITE_USER="${WRITE_USER:-spelleider}"
WRITE_PASSWORD="${WRITE_PASSWORD:-password}"

echo "[widm] schrijftoegang instellen voor gebruiker '${WRITE_USER}'"

hash=$(printf '%s' "$WRITE_PASSWORD" | openssl sha1 -binary 2>/dev/null | openssl base64 2>/dev/null)

if [ -n "$hash" ]; then
  printf '%s:{SHA}%s\n' "$WRITE_USER" "$hash" > /etc/nginx/.htpasswd 2>/dev/null \
    && echo "[widm] htpasswd aangemaakt" \
    || echo "[widm] WAARSCHUWING: kon /etc/nginx/.htpasswd niet schrijven"
else
  # openssl ontbreekt of faalde: val terug op een leesbaar wachtwoord. nginx
  # ondersteunt {PLAIN} sinds 1.0.3. Minder netjes, maar beter dan geen site.
  echo "[widm] WAARSCHUWING: openssl niet beschikbaar, val terug op {PLAIN}"
  printf '%s:{PLAIN}%s\n' "$WRITE_USER" "$WRITE_PASSWORD" > /etc/nginx/.htpasswd 2>/dev/null \
    || echo "[widm] WAARSCHUWING: kon /etc/nginx/.htpasswd niet schrijven"
fi

chmod 640 /etc/nginx/.htpasswd 2>/dev/null || true
chown root:nginx /etc/nginx/.htpasswd 2>/dev/null || true

# De schrijfbare mappen kunnen als NAS-map gekoppeld zijn en dan van een andere
# eigenaar zijn. Proberen, en anders duidelijk melden in het log.
for dir in /usr/share/nginx/html/live /usr/share/nginx/html/inbox; do
  mkdir -p "$dir" 2>/dev/null || true
  chown -R nginx:nginx "$dir" 2>/dev/null \
    || echo "[widm] LET OP: geen eigenaar van ${dir} — opslaan kan een 403 geven"
done

if [ "$WRITE_PASSWORD" = "password" ]; then
  echo "[widm] LET OP: het standaardwachtwoord is nog in gebruik."
fi

echo "[widm] klaar; nginx start nu"
exit 0
