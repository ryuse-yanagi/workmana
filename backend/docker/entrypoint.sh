#!/bin/bash
set -euo pipefail

role="${APP_RUNTIME:-web}"

shutdown_pids() {
    local pid
    for pid in "$@"; do
        if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
            kill -TERM "${pid}" 2>/dev/null || true
        fi
    done
    wait || true
}

start_reverb_process() {
    php artisan reverb:start \
        --host="${REVERB_SERVER_HOST:-0.0.0.0}" \
        --port="${REVERB_SERVER_PORT:-8080}" &
    echo $!
}

start_http_processes() {
    php-fpm -F &
    echo $!
    nginx -g "daemon off;" &
    echo $!
}

case "$role" in
    reverb)
        exec php artisan reverb:start \
            --host="${REVERB_SERVER_HOST:-0.0.0.0}" \
            --port="${REVERB_SERVER_PORT:-8080}"
        ;;
    http)
        readarray -t http_pids < <(start_http_processes)
        trap 'shutdown_pids "${http_pids[@]}"' SIGTERM SIGINT
        wait -n "${http_pids[@]}"
        shutdown_pids "${http_pids[@]}"
        exit 1
        ;;
    web)
        export REVERB_BROADCAST_HOST="${REVERB_BROADCAST_HOST:-127.0.0.1}"
        export REVERB_BROADCAST_PORT="${REVERB_BROADCAST_PORT:-8080}"
        export REVERB_BROADCAST_SCHEME="${REVERB_BROADCAST_SCHEME:-http}"
        reverb_pid="$(start_reverb_process)"
        readarray -t http_pids < <(start_http_processes)
        pids=("${reverb_pid}" "${http_pids[@]}")
        trap 'shutdown_pids "${pids[@]}"' SIGTERM SIGINT
        wait -n "${pids[@]}"
        shutdown_pids "${pids[@]}"
        exit 1
        ;;
    *)
        echo "Unknown APP_RUNTIME=${role} (expected web, http, or reverb)" >&2
        exit 1
        ;;
esac
