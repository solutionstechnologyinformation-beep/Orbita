import { describe, expect, it } from "vitest";
import { parseKmlRichFeatures } from "./kml-parser";

describe("kml rich parser", () => {
  it("extrai placemarks com descrição, atributos e geometrias lineares e puntuais", () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>INÍCIO — GO-319</name>
      <description>SRE: 319EGO0185</description>
      <Point>
        <coordinates>-49.72, -17.13, 0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Trecho Principal</name>
      <description>KM 0 a 10</description>
      <LineString>
        <coordinates>-49.72,-17.13 -49.73,-17.14 -49.74,-17.15</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

    const result = parseKmlRichFeatures(kml);
    expect(result.summary.lines).toBe(1);
    expect(result.summary.points).toBe(1);
    expect(result.summary.withDescription).toBe(2);
    expect(result.features).toHaveLength(2);
    expect(result.bounds).not.toBeNull();
  });
});
