// Login contra la API B2B de Makito, compartido por el importador, el backfill
// de fotos, la etiqueta de Navidad y el export financiero. La URL se lee al
// llamar (no al importar) para que dotenv ya haya cargado .env.local.
export async function loginMakito(env: "test" | "prod" = "test"): Promise<string> {
  const base = process.env.MAKITO_BASE_URL ?? "https://apis.makito.es";
  const clientId = env === "test" ? process.env.MAKITO_TEST_CLIENT_ID : process.env.MAKITO_CLIENT_ID;
  const clientSecret = env === "test" ? process.env.MAKITO_TEST_CLIENT_SECRET : process.env.MAKITO_CLIENT_SECRET;
  const res = await fetch(`${base}/access/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error(`Login falló: ${res.status} ${await res.text()}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}
