# Model

## Language

A language of the interface.

- [languages] `fr` or `en`.

## Visitor

A browser using the app.

- `language: optional /model/language`, the language the visitor
  chose; absent until they choose one.

Display language: the visitor's `language`, or `fr` when absent.

## Application

The state: everything the software stores.

- `visitors: set of /model/visitor`, each kept in its own browser.
