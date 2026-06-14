// SF Supervisorial District lookup — district number → supervisor info.
// Kept in a separate file from seed.js so scraper.js can import just this
// without triggering seed.js's top-level seeding code as a side effect.
// Update these names/emails when elections change supervisors.
export const SF_SUPERVISORS = {
  1: { name: 'Connie Chan', email: 'district1@sfgov.org', area: 'Richmond' },
  2: { name: 'Stephen Sherrill', email: 'district2@sfgov.org', area: 'Marina/Pacific Heights' },
  3: { name: 'Danny Sauter', email: 'district3@sfgov.org', area: 'North Beach/Chinatown' },
  4: { name: 'Joel Engardio', email: 'district4@sfgov.org', area: 'Sunset' },
  5: { name: 'Bilal Mahmood', email: 'district5@sfgov.org', area: 'Haight/Fillmore' },
  6: { name: 'Matt Dorsey', email: 'district6@sfgov.org', area: 'SoMa/Tenderloin' },
  7: { name: 'Myrna Melgar', email: 'district7@sfgov.org', area: 'West Portal/Forest Hill' },
  8: { name: 'Rafael Mandelman', email: 'district8@sfgov.org', area: 'Castro/Noe Valley' },
  9: { name: 'Trevor Chandler', email: 'district9@sfgov.org', area: 'Mission/Bernal Heights' },
  10: { name: 'Brian Welch', email: 'district10@sfgov.org', area: 'Bayview/Portola' },
  11: { name: 'Chyanne Chen', email: 'district11@sfgov.org', area: 'Excelsior/Ingleside' },
};

// SF state-level representatives. Districts 1-5 fall in AD-17; 6-11 in AD-19.
export const SF_STATE_REPS = {
  mayor: { name: 'London Breed', title: 'Mayor of San Francisco', email: 'mayor@sfgov.org', phone: '(415) 554-6141' },
  assembly: {
    // AD-17 covers the northern half of SF (D1-D5)
    low: { name: 'Matt Haney', title: 'State Assembly Member (AD-17)', email: 'assemblymember.haney@assembly.ca.gov', district: 'AD-17' },
    // AD-19 covers the southern half of SF (D6-D11)
    high: { name: 'Phil Ting', title: 'State Assembly Member (AD-19)', email: 'assemblymember.ting@assembly.ca.gov', district: 'AD-19' },
  },
  senate: { name: 'Scott Wiener', title: 'State Senator (SD-11)', email: 'senator.wiener@senate.ca.gov', district: 'SD-11' },
};

// Federal representatives for San Francisco (119th Congress).
// Senate members use web contact forms rather than direct email.
export const SF_FEDERAL_REPS = {
  house: { name: 'Nancy Pelosi', title: 'US Representative (CA-11)', email: 'sf@mail.house.gov', district: 'CA-11' },
  senate: [
    { name: 'Alex Padilla', title: 'US Senator (CA)', contactUrl: 'https://www.padilla.senate.gov/contact/' },
    { name: 'Adam Schiff', title: 'US Senator (CA)', contactUrl: 'https://www.schiff.senate.gov/contact/' },
  ],
};
