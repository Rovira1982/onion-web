import {
  Shirt,
  Backpack,
  PenLine,
  KeyRound,
  ShoppingBag,
  Baby,
  Home,
  Gift,
  Wallet,
  HeartPulse,
  Cpu,
  Wrench,
  GlassWater,
  Trophy,
  Sun,
  Snowflake,
  PartyPopper,
  Watch,
  Footprints,
  Umbrella,
  ChefHat,
  CircleDot,
  Sparkles,
  Package,
  type LucideIcon,
} from "lucide-react";

// Icono genérico por categoría, elegido por palabras clave del nombre —
// tenemos 194 categorías (una por cada tal como las llama cada proveedor,
// con duplicados/idiomas mezclados), así que un icono "perfecto" por
// categoría exacta no es viable hoy; esto da una pista visual razonable
// para las que más se repiten en el pie de página (petición del dueño,
// 2026-09-30). Package es el icono por defecto si nada encaja.
const RULES: [RegExp, LucideIcon][] = [
  [/camiset|polo|sudader|chaquet|chalec|softshell|jersey|cazador|parka|camis|pantalon|falda|vestido|abrigo|rebeca|conjunto|uniforme|pijama|bermuda/i, Shirt],
  [/mochila|motxill|maletin|trolley|equipaj/i, Backpack],
  [/escritura|bolígraf|lápi[cz]/i, PenLine],
  [/llavero/i, KeyRound],
  [/bolsa|bosses/i, ShoppingBag],
  [/infantil|bebé|bebe|niñ|peluche|juego/i, Baby],
  [/hogar|línea de hogar|textil hogar|manta|toalla|vajilla|tasses/i, Home],
  [/navidad|christmas|regalo/i, Gift],
  [/monedero|tarjetero|cartera|neceser/i, Wallet],
  [/salud|farmacia|belleza|sanitari/i, HeartPulse],
  [/electrónica|electronica|usb|altavoz|cargador|bateria|auricular/i, Cpu],
  [/herramient|vehículo|vehiculo|brico/i, Wrench],
  [/vino|cocteler|drinkware|termo|botella|bidon|taza|vaso/i, GlassWater],
  [/trofeo|conmemoraci/i, Trophy],
  [/verano|playa|bañador|paddle/i, Sun],
  [/invierno|frio|frío|lluvia|impermeable|chubasquero/i, Snowflake],
  [/evento|fiesta/i, PartyPopper],
  [/reloj|meteorológic/i, Watch],
  [/calzado|zapato/i, Footprints],
  [/paragua|parasol/i, Umbrella],
  [/delantal|hosteler|cocina|industria alimentaria/i, ChefHat],
  [/gorra|sombrero|gorro/i, CircleDot],
  [/outlet|sublimaci|premium/i, Sparkles],
];

export function categoryIcon(name: string): LucideIcon {
  for (const [pattern, Icon] of RULES) {
    if (pattern.test(name)) return Icon;
  }
  return Package;
}
