// One-time correction script. Run with: npm run db:fix-currency
//
// Code fixes (the model defaults, createOrder's explicit currency, etc.)
// only affect documents created AFTER the fix — anything already written to
// the database with currency: "USD" stays that way until something
// actually updates it. This script does that update, once.
//
// What it does:
// - Reads (or creates, with INR default) the site_settings singleton to
//   determine the store's actual intended currency.
// - Updates every Product still showing "USD" to that currency.
// - Updates every Order still showing "USD" to that currency.
// - Prints exactly how many documents were changed in each collection —
//   0 changed is a valid, expected outcome if nothing was ever wrong.
//
// Safe to re-run — it only touches documents that still say "USD"; once
// fixed, running it again finds nothing left to change.
import "dotenv/config";
import { connectMongo } from "../src/integrations/mongodb/client.server";
import { Product } from "../src/integrations/mongodb/models/product.server";
import { Order } from "../src/integrations/mongodb/models/order.server";
import { getOrCreateSiteSettings } from "../src/integrations/mongodb/models/site-settings.server";

async function main() {
  console.log("Connecting to MongoDB...");
  await connectMongo();
  console.log("Connected.\n");

  const settings = await getOrCreateSiteSettings();
  const targetCurrency = settings.currency || "INR";
  console.log(`Store's configured currency: ${targetCurrency}\n`);

  const productResult = await Product.updateMany({ currency: "USD" }, { $set: { currency: targetCurrency } });
  console.log(`Products corrected: ${productResult.modifiedCount}`);

  const orderResult = await Order.updateMany({ currency: "USD" }, { $set: { currency: targetCurrency } });
  console.log(`Orders corrected: ${orderResult.modifiedCount}`);

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nCurrency fix script failed:");
  console.error(err);
  process.exit(1);
});
