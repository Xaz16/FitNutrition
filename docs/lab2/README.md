# ЛР 2. Архитектура и интерактивный прототип в коде

Пункты задания и где они выполнены:

| № | Пункт задания | Где |
|---|---|---|
| 1 | Структурная схема системы | [architecture.md, раздел 1](architecture.md#1-структурная-схема) |
| 2 | Технологический стек | [architecture.md, раздел 2](architecture.md#2-технологический-стек) |
| 3 | Use case и три диаграммы активности | [architecture.md, раздел 3](architecture.md#3-диаграммы-uml) |
| 4 | ER-диаграмма | [architecture.md, раздел 4](architecture.md#4-модель-данных) |
| 5 | Программные интерфейсы | [api-contracts.md](api-contracts.md) |
| 6 | Wireframe-ы экранных форм | [wireframes.md](wireframes.md) |
| 7 | Интерактивный прототип | [`app/`](../../app), запуск — в [README](../../README.md), экраны — в [screenshots](screenshots/) |
| 8 | Пять ADR | [adr/](adr/) |
| — | Отчёт о работе с агентом | [agent-report.md](agent-report.md) |

Исходники диаграмм — `diagrams/*.puml`. Перерисовать их можно так:

```bash
cd docs/lab2/diagrams
docker run --rm -u $(id -u):$(id -g) -v "$PWD":/data -w /data plantuml/plantuml -tpng -charset UTF-8 *.puml wireframes/*.puml
```
