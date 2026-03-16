# MK Import RSS

[English](README.md) | Русский

Плагин Obsidian для импорта элементов RSS-ленты MK в markdown-заметки.

## Что делает плагин

- Загружает RSS по URL и превращает элементы ленты в заметки.
- Может обрабатывать XML-файлы из inbox-папки внутри vault.
- Создаёт папки и имена заметок по шаблонам.
- Добавляет метаданные `mk_*` во frontmatter.
- Может вставлять удалённые картинки или скачивать их в vault.

## Установка

### Лучший вариант для обычного пользователя

После публикации в официальном каталоге Obsidian Community Plugins пользователь сможет:

1. Открыть `Settings -> Community plugins`.
2. Найти `MK Import RSS`.
3. Нажать `Install`.
4. Включить плагин.

После публикации можно также давать ссылку:

```text
obsidian://show-plugin?id=mk-import-rss
```

### Пока плагин ещё не опубликован

Самый простой вариант сейчас: скачать zip-архив релиза с GitHub.

#### macOS

1. Скачайте zip-архив релиза из GitHub Releases.
2. Распакуйте архив.
3. Откройте папку `mk-import-rss`.
4. Дважды кликните `install-mk-import-rss.command`.
5. Выберите ваш vault Obsidian.
6. Включите `MK Import RSS` в `Settings -> Community plugins`.

Если macOS блокирует запуск, нажмите правой кнопкой по файлу и выберите `Open`.

#### Windows

1. Скачайте zip-архив релиза из GitHub Releases.
2. Распакуйте архив.
3. Откройте папку `mk-import-rss`.
4. Кликните правой кнопкой по `install-mk-import-rss.ps1`.
5. Выберите `Run with PowerShell`.
6. Выберите ваш vault Obsidian.
7. Включите `MK Import RSS` в `Settings -> Community plugins`.

Если PowerShell блокирует запуск:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-mk-import-rss.ps1
```

#### Ручная установка

Скопируйте эти файлы в папку:

```text
.obsidian/plugins/mk-import-rss/
```

Нужные файлы:

- `manifest.json`
- `main.js`

После этого перезапустите Obsidian или перезагрузите community plugins и включите `MK Import RSS`.

## Разработка

```bash
npm ci
npm run check
npm run build
```

## Подготовка релиза

```bash
npm run package
```

Будут созданы:

- `release/mk-import-rss/`
- `release/mk-import-rss-0.1.3.zip`

## Release flow

В репозитории настроен автоматический выпуск релиза через GitHub Actions.

1. Обновите `manifest.json` и `versions.json`.
2. Проверьте проект локально:

```bash
npm ci
npm run check
npm run package
```

3. Создайте и отправьте тег, который точно совпадает с версией в `manifest.json`:

```bash
git tag 0.1.3
git push origin 0.1.3
```

После этого GitHub Actions автоматически:

- проверит TypeScript
- соберёт плагин
- создаст GitHub Release
- приложит `main.js`, `manifest.json`, optional `styles.css` и zip-архив

## Переход со старой версии

Раньше у плагина был id `prefix-organizer`. Сейчас используется `mk-import-rss`.

Если старая локальная версия ещё установлена, удалите:

```text
.obsidian/plugins/prefix-organizer/
```

И установите новую в:

```text
.obsidian/plugins/mk-import-rss/
```
