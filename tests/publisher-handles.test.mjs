import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent } from "../scripts/lib/content.mjs";
import {
  createContentSchemaValidators,
  loadContentSchema,
  schemaErrors
} from "../scripts/lib/schema.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const validators = createContentSchemaValidators(loadContentSchema(root));
const publisher = (id, handle) => ({
  id,
  name: id,
  type: "individual",
  updatedAt: "2026-10-20",
  ...(handle === undefined ? {} : { handle })
});

function fixture(t, publishers) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mianstack-publisher-handles-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const child of ["schema", "questions", "interviews", "collections"])
    fs.mkdirSync(path.join(directory, child));
  fs.copyFileSync(
    path.join(root, "schema/content.schema.json"),
    path.join(directory, "schema/content.schema.json")
  );
  for (const filename of ["categories", "aliases", "publishers"])
    fs.writeFileSync(
      path.join(directory, `${filename}.json`),
      JSON.stringify(filename === "publishers" ? publishers : [])
    );
  return directory;
}

test("publisher handles are optional and preserve ASCII case in a single path segment", () => {
  for (const handle of [undefined, "Adong", "xiaolincoder", "user-Name_2"])
    assert.deepEqual(
      schemaErrors(validators.publisher, publisher("PUB-ONE", handle), "publisher"),
      []
    );
});

test("publisher handles reject empty, non-ASCII and path or URL syntax", () => {
  for (const handle of [
    "",
    " ",
    "阿东",
    ".",
    "..",
    "../one",
    "one/two",
    "one%2Ftwo",
    "one?x",
    "one#x"
  ])
    assert.ok(
      schemaErrors(validators.publisher, publisher("PUB-ONE", handle), "publisher").length > 0,
      handle
    );
});

test("publisher handles cannot collide across authors even when their case differs", (t) => {
  for (const duplicate of ["Adong", "adong"])
    assert.throws(
      () =>
        loadContent(fixture(t, [publisher("PUB-ONE", "Adong"), publisher("PUB-TWO", duplicate)])),
      /duplicate publisher handle/i
    );
});

test("publisher handles cannot occupy another author's stable ID route", (t) => {
  assert.throws(
    () => loadContent(fixture(t, [publisher("PUB-ONE", "pub-two"), publisher("PUB-TWO", "Other")])),
    /publisher handle .*conflicts with publisher id/i
  );
  const content = loadContent(fixture(t, [publisher("PUB-ONE", "PUB-ONE"), publisher("PUB-TWO")]));
  assert.equal(content.publishers[0].handle, "PUB-ONE");
});

test("the twelve named authors have the requested display names and route handles", () => {
  const publishers = JSON.parse(fs.readFileSync(path.join(root, "publishers.json"), "utf8"));
  const expected = {
    "PUB-XL": ["小林 Coding", "xiaolincoder"],
    "PUB-WB": ["小熊饼干_", "daydayjuanjuan"],
    "PUB-JAVAGUIDE": ["Guide", "Snailclimb"],
    "PUB-AGENTGUIDE": ["阿东玩 AI", "Adong"],
    "PUB-DATAWHALE": ["Datawhale", "datawhalechina"],
    "PUB-AMIT-SHEKHAR": ["AMIT SHEKHAR", "amitshekhariitbhu"],
    "PUB-BBRUCEYUAN": ["Chaofa Yuan", "bbruceyuan"],
    "PUB-WDNDEV": ["Firefly", "wdndev"],
    "PUB-WETHINKIN": ["Rocky Ding", "WeThinkIn"],
    "PUB-AIMLINTERVIEWS": ["Alireza Dirafzoon", "alirezadir"],
    "PUB-ONEFLY": ["Onefly", "ranxi2001"],
    "PUB-DIDILILI": ["didilili", "didilili"]
  };
  for (const [id, [name, handle]] of Object.entries(expected)) {
    const entry = publishers.find((record) => record.id === id);
    assert.equal(entry.name, name, id);
    assert.equal(entry.handle, handle, id);
    assert.deepEqual(schemaErrors(validators.publisher, entry, id), []);
  }
  assert.equal(
    Object.hasOwn(
      publishers.find((entry) => entry.id === "PUB-AGENTGUIDE"),
      "nickname"
    ),
    false
  );
  const omitted = publishers.find((entry) => entry.id === "PUB-MYL");
  assert.equal(omitted.name, "摸鱼酱mio");
  assert.equal(Object.hasOwn(omitted, "handle"), false);
});
