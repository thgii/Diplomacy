export const territories = {
  // England
  'LON': { name: 'London', type: 'coast', supply_center: true, initial_owner: 'England', x: 31, y: 50 },
  'LVP': { name: 'Liverpool', type: 'coast', supply_center: true, initial_owner: 'England', x: 28.5, y: 43 },
  'EDI': { name: 'Edinburgh', type: 'coast', supply_center: true, initial_owner: 'England', x: 30.5, y: 37 },
  'CLY': { name: 'Clyde', type: 'coast', x: 27, y: 37 },
  'YOR': { name: 'Yorkshire', type: 'coast', x: 31, y: 43 },
  'WAL': { name: 'Wales', type: 'coast', x: 27, y: 48 },
  // France
  'PAR': { name: 'Paris', type: 'land', supply_center: true, initial_owner: 'France', x: 31.5, y: 61 },
  'MAR': { name: 'Marseilles', type: 'coast', supply_center: true, initial_owner: 'France', x: 35, y: 71 },
  'BRE': { name: 'Brest', type: 'coast', supply_center: true, initial_owner: 'France', x: 27, y: 60 },
  'BUR': { name: 'Burgundy', type: 'land', x: 35, y: 63 },
  'GAS': { name: 'Gascony', type: 'coast', x: 28.5, y: 68 },
  'PIC': { name: 'Picardy', type: 'coast', x: 32, y: 56.5 },
  // Germany
  'BER': { name: 'Berlin', type: 'coast', supply_center: true, initial_owner: 'Germany', x: 49, y: 51 },
  'MUN': { name: 'Munich', type: 'land', supply_center: true, initial_owner: 'Germany', x: 44, y: 61 },
  'KIE': { name: 'Kiel', type: 'coast', supply_center: true, initial_owner: 'Germany', x: 44, y: 51 },
  'RUH': { name: 'Ruhr', type: 'land', x: 41, y: 56.5 },
  'PRU': { name: 'Prussia', type: 'coast', x: 54, y: 50 },
  'SIL': { name: 'Silesia', type: 'land', x: 53, y: 55 },
  // Italy
  'ROM': { name: 'Rome', type: 'coast', supply_center: true, initial_owner: 'Italy', x: 47, y: 81 },
  'NAP': { name: 'Naples', type: 'coast', supply_center: true, initial_owner: 'Italy', x: 52, y: 88 },
  'VEN': { name: 'Venice', type: 'coast', supply_center: true, initial_owner: 'Italy', x: 45, y: 72 },
  'PIE': { name: 'Piedmont', type: 'coast', x: 40, y: 71 },
  'TUS': { name: 'Tuscany', type: 'coast', x: 44, y: 76 },
  'APU': { name: 'Apulia', type: 'coast', x: 51, y: 82 },
  // Austria-Hungary
  'VIE': { name: 'Vienna', type: 'land', supply_center: true, initial_owner: 'Austria-Hungary', x: 54, y: 63 },
  'BUD': { name: 'Budapest', type: 'land', supply_center: true, initial_owner: 'Austria-Hungary', x: 61, y: 66 },
  'TRI': { name: 'Trieste', type: 'coast', supply_center: true, initial_owner: 'Austria-Hungary', x: 54, y: 72 },
  'BOH': { name: 'Bohemia', type: 'land', x: 51, y: 59.5 },
  'GAL': { name: 'Galicia', type: 'land', x: 62, y: 60 },
  'TYR': { name: 'Tyrolia', type: 'land', x: 48, y: 66 },
  // Russia
  'MOS': { name: 'Moscow', type: 'land', supply_center: true, initial_owner: 'Russia', x: 80, y: 42 },
  'STP': { name: 'St Petersburg', type: 'coast', supply_center: true, initial_owner: 'Russia', x: 82, y: 25, parent_territory: 'STP' },
  'STP/nc': { name: 'St Petersburg (North Coast)', type: 'fleet_coast', x: 77, y: 18, parent_territory: 'STP' },
  'STP/sc': { name: 'St Petersburg (South Coast)', type: 'fleet_coast', x: 66, y: 33, parent_territory: 'STP' },
  'WAR': { name: 'Warsaw', type: 'land', supply_center: true, initial_owner: 'Russia', x: 60, y: 54 },
  'SEV': { name: 'Sevastopol', type: 'coast', supply_center: true, initial_owner: 'Russia', x: 88, y: 58 },
  'FIN': { name: 'Finland', type: 'coast', x: 66, y: 23 },
  'LIV': { name: 'Livonia', type: 'coast', x: 64, y: 44.5 },
  'UKR': { name: 'Ukraine', type: 'land', x: 71, y: 59 },
  // Turkey
  'CON': { name: 'Constantinople', type: 'coast', supply_center: true, initial_owner: 'Turkey', x: 73, y: 85 },
  'ANK': { name: 'Ankara', type: 'coast', supply_center: true, initial_owner: 'Turkey', x: 82.5, y: 83.5 },
  'SMY': { name: 'Smyrna', type: 'coast', supply_center: true, initial_owner: 'Turkey', x: 80, y: 90 },
  'ARM': { name: 'Armenia', type: 'coast', x: 94.5, y: 84 },
  'SYR': { name: 'Syria', type: 'coast', x: 93, y: 89 },
  // Neutrals - adjusting positions relative to Russia
  'SWE': { name: 'Sweden', type: 'coast', supply_center: true, x: 52, y: 35 },
  'NOR': { name: 'Norway', type: 'coast', supply_center: true, x: 47, y: 27 },
  'DEN': { name: 'Denmark', type: 'coast', supply_center: true, x: 45, y: 41 },
  'HOL': { name: 'Holland', type: 'coast', supply_center: true, x: 38, y: 52 },
  'BEL': { name: 'Belgium', type: 'coast', supply_center: true, x: 36, y: 55 },
  'SPA': { name: 'Spain', type: 'coast', supply_center: true, x: 19, y: 78, parent_territory: 'SPA' },
  'SPA/nc': { name: 'Spain (North Coast)', type: 'fleet_coast', x: 20, y: 70, parent_territory: 'SPA' },
  'SPA/sc': { name: 'Spain (South Coast)', type: 'fleet_coast', x: 20, y: 86, parent_territory: 'SPA' },
  'POR': { name: 'Portugal', type: 'coast', supply_center: true, x: 10, y: 80 },
  'NAF': { name: 'North Africa', type: 'coast', x: 25, y: 95 },
  'TUN': { name: 'Tunisia', type: 'coast', supply_center: true, x: 39, y: 96 },
  'RUM': { name: 'Rumania', type: 'coast', supply_center: true, x: 70, y: 71 },
  'SER': { name: 'Serbia', type: 'land', supply_center: true, x: 61, y: 78 },
  'BUL': { name: 'Bulgaria', type: 'coast', supply_center: true, x: 66, y: 79, parent_territory: 'BUL' },
  'BUL/ec': { name: 'Bulgaria (East Coast)', type: 'fleet_coast', x: 71, y: 78, parent_territory: 'BUL' },
  'BUL/sc': { name: 'Bulgaria (South Coast)', type: 'fleet_coast', x: 67, y: 82, parent_territory: 'BUL' },
  'GRE': { name: 'Greece', type: 'coast', supply_center: true, x: 61.5, y: 87 },
  'ALB': { name: 'Albania', type: 'coast', x: 58, y: 84 },
  // Water territories - adjusting positions based on land territory locations
  'NTH': { name: 'North Sea', type: 'sea', x: 38, y: 35 },
  'ENG': { name: 'English Channel', type: 'sea', x: 25, y: 54 },
  'IRI': { name: 'Irish Sea', type: 'sea', x: 21, y: 48 },
  'MAO': { name: 'Mid-Atlantic Ocean', type: 'sea', x: 7, y: 65 },
  'NAO': { name: 'North Atlantic Ocean', type: 'sea', x: 12, y: 30 },
  'NWG': { name: 'Norwegian Sea', type: 'sea', x: 42, y: 10 },
  'BAR': { name: 'Barents Sea', type: 'sea', x: 75, y: 5 },
  'HEL': { name: 'Heligoland Bight', type: 'sea', x: 41, y: 45 },
  'SKA': { name: 'Skagerrak', type: 'sea', x: 46, y: 36 },
  'BAL': { name: 'Baltic Sea', type: 'sea', x: 55, y: 44 },
  'BOT': { name: 'Gulf of Bothnia', type: 'sea', x: 58, y: 35 },
  'WES': { name: 'Western Mediterranean', type: 'sea', x: 30, y: 87 },
  'GOL': { name: 'Gulf of Lyon', type: 'sea', x: 33, y: 79 },
  'TYS': { name: 'Tyrrhenian Sea', type: 'sea', x: 43, y: 87 },
  'ION': { name: 'Ionian Sea', type: 'sea', x: 55, y: 92 },
  'ADR': { name: 'Adriatic Sea', type: 'sea', x: 51, y: 77 },
  'AEG': { name: 'Aegean Sea', type: 'sea', x: 68, y: 88 },
  'EAS': { name: 'Eastern Mediterranean', type: 'sea', x: 75, y: 97 },
  'BLA': { name: 'Black Sea', type: 'sea', x: 82, y: 75 },
};

// Helper function to get country colors (consistent with other components)
export const getCountryColor = (country) => {
  const colors = {
    "Austria-Hungary": "#8B4513", // brown
    "England": "#6f00ff", // dark purple
    "France": "#87ceeb", // light blue
    "Germany": "#333333", // dark gray
    "Italy": "#22c55e", // green
    "Russia": "#d1d5db", // light gray
    "Turkey": "#eab308" // yellow
  };
  return colors[country] || "#6c757d";
};

// Country colors object for easy access
export const countryColors = {
  "Austria-Hungary": "#8B4513", // brown
  "England": "#6f00ff", // dark purple
  "France": "#87ceeb", // light blue
  "Germany": "#333333", // dark gray
  "Italy": "#22c55e", // green
  "Russia": "#d1d5db", // light gray
  "Turkey": "#eab308" // yellow
};

export const adjacencies = {
  'ADR': [{ to: 'ALB', naval: true }, { to: 'APU', naval: true }, { to: 'ION', naval: true }, { to: 'TRI', naval: true }, { to: 'VEN', naval: true }],
  'AEG': [{ to: 'BUL/sc', naval: true }, { to: 'CON', naval: true }, { to: 'EAS', naval: true }, { to: 'GRE', naval: true }, { to: 'ION', naval: true }, { to: 'SMY', naval: true }],
  'ALB': [{ to: 'ADR', naval: true }, { to: 'GRE' }, { to: 'GRE', naval: true }, { to: 'ION', naval: true }, { to: 'SER' }, { to: 'TRI' }, { to: 'TRI', naval: true }],
  'ANK': [{ to: 'ARM' }, { to: 'ARM', naval: true }, { to: 'BLA', naval: true }, { to: 'CON' }, { to: 'SMY' }, { to: 'CON', naval: true }],
  'APU': [{ to: 'ADR', naval: true }, { to: 'ION', naval: true }, { to: 'NAP' }, { to: 'NAP', naval: true }, { to: 'ROM' }, { to: 'VEN' }, { to: 'VEN', naval: true }],
  'ARM': [{ to: 'ANK' }, { to: 'ANK', naval: true }, { to: 'BLA', naval: true }, { to: 'SEV', naval: true }, { to: 'SEV' }, { to: 'SMY' }, { to: 'SYR' }],
  'BAL': [{ to: 'BER', naval: true }, { to: 'BOT', naval: true }, { to: 'DEN', naval: true }, { to: 'KIE', naval: true }, { to: 'LIV', naval: true }, { to: 'PRU', naval: true }, { to: 'SWE', naval: true }],
  'BAR': [{ to: 'NWG', naval: true }, { to: 'STP/nc', naval: true }, { to: 'NOR', naval: true }],
  'BEL': [{ to: 'BUR' }, { to: 'ENG', naval: true }, { to: 'HOL' }, { to: 'HOL', naval: true }, { to: 'NTH', naval: true }, { to: 'PIC' }, { to: 'PIC', naval: true }, { to: 'RUH' }],
  'BER': [{ to: 'BAL', naval: true }, { to: 'KIE' }, { to: 'MUN' }, { to: 'PRU' }, { to: 'SIL' }],
  'BLA': [{ to: 'ANK', naval: true }, { to: 'ARM', naval: true }, { to: 'BUL/ec', naval: true }, { to: 'CON', naval: true }, { to: 'RUM', naval: true }, { to: 'SEV', naval: true }],
  'BOH': [{ to: 'GAL' }, { to: 'MUN' }, { to: 'SIL' }, { to: 'TYR' }, { to: 'VIE' }],
  'BOT': [{ to: 'BAL', naval: true }, { to: 'FIN', naval: true }, { to: 'LIV', naval: true }, { to: 'STP/sc', naval: true }, { to: 'SWE', naval: true }],
  'BRE': [{ to: 'ENG', naval: true }, { to: 'GAS' }, { to: 'GAS', naval: true }, { to: 'MAO', naval: true }, { to: 'PAR' }, { to: 'PIC' }, { to: 'PIC', naval: true }],
  'BUD': [{ to: 'GAL' }, { to: 'RUM' }, { to: 'SER' }, { to: 'TRI' }, { to: 'VIE' }],
  'BUL': [{ to: 'CON' }, { to: 'GRE' }, { to: 'RUM' }, { to: 'SER' }, { to: 'BUL/ec', naval: true }, { to: 'BUL/sc', naval: true }, ],
  'BUL/ec': [{ to: 'BLA', naval: true }, { to: 'CON', naval: true }, { to: 'RUM', naval: true }],
  'BUL/sc': [{ to: 'AEG', naval: true }, { to: 'CON', naval: true }, { to: 'GRE', naval: true }],
  'BUR': [{ to: 'BEL' }, { to: 'GAS' }, { to: 'MAR' }, { to: 'MUN' }, { to: 'PAR' }, { to: 'PIC' }, { to: 'RUH' }],
  'CLY': [{ to: 'EDI' }, { to: 'LVP' }, { to: 'NAO', naval: true }, { to: 'NWG', naval: true }],
  'CON': [{ to: 'AEG', naval: true }, { to: 'ANK' }, { to: 'ANK', naval: true }, { to: 'BLA', naval: true }, { to: 'BUL' }, { to: 'SMY' }, { to: 'SMY', naval: true }, { to: 'BUL/ec', naval: true }, { to: 'BUL/sc', naval: true } ],
  'DEN': [{ to: 'BAL', naval: true }, { to: 'HEL', naval: true }, { to: 'KIE' }, { to: 'NTH', naval: true }, { to: 'SKA', naval: true }, { to: 'SWE' }, { to: 'SWE', naval: true }],
  'EAS': [{ to: 'AEG', naval: true }, { to: 'ION', naval: true }, { to: 'SMY', naval: true }, { to: 'SYR', naval: true }],
  'EDI': [{ to: 'CLY' }, { to: 'LVP' }, { to: 'NTH', naval: true }, { to: 'NWG', naval: true }, { to: 'YOR' }, { to: 'YOR', naval: true }],
  'ENG': [{ to: 'BEL', naval: true }, { to: 'BRE', naval: true }, { to: 'IRI', naval: true }, { to: 'LON', naval: true }, { to: 'MAO', naval: true }, { to: 'NTH', naval: true }, { to: 'PIC', naval: true }, { to: 'WAL', naval: true }],
  'FIN': [{ to: 'BOT', naval: true }, { to: 'NOR' }, { to: 'STP' }, { to: 'SWE' }, { to: 'SWE', naval: true }, { to: 'STP/sc', naval: true }],
  'GAL': [{ to: 'BOH' }, { to: 'BUD' }, { to: 'RUM' }, { to: 'SIL' }, { to: 'UKR' }, { to: 'VIE' }, { to: 'WAR' }],
  'GAS': [{ to: 'BRE' }, { to: 'BRE', naval: true }, { to: 'BUR' }, { to: 'MAR' }, { to: 'PAR' }, { to: 'SPA' }, { to: 'SPA/nc', naval: true }],
  'GOL': [{ to: 'MAR', naval: true }, { to: 'PIE', naval: true }, { to: 'SPA/sc', naval: true }, { to: 'TUS', naval: true }, { to: 'TYS', naval: true }, { to: 'WES', naval: true }],
  'GRE': [{ to: 'AEG', naval: true }, { to: 'ALB' }, { to: 'ALB', naval: true }, { to: 'BUL' }, { to: 'BUL/sc', naval: true }, { to: 'ION', naval: true }, { to: 'SER' }],
  'HEL': [{ to: 'DEN', naval: true }, { to: 'HOL', naval: true }, { to: 'KIE', naval: true }, { to: 'NTH', naval: true }],
  'HOL': [{ to: 'BEL' }, { to: 'BEL', naval: true }, { to: 'HEL', naval: true }, { to: 'KIE' }, { to: 'KIE', naval: true }, { to: 'NTH', naval: true }, { to: 'RUH' }],
  'ION': [{ to: 'ADR', naval: true }, { to: 'AEG', naval: true }, { to: 'ALB', naval: true }, { to: 'APU', naval: true }, { to: 'EAS', naval: true }, { to: 'GRE', naval: true }, { to: 'NAP', naval: true }, { to: 'TYS', naval: true }, { to: 'TUN', naval: true }],
  'IRI': [{ to: 'ENG', naval: true }, { to: 'LVP', naval: true }, { to: 'MAO', naval: true }, { to: 'NAO', naval: true }, { to: 'WAL', naval: true }],
  'KIE': [{ to: 'BAL', naval: true }, { to: 'BER' }, { to: 'DEN' }, { to: 'DEN', naval: true }, { to: 'HEL', naval: true }, { to: 'HOL' }, { to: 'HOL', naval: true }, { to: 'MUN' }, { to: 'RUH' }],
  'LIV': [{ to: 'BAL', naval: true }, { to: 'BOT', naval: true }, { to: 'MOS' }, { to: 'PRU' }, { to: 'STP' }, { to: 'WAR' }, { to: 'STP/sc', naval: true }],
  'LON': [{ to: 'ENG', naval: true }, { to: 'NTH', naval: true }, { to: 'WAL' }, { to: 'YOR' }, { to: 'YOR', naval: true }],
  'LVP': [{ to: 'CLY' }, { to: 'EDI' }, { to: 'IRI', naval: true }, { to: 'NAO', naval: true }, { to: 'WAL' }, { to: 'YOR' }],
  'MAO': [{ to: 'SPA/sc', naval: true }, { to: 'BRE', naval: true }, { to: 'ENG', naval: true }, { to: 'GAS', naval: true }, { to: 'IRI', naval: true }, { to: 'NAO', naval: true }, { to: 'POR', naval: true }, { to: 'SPA/nc', naval: true }, { to: 'WES', naval: true }, { to: 'NAF', naval: true }],
  'MAR': [{ to: 'BUR' }, { to: 'GAS' }, { to: 'GOL', naval: true }, { to: 'PIE' }, { to: 'PIE', naval: true }, { to: 'SPA' }],
  'MOS': [{ to: 'LIV' }, { to: 'SEV' }, { to: 'STP' }, { to: 'UKR' }, { to: 'WAR' }],
  'MUN': [{ to: 'BER' }, { to: 'BOH' }, { to: 'BUR' }, { to: 'KIE' }, { to: 'RUH' }, { to: 'SIL' }, { to: 'TYR' }],
  'NAF': [{ to: 'MAO', naval: true }, { to: 'WES', naval: true }, { to: 'TUN' }],
  'NAO': [{ to: 'CLY', naval: true }, { to: 'IRI', naval: true }, { to: 'LVP', naval: true }, { to: 'MAO', naval: true }, { to: 'NWG', naval: true }],
  'NAP': [{ to: 'APU' }, { to: 'APU', naval: true }, { to: 'ION', naval: true }, { to: 'ROM' }, { to: 'ROM', naval: true }, { to: 'TYS', naval: true }],
  'NOR': [{ to: 'BAR', naval: true }, { to: 'FIN' }, { to: 'NTH', naval: true }, { to: 'NWG', naval: true }, { to: 'SKA', naval: true }, { to: 'SWE' }, { to: 'SWE', naval: true }, { to: 'STP/nc', naval: true }, { to: 'STP' }],
  'NTH': [{ to: 'BEL', naval: true }, { to: 'DEN', naval: true }, { to: 'EDI', naval: true }, { to: 'ENG', naval: true }, { to: 'HEL', naval: true }, { to: 'HOL', naval: true }, { to: 'LON', naval: true }, { to: 'NOR', naval: true }, { to: 'NWG', naval: true }, { to: 'SKA', naval: true }, { to: 'YOR', naval: true }],
  'NWG': [{ to: 'BAR', naval: true }, { to: 'CLY', naval: true }, { to: 'EDI', naval: true }, { to: 'NAO', naval: true }, { to: 'NOR', naval: true }, { to: 'NTH', naval: true }],
  'PAR': [{ to: 'BRE' }, { to: 'BUR' }, { to: 'GAS' }, { to: 'PIC' }],
  'PIC': [{ to: 'BEL' }, { to: 'BRE' }, { to: 'BEL', naval: true }, { to: 'BRE', naval: true }, { to: 'BUR' }, { to: 'ENG', naval: true }, { to: 'PAR' }],
  'PIE': [{ to: 'GOL', naval: true }, { to: 'MAR' }, { to: 'MAR', naval: true }, { to: 'TUS' }, { to: 'TUS', naval: true }, { to: 'TYR' }, { to: 'VEN' }],
  'POR': [{ to: 'MAO', naval: true }, { to: 'SPA' }, { to: 'SPA/nc', naval: true }, { to: 'SPA/sc', naval: true }],
  'PRU': [{ to: 'BAL', naval: true }, { to: 'BER' }, { to: 'LIV' }, { to: 'SIL' }, { to: 'WAR' }],
  'ROM': [{ to: 'APU' }, { to: 'NAP' }, { to: 'NAP', naval: true }, { to: 'TUS' }, { to: 'TUS', naval: true }, { to: 'TYS', naval: true }, { to: 'VEN' }],
  'RUH': [{ to: 'BEL' }, { to: 'BUR' }, { to: 'HOL' }, { to: 'KIE' }, { to: 'MUN' }],
  'RUM': [{ to: 'BLA', naval: true }, { to: 'BUD' }, { to: 'BUL' }, { to: 'BUL/ec', naval: true }, { to: 'GAL' }, { to: 'SER' }, { to: 'SEV' }, { to: 'SEV', naval: true }, { to: 'UKR' }],
  'SER': [{ to: 'ALB' }, { to: 'BUD' }, { to: 'BUL' }, { to: 'GRE' }, { to: 'RUM' }, { to: 'TRI' }],
  'SEV': [{ to: 'ARM', naval: true }, { to: 'ARM' }, { to: 'BLA', naval: true }, { to: 'MOS' }, { to: 'RUM' }, { to: 'RUM', naval: true }, { to: 'UKR' }],
  'SIL': [{ to: 'BER' }, { to: 'BOH' }, { to: 'GAL' }, { to: 'MUN' }, { to: 'PRU' }, { to: 'WAR' }],
  'SKA': [{ to: 'DEN', naval: true }, { to: 'NOR', naval: true }, { to: 'NTH', naval: true }, { to: 'SWE', naval: true }],
  'SMY': [{ to: 'AEG', naval: true }, { to: 'ANK' }, { to: 'ARM' }, { to: 'CON' }, { to: 'CON', naval: true }, { to: 'EAS', naval: true }, { to: 'SYR' }, { to: 'SYR', naval: true }],
  'SPA': [{ to: 'GAS' }, { to: 'MAR' }, { to: 'POR' }, { to: 'SPA/nc', naval: true }, { to: 'SPA/sc', naval: true }, ],
  'SPA/nc': [{ to: 'GAS', naval: true }, { to: 'MAO', naval: true }, { to: 'POR', naval: true }],
  'SPA/sc': [{ to: 'GOL', naval: true }, { to: 'MAO', naval: true }, { to: 'POR', naval: true }, { to: 'WES', naval: true }],
  'STP': [{ to: 'FIN' }, { to: 'LIV' }, { to: 'MOS' }, { to: 'NOR' }, { to: 'STP/nc', naval: true }, { to: 'STP/sc', naval: true },],
  'STP/nc': [{ to: 'BAR', naval: true }, { to: 'NOR', naval: true }],
  'STP/sc': [{ to: 'BOT', naval: true }, { to: 'FIN', naval: true }, { to: 'LIV', naval: true }],
  'SWE': [{ to: 'BAL', naval: true }, { to: 'BOT', naval: true }, { to: 'DEN' }, { to: 'DEN', naval: true }, { to: 'FIN' }, { to: 'FIN', naval: true }, { to: 'NOR' }, { to: 'NOR', naval: true }, { to: 'SKA', naval: true }],
  'SYR': [{ to: 'ARM' }, { to: 'EAS', naval: true }, { to: 'SMY' }, { to: 'SMY', naval: true }],
  'TRI': [{ to: 'ADR', naval: true }, { to: 'ALB' }, { to: 'ALB', naval: true }, { to: 'BUD' }, { to: 'SER' }, { to: 'TYR' } ,{ to: 'VEN' }, { to: 'VEN', naval: true }, { to: 'VIE' }],
  'TUN': [{ to: 'ION', naval: true }, { to: 'NAF' }, { to: 'TYS', naval: true }, { to: 'WES', naval: true }],
  'TUS': [{ to: 'GOL', naval: true }, { to: 'VEN' }, { to: 'PIE' }, { to: 'PIE', naval: true }, { to: 'ROM' }, { to: 'ROM', naval: true }, { to: 'TYS', naval: true }],
  'TYR': [{ to: 'BOH' }, { to: 'MUN' }, { to: 'PIE' }, { to: 'TRI' }, { to: 'VEN' }, { to: 'VIE' }],
  'TYS': [{ to: 'GOL', naval: true }, { to: 'ION', naval: true }, { to: 'NAP', naval: true }, { to: 'ROM', naval: true }, { to: 'TUN', naval: true }, { to: 'TUS', naval: true }, { to: 'WES', naval: true }],
  'UKR': [{ to: 'GAL' }, { to: 'MOS' }, { to: 'RUM' }, { to: 'SEV' }, { to: 'WAR' }],
  'VEN': [{ to: 'ADR', naval: true }, { to: 'APU' }, { to: 'APU', naval: true }, { to: 'PIE' }, { to: 'ROM' }, { to: 'TRI' }, { to: 'TRI', naval: true }, { to: 'TYR' }],
  'VIE': [{ to: 'BOH' }, { to: 'BUD' }, { to: 'GAL' }, { to: 'TRI' }, { to: 'TYR' }],
  'WAL': [{ to: 'ENG', naval: true }, { to: 'IRI', naval: true }, { to: 'LON' }, { to: 'LVP' }, { to: 'YOR' }],
  'WAR': [{ to: 'GAL' }, { to: 'LIV' }, { to: 'MOS' }, { to: 'PRU' }, { to: 'SIL' }, { to: 'UKR' }],
  'WES': [{ to: 'GOL', naval: true }, { to: 'MAO', naval: true }, { to: 'NAF', naval: true }, { to: 'SPA/sc', naval: true }, { to: 'TUN', naval: true }, { to: 'TYS', naval: true }],
  'YOR': [{ to: 'EDI' }, { to: 'LON' }, { to: 'LVP' }, { to: 'NTH', naval: true }, { to: 'WAL' }],
};

export const initialUnits = {
  'England': [{ type: 'army', territory: 'LVP' }, { type: 'navy', territory: 'LON' }, { type: 'navy', territory: 'EDI' }],
  'France': [{ type: 'army', territory: 'PAR' }, { type: 'army', territory: 'MAR' }, { type: 'navy', territory: 'BRE' }],
  'Germany': [{ type: 'army', territory: 'BER' }, { type: 'army', territory: 'MUN' }, { type: 'navy', territory: 'KIE' }],
  'Italy': [{ type: 'army', territory: 'ROM' }, { type: 'army', territory: 'VEN' }, { type: 'navy', territory: 'NAP' }],
  'Austria-Hungary': [{ type: 'army', territory: 'VIE' }, { type: 'army', territory: 'BUD' }, { type: 'navy', territory: 'TRI' }],
  'Russia': [{ type: 'army', territory: 'MOS' }, { type: 'army', territory: 'WAR' }, { type: 'navy', territory: 'STP/sc' }, { type: 'navy', territory: 'SEV' }],
  'Turkey': [{ type: 'army', territory: 'CON' }, { type: 'navy', territory: 'ANK' }, { type: 'army', territory: 'SMY' }],
};

export const homeSupplyCenters = {
  'England': ['LON', 'LVP', 'EDI'],
  'France': ['PAR', 'MAR', 'BRE'],
  'Germany': ['BER', 'MUN', 'KIE'],
  'Italy': ['ROM', 'VEN', 'NAP'],
  'Austria-Hungary': ['VIE', 'BUD', 'TRI'],
  'Russia': ['MOS', 'WAR', 'STP', 'SEV'],
  'Turkey': ['CON', 'ANK', 'SMY'],
};

// List of powers to assign at game start (single source of truth)
export const allPowers = (() => {
  if (homeSupplyCenters && typeof homeSupplyCenters === "object") {
    return Object.keys(homeSupplyCenters);
  }
  if (initialUnits && typeof initialUnits === "object") {
    return Object.keys(initialUnits);
  }
  // Fallback
  return ["England", "France", "Germany", "Italy", "Austria-Hungary", "Russia", "Turkey"];
})();


// Helper function to get initial supply center ownership
export const getInitialSupplyCenters = () => {
  const supplyCenters = {};
  Object.entries(territories).forEach(([terrId, terrData]) => {
    if (terrData.supply_center && terrData.initial_owner) {
      supplyCenters[terrId] = terrData.initial_owner;
    }
  });
  return supplyCenters;
};

// Helper function to get the base territory name (removes coast designations)
export const getBaseTerritory = (territoryId) => {
  if (typeof territoryId !== "string" || !territoryId) return territoryId || null;
  if (territoryId.includes('/')) return territoryId.split('/')[0];
  return territoryId;
};


// Helper function to check if territories are the same base territory
export const isSameBaseTerritory = (territoryId1, territoryId2) => {
  return getBaseTerritory(territoryId1) === getBaseTerritory(territoryId2);
};

// Helper function to check if a supporting unit can support a move to a target territory
// This handles split coasts properly
export const canSupportMoveToTerritory = (supportingUnitMoves, targetTerritory) => {
  const targetBase = getBaseTerritory(targetTerritory);
  
  return supportingUnitMoves.some(move => {
    const moveBase = getBaseTerritory(move);
    return moveBase === targetBase;
  });
};

// Helper function to check if a unit can move to a territory
export const canUnitMoveToTerritory = (unitType, targetTerritory) => {
  const targetTerr = territories[targetTerritory];
  if (!targetTerr) return false;

  if (unitType === 'army') {
    // Armies can move to land or coastal territories, but not sea zones or fleet coasts
    return targetTerr.type === 'land' || targetTerr.type === 'coast';
  } else if (unitType === 'navy') {
    // Navies can only move to sea zones, coastal territories, or fleet coasts
    return targetTerr.type === 'sea' || targetTerr.type === 'coast' || targetTerr.type === 'fleet_coast';
  }

  return false;
};

// Helper function to validate unit placement (no two units in same base territory)
export const isValidUnitPlacement = (units, newUnitTerritory, excludeUnitId = null) => {
  const baseTerritory = getBaseTerritory(newUnitTerritory);

  return !units.some(unit => {
    if (excludeUnitId && unit.id === excludeUnitId) return false;
    return getBaseTerritory(unit.territory) === baseTerritory;
  });
};

export const getValidMoves = (unitType, fromTerritory) => {
  return getAdjacencies(fromTerritory)
    .filter(adj => {
      // For armies, only allow non-naval adjacencies (land connections)
      if (unitType === 'army') {
        return !adj.naval;
      }
      // For navies, only allow naval adjacencies (sea connections)
      if (unitType === 'navy') {
        return adj.naval;
      }
      return false;
    })
    .map(adj => adj.to);
};

export const getAdjacencies = (terrId) => {
  return adjacencies[terrId] || [];
};


export const findAllConvoyRoutes = (fromTerritory, toTerritory, units, country = null) => {
  // fleets allowed: either specific country OR all countries (country === null)
  const friendlyFleets = units.filter(
    (u) => u.type === "navy" && (country ? u.country === country : true)
  );

  // work in base seas
  const fleetSeaSet = new Set(friendlyFleets.map((f) => getBaseTerritory(f.territory)));

  const from = getBaseTerritory(fromTerritory);
  const targetBase = getBaseTerritory(toTerritory);

  // Seed starting seas: naval adjacencies from the army origin
  const startSeas = [];
  for (const adj of getAdjacencies(from)) {
    if (!adj.naval) continue;
    const t = territories[adj.to];
    if (!t) continue;
    if (t.type === "sea") {
      const sb = getBaseTerritory(adj.to);
      if (fleetSeaSet.has(sb)) startSeas.push(sb);
    } else if (t.type === "fleet_coast") {
      for (const a2 of getAdjacencies(adj.to)) {
        if (!a2.naval) continue;
        if (territories[a2.to]?.type !== "sea") continue;
        const sb = getBaseTerritory(a2.to);
        if (fleetSeaSet.has(sb)) startSeas.push(sb);
      }
    }
  }
  if (startSeas.length === 0) return [];

  // BFS through seas that have fleets
  const q = [...new Set(startSeas)].map((s) => ({ at: s, path: [s] }));
  const seen = new Set(q.map((x) => x.at));
  const routes = [];

  while (q.length) {
    const { at, path } = q.shift();

    // can we touch the destination coasts from here?
    const navAdj = getAdjacencies(at).filter((a) => a.naval);
    const touchesDest = navAdj.some(
      (a) => getBaseTerritory(a.to) === targetBase || a.to.startsWith(`${targetBase}/`)
    );
    if (touchesDest) routes.push(path);

    for (const n of navAdj) {
      const nb = getBaseTerritory(n.to);
      if (territories[n.to]?.type !== "sea") continue;
      if (!fleetSeaSet.has(nb) || seen.has(nb)) continue;
      seen.add(nb);
      q.push({ at: nb, path: [...path, nb] });
    }
  }

  return routes; // UI can draw dots; adjudicator doesn’t rely on these
};
