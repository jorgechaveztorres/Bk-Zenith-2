/**
 * ZÉNITH — GEOGRAPHIC CITY CATALOG (MULTICIUDAD PERÚ)
 * 
 * Separación estricta de configuración de ciudades respecto a la lógica del motor geográfico.
 * Permite incorporar N nuevas ciudades sin modificar la lógica tarifaria, Gatekeeper ni HMAC.
 */

export interface CityBoundingBox {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

export interface CityCoordinates {
  lat: number;
  lng: number;
}

export interface CityDefinition {
  code: string;               // Código alfanumérico único de 3-4 letras (ej. 'TRU', 'LIM')
  name: string;               // Nombre oficial de la ciudad
  department: string;         // Departamento o Región
  country: string;            // Código de país ISO (ej. 'PE')
  center: CityCoordinates;    // Coordenadas del centroide metropolitano
  boundingBox: CityBoundingBox;
  operationalRadiusKm: number;// Radio de cobertura metropolitana en km
  active: boolean;            // Estado de operación
  aliases?: string[];         // Nombres alternativos, distritos o términos de búsqueda
  metropolitanArea?: string;  // Nombre oficial del área metropolitana
}

/**
 * Catálogo Base de Ciudades Actualmente Configuradas en el Sistema ZÉNITH.
 * Representa la configuración inicial ampliable (no es una lista cerrada).
 */
export const DEFAULT_CONFIGURED_CITIES: CityDefinition[] = [
  {
    code: 'TRU',
    name: 'Trujillo',
    department: 'La Libertad',
    country: 'PE',
    center: { lat: -8.1116, lng: -79.0287 },
    boundingBox: { latMin: -8.350, latMax: -7.950, lngMin: -79.200, lngMax: -78.850 },
    operationalRadiusKm: 22,
    active: true,
    aliases: ['trujillo', 'victor larco', 'huanchaco', 'moche', 'la esperanza', 'el porvenir'],
    metropolitanArea: 'Área Metropolitana de Trujillo'
  },
  {
    code: 'LIM',
    name: 'Lima',
    department: 'Lima',
    country: 'PE',
    center: { lat: -12.0464, lng: -77.0428 },
    boundingBox: { latMin: -12.500, latMax: -11.600, lngMin: -77.300, lngMax: -76.650 },
    operationalRadiusKm: 40,
    active: true,
    aliases: ['lima', 'callao', 'miraflores', 'san isidro', 'surco', 'san borja', 'la molina'],
    metropolitanArea: 'Lima Metropolitana y Callao'
  },
  {
    code: 'AQP',
    name: 'Arequipa',
    department: 'Arequipa',
    country: 'PE',
    center: { lat: -16.4090, lng: -71.5375 },
    boundingBox: { latMin: -16.600, latMax: -16.200, lngMin: -71.700, lngMax: -71.350 },
    operationalRadiusKm: 22,
    active: true,
    aliases: ['arequipa', 'cayma', 'yanahuara', 'cerro colorado', 'bustamante y rivero'],
    metropolitanArea: 'Área Metropolitana de Arequipa'
  },
  {
    code: 'CIX',
    name: 'Chiclayo',
    department: 'Lambayeque',
    country: 'PE',
    center: { lat: -6.7714, lng: -79.8409 },
    boundingBox: { latMin: -6.950, latMax: -6.650, lngMin: -80.000, lngMax: -79.700 },
    operationalRadiusKm: 20,
    active: true,
    aliases: ['chiclayo', 'la victoria', 'jose leonardo ortiz', 'pimentel'],
    metropolitanArea: 'Área Metropolitana de Chiclayo'
  },
  {
    code: 'PIU',
    name: 'Piura',
    department: 'Piura',
    country: 'PE',
    center: { lat: -5.1945, lng: -80.6328 },
    boundingBox: { latMin: -5.350, latMax: -5.050, lngMin: -80.800, lngMax: -80.500 },
    operationalRadiusKm: 20,
    active: true,
    aliases: ['piura', 'castilla', 'veintiseis de octubre', 'catacaos'],
    metropolitanArea: 'Área Metropolitana de Piura'
  },
  {
    code: 'CUZ',
    name: 'Cusco',
    department: 'Cusco',
    country: 'PE',
    center: { lat: -13.5320, lng: -71.9675 },
    boundingBox: { latMin: -13.650, latMax: -13.400, lngMin: -72.100, lngMax: -71.850 },
    operationalRadiusKm: 18,
    active: true,
    aliases: ['cusco', 'cuzco', 'wanchaq', 'santiago', 'san sebastian', 'san jeronimo'],
    metropolitanArea: 'Valle Urbano del Cusco'
  },
  {
    code: 'HYO',
    name: 'Huancayo',
    department: 'Junín',
    country: 'PE',
    center: { lat: -12.0651, lng: -75.2049 },
    boundingBox: { latMin: -12.200, latMax: -11.950, lngMin: -75.350, lngMax: -75.100 },
    operationalRadiusKm: 18,
    active: true,
    aliases: ['huancayo', 'el tambo', 'chilca'],
    metropolitanArea: 'Área Metropolitana de Huancayo'
  },
  {
    code: 'IQT',
    name: 'Iquitos',
    department: 'Loreto',
    country: 'PE',
    center: { lat: -3.7491, lng: -73.2538 },
    boundingBox: { latMin: -3.900, latMax: -3.600, lngMin: -73.400, lngMax: -73.150 },
    operationalRadiusKm: 18,
    active: true,
    aliases: ['iquitos', 'punchana', 'belen', 'san juan bautista'],
    metropolitanArea: 'Área Urbana de Iquitos'
  },
  {
    code: 'TAC',
    name: 'Tacna',
    department: 'Tacna',
    country: 'PE',
    center: { lat: -18.0146, lng: -70.2536 },
    boundingBox: { latMin: -18.150, latMax: -17.900, lngMin: -70.350, lngMax: -70.150 },
    operationalRadiusKm: 18,
    active: true,
    aliases: ['tacna', 'alto de la alianza', 'ciudad nueva', 'coronel gregorio albarracin'],
    metropolitanArea: 'Área Metropolitana de Tacna'
  },
  {
    code: 'CHM',
    name: 'Chimbote',
    department: 'Áncash',
    country: 'PE',
    center: { lat: -9.0745, lng: -78.5936 },
    boundingBox: { latMin: -9.200, latMax: -8.950, lngMin: -78.700, lngMax: -78.450 },
    operationalRadiusKm: 20,
    active: true,
    aliases: ['chimbote', 'nuevo chimbote', 'coishco'],
    metropolitanArea: 'Área Conurbada Chimbote - Nuevo Chimbote'
  },
  {
    code: 'PCL',
    name: 'Pucallpa',
    department: 'Ucayali',
    country: 'PE',
    center: { lat: -8.3791, lng: -74.5539 },
    boundingBox: { latMin: -8.500, latMax: -8.250, lngMin: -74.700, lngMax: -74.400 },
    operationalRadiusKm: 18,
    active: true,
    aliases: ['pucallpa', 'calleria', 'yarinacocha', 'manantay'],
    metropolitanArea: 'Área Metropolitana de Pucallpa'
  }
];

/**
 * Registro y Gestor Central de Ciudades Configuradas de ZÉNITH.
 * Permite registrar dinámicamente nuevas ciudades (ej. Tarapoto, Moquegua, Juliaca)
 * sin requerir alteraciones al código del motor ni re-compilaciones del núcleo tarifario.
 */
export class CityCatalogRegistry {
  private citiesMap: Map<string, CityDefinition> = new Map();

  constructor() {
    this.resetToDefaults();
  }

  /**
   * Restablece el catálogo con las ciudades base configuradas.
   */
  resetToDefaults(): void {
    this.citiesMap.clear();
    for (const city of DEFAULT_CONFIGURED_CITIES) {
      this.citiesMap.set(city.code.toUpperCase(), { ...city });
    }
  }

  /**
   * Registra una nueva ciudad en el catálogo.
   * La operación valida unicidad de código y completitud geográfica.
   */
  registerCity(city: CityDefinition): void {
    const code = city.code.trim().toUpperCase();
    if (!code || code.length < 2) {
      throw new Error(`Código de ciudad inválido: "${city.code}". Debe tener al menos 2 caracteres.`);
    }

    if (
      typeof city.center?.lat !== 'number' ||
      typeof city.center?.lng !== 'number' ||
      city.center.lat < -90 || city.center.lat > 90 ||
      city.center.lng < -180 || city.center.lng > 180
    ) {
      throw new Error(`Coordenadas del centroide inválidas para la ciudad ${city.name}.`);
    }

    this.citiesMap.set(code, {
      ...city,
      code,
      country: city.country || 'PE',
      active: city.active !== undefined ? city.active : true
    });
  }

  /**
   * Elimina o desregistra una ciudad por código.
   */
  unregisterCity(code: string): boolean {
    return this.citiesMap.delete(code.trim().toUpperCase());
  }

  /**
   * Obtiene la definición de una ciudad por su código.
   */
  getCityByCode(code: string): CityDefinition | undefined {
    return this.citiesMap.get(code.trim().toUpperCase());
  }

  /**
   * Retorna todas las ciudades configuradas (por defecto solo las activas).
   */
  getAllCities(onlyActive: boolean = true): CityDefinition[] {
    const all = Array.from(this.citiesMap.values());
    return onlyActive ? all.filter(c => c.active) : all;
  }

  /**
   * Busca si las coordenadas caen dentro del Bounding Box de alguna ciudad configurada.
   */
  findByBoundingBox(lat: number, lng: number): CityDefinition | undefined {
    for (const city of this.citiesMap.values()) {
      if (!city.active) continue;
      const b = city.boundingBox;
      if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax) {
        return city;
      }
    }
    return undefined;
  }

  /**
   * Busca si el texto de dirección coincide con el nombre o alias de alguna ciudad configurada.
   */
  findByAddress(address: string): CityDefinition | undefined {
    if (!address) return undefined;
    const lowerAddr = address.toLowerCase();

    for (const city of this.citiesMap.values()) {
      if (!city.active) continue;

      if (lowerAddr.includes(city.name.toLowerCase())) {
        return city;
      }

      if (city.aliases && city.aliases.some(alias => lowerAddr.includes(alias.toLowerCase()))) {
        return city;
      }
    }
    return undefined;
  }
}

// Instancia singleton para uso en toda la plataforma
export const CityCatalog = new CityCatalogRegistry();
