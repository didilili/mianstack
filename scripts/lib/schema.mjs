import fs from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

const validatorNames = ["question", "interview", "category", "alias", "publisher", "collection"];

function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isPublishedAt(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?$/.test(value))
    return false;
  const [date, time = "00:00:00"] = value.split(" ");
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const parsed = new Date(`${date}T${normalizedTime}Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date &&
    parsed.toISOString().slice(11, 19) === normalizedTime
  );
}

function isHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function loadContentSchema(root) {
  const relativePath = "schema/content.schema.json";
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch (error) {
    throw new Error(`${relativePath}: ${error.message}`, { cause: error });
  }
}

function validateSchemaMetadata(schema) {
  for (const [definitionName, definition] of Object.entries(schema?.$defs || {})) {
    if (!Array.isArray(definition?.enum)) continue;
    const allowed = new Set(definition.enum);
    const namedLists = {
      ...(definition["x-groups"] || {}),
      ...(definition["x-countedValues"] ? { "x-countedValues": definition["x-countedValues"] } : {})
    };
    for (const [listName, values] of Object.entries(namedLists)) {
      if (!Array.isArray(values) || values.some((value) => !allowed.has(value)))
        throw new Error(
          `schema definition ${definitionName} has invalid metadata list ${listName}`
        );
    }
    for (const value of Object.keys(definition["x-enumLabels"] || {}))
      if (!allowed.has(value))
        throw new Error(`schema definition ${definitionName} labels unknown enum value ${value}`);
  }
}

export function createContentSchemaValidators(schema, names = validatorNames) {
  validateSchemaMetadata(schema);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false
  });
  ajv.addFormat("date", { type: "string", validate: isDate });
  ajv.addFormat("mianstack-published-at", {
    type: "string",
    validate: isPublishedAt
  });
  ajv.addFormat("mianstack-http-url", {
    type: "string",
    validate: isHttpUrl
  });
  ajv.addKeyword({ keyword: "x-enumLabels", schemaType: "object" });
  ajv.addKeyword({ keyword: "x-countedValues", schemaType: "array" });
  ajv.addKeyword({ keyword: "x-groups", schemaType: "object" });
  ajv.addSchema(schema);
  return Object.fromEntries(
    names.map((name) => [name, ajv.getSchema(`${schema.$id}#/$defs/${name}`)])
  );
}

function fieldFromInstancePath(instancePath) {
  const segments = instancePath.split("/").filter(Boolean);
  if (segments.length === 0) return "record";
  return segments.reduce((result, segment) => {
    const decoded = segment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (/^\d+$/.test(decoded)) return `${result}[${decoded}]`;
    return result ? `${result}.${decoded}` : decoded;
  }, "");
}

function errorMessage(error) {
  const field = fieldFromInstancePath(error.instancePath);
  if (error.keyword === "enum")
    return `${field} must be one of ${error.params.allowedValues.join(", ")}`;
  if (error.keyword === "required") {
    const prefix = field === "record" ? "" : `${field}.`;
    return `${prefix}${error.params.missingProperty} is required`;
  }
  if (error.keyword === "additionalProperties")
    return `${field === "record" ? "" : `${field}.`}${error.params.additionalProperty} is not allowed`;
  if (error.keyword === "type") return `${field} must be ${error.params.type}`;
  if (error.keyword === "format") return `${field} has invalid ${error.params.format}`;
  if (error.keyword === "pattern")
    return error.params.pattern === "\\S"
      ? `${field} must not be blank`
      : `${field} has invalid format`;
  if (error.keyword === "uniqueItems") return `${field} must not contain duplicates`;
  if (error.keyword === "minItems")
    return `${field} must contain at least ${error.params.limit} item(s)`;
  if (error.keyword === "minLength") return `${field} must not be empty`;
  if (error.keyword === "minimum") return `${field} must be at least ${error.params.limit}`;
  if (error.keyword === "not") return `${field} contains incompatible fields`;
  return `${field} ${error.message}`;
}

export function schemaErrors(validator, value, label) {
  if (validator(value)) return [];
  const errors = validator.errors || [];
  const pathsWithSpecificErrors = new Set(
    errors
      .filter((error) => !["anyOf", "oneOf", "const", "if"].includes(error.keyword))
      .map((error) => error.instancePath)
  );
  const messages = errors
    .filter(
      (error) =>
        !["if"].includes(error.keyword) &&
        !(
          ["anyOf", "oneOf", "const"].includes(error.keyword) &&
          pathsWithSpecificErrors.has(error.instancePath)
        )
    )
    .map((error) => `${label}: ${errorMessage(error)}`);
  return [...new Set(messages)];
}

export function schemaEnum(schema, definitionName) {
  const definition = schema?.$defs?.[definitionName];
  if (!definition || !Array.isArray(definition.enum))
    throw new Error(`schema definition ${definitionName} is not an enum`);
  return [...definition.enum];
}

export function schemaEnumLabels(schema, definitionName) {
  const definition = schema?.$defs?.[definitionName];
  if (!definition || !definition["x-enumLabels"])
    throw new Error(`schema definition ${definitionName} has no enum labels`);
  return { ...definition["x-enumLabels"] };
}

export function schemaCountedValues(schema, definitionName) {
  const definition = schema?.$defs?.[definitionName];
  if (!definition || !Array.isArray(definition["x-countedValues"]))
    throw new Error(`schema definition ${definitionName} has no counted values`);
  return [...definition["x-countedValues"]];
}

export function schemaGroup(schema, definitionName, groupName) {
  const definition = schema?.$defs?.[definitionName];
  const values = definition?.["x-groups"]?.[groupName];
  if (!Array.isArray(values))
    throw new Error(`schema definition ${definitionName} has no group ${groupName}`);
  return [...values];
}
