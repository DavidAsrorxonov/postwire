import { describe, expect, it } from "vitest";
import { buildTextPart } from "./text-part.js";

describe("buildTextPart", () => {
  it("builds a plain-text part", () => {
    expect(buildTextPart("Hello.", "plain")).toEqual({
      headers: [
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: quoted-printable",
      ],
      body: "Hello.",
    });
  });

  it("builds an HTML part with encoded attributes and Unicode", () => {
    const content = '<p class="intro">caf\u00E9</p>';

    expect(buildTextPart(content, "html")).toEqual({
      headers: [
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: quoted-printable",
      ],
      body: '<p class=3D"intro">caf=C3=A9</p>',
    });
  });

  it("preserves an existing final newline", () => {
    expect(buildTextPart("Hello.\n", "plain").body).toBe("Hello.\r\n");
  });

  it("does not add a newline to the part body", () => {
    expect(buildTextPart("Hello.", "plain").body).toBe("Hello.");
  });

  it("supports an empty part body", () => {
    expect(buildTextPart("", "plain").body).toBe("");
  });
});
