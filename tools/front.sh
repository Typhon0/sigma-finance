#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CLIENT_DIR="${ROOT_DIR}/client"
PID_FILE="${CLIENT_DIR}/.vite.pid"
LOG_FILE="${CLIENT_DIR}/.vite.log"
PORT="${PORT:-${2:-3001}}"

get_pids() {
    # Check PID file first
    if [[ -f "${PID_FILE}" ]]; then
        local pid
        pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
        if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
            echo "${pid}"
            return 0
        fi
    fi
    # Fallback to port lookup
    lsof -ti:"${PORT}" 2>/dev/null || true
}

start() {
    local existing_pids
    existing_pids="$(get_pids)"
    if [[ -n "${existing_pids}" ]]; then
        echo "⚡ Frontend dev server déjà en cours d'exécution (PID: ${existing_pids}) sur http://localhost:${PORT}"
        return 0
    fi

    echo "🚀 Démarrage du frontend Vite dev server..."
    cd "${CLIENT_DIR}"
    setsid ./node_modules/.bin/vite --host 0.0.0.0 --port "${PORT}" </dev/null > "${LOG_FILE}" 2>&1 &
    local new_pid=$!
    echo "${new_pid}" > "${PID_FILE}"

    # Attendre que le port soit ouvert
    for i in {1..20}; do
        if lsof -ti:"${PORT}" >/dev/null 2>&1; then
            local listening_pid
            listening_pid="$(lsof -ti:"${PORT}" | head -n 1)"
            echo "${listening_pid}" > "${PID_FILE}"
            echo "✅ Frontend prêt sur http://localhost:${PORT} (PID: ${listening_pid})"
            echo "📄 Logs: ${LOG_FILE}"
            return 0
        fi
        sleep 0.5
    done

    echo "⚠️  Le serveur a été lancé mais le port ${PORT} n'a pas répondu immédiatement."
    echo "Consultez les logs : tail -f ${LOG_FILE}"
}

stop() {
    echo "🛑 Arrêt du frontend dev server..."
    local pids
    pids="$(get_pids)"

    if [[ -n "${pids}" ]]; then
        for pid in ${pids}; do
            kill -15 "${pid}" 2>/dev/null || true
        done

        # Attendre extinction
        for i in {1..10}; do
            if ! get_pids >/dev/null 2>&1; then
                break
            fi
            sleep 0.3
        done

        # Forcer si toujours vivant
        local remaining
        remaining="$(get_pids)"
        if [[ -n "${remaining}" ]]; then
            for pid in ${remaining}; do
                kill -9 "${pid}" 2>/dev/null || true
            done
        fi
    fi

    rm -f "${PID_FILE}"
    echo "✅ Frontend arrêté."
}

restart() {
    stop
    sleep 1
    start
}

status() {
    local pids
    pids="$(get_pids)"
    if [[ -n "${pids}" ]]; then
        echo "🟢 Frontend actif (PID: ${pids}) sur http://localhost:${PORT}"
        echo "📄 Logs: ${LOG_FILE}"
    else
        echo "🔴 Frontend inactif."
    fi
}

logs() {
    if [[ -f "${LOG_FILE}" ]]; then
        tail -n 50 -f "${LOG_FILE}"
    else
        echo "Aucun fichier de logs trouvé à ${LOG_FILE}"
    fi
}

case "${1:-status}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs} [port]"
        exit 1
        ;;
esac
