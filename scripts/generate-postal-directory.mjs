import fs from 'fs';

const rawContent = fs.readFileSync('/data/data/com.termux/files/home/.gemini/antigravity-cli/brain/8d95ff44-a269-49cf-9a03-1b517d247fb1/scratch/post-3533-content.html', 'utf-8');

// Parse provinces and districts
const provinceConfig = [
  {
    name: "Koshi Province",
    id: "koshi-province",
    h2Title: "Postal Codes for Koshi Province (14 Districts)",
    districts: [
      "Bhojpur", "Dhankuta", "Ilam", "Jhapa", "Khotang", "Morang", 
      "Okhaldhunga", "Panchthar", "Sankhuwasabha", "Solukhumbu", 
      "Sunsari", "Taplejung", "Terhathum", "Udayapur"
    ]
  },
  {
    name: "Madhesh Province",
    id: "madhesh-province",
    h2Title: "Postal Codes for Madhesh Province (8 Districts)",
    districts: [
      "Bara", "Dhanusa", "Mahottari", "Parsa", "Rautahat", 
      "Saptari", "Sarlahi", "Siraha"
    ]
  },
  {
    name: "Bagmati Province",
    id: "bagmati-province",
    h2Title: "Postal Codes for Bagmati Province (13 Districts)",
    districts: [
      "Bhaktapur", "Chitwan", "Dhading", "Dolakha", "Kathmandu", 
      "Kavrepalanchok", "Lalitpur", "Makawanpur", "Nuwakot", 
      "Ramechhap", "Rasuwa", "Sindhuli", "Sindhupalchok"
    ]
  },
  {
    name: "Gandaki Province",
    id: "gandaki-province",
    h2Title: "Postal Codes for Gandaki Province (11 Districts)",
    districts: [
      "Baglung", "Gorkha", "Kaski", "Lamjung", "Manang", 
      "Mustang", "Myagdi", "Nawalparasi Bardaghat Susta East", 
      "Parbat", "Syangja", "Tanahu"
    ]
  },
  {
    name: "Lumbini Province",
    id: "lumbini-province",
    h2Title: "Postal Codes for Lumbini Province (12 Districts)",
    districts: [
      "Arghakhanchi", "Banke", "Bardiya", "Dang", "Gulmi", 
      "Kapilvastu", "Parasi", "Palpa", "Pyuthan", "Rolpa", 
      "Rukum", "Rupandehi"
    ]
  },
  {
    name: "Karnali Province",
    id: "karnali-province",
    h2Title: "Postal Codes for Karnali Province (10 Districts)",
    districts: [
      "Dailekh", "Dolpa", "Humla", "Jajarkot", "Jumla", 
      "Kalikot", "Mugu", "Rukum Paschim", "Salyan", "Surkhet"
    ]
  },
  {
    name: "Sudurpaschim Province",
    id: "sudurpaschim-province",
    h2Title: "Postal Codes for Sudurpaschim Province (9 Districts)",
    districts: [
      "Achham", "Baitadi", "Bajhang", "Bajura", "Dadeldhura", 
      "Darchula", "Doti", "Kailali", "Kanchanpur"
    ]
  }
];

// Extract all district blocks from the original content
const districtRegex = /<h3[^>]*id="([^"]+)"[^>]*>(.*?)<\/h3>([\s\S]*?)<table[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody><\/table>/gi;
const parsedDistricts = new Map();

for (const m of rawContent.matchAll(districtRegex)) {
  const slug = m[1];
  const rawName = m[2].replace(/&amp;/g, '&').trim();
  const districtName = rawName.replace(/District/i, '').trim();
  const middle = m[3];
  const dpoMatch = middle.match(/District Post Office\s+([^<]+?)\s+is\s+(\d+)/i) || middle.match(/Postal Code.*?is\s+(\d+)/i);
  let dpoCode = dpoMatch ? (dpoMatch[2] || dpoMatch[1]) : "";
  if (slug === 'baitadi-district') dpoCode = "10200";

  const rows = [...m[4].matchAll(/<tr>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/gi)].map(r => ({
    location: r[1].replace(/&amp;/g, '&').trim(),
    code: r[2].trim()
  }));

  parsedDistricts.set(districtName.toLowerCase(), {
    slug,
    name: districtName,
    fullName: `${districtName} District`,
    dpoCode,
    offices: rows
  });
}

console.log(`Parsed ${parsedDistricts.size} districts from raw content.`);

// Major Hubs Table data
const majorCities = [
  { city: "Kathmandu (GPO Sundhara)", province: "Bagmati", office: "Kathmandu Central (GPO)", code: "44600", notes: "Default ZIP code for international online forms" },
  { city: "Lalitpur (Patan)", province: "Bagmati", office: "Lalitpur District Post Office", code: "44700", notes: "Covers Patan, Jawalakhel, Kupondole, Pulchowk" },
  { city: "Bhaktapur", province: "Bagmati", office: "Bhaktapur District Post Office", code: "44800", notes: "Covers Bhaktapur Durbar, Suryabinayak, Thimi" },
  { city: "Pokhara (Kaski)", province: "Gandaki", office: "Kaski District Post Office", code: "33700", notes: "Covers Lakeside, Chipledhunga, Mahendrapool" },
  { city: "Bharatpur (Chitwan)", province: "Bagmati", office: "Chitwan District Post Office", code: "44200", notes: "Covers Narayangarh, Bharatpur Central" },
  { city: "Biratnagar (Morang)", province: "Koshi", office: "Morang District Post Office", code: "56600", notes: "Commercial and industrial center of Koshi" },
  { city: "Birgunj (Parsa)", province: "Madhesh", office: "Parsa District Post Office", code: "44300", notes: "Nepal's primary import-export gateway" },
  { city: "Butwal (Rupandehi)", province: "Lumbini", office: "Rupandehi District Post Office", code: "32907", notes: "Key trade hub of Lumbini Province" },
  { city: "Dharan (Sunsari)", province: "Koshi", office: "Sunsari District Post Office", code: "56700", notes: "Eastern sub-metropolitan center" },
  { city: "Nepalgunj (Banke)", province: "Lumbini", office: "Banke District Post Office", code: "21900", notes: "Western business and transit hub" },
  { city: "Dhangadhi (Kailali)", province: "Sudurpaschim", office: "Kailali District Post Office", code: "10900", notes: "Commercial capital of Sudurpaschim" },
  { city: "Hetauda (Makwanpur)", province: "Bagmati", office: "Makwanpur District Post Office", code: "44100", notes: "Provincial capital of Bagmati Province" }
];

function buildModernHtml() {
  let html = '';

  // 1. Featured Callout / Position 0 Snippet
  html += '<div class="p-6 bg-slate-50 border border-slate-200 rounded-2xl mb-8">\n';
  html += '<h2 class="text-lg font-bold text-slate-900 m-0 mb-3" id="quick-answer-nepal-zip-code">Quick Answer: Does Nepal Have a Single Nationwide ZIP Code?</h2>\n';
  html += '<p class="text-sm text-slate-700 leading-relaxed m-0 mb-3"><strong>No.</strong> Nepal does not have a single nationwide postal code. Instead, the Postal Services Department (General Post Office Nepal) administers a <strong>5-digit postal code system</strong> assigned to specific districts and local post offices.</p>\n';
  html += '<p class="text-sm text-slate-700 leading-relaxed m-0"><strong>What to enter for international forms (Amazon, PayPal, Google Play, Apple ID, AliExpress)?</strong> When an international billing or shipping form requires a general postal code for Nepal, the internationally accepted standard is <strong>44600</strong> (Kathmandu General Post Office, Sundhara), or you may enter your specific local 5-digit code from the verified directory below. <em>Important: "+977" and "00977" are international telephone country calling codes, not valid postal codes.</em></p>\n';
  html += '</div>\n\n';

  // 2. Major Cities Quick Reference Table
  html += '<h2 class="wp-block-heading" id="top-major-cities-postal-codes">Top 12 Major Cities: Quick Postal Code Reference</h2>\n\n';
  html += '<p class="wp-block-paragraph">For quick access, here are the official 5-digit postal codes for Nepal’s largest metropolitan areas, provincial capitals, and major commercial hubs:</p>\n\n';

  html += '<figure class="wp-block-table is-style-stripes"><table class="has-fixed-layout"><thead><tr><th>Metropolitan / Hub</th><th>Province</th><th>Main Post Office</th><th>Postal Code</th><th>Notes / Coverage</th></tr></thead><tbody>\n';
  majorCities.forEach(c => {
    html += `<tr><td><strong>${c.city}</strong></td><td>${c.province}</td><td>${c.office}</td><td><strong>${c.code}</strong></td><td>${c.notes}</td></tr>\n`;
  });
  html += '</tbody></table></figure>\n\n';

  // 3. Interactive Instant Postal Code Search Tool
  html += '<div class="postal-lookup-widget my-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-xs" id="postal-lookup-tool">\n';
  html += '  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">\n';
  html += '    <div>\n';
  html += '      <h3 class="text-lg font-extrabold text-slate-900 tracking-tight m-0">Instant Postal Code Search &amp; Lookup</h3>\n';
  html += '      <p class="text-xs text-slate-500 m-0 mt-1">Search any municipality, town, post office, district, or 5-digit code across Nepal.</p>\n';
  html += '    </div>\n';
  html += '    <span class="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md self-start sm:self-auto">All 77 Districts Verified</span>\n';
  html += '  </div>\n';
  html += '  <div class="relative">\n';
  html += '    <input type="search" id="postal-code-search-input" placeholder="Type city, area, district, or code (e.g., Kathmandu, Pokhara, Baneshwor, 44600)..." class="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-2xs" autocomplete="off" />\n';
  html += '  </div>\n';
  html += '  <div id="postal-search-status" class="text-xs text-slate-500 mt-2.5 hidden"></div>\n';
  html += '  <div id="postal-search-results" class="mt-4 hidden space-y-2 max-h-[380px] overflow-y-auto pr-1"></div>\n';
  html += '</div>\n\n';

  // 4. Province Quick Navigation Links
  html += '<h2 class="wp-block-heading" id="browse-by-province">Browse Postal Codes by Province</h2>\n\n';
  html += '<p class="wp-block-paragraph">Select your province below to jump directly to its complete district directory:</p>\n\n';

  html += '<div class="flex flex-wrap gap-2 mb-8">\n';
  provinceConfig.forEach(p => {
    html += `  <a href="#${p.id}" class="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg transition">${p.name}</a>\n`;
  });
  html += '</div>\n\n';

  html += '<hr class="wp-block-separator has-text-color has-background is-style-wide"/>\n\n';

  // 5. Province and District Tables
  provinceConfig.forEach(p => {
    html += `<h2 class="wp-block-heading" id="${p.id}">${p.h2Title}</h2>\n\n`;

    p.districts.forEach(dName => {
      const distData = parsedDistricts.get(dName.toLowerCase());
      if (!distData) {
        console.warn(`District data missing for: ${dName}`);
        return;
      }

      html += `<h3 class="wp-block-heading" id="${distData.slug}">${distData.name} District</h3>\n\n`;
      html += `<p class="wp-block-paragraph">The primary Postal Code for the District Post Office of <strong>${distData.name}</strong> is <strong>${distData.dpoCode}</strong>.</p>\n\n`;

      html += '<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>Post Office / Location</th><th>Postal Code (ZIP Code)</th></tr></thead><tbody>\n';
      
      // Main DPO row
      html += `<tr><td><strong>${distData.name} District Post Office (Main DPO)</strong></td><td><strong>${distData.dpoCode}</strong></td></tr>\n`;

      // Sub post offices
      distData.offices.forEach(off => {
        // avoid duplicating DPO if already in offices with exact same name
        if (off.location.toLowerCase() !== distData.name.toLowerCase()) {
          html += `<tr><td>${off.location}</td><td>${off.code}</td></tr>\n`;
        }
      });

      html += `</tbody></table><figcaption class="wp-element-caption">Official Postal Codes for ${distData.name} District (${p.name})</figcaption></figure>\n\n`;
    });

    html += '<hr class="wp-block-separator has-text-color has-background is-style-wide"/>\n\n';
  });

  // 6. E-Commerce & Banking Context (Internal Linking Matrix)
  html += '<h2 class="wp-block-heading" id="using-postal-codes-for-deliveries-and-banking">Using Postal Codes for Online Shopping &amp; International Banking</h2>\n\n';
  html += '<p class="wp-block-paragraph">Accurate postal codes are essential when ordering goods online or receiving international parcel shipments. For seamless parcel delivery across Nepal from domestic and international e-commerce merchants, explore our verified directory of <a class="rank-math-link" href="https://topnepali.com/top-nepali-online-shopping-sites/">Top Nepali Online Shopping Sites</a>.</p>\n\n';
  html += '<p class="wp-block-paragraph">When receiving international wire remittances, SWIFT bank transfers, or foreign invoice settlements into Nepali commercial bank accounts, you may also need bank branch identification codes alongside your address postal code. Check out our comprehensive guide to <a class="rank-math-link" href="https://topnepali.com/swift-codes-of-banks-in-nepal/">Swift Codes of Commercial Banks in Nepal</a>.</p>\n\n';

  // 7. RankMath FAQ Schema
  html += '<h2 class="wp-block-heading" id="frequently-asked-questions">Frequently Asked Questions (FAQ)</h2>\n\n';
  html += '<div id="rank-math-faq" class="rank-math-block">\n';
  html += '<div class="rank-math-list">\n';

  const faqs = [
    {
      q: "What is the postal code of Nepal for international forms?",
      a: "Nepal does not have a single nationwide postal code. When international websites (such as Amazon, PayPal, Google Play, Apple ID, or AliExpress) require a general ZIP or postal code for Nepal, use 44600 (Kathmandu General Post Office at Sundhara), or enter your specific district post office code."
    },
    {
      q: "Can I use +977 or 00977 as a postal code for Nepal?",
      a: "No. +977 (or 00977) is Nepal's international telephone country calling code, not a postal code. Entering +977 into a postal code field will cause address validation failures on checkout forms. Always enter a valid 5-digit postal code such as 44600."
    },
    {
      q: "How does the 5-digit postal code system work in Nepal?",
      a: "Administered by the Department of Postal Services under the Ministry of Communications and Information Technology, Nepal's postal code system uses 5 digits. The first two digits identify the specific district, while the last three digits indicate the designated post office or delivery area within that district."
    },
    {
      q: "What is the postal code of Kathmandu, Lalitpur, and Bhaktapur?",
      a: "In the Kathmandu Valley, the primary District Post Office codes are: Kathmandu GPO (44600), Lalitpur Patan DPO (44700), and Bhaktapur DPO (44800). Prominent sub-areas in Kathmandu include Dillibazar (44605), Bansbari (44606), Kalimati (44614), Balaju (44611), and Kirtipur (44618)."
    },
    {
      q: "What is the postal code of Pokhara and Kaski District?",
      a: "The postal code for Pokhara (Kaski District Post Office) is 33700. Sub-post offices in the Pokhara valley include Batulechaur (33702), Hemja (33708), and Gagangaunda (33711)."
    }
  ];

  faqs.forEach((faq, idx) => {
    html += `<div id="faq-question-postal0${idx + 1}" class="rank-math-list-item">\n`;
    html += `<h3 class="rank-math-question">${faq.q}</h3>\n`;
    html += `<div class="rank-math-answer">\n`;
    html += `<p>${faq.a}</p>\n`;
    html += `</div>\n`;
    html += `</div>\n`;
  });

  html += '</div>\n';
  html += '</div>\n';

  return html;
}

const html = buildModernHtml();
console.log(`Generated HTML length: ${html.length} characters`);

// Quality checks
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
if (emojiRegex.test(html)) {
  console.error("FAIL: Emojis detected in generated content!");
  process.exit(1);
} else {
  console.log("PASS: Zero emojis detected.");
}

if (html.includes("wp.topnepali.com")) {
  console.error("FAIL: Origin URL wp.topnepali.com found!");
  process.exit(1);
} else {
  console.log("PASS: Zero origin URLs found.");
}

fs.writeFileSync('/sdcard/Termux/Agy/topnepali/scripts/new-post-3533-content.html', html);
console.log("Successfully saved to new-post-3533-content.html");
