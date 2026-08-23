#!/bin/sh
# Maakt bij het starten het htpasswd-bestand aan waarmee de spelleider naar
# /live/ mag schrijven. Draait automatisch: de officiele nginx-image voert
# alles in /docker-entrypoint.d/ uit voordat nginx start.
#
# Wachtwoord wijzigen? Pas de omgevingsvariabele WRITE_PASSWORD aan en start de
# container opnieuw. Geen rebuild nodig.
set -e

WRITE_USER="${WRITE_USER:-spelleider}"
WRITE_PASSWORD="${WRITE_PASSWORD:-password}"

hash=$(printf '%s' "$WRITE_PASSWORD" | openssl sha1 -binary | openssl base64)
printf '%s:{SHA}%s\n' "$WRITE_USER" "$hash" > /etc/nginx/.htpasswd

chmod 640 /etc/nginx/.htpasswd
chown root:nginx /etc/nginx/.htpasswd

echo "[widm] schrijftoegang ingesteld voor gebruiker '${WRITE_USER}'"

if [ "$WRITE_PASSWORD" = "password" ]; then
  echo "[widm] LET OP: het standaardwachtwoord is nog in gebruik."
fi
