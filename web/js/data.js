/**
 * FleetPulse - Mock Fleet Data & Predefined City Routes
 */

const INITIAL_FLEET = [
  {
    id: "CAM-101",
    plate: "ABC-101",
    name: "Camión Kenworth T680",
    type: "truck", // truck, van, sedan
    status: "active", // active, idle, alert, offline
    driver: {
      name: "Carlos Mendoza",
      phone: "+51 987 123 456",
      rating: 4.9,
      avatar: "CM"
    },
    telemetry: {
      lat: -12.046374,
      lng: -77.042793,
      speed: 48,
      heading: 90,
      fuel: 82,
      battery: 98,
      temp: 88,
      odometer: 142580,
      signal: 95
    },
    route: [
      [-12.046374, -77.042793], // Plaza Mayor de Lima
      [-12.052000, -77.038000], // Av. Abancay
      [-12.070000, -77.032000], // Av. Arequipa - Lince
      [-12.090000, -77.028000], // Av. Arequipa - San Isidro
      [-12.098000, -77.025000], // Óvalo Gutiérrez
      [-12.108000, -77.022000]  // El Olivar, San Isidro
    ],
    routeIndex: 0,
    history: []
  },
  {
    id: "VAN-204",
    plate: "DEF-204",
    name: "Van Mercedes Sprinter",
    type: "van",
    status: "active",
    driver: {
      name: "Sofía Ramírez",
      phone: "+51 998 765 432",
      rating: 4.8,
      avatar: "SR"
    },
    telemetry: {
      lat: -12.108000,
      lng: -77.022000,
      speed: 35,
      heading: 180,
      fuel: 64,
      battery: 94,
      temp: 85,
      odometer: 68400,
      signal: 90
    },
    route: [
      [-12.108000, -77.022000], // El Olivar, San Isidro
      [-12.115000, -77.028000], // Vía Expresa
      [-12.121100, -77.029500], // Parque Kennedy, Miraflores
      [-12.140000, -77.023000]  // Malecón hacia Barranco
    ],
    routeIndex: 0,
    history: []
  },
  {
    id: "CAM-105",
    plate: "GHI-105",
    name: "Tráiler Freightliner",
    type: "truck",
    status: "alert",
    driver: {
      name: "Miguel Hernández",
      phone: "+51 955 512 120",
      rating: 4.5,
      avatar: "MH"
    },
    telemetry: {
      lat: -12.021900,
      lng: -77.114300,
      speed: 85, // Excess speed alert trigger
      heading: 45,
      fuel: 22, // Low fuel alert trigger
      battery: 88,
      temp: 99, // Engine temp warning
      odometer: 210940,
      signal: 70
    },
    route: [
      [-12.021900, -77.114300], // Aeropuerto Jorge Chávez, Callao
      [-12.030000, -77.100000], // Av. Faucett
      [-12.040000, -77.090000]  // Av. Faucett hacia Lima
    ],
    routeIndex: 0,
    history: []
  },
  {
    id: "SED-302",
    plate: "JKL-302",
    name: "Nissan Versa Ejecutivo",
    type: "sedan",
    status: "idle",
    driver: {
      name: "Ana Lucía Torres",
      phone: "+51 999 988 887",
      rating: 5.0,
      avatar: "AT"
    },
    telemetry: {
      lat: -12.098000,
      lng: -77.025000,
      speed: 0,
      heading: 0,
      fuel: 90,
      battery: 100,
      temp: 82,
      odometer: 32100,
      signal: 99
    },
    route: [
      [-12.098000, -77.025000], // Óvalo Gutiérrez, San Isidro
      [-12.098500, -77.025500]
    ],
    routeIndex: 0,
    history: []
  },
  {
    id: "VAN-208",
    plate: "MNO-208",
    name: "Ford Transit Cargo",
    type: "van",
    status: "offline",
    driver: {
      name: "Javier Ortiz",
      phone: "+51 944 443 332",
      rating: 4.6,
      avatar: "JO"
    },
    telemetry: {
      lat: -12.080000,
      lng: -76.940000,
      speed: 0,
      heading: 270,
      fuel: 45,
      battery: 0,
      temp: 20,
      odometer: 95400,
      signal: 0
    },
    route: [
      [-12.080000, -76.940000] // La Molina
    ],
    routeIndex: 0,
    history: []
  }
];

const INITIAL_GEOFENCES = [
  {
    id: "geo-1",
    name: "Centro Logístico Callao",
    type: "depot",
    lat: -12.021900,
    lng: -77.114300,
    radius: 500, // meters
    color: "#3b82f6"
  },
  {
    id: "geo-2",
    name: "Almacén Central San Isidro",
    type: "client",
    lat: -12.098000,
    lng: -77.025000,
    radius: 350,
    color: "#10b981"
  },
  {
    id: "geo-3",
    name: "Zona Restringida Costa Verde",
    type: "restricted",
    lat: -12.149400,
    lng: -77.020800,
    radius: 600,
    color: "#ef4444"
  }
];
