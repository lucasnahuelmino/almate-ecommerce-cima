/* ==========================================================================
   categories.js — Categorías del catálogo (window.CATEGORIES)
   --------------------------------------------------------------------------
   Cada categoría tiene un id corto (que usan los productos), nombre visible,
   slug para las URLs, imagen, un ícono SVG (viewBox 24x24, se pinta con
   currentColor) y un orden para mostrarlas.

   "Ofertas" es una sección ESPECIAL (isVirtual): no es una categoría real.
   Los productos llegan ahí solos cuando tienen descuento o la etiqueta
   "oferta". Por eso ningún producto tiene category: "ofertas".
   ========================================================================== */

window.CATEGORIES = [
  {
    id: "cocina",
    name: "Cocina",
    slug: "cocina",
    image: "img/categories/cocina.svg",
    icon: "M4 10h16M6 10v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-6M8 10V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3",
    description: "Ollas, sartenes, cuchillería y todo para cocinar.",
    order: 1,
    featured: true
  },
  {
    id: "mesa-vajilla",
    name: "Mesa y Vajilla",
    slug: "mesa-y-vajilla",
    image: "img/categories/mesa-vajilla.svg",
    icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    description: "Vajillas, vasos, copas y mantelería para tus mesas.",
    order: 2,
    featured: true
  },
  {
    id: "organizacion",
    name: "Organización",
    slug: "organizacion",
    image: "img/categories/organizacion.svg",
    icon: "M3 8l9-5 9 5v8l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v10",
    description: "Cajas, canastos y soluciones para ordenar tu casa.",
    order: 3,
    featured: true
  },
  {
    id: "bano",
    name: "Baño",
    slug: "bano",
    image: "img/categories/bano.svg",
    icon: "M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3Z",
    description: "Toallas, accesorios y dispensadores.",
    order: 4,
    featured: false
  },
  {
    id: "textil-hogar",
    name: "Textil Hogar",
    slug: "textil-hogar",
    image: "img/categories/textil-hogar.svg",
    icon: "M4 8c0-1 1-2 2-2h12c1 0 2 1 2 2v8c0 1-1 2-2 2H6c-1 0-2-1-2-2V8ZM8 6v12",
    description: "Mantas, almohadas y cortinas para tu hogar.",
    order: 5,
    featured: false
  },
  {
    id: "decoracion",
    name: "Decoración",
    slug: "decoracion",
    image: "img/categories/decoracion.svg",
    icon: "M9 3h6M10 3c0 3-4 4-4 8a6 6 0 0 0 12 0c0-4-4-5-4-8",
    description: "Jarrones, velas, cuadros y detalles con estilo.",
    order: 6,
    featured: false
  },
  {
    id: "limpieza",
    name: "Limpieza",
    slug: "limpieza",
    image: "img/categories/limpieza.svg",
    icon: "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3ZM18 15l.7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z",
    description: "Kits, trapeadores y accesorios para una casa impecable.",
    order: 7,
    featured: false
  },
  {
    id: "electro-pequenos",
    name: "Electro Pequeños",
    slug: "electro-pequenos",
    image: "img/categories/electro-pequenos.svg",
    icon: "M13 2L4 14h6l-1 8 9-12h-6l1-8Z",
    description: "Pavas, tostadoras y licuadoras.",
    order: 8,
    featured: false
  },
  {
    id: "ofertas",
    name: "Ofertas",
    slug: "ofertas",
    image: null,                                   // No tiene imagen: se arma sola
    icon: "M20.6 13.4L12 22l-9-9V4h9l8.6 8.6a2 2 0 0 1 0 2.8ZM7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
    description: "Todos los productos con descuento en un solo lugar.",
    order: 9,
    featured: true,
    isVirtual: true                               // Se especial: agrupa por descuento/etiqueta
  }
];
