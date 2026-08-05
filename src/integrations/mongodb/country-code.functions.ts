import { createServerFn } from "@tanstack/react-start";

/** Public: full country-code list for the phone number country selector. */
export const listCountryCodes = createServerFn({ method: "GET" }).handler(async () => {
  const { connectMongo } = await import("./client.server");
  const { CountryCode } = await import("./models/country-code.server");
  await connectMongo();
  const codes = await CountryCode.find().sort({ name: 1 }).lean();
  return codes.map((c) => ({ iso2: c.iso2, name: c.name, calling_code: c.callingCode }));
});
