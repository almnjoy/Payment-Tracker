import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const env = process.env.PLAID_ENV || "sandbox";
const clientId = process.env.PLAID_CLIENT_ID;
const secret = process.env.PLAID_SECRET;

if (!clientId || !secret) {
  console.error("Missing PLAID_CLIENT_ID or PLAID_SECRET in Replit Secrets");
  process.exit(1);
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[env],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": clientId,
      "PLAID-SECRET": secret,
    },
  },
});

const plaid = new PlaidApi(configuration);

const main = async () => {
  const resp = await plaid.linkTokenCreate({
    user: { client_user_id: "admin-smoke-test" },
    client_name: "Quick IT Projects",
    products: ["transactions"],
    country_codes: ["US"],
    language: "en",
  });

  console.log("OK link_token created:");
  console.log(resp.data.link_token);
};

main().catch((e) => {
  console.error("Plaid error:", e?.response?.data || e);
  process.exit(1);
});
