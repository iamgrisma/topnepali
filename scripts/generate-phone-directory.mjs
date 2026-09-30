import fs from 'fs';

const provincePhoneData = [
  {
    name: "Koshi Province",
    id: "koshi-province",
    h2Title: "Telephone Area Codes for Koshi Province (14 Districts)",
    districts: [
      { name: "Morang", hq: "Biratnagar", std: "021", intl: "+977 21", digits: "6-7 digits" },
      { name: "Sunsari", hq: "Dharan, Itahari, Inaruwa", std: "025", intl: "+977 25", digits: "6 digits" },
      { name: "Jhapa", hq: "Bhadrapur, Birtamod, Damak", std: "023", intl: "+977 23", digits: "6 digits" },
      { name: "Ilam", hq: "Ilam Bazaar", std: "027", intl: "+977 27", digits: "6 digits" },
      { name: "Panchthar", hq: "Phidim", std: "024", intl: "+977 24", digits: "6 digits" },
      { name: "Taplejung", hq: "Fungling", std: "024", intl: "+977 24", digits: "6 digits" },
      { name: "Dhankuta", hq: "Dhankuta Bazaar, Hile", std: "026", intl: "+977 26", digits: "6 digits" },
      { name: "Terhathum", hq: "Myanglung", std: "026", intl: "+977 26", digits: "6 digits" },
      { name: "Bhojpur", hq: "Bhojpur Bazaar", std: "029", intl: "+977 29", digits: "6 digits" },
      { name: "Sankhuwasabha", hq: "Khandbari", std: "029", intl: "+977 29", digits: "6 digits" },
      { name: "Udayapur", hq: "Gaighat", std: "035", intl: "+977 35", digits: "6 digits" },
      { name: "Khotang", hq: "Diktel", std: "036", intl: "+977 36", digits: "6 digits" },
      { name: "Okhaldhunga", hq: "Siddhicharan", std: "037", intl: "+977 37", digits: "6 digits" },
      { name: "Solukhumbu", hq: "Salleri, Namche Bazaar", std: "038", intl: "+977 38", digits: "6 digits" }
    ]
  },
  {
    name: "Madhesh Province",
    id: "madhesh-province",
    h2Title: "Telephone Area Codes for Madhesh Province (8 Districts)",
    districts: [
      { name: "Parsa", hq: "Birgunj", std: "051", intl: "+977 51", digits: "6 digits" },
      { name: "Bara", hq: "Kalaiya, Simara", std: "053", intl: "+977 53", digits: "6 digits" },
      { name: "Rautahat", hq: "Gaur, Chandrapur", std: "055", intl: "+977 55", digits: "6 digits" },
      { name: "Sarlahi", hq: "Malangwa, Lalbandi", std: "046", intl: "+977 46", digits: "6 digits" },
      { name: "Mahottari", hq: "Jaleshwor, Bardibas", std: "044", intl: "+977 44", digits: "6 digits" },
      { name: "Dhanusha", hq: "Janakpurdham", std: "041", intl: "+977 41", digits: "6 digits" },
      { name: "Siraha", hq: "Siraha, Lahan", std: "033", intl: "+977 33", digits: "6 digits" },
      { name: "Saptari", hq: "Rajbiraj", std: "031", intl: "+977 31", digits: "6 digits" }
    ]
  },
  {
    name: "Bagmati Province",
    id: "bagmati-province",
    h2Title: "Telephone Area Codes for Bagmati Province (13 Districts)",
    districts: [
      { name: "Kathmandu", hq: "Kathmandu Metropolitan (All Areas)", std: "01", intl: "+977 1", digits: "7 digits" },
      { name: "Lalitpur", hq: "Patan, Jawalakhel, Pulchowk", std: "01", intl: "+977 1", digits: "7 digits" },
      { name: "Bhaktapur", hq: "Bhaktapur, Madhyapur Thimi", std: "01", intl: "+977 1", digits: "7 digits" },
      { name: "Kavrepalanchok", hq: "Dhulikhel, Banepa, Panauti", std: "011", intl: "+977 11", digits: "6 digits" },
      { name: "Sindhupalchok", hq: "Chautara, Melamchi", std: "011", intl: "+977 11", digits: "6 digits" },
      { name: "Dhading", hq: "Dhading Besi, Malekhu", std: "010", intl: "+977 10", digits: "6 digits" },
      { name: "Nuwakot", hq: "Bidur, Trishuli", std: "010", intl: "+977 10", digits: "6 digits" },
      { name: "Rasuwa", hq: "Dhunche, Syaphrubesi", std: "010", intl: "+977 10", digits: "6 digits" },
      { name: "Chitwan", hq: "Bharatpur, Narayangarh", std: "056", intl: "+977 56", digits: "6 digits" },
      { name: "Makwanpur", hq: "Hetauda", std: "057", intl: "+977 57", digits: "6 digits" },
      { name: "Sindhuli", hq: "Kamalamai (Sindhulimadhi)", std: "047", intl: "+977 47", digits: "6 digits" },
      { name: "Ramechhap", hq: "Manthali", std: "048", intl: "+977 48", digits: "6 digits" },
      { name: "Dolakha", hq: "Charikot, Jiri", std: "049", intl: "+977 49", digits: "6 digits" }
    ]
  },
  {
    name: "Gandaki Province",
    id: "gandaki-province",
    h2Title: "Telephone Area Codes for Gandaki Province (11 Districts)",
    districts: [
      { name: "Kaski", hq: "Pokhara, Lekhnath", std: "061", intl: "+977 61", digits: "6 digits" },
      { name: "Tanahun", hq: "Damauli, Khairenitar, Bandipur", std: "065", intl: "+977 65", digits: "6 digits" },
      { name: "Lamjung", hq: "Besisahar", std: "066", intl: "+977 66", digits: "6 digits" },
      { name: "Manang", hq: "Chame", std: "066", intl: "+977 66", digits: "6 digits" },
      { name: "Syangja", hq: "Putalibazar, Waling", std: "063", intl: "+977 63", digits: "6 digits" },
      { name: "Gorkha", hq: "Gorkha Bazaar", std: "064", intl: "+977 64", digits: "6 digits" },
      { name: "Parbat", hq: "Kusma", std: "067", intl: "+977 67", digits: "6 digits" },
      { name: "Baglung", hq: "Baglung Bazaar", std: "068", intl: "+977 68", digits: "6 digits" },
      { name: "Myagdi", hq: "Beni", std: "069", intl: "+977 69", digits: "6 digits" },
      { name: "Mustang", hq: "Jomsom", std: "069", intl: "+977 69", digits: "6 digits" },
      { name: "Nawalpur (Nawalparasi East)", hq: "Kawasoti, Gaidakot", std: "078", intl: "+977 78", digits: "6 digits" }
    ]
  },
  {
    name: "Lumbini Province",
    id: "lumbini-province",
    h2Title: "Telephone Area Codes for Lumbini Province (12 Districts)",
    districts: [
      { name: "Rupandehi", hq: "Butwal, Bhairahawa, Siddharthanagar", std: "071", intl: "+977 71", digits: "6 digits" },
      { name: "Kapilvastu", hq: "Taulihawa, Krishnanagar", std: "076", intl: "+977 76", digits: "6 digits" },
      { name: "Palpa", hq: "Tansen", std: "075", intl: "+977 75", digits: "6 digits" },
      { name: "Arghakhanchi", hq: "Sandhikharka", std: "077", intl: "+977 77", digits: "6 digits" },
      { name: "Gulmi", hq: "Tamghas", std: "079", intl: "+977 79", digits: "6 digits" },
      { name: "Parasi (Nawalparasi West)", hq: "Ramgram", std: "078", intl: "+977 78", digits: "6 digits" },
      { name: "Dang", hq: "Ghorahi, Tulsipur", std: "082", intl: "+977 82", digits: "6 digits" },
      { name: "Banke", hq: "Nepalgunj, Kohalpur", std: "081", intl: "+977 81", digits: "6 digits" },
      { name: "Bardiya", hq: "Gulariya, Rajapur", std: "084", intl: "+977 84", digits: "6 digits" },
      { name: "Pyuthan", hq: "Pyuthan Bazaar", std: "086", intl: "+977 86", digits: "6 digits" },
      { name: "Rolpa", hq: "Liwang", std: "086", intl: "+977 86", digits: "6 digits" },
      { name: "Eastern Rukum", hq: "Rukumkot", std: "088", intl: "+977 88", digits: "6 digits" }
    ]
  },
  {
    name: "Karnali Province",
    id: "karnali-province",
    h2Title: "Telephone Area Codes for Karnali Province (10 Districts)",
    districts: [
      { name: "Surkhet", hq: "Birendranagar", std: "083", intl: "+977 83", digits: "6 digits" },
      { name: "Dailekh", hq: "Narayan", std: "089", intl: "+977 89", digits: "6 digits" },
      { name: "Jajarkot", hq: "Khalanga", std: "089", intl: "+977 89", digits: "6 digits" },
      { name: "Salyan", hq: "Sarda (Khalanga)", std: "088", intl: "+977 88", digits: "6 digits" },
      { name: "Western Rukum", hq: "Musikot", std: "088", intl: "+977 88", digits: "6 digits" },
      { name: "Jumla", hq: "Chandannath (Khalanga)", std: "087", intl: "+977 87", digits: "6 digits" },
      { name: "Kalikot", hq: "Manma", std: "087", intl: "+977 87", digits: "6 digits" },
      { name: "Dolpa", hq: "Dunai", std: "087", intl: "+977 87", digits: "6 digits" },
      { name: "Humla", hq: "Simikot", std: "019", intl: "+977 19", digits: "6 digits" },
      { name: "Mugu", hq: "Gamgadhi", std: "019", intl: "+977 19", digits: "6 digits" }
    ]
  },
  {
    name: "Sudurpaschim Province",
    id: "sudurpaschim-province",
    h2Title: "Telephone Area Codes for Sudurpaschim Province (9 Districts)",
    districts: [
      { name: "Kailali", hq: "Dhangadhi, Tikapur, Attariya", std: "091", intl: "+977 91", digits: "6 digits" },
      { name: "Kanchanpur", hq: "Bhimdatta (Mahendranagar)", std: "099", intl: "+977 99", digits: "6 digits" },
      { name: "Dadeldhura", hq: "Amargadhi", std: "096", intl: "+977 96", digits: "6 digits" },
      { name: "Doti", hq: "Silgadhi, Dipayal", std: "094", intl: "+977 94", digits: "6 digits" },
      { name: "Achham", hq: "Mangalsen", std: "097", intl: "+977 97", digits: "6 digits" },
      { name: "Bajura", hq: "Martadi", std: "097", intl: "+977 97", digits: "6 digits" },
      { name: "Bajhang", hq: "Chainpur", std: "092", intl: "+977 92", digits: "6 digits" },
      { name: "Baitadi", hq: "Dasharathchand", std: "095", intl: "+977 95", digits: "6 digits" },
      { name: "Darchula", hq: "Khalanga", std: "093", intl: "+977 93", digits: "6 digits" }
    ]
  }
];

let html = '';

// 1. Opening Paragraph
html += `<p class="wp-block-paragraph lead text-base text-slate-700 leading-relaxed mb-6">Need to dial a fixed landline, mobile number, or government office in Nepal? Nepal uses the international country calling code <strong>+977</strong> alongside standardized 2-digit and 3-digit Subscriber Trunk Dialing (STD) area codes across all 77 districts. Use our real-time instant lookup below to find any district STD code, mobile operator prefix (NTC/Ncell), or emergency helpline, or browse the complete 2026 telephone numbering directory.</p>\n\n`;

// 2. Instant Searchbox (under opening paragraph, exactly matching postal code format)
html += `<div class="phone-lookup-widget mb-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-xs" id="phone-lookup-tool">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
    <div>
      <h3 class="text-lg font-extrabold text-slate-900 tracking-tight m-0">Instant Telephone Area Code &amp; STD Lookup</h3>
      <p class="text-xs text-slate-500 m-0 mt-1">Search any district, city, STD code, mobile operator prefix, or emergency helpline.</p>
    </div>
    <span class="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md self-start sm:self-auto">All 77 Districts &amp; Operators</span>
  </div>
  <div class="relative">
    <input type="search" id="phone-code-search-input" placeholder="Type city, district, code, operator, or helpline (e.g., Kathmandu, Pokhara, 01, 061, NTC, Police)..." class="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-2xs" autocomplete="off" />
  </div>
  <div id="phone-search-status" class="text-xs text-slate-500 mt-2.5 hidden"></div>
  <div id="phone-search-results" class="mt-4 hidden space-y-2 max-h-[380px] overflow-y-auto pr-1"></div>
</div>\n\n`;

// 3. Question / Position 0 Featured Snippet Box
html += `<div class="p-6 bg-slate-50 border border-slate-200 rounded-2xl mb-8">
<h2 class="text-lg font-bold text-slate-900 m-0 mb-3" id="quick-answer-how-to-call-nepal">Quick Answer: How to Call Nepal from Abroad (Country Code +977)</h2>
<p class="text-sm text-slate-700 leading-relaxed m-0 mb-3">To call a Nepali telephone number from another country, dial your local international exit code (or <strong>+</strong> on mobile), followed by Nepal's country code <strong>977</strong>, the district area code <em>without the initial zero</em>, and the subscriber number.</p>
<p class="text-sm text-slate-700 leading-relaxed m-0"><strong>Landline Example (Kathmandu):</strong> Dial <strong>+977 1 XXXXXXX</strong> (7-digit number).<br/><strong>Landline Example (Pokhara):</strong> Dial <strong>+977 61 XXXXXX</strong> (6-digit number).<br/><strong>Mobile Example:</strong> Dial <strong>+977 98XXXXXXXX</strong> (10-digit mobile number).<br/><em>Note: The leading "0" in domestic STD area codes (like 01 or 061) is only dialed within Nepal and must be omitted when calling from abroad.</em></p>
</div>\n\n`;

// 4. Top 12 Major Cities Quick Reference Table
html += `<h2 class="wp-block-heading" id="top-major-cities-area-codes">Top 12 Major Cities: Quick STD Code Reference</h2>\n\n`;
html += `<p class="wp-block-paragraph">Here are the official landline telephone STD area codes for Nepal’s primary metropolitan centers, economic hubs, and provincial capitals:</p>\n\n`;
html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>Metropolitan Area / City</th><th>Province</th><th>Domestic STD Code</th><th>International Format</th><th>Coverage</th></tr></thead><tbody>\n`;

const topCities = [
  { city: "Kathmandu", prov: "Bagmati", std: "01", intl: "+977 1", cov: "Kathmandu Metropolitan & Valley Central" },
  { city: "Lalitpur (Patan)", prov: "Bagmati", std: "01", intl: "+977 1", cov: "Patan, Jawalakhel, Pulchowk, Kupondole" },
  { city: "Bhaktapur", prov: "Bagmati", std: "01", intl: "+977 1", cov: "Bhaktapur Durbar, Thimi, Suryabinayak" },
  { city: "Pokhara (Kaski)", prov: "Gandaki", std: "061", intl: "+977 61", cov: "Pokhara, Lakeside, Lekhnath" },
  { city: "Biratnagar (Morang)", prov: "Koshi", std: "021", intl: "+977 21", cov: "Biratnagar & Morang Industrial Corridor" },
  { city: "Birgunj (Parsa)", prov: "Madhesh", std: "051", intl: "+977 51", cov: "Birgunj Commercial Gateway" },
  { city: "Bharatpur (Chitwan)", prov: "Bagmati", std: "056", intl: "+977 56", cov: "Bharatpur, Narayangarh, Ratnanagar" },
  { city: "Butwal / Bhairahawa", prov: "Lumbini", std: "071", intl: "+977 71", cov: "Rupandehi, Butwal, Gautam Buddha Airport" },
  { city: "Dharan / Itahari", prov: "Koshi", std: "025", intl: "+977 25", cov: "Sunsari District Commercial Centers" },
  { city: "Nepalgunj (Banke)", prov: "Lumbini", std: "081", intl: "+977 81", cov: "Nepalgunj, Kohalpur" },
  { city: "Dhangadhi (Kailali)", prov: "Sudurpaschim", std: "091", intl: "+977 91", cov: "Dhangadhi, Tikapur, Attariya" },
  { city: "Hetauda (Makwanpur)", prov: "Bagmati", std: "057", intl: "+977 57", cov: "Hetauda (Bagmati Provincial Capital)" }
];

topCities.forEach(c => {
  html += `<tr><td><strong>${c.city}</strong></td><td>${c.prov}</td><td><strong>${c.std}</strong></td><td><code>${c.intl}</code></td><td>${c.cov}</td></tr>\n`;
});
html += `</tbody></table></figure>\n\n`;

// 5. Browse by Province Jump Navigation
html += `<h2 class="wp-block-heading" id="browse-by-province">Browse Telephone Area Codes by Province</h2>\n\n`;
html += `<p class="wp-block-paragraph">Select your province below to navigate directly to all district landline STD codes:</p>\n\n`;
html += `<div class="flex flex-wrap gap-2 mb-8">\n`;
provincePhoneData.forEach(p => {
  html += `  <a href="#${p.id}" class="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg transition">${p.name}</a>\n`;
});
html += `</div>\n\n<hr class="wp-block-separator has-text-color has-background is-style-wide"/>\n\n`;

// 6. Province Directories
provincePhoneData.forEach(p => {
  html += `<h2 class="wp-block-heading" id="${p.id}">${p.h2Title}</h2>\n\n`;
  html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>District Name</th><th>Headquarters / Major Towns</th><th>STD Code (Nepal)</th><th>International Dialing</th><th>Subscriber Digits</th></tr></thead><tbody>\n`;
  p.districts.forEach(d => {
    html += `<tr><td><strong>${d.name}</strong></td><td>${d.hq}</td><td><strong>${d.std}</strong></td><td><code>${d.intl}</code></td><td>${d.digits}</td></tr>\n`;
  });
  html += `</tbody></table><figcaption class="wp-element-caption">Official Landline Telephone Area Codes for ${p.name}</figcaption></figure>\n\n`;
});

html += `<hr class="wp-block-separator has-text-color has-background is-style-wide"/>\n\n`;

// 7. Mobile Operator Prefix Directory
html += `<h2 class="wp-block-heading" id="mobile-operator-codes">Nepal Mobile Operator Prefix Codes (NTC &amp; Ncell)</h2>\n\n`;
html += `<p class="wp-block-paragraph">In Nepal, mobile telephone numbers are 10 digits long. The first 3 digits represent the telecom carrier and service tier:</p>\n\n`;
html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>Telecom Operator</th><th>Prefix Codes</th><th>Service / SIM Type</th><th>Dialing from Abroad</th></tr></thead><tbody>\n`;
html += `<tr><td><strong>Nepal Telecom (Namaste / NTC)</strong></td><td><code>984</code>, <code>986</code>, <code>976</code></td><td>Prepaid GSM Mobile</td><td><code>+977 984XXXXXXX</code></td></tr>\n`;
html += `<tr><td><strong>Nepal Telecom (NTC Postpaid)</strong></td><td><code>985</code></td><td>Postpaid GSM Mobile</td><td><code>+977 985XXXXXXX</code></td></tr>\n`;
html += `<tr><td><strong>Nepal Telecom (CDMA / Fixed)</strong></td><td><code>974</code>, <code>975</code></td><td>Sky Phone / CDMA &amp; Wireless Local Loop</td><td><code>+977 974XXXXXXX</code></td></tr>\n`;
html += `<tr><td><strong>Ncell Axiata</strong></td><td><code>980</code>, <code>981</code>, <code>982</code></td><td>Prepaid &amp; Postpaid GSM Mobile</td><td><code>+977 980XXXXXXX</code></td></tr>\n`;
html += `</tbody></table><figcaption class="wp-element-caption">Verified Mobile Operator Numbering Prefixes in Nepal</figcaption></figure>\n\n`;

// 8. Emergency Numbers
html += `<h2 class="wp-block-heading" id="emergency-helpline-numbers">Emergency Helplines &amp; Essential Short Codes</h2>\n\n`;
html += `<p class="wp-block-paragraph">These 3-digit and 4-digit short codes are toll-free and accessible across all telecommunication networks throughout Nepal:</p>\n\n`;
html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>Emergency / Public Service</th><th>Short Code</th><th>Description &amp; Operation</th></tr></thead><tbody>\n`;

const emergencyCodes = [
  { service: "Nepal Police Emergency", code: "100", desc: "Nationwide 24/7 Police emergency control room" },
  { service: "Fire Brigade (Damkal)", code: "101", desc: "Central fire extinguishing and rescue dispatch" },
  { service: "Ambulance Service", code: "102", desc: "Medical emergency ambulance dispatch" },
  { service: "Traffic Police Helpline", code: "103", desc: "Road assistance, traffic updates, accident reporting" },
  { service: "Missing Child / Person", code: "104", desc: "National child search coordination center" },
  { service: "Child Helpline (CWIN)", code: "1098", desc: "Toll-free emergency child protection helpline" },
  { service: "National Women Commission", code: "1145", desc: "Khabar Garaun helpline for gender-based violence" },
  { service: "Tourist Police Nepal", code: "1144", desc: "Assistance and security for foreign travelers" },
  { service: "Hello Sarkar (Prime Minister Office)", code: "1111", desc: "Citizen grievances and complaint escalation" },
  { service: "Disaster Information Helpline", code: "1177", desc: "National disaster management & flood/landslide alerts" },
  { service: "NTC Landline Fault Booking", code: "198", desc: "Nepal Telecom landline wire repair request" },
  { service: "Nepal Telecom Customer Care", code: "1498", desc: "NTC GSM mobile inquiries and service activation" },
  { service: "Ncell Customer Care", code: "9005", desc: "Ncell support (9809005000 from non-Ncell phones)" }
];

emergencyCodes.forEach(e => {
  html += `<tr><td><strong>${e.service}</strong></td><td><strong>${e.code}</strong></td><td>${e.desc}</td></tr>\n`;
});
html += `</tbody></table><figcaption class="wp-element-caption">Emergency and Public Utility Short Codes in Nepal</figcaption></figure>\n\n`;

// 9. Dialing Rules Guide
html += `<h2 class="wp-block-heading" id="dialing-rules-guide">How to Dial Numbers in Nepal: Complete Rules</h2>\n\n`;
html += `<p class="wp-block-paragraph">Depending on where you are calling from and which device you are using, follow these standard dialing protocols:</p>\n\n`;
html += `<ul class="wp-block-list">\n`;
html += `<li><strong>From Outside Nepal to Landline:</strong> Dial <code>+977</code> + <code>[Area Code without 0]</code> + <code>[Subscriber Number]</code>. For example, to call a Kathmandu number (4221122), dial <code>+977 1 4221122</code>.</li>\n`;
html += `<li><strong>From Outside Nepal to Mobile:</strong> Dial <code>+977</code> + <code>[10-Digit Mobile Number]</code>. For example: <code>+977 9841234567</code>.</li>\n`;
html += `<li><strong>Landline to Landline (Same District):</strong> Simply dial the 6 or 7 digit local subscriber number directly. You do not need to enter the area code.</li>\n`;
html += `<li><strong>Landline to Landline (Different District / STD):</strong> Dial the full domestic area code with leading zero followed by the number, e.g., <code>061 520000</code> to reach Pokhara from Kathmandu.</li>\n`;
html += `<li><strong>Mobile to Any Landline:</strong> Always include the domestic area code with leading zero, e.g., <code>01 4221122</code> for Kathmandu or <code>071 540000</code> for Butwal.</li>\n`;
html += `<li><strong>Mobile to Mobile:</strong> Dial the 10-digit mobile number directly.</li>\n`;
html += `</ul>\n\n`;

// 10. Related Resources / Internal Links
html += `<h2 class="wp-block-heading" id="related-directories">Related Official Directories</h2>\n\n`;
html += `<p class="wp-block-paragraph">When filling out international delivery, billing, or shipping forms, postal codes are required alongside contact telephone numbers. View our verified <a class="rank-math-link" href="https://topnepali.com/postal-code-zip-code-for-nepal/">Nepal Postal Code Directory (All 77 Districts)</a>.</p>\n\n`;
html += `<p class="wp-block-paragraph">For wire remittances, overseas transfers, and inward foreign settlements, consult our complete guide to <a class="rank-math-link" href="https://topnepali.com/swift-codes-of-banks-in-nepal/">Swift Codes of Commercial Banks in Nepal</a>. If you are shopping online with local delivery, explore the <a class="rank-math-link" href="https://topnepali.com/top-nepali-online-shopping-sites/">Top Nepali Online Shopping Sites</a>.</p>\n\n`;

// 11. RankMath FAQ
html += `<h2 class="wp-block-heading" id="frequently-asked-questions">Frequently Asked Questions (FAQ)</h2>\n\n`;
html += `<div id="rank-math-faq" class="rank-math-block">\n<div class="rank-math-list">\n`;

const faqs = [
  {
    q: "What is the telephone country code for Nepal?",
    a: "Nepal's international country calling code is +977 (or 00977). Anyone calling a Nepali landline or mobile phone from abroad must prefix the number with +977."
  },
  {
    q: "What is the area code of Kathmandu, Lalitpur, and Bhaktapur?",
    a: "The landline telephone area code for all three districts in the Kathmandu Valley (Kathmandu, Lalitpur, and Bhaktapur) is 01. When calling from abroad, omit the leading zero and dial +977 1 followed by the 7-digit local number."
  },
  {
    q: "What is the landline area code of Pokhara and Kaski District?",
    a: "The telephone area code for Pokhara (Kaski District) is 061. When calling from overseas, dial +977 61 followed by the 6-digit subscriber number."
  },
  {
    q: "Do I need to dial the area code when calling from a mobile phone to a landline?",
    a: "Yes. When calling any landline telephone from a mobile phone in Nepal, you must always prefix the number with the district area code (including the leading 0, e.g., 01 for Kathmandu, 061 for Pokhara, 071 for Butwal)."
  },
  {
    q: "What are the mobile operator prefix numbers in Nepal?",
    a: "In Nepal, Nepal Telecom (NTC/Namaste) mobile numbers begin with 984, 985 (postpaid), 986, and 976. Ncell mobile numbers begin with 980, 981, and 982. All mobile numbers are 10 digits long."
  },
  {
    q: "What is the difference between Nepal country code +977 and postal code?",
    a: "+977 is Nepal's international telephone dial-in code, not a postal code. Entering +977 on international courier or billing checkout forms (like Amazon or AliExpress) will cause address validation errors. For postal codes, use valid 5-digit codes like 44600 (Kathmandu GPO) or 33700 (Pokhara)."
  }
];

faqs.forEach((f, idx) => {
  html += `<div id="faq-question-phone0${idx + 1}" class="rank-math-list-item">\n`;
  html += `<h3 class="rank-math-question">${f.q}</h3>\n`;
  html += `<div class="rank-math-answer">\n<p>${f.a}</p>\n</div>\n`;
  html += `</div>\n`;
});

html += `</div>\n</div>\n`;

fs.writeFileSync('scripts/new-post-3521-content.html', html, 'utf-8');
console.log('Generated new-post-3521-content.html, length:', html.length);
