import fs from 'fs';

const cities = [
  {
    rank: 1,
    name: "Dharan Sub-Metropolitan City",
    shortName: "Dharan",
    district: "Sunsari",
    province: "Koshi Province",
    area: "192.32",
    pop: "166,531",
    wards: 20,
    highlights: "Major medical and educational hub of eastern Nepal; home to B.P. Koirala Institute of Health Sciences (BPKIHS) and gateway to the eastern hills."
  },
  {
    rank: 2,
    name: "Itahari Sub-Metropolitan City",
    shortName: "Itahari",
    district: "Sunsari",
    province: "Koshi Province",
    area: "93.78",
    pop: "197,241",
    wards: 20,
    highlights: "Eastern Nepal's principal transport crossroads at the intersection of the East-West (Mahendra) Highway and North-South (Koshi) Highway."
  },
  {
    rank: 3,
    name: "Janakpur Sub-Metropolitan City",
    shortName: "Janakpurdham",
    district: "Dhanusha",
    province: "Madhesh Province",
    area: "91.17",
    pop: "194,556",
    wards: 25,
    highlights: "Historic cultural and religious capital of ancient Mithila; famous for the Janaki Mandir and holy ponds; connecting railway terminus to India."
  },
  {
    rank: 4,
    name: "Jeetpur Simara Sub-Metropolitan City",
    shortName: "Jeetpur Simara",
    district: "Bara",
    province: "Madhesh Province",
    area: "309.67",
    pop: "127,307",
    wards: 24,
    highlights: "Crucial commercial transport node hosting Simara Domestic Airport and the Pathlaiya junction connecting the Birgunj-Raxaul trade corridor."
  },
  {
    rank: 5,
    name: "Kalaiya Sub-Metropolitan City",
    shortName: "Kalaiya",
    district: "Bara",
    province: "Madhesh Province",
    area: "108.94",
    pop: "136,222",
    wards: 27,
    highlights: "District administrative headquarters of Bara District; central agricultural market near the holy temple site of Gadhimai."
  },
  {
    rank: 6,
    name: "Hetauda Sub-Metropolitan City",
    shortName: "Hetauda",
    district: "Makwanpur",
    province: "Bagmati Province",
    area: "261.59",
    pop: "193,576",
    wards: 19,
    highlights: "Provincial capital of Bagmati Province; prominent industrial district hosting major chemical, manufacturing, and food processing facilities."
  },
  {
    rank: 7,
    name: "Butwal Sub-Metropolitan City",
    shortName: "Butwal",
    district: "Rupandehi",
    province: "Lumbini Province",
    area: "101.61",
    pop: "194,335",
    wards: 19,
    highlights: "Leading commercial powerhouse in western Nepal at the base of the Chure hills; junction of Siddhartha and Mahendra Highways."
  },
  {
    rank: 8,
    name: "Ghorahi Sub-Metropolitan City",
    shortName: "Ghorahi",
    district: "Dang",
    province: "Lumbini Province",
    area: "522.21",
    pop: "200,530",
    wards: 19,
    highlights: "Largest sub-metropolitan city by land area (522.21 km²) and most populous sub-metro in Nepal; commercial capital of the inner Terai Dang valley."
  },
  {
    rank: 9,
    name: "Tulsipur Sub-Metropolitan City",
    shortName: "Tulsipur",
    district: "Dang",
    province: "Lumbini Province",
    area: "384.63",
    pop: "179,755",
    wards: 19,
    highlights: "Western hub of Dang District hosting Tarigaun Domestic Airport and High Court Tulsipur; gateway to Salyan and Rolpa."
  },
  {
    rank: 10,
    name: "Nepalgunj Sub-Metropolitan City",
    shortName: "Nepalgunj",
    district: "Banke",
    province: "Lumbini Province",
    area: "85.94",
    pop: "164,444",
    wards: 23,
    highlights: "Compact historical commercial hub and key transit portal connecting Nepal's western border with India, Karnali Province, and Sudurpaschim."
  },
  {
    rank: 11,
    name: "Dhangadhi Sub-Metropolitan City",
    shortName: "Dhangadhi",
    district: "Kailali",
    province: "Sudurpaschim Province",
    area: "261.75",
    pop: "198,792",
    wards: 19,
    highlights: "Commercial, financial, and educational capital of Sudurpaschim Province; main transit and aviation hub for far-western Nepal."
  }
];

let html = '';

// 1. Opening Paragraph
html += `<p class="wp-block-paragraph lead text-base text-slate-700 leading-relaxed mb-6">In Nepal's federal local governance framework, a <strong>Sub-Metropolitan City (उपमहानगरपालिका / Upa-Mahanagarpalika)</strong> represents an advanced tier of municipal local government situated between a standard Municipality (Nagarpalika) and a Metropolitan City (Mahanagarpalika). Out of Nepal's <strong>753 local levels</strong>, exactly <strong>11 cities</strong> hold sub-metropolitan status under the <strong>Local Government Operation Act, 2074 (2017)</strong>. Explore our complete 2026 directory below with instant live search, area rankings, Census 2021 populations, legal declaration criteria, and city profiles.</p>\n\n`;

// 2. Instant Searchbox (below opening paragraph)
html += `<div class="sub-metro-lookup-widget mb-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-xs" id="sub-metro-lookup-tool">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
    <div>
      <h3 class="text-lg font-extrabold text-slate-900 tracking-tight m-0">Instant Sub-Metropolitan City Lookup</h3>
      <p class="text-xs text-slate-500 m-0 mt-1">Search any of Nepal's 11 sub-metropolitan cities by city name, district, or province.</p>
    </div>
    <span class="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md self-start sm:self-auto">All 11 Cities Verified</span>
  </div>
  <div class="relative">
    <input type="search" id="sub-metro-search-input" placeholder="Type city, district, or province (e.g., Dharan, Butwal, Janakpur, Dang, Lumbini)..." class="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-2xs" autocomplete="off" />
  </div>
  <div id="sub-metro-search-status" class="text-xs text-slate-500 mt-2.5 hidden"></div>
  <div id="sub-metro-search-results" class="mt-4 hidden space-y-2 max-h-[380px] overflow-y-auto pr-1"></div>
</div>\n\n`;

// 3. Question / Position 0 Snippet Box
html += `<div class="p-6 bg-slate-50 border border-slate-200 rounded-2xl mb-8">
<h2 class="text-lg font-bold text-slate-900 m-0 mb-3" id="quick-answer-sub-metropolitan-cities">Quick Answer: How Many Sub-Metropolitan Cities Are There in Nepal?</h2>
<p class="text-sm text-slate-700 leading-relaxed m-0 mb-3">Nepal has exactly <strong>11 Sub-Metropolitan Cities (Upa-Mahanagarpalika)</strong> distributed across 5 provinces:</p>
<ul class="text-sm text-slate-700 leading-relaxed m-0 space-y-1 mb-3">
<li><strong>Koshi Province (2):</strong> Dharan and Itahari (both in Sunsari District)</li>
<li><strong>Madhesh Province (3):</strong> Janakpurdham (Dhanusha), Jeetpur Simara (Bara), and Kalaiya (Bara)</li>
<li><strong>Bagmati Province (1):</strong> Hetauda (Makwanpur District — Bagmati Provincial Capital)</li>
<li><strong>Lumbini Province (4):</strong> Butwal (Rupandehi), Ghorahi (Dang), Tulsipur (Dang), and Nepalgunj (Banke)</li>
<li><strong>Sudurpaschim Province (1):</strong> Dhangadhi (Kailali District)</li>
<li><strong>Gandaki and Karnali Provinces (0):</strong> Neither province has a sub-metropolitan city (Pokhara in Gandaki is a full Metropolitan City).</li>
</ul>
<p class="text-sm text-slate-700 leading-relaxed m-0">To attain sub-metropolitan status under the <strong>Local Government Operation Act, 2074</strong>, an urban local level must achieve a permanent population of at least <strong>200,000</strong> (or 150,000 in hilly/mountain regions), generate an average annual internal revenue of at least <strong>NPR 250 million (NPR 25 Crore)</strong> over the past 5 years, and maintain specialized urban facilities including a 200-bed hospital network, a national-standard stadium, and paved arterial road corridors.</p>
</div>\n\n`;

// 4. Clean Table of Contents
html += `<div class="wp-block-uagb-table-of-contents my-8">
  <div class="uagb-toc__wrap">
    <div class="uagb-toc__title">Table of Contents</div>
    <ol class="uagb-toc__list">
      <li><a href="#complete-list-of-sub-metropolitan-cities">Complete List of 11 Sub-Metropolitan Cities in Nepal</a></li>
      <li><a href="#top-sub-metropolitan-cities-by-area">Top Sub-Metropolitan Cities by Land Area</a></li>
      <li><a href="#top-sub-metropolitan-cities-by-population">Top Sub-Metropolitan Cities by Population (Census 2021)</a></li>
      <li><a href="#criteria-for-sub-metropolitan-city">Legal Criteria for Declaration as a Sub-Metropolitan City</a></li>
      <li><a href="#frequently-asked-questions">Frequently Asked Questions (FAQ)</a></li>
    </ol>
  </div>
</div>\n\n`;

// 5. Complete Master Table
html += `<h2 class="wp-block-heading" id="complete-list-of-sub-metropolitan-cities">Complete List of 11 Sub-Metropolitan Cities in Nepal</h2>\n\n`;
html += `<p class="wp-block-paragraph">The following master table presents all 11 sub-metropolitan cities in Nepal arranged in geographic order from east to west, including their district, province, surface area, Census 2021 population, and total ward count:</p>\n\n`;
html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>SN</th><th>Sub-Metropolitan City</th><th>District (Province)</th><th>Area (km²)</th><th>Population (2021)</th><th>Wards</th></tr></thead><tbody>\n`;

cities.forEach(c => {
  html += `<tr><td>${c.rank}</td><td><strong>${c.name}</strong></td><td>${c.district} (${c.province.replace(' Province', '')})</td><td><strong>${c.area}</strong></td><td><strong>${c.pop}</strong></td><td>${c.wards}</td></tr>\n`;
});

html += `</tbody></table><figcaption class="wp-element-caption">Official Directory of Nepal's 11 Sub-Metropolitan Cities (Source: National Statistics Office &amp; MoFAGA)</figcaption></figure>\n\n`;

// 6. Rankings by Area & Population
html += `<h2 class="wp-block-heading" id="top-sub-metropolitan-cities-by-area">Top Sub-Metropolitan Cities by Land Area</h2>\n\n`;
html += `<p class="wp-block-paragraph">Geographical surface areas of sub-metropolitan cities vary significantly. Inner Terai valleys host large merged rural-urban land extents, while historic commercial cities remain compact:</p>\n\n`;

const byArea = [...cities].sort((a, b) => parseFloat(b.area) - parseFloat(a.area)).slice(0, 5);
html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>Rank</th><th>Sub-Metropolitan City</th><th>District</th><th>Province</th><th>Area (km²)</th></tr></thead><tbody>\n`;
byArea.forEach((c, i) => {
  html += `<tr><td>${i + 1}</td><td><strong>${c.name}</strong></td><td>${c.district}</td><td>${c.province}</td><td><strong>${c.area} km²</strong></td></tr>\n`;
});
html += `</tbody></table><figcaption class="wp-element-caption">Top 5 Largest Sub-Metropolitan Cities in Nepal by Land Area</figcaption></figure>\n\n`;

html += `<h2 class="wp-block-heading" id="top-sub-metropolitan-cities-by-population">Top Sub-Metropolitan Cities by Population (Census 2021)</h2>\n\n`;
html += `<p class="wp-block-paragraph">Based on the final results of the National Population and Housing Census 2021 administered by the National Statistics Office (NSO), here are the 5 most populated sub-metropolitan cities in Nepal:</p>\n\n`;

const byPop = [...cities].sort((a, b) => parseInt(b.pop.replace(/,/g, ''), 10) - parseInt(a.pop.replace(/,/g, ''), 10)).slice(0, 5);
html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>Rank</th><th>Sub-Metropolitan City</th><th>District</th><th>Province</th><th>Population (2021)</th></tr></thead><tbody>\n`;
byPop.forEach((c, i) => {
  html += `<tr><td>${i + 1}</td><td><strong>${c.name}</strong></td><td>${c.district}</td><td>${c.province}</td><td><strong>${c.pop}</strong></td></tr>\n`;
});
html += `</tbody></table><figcaption class="wp-element-caption">Top 5 Most Populated Sub-Metropolitan Cities in Nepal (Census 2021)</figcaption></figure>\n\n`;

// 7. Legal Criteria
html += `<h2 class="wp-block-heading" id="criteria-for-sub-metropolitan-city">Legal Criteria for Declaration as a Sub-Metropolitan City</h2>\n\n`;
html += `<p class="wp-block-paragraph">Section 4 of the <strong>Local Government Operation Act, 2074 (स्थानीय सरकार सञ्चालन ऐन, २०७४)</strong> specifies the minimum legal and infrastructural thresholds required for a local government body to be classified as an Upa-Mahanagarpalika:</p>\n\n`;

const criteria = [
  { subject: "Permanent Population", detail: "Minimum permanent resident population of at least 200,000 in Terai and Inner Terai, or at least 150,000 in Hilly and Mountainous regions." },
  { subject: "Annual Internal Revenue", detail: "Average annual internal revenue (excluding government equalization grants) of at least NPR 250,000,000 (NPR 25 Crore) over the preceding 5 consecutive fiscal years." },
  { subject: "Healthcare Facilities", detail: "Total hospital capacity of at least 200 beds within the municipal territory, including at least one specialized hospital with 100 or more beds." },
  { subject: "Sports & Athletics", detail: "National-standard sports stadium, covered athletic hall, and dedicated public gymnasium." },
  { subject: "Roads & Transportation", detail: "Paved (blacktopped) main urban arterial roads, regular public transport networks, and integrated street lighting." },
  { subject: "Civic & Assembly Facilities", detail: "Town assembly hall (Nagar Sabha Griha), public exhibition grounds, well-maintained municipal parks, and open recreational green spaces." },
  { subject: "Waste Management", detail: "Operational scientific waste processing and recycling facility, and modern sewage infrastructure." },
  { subject: "Public Utilities & Abattoir", detail: "Modern hygienic slaughterhouse (abattoir), organized electric/traditional crematorium, and uninterrupted drinking water and electricity grids." },
  { subject: "Universal Accessibility", detail: "Public municipal buildings, walkways, and civic spaces constructed to be fully accessible for differently-abled citizens." },
  { subject: "Hospitality & Tourism", detail: "Tourist-standard hotels, lodges, and conference facilities meeting national hospitality standards." }
];

html += `<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>Criteria Category</th><th>Statutory Requirement (Local Government Operation Act 2074)</th></tr></thead><tbody>\n`;
criteria.forEach(item => {
  html += `<tr><td><strong>${item.subject}</strong></td><td>${item.detail}</td></tr>\n`;
});
html += `</tbody></table><figcaption class="wp-element-caption">Statutory Classification Criteria for Sub-Metropolitan Cities under Nepali Law</figcaption></figure>\n\n`;

// 8. Related Official Resources
html += `<h2 class="wp-block-heading" id="related-official-directories">Related Official Directories</h2>\n\n`;
html += `<p class="wp-block-paragraph">For constitutional boundaries and district classifications under the federal system, read our comprehensive guide to the <a class="rank-math-link" href="https://topnepali.com/districts-in-nepal/">List of 77 Districts in Nepal (With Province Details)</a> and explore <a class="rank-math-link" href="https://constitution.topnepali.com/en/schedule-4/">Schedule 4 of the Constitution of Nepal</a>.</p>\n\n`;
html += `<p class="wp-block-paragraph">If you are sending mail or courier packages, check the official <a class="rank-math-link" href="https://topnepali.com/postal-code-zip-code-for-nepal/">Nepal Postal Code Directory (All 77 Districts)</a>. For landline calling and regional dial-in codes, consult our guide to <a class="rank-math-link" href="https://topnepali.com/telephone-area-code/">Nepal Telephone Area Codes (STD Codes)</a>.</p>\n\n`;

// 9. RankMath FAQ
html += `<h2 class="wp-block-heading" id="frequently-asked-questions">Frequently Asked Questions (FAQ)</h2>\n\n`;
html += `<div id="rank-math-faq" class="rank-math-block">\n<div class="rank-math-list">\n`;

const faqs = [
  {
    q: "How many sub-metropolitan cities are there in Nepal?",
    a: "Nepal has exactly 11 sub-metropolitan cities (Upa-Mahanagarpalika): Dharan, Itahari, Janakpurdham, Jeetpur Simara, Kalaiya, Hetauda, Butwal, Ghorahi, Tulsipur, Nepalgunj, and Dhangadhi."
  },
  {
    q: "Which is the largest sub-metropolitan city in Nepal by area?",
    a: "Ghorahi Sub-Metropolitan City in Dang District is the largest sub-metropolitan city in Nepal by land area, covering 522.21 square kilometers, followed by Tulsipur (384.63 km²)."
  },
  {
    q: "Which is the most populated sub-metropolitan city in Nepal?",
    a: "Ghorahi Sub-Metropolitan City is the most populated sub-metropolitan city with a population of 200,530 according to the 2021 National Census, closely followed by Dhangadhi (198,792) and Itahari (197,241)."
  },
  {
    q: "Which is the smallest sub-metropolitan city in Nepal by area?",
    a: "Nepalgunj Sub-Metropolitan City in Banke District is the smallest sub-metropolitan city by surface area, covering only 85.94 square kilometers."
  },
  {
    q: "Which provinces in Nepal do not have a sub-metropolitan city?",
    a: "Gandaki Province and Karnali Province do not have any sub-metropolitan cities. In Gandaki Province, Pokhara is classified directly as a Metropolitan City (Mahanagarpalika)."
  },
  {
    q: "What is the minimum annual revenue required to become a sub-metropolitan city in Nepal?",
    a: "Under the Local Government Operation Act, 2074, a local municipality must have an average annual internal income/revenue of at least NPR 250,000,000 (NPR 25 Crore) over the last five consecutive years."
  }
];

faqs.forEach((f, idx) => {
  html += `<div id="faq-question-submetro0${idx + 1}" class="rank-math-list-item">\n`;
  html += `<h3 class="rank-math-question">${f.q}</h3>\n`;
  html += `<div class="rank-math-answer">\n<p>${f.a}</p>\n</div>\n`;
  html += `</div>\n`;
});

html += `</div>\n</div>\n`;

fs.writeFileSync('scripts/new-post-9870-content.html', html, 'utf-8');
console.log('Generated new-post-9870-content.html, length:', html.length);
