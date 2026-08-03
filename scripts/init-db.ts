// One-time setup script. Run with: npm run db:init
//
// What this does and doesn't do:
// - Creates every index declared in the model schemas (unique slugs, status
//   filters, etc.) via syncIndexes(). This also DROPS any index that exists
//   in MongoDB but is no longer declared in the schema — safe on a fresh
//   database, worth knowing if you ever run this again after removing a
//   field's index.
// - Seeds exactly one thing: the SiteSettings singleton, since the app
//   assumes it always exists (header/footer render from it). No other data
//   is created — no demo products, no sample categories. This is
//   infrastructure setup, not business data; seeding fake business data
//   would be presumptuous about what your actual catalog should look like.
// - Does NOT touch Supabase, does NOT delete anything, does NOT run
//   automatically as part of the app — it's a deliberate, manual step.
//
// Safe to re-run. syncIndexes() is idempotent; getOrCreateSiteSettings()
// only creates the settings doc if it doesn't already exist.
import "dotenv/config";
import { connectMongo } from "../src/integrations/mongodb/client.server";
import { User } from "../src/integrations/mongodb/models/user.server";
import { Product } from "../src/integrations/mongodb/models/product.server";
import { Category } from "../src/integrations/mongodb/models/category.server";
import { Cart } from "../src/integrations/mongodb/models/cart.server";
import { Address } from "../src/integrations/mongodb/models/address.server";
import { Order } from "../src/integrations/mongodb/models/order.server";
import { Discount } from "../src/integrations/mongodb/models/discount.server";
import { TaxRate } from "../src/integrations/mongodb/models/tax-rate.server";
import { FeeCategory } from "../src/integrations/mongodb/models/fee-category.server";
import { ShippingZone } from "../src/integrations/mongodb/models/shipping-zone.server";
import { Page } from "../src/integrations/mongodb/models/page.server";
import { getOrCreateSiteSettings } from "../src/integrations/mongodb/models/site-settings.server";

const MODELS = [
  User,
  Product,
  Category,
  Cart,
  Address,
  Order,
  Discount,
  TaxRate,
  FeeCategory,
  ShippingZone,
  Page,
];

async function main() {
  console.log("Connecting to MongoDB...");
  await connectMongo();
  console.log("Connected.\n");

  console.log("Creating/syncing indexes for each collection:");
  for (const model of MODELS) {
    const result = await model.syncIndexes();
    console.log(`  ${model.collection.name.padEnd(20)} -> ${result.length ? result.join(", ") : "(no changes)"}`);
  }

  console.log("\nSeeding SiteSettings singleton...");
  const settings = await getOrCreateSiteSettings();
  console.log(`  SiteSettings ready (brandName: "${settings.brandName}")`);

  console.log("\nDone. Collections now exist for every model that had at least one operation run against it above.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nInit script failed:");
  console.error(err);
  process.exit(1);
});
