# Публикация в Obsidian

Этот файл нужен для первой публикации плагина `MK Import RSS` в каталоге community plugins Obsidian.

## Что уже готово

- `manifest.json` есть в корне репозитория.
- `README.md` есть в корне репозитория.
- `LICENSE` есть в корне репозитория.
- `versions.json` есть в корне репозитория.
- Релизный архив собирается через `npm run package`.
- Идентификатор плагина: `mk-import-rss`.
- В GitHub Actions уже настроены CI и автоматический релиз.

## Что нужно сделать перед первой публикацией

- [ ] Убедиться, что GitHub-репозиторий публичный.
- [ ] Проверить, что `manifest.json` содержит правильные `id`, `name`, `author`, `description`, `version`.
- [ ] Проверить, что `version` в `manifest.json` имеет формат `x.y.z`.
- [ ] Проверить, что `README.md` объясняет назначение плагина и установку.
- [ ] Выполнить локальную проверку проекта.
- [ ] Создать git tag, который в точности совпадает с `manifest.json.version`.
- [ ] Отправить tag в GitHub.
- [ ] Дождаться успешного workflow `Release` в GitHub Actions.
- [ ] Форкнуть `obsidianmd/obsidian-releases`.
- [ ] Добавить запись о плагине в конец `community-plugins.json`.
- [ ] Открыть PR с типом `Community Plugin`.

## Локальная проверка

```bash
npm ci
npm run check
npm run package
```

Если версия изменилась, перед релизом обнови:

- `manifest.json`
- `versions.json`

## GitHub Release

Релизный workflow сам создаёт GitHub Release и прикладывает:

- `main.js`
- `manifest.json`
- `styles.css`, если файл существует
- zip-архив релиза

Тег должен быть ровно таким же, как версия в `manifest.json`.

Пример:

- `manifest.json` -> `"version": "0.1.4"`
- git tag -> `0.1.4`
- GitHub Release -> `0.1.4`

Команды:

```bash
git tag 0.1.4
git push origin 0.1.4
```

## Что вставить в community-plugins.json

Используй эту заготовку:

- `submission/community-plugin-entry.json`

Её нужно добавить в конец массива `community-plugins.json`.

## Как назвать PR

```text
Add plugin: MK Import RSS
```

## Что вставить в PR

Используй готовый текст:

- `submission/obsidian-pr-body.md`

## После открытия PR

- Дождаться автопроверки.
- Если появится `Ready for review`, ждать ручного ревью.
- Если валидация упадёт, исправить проблему и обновить релиз.
- Не открывать второй PR для той же первой публикации.

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
