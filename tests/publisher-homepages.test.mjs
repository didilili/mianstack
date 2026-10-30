import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createContentSchemaValidators,
  loadContentSchema,
  schemaErrors
} from "../scripts/lib/schema.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const validators = createContentSchemaValidators(loadContentSchema(root));
const publisher = {
  id: "PUB-DEMO",
  name: "Demo",
  type: "individual",
  updatedAt: "2026-10-20"
};
const errors = (fields) =>
  schemaErrors(validators.publisher, { ...publisher, ...fields }, "publisher");

test("publisher homepages are optional and GitHub profiles have their own field", () => {
  assert.deepEqual(errors({}), []);
  assert.deepEqual(errors({ githubHomepage: "https://github.com/Snailclimb/" }), []);
  assert.deepEqual(
    errors({ homepage: "https://example.com/", githubHomepage: "https://github.com/demo/" }),
    []
  );
});

test("GitHub homepages require a canonical HTTPS owner URL without a repository or URL extras", () => {
  for (const githubHomepage of [
    "http://github.com/demo/",
    "https://github.com/demo",
    "https://github.com/demo/project/",
    "https://github.com/demo/?tab=repositories",
    "https://github.com/demo/#readme",
    "https://www.github.com/demo/",
    "https://github.com:443/demo/",
    "https://user@github.com/demo/",
    "https://example.com/demo/",
    "https://github.com/"
  ]) {
    assert.ok(errors({ githubHomepage }).length > 0, githubHomepage);
  }
});

test("generic homepages cannot store GitHub profile or repository URLs", () => {
  for (const homepage of [
    "https://github.com/demo/",
    "https://github.com/demo/project",
    "http://github.com/demo",
    "https://GITHUB.COM/demo/",
    "https://www.github.com/demo/",
    "https://user@github.com/demo/",
    "https://github.com:443/demo/"
  ]) {
    assert.ok(errors({ homepage }).length > 0, homepage);
  }
  assert.deepEqual(errors({ homepage: "https://www.xiaohongshu.com/user/profile/demo" }), []);
  assert.deepEqual(errors({ homepage: "https://github.com.example.com/demo/" }), []);
});

test("known authors use one normalized GitHub field and retain the specified other homepages", () => {
  const publishers = JSON.parse(fs.readFileSync(path.join(root, "publishers.json"), "utf8"));
  const byId = new Map(publishers.map((entry) => [entry.id, entry]));
  const owners = {
    "PUB-XL": "xiaolincoder",
    "PUB-DIDILILI": "didilili",
    "PUB-JAVAGUIDE": "Snailclimb",
    "PUB-AGENTGUIDE": "adongwanai",
    "PUB-DATAWHALE": "datawhalechina",
    "PUB-ONEFLY": "ranxi2001",
    "PUB-AMIT-SHEKHAR": "amitshekhariitbhu",
    "PUB-BBRUCEYUAN": "bbruceyuan",
    "PUB-WDNDEV": "wdndev",
    "PUB-WETHINKIN": "WeThinkIn",
    "PUB-AIMLINTERVIEWS": "alirezadir"
  };
  for (const [id, owner] of Object.entries(owners)) {
    const entry = byId.get(id);
    assert.equal(entry.githubHomepage, `https://github.com/${owner}/`, id);
    if (id !== "PUB-XL") assert.equal(Object.hasOwn(entry, "homepage"), false, id);
  }
  assert.equal(byId.get("PUB-XL").homepage, "https://www.xiaolincoding.com/");
  for (const [id, profile] of [
    ["PUB-WB", "64b2a9800000000025035d64"],
    ["PUB-MYL", "69d7ce3e000000003402eb7b"]
  ]) {
    const entry = byId.get(id);
    assert.equal(entry.homepage, `https://www.xiaohongshu.com/user/profile/${profile}`);
    assert.equal(Object.hasOwn(entry, "githubHomepage"), false, id);
  }
  for (const entry of publishers)
    assert.deepEqual(schemaErrors(validators.publisher, entry, entry.id), []);
});
