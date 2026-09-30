import "server-only";

// Dirección de entrega de Onion a sus proveedores (Gorfactory/TopTex) —
// deliberadamente NO hardcodeada: nadie confirmó todavía la dirección exacta
// a usar aquí (puede diferir de la fiscal). Se configura por variables de
// entorno el día que Josep la dé; hasta entonces confirmarTanda() falla con
// un mensaje claro en vez de adivinar o reusar la dirección fiscal.
export type DeliveryAddress = {
  name: string;
  street: string;
  city: string;
  postalCode: string;
  countryCode: string;
  country: string;
  phone: string;
  email: string;
};

export function getOnionDeliveryAddress(): DeliveryAddress {
  const name = process.env.ONION_DELIVERY_NAME;
  const street = process.env.ONION_DELIVERY_STREET;
  const city = process.env.ONION_DELIVERY_CITY;
  const postalCode = process.env.ONION_DELIVERY_POSTAL_CODE;
  const countryCode = process.env.ONION_DELIVERY_COUNTRY_CODE ?? "ES";
  const country = process.env.ONION_DELIVERY_COUNTRY ?? "España";
  const phone = process.env.ONION_DELIVERY_PHONE;
  const email = process.env.ONION_DELIVERY_EMAIL;

  if (!name || !street || !city || !postalCode || !phone || !email) {
    throw new Error(
      "Dirección de entrega de Onion sin configurar (ONION_DELIVERY_NAME/STREET/CITY/POSTAL_CODE/PHONE/EMAIL) — pídesela a Josep antes de confirmar una tanda con Gorfactory o TopTex.",
    );
  }

  return { name, street, city, postalCode, countryCode, country, phone, email };
}
