import { Entity, TableEntity } from "../types";
import { Completion } from "@codemirror/autocomplete";
import getAliases from "./getAliases";
import type { SQLDialect, SQLNamespace } from "@codemirror/lang-sql";
import { nameCompletion } from "./extensions/vendor/@codemirror/lang-sql/src/complete";

export { getAliases };

/**
 * Convert column names to auto completion options
 */
export function columnsToCompletions(columns: string[], dialect?: SQLDialect, autoQuoteIdentifiers = true): Completion[] {
  const idQuote = dialect?.spec.identifierQuotes?.[0] || '"'
  const caseInsensitiveIdentifiers = !!dialect?.spec.caseInsensitiveIdentifiers;
  return columns.map((column) => {
    const completion = autoQuoteIdentifiers
      ? { label: column, type: "column", apply: idQuote + column + idQuote }
      : nameCompletion(column, "column", idQuote, caseInsensitiveIdentifiers);
    return { ...completion, boost: 10 };
  });
}

/**
 * Create tables object for SQL language configuration
 * Format is {"schema.table": [columns], "table": [columns]}
 */
export function buildSchema(
  entities: Entity[],
  defaultSchema?: string,
  dialect?: SQLDialect,
  autoQuoteIdentifiers = true
): SQLNamespace {
  const tables: SQLNamespace = {};
  const idQuote = dialect?.spec.identifierQuotes?.[0] || '"'
  const caseInsensitiveIdentifiers = !!dialect?.spec.caseInsensitiveIdentifiers;

  const makeCompletion = (name: string, type: string): Completion =>
    autoQuoteIdentifiers
      ? { label: name, type, apply: idQuote + name + idQuote }
      : nameCompletion(name, type, idQuote, caseInsensitiveIdentifiers);

  entities.forEach((entity) => {
    // Only include table-like entities
    if (!isTableLikeEntity(entity)) return;

    // Skip names with dots to avoid conflicts with schema pattern
    if (/\./.test(entity.name)) return;

    const columns = entity.columns?.map((c) => c.field) || [];
    // Is it a table? a view? or none?
    const type = entity.entityType || "type";

    // Add unqualified name for default schema or no schema
    if (!entity.schema || (defaultSchema && entity.schema === defaultSchema)) {
      tables[entity.name] = {
        self: makeCompletion(entity.name, type),
        children: columns,
      };
    }

    // Add fully qualified name if it has a schema
    if (entity.schema) {
      tables[`${entity.schema}.${entity.name}`] = {
        self: makeCompletion(entity.name, type),
        children: columns,
      };
    }
  });

  return tables;
}

export function isTableLikeEntity(entity: Entity): entity is TableEntity {
  if (!entity.entityType) return true;
  return ["table", "view", "materialized-view"].includes(entity.entityType);
}
