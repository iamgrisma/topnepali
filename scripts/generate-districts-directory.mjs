import fs from 'fs';

const provinces = [
  {
    name: "Koshi Province",
    id: "koshi-province",
    h2Title: "Districts in Koshi Province (14 Districts)",
    hq: "Biratnagar",
    area: "25,905",
    pop: "4,961,412",
    desc: "Koshi Province is located in eastern Nepal, extending from the high Himalayas (including Mount Everest) down to the fertile southern plains of the Terai. It has the highest number of districts (14) among all provinces.",
    districts: [
      { name: "Taplejung", hq: "Taplejung (Fungling)", area: "3,646", pop: "120,590" },
      { name: "Sankhuwasabha", hq: "Khandbari", area: "3,480", pop: "158,041" },
      { name: "Solukhumbu", hq: "Salleri", area: "3,312", pop: "104,851" },
      { name: "Udayapur", hq: "Gaighat", area: "2,063", pop: "340,721" },
      { name: "Morang", hq: "Biratnagar", area: "1,855", pop: "1,148,156" },
      { name: "Ilam", hq: "Ilam Bazaar", area: "1,703", pop: "279,534" },
      { name: "Jhapa", hq: "Bhadrapur", area: "1,606", pop: "998,054" },
      { name: "Khotang", hq: "Diktel", area: "1,591", pop: "175,298" },
      { name: "Bhojpur", hq: "Bhojpur", area: "1,507", pop: "157,923" },
      { name: "Sunsari", hq: "Inaruwa", area: "1,257", pop: "926,962" },
      { name: "Panchthar", hq: "Phidim", area: "1,241", pop: "172,400" },
      { name: "Okhaldhunga", hq: "Siddhicharan", area: "1,074", pop: "139,552" },
      { name: "Dhankuta", hq: "Dhankuta", area: "891", pop: "150,599" },
      { name: "Terhathum", hq: "Myanglung", area: "679", pop: "88,731" }
    ]
  },
  {
    name: "Madhesh Province",
    id: "madhesh-province",
    h2Title: "Districts in Madhesh Province (8 Districts)",
    hq: "Janakpurdham",
    area: "9,661",
    pop: "6,114,600",
    desc: "Madhesh Province is situated in the southeastern plains of Nepal along the Indian border. While it is the smallest province by land area (9,661 km²) and has only 8 districts, it is the second most populous province with over 6.1 million residents.",
    districts: [
      { name: "Saptari", hq: "Rajbiraj", area: "1,363", pop: "706,255" },
      { name: "Parsa", hq: "Birgunj", area: "1,353", pop: "654,471" },
      { name: "Sarlahi", hq: "Malangwa", area: "1,259", pop: "862,470" },
      { name: "Bara", hq: "Kalaiya", area: "1,190", pop: "763,137" },
      { name: "Siraha", hq: "Siraha", area: "1,188", pop: "739,953" },
      { name: "Dhanusha", hq: "Janakpurdham", area: "1,180", pop: "867,747" },
      { name: "Rautahat", hq: "Gaur", area: "1,126", pop: "809,702" },
      { name: "Mahottari", hq: "Jaleshwor", area: "1,002", pop: "706,994" }
    ]
  },
  {
    name: "Bagmati Province",
    id: "bagmati-province",
    h2Title: "Districts in Bagmati Province (13 Districts)",
    hq: "Hetauda",
    area: "20,300",
    pop: "6,116,866",
    desc: "Bagmati Province includes Nepal's capital city, Kathmandu, and the Kathmandu Valley urban agglomeration. It is the most populous province in Nepal (6,116,866 residents in Census 2021) and encompasses 13 districts spanning from the Tibetan border to the inner Terai.",
    districts: [
      { name: "Sindhupalchok", hq: "Chautara", area: "2,542", pop: "262,624" },
      { name: "Sindhuli", hq: "Kamalamai (Sindhulimadhi)", area: "2,491", pop: "300,026" },
      { name: "Makwanpur", hq: "Hetauda", area: "2,426", pop: "466,073" },
      { name: "Chitwan", hq: "Bharatpur", area: "2,218", pop: "719,859" },
      { name: "Dolakha", hq: "Charikot (Bhimeshwar)", area: "2,191", pop: "172,767" },
      { name: "Dhading", hq: "Nilkantha (Dhading Besi)", area: "1,926", pop: "325,710" },
      { name: "Ramechhap", hq: "Manthali", area: "1,546", pop: "170,302" },
      { name: "Rasuwa", hq: "Dhunche", area: "1,544", pop: "46,689" },
      { name: "Kavrepalanchok", hq: "Dhulikhel", area: "1,396", pop: "364,039" },
      { name: "Nuwakot", hq: "Bidur", area: "1,121", pop: "263,391" },
      { name: "Kathmandu", hq: "Kathmandu", area: "395", pop: "2,041,587" },
      { name: "Lalitpur", hq: "Lalitpur (Patan)", area: "385", pop: "551,667" },
      { name: "Bhaktapur", hq: "Bhaktapur", area: "119", pop: "432,132" }
    ]
  },
  {
    name: "Gandaki Province",
    id: "gandaki-province",
    h2Title: "Districts in Gandaki Province (11 Districts)",
    hq: "Pokhara",
    area: "21,793",
    pop: "2,466,427",
    desc: "Named after the Gandaki River network, Gandaki Province is centered around Pokhara, Nepal's premier tourism capital. It comprises 11 districts featuring the Annapurna and Dhaulagiri mountain ranges, the trans-Himalayan valleys of Mustang and Manang, and the Narayani lowlands of Nawalpur.",
    districts: [
      { name: "Gorkha", hq: "Gorkha Bazaar", area: "3,610", pop: "251,027" },
      { name: "Mustang", hq: "Jomsom", area: "3,573", pop: "14,452" },
      { name: "Myagdi", hq: "Beni", area: "2,297", pop: "107,033" },
      { name: "Manang", hq: "Chame", area: "2,246", pop: "5,658" },
      { name: "Kaski", hq: "Pokhara", area: "2,017", pop: "600,051" },
      { name: "Baglung", hq: "Baglung", area: "1,784", pop: "249,211" },
      { name: "Lamjung", hq: "Besisahar", area: "1,692", pop: "155,852" },
      { name: "Tanahun", hq: "Damauli", area: "1,546", pop: "321,153" },
      { name: "Nawalpur (Nawalparasi East)", hq: "Kawasoti", area: "1,370", pop: "378,079" },
      { name: "Syangja", hq: "Putalibazar", area: "1,164", pop: "253,024" },
      { name: "Parbat", hq: "Kusma", area: "494", pop: "130,887" }
    ]
  },
  {
    name: "Lumbini Province",
    id: "lumbini-province",
    h2Title: "Districts in Lumbini Province (12 Districts)",
    hq: "Deukhuri (Dang)",
    area: "19,271",
    pop: "5,122,078",
    desc: "Home to Lumbini, the UNESCO World Heritage birthplace of Gautam Buddha, Lumbini Province covers 12 districts in southwestern Nepal. It is the third most populous province, featuring major commercial corridors in Rupandehi (Butwal/Bhairahawa), Banke, and Dang.",
    districts: [
      { name: "Dang", hq: "Ghorahi", area: "2,955", pop: "674,993" },
      { name: "Banke", hq: "Nepalgunj", area: "2,337", pop: "603,194" },
      { name: "Bardiya", hq: "Gulariya", area: "2,025", pop: "459,900" },
      { name: "Rolpa", hq: "Liwang", area: "1,879", pop: "234,793" },
      { name: "Kapilvastu", hq: "Taulihawa", area: "1,738", pop: "682,961" },
      { name: "Palpa", hq: "Tansen", area: "1,373", pop: "245,027" },
      { name: "Rupandehi", hq: "Siddharthanagar (Bhairahawa)", area: "1,360", pop: "1,121,957" },
      { name: "Pyuthan", hq: "Pyuthan", area: "1,309", pop: "232,019" },
      { name: "Arghakhanchi", hq: "Sandhikharka", area: "1,193", pop: "177,086" },
      { name: "Eastern Rukum", hq: "Rukumkot", area: "1,161", pop: "56,786" },
      { name: "Gulmi", hq: "Tamghas", area: "1,149", pop: "246,494" },
      { name: "Parasi (Nawalparasi West)", hq: "Ramgram", area: "792", pop: "386,868" }
    ]
  },
  {
    name: "Karnali Province",
    id: "karnali-province",
    h2Title: "Districts in Karnali Province (10 Districts)",
    hq: "Birendranagar (Surkhet)",
    area: "30,712",
    pop: "1,688,412",
    desc: "Karnali Province is Nepal's largest province by geographical surface area (30,712 km²), occupying over 20% of the country's total land. Known for pristine alpine landscapes, Shey Phoksundo Lake, and Rara Lake, it consists of 10 districts with the lowest population density in Nepal.",
    districts: [
      { name: "Dolpa", hq: "Dunai", area: "7,889", pop: "42,774" },
      { name: "Humla", hq: "Simikot", area: "5,655", pop: "55,394" },
      { name: "Mugu", hq: "Gamgadhi", area: "3,535", pop: "64,549" },
      { name: "Jumla", hq: "Chandannath", area: "2,531", pop: "118,349" },
      { name: "Surkhet", hq: "Birendranagar", area: "2,451", pop: "415,126" },
      { name: "Jajarkot", hq: "Khalanga", area: "2,230", pop: "189,360" },
      { name: "Kalikot", hq: "Manma", area: "1,741", pop: "145,292" },
      { name: "Western Rukum", hq: "Musikot", area: "1,716", pop: "166,740" },
      { name: "Dailekh", hq: "Narayan", area: "1,502", pop: "252,313" },
      { name: "Salyan", hq: "Sarda (Khalanga)", area: "1,462", pop: "238,515" }
    ]
  },
  {
    name: "Sudurpaschim Province",
    id: "sudurpaschim-province",
    h2Title: "Districts in Sudurpaschim Province (9 Districts)",
    hq: "Godawari (Kailali)",
    area: "19,539",
    pop: "2,694,783",
    desc: "Sudurpaschim Province occupies the far-western territory of Nepal, bordered by India to the west and south, and the Tibet Autonomous Region of China to the north. It consists of 9 districts spanning from the Api Nampa Himalayan conservation area to the fertile plains of Kailali and Kanchanpur.",
    districts: [
      { name: "Bajhang", hq: "Chainpur (Jayaprithvi)", area: "3,422", pop: "189,085" },
      { name: "Kailali", hq: "Dhangadhi", area: "3,235", pop: "904,666" },
      { name: "Darchula", hq: "Khalanga", area: "2,322", pop: "133,310" },
      { name: "Bajura", hq: "Martadi", area: "2,188", pop: "138,523" },
      { name: "Doti", hq: "Silgadhi (Dipayal Silgadhi)", area: "2,025", pop: "204,831" },
      { name: "Achham", hq: "Mangalsen", area: "1,680", pop: "228,852" },
      { name: "Kanchanpur", hq: "Bhimdatta (Mahendranagar)", area: "1,610", pop: "513,757" },
      { name: "Dadeldhura", hq: "Amargadhi", area: "1,538", pop: "139,602" },
      { name: "Baitadi", hq: "Dasharathchand", area: "1,519", pop: "242,157" }
    ]
  }
];

let html = '';

// 1. Opening Paragraph
html += `<p class="wp-block-paragraph lead text-base text-slate-700 leading-relaxed mb-6">Under <a class="rank-math-link" href="https://constitution.topnepali.com/en/schedule-4/">Schedule 4 of the Constitution of Nepal</a>, Nepal is structured into 7 administrative provinces comprising a total of <strong>77 districts</strong>. On April 26, 2017, the Government of Nepal officially divided the former districts of Rukum (into Eastern Rukum and Western Rukum) and Nawalparasi (into Nawalpur and Parasi), establishing the modern 77-district federal framework. Use our interactive live search below to find any district, headquarters, or province, or explore the complete 2026 directory with verified land areas, Census 2021 populations, and regional records.</p>\n\n`;

// 2. Instant District Lookup Tool (below opening paragraph)
html += `<div class="district-lookup-widget mb-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-xs" id="district-lookup-tool">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
    <div>
      <h3 class="text-lg font-extrabold text-slate-900 tracking-tight m-0">Instant District Search &amp; Lookup</h3>
      <p class="text-xs text-slate-500 m-0 mt-1">Search any of the 77 districts by district name, headquarters town, or province.</p>
    </div>
    <span class="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md self-start sm:self-auto">All 77 Districts Verified</span>
  </div>
  <div class="relative">
    <input type="search" id="district-search-input" placeholder="Type district, headquarters, or province (e.g., Kathmandu, Pokhara, Mustang, Jhapa, Gandaki)..." class="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-2xs" autocomplete="off" />
  </div>
  <div id="district-search-status" class="text-xs text-slate-500 mt-2.5 hidden"></div>
  <div id="district-search-results" class="mt-4 hidden space-y-2 max-h-[380px] overflow-y-auto pr-1"></div>
</div>\n\n`;

// 3. Question / Position 0 Snippet Box
html += `<div class="p-6 bg-slate-50 border border-slate-200 rounded-2xl mb-8">
<h2 class="text-lg font-bold text-slate-900 m-0 mb-3" id="quick-answer-how-many-districts">Quick Answer: How Many Districts Are There in Nepal?</h2>
<p class="text-sm text-slate-700 leading-relaxed m-0 mb-3">Nepal has exactly <strong>77 districts</strong> divided across <strong>7 provinces</strong>. Prior to April 2017, Nepal had 75 districts. The total increased to 77 when the government divided two historical districts that crossed provincial boundaries:</p>
<ul class="text-sm text-slate-700 leading-relaxed m-0 space-y-1 mb-3">
<li><strong>Nawalparasi District:</strong> Divided into <em>Nawalpur (Nawalparasi East)</em> in Gandaki Province and <em>Parasi (Nawalparasi West)</em> in Lumbini Province.</li>
<li><strong>Rukum District:</strong> Divided into <em>Eastern Rukum</em> in Lumbini Province and <em>Western Rukum</em> in Karnali Province.</li>
</ul>
<p class="text-sm text-slate-700 leading-relaxed m-0">The constitutional boundaries and territorial allocation of all 77 districts are formally governed by <a class="rank-math-link font-semibold text-indigo-700 underline" href="https://constitution.topnepali.com/en/schedule-4/">Schedule 4 of the Constitution of Nepal</a>.</p>
</div>\n\n`;

// 4. Provinces Summary Table
html += `<h2 class="wp-block-heading" id="provinces-summary-table">Provinces of Nepal at a Glance</h2>\n\n`;
html += `<p class="wp-block-paragraph">Here is the provincial breakdown of Nepal showing provincial capitals, total surface area, official Census 2021 populations, and the number of districts in each province:</p>\n\n`;
html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>Province Name</th><th>Provincial Capital</th><th>Area (km²)</th><th>Population (2021)</th><th>Number of Districts</th></tr></thead><tbody>\n`;

let totalArea = 0;
let totalPop = 0;
let totalDistricts = 0;

provinces.forEach(p => {
  const pArea = parseInt(p.area.replace(/,/g, ''), 10);
  const pPop = parseInt(p.pop.replace(/,/g, ''), 10);
  totalArea += pArea;
  totalPop += pPop;
  totalDistricts += p.districts.length;
  html += `<tr><td><strong>${p.name}</strong></td><td>${p.hq}</td><td>${p.area}</td><td>${p.pop}</td><td><strong>${p.districts.length}</strong></td></tr>\n`;
});

html += `<tr><td colspan="2"><strong>Total (Nepal)</strong></td><td><strong>${totalArea.toLocaleString()}</strong></td><td><strong>${totalPop.toLocaleString()}</strong></td><td><strong>${totalDistricts}</strong></td></tr>\n`;
html += `</tbody></table><figcaption class="wp-element-caption">Comprehensive Overview of Nepal's 7 Provinces (Census 2021)</figcaption></figure>\n\n`;

// 5. Browse by Province Jump Pills
html += `<h2 class="wp-block-heading" id="browse-by-province">Browse Districts by Province</h2>\n\n`;
html += `<p class="wp-block-paragraph">Select any province below to jump directly to its complete district directory:</p>\n\n`;
html += `<div class="flex flex-wrap gap-2 mb-8">\n`;
provinces.forEach(p => {
  html += `  <a href="#${p.id}" class="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg transition">${p.name} (${p.districts.length})</a>\n`;
});
html += `</div>\n\n<hr class="wp-block-separator has-text-color has-background is-style-wide"/>\n\n`;

// 6. Province Directories
provinces.forEach(p => {
  html += `<h2 class="wp-block-heading" id="${p.id}">${p.h2Title}</h2>\n\n`;
  html += `<p class="wp-block-paragraph">${p.desc}</p>\n\n`;
  html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>District Name</th><th>Headquarters</th><th>Area (km²)</th><th>Population (Census 2021)</th></tr></thead><tbody>\n`;
  p.districts.forEach(d => {
    html += `<tr><td><strong>${d.name}</strong></td><td>${d.hq}</td><td>${d.area}</td><td>${d.pop}</td></tr>\n`;
  });
  html += `<tr><td colspan="2"><strong>Total in ${p.name}</strong></td><td><strong>${p.area}</strong></td><td><strong>${p.pop}</strong></td></tr>\n`;
  html += `</tbody></table><figcaption class="wp-element-caption">Official Districts in ${p.name}</figcaption></figure>\n\n`;
});

html += `<hr class="wp-block-separator has-text-color has-background is-style-wide"/>\n\n`;

// 7. Largest & Smallest Districts by Area
html += `<h2 class="wp-block-heading" id="largest-districts-in-nepal-by-area">Top 10 Largest Districts in Nepal by Area</h2>\n\n`;
html += `<p class="wp-block-paragraph">The mountainous Himalayan and trans-Himalayan regions feature vast geographical territory with sparse settlement. Here are the 10 largest districts in Nepal by surface area:</p>\n\n`;
html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>Rank</th><th>District Name</th><th>Province</th><th>Headquarters</th><th>Area (km²)</th></tr></thead><tbody>\n`;

const largestArea = [
  { rank: 1, name: "Dolpa", prov: "Karnali", hq: "Dunai", area: "7,889" },
  { rank: 2, name: "Humla", prov: "Karnali", hq: "Simikot", area: "5,655" },
  { rank: 3, name: "Taplejung", prov: "Koshi", hq: "Taplejung (Fungling)", area: "3,646" },
  { rank: 4, name: "Gorkha", prov: "Gandaki", hq: "Gorkha Bazaar", area: "3,610" },
  { rank: 5, name: "Mustang", prov: "Gandaki", hq: "Jomsom", area: "3,573" },
  { rank: 6, name: "Mugu", prov: "Karnali", hq: "Gamgadhi", area: "3,535" },
  { rank: 7, name: "Sankhuwasabha", prov: "Koshi", hq: "Khandbari", area: "3,480" },
  { rank: 8, name: "Bajhang", prov: "Sudurpaschim", hq: "Chainpur", area: "3,422" },
  { rank: 9, name: "Solukhumbu", prov: "Koshi", hq: "Salleri", area: "3,312" },
  { rank: 10, name: "Kailali", prov: "Sudurpaschim", hq: "Dhangadhi", area: "3,235" }
];

largestArea.forEach(d => {
  html += `<tr><td>${d.rank}</td><td><strong>${d.name}</strong></td><td>${d.prov}</td><td>${d.hq}</td><td><strong>${d.area}</strong></td></tr>\n`;
});
html += `</tbody></table><figcaption class="wp-element-caption">Top 10 Largest Districts in Nepal by Land Area</figcaption></figure>\n\n`;

html += `<h2 class="wp-block-heading" id="smallest-districts-in-nepal-by-area">Top 10 Smallest Districts in Nepal by Area</h2>\n\n`;
html += `<p class="wp-block-paragraph">Due to dense urban settlements in the Kathmandu Valley and historical divisions, certain districts encompass compact territories. Here are the 10 smallest districts in Nepal by surface area:</p>\n\n`;
html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>Rank</th><th>District Name</th><th>Province</th><th>Headquarters</th><th>Area (km²)</th></tr></thead><tbody>\n`;

const smallestArea = [
  { rank: 1, name: "Bhaktapur", prov: "Bagmati", hq: "Bhaktapur", area: "119" },
  { rank: 2, name: "Lalitpur", prov: "Bagmati", hq: "Lalitpur (Patan)", area: "385" },
  { rank: 3, name: "Kathmandu", prov: "Bagmati", hq: "Kathmandu", area: "395" },
  { rank: 4, name: "Parbat", prov: "Gandaki", hq: "Kusma", area: "494" },
  { rank: 5, name: "Terhathum", prov: "Koshi", hq: "Myanglung", area: "679" },
  { rank: 6, name: "Parasi (Nawalparasi West)", prov: "Lumbini", hq: "Ramgram", area: "792" },
  { rank: 7, name: "Dhankuta", prov: "Koshi", hq: "Dhankuta", area: "891" },
  { rank: 8, name: "Mahottari", prov: "Madhesh", hq: "Jaleshwor", area: "1,002" },
  { rank: 9, name: "Okhaldhunga", prov: "Koshi", hq: "Siddhicharan", area: "1,074" },
  { rank: 10, name: "Nuwakot", prov: "Bagmati", hq: "Bidur", area: "1,121" }
];

smallestArea.forEach(d => {
  html += `<tr><td>${d.rank}</td><td><strong>${d.name}</strong></td><td>${d.prov}</td><td>${d.hq}</td><td><strong>${d.area}</strong></td></tr>\n`;
});
html += `</tbody></table><figcaption class="wp-element-caption">Top 10 Smallest Districts in Nepal by Land Area</figcaption></figure>\n\n`;

// 8. Most & Least Populated Districts
html += `<h2 class="wp-block-heading" id="most-populated-districts-in-nepal">Most Populated Districts in Nepal</h2>\n\n`;
html += `<p class="wp-block-paragraph">According to the National Population and Housing Census 2021 conducted by the National Statistics Office, these are the 5 most populated districts in Nepal:</p>\n\n`;
html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>Rank</th><th>District Name</th><th>Province</th><th>Headquarters</th><th>Population (2021)</th></tr></thead><tbody>\n`;

const topPop = [
  { rank: 1, name: "Kathmandu", prov: "Bagmati", hq: "Kathmandu", pop: "2,041,587" },
  { rank: 2, name: "Morang", prov: "Koshi", hq: "Biratnagar", pop: "1,148,156" },
  { rank: 3, name: "Rupandehi", prov: "Lumbini", hq: "Siddharthanagar", pop: "1,121,957" },
  { rank: 4, name: "Jhapa", prov: "Koshi", hq: "Bhadrapur", pop: "998,054" },
  { rank: 5, name: "Sunsari", prov: "Koshi", hq: "Inaruwa", pop: "926,962" }
];

topPop.forEach(d => {
  html += `<tr><td>${d.rank}</td><td><strong>${d.name}</strong></td><td>${d.prov}</td><td>${d.hq}</td><td><strong>${d.pop}</strong></td></tr>\n`;
});
html += `</tbody></table><figcaption class="wp-element-caption">Top 5 Most Populated Districts in Nepal</figcaption></figure>\n\n`;

html += `<h2 class="wp-block-heading" id="least-populated-districts-in-nepal">Least Populated Districts in Nepal</h2>\n\n`;
html += `<p class="wp-block-paragraph">High mountain topography and seasonal migration result in very low population figures in these trans-Himalayan districts:</p>\n\n`;
html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>Rank</th><th>District Name</th><th>Province</th><th>Headquarters</th><th>Population (2021)</th></tr></thead><tbody>\n`;

const lowPop = [
  { rank: 1, name: "Manang", prov: "Gandaki", hq: "Chame", pop: "5,658" },
  { rank: 2, name: "Mustang", prov: "Gandaki", hq: "Jomsom", pop: "14,452" },
  { rank: 3, name: "Dolpa", prov: "Karnali", hq: "Dunai", pop: "42,774" },
  { rank: 4, name: "Rasuwa", prov: "Bagmati", hq: "Dhunche", pop: "46,689" },
  { rank: 5, name: "Humla", prov: "Karnali", hq: "Simikot", pop: "55,394" }
];

lowPop.forEach(d => {
  html += `<tr><td>${d.rank}</td><td><strong>${d.name}</strong></td><td>${d.prov}</td><td>${d.hq}</td><td><strong>${d.pop}</strong></td></tr>\n`;
});
html += `</tbody></table><figcaption class="wp-element-caption">Top 5 Least Populated Districts in Nepal</figcaption></figure>\n\n`;

// 9. Related Official Directories
html += `<h2 class="wp-block-heading" id="related-official-directories">Related Official Directories &amp; Legal References</h2>\n\n`;
html += `<p class="wp-block-paragraph">For full legal provisions on province boundaries and federal territorial distribution, read <a class="rank-math-link" href="https://constitution.topnepali.com/en/schedule-4/">Schedule 4 of the Constitution of Nepal</a> on our official constitutional directory.</p>\n\n`;
html += `<p class="wp-block-paragraph">For delivery, shipping, and official postal codes across all 77 districts, view our complete <a class="rank-math-link" href="https://topnepali.com/postal-code-zip-code-for-nepal/">Nepal Postal Code Directory (All 77 Districts)</a>. If you need landline dial-in STD codes, check out our verified guide to <a class="rank-math-link" href="https://topnepali.com/telephone-area-code/">Nepal Telephone Area Codes (STD Codes)</a>. To explore district-wise demographic distributions, see <a class="rank-math-link" href="https://topnepali.com/population-of-nepal-district-and-province">Population of Nepal (District and Province)</a>.</p>\n\n`;

// 10. RankMath FAQ
html += `<h2 class="wp-block-heading" id="frequently-asked-questions">Frequently Asked Questions (FAQ)</h2>\n\n`;
html += `<div id="rank-math-faq" class="rank-math-block">\n<div class="rank-math-list">\n`;

const faqs = [
  {
    q: "How many districts are there in Nepal?",
    a: "Nepal has exactly 77 districts organized across 7 administrative provinces. Prior to 2017, Nepal had 75 districts before Nawalparasi and Rukum were divided into two separate districts each."
  },
  {
    q: "What does Schedule 4 of the Constitution of Nepal state?",
    a: "Schedule 4 of the Constitution of Nepal establishes the territorial delimitation of Nepal's 7 provinces, explicitly enumerating which districts fall under each respective province."
  },
  {
    q: "Which are the two new districts created in Nepal?",
    a: "The two divided districts that created four new entities are Nawalparasi (divided into Nawalpur in Gandaki Province and Parasi in Lumbini Province) and Rukum (divided into Eastern Rukum in Lumbini Province and Western Rukum in Karnali Province)."
  },
  {
    q: "Which province has the highest and lowest number of districts in Nepal?",
    a: "Koshi Province has the highest number of districts with 14 districts, followed by Bagmati Province with 13 districts. Madhesh Province has the lowest number of districts with 8 districts."
  },
  {
    q: "What is the largest and smallest district in Nepal by area?",
    a: "Dolpa District in Karnali Province is the largest district by surface area, covering 7,889 km². Bhaktapur District in Bagmati Province is the smallest district by surface area, covering only 119 km²."
  },
  {
    q: "What is the most populated and least populated district in Nepal?",
    a: "Kathmandu District is the most populated district in Nepal with 2,041,587 residents according to the 2021 Census. Manang District in Gandaki Province is the least populated district with 5,658 residents."
  }
];

faqs.forEach((f, idx) => {
  html += `<div id="faq-question-dist0${idx + 1}" class="rank-math-list-item">\n`;
  html += `<h3 class="rank-math-question">${f.q}</h3>\n`;
  html += `<div class="rank-math-answer">\n<p>${f.a}</p>\n</div>\n`;
  html += `</div>\n`;
});

html += `</div>\n</div>\n`;

fs.writeFileSync('scripts/new-post-3831-content.html', html, 'utf-8');
console.log('Generated new-post-3831-content.html, length:', html.length);
