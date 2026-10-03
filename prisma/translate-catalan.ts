// Traducción manual catalán -> castellano de los 64 productos Roly/Stamina
// para los que Gorfactory solo tiene texto en catalán (lang=es-ES no ayuda,
// esos modelos concretos no tienen traducción en su sistema). Parche de
// datos, no de código: si se vuelve a importar Gorfactory manualmente y
// Gorfactory sigue sin traducción, habrá que re-ejecutar esto.
import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "./_client";


const TRANSLATIONS: Record<string, { description: string; material: string | null }> = {
  "da0a3c4a-52af-48aa-8a19-80ad4bb0bc6a": {
    description:
      "Tejido de poliéster color blanco, con un ancho de 180 cm. Es un tejido con un ligero brillo y un tacto suave en la parte interior. Es ideal para conjuntos deportivos (chándal). Rendimiento de 4,95 m² / kg. Especial sublimación y admite serigrafía, transfer y otros reprocesos.",
    material: null,
  },
  "7ece4315-6a3e-4e03-b788-728333e41423": {
    description: "Bloc de notas A5 con tapa rígida de polipiel. Marcapáginas y banda elástica. 100 hojas.",
    material: "Tapa de polipiel.",
  },
  "3d4341c3-0edb-4772-9d2e-42178b1c6085": {
    description: "Bloc de notas A5 con tapa rígida de polipiel. Marcapáginas y banda elástica. 100 folios a una raya.",
    material: "Polipiel",
  },
  "b46d56eb-d377-4e39-8cba-f8ac27b05bf7": {
    description: "Bolsa de grandes dimensiones, práctica y cómoda para hacer la compra. Elaborada con non-woven de 80 g/m². Asas reforzadas de 58 cm y acabado cosido.",
    material: "Non-woven",
  },
  "764f7611-edc6-4171-b917-eb6a9dafa566": {
    description: "Máscara de viaje realizada en suave microfibra. Doble elástico de ajuste.",
    material: "Microfibra",
  },
  "739c16a1-ebe7-4c2e-b3a4-1c7f2ecb9dbb": {
    description: "Bloc de notas A6. Tapa rígida de corcho natural. Marcapáginas y banda elástica. 80 hojas.",
    material: "Corcho natural",
  },
  "a1291770-7a92-4bc4-b090-86d334880b92": {
    description:
      "Mochila para portátil de tejido jaspeado. 1. Doble asa reforzada para hombro y asa especial de mano. 2. Dos bolsillos centrales con capacidad para portátil de 15”. 3. Bolsillo frontal con cremallera a contraste. 4. Bolsillos laterales de rejilla.",
    material: "100% poliéster, 400 g/m². Talla única: 28 x 43 x 13 cm. 15 L.",
  },
  "73371c04-21c2-4367-b6cc-57f9bd5d6de7": {
    description:
      "Camiseta de manga corta y corte extra largo, con cuello redondo de dos capas con elastano. Aberturas laterales en la parte inferior. El patronaje de la espalda es ligeramente más largo que el de delante.",
    material: "100% algodón, punto liso, 155 g/m².",
  },
  "93ad8c5e-a4e8-481d-9fc2-879cc0ce00e5": {
    description: "Mochila pequeña con asas ajustables. 1.- Asa superior para colgarla. 2.- Bolsillo frontal con cremallera. 3.- Bolsillos laterales de tejido microperforado.",
    material: "100% poliéster, 600D, 340 g/m². Talla única: 30 x 40 x 18 cm. 12 L.",
  },
  "4b08afaa-7e6e-4028-9c0e-c027602b285f": {
    description: "Bloc de notas A6 con tapa rígida de polipiel. Marcapáginas y banda elástica. 100 hojas.",
    material: "Tapa de polipiel.",
  },
  "3cb9c3b7-7e25-4089-b3d8-3674e5c7950a": {
    description:
      "Toalla multideporte de microfibra. Ligera, compacta y fácil de transportar. Rematada con filamento de poliéster a tres hilos en el mismo tono. Secado rápido. Ornamento elástico para plegar.",
    material: "90% poliéster / 10% poliamida, 190 g/m².",
  },
  "0b3b8ac2-089b-47bd-a688-4f653fc01eae": {
    description: "Bolsa termosellada sin pliegues, fabricada en tejido non woven (no tejido), con un asa larga de cinta del mismo color.",
    material: "100% polipropileno no tejido, 80 g/m².",
  },
  "c0bf8f22-0c94-40a5-b189-7afa1a249417": {
    description: "Cinta técnica de running en tejido doble.",
    material: "100% poliéster, 140 g/m².",
  },
  "0c9715fd-cde5-422e-8919-e9b566a0b66c": {
    description: "Mochila multiuso. 1.- Cordones de ajuste en la espalda. 2.- Ojales metálicos. 3.- Bolsillos frontales de tejido microperforado. 4.- Salida para cables.",
    material: "100% poliéster, 210D, 60 g/m². Talla única: 34 x 43 cm.",
  },
  "276d4de5-e03f-4ecc-ac52-14a31256404b": {
    description: "Pantalón corto estilo casual. Cintura elástica ajustable mediante cordones exteriores. Dos bolsillos laterales.",
    material: "60% algodón / 40% poliéster, felpa no perchada, 280 g/m².",
  },
  "9ed6c704-0158-49b4-b6dc-92c5834476ab": {
    description:
      "Batería externa de 8000 mAh con cuerpo de ABS reciclado y superficie superior en tejido RPET. Salida de corriente USB DC5V/2.1A. Inalámbrica DC5V. Incluye cable Micro USB.",
    material: "ABS reciclado y RPET",
  },
  "bcbbbd4d-3664-40ad-8c26-d0c4a8d03dbc": {
    description:
      "Mochila multifunción. 1. Doble asa acolchada para hombro y asa especial de mano. 2. Apertura central extensible con ajustadores automáticos y cremallera. 3. Bolsillo frontal con cremallera y pliegue. 4. Bolsillos laterales, uno con rejilla ajustable y otro en tejido principal. 5. Bolsillo interior ajustable.",
    material: "100% poliéster, tejido oxford, 900D, 220 g/m². Talla única: 44 x 30 x 13 cm (abierta 60x30x13cm). 24L.",
  },
  "c94b0d4e-0ed2-4df9-85bb-a8a0f5082756": {
    description:
      "Babero ribeteado. Tejido de algodón en la parte delantera y de plástico en la parte trasera para evitar que traspasen los líquidos. Cierre lateral de velcro suave.",
    material: "Tejido parte delantera: 100% poliéster, punto liso, 180 g/m². Tejido parte trasera: 100% poliéster, 75 g/m².",
  },
  "39ee7bcf-3185-4b9b-bfb8-763062c85b06": {
    description:
      "Pantalón de trabajo. 1. Cintura elástica. 2 Bolsillos frontales con cremalleras invertidas. 3. Piezas a contraste en las rodillas con bolsillo con cremallera invertida en el lado derecho. 4. Bolsillo posterior en el lado derecho.",
    material: "100% nailon cuadrillé. Refuerzo rodillas: 93% nailon / 7% elastano. 130 g/m².",
  },
  "cd6ea847-84db-4a28-93da-e553f7daa14c": {
    description: "Bloc de notas A5. Tapa rígida de cartón reciclado. Marcapáginas y banda elástica a color. 100 hojas.",
    material: "Cartón reciclado.",
  },
  "88cdc9fd-f30d-4490-b513-f7aa08db25b5": {
    description:
      "Chaqueta de punto afelpado con capucha. 1.- Cremalleras inyectadas con tiradores de diseño. 2.- Cremallera central con protector de barbilla. 3.- Cuello alto con ajustadores de diseño y tapacosturas interior. 4.- Segunda cremallera decorativa en el cuello para facilitar la apertura. 5.- Dos bolsillos frontales con cremallera. 6. Bajo posterior más largo que el delantero con ajustadores de diseño.",
    material: "100% poliéster, felpa punto perchado, 280 g/m².",
  },
  "594adc3d-8c4a-45c6-9da2-d2209c22f9ff": {
    description:
      "Pieza de tejido fino de forma triangular utilizada como accesorio en la indumentaria, tanto masculina como femenina. Medidas: 100 x 50 cm (ancho x alto), 100 x 70 x 70 cm (perímetro)",
    material: "100% poliéster, 60 g/m².",
  },
  "03703d7e-fc12-47d4-ae3c-b992f58793d2": {
    description:
      "Mascarilla de seguridad FFP2 NR de cinco capas. Acabados termosellados, con elásticos de sujeción, accesorio de sujeción craneal, pinza ajustable en la nariz y almohadilla nasal interior.",
    material: null,
  },
  "d45d1333-0c84-41f0-829a-d86b24667a92": {
    description: "Lanyard de poliéster con mosquetón, hebilla con cierre de seguridad.",
    material: "Poliéster",
  },
  "89f56f61-80d1-46b4-a869-5d4b72dfa639": {
    description:
      "Mascarilla higiénica transpirable e hidrófuga. Antibacteriana y con costura central invisible para más confort. Disponible también para personalización 100% a medida en sublimación a partir de 25 unidades.",
    material: "Exterior: 100% PES-Microfibra. Interior: Tejido no tejido (Non-woven)",
  },
  "964092df-df47-4238-b105-70b8257a3993": {
    description: "Mascarilla Quirúrgica TIPO I de uso médico. Triple capa con acabados termosellados, elásticos de sujeción y clip nasal.",
    material: null,
  },
  "bfd63449-35d4-41fa-8722-c7762bc6f556": {
    description: "Bolsa fabricada en tejido de algodón de color natural, con un asa larga de cinta del mismo color.",
    material: "100% algodón, 140 g/m².",
  },
  "9c57a305-be50-4137-a222-b58fed845cdf": {
    description:
      "Camiseta de tirantes anchos en tejido microperforado. Cuello redondo y sisas ribeteadas en el mismo tejido. Transpirable, tacto ligero y confortable. Personalización recomendada con transfer, vinilo o sublimación.",
    material: "100% poliéster microperforado, 120 g/m².",
  },
  "64e8cc46-4aa7-4537-80c9-71211a2fad61": {
    description:
      "Tejido de poliéster color blanco, con un ancho de 155 cm. Idóneo para ropa técnica y deportiva. Microdibujo por ambas caras. Este tejido es ligero con movimiento y caída. Rendimiento de 6,90 m² / kg. Especial sublimación y admite serigrafía, transfer y otros reprocesos.",
    material: null,
  },
  "0a688f60-6c69-41d7-afd6-5c45b8cf92c0": {
    description: "Bloc de notas A6. Tapa rígida mixta corcho / polipiel. Marcapáginas y banda elástica. 80 hojas.",
    material: "Tapa: corcho / polipiel.",
  },
  "510f17df-768e-4df6-aaab-50e62528ccb8": {
    description:
      "Camiseta de manga corta unisex efecto Tye Dye. Cuello redondo en canalé 1x1 con cubrecosturas en el cuello. Tubular. El acabado y la tonalidad de esta prenda puede variar dentro de un mismo tono.",
    material: "100% algodón peinado, punto liso, 160 g/m².",
  },
  "d47364f7-8626-4dd4-a1d8-9826af2886f3": {
    description:
      "Sudadera con capucha unisex. Bolsillo canguro. Cordones planos con ojales bordados. Puños y cintura de tejido principal. Detalle de costura con relieve en las mangas.",
    material: "60% algodón / 40% poliéster, felpa no perchada, 280 g/m².",
  },
  "a447a6ce-af3e-458d-b556-70610c18612c": {
    description:
      "Chaqueta cortavientos en tejido técnico. 1.- Cuello con bolsillo para guardar la capucha. 2.- Tejido transpirable en la zona de las sisas. 3.- Corte de mangas ranglan. 4.- Doble bolsillo delantero con cremallera. 5.- Apertura y cierre con cremallera frontal. 6.- Bolsillo en la espalda para guardar la chaqueta como una bolsa. 7.- Parte inferior de la chaqueta y puños de las mangas con elástico. 8.- Adorno en forma de asa situado en la parte de la espalda en la zona del cuello para poder colgar la prenda. 9.- Capucha con ajustadores plásticos y cordón elástico. 10.- Tejido transpirable en el interior del cuello. 11.- Tejido transpirable en el bolsillo interior de la espalda.",
    material: "100% poliéster, 50 g/m².",
  },
  "461fa0ea-bf43-4aeb-8a3c-f8c5e246f90b": {
    description: "Bolsa de yute natural con remaches y asas reforzadas de algodón. Acabado cosido.",
    material: "Yute.",
  },
  "5c583e5d-6d73-4f40-acb7-6529cb2fe182": {
    description: "Fiambrera de acero inoxidable 304 con tapa de bambú y banda de seguridad en poliéster. Capacidad 800 ml.",
    material: "Acero inoxidable 304.",
  },
  "588aed6e-e739-4237-9c45-7edcbf22af7e": {
    description:
      "Bolsa termosellada con pliegues en los laterales y en la base, fabricada en tejido non woven (no tejido), con un asa corta de cinta del mismo color.",
    material: "100% polipropileno no tejido, 100 g/m².",
  },
  "4b402003-99aa-4f18-b1e1-1fef4cce2d6e": {
    description: "Práctica funda portatodo impermeable grande de PVC apta para pantallas táctiles. Con doble cierre hermético de seguridad y velcro. Disponible en varios colores.",
    material: "PVC",
  },
  "2777c269-0002-4f6c-b05d-a2b5bae3d2b3": {
    description: "Pelota para mascotas en resistente goma y tejido reforzado. El mejor regalo para tu mejor amigo.",
    material: "Goma",
  },
  "d21bd586-12de-4014-8e28-e7682416ba87": {
    description: "Pantalón largo con puño en los bajos del tejido principal. Cintura elástica ajustable mediante cordones exteriores. Dos bolsillos laterales.",
    material: "60% algodón / 40% poliéster, felpa no perchada, 280 g/m².",
  },
  "52c8814e-25eb-4b51-98a7-c1270543cd36": {
    description: "Sudadera estampado camuflaje, cuello caja en forma redondeada y ribete de canalé. Punto de canalé 1x1 con elastano en la cintura y en los puños.",
    material: "60% algodón, 40% poliéster, felpa no perchada, punto roto, 290 g/m².",
  },
  "968b61de-70d9-4801-8e6f-a170f1488e61": {
    description: "Bidón de PET flexible en forma de camiseta. Tapón de seguridad y mosquetón para transporte. Capacidad 470 ml.",
    material: "PET",
  },
  "dcbd9102-14e2-45c2-85bb-bd3df1f09755": {
    description:
      "Cinturón multiuso. 1.- Tejido elástico. 2.- Cremallera reflectante. 3.- Salida para cables. 4.- Adaptable a cualquier accesorio gracias al plisado interior que incorpora. Talla única.",
    material: "100% poliéster.",
  },
  "a9d4ea34-8ee2-406c-a282-2d6f3950d606": {
    description: "Gorra técnica de tres paneles. Tejido ligero y transpirable. Cierre ajustable de velcro en la parte posterior. Frontal especial para reprocesos.",
    material: "90% poliéster / 10% Elastano, 140 g/m².",
  },
  "a2cdea60-5f16-495d-84f2-331d3398290d": {
    description:
      "Camiseta técnica de tirantes con detalles reflectantes. Cuello redondo con tapacosturas de refuerzo. Combinada en dos tejidos de poliéster y tres colores. Tejido principal interlock, paneles laterales y superiores en tejido microperforado para una mayor transpiración. Fácil secado.",
    material: "Tejido principal 100% poliéster. Paneles: 100% poliéster microperforado, 145 g/m².",
  },
  "35473bde-accc-46d0-9b80-968c7e7820ef": {
    description: "Bolsa fabricada en tejido de algodón de color, con un asa larga de cinta del mismo color.",
    material: "100% algodón, 140 g/m².",
  },
  "6415398d-64ea-4263-8a66-3e4f1eb51969": {
    description: "Cuello polar con ajustador elástico.",
    material: "100% poliéster, polar 210 g/m².",
  },
  "6f3d8c2e-bab9-4b91-b4df-7bffccb313fa": {
    description: "Bolsa termosellada con pliegue en la base, fabricada en tejido non-woven (no tejido), con el asa troquelada.",
    material: "100% polipropileno no tejido, 80 g/m².",
  },
  "db49f7d9-91c5-4169-b9c8-250245cd2e64": {
    description: "Cinta elástica deportiva para la cabeza realizada en suave microfibra. Disponible en un amplio surtido de colores.",
    material: "Microfibra",
  },
  "dedcb799-cd5a-427d-971e-1c4e6b777054": {
    description: "Pulsera de algodón natural con cierre de seguridad (no retornable) con bambú",
    material: "Algodón natural y bambú.",
  },
  "36c12940-dd59-4332-afcd-1bd0e51e5864": {
    description:
      "Toalla de baño y playa, rematada con filamento de poliéster a tres hilos del mismo tono, excepto en el color plomo oscuro (ref.46) cuyo rematado es en amarillo flúor (ref. 221). Ornamento elástico para recogerla.",
    material: "80% poliéster / 20% poliamida, 280 g/m².",
  },
  "c3b4b196-d225-42d4-a9db-8902cde8a0bc": {
    description: "Termo de acero inoxidable 304 doble pared. Botón de apertura con cierre de seguridad. Capacidad 350ml.",
    material: "Acero inoxidable 304",
  },
  "f4bab01b-41d0-4db7-b8e5-45d29f127679": {
    description: "Bolsa de la compra plegable de suave poliéster 190T y acabado cosido. Incluye práctico elástico para plegar.",
    material: "Poliéster 190T",
  },
  "cda2473a-8338-44ae-a122-39e3a99a09c6": {
    description: "Auriculares presentados en una práctica funda transparente con autocierre. Conexión Jack 3,5mm. Cable con botón de seguridad incluido.",
    material: "Funda PVC",
  },
  "ff1bc79a-52b2-4663-a19a-260d45e38ce7": {
    description: "Bolsa termosellada especial para botellas, con pliegues en la base, fabricada en tejido non woven (no tejido), con el asa troquelada.",
    material: "100% polipropileno no tejido, 80 g/m².",
  },
  "6524d155-7ef1-4b4a-a9db-0804b23bd513": {
    description:
      "Bolsa termosellada con pliegues hexagonales en la base, fabricada en tejido non woven (no tejido), con un asa larga de cinta del mismo color.",
    material: "100% polipropileno no tejido, 80 g/m².",
  },
  "d35e9f54-9690-48c5-8848-c58c6e76263a": {
    description: "Llavero con osito de peluche realizado en suave poliéster y camiseta a color.",
    material: "Poliéster.",
  },
  "bf761327-5d83-4734-a917-0bb72eeff4f7": {
    description: "Muñequera elástica con bolsillo con cierre de cremallera a juego.",
    material: "Microfibra",
  },
  "fd6dc013-4edf-45f8-b79e-365282ac32a4": {
    description: "Bolsa de la compra ideal para sublimación, fabricada con resistente tejido non-woven cosido con asas reforzadas. Asas de 70cm.",
    material: "Non-woven",
  },
  "954103b0-b157-4c81-87b2-21352df4abff": {
    description:
      "Mochila básica en tejido jaspeado. 1. Doble asa reforzada para hombro y asa especial de mano. 2. Bolsillo frontal de gran capacidad con cremallera y tapeta que incluye salida para cables. 3. Detalles en negro.",
    material: "100% poliéster 300D, 400 g/m². Talla única: 30 x 40 x 12 cm. 14 L.",
  },
  "5b221278-cca8-4d30-adab-818da3867ad2": {
    description: "Funda para jamón de resistente non-woven con asas reforzadas y cierre de cremallera. Acabado cosido.",
    material: "Non-woven",
  },
  "b985b8d7-7536-486c-9ac9-a88f3546f525": {
    description:
      "Mochila básica en tejido resistente. 1. Doble asa para hombros y asa de mano a contraste. 2. Dos bolsillos, uno principal y otro frontal, con cremalleras, tapetas y tiradores a tono.",
    material: "100% poliéster, 600D 330 g/m². Talla única: 38 x 28 x 12 cm. 13,5L",
  },
  "bcf59245-c202-4bc1-833e-4a4e775a69bc": {
    description:
      "Set de bastones plegables de aluminio con sistema de amortiguación. Empuñadura ergonómica y cinta de seguridad ajustable. Incluye accesorio para nieve. Superficie de contacto con base reforzada.",
    material: "Aluminio",
  },
  "3c28396f-38d3-452e-8ff7-1ab5ff51a446": {
    description:
      "Mochila de cordones línea eco de algodón de 120 g/m² y yute. Color natural. El frontal de la mochila presenta una banda de yute en la parte inferior. Cordones cosidos en ambas esquinas inferiores.",
    material: "Algodón y yute.",
  },
  "63ef5392-353c-4124-bb92-7a6eb1232ea2": {
    description:
      "Cargador inalámbrico con cuerpo en ABS reciclado y superficie superior en tejido RPET. Coloca tu smartphone sobre él y déjalo cargar. Compatible con modelos de tecnología inalámbrica DC5V. Incluye cable micro USB.",
    material: "ABS reciclado y RPET",
  },
};

async function main() {
  let updated = 0;
  for (const [id, { description, material }] of Object.entries(TRANSLATIONS)) {
    await prisma.product.update({ where: { id }, data: { description, material } });
    updated++;
  }
  console.log(`Traducidos ${updated} productos.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
