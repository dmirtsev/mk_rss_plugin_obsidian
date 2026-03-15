# Публикация в Obsidian

Этот файл нужен для первой публикации плагина `MK Import RSS` в каталоге community plugins Obsidian.

## Что уже готово

- `manifest.json` есть в корне репозитория.
- `README.md` есть в корне репозитория.
- `LICENSE` есть в корне репозитория.
- `versions.json` есть в корне репозитория.
- Релизный архив собирается через `npm run package`.
- Идентификатор плагина: `mk-import-rss`.

## Что нужно сделать перед первой публикацией

- [ ] Создать публичный GitHub-репозиторий для этого проекта.
- [ ] Загрузить в репозиторий исходники и файлы из корня проекта.
- [ ] Проверить, что `manifest.json` содержит правильные `id`, `name`, `author`, `description`, `version`.
- [ ] Проверить, что `version` в `manifest.json` имеет формат `x.y.z`.
- [ ] Проверить, что `README.md` описывает назначение плагина и способ использования.
- [ ] Собрать релиз командой `npm run package`.
- [ ] Создать git tag, который в точности совпадает с `manifest.json.version`.
- [ ] Отправить tag в GitHub.
- [ ] Дождаться GitHub Actions workflow `Release`.
- [ ] Форкнуть `obsidianmd/obsidian-releases`.
- [ ] Добавить запись о плагине в конец `community-plugins.json`.
- [ ] Открыть PR с типом `Community Plugin`.

## Команды для релиза

```bash
npm install
npm run check
npm run package
```

Если версия изменилась, перед релизом обнови:

- `manifest.json`
- `versions.json`

## GitHub Release

Релизный workflow сам создаёт GitHub Release и прикладывает assets:

- `main.js`
- `manifest.json`
- `styles.css` если файл существует
- zip-архив релиза

Тег должен быть ровно таким же, как версия в `manifest.json`.

Пример:

- `manifest.json` -> `"version": "0.1.0"`
- Git tag -> `0.1.0`
- GitHub Release -> `0.1.0`

Команды:

```bash
git tag 0.1.0
git push origin 0.1.0
```

## Что вставить в community-plugins.json

Смотри готовую заготовку:

- [submission/community-plugin-entry.json](/Users/dbashkirtsev/Desktop/cline-sandbox/4PluginMK/submission/community-plugin-entry.json)

Эту запись нужно добавить в конец массива `community-plugins.json`.

## Как назвать PR

```text
Add plugin: MK Import RSS
```

## Что вставить в PR

Смотри готовый текст:

- [submission/obsidian-pr-body.md](/Users/dbashkirtsev/Desktop/cline-sandbox/4PluginMK/submission/obsidian-pr-body.md)

## После открытия PR

- Дождаться автопроверки.
- Если появится `Ready for review`, ждать ручного ревью.
- Если появится `Validation failed`, исправить замечания и обновить релиз.
- Не открывать новый PR для исправлений первой публикации.
- Не ребейзить и не пытаться чинить merge conflicts вручную, если Obsidian пишет, что они есть.

## После одобрения

- Плагин появится в каталоге community plugins.
- После этого можно давать пользователям ссылку:

```text
obsidian://show-plugin?id=mk-import-rss
```

## Важно

- Obsidian читает `README.md` и `manifest.json` из GitHub-репозитория.
- Obsidian скачивает `main.js`, `manifest.json` и `styles.css` из GitHub Releases.
- Для следующих версий новый PR в `obsidian-releases` уже не нужен. Достаточно выпускать новые GitHub Releases.
