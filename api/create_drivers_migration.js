// Script to generate driver migration
const drivers = [
  { name: 'Abidur Rahman Choudhury', transporterId: 'AGHT3B6I4H4TN' },
  { name: 'Adam Musa Hamdan', transporterId: 'A1S3S9Q0UVVU59' },
  { name: 'Admire Nkomo', transporterId: 'ATDYGDT3FHZTO' },
  { name: 'Adrian Modrisan', transporterId: 'A12UAMGEOZD80X' },
  { name: 'Akshay Dharman', transporterId: 'A1IXGSAYXPF9CJ' },
  { name: 'Alexei Mereacre', transporterId: 'A2M5K10QH9LYW7' },
  { name: 'Andre Ribeiro Cardoso da Silva', transporterId: 'AHEK85HMOMBQK' },
  { name: 'Andrew James Martin', transporterId: 'A300ZLB9MDP68B' },
  { name: 'Andria Natalie Antrobus', transporterId: 'A1GX3C75T1VO1A' },
  { name: 'Angel Francisco Escobar Gonzalez', transporterId: 'A2MOUJRFNCAQZT' },
  { name: 'Anthony Mthabisi Khanye', transporterId: 'AQPBZCJ16GYCD' },
  { name: 'Arun Issac', transporterId: 'AWYRNK7QODGET' },
  { name: 'Ashley Martin Spring', transporterId: 'AM76OJBXRC3QB' },
  { name: 'Brandon Lovell', transporterId: 'A33BFHS6EJ9ZFN' },
  { name: 'Brian Heather', transporterId: 'AJ5PNUREJRMGF' },
  { name: 'Caleb Mesfin', transporterId: 'A3AMWJIACNYYIE' },
  { name: 'Christopher Bicknell', transporterId: 'A23CSNPS6QBZ56' },
  { name: 'Colin Robert A Weaver', transporterId: 'A30RW5U9378DLS' },
  { name: 'Damian Piotr Byncz', transporterId: 'A1IKBXRF3I7XMQ' },
  { name: 'Daniel Filipe Tavares dos Reis', transporterId: 'A1ZA0AP1TI2F29' },
  { name: 'Daniel Michael Stapley', transporterId: 'A33WTQ9961ESN4' },
  { name: 'Daniel Tadhg Fawell Molloy', transporterId: 'A230QM2WZL7LAH' },
  { name: 'Darcy Simon', transporterId: 'A3E95PNJPSWE27' },
  { name: 'Dean Antony Colwell', transporterId: 'A3MTUVHPPPJHQ3' },
  { name: 'Elliott George Cotton', transporterId: 'AWKATFQRQJ3GH' },
  { name: 'Emmanuel Enkene Odong', transporterId: 'ALR0RK2M0JUKJ' },
  { name: 'Ethan Saava Busenze Balagadde', transporterId: 'A25Q0LX12L2FOX' },
  { name: 'Farayi Muchemenyi', transporterId: 'AOCWCLS3CBZWI' },
  { name: 'George Lawrence Briscoe', transporterId: 'A2015FTHMKGHLF' },
  { name: 'George Paul Bevis', transporterId: 'AGOHDFEDFUT3V' },
  { name: 'Georgina Holly Cook', transporterId: 'A1SADHZAKTGN7M' },
  { name: 'Gerasim Vuliyerys', transporterId: 'A1XG5TWEBBCQ0X' },
  { name: 'Glinto Rapheal', transporterId: 'A6C5I7XBE9JO8' },
  { name: 'Graham Paul Carter', transporterId: 'AS88LXYBJ2749' },
  { name: 'Gregory John Simpson', transporterId: 'AT5VQ2J3RZLRL' },
  { name: 'HOA Minh Chung', transporterId: 'A2QO35WLWWIF09' },
  { name: 'Hadi Elmi', transporterId: 'A1MVPSC8ZSH6M0' },
  { name: 'Hailat Teklezghi', transporterId: 'A2Y6WGMZ3L2VON' },
  { name: 'Harry Peter Chase', transporterId: 'A2R9CTVP2OBERN' },
  { name: 'Heather Marie Longshaw', transporterId: 'A1SYG47UU8X1KG' },
  { name: 'Heet Patel', transporterId: 'A2A192G5DLN53O' },
  { name: 'Immanuel Tamund Tonye Blankson', transporterId: 'A1XS72Z4NFP8K6' },
  { name: 'Jacques Hess', transporterId: 'A1WU461HP65VSF' },
  { name: 'Jake Michael D Dewhirst', transporterId: 'A2VRGXYXJY9EP7' },
  { name: 'James Cook', transporterId: 'A2JX5L807HVEYB' },
  { name: 'James Michael Scutt', transporterId: 'A3IM4V9JOUL0SD' },
  { name: 'James Michael Vincent', transporterId: 'A1K5GB8HTGU3B' },
  { name: 'Jamie Eoin Turner', transporterId: 'A3KCQYCRADS0IA' },
  { name: 'Jamie Joseph Oneill Arriaza', transporterId: 'ARBTGUYCMJRG8' },
  { name: 'Joe Jack Lannon', transporterId: 'A2KLS9TKQYPGUG' },
  { name: 'Joel Keem Ngimbi', transporterId: 'A2IROO2QBZ012N' },
  { name: 'Jonathan Andrew Smith', transporterId: 'A2M145Z4UYK0ZR' },
  { name: 'Joshua Matthew Scott', transporterId: 'A25G70DL1VJ9VT' },
  { name: 'Ka Ho Chan', transporterId: 'A2V1DX0KMAAXE9' },
  { name: 'Kadir Omar D Darwish', transporterId: 'ADOUJQ29G72HL' },
  { name: 'Kane Michael Doolan', transporterId: 'A174OQY34HHDD2' },
  { name: 'Kassim Sserwanja', transporterId: 'AZ2UYTJ159HQ0' },
  { name: 'Kenneth Stephen Hassan', transporterId: 'A19YK89WBEIAZK' },
  { name: 'Kieran moonan', transporterId: 'AP6Y7CRYBPQEF' },
  { name: 'Kisanet Abraham Mehari', transporterId: 'AH8NF9PWRVV2K' },
  { name: 'Lampros Georgopoulos', transporterId: 'A3HCI1D8FM47OY' },
  { name: 'Levi Billy Devlin', transporterId: 'A1ZSL98S0BKE5F' },
  { name: 'Lucas Silva Castro de Albuquerque', transporterId: 'A2LR1X5NQOPUS9' },
  { name: 'Luke Robin Oden Davis', transporterId: 'AQVFYQCHIE3HN' },
  { name: 'Marius Stefan Piriianu', transporterId: 'A1M52W8NTRH050' },
  { name: 'Mark Lakeman', transporterId: 'A2M04FWFJ75N2A' },
  { name: 'Masin Dharvees N Alipparamban', transporterId: 'A2M57JJSKEKKHI' },
  { name: 'Matheus Filipe Gabry Pereira', transporterId: 'A3BST0G7IR2L3T' },
  { name: 'Matthew Donald Cottrell', transporterId: 'A2TVH57TC4L9R1' },
  { name: 'Matthew Scattergood', transporterId: 'A4UGVZ8NYIDFR' },
  { name: 'Michal Dawid Swies', transporterId: 'A2HSE1CHA7XF0Z' },
  { name: 'Mohammed Ashfakus Samad', transporterId: 'A21UQBZ944E14B' },
  { name: 'Mohammed Rahat Ahmed', transporterId: 'A123JCLWS0PVTZ' },
  { name: 'Mohammed Kondengadan', transporterId: 'A3S76LXXOQJUQW' },
  { name: 'Mohammed ambalathuveettil Naushad', transporterId: 'AXUE45QVJJHPM' },
  { name: 'Mr Cyrille Tsi Nji', transporterId: 'A6KKZNRQSWL50' },
  { name: 'Mridhul Manoj Kumar', transporterId: 'A2FNHOQK2P4E2F' },
  { name: 'Muhammed Nihal Parambath', transporterId: 'A319QK8PU2ECX9' },
  { name: 'Munashe Chibinjana', transporterId: 'A16HYCHTI4ODHO' },
  { name: 'Niju Shaju Parakkal', transporterId: 'A35Q2J1TQRCH6U' },
  { name: 'Olgy Francisco Lowa', transporterId: 'A779X8EV859CF' },
  { name: 'Oluwaseun Felix Omisore', transporterId: 'A1FLABK119QVG1' },
  { name: 'Oscar Clifford Hill Perales', transporterId: 'A17WX7S5S0ZK31' },
  { name: 'Osman Hussain Choudhury', transporterId: 'A364EYYP2U7VBX' },
  { name: 'Ousman Moulay Mounde', transporterId: 'A21ZFN2QOVY3N2' },
  { name: 'Padmasree Manoj Kumar Bavikadi', transporterId: 'A3K0L0HZGJ1WVY' },
  { name: 'Raul Francisco Guardiola Moreno', transporterId: 'AZSOEBADJUSHN' },
  { name: 'Richard James Pellow', transporterId: 'ADHYFYHRIRMZC' },
  { name: 'Richard Mufutumari', transporterId: 'A6C3M7T8EETGQ' },
  { name: 'Robert Owen', transporterId: 'A1877BYE89R1J2' },
  { name: 'Robert Scott', transporterId: 'ASVS8I4ZG4A6R' },
  { name: 'Rogers Otieno Opondo', transporterId: 'A6HBQ0ESOWQVE' },
  { name: 'Sajith Thazhatherimbli', transporterId: 'A3BPL7G8K13RKV' },
  { name: 'Salvyn Joshua Kajoba Kisitu', transporterId: 'A1OV92XALAIPLE' },
  { name: 'Satendra Kumar Sharma', transporterId: 'A34LK8RWFWBXR7' },
  { name: 'Sebin Thindiyathil Pothen', transporterId: 'AECW81QYIJAZ3' },
  { name: 'Simon John Pateman', transporterId: 'A1DGSMH00O80PG' },
  { name: 'Steven Dewhirst', transporterId: 'A2XCPM8PONUR' },
  { name: 'Sydul Islam', transporterId: 'A1TMNE1JB2Z9R0' },
  { name: 'Telmo Jose Rodrigues Ferreira', transporterId: 'A1OACQ6QCZDOYH' },
  { name: 'Temitope Oluwaseun Adeoye', transporterId: 'A3H90LBRZSXDEX' },
  { name: 'Tsz Fung So', transporterId: 'A24474ECKBYT04' },
  { name: 'Wai Keung So', transporterId: 'A19P0FRKFD65UO' },
  { name: 'William Hugo R Bibb', transporterId: 'A18KI4A7IOITEC' },
  { name: 'William James R Wrixton', transporterId: 'A1ETGQC14VMBJ2' },
  { name: 'Wojciech Arkadiusz Slomba', transporterId: 'AC2EOWFD535JX' },
  { name: 'Yavuz Kulaberoglu', transporterId: 'A2MTLWB11PPAW3' },
  { name: 'Yusuf Kolawde O Oyeleye', transporterId: 'A2JVJC43O20980' },
  { name: 'Zavon Brendon Blackman', transporterId: 'A8Q00ERJ1KQLI' }
];

function nameToEmail(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(' ')
    .slice(0, 2)
    .join('.')
    + '@triun.co.uk';
}

function pad(num, size) {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

console.log('-- Replace all drivers with new Amazon dataset');
console.log('-- This migration will:');
console.log('-- 1. Clear all existing drivers and their user accounts');
console.log('-- 2. Insert new drivers from Amazon data with corresponding user accounts');
console.log('');
console.log('-- Clear existing drivers and their related user accounts');
console.log('DELETE FROM "Driver";');
console.log('DELETE FROM "User" WHERE role = \'DRIVER\';');
console.log('');
console.log('-- Insert new user accounts for drivers first');
console.log('INSERT INTO "User" (id, email, password, name, role, status, "createdAt", "updatedAt") VALUES');

const userValues = drivers.map((driver, i) => {
  const id = `01234567-0001-4000-8000-${pad(i + 1, 12)}`;
  const email = nameToEmail(driver.name);
  const name = driver.name.replace(/'/g, "''"); // Escape single quotes
  return `  ('${id}', '${email}', '$2b$10$defaultpasswordhash', '${name}', 'DRIVER', 'ACTIVE', NOW(), NOW())`;
}).join(',\n');

console.log(userValues + ';');
console.log('');
console.log('-- Insert driver records');
console.log('INSERT INTO "Driver" (id, "userId", "transporterId", name, phone, email, depot, address, status, citizenship, "passportExpiry", "licenseExpiry", "rtwExpiry", points, "lastCheck", "nextCheck", age, "hasEndorsements", "joinDate", "completionRate", rating, "totalTrips", "createdAt", "updatedAt") VALUES');

const driverValues = drivers.map((driver, i) => {
  const driverId = `02234567-0001-4000-8000-${pad(i + 1, 12)}`;
  const userId = `01234567-0001-4000-8000-${pad(i + 1, 12)}`;
  const email = nameToEmail(driver.name);
  const name = driver.name.replace(/'/g, "''"); // Escape single quotes
  const phone = `+4400000${pad(i + 1, 5)}`;
  
  return `  ('${driverId}', '${userId}', '${driver.transporterId}', '${name}', '${phone}', '${email}', 'London', 'London, UK', 'ACTIVE', 'UK', '2030-12-31', '2030-12-31', '2030-12-31', 0, NOW(), NOW() + INTERVAL '1 year', 30, false, NOW(), 100.0, 5.0, 0, NOW(), NOW())`;
}).join(',\n');

console.log(driverValues + ';');
console.log('');
console.log('-- Display summary');
console.log('SELECT COUNT(*) as total_drivers_inserted, \'All drivers replaced with Amazon dataset\' as message FROM "Driver";');
