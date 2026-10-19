import { describe, expect, it } from "vitest";
import { buildBody } from "./body.js";

describe("buildBody", () => {
  it("builds an HTML-only body", () => {
    expect(buildBody({ html: "<p>Hello.</p>" }, "test-boundary")).toEqual({
      headers: [
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: quoted-printable",
      ],
      body: "<p>Hello.</p>",
    });
  });

  it("builds text followed by HTML with correct multipart framing", () => {
    const result = buildBody(
      {
        text: "Hello.\n",
        html: "<p>Hello.</p>",
      },
      "test-boundary",
    );

    const boundary = result.headers[0]!.match(/boundary="([^"]+)"/)?.[1];

    if (boundary === undefined) {
      throw new Error("Missing multipart boundary.");
    }

    expect(boundary.length).toBeLessThanOrEqual(70);

    expect(result.headers).toEqual([
      `Content-Type: multipart/alternative;\r\n boundary="${boundary}"`,
    ]);

    expect(result.body).toBe(
      [
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: quoted-printable",
        "",
        "Hello.",
        "",
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: quoted-printable",
        "",
        "<p>Hello.</p>",
        `--${boundary}--`,
        "",
      ].join("\r\n"),
    );
  });

  it.each([{}, { text: null, html: null }])(
    "rejects missing bodies: %j",
    (message) => {
      expect(() => buildBody(message, "test-boundary")).toThrow(
        "At least one of text or html is required.",
      );
    },
  );

  it("treats empty text as a supplied alternative", () => {
    const result = buildBody(
      {
        text: "",
        html: "<p>Hello.</p>",
      },
      "test-boundary",
    );

    expect(result.headers[0]).toContain("multipart/alternative");
    expect(result.body).toContain("Content-Type: text/plain;");
  });

  it("uses the supplied seed deterministically", () => {
    const message = {
      text: "Hello.",
      html: "<p>Hello.</p>",
    };

    const first = buildBody(message, "seed-one");

    expect(buildBody(message, "seed-one")).toEqual(first);
    expect(buildBody(message, "seed-two")).not.toEqual(first);
  });

  it("rejects an empty seed for multipart messages", () => {
    expect(() =>
      buildBody(
        {
          text: "Hello.",
          html: "<p>Hello.</p>",
        },
        "",
      ),
    ).toThrow("Multipart messages require a boundary seed.");
  });
});
