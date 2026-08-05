// One-time seed script. Run with: npm run db:seed-country-codes
//
// Sourced from libphonenumber-js (calling codes) + i18n-iso-countries
// (names) — both are maintained, versioned npm packages with real,
// verified data, rather than data hand-copied from a web search result.
// Safe to re-run: upserts by iso2, so re-running after a package upgrade
// just refreshes the data.
import "dotenv/config";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import * as isoCountries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json" with { type: "json" };
import { connectMongo } from "../src/integrations/mongodb/client.server";
import { CountryCode } from "../src/integrations/mongodb/models/country-code.server";

isoCountries.registerLocale(enLocale);

async function main() {
  console.log("Connecting to MongoDB...");
  await connectMongo();
  console.log("Connected.\n");

  const codes = getCountries();
  console.log(`Seeding ${codes.length} country codes...`);

  let upserted = 0;
  let skipped = 0;
  for (const iso2 of codes) {
    const name = isoCountries.getName(iso2, "en");
    if (!name) {
      // A handful of libphonenumber-js entries are non-standard territory
      // codes without an ISO 3166-1 name (e.g. some Caribbean territories)
      // — skip rather than insert a record with a blank/placeholder name.
      skipped++;
      continue;
    }
    await CountryCode.findOneAndUpdate(
      { iso2 },
      { iso2, name, callingCode: getCountryCallingCode(iso2) },
      { upsert: true },
    );
    upserted++;
  }

  console.log(`\nDone. Upserted: ${upserted}, skipped (no ISO name available): ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\nCountry code seed script failed:");
  console.error(err);
  process.exit(1);
});
