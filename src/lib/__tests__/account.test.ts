import { describe, expect, it } from "vitest";
import { isValidAccountName, loginEmail } from "../account";

describe("家人帳號", () => {
  it("沒有 @ 的帳號補上家庭網域，大小寫不分", () => {
    expect(loginEmail(" DaBao ")).toBe("dabao@myhome.family");
    expect(loginEmail("me@gmail.com")).toBe("me@gmail.com");
  });
  it("帳號名稱只收英數、- 和 _", () => {
    expect(isValidAccountName("dabao")).toBe(true);
    expect(isValidAccountName("孩子 A")).toBe(false);
    expect(isValidAccountName("ab")).toBe(false);
  });
});
