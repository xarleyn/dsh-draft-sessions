# dsh-draft-sessions

Постоянные неотправленные будущие диалоги для [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Цель плагина — дать привычный по Cursor UX: можно подготовить несколько независимых задач, уйти из них без отправки и позже продолжить каждую с сохранённым текстом.

> [!IMPORTANT]
> Сейчас это ранняя alpha-версия. Durable lifecycle черновика, composer bridge и взаимодействия в sidebar уже реализованы. Release-проверки после рестартов, в браузерах, на разных ОС и поддерживаемых версиях DSH ещё в работе.

[English](README.md) · [Спецификация](SPEC.md) · [Архитектура](docs/architecture.md) · [План](ROADMAP.md)

## Что уже реализовано

- Host-backed JSON-хранилище в `$DSH_HOME/storages/dsh-draft-sessions/drafts.json`.
- Строгие Remote-методы `draftSessions.list/create/update/delete/rebind`.
- Независимый порядок в workspace и настраиваемый лимит.
- Optimistic revision: устаревшая запись из второго браузера не затирает свежую.
- Атомарная запись файла и строгая проверка данных при загрузке.
- Создание отдельной blank Session с сохранением id только после успеха.
- Обнаружение исчезнувшей Session и recovery через замену без потери текста.
- Финализация только после принятого Send и подтверждённого `blank: false`.
- Сохранение draft при отклонённом Send и blank slash-командах.
- Точное восстановление текста через официальный per-session InputHub.
- Debounced optimistic autosave с обязательным flush перед переключением.
- Создание через `+` в секции Drafts или `Ctrl/Cmd + Shift + N`; оба действия сначала сохраняют активный draft, затем открывают отдельный новый.
- Muted draft-строки перед обычными Sessions через аддитивный slot `sidebar.workspaces.before`.
- Вынесенные поверх панелей row-меню, inline rename, duplicate, подтверждаемое удаление, клавиатурная навигация и ограниченный drag reorder.
- Безопасное удаление активного draft с финальным autosave flush и восстановлением после отказа.
- Slot-local исключение backing shell, не изменяющее активный штатный browser или Archive Manager.
- Unit- и DOM-тесты persistence, concurrency, lifecycle, composer и sidebar.

Текущий код не отправляет prompt, не изменяет историю обычных Sessions и не удаляет blank Sessions.

## Требования

- Node.js `^22.19.0` или `>=24.0.0`
- pnpm 11
- Сборка DeepSeek Harness с `sidebar.workspaces.before` и `slots.excludeSessionRows`

Host API остаётся совместимым с диапазоном `next` `>=0.1.1-rc.2 <0.2.0`, но опубликованный клиент rc.2 ещё не содержит две функции композиции. Контракт функций записан в `compatibility.json`; на старом клиенте активация завершается явной ошибкой вместо незаметного исчезновения draft-строк.

## Локальная разработка

```bash
cd dsh-draft-sessions
pnpm install
pnpm check
```

Сборка и подключение checkout к Web profile:

```bash
pnpm build
dsh plugin --profile web add .
dsh --profile web --dump-config
```

Удаление:

```bash
dsh plugin --profile web remove dsh-draft-sessions
```

## Релизы

Релизы собираются из существующих SemVer-тегов с префиксом `v` ручным [Release workflow](.github/workflows/release.yml). Workflow делает checkout точного тега, запускает полный quality gate, подставляет в пакет версию из тега, создаёт npm tarball и SHA-256 checksum, проверяет чистую установку tarball, загружает Actions artifact и оформляет GitHub Release с автоматически сгенерированными notes.

Maintainer может запустить его через **Actions → Release → Run workflow** или GitHub CLI:

```bash
git tag -a v0.1.0-rc.1 -m "v0.1.0-rc.1"
git push origin v0.1.0-rc.1
gh workflow run release.yml -f tag=v0.1.0-rc.1 -f publish_npm=false
```

Prerelease-теги публикуются в npm dist-tag `next`, стабильные — в `latest`. Публикация в npm по умолчанию выключена. Для включения opt-in job нужно:

1. Один раз опубликовать пакет в npm вручную, если его ещё не существует.
2. Настроить npm trusted publishing для этого GitHub-репозитория, файла `release.yml`, environment `npm` и действия `npm publish`.
3. Создать защищённый GitHub environment `npm` и запустить workflow с `publish_npm=true`.

Publish job использует GitHub OIDC вместо долгоживущего npm token. GitHub Release всегда создаётся до попытки публикации в npm.

## Настройки

```yaml
- id: draft-sessions
  config:
    storagePath: ""
    maxDraftsPerWorkspace: 50
```

Пустой `storagePath` означает стандартный файл внутри `$DSH_HOME`.

## Главные границы дизайна

- Источник истины для неотправленного текста — `DraftStore`.
- Реальная blank Session служит execution shell для model/preset/permissions UI.
- Создание draft никогда не запускает модель.
- Draft превращается в обычную Session только после принятого первого prompt.
- Attachments отложены до v2.
- Draft-строки композируются рядом с single workspace-browser occupant; плагин не отключает и не встраивает `ui-workspace`.
- Backing blank Sessions исключаются только из slot workspace browser, поэтому стандартный composer по-прежнему получает настоящую текущую Session.

Полные критерии находятся в [SPEC.md](SPEC.md), последовательность следующих этапов — в [ROADMAP.md](ROADMAP.md).

## Лицензия

[MIT](LICENSE)
