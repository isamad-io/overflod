
const PROVIDER_SEED = [
  ['Cementos Andinos S.A.', 'Proveedor de cemento embolsado para obras generales.', 'Cemento Portland Tipo I'],
  ['Aceros del Sur', 'Proveedor de acero corrugado y alambre para estructura.', 'Fierros corrugados, alambre recocido'],
  ['Ladrillera Norte', 'Proveedor de ladrillos de arcilla para muros.', 'Ladrillo King Kong 18 Huecos'],
  ['Áridos del Valle', 'Proveedor de agregados para mezclas y acabados.', 'Arena gruesa, arena fina, piedra chancada'],
  ['Maderera Selva', 'Proveedor de madera para encofrado y carpintería.', 'Madera tornillo'],
  ['Ferretería Industrial', 'Proveedor de accesorios de ferretería.', 'Clavos, bisagras, lijas'],
  ['Plásticos del Perú', 'Proveedor de tuberías PVC para agua y desagüe.', 'Tubos PVC SAL y agua'],
  ['Pinturas Andinas', 'Proveedor de pinturas para acabados.', 'Pintura látex lavable'],
  ['Adhesivos Construcción', 'Proveedor de adhesivos y selladores.', 'Pegamento para porcelanato, silicona'],
  ['Electrónica Nacional', 'Proveedor de materiales eléctricos.', 'Cable THW, cajas PVC'],
  ['Sanitarios del Centro', 'Proveedor de grifería y accesorios sanitarios.', 'Mezcladoras para lavatorio']
];

const PRODUCT_SEED = [
  ['001', 'Cemento Portland Tipo I (42.5kg)', 'Bolsa', 'Cementos Andinos S.A.', 25.00, 32.50, 'Cemento', 'Cemento', 120, 'Bolsa de cemento Portland Tipo I para estructuras, columnas, vigas y obras generales.'],
  ['002', 'Fierro Corrugado 1/2"', 'Varilla', 'Aceros del Sur', 38.00, 49.40, 'Acero', 'Acero corrugado', 80, 'Varilla de fierro corrugado de 1/2 pulgada para refuerzo estructural.'],
  ['003', 'Fierro Corrugado 3/8"', 'Varilla', 'Aceros del Sur', 22.00, 28.60, 'Acero', 'Acero corrugado', 100, 'Varilla de fierro corrugado de 3/8 pulgada para columnas, vigas y amarres.'],
  ['004', 'Ladrillo King Kong 18 Huecos', 'Millar', 'Ladrillera Norte', 1200.00, 1560.00, 'Ladrillos', 'Arcilla cocida', 12, 'Millar de ladrillo King Kong de 18 huecos para muros y tabiquería.'],
  ['005', 'Arena Gruesa', 'm3', 'Áridos del Valle', 50.00, 75.00, 'Agregados', 'Arena', 40, 'Arena gruesa por metro cúbico para mezclas de concreto y asentado.'],
  ['006', 'Piedra Chancada 1/2"', 'm3', 'Áridos del Valle', 65.00, 95.00, 'Agregados', 'Piedra chancada', 35, 'Piedra chancada de 1/2 pulgada por metro cúbico para concreto.'],
  ['007', "Madera Tornillo (Tablas 1x8x10')", 'Unidad', 'Maderera Selva', 45.00, 60.00, 'Madera', 'Madera tornillo', 70, 'Tabla de madera tornillo 1x8x10 pies para encofrados y carpintería.'],
  ['008', 'Clavos para madera 3" con cabeza', 'Kg', 'Ferretería Industrial', 6.50, 9.50, 'Ferretería', 'Acero', 90, 'Clavos de 3 pulgadas con cabeza para trabajos en madera.'],
  ['009', 'Alambre Recocido #16', 'Kg', 'Aceros del Sur', 7.00, 10.50, 'Acero', 'Alambre recocido', 85, 'Alambre recocido #16 por kilogramo para amarres de acero.'],
  ['010', 'Tubo PVC Sal (4" x 3m)', 'Unidad', 'Plásticos del Perú', 35.00, 48.00, 'PVC', 'PVC sal', 60, 'Tubo PVC SAL de 4 pulgadas por 3 metros para desagüe.'],
  ['011', 'Tubo PVC Agua (1/2" x 5m)', 'Unidad', 'Plásticos del Perú', 12.00, 17.50, 'PVC', 'PVC agua', 75, 'Tubo PVC de agua de 1/2 pulgada por 5 metros para instalaciones sanitarias.'],
  ['012', 'Pintura Látex Lavable (Galón)', 'Galón', 'Pinturas Andinas', 42.00, 65.00, 'Pinturas', 'Pintura látex', 45, 'Galón de pintura látex lavable para interiores y exteriores.'],
  ['013', 'Pegamento para Porcelanato', 'Bolsa 25kg', 'Adhesivos Construcción', 28.00, 42.00, 'Adhesivos', 'Mortero adhesivo', 65, 'Bolsa de pegamento para porcelanato de 25 kg.'],
  ['014', 'Arena Fina', 'm3', 'Áridos del Valle', 45.00, 68.00, 'Agregados', 'Arena fina', 38, 'Arena fina por metro cúbico para tarrajeos y acabados.'],
  ['015', 'Cable Eléctrico THW 4mm', 'Rollo 100m', 'Electrónica Nacional', 180.00, 240.00, 'Electricidad', 'Cobre y PVC', 25, 'Rollo de cable eléctrico THW 4mm de 100 metros.'],
  ['016', 'Cajas Rectangulares PVC', 'Unidad', 'Electrónica Nacional', 1.50, 2.80, 'Electricidad', 'PVC', 150, 'Caja rectangular PVC para puntos eléctricos.'],
  ['017', 'Bisagra de acero 3"', 'Unidad', 'Ferretería Industrial', 4.00, 7.50, 'Ferretería', 'Acero', 100, 'Bisagra de acero de 3 pulgadas para puertas y muebles.'],
  ['018', 'Lija para madera (Grano 80)', 'Unidad', 'Ferretería Industrial', 1.20, 2.50, 'Ferretería', 'Lija', 180, 'Lija para madera grano 80 para preparación y acabado.'],
  ['019', 'Mezcladora para lavatorio', 'Unidad', 'Sanitarios del Centro', 85.00, 130.00, 'Sanitarios', 'Metal cromado', 30, 'Mezcladora para lavatorio con acabado cromado.'],
  ['020', 'Silicona Selladora Multiuso', 'Unidad', 'Adhesivos Construcción', 15.00, 24.00, 'Adhesivos', 'Silicona', 55, 'Silicona selladora multiuso para juntas, baños, cocinas y acabados.']
];

const SODIMAC_REFERENCES = {
  '001': ['https://media.sodimac.com.pe/sodimacPE/207756_00/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113518067/cemento-sol-portland-tipo-i-42-5-kg?exp=so_com'],
  '002': ['https://media.sodimac.com.pe/sodimacPE/211230_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113523810/barras-de-acero-1-2?exp=so_com'],
  '003': ['https://media.sodimac.com.pe/sodimacPE/84247_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113528077/barras-de-acero-3-8?exp=so_com'],
  '004': ['https://media.sodimac.com.pe/sodimacPE/397997_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/114460317/Ladrillo-King-Kong-18h-Piramide?exp=so_com'],
  '005': ['https://media.sodimac.com.pe/sodimacPE/391905_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113538983/Arena-Gruesa-saco-40-Kg-Lux?exp=so_com'],
  '006': ['https://media.sodimac.com.pe/sodimacPE/391913_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113530852/Piedra-Chancada-1-2-40-Kg?exp=so_com'],
  '007': ['https://media.sodimac.com.pe/sodimacPE/1193724_1/public', "https://www.sodimac.com.pe/sodimac-pe/articulo/114524297/Madera-Pino-Radiata-1-1-2-X-8-X-10.5'-?exp=so_com"],
  '008': ['https://media.sodimac.com.pe/sodimacPE/120421_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113308338/Clavo-de-3Pulgadas-Albanil-con-Cabeza-x-1-kg?exp=so_com'],
  '009': ['https://media.sodimac.com.pe/sodimacPE/1554433_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113516970/Alambre-Recocido-N%C2%B0-16-y-0.3-cm-diam.-x-1kg?exp=so_com'],
  '010': ['https://media.sodimac.com.pe/sodimacPE/344850_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113519365/Tubo-Desague-PVC-4-3m-Liviano-Pavco?exp=so_com'],
  '011': ['https://media.sodimac.com.pe/sodimacPE/308765_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113531542/Tubo-Agua-PVC-1-2-5m-Pavco-SP-Fria?exp=so_com'],
  '012': ['https://media.sodimac.com.pe/sodimacPE/4043618_12/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113323228/pintura-kolor-premium-satinado-blanco-1gl?exp=so_com'],
  '013': ['https://media.sodimac.com.pe/sodimacPE/1263943_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113779962/Pegamento-para-Ceramicas-o-Porcelanatos-Celima-Blanco-Extrafuerte-25kg?exp=so_com'],
  '014': ['https://media.sodimac.com.pe/sodimacPE/391891_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113535372/Arena-Fina-saco-40-Kg-Lux?exp=so_com'],
  '015': ['https://media.sodimac.com.pe/sodimacPE/2277794_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/114745718/cable-thw-4mm2-azul-100-metros?exp=so_com'],
  '016': ['https://media.sodimac.com.pe/sodimacPE/360953_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113536514/Caja-de-Pase-Rectangular-PVC-3-4-Pavco?exp=so_com'],
  '017': ['https://media.sodimac.com.pe/sodimacPE/9072284_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/136614693/pack-de-3-bisagras-acero-3x3?exp=so_com'],
  '018': ['https://media.sodimac.com.pe/sodimacPE/63258_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/113322404/Lija-Madera-Grano-n-150-Asa?exp=so_com'],
  '019': ['https://media.sodimac.com.pe/sodimacPE/4326148_01/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/136685141/Mezclador-Lavatorio-4-Cuerpo-Acetal-Abs-Piana?exp=so_com'],
  '020': ['https://media.sodimac.com.pe/sodimacPE/428691X_1/public', 'https://www.sodimac.com.pe/sodimac-pe/articulo/131918598/Sika-Sikasil-IA-Transparente-Sellante-de-silicona-multiuso-para-vidrios-y-ventanas-280-ml?exp=so_com']
};

module.exports = {
  PRODUCT_SEED,
  PROVIDER_SEED,
  SODIMAC_REFERENCES
};
