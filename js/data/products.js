/* ==========================================================================
   products.js — Catálogo de productos (window.PRODUCTS)
   --------------------------------------------------------------------------
   Cómo editar este archivo (guía para el dueño, sin saber programar):

   • Cada producto es un bloque entre llaves { ... } separado por coma.
   • Campos principales:
       - name        → nombre del producto (visible)
       - slug        → identificador para la URL (sin espacios, en minúscula)
       - category    → id de la categoría (debe existir en categories.js)
       - price       → precio en pesos, SIN decimales y SIN puntos (89900)
       - comparePrice→ precio tachado (opcional; poné el precio anterior)
       - stock       → cuántas unidades hay disponibles (0 = agotado)
       - sku         → código interno de referencia
       - images      → rutas de las fotos (la primera es la principal)
       - active      → true = se muestra en la tienda, false = oculto
   • Para agregar un producto: copiá un bloque entero, pegalo y cambialo.
   • Para quitar uno: borrá su bloque completo (incluida la coma final).

   Nota sobre imágenes: hoy cada producto apunta a su placeholder SVG
   (img/products/SLUG.svg). Cuando cargues tus fotos con los nombres de
   LISTA-IMAGENES.md, yo actualizo estas rutas por las fotos reales.
   ========================================================================== */

window.PRODUCTS = [

  /* ============================ COCINA ============================ */
  {
    id: "p_0001",
    slug: "set-ollas-antiadherente-8-piezas",
    name: "Set de ollas antiadherente 8 piezas",
    category: "cocina",
    subcategory: "ollas-y-sartenes",
    price: 89900,
    comparePrice: 109900,
    stock: 14,
    sku: "COC-OLL-008",
    images: ["img/products/set-ollas-antiadherente-8-piezas.svg"],
    shortDescription: "Set completo de ollas y sartenes antiadherentes con tapas de vidrio.",
    description: "<p>Un set completo para equipar toda la cocina: ollas de distintos tamaños, sartenes y tapas de vidrio templado. El recubrimiento antiadherente permite cocinar con menos aceite y limpiar sin esfuerzo.</p><p>Apto para todo tipo de hornallas, incluida inducción. Asas ergonómicas que no se calientan.</p>",
    specs: [
      { label: "Material", value: "Aluminio forjado con recubrimiento antiadherente" },
      { label: "Piezas", value: "8 (ollas, sartenes y tapas)" },
      { label: "Inducción", value: "Sí" },
      { label: "Garantía", value: "12 meses" }
    ],
    variants: [
      { id: "v1", label: "Color", options: ["Negro", "Rojo"] }
    ],
    tags: ["oferta", "destacado"],
    featured: true,
    active: true,
    createdAt: "2026-06-10"
  },
  {
    id: "p_0002",
    slug: "sarten-antiadherente-28cm",
    name: "Sartén antiadherente 28 cm",
    category: "cocina",
    subcategory: "ollas-y-sartenes",
    price: 24900,
    comparePrice: null,
    stock: 22,
    sku: "COC-SAR-028",
    images: ["img/products/sarten-antiadherente-28cm.svg"],
    shortDescription: "Sartén antiadherente de 28 cm, ideal para el día a día.",
    description: "<p>Sartén de uso diario con recubrimiento antiadherente de alta durabilidad. Su diámetro de 28 cm es ideal para tortillas, carnes y guisos livianos.</p><p>Manija ergonómica y base apta para todo tipo de hornallas.</p>",
    specs: [
      { label: "Diámetro", value: "28 cm" },
      { label: "Material", value: "Aluminio con antiadherente" },
      { label: "Aptas", value: "Hornallas de gas, eléctrica y vitrocerámica" }
    ],
    variants: [],
    tags: ["nuevo"],
    featured: false,
    active: true,
    createdAt: "2026-07-02"
  },
  {
    id: "p_0003",
    slug: "set-cuchillos-acero-6-piezas",
    name: "Set de cuchillos de acero 6 piezas",
    category: "cocina",
    subcategory: "cuchilleria",
    price: 45900,
    comparePrice: 54900,
    stock: 9,
    sku: "COC-CUC-006",
    images: ["img/products/set-cuchillos-acero-6-piezas.svg"],
    shortDescription: "Cuchillería de acero inoxidable con taco de madera.",
    description: "<p>Set de cuchillería completo en acero inoxidable de corte duradero, con mangos de madera ergonómicos. Incluye los cuchillos más usados de la cocina.</p><p>Se entrega con taco de madera para guardarlos con orden.</p>",
    specs: [
      { label: "Material", value: "Acero inoxidable + madera" },
      { label: "Piezas", value: "6 cuchillos + taco" },
      { label: "Lavado", value: "A mano recomendado" }
    ],
    variants: [],
    tags: ["oferta"],
    featured: false,
    active: true,
    createdAt: "2026-06-18"
  },

  /* ======================= MESA Y VAJILLA ======================= */
  {
    id: "p_0004",
    slug: "vajilla-completa-12-personas",
    name: "Vajilla completa 12 personas",
    category: "mesa-vajilla",
    subcategory: "vajillas",
    price: 129900,
    comparePrice: 152900,
    stock: 6,
    sku: "MVA-VAJ-012",
    images: ["img/products/vajilla-completa-12-personas.svg"],
    shortDescription: "Vajilla de porcelana blanca para 12 personas (36 piezas).",
    description: "<p>Vajilla completa de porcelana blanca, ideal para recepciones y comidas familiares. Rústica pero elegante,Combina con cualquier mesa.</p><p>Apta para lavavajillas y microondas.</p>",
    specs: [
      { label: "Material", value: "Porcelana" },
      { label: "Piezas", value: "36 (para 12 personas)" },
      { label: "Apta", value: "Lavavajillas y microondas" }
    ],
    variants: [],
    tags: ["oferta", "destacado"],
    featured: true,
    active: true,
    createdAt: "2026-06-05"
  },
  {
    id: "p_0005",
    slug: "set-vasos-vidrio-6",
    name: "Set de vasos de vidrio (6 u.)",
    category: "mesa-vajilla",
    subcategory: "vasos-y-copas",
    price: 18900,
    comparePrice: null,
    stock: 30,
    sku: "MVA-VAS-006",
    images: ["img/products/set-vasos-vidrio-6.svg"],
    shortDescription: "Seis vasos de vidrio resistentes para el día a día.",
    description: "<p>Vasos de vidrio templado, resistentes al calor y al uso diario. Ideales para agua, jugos o para servir bebidas calientes.</p><p>Soldadura reforzada en el borde para mayor durabilidad.</p>",
    specs: [
      { label: "Material", value: "Vidrio templado" },
      { label: "Capacidad", value: "300 ml c/u" },
      { label: "Piezas", value: "6" }
    ],
    variants: [],
    tags: [],
    featured: false,
    active: true,
    createdAt: "2026-07-10"
  },
  {
    id: "p_0006",
    slug: "mantel-lino-beige",
    name: "Mantel de lino beige",
    category: "mesa-vajilla",
    subcategory: "manteleria",
    price: 27500,
    comparePrice: null,
    stock: 12,
    sku: "MVA-MAN-001",
    images: ["img/products/mantel-lino-beige.svg"],
    shortDescription: "Mantel de lino beige, look natural y elegante.",
    description: "<p>Mantel de lino beige que le da un toque cálido y natural a tu mesa. Tejido liviano, fácil de planchar y de lavar.</p><p>Perfecto para comedores y para cenas especiales.</p>",
    specs: [
      { label: "Material", value: "Lino" },
      { label: "Medida", value: "140 x 250 cm" },
      { label: "Lavado", value: "A máquina, agua fría" }
    ],
    variants: [
      { id: "v1", label: "Color", options: ["Beige", "Terracota", "Salvia"] }
    ],
    tags: ["nuevo"],
    featured: false,
    active: true,
    createdAt: "2026-07-20"
  },

  /* ========================= ORGANIZACIÓN ========================= */
  {
    id: "p_0007",
    slug: "set-cajas-organizadoras-3",
    name: "Set de cajas organizadoras (3 u.)",
    category: "organizacion",
    subcategory: "cajas-y-contenedores",
    price: 21900,
    comparePrice: null,
    stock: 25,
    sku: "ORG-CAJ-003",
    images: ["img/products/set-cajas-organizadoras-3.svg"],
    shortDescription: "Tres cajas organizadoras apilables con tapa.",
    description: "<p>Set de tres cajas organizadoras apilables con tapa, perfectas para ordenar ropa, accesorios o cosas de la casa.</p><p>Se guardan apiladas cuando no se usan, ocupando muy poco espacio.</p>",
    specs: [
      { label: "Material", value: "Tela resistente con base firme" },
      { label: "Piezas", value: "3" },
      { label: "Apilables", value: "Sí" }
    ],
    variants: [],
    tags: [],
    featured: false,
    active: true,
    createdAt: "2026-06-25"
  },
  {
    id: "p_0008",
    slug: "organizador-zapatos-modular",
    name: "Organizador de zapatos modular",
    category: "organizacion",
    subcategory: "organizacion-calzado",
    price: 32900,
    comparePrice: 38900,
    stock: 11,
    sku: "ORG-ZAP-001",
    images: ["img/products/organizador-zapatos-modular.svg"],
    shortDescription: "Organizador modular de zapatos, se adapta a cualquier espacio.",
    description: "<p>Organizador de zapatos modular que se arma a medida de tu espacio. Cada módulo guarda un par y se pueden apilar verticalmente.</p><p>Ideal para dormitorios, pasillos o balcones.</p>",
    specs: [
      { label: "Material", value: "Plástico ABS resistente" },
      { label: "Capacidad", value: "1 par por módulo" },
      { label: "Apilable", value: "Sí, hasta 5 módulos" }
    ],
    variants: [],
    tags: ["oferta"],
    featured: false,
    active: true,
    createdAt: "2026-06-22"
  },
  {
    id: "p_0009",
    slug: "canastos-ratan-2",
    name: "Canastos de ratán (2 u.)",
    category: "organizacion",
    subcategory: "canastos-y-cestos",
    price: 26500,
    comparePrice: null,
    stock: 0,
    sku: "ORG-CAN-002",
    images: ["img/products/canastos-ratan-2.svg"],
    shortDescription: "Dos canastos de ratán natural, decorativos y prácticos.",
    description: "<p>Canastos de ratán natural, combinan decoración y utilidad. Ideales para guardar mantas, revistas o accesorios.</p><p>Hechos a mano, cada pieza es única.</p>",
    specs: [
      { label: "Material", value: "Ratán natural" },
      { label: "Piezas", value: "2 (distintos tamaños)" },
      { label: "Origen", value: "Hecho a mano" }
    ],
    variants: [],
    tags: ["nuevo"],
    featured: false,
    active: true,
    createdAt: "2026-07-15"
  },

  /* ============================= BAÑO ============================= */
  {
    id: "p_0010",
    slug: "toallas-algodon-pack-4",
    name: "Toallas de algodón (pack 4)",
    category: "bano",
    subcategory: "toallas",
    price: 34900,
    comparePrice: null,
    stock: 18,
    sku: "BAN-TOA-004",
    images: ["img/products/toallas-algodon-pack-4.svg"],
    shortDescription: "Pack de 4 toallas de algodón suave y absorbente.",
    description: "<p>Pack de cuatro toallas de algodón puro, suaves y muy absorbentes. Tejido denso que dura muchos lavados.</p><p>Incluye 2 toallas de baño y 2 de mano.</p>",
    specs: [
      { label: "Material", value: "100% algodón" },
      { label: "Piezas", value: "2 de baño + 2 de mano" },
      { label: "Gramatura", value: "500 g/m²" }
    ],
    variants: [
      { id: "v1", label: "Color", options: ["Blanco", "Arena", "Salvia"] }
    ],
    tags: ["destacado"],
    featured: true,
    active: true,
    createdAt: "2026-06-12"
  },
  {
    id: "p_0011",
    slug: "set-accesorios-bano",
    name: "Set de accesorios de baño",
    category: "bano",
    subcategory: "accesorios-de-bano",
    price: 22900,
    comparePrice: 26900,
    stock: 15,
    sku: "BAN-ACC-001",
    images: ["img/products/set-accesorios-bano.svg"],
    shortDescription: "Set de accesorios de baño coordinados (dispensador, cepillero y bandeja).",
    description: "<p>Set coordinado de accesorios de baño: dispensador de jabón, cepillero y bandeja. Material mate que no marca huellas.</p><p>Da un look ordenado y elegante al baño.</p>",
    specs: [
      { label: "Material", value: "Resina mate" },
      { label: "Piezas", value: "3" },
      { label: "Color", value: "Gris piedra" }
    ],
    variants: [],
    tags: ["oferta"],
    featured: false,
    active: true,
    createdAt: "2026-06-28"
  },
  {
    id: "p_0012",
    slug: "dispensador-jabon-mate",
    name: "Dispensador de jabón mate",
    category: "bano",
    subcategory: "dispensadores",
    price: 12900,
    comparePrice: null,
    stock: 40,
    sku: "BAN-DIS-001",
    images: ["img/products/dispensador-jabon-mate.svg"],
    shortDescription: "Dispensador de jabón con acabado mate, anti-huellas.",
    description: "<p>Dispensador de jabón con bomba resistente y acabado mate anti-huellas. Ideal para bacha de baño o cocina.</p><p>Capacidad: 350 ml.</p>",
    specs: [
      { label: "Material", value: "Resina con acabado mate" },
      { label: "Capacidad", value: "350 ml" },
      { label: "Acabado", value: "Anti-huellas" }
    ],
    variants: [],
    tags: [],
    featured: false,
    active: true,
    createdAt: "2026-07-05"
  },

  /* ========================= TEXTIL HOGAR ========================= */
  {
    id: "p_0013",
    slug: "manta-tejida-beige",
    name: "Manta tejida beige",
    category: "textil-hogar",
    subcategory: "mantas-y-cobertores",
    price: 42900,
    comparePrice: null,
    stock: 10,
    sku: "TEX-MAN-001",
    images: ["img/products/manta-tejida-beige.svg"],
    shortDescription: "Manta tejida beige, cálida y decorativa.",
    description: "<p>Manta tejida de tono beige, cálida y con textura. Perfecta para el sillón, la cama o para tomar el fresco en el balcón.</p><p>Tejido suave que no pica, ideal para piel sensible.</p>",
    specs: [
      { label: "Material", value: "Algodón y acrílico" },
      { label: "Medida", value: "130 x 170 cm" },
      { label: "Lavado", value: "A máquina, ciclo delicado" }
    ],
    variants: [
      { id: "v1", label: "Color", options: ["Beige", "Terracota", "Salvia"] }
    ],
    tags: ["nuevo", "destacado"],
    featured: true,
    active: true,
    createdAt: "2026-07-25"
  },
  {
    id: "p_0014",
    slug: "juego-almohadas-decorativas-2",
    name: "Juego de almohadas decorativas (2 u.)",
    category: "textil-hogar",
    subcategory: "almohadas",
    price: 29900,
    comparePrice: null,
    stock: 16,
    sku: "TEX-ALM-002",
    images: ["img/products/juego-almohadas-decorativas-2.svg"],
    shortDescription: "Dos almohadas decorativas con fundas texturizadas.",
    description: "<p>Juego de dos almohadas decorativas con fundas de textura, para sillón o cama. Dan calidez y estilo al ambiente.</p><p>Incluye el relleno.</p>",
    specs: [
      { label: "Material", value: "Poliéster con funda texturizada" },
      { label: "Medida", value: "45 x 45 cm c/u" },
      { label: "Incluye", value: "Relleno" }
    ],
    variants: [
      { id: "v1", label: "Color", options: ["Crudo", "Terracota", "Verde salvia"] }
    ],
    tags: [],
    featured: false,
    active: true,
    createdAt: "2026-06-30"
  },
  {
    id: "p_0015",
    slug: "cortinas-blackout-2-paneles",
    name: "Cortinas blackout (2 paneles)",
    category: "textil-hogar",
    subcategory: "cortinas",
    price: 48900,
    comparePrice: 57900,
    stock: 3,
    sku: "TEX-COR-002",
    images: ["img/products/cortinas-blackout-2-paneles.svg"],
    shortDescription: "Cortinas blackout que bloquean la luz y aislan del ruido.",
    description: "<p>Cortinas blackout de doble panel que bloquean hasta el 99% de la luz y ayudan a aislar del calor y del ruido.</p><p>Fácil instalación con ojalillos.</p>",
    specs: [
      { label: "Material", value: "Poliéster blackout" },
      { label: "Medida", value: "140 x 240 cm c/u" },
      { label: "Paneles", value: "2" }
    ],
    variants: [],
    tags: ["oferta"],
    featured: false,
    active: true,
    createdAt: "2026-06-08"
  },

  /* ========================== DECORACIÓN ========================== */
  {
    id: "p_0016",
    slug: "jarron-ceramica-artesanal",
    name: "Jarrón de cerámica artesanal",
    category: "decoracion",
    subcategory: "jarrones",
    price: 32500,
    comparePrice: null,
    stock: 3,
    sku: "DEC-JAR-001",
    images: ["img/products/jarron-ceramica-artesanal.svg"],
    shortDescription: "Jarrón de cerámica hecho a mano, pieza única.",
    description: "<p>Jarrón de cerámica modelado y esmaltado a mano. Cada pieza es única, con pequeñas variaciones propias del trabajo artesanal.</p><p>Perfecto con flores secas o como pieza decorativa sola.</p>",
    specs: [
      { label: "Material", value: "Cerámica esmaltada" },
      { label: "Altura", value: "28 cm" },
      { label: "Origen", value: "Hecho a mano" }
    ],
    variants: [],
    tags: ["nuevo"],
    featured: false,
    active: true,
    createdAt: "2026-07-28"
  },
  {
    id: "p_0017",
    slug: "set-velas-aromaticas-3",
    name: "Set de velas aromáticas (3 u.)",
    category: "decoracion",
    subcategory: "velas",
    price: 18900,
    comparePrice: null,
    stock: 28,
    sku: "DEC-VEL-003",
    images: ["img/products/set-velas-aromaticas-3.svg"],
    shortDescription: "Tres velas aromáticas de soja en frasco de vidrio.",
    description: "<p>Set de tres velas aromáticas de cera de soja, en frasco de vidrio reutilizable. Queman limpio y perfuman el ambiente por horas.</p><p>Aromas: vainilla, lavanda y cítricos.</p>",
    specs: [
      { label: "Cera", value: "Soja natural" },
      { label: "Piezas", value: "3 frascos" },
      { label: "Duración", value: "≈ 20 h por vela" }
    ],
    variants: [],
    tags: [],
    featured: false,
    active: true,
    createdAt: "2026-07-08"
  },
  {
    id: "p_0018",
    slug: "cuadro-decorativo-40x60",
    name: "Cuadro decorativo Abstracto 40x60",
    category: "decoracion",
    subcategory: "cuadros",
    price: 26900,
    comparePrice: null,
    stock: 3,
    sku: "DEC-CUA-4060",
    images: ["img/products/cuadro-decorativo-40x60.svg"],
    shortDescription: "Cuadro abstracto de 40x60 cm con marco de madera.",
    description: "<p>Cuadro decorativo abstracto de 40x60 cm, listo para colgar. Marco de madera natural que combina con estilos nórdicos y boho.</p><p>Impresión de alta calidad sobre lienzo.</p>",
    specs: [
      { label: "Medida", value: "40 x 60 cm" },
      { label: "Marco", value: "Madera natural" },
      { label: "Material", value: "Lienzo impreso" }
    ],
    variants: [],
    tags: [],
    featured: false,
    active: true,
    createdAt: "2026-07-01"
  },

  /* =========================== LIMPIEZA =========================== */
  {
    id: "p_0019",
    slug: "set-limpieza-eco-5",
    name: "Set de limpieza eco (5 u.)",
    category: "limpieza",
    subcategory: "kits-de-limpieza",
    price: 19900,
    comparePrice: 23900,
    stock: 20,
    sku: "LIM-SET-005",
    images: ["img/products/set-limpieza-eco-5.svg"],
    shortDescription: "Set ecológico de limpieza con materiales reutilizables.",
    description: "<p>Set de limpieza eco con elementos reutilizables: guantes, trapeador de microfibra, paños y escobilla. Menos plástico, misma limpieza.</p><p>Ideal para empezar a reducir residuos en casa.</p>",
    specs: [
      { label: "Piezas", value: "5" },
      { label: "Tipo", value: "Ecológico / reutilizable" },
      { label: "Incluye", value: "Guantes, trapeador, paños, escobilla" }
    ],
    variants: [],
    tags: ["oferta"],
    featured: false,
    active: true,
    createdAt: "2026-06-15"
  },
  {
    id: "p_0020",
    slug: "trapeador-giratorio-cubeta",
    name: "Trapeador giratorio con cubeta",
    category: "limpieza",
    subcategory: "trapeadores",
    price: 38900,
    comparePrice: null,
    stock: 8,
    sku: "LIM-TRA-001",
    images: ["img/products/trapeador-giratorio-cubeta.svg"],
    shortDescription: "Trapeador con sistema de escurrido giratorio y cubeta.",
    description: "<p>Trapeador con sistema de escurrido giratorio que exprime el cepillo sin doblarse. Incluye cubeta con dos compartimentos.</p><p>Ahorra tiempo y esfuerzo en la limpieza del piso.</p>",
    specs: [
      { label: "Material", value: "Plástico y microfibra" },
      { label: "Incluye", value: "Cubeta + trapeador" },
      { label: "Escurrido", value: "Giratorio" }
    ],
    variants: [],
    tags: ["destacado"],
    featured: true,
    active: true,
    createdAt: "2026-06-20"
  },
  {
    id: "p_0021",
    slug: "esponjas-ecologicas-6",
    name: "Esponjas ecológicas (6 u.)",
    category: "limpieza",
    subcategory: "esponjas",
    price: 9900,
    comparePrice: null,
    stock: 50,
    sku: "LIM-ESP-006",
    images: ["img/products/esponjas-ecologicas-6.svg"],
    shortDescription: "Seis esponjas biodegradables para la limpieza del hogar.",
    description: "<p>Set de seis esponjas ecológicas biodegradables, aptas para cocina y baño. No rayan las superficies.</p><p>Materiales naturales, aptas para compostaje.</p>",
    specs: [
      { label: "Material", value: "Celulosa y fibra de coco" },
      { label: "Piezas", value: "6" },
      { label: "Biodegradables", value: "Sí" }
    ],
    variants: [],
    tags: [],
    featured: false,
    active: true,
    createdAt: "2026-07-12"
  },

  /* ======================= ELECTRO PEQUEÑOS ======================= */
  {
    id: "p_0022",
    slug: "pava-electrica-acero-1-7l",
    name: "Pava eléctrica de acero 1,7 L",
    category: "electro-pequenos",
    subcategory: "pava",
    price: 44900,
    comparePrice: 52900,
    stock: 12,
    sku: "ELE-PAV-17",
    images: ["img/products/pava-electrica-acero-1-7l.svg"],
    shortDescription: "Pava eléctrica de acero inoxidable, 1,7 litros.",
    description: "<p>Pava eléctrica de acero inoxidable de 1,7 litros, con apagado automático y protección contra hervido en seco.</p><p>Base giratoria 360° y filtro antical.</p>",
    specs: [
      { label: "Capacidad", value: "1,7 L" },
      { label: "Material", value: "Acero inoxidable" },
      { label: "Potencia", value: "2200 W" },
      { label: "Seguridad", value: "Apagado automático" }
    ],
    variants: [],
    tags: ["oferta"],
    featured: false,
    active: true,
    createdAt: "2026-06-14"
  },
  {
    id: "p_0023",
    slug: "tostadora-2-rebanadas",
    name: "Tostadora de 2 rebanadas",
    category: "electro-pequenos",
    subcategory: "tostadoras",
    price: 36900,
    comparePrice: null,
    stock: 14,
    sku: "ELE-TOS-002",
    images: ["img/products/tostadora-2-rebanadas.svg"],
    shortDescription: "Tostadora para 2 rebanadas con control de dorado.",
    description: "<p>Tostadora de dos rebanadas con selector de grado de dorado y función de descongelado.</p><p>Bandeja de migajas fácil de limpiar.</p>",
    specs: [
      { label: "Capacidad", value: "2 rebanadas" },
      { label: "Potencia", value: "800 W" },
      { label: "Funciones", value: "Dorado + descongelado" }
    ],
    variants: [],
    tags: [],
    featured: false,
    active: true,
    createdAt: "2026-07-06"
  },
  {
    id: "p_0024",
    slug: "licuadora-vaso-1-5l",
    name: "Licuadora de vaso 1,5 L",
    category: "electro-pequenos",
    subcategory: "licuadoras",
    price: 62900,
    comparePrice: 74900,
    stock: 6,
    sku: "ELE-LIC-15",
    images: ["img/products/licuadora-vaso-1-5l.svg"],
    shortDescription: "Licuadora con vaso de vidrio de 1,5 L y 3 velocidades.",
    description: "<p>Licuadora de vaso de vidrio de 1,5 litros con motor potente, tres velocidades y función pulsador.</p><p>Cuchillas de acero inoxidable para hielo y frutas duras.</p>",
    specs: [
      { label: "Capacidad", value: "1,5 L" },
      { label: "Vaso", value: "Vidrio" },
      { label: "Velocidades", value: "3 + pulsador" },
      { label: "Potencia", value: "1000 W" }
    ],
    variants: [],
    tags: ["oferta", "destacado"],
    featured: true,
    active: true,
    createdAt: "2026-06-02"
  }
];
