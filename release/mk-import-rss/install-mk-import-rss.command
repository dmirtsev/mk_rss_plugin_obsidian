#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PLUGIN_ID="mk-import-rss"
PLUGIN_NAME="MK Import RSS"

choose_folder() {
  /usr/bin/osascript <<'APPLESCRIPT'
set chosenFolder to choose folder with prompt "Выберите папку вашего vault Obsidian"
POSIX path of chosenFolder
APPLESCRIPT
}

show_alert() {
  local title="$1"
  local message="$2"
  /usr/bin/osascript <<APPLESCRIPT
display alert "$title" message "$message" as informational buttons {"OK"} default button "OK"
APPLESCRIPT
}

VAULT_PATH="$(choose_folder | tr -d '\r\n')"

if [[ -z "${VAULT_PATH}" ]]; then
  exit 1
fi

if [[ "$(basename -- "${VAULT_PATH}")" == ".obsidian" ]]; then
  VAULT_PATH="$(dirname -- "${VAULT_PATH}")"
fi

if [[ ! -d "${VAULT_PATH}" ]]; then
  show_alert "Папка не найдена" "Выбранная папка не существует."
  exit 1
fi

if [[ ! -d "${VAULT_PATH}/.obsidian" ]]; then
  show_alert "Это не vault Obsidian" "В выбранной папке нет каталога .obsidian."
  exit 1
fi

TARGET_DIR="${VAULT_PATH}/.obsidian/plugins/${PLUGIN_ID}"
mkdir -p "${TARGET_DIR}"

cp "${SCRIPT_DIR}/manifest.json" "${TARGET_DIR}/manifest.json"
cp "${SCRIPT_DIR}/main.js" "${TARGET_DIR}/main.js"

if [[ -f "${SCRIPT_DIR}/styles.css" ]]; then
  cp "${SCRIPT_DIR}/styles.css" "${TARGET_DIR}/styles.css"
fi

show_alert \
  "${PLUGIN_NAME} установлен" \
  "Плагин установлен в:\n${TARGET_DIR}\n\nОткройте Obsidian -> Settings -> Community plugins и включите ${PLUGIN_NAME}."
