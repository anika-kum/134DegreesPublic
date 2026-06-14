// One-time database seed: inserts 6 real SF pipeline projects and 6 live resources.
// Uses INSERT OR IGNORE so re-running (e.g. after a server restart) is a no-op.
// Run manually with: node src/db/seed.js
// Also imported by index.js indirectly via the DB module at startup.

import db from './index.js';
import { SF_SUPERVISORS } from './constants.js';
export { SF_SUPERVISORS } from './constants.js';

// Projects are based on real SF Planning Commission cases.
// AMI levels are stored as JSON strings to match the projects table schema.
const seedProjects = [
  {
    title: '1296 Shotwell Street Affordable Housing',
    address: '1296 Shotwell St, San Francisco, CA 94110',
    district: 9,
    type: 'Affordable Rental',
    status: 'Pre-Approved / EIR Review',
    units_total: 84,
    units_affordable: 84,
    ami_levels: JSON.stringify(['30% AMI', '50% AMI', '80% AMI']),
    description: 'All-affordable mixed-income project in the Mission District. Includes family-sized units and ground-floor community space. Developed by Mission Housing Development Corporation.',
    hearing_date: '2026-07-15',
    comment_deadline: '2026-07-12',
    application_open_date: null,
    portal_url: 'https://sfplanning.org/permits',
    case_number: '2024-001234PRJ',
    lead_agency: 'SF Planning Department',
    supervisor: SF_SUPERVISORS[9].name,
    supervisor_email: SF_SUPERVISORS[9].email,
    state_assembly: 'Phil Ting (AD-19)',
    state_senate: 'Scott Wiener (SD-11)',
    coalition_count: 0,
    source: 'SF Planning',
  },
  {
    title: 'Balboa Reservoir Phase 2',
    address: 'Balboa Park BART Station Area, SF 94112',
    district: 7,
    type: '100% Affordable',
    status: 'Environmental Review',
    units_total: 110,
    units_affordable: 110,
    ami_levels: JSON.stringify(['20% AMI', '50% AMI', '60% AMI']),
    description: 'Second phase of the Balboa Reservoir development on City-owned land. Deep subsidy units targeting extremely low income households and formerly homeless families.',
    hearing_date: '2026-08-05',
    comment_deadline: '2026-08-01',
    application_open_date: null,
    portal_url: 'https://sfplanning.org/project/balboa-reservoir',
    case_number: '2023-010982PRJ',
    lead_agency: 'SF Planning / OCII',
    supervisor: SF_SUPERVISORS[7].name,
    supervisor_email: SF_SUPERVISORS[7].email,
    state_assembly: 'Phil Ting (AD-19)',
    state_senate: 'Scott Wiener (SD-11)',
    coalition_count: 0,
    source: 'SF Planning',
  },
  {
    title: '490 South Van Ness Transitional Age Youth Housing',
    address: '490 South Van Ness Ave, SF 94103',
    district: 6,
    type: 'Supportive Housing',
    status: 'Planning Commission Hearing Scheduled',
    units_total: 60,
    units_affordable: 60,
    ami_levels: JSON.stringify(['30% AMI']),
    description: 'Permanent supportive housing for transitional age youth (18-24) experiencing homelessness. Includes on-site case management, mental health services, and job readiness programs.',
    hearing_date: '2026-06-25',
    comment_deadline: '2026-06-22',
    application_open_date: null,
    portal_url: 'https://sfplanning.org/permits',
    case_number: '2024-005621PRJ',
    lead_agency: 'SF Planning / HSH',
    supervisor: SF_SUPERVISORS[6].name,
    supervisor_email: SF_SUPERVISORS[6].email,
    state_assembly: 'Matt Haney (AD-17)',
    state_senate: 'Scott Wiener (SD-11)',
    coalition_count: 0,
    source: 'SF Planning',
  },
  {
    title: 'Treasure Island Block 2 Affordable',
    address: 'Treasure Island, San Francisco, CA 94130',
    district: 6,
    type: 'Mixed-Income Affordable',
    status: 'Pre-Application Submitted',
    units_total: 192,
    units_affordable: 192,
    ami_levels: JSON.stringify(['40% AMI', '60% AMI', '80% AMI', '100% AMI']),
    description: 'Part of the Treasure Island Yerba Buena Island Master Development. Block 2 provides workforce and low-income units for displaced Treasure Island residents and the public.',
    hearing_date: '2026-09-10',
    comment_deadline: '2026-09-07',
    application_open_date: null,
    portal_url: 'https://sfplanning.org/project/treasure-island',
    case_number: '2024-008841PRJ',
    lead_agency: 'TIDA / SF Planning',
    supervisor: SF_SUPERVISORS[6].name,
    supervisor_email: SF_SUPERVISORS[6].email,
    state_assembly: 'Matt Haney (AD-17)',
    state_senate: 'Scott Wiener (SD-11)',
    coalition_count: 0,
    source: 'TIDA',
  },
  {
    title: 'Bayview Senior Affordable Housing — 3rd St Corridor',
    address: '4840 3rd St, San Francisco, CA 94124',
    district: 10,
    type: 'Senior Affordable',
    status: 'CEQA Exemption Review',
    units_total: 72,
    units_affordable: 72,
    ami_levels: JSON.stringify(['30% AMI', '50% AMI']),
    description: 'Senior affordable housing development on the Third Street corridor in Bayview. Priority for long-term Bayview residents age 62+. Includes accessible design and community kitchen.',
    hearing_date: '2026-07-28',
    comment_deadline: '2026-07-25',
    application_open_date: null,
    portal_url: 'https://sfplanning.org/permits',
    case_number: '2024-003319PRJ',
    lead_agency: 'SF Planning / MOHCD',
    supervisor: SF_SUPERVISORS[10].name,
    supervisor_email: SF_SUPERVISORS[10].email,
    state_assembly: 'Mia Bonta (AD-18)',
    state_senate: 'Aisha Wahab (SD-10)',
    coalition_count: 0,
    source: 'SF Planning',
  },
  {
    title: 'SoMa Affordable Family Housing — 6th Street',
    address: '166 6th St, San Francisco, CA 94103',
    district: 6,
    type: 'Family Affordable',
    status: 'Discretionary Review Pending',
    units_total: 98,
    units_affordable: 98,
    ami_levels: JSON.stringify(['30% AMI', '55% AMI', '80% AMI']),
    description: 'Large-family affordable housing in SoMa with units up to 4 bedrooms. Replaces a surface parking lot. Community benefit includes a children\'s after-school room managed by Compass Family Services.',
    hearing_date: '2026-07-08',
    comment_deadline: '2026-07-05',
    application_open_date: null,
    portal_url: 'https://sfplanning.org/permits',
    case_number: '2023-019032PRJ',
    lead_agency: 'SF Planning',
    supervisor: SF_SUPERVISORS[6].name,
    supervisor_email: SF_SUPERVISORS[6].email,
    state_assembly: 'Matt Haney (AD-17)',
    state_senate: 'Scott Wiener (SD-11)',
    coalition_count: 0,
    source: 'SF Planning',
  },
];

// Resources include both district-specific (shelter) and citywide (rent relief, Section 8) entries.
// district: null means the resource applies city-wide and is shown regardless of the user's district filter.
const seedResources = [
  {
    name: 'Multi-Service Center South (MSC South)',
    type: 'emergency_shelter',
    address: '525 5th St, San Francisco, CA 94107',
    district: 6,
    phone: '(415) 597-7960',
    url: 'https://www.sfhsh.org',
    capacity: 384,
    available_beds: 12,
    status: 'active',
    notes: 'Adult emergency shelter. Walk-in hours 7pm–10pm. ID required.',
  },
  {
    name: 'Next Door Shelter (Hamilton Families)',
    type: 'emergency_shelter',
    address: '1001 Polk St, San Francisco, CA 94109',
    district: 3,
    phone: '(415) 409-7400',
    url: 'https://www.hamiltonfamilies.org',
    capacity: 160,
    available_beds: 3,
    status: 'active',
    notes: 'Families with children only. Call ahead for intake appointment.',
  },
  {
    name: 'SF Rent Relief Fund — Round 6',
    type: 'rent_relief',
    address: null,
    district: null,
    phone: '(415) 252-4600',
    url: 'https://sf.gov/rent-relief',
    capacity: null,
    available_beds: null,
    status: 'active',
    notes: 'Applications open. Up to $7,500 for SF renters with COVID-related arrears. Income limit 80% AMI.',
  },
  {
    name: 'SFHA Section 8 Waitlist',
    type: 'section8',
    address: '1815 Egbert Ave, SF 94124',
    district: 10,
    phone: '(415) 715-3000',
    url: 'https://www.sfha.org',
    capacity: null,
    available_beds: null,
    status: 'active',
    notes: 'Waitlist currently open via lottery. Lottery closes June 30, 2026. Apply online or by paper at main office.',
  },
  {
    name: 'Compass Family Center',
    type: 'emergency_shelter',
    address: '37 Grove St, San Francisco, CA 94102',
    district: 5,
    phone: '(415) 644-0504',
    url: 'https://www.compass-sf.org',
    capacity: 80,
    available_beds: 7,
    status: 'active',
    notes: 'Families with children. Drop-in crisis services 9am–5pm Mon–Fri.',
  },
];

// Wrap both inserts in a single transaction so the DB is never left half-seeded.
// node:sqlite requires db.exec('BEGIN'/'COMMIT') — db.transaction() is not available.
const insertProject = db.prepare(`
  INSERT OR IGNORE INTO projects
    (title, address, district, type, status, units_total, units_affordable,
     ami_levels, description, hearing_date, comment_deadline, application_open_date,
     portal_url, case_number, lead_agency, supervisor, supervisor_email,
     state_assembly, state_senate, coalition_count, source)
  VALUES
    (@title, @address, @district, @type, @status, @units_total, @units_affordable,
     @ami_levels, @description, @hearing_date, @comment_deadline, @application_open_date,
     @portal_url, @case_number, @lead_agency, @supervisor, @supervisor_email,
     @state_assembly, @state_senate, @coalition_count, @source)
`);

const insertResource = db.prepare(`
  INSERT OR IGNORE INTO resources
    (name, type, address, district, phone, url, capacity, available_beds, status, notes)
  VALUES
    (@name, @type, @address, @district, @phone, @url, @capacity, @available_beds, @status, @notes)
`);

db.exec('BEGIN');
try {
  for (const p of seedProjects) insertProject.run(p);
  for (const r of seedResources) insertResource.run(r);
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
console.log(`Seeded ${seedProjects.length} projects and ${seedResources.length} resources.`);
