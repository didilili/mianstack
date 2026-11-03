import schema from "../../schema/content.schema.json" with { type: "json" };

const definition = schema.$defs.companyName["x-unknown"];

/** 缺失公司名的统一称谓与兼容别名；不代表一家真实公司。 */
export const unknownCompany = Object.freeze({
  name: definition.name,
  aliases: Object.freeze([...definition.aliases])
});

const unknownNames = new Set([unknownCompany.name, ...unknownCompany.aliases]);

export function isUnknownCompany(name = "") {
  const value = typeof name === "string" ? name.trim() : "";
  return !value || unknownNames.has(value);
}

export function normalizeCompanyName(name = "") {
  return isUnknownCompany(name) ? unknownCompany.name : name.trim();
}
