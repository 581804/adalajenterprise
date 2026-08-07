import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import * as isoCountries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

isoCountries.registerLocale(enLocale);

export type CountryCodeEntry = {
  iso2: string;
  name: string;
  calling_code: string;
};

// Computed once, synchronously, at module load — no network round-trip, no
// dependency on whether `npm run db:seed-country-codes` has ever been run.
// This is exactly the same source data that script uses to populate the
// CountryCode collection, so both stay consistent; this list just doesn't
// need the database in the loop for the checkout field to work correctly.
export const COUNTRY_CODES: CountryCodeEntry[] = getCountries()
  .map((iso2) => ({ iso2, name: isoCountries.getName(iso2, "en") ?? "", calling_code: getCountryCallingCode(iso2) }))
  .filter((c) => c.name)
  .sort((a, b) => a.name.localeCompare(b.name));
