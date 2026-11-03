import assert from "node:assert/strict";
import test from "node:test";
import {
  isUnknownCompany,
  normalizeCompanyName,
  unknownCompany
} from "../scripts/lib/company-names.mjs";

test("missing company names normalize to one label with legacy aliases", () => {
  assert.equal(unknownCompany.name, "公司未注明");
  for (const value of ["", undefined, " 未披露 ", ...unknownCompany.aliases]) {
    assert.equal(isUnknownCompany(value), true);
    assert.equal(normalizeCompanyName(value), "公司未注明");
  }
});

test("unknown-name substrings do not rename real or source-specific organizations", () => {
  for (const name of [
    "未知科技",
    "其他科技",
    "未披露科技",
    "yd某分公司",
    "盛大旗下未具名子公司",
    "腾讯"
  ]) {
    assert.equal(isUnknownCompany(name), false);
    assert.equal(normalizeCompanyName(name), name);
  }
  assert.equal(normalizeCompanyName(" 腾讯 "), "腾讯");
});
