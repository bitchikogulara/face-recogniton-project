#!/usr/bin/env bash
# Sets up Mosquitto TLS certs and generates mosquitto.conf from the template.
# Run once per device (laptop, Raspberry Pi, etc.).
#
# Usage:
#   ./setup.sh                          # hostname defaults to faceconnect.local
#   ./setup.sh my-hostname.local        # custom hostname
#   ./setup.sh my-hostname.local 192.168.1.50  # also include a specific LAN IP in the cert
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/certs"
HOSTNAME="${1:-faceconnect.local}"
EXTRA_IP="${2:-}"

# ── Preflight ────────────────────────────────────────────────────────────────

if ! command -v mosquitto &>/dev/null; then
    echo "ERROR: Mosquitto is not installed."
    echo "  Ubuntu/Debian: sudo apt-get install mosquitto mosquitto-clients"
    echo "  Raspberry Pi:  sudo apt-get install mosquitto mosquitto-clients"
    exit 1
fi

if ! command -v openssl &>/dev/null; then
    echo "ERROR: openssl is not installed."
    exit 1
fi

# Auto-detect LAN IP (first non-loopback IPv4)
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

echo "──────────────────────────────────────────"
echo " FaceConnect — Mosquitto setup"
echo "──────────────────────────────────────────"
echo " Hostname : $HOSTNAME"
echo " LAN IP   : ${LAN_IP:-not detected}"
if [ -n "$EXTRA_IP" ]; then
    echo " Extra IP : $EXTRA_IP"
fi
echo " Certs dir: $CERTS_DIR"
echo "──────────────────────────────────────────"

# ── Certs ────────────────────────────────────────────────────────────────────

if [ -d "$CERTS_DIR" ]; then
    echo ""
    read -r -p "Certs directory already exists. Regenerate? [y/N] " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo "Skipping cert generation."
    else
        rm -rf "$CERTS_DIR"
    fi
fi

if [ ! -d "$CERTS_DIR" ]; then
    mkdir -p "$CERTS_DIR"
    chmod 700 "$CERTS_DIR"

    echo ""
    echo "Generating CA..."
    openssl genrsa -out "$CERTS_DIR/ca.key" 4096 2>/dev/null
    openssl req -new -x509 -days 3650 \
        -key "$CERTS_DIR/ca.key" \
        -out "$CERTS_DIR/ca.crt" \
        -subj "/CN=FaceConnect CA/O=FaceConnect/C=NO" 2>/dev/null
    echo "  CA cert valid for 10 years."

    echo "Generating server key and cert..."
    openssl genrsa -out "$CERTS_DIR/server.key" 4096 2>/dev/null

    openssl req -new \
        -key "$CERTS_DIR/server.key" \
        -out "$CERTS_DIR/server.csr" \
        -subj "/CN=$HOSTNAME/O=FaceConnect/C=NO" 2>/dev/null

    # Build SAN list: always include hostname, localhost, loopback
    SAN="DNS:${HOSTNAME},DNS:localhost,IP:127.0.0.1"
    [ -n "$LAN_IP" ]   && SAN="${SAN},IP:${LAN_IP}"
    [ -n "$EXTRA_IP" ] && SAN="${SAN},IP:${EXTRA_IP}"

    cat > "$CERTS_DIR/server.ext" <<EOF
[v3_req]
subjectAltName = $SAN
EOF

    openssl x509 -req -days 365 \
        -in "$CERTS_DIR/server.csr" \
        -CA "$CERTS_DIR/ca.crt" \
        -CAkey "$CERTS_DIR/ca.key" \
        -CAcreateserial \
        -out "$CERTS_DIR/server.crt" \
        -extfile "$CERTS_DIR/server.ext" \
        -extensions v3_req 2>/dev/null

    rm "$CERTS_DIR/server.csr" "$CERTS_DIR/server.ext"

    chmod 600 "$CERTS_DIR/ca.key" "$CERTS_DIR/server.key"
    chmod 644 "$CERTS_DIR/ca.crt" "$CERTS_DIR/server.crt"

    echo "  Server cert SANs: $SAN"
    echo "  Server cert valid for 1 year."
fi

# ── Config ───────────────────────────────────────────────────────────────────

echo ""
echo "Generating mosquitto.conf..."
sed \
    -e "s|{{CERTS_DIR}}|$CERTS_DIR|g" \
    -e "s|{{CONF_DIR}}|$SCRIPT_DIR|g" \
    "$SCRIPT_DIR/mosquitto.conf.template" > "$SCRIPT_DIR/mosquitto.conf"

# ── Password file ────────────────────────────────────────────────────────────

if [ ! -f "$SCRIPT_DIR/passwd" ]; then
    touch "$SCRIPT_DIR/passwd"
fi

# Mosquitto refuses to load acl/passwd if world-readable
chmod 600 "$SCRIPT_DIR/acl" "$SCRIPT_DIR/passwd"

# ── Users ────────────────────────────────────────────────────────────────────

USERS=("gateway" "lock-01" "lights-01")

# Check if all users already exist
ALL_EXIST=true
for u in "${USERS[@]}"; do
    if ! grep -q "^$u:" "$SCRIPT_DIR/passwd" 2>/dev/null; then
        ALL_EXIST=false
        break
    fi
done

if [ "$ALL_EXIST" = true ]; then
    echo ""
    echo "MQTT users already configured — skipping."
    echo "  To reset credentials, delete $SCRIPT_DIR/passwd and re-run setup.sh."
else
    echo ""
    echo "Creating MQTT users..."

    # gateway.env — read by the Node.js gateway
    GW_PASS="$(openssl rand -hex 16)"
    mosquitto_passwd -b "$SCRIPT_DIR/passwd" gateway "$GW_PASS"
    printf "MQTT_USERNAME=gateway\nMQTT_PASSWORD=%s\n" "$GW_PASS" > "$SCRIPT_DIR/gateway.env"
    echo "  gateway → $SCRIPT_DIR/gateway.env"

    # devices.env — read by the ESP32 simulator (or provisioned to real firmware)
    > "$SCRIPT_DIR/devices.env"
    for DEVICE in "lock-01" "lights-01"; do
        PASS="$(openssl rand -hex 16)"
        mosquitto_passwd -b "$SCRIPT_DIR/passwd" "$DEVICE" "$PASS"
        VAR="MQTT_PASSWORD_$(echo "$DEVICE" | tr '[:lower:]-' '[:upper:]_')"
        echo "${VAR}=${PASS}" >> "$SCRIPT_DIR/devices.env"
        echo "  $DEVICE → $SCRIPT_DIR/devices.env"
    done

    chmod 600 "$SCRIPT_DIR/gateway.env" "$SCRIPT_DIR/devices.env"
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "──────────────────────────────────────────"
echo " Setup complete."
echo "──────────────────────────────────────────"
echo ""
echo " Start broker:"
echo "   mosquitto -c $SCRIPT_DIR/mosquitto.conf"
echo ""
echo " Gateway credentials: $SCRIPT_DIR/gateway.env"
echo " Device credentials:  $SCRIPT_DIR/devices.env"
echo ""
echo " CA cert to bundle with the Android app and firmware:"
echo "   $CERTS_DIR/ca.crt"
echo ""
echo " NOTE: Server cert expires in 1 year. Re-run setup.sh to regenerate."
echo "──────────────────────────────────────────"
