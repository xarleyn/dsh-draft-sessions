# dsh-draft-sessions

Постоянные неотправленные будущие диалоги для [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Цель плагина — дать привычный по Cursor UX: можно подготовить несколько независимых задач, уйти из них без отправки и позже продолжить каждую с сохранённым текстом.

> [!IMPORTANT]
> Сейчас это ранняя alpha-версия. Уже реализованы Host-хранилище, типизированный RPC и создание/восстановление blank Session, но sidebar и composer ещё не подключены. Поэтому установленный пакет пока не добавляет видимые draft-строки.

[English](README.md) · [Спецификация](SPEC.md) · [Архитектура](docs/architecture.md) · [План](ROADMAP.md)

## Что уже реализовано

- Host-backed JSON-хранилище в `$DSH_HOME/storages/dsh-draft-sessions/drafts.json`.
- Строгие Remote-методы `draftSessions.list/create/update/delete/rebind`.
- Независимый порядок в workspace и настраиваемый лимит.
- Optimistic revision: устаревшая запись из второго браузера не затирает свежую.
- Атомарная запись файла и строгая проверка данных при загрузке.
- Создание отдельной blank Session с сохранением id только после успеха.
- Обнаружение исчезнувшей Session и recovery через замену без потери текста.
- Unit-тесты persistence, concurrency, limits, deletion и recovery.

Текущий код не отправляет prompt, не изменяет историю обычных Sessions и не удаляет blank Sessions.

## Требования

- Node.js `^22.19.0` или `>=24.0.0`
- pnpm 11
- DeepSeek Harness `next`: `>=0.1.1-rc.2 <0.2.0`

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
- Для точного UX внутри списка Sessions понадобится тонкий version-tracked replacement `ui-workspace`, потому что публичного row slot пока нет.

Полные критерии находятся в [SPEC.md](SPEC.md), последовательность следующих этапов — в [ROADMAP.md](ROADMAP.md).

## Лицензия

[MIT](LICENSE)
