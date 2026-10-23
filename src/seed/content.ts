/**
 * Demonstration content for local development and tests.
 *
 * These are evergreen explainers and service guides written for this
 * project: they describe general, well-established practices and contain
 * no invented events, quotes, sources or statistics. Replace or archive them
 * before launch (see docs/OPERATIONS.md).
 */

export interface SeedCategory {
  key: string;
  name: { bn: string; en: string };
  slug: { bn: string; en: string };
  description: { bn: string; en: string };
  parent?: string;
  order: number;
}

export const categories: SeedCategory[] = [
  { key: "national", order: 1, name: { bn: "জাতীয়", en: "National" }, slug: { bn: "জাতীয়", en: "national" }, description: { bn: "দেশের খবর, জনজীবন ও সেবা", en: "News, public life and services across the country" } },
  { key: "politics", order: 2, name: { bn: "রাজনীতি", en: "Politics" }, slug: { bn: "রাজনীতি", en: "politics" }, description: { bn: "রাষ্ট্র, সংসদ ও নীতি", en: "Government, parliament and policy" } },
  { key: "economy", order: 3, name: { bn: "অর্থনীতি", en: "Economy" }, slug: { bn: "অর্থনীতি", en: "economy" }, description: { bn: "বাজার, ব্যাংকিং ও ব্যক্তিগত অর্থ", en: "Markets, banking and personal finance" } },
  { key: "world", order: 4, name: { bn: "আন্তর্জাতিক", en: "World" }, slug: { bn: "আন্তর্জাতিক", en: "world" }, description: { bn: "বিশ্বের খবর ও প্রতিষ্ঠান", en: "Global news and institutions" } },
  { key: "sports", order: 5, name: { bn: "খেলা", en: "Sports" }, slug: { bn: "খেলা", en: "sports" }, description: { bn: "মাঠের খবর ও খেলার নিয়ম", en: "Games, players and the rules" } },
  { key: "cricket", order: 6, parent: "sports", name: { bn: "ক্রিকেট", en: "Cricket" }, slug: { bn: "ক্রিকেট", en: "cricket" }, description: { bn: "ক্রিকেটের খবর ও বিশ্লেষণ", en: "Cricket news and analysis" } },
  { key: "science", order: 7, name: { bn: "বিজ্ঞান ও প্রযুক্তি", en: "Science & Tech" }, slug: { bn: "বিজ্ঞান-ও-প্রযুক্তি", en: "science-tech" }, description: { bn: "গবেষণা, প্রযুক্তি ও ডিজিটাল নিরাপত্তা", en: "Research, technology and digital safety" } },
  { key: "health", order: 8, name: { bn: "স্বাস্থ্য", en: "Health" }, slug: { bn: "স্বাস্থ্য", en: "health" }, description: { bn: "সুস্থ থাকার তথ্য ও জনস্বাস্থ্য", en: "Public health and wellbeing" } },
  { key: "culture", order: 9, name: { bn: "সংস্কৃতি", en: "Culture" }, slug: { bn: "সংস্কৃতি", en: "culture" }, description: { bn: "উৎসব, শিল্প ও ঐতিহ্য", en: "Festivals, arts and heritage" } },
  { key: "opinion", order: 10, name: { bn: "মতামত", en: "Opinion" }, slug: { bn: "মতামত", en: "opinion" }, description: { bn: "বিশ্লেষণ ও মতামত", en: "Analysis and commentary" } },
];

export const tags: Record<string, { bn: string; en: string }> = {
  weather: { bn: "আবহাওয়া", en: "Weather" },
  cyber: { bn: "সাইবার নিরাপত্তা", en: "Cyber security" },
  disaster: { bn: "দুর্যোগ প্রস্তুতি", en: "Disaster preparedness" },
  finance: { bn: "ব্যক্তিগত অর্থ", en: "Personal finance" },
  publicHealth: { bn: "জনস্বাস্থ্য", en: "Public health" },
  parliament: { bn: "সংসদ", en: "Parliament" },
  festivals: { bn: "উৎসব", en: "Festivals" },
  cricketRules: { bn: "খেলার নিয়ম", en: "Rules of the game" },
  un: { bn: "জাতিসংঘ", en: "United Nations" },
  roadSafety: { bn: "সড়ক নিরাপত্তা", en: "Road safety" },
  journalism: { bn: "সাংবাদিকতা", en: "Journalism" },
};

export interface SeedAuthor {
  key: string;
  slug: string;
  name: { bn: string; en: string };
  bio: { bn: string; en: string };
}

export const authors: SeedAuthor[] = [
  { key: "desk", slug: "staff-reporter", name: { bn: "নিজস্ব প্রতিবেদক", en: "Staff Reporter" }, bio: { bn: "দ্য মর্নিং বুলেটিনের প্রতিবেদন দল।", en: "The The Morning Bulletin reporting team." } },
  { key: "explainer", slug: "explainer-desk", name: { bn: "ব্যাখ্যা ডেস্ক", en: "Explainer Desk" }, bio: { bn: "জটিল বিষয় সহজ ভাষায় বুঝিয়ে বলাই এই ডেস্কের কাজ।", en: "This desk explains complex subjects in plain language." } },
  { key: "editorial", slug: "editorial-board", name: { bn: "সম্পাদকীয় বিভাগ", en: "Editorial Board" }, bio: { bn: "দ্য মর্নিং বুলেটিনের সম্পাদকীয় অবস্থান ও মতামত।", en: "The editorial voice of The Morning Bulletin." } },
];

export interface SeedImage {
  key: string;
  file: string;
  alt: { bn: string; en: string };
}

export const images: SeedImage[] = [
  { key: "weather", file: "weather.svg", alt: { bn: "মেঘ, বৃষ্টির ফোঁটা ও শতাংশ চিহ্নের রেখাচিত্র", en: "Illustration of clouds, raindrops and a percent sign" } },
  { key: "economy", file: "economy.svg", alt: { bn: "ঊর্ধ্বমুখী রেখা ও বাজারের ঝুড়ির রেখাচিত্র", en: "Illustration of a rising line and a shopping basket" } },
  { key: "heat", file: "heat.svg", alt: { bn: "প্রখর সূর্য ও পানির বোতলের রেখাচিত্র", en: "Illustration of a blazing sun and a water bottle" } },
  { key: "security", file: "security.svg", alt: { bn: "তালা ও বার্তার বুদ্বুদের রেখাচিত্র", en: "Illustration of a padlock and message bubbles" } },
  { key: "storm", file: "storm.svg", alt: { bn: "ঘূর্ণিঝড়ের কুণ্ডলী ও আশ্রয়কেন্দ্রের রেখাচিত্র", en: "Illustration of a cyclone spiral and a shelter" } },
  { key: "festival", file: "festival.svg", alt: { bn: "রঙিন মুখোশ ও আলপনার নকশার রেখাচিত্র", en: "Illustration of colourful masks and alpana patterns" } },
  { key: "cricket", file: "cricket.svg", alt: { bn: "ক্রিকেট বল ও উইকেটের রেখাচিত্র", en: "Illustration of a cricket ball and stumps" } },
  { key: "civic", file: "civic.svg", alt: { bn: "সংসদ ভবনের আদলে জ্যামিতিক রেখাচিত্র", en: "Geometric illustration inspired by a parliament building" } },
  { key: "globe", file: "globe.svg", alt: { bn: "পৃথিবীর গোলক ও সংযোগরেখার রেখাচিত্র", en: "Illustration of a globe with connecting lines" } },
  { key: "sleep", file: "sleep.svg", alt: { bn: "চাঁদ, তারা ও বালিশের রেখাচিত্র", en: "Illustration of a moon, stars and a pillow" } },
  { key: "road", file: "road.svg", alt: { bn: "জেব্রা ক্রসিং ও ট্রাফিক বাতির রেখাচিত্র", en: "Illustration of a zebra crossing and traffic light" } },
];

export interface SeedStory {
  key: string;
  category: string;
  tags: string[];
  author: string;
  image?: string;
  format: "standard" | "explainer" | "opinion";
  featured?: boolean;
  editorsPick?: boolean;
  /** Hours before the seed run. */
  ageHours: number;
  bn: { title: string; slug: string; summary: string; body: string };
  en: { title: string; slug: string; summary: string; body: string };
}

const p = (...paras: string[]) => paras.map((t) => (t.startsWith("<") ? t : `<p>${t}</p>`)).join("");

export const stories: SeedStory[] = [
  {
    key: "rain",
    category: "science",
    tags: ["weather"],
    author: "explainer",
    image: "weather",
    format: "explainer",
    featured: true,
    ageHours: 3,
    bn: {
      title: "বৃষ্টির সম্ভাবনা ৬০ শতাংশ মানে আসলে কী",
      slug: "বৃষ্টির-সম্ভাবনা-মানে-কী",
      summary: "পূর্বাভাসের শতাংশ মানে দিনের ৬০ ভাগ সময় বৃষ্টি নয়, আবার এলাকার ৬০ ভাগেও নয়। সংখ্যাটি পড়ার সঠিক উপায় জেনে নিন।",
      body: p(
        "আবহাওয়ার পূর্বাভাসে প্রায়ই দেখা যায় “বৃষ্টির সম্ভাবনা ৬০ শতাংশ”। অনেকে ধরে নেন, দিনের ৬০ ভাগ সময় বৃষ্টি হবে, কিংবা এলাকার ৬০ ভাগ জায়গা ভিজবে। আসলে দুটির কোনোটিই পুরোপুরি ঠিক নয়।",
        "<h2>সংখ্যাটি কীভাবে তৈরি হয়</h2>",
        "আবহাওয়াবিদেরা সাধারণত দুটি বিষয় মিলিয়ে এই সম্ভাবনা হিসাব করেন: পূর্বাভাসের এলাকায় বৃষ্টি হওয়ার ব্যাপারে তাঁরা কতটা নিশ্চিত, এবং নিশ্চিত হলে এলাকার কত অংশে বৃষ্টি হতে পারে। দুটি মিলে যে সংখ্যা দাঁড়ায়, তা বোঝায় নির্দিষ্ট সময়ের মধ্যে এলাকার যেকোনো একটি জায়গায় অন্তত সামান্য পরিমাণ বৃষ্টি হওয়ার সম্ভাবনা।",
        "<h2>দৈনন্দিন সিদ্ধান্তে কাজে লাগানো</h2>",
        "শতাংশ বেশি হলে ছাতা সঙ্গে রাখা বা বাইরের কাজ আগেভাগে সেরে ফেলা বুদ্ধিমানের কাজ। তবে সম্ভাবনা কম মানেই বৃষ্টি হবে না, এমন নয়। বিশেষ করে বর্ষাকালে স্থানীয়ভাবে হঠাৎ বজ্রবৃষ্টি হতে পারে।",
        "পূর্বাভাসের সময়সীমাও খেয়াল করুন। সারা দিনের জন্য দেওয়া সম্ভাবনা আর এক ঘণ্টার জন্য দেওয়া সম্ভাবনা এক জিনিস নয়। ভারী বৃষ্টি বা ঝড়ের মতো ঝুঁকির ক্ষেত্রে সবসময় সরকারি আবহাওয়া দপ্তরের সর্বশেষ সতর্কবার্তা অনুসরণ করুন।",
      ),
    },
    en: {
      title: "What a 60% chance of rain actually means",
      slug: "what-chance-of-rain-means",
      summary: "It does not mean rain for 60% of the day, nor over 60% of the area. Here is how to read the number correctly.",
      body: p(
        "Forecasts often say there is a “60% chance of rain”. Many people take that to mean it will rain for 60% of the day, or that 60% of the area will get wet. Neither reading is quite right.",
        "<h2>How the number is built</h2>",
        "Forecasters usually combine two things: how confident they are that rain will develop somewhere in the forecast area, and how much of the area it is likely to cover if it does. The result describes the chance that any given spot in the area will receive at least a small, measurable amount of rain during the forecast period.",
        "<h2>Using it for everyday decisions</h2>",
        "A high percentage is a good reason to carry an umbrella or finish outdoor errands early. A low percentage does not guarantee a dry day, though: during the monsoon, sudden local thunderstorms are common.",
        "Check the time window as well. A chance of rain for a whole day is not the same as a chance for a single hour. For heavy rain, storms and other hazards, always follow the latest warnings from the official meteorological service.",
      ),
    },
  },
  {
    key: "inflation",
    category: "economy",
    tags: ["finance"],
    author: "explainer",
    image: "economy",
    format: "explainer",
    featured: true,
    editorsPick: true,
    ageHours: 7,
    bn: {
      title: "মূল্যস্ফীতি কী, আর কীভাবে তা মাপা হয়",
      slug: "মূল্যস্ফীতি-কী-কীভাবে-মাপা-হয়",
      summary: "বাজারে জিনিসের দাম বাড়লে সংবাদে মূল্যস্ফীতির হার শোনা যায়। এই হার কীভাবে হিসাব হয় এবং পরিবারের বাজেটে এর অর্থ কী, তা সহজ ভাষায়।",
      body: p(
        "সময়ের সঙ্গে পণ্য ও সেবার গড় দাম বেড়ে যাওয়াকে মূল্যস্ফীতি বলে। মূল্যস্ফীতি হলে একই টাকায় আগের চেয়ে কম জিনিস কেনা যায়, অর্থাৎ টাকার ক্রয়ক্ষমতা কমে।",
        "<h2>ভোক্তা মূল্যসূচক</h2>",
        "মূল্যস্ফীতি মাপার সবচেয়ে প্রচলিত উপায় হলো ভোক্তা মূল্যসূচক। এতে সাধারণ পরিবার যেসব পণ্য ও সেবা কেনে, যেমন চাল, ডাল, তেল, যাতায়াত, বাড়িভাড়া ও চিকিৎসা, তার একটি “ঝুড়ি” নির্ধারণ করা হয়। নিয়মিতভাবে এই ঝুড়ির দাম সংগ্রহ করে আগের সময়ের সঙ্গে তুলনা করা হয়। বাংলাদেশে পরিসংখ্যান ব্যুরো এই সূচক প্রকাশ করে।",
        "<h2>খবরে যে হার শোনেন</h2>",
        "সংবাদে সাধারণত “বার্ষিক” হার বলা হয়, অর্থাৎ গত বছরের একই মাসের তুলনায় দাম কত শতাংশ বেড়েছে। খাদ্য ও খাদ্যবহির্ভূত পণ্যের হার আলাদা করেও দেখানো হয়, কারণ দুটির গতি অনেক সময় ভিন্ন হয়।",
        "মনে রাখা দরকার, সূচকটি একটি গড়। আপনার পরিবারের খরচের ধরন আলাদা হলে আপনার কাছে দাম বাড়ার অনুভূতি সরকারি হারের চেয়ে বেশি বা কম হতে পারে।",
      ),
    },
    en: {
      title: "What inflation is, and how it is measured",
      slug: "what-inflation-is-how-it-is-measured",
      summary: "When prices rise, the news reports an inflation rate. Here is how that rate is calculated and what it means for a household budget.",
      body: p(
        "Inflation is the rise in the average price of goods and services over time. When prices rise, the same amount of money buys less: money loses purchasing power.",
        "<h2>The consumer price index</h2>",
        "The most common measure is the consumer price index. Statisticians define a “basket” of things a typical household buys, such as rice, lentils, cooking oil, transport, rent and healthcare, collect their prices regularly and compare them with an earlier period. In Bangladesh, the Bureau of Statistics publishes this index.",
        "<h2>The rate you hear in the news</h2>",
        "News reports usually quote the annual rate: how much prices have risen compared with the same month a year earlier. Food and non-food inflation are often reported separately because they can move at different speeds.",
        "The index is an average. If your household spends differently from the typical basket, the price rises you feel can be higher or lower than the official figure.",
      ),
    },
  },
  {
    key: "heat",
    category: "health",
    tags: ["publicHealth", "weather"],
    author: "desk",
    image: "heat",
    format: "standard",
    featured: true,
    ageHours: 11,
    bn: {
      title: "তাপপ্রবাহে সুস্থ থাকতে যা করবেন",
      slug: "তাপপ্রবাহে-সুস্থ-থাকার-উপায়",
      summary: "পর্যাপ্ত পানি পান, দুপুরের রোদ এড়ানো আর হিটস্ট্রোকের লক্ষণ চেনা: গরমে নিজেকে ও পরিবারকে সুরক্ষিত রাখার মূল পরামর্শগুলো।",
      body: p(
        "তীব্র গরমে শরীর ঠিকমতো ঠান্ডা হতে না পারলে পানিশূন্যতা, হিট এক্সহসশন এমনকি হিটস্ট্রোক হতে পারে। শিশু, বয়স্ক, অন্তঃসত্ত্বা নারী, দীর্ঘমেয়াদি রোগে আক্রান্ত মানুষ এবং রোদে কাজ করা শ্রমিকদের ঝুঁকি বেশি।",
        "<h2>প্রতিদিনের সতর্কতা</h2>",
        "<ul><li>তৃষ্ণা না পেলেও সারা দিন নিয়মিত পানি পান করুন।</li><li>সম্ভব হলে দুপুরের সবচেয়ে গরম সময়ে বাইরে কাজ এড়িয়ে চলুন।</li><li>হালকা রঙের ঢিলেঢালা সুতি কাপড় পরুন, মাথা ঢেকে রাখুন।</li><li>ঘর বাতাস চলাচলের উপযোগী রাখুন এবং ছায়ায় বিশ্রাম নিন।</li></ul>",
        "<h2>বিপদের লক্ষণ</h2>",
        "মাথা ঘোরা, প্রচণ্ড ক্লান্তি, বমিভাব, মাথাব্যথা বা অতিরিক্ত ঘাম হলে দ্রুত ছায়ায় সরে যান, পানি পান করুন এবং শরীর ঠান্ডা করুন। বিভ্রান্তি, অজ্ঞান হয়ে যাওয়া, শরীর খুব গরম কিন্তু ঘাম বন্ধ হয়ে যাওয়া হিটস্ট্রোকের লক্ষণ হতে পারে। এটি জরুরি অবস্থা; দেরি না করে নিকটস্থ স্বাস্থ্যকেন্দ্রে যোগাযোগ করুন।",
      ),
    },
    en: {
      title: "How to stay safe during a heatwave",
      slug: "how-to-stay-safe-during-a-heatwave",
      summary: "Drink water regularly, avoid the midday sun and know the signs of heatstroke: the essentials for protecting yourself and your family in extreme heat.",
      body: p(
        "When the body cannot cool itself in extreme heat, it can lead to dehydration, heat exhaustion and even heatstroke. Children, older people, pregnant women, people with long-term illnesses and those who work outdoors are most at risk.",
        "<h2>Everyday precautions</h2>",
        "<ul><li>Drink water regularly through the day, even before you feel thirsty.</li><li>Avoid outdoor work in the hottest hours around midday where you can.</li><li>Wear loose, light-coloured cotton clothing and cover your head.</li><li>Keep rooms ventilated and rest in the shade.</li></ul>",
        "<h2>Warning signs</h2>",
        "Dizziness, extreme tiredness, nausea, headache or heavy sweating are signals to move into the shade, drink water and cool down. Confusion, fainting, or very hot skin that has stopped sweating can indicate heatstroke. That is an emergency: contact the nearest health facility without delay.",
      ),
    },
  },
  {
    key: "phishing",
    category: "science",
    tags: ["cyber"],
    author: "desk",
    image: "security",
    format: "standard",
    editorsPick: true,
    ageHours: 15,
    bn: {
      title: "প্রতারণামূলক বার্তা চেনার পাঁচটি সহজ উপায়",
      slug: "প্রতারণামূলক-বার্তা-চেনার-উপায়",
      summary: "লোভনীয় পুরস্কার, তাড়াহুড়ার চাপ আর অচেনা লিংক: অনলাইন প্রতারকদের সাধারণ কৌশলগুলো চিনে রাখলে টাকা ও তথ্য দুটোই নিরাপদ থাকে।",
      body: p(
        "এসএমএস, ইমেইল বা মেসেজিং অ্যাপে আসা প্রতারণামূলক বার্তার লক্ষ্য সাধারণত একটাই: আপনাকে দিয়ে কোনো লিংকে ক্লিক করানো, পাসওয়ার্ড বা ওটিপি জেনে নেওয়া, কিংবা টাকা পাঠাতে রাজি করানো।",
        "<h2>যেসব লক্ষণে সতর্ক হবেন</h2>",
        "<ol><li><strong>তাড়াহুড়ার চাপ:</strong> “এখনই না করলে অ্যাকাউন্ট বন্ধ হয়ে যাবে” ধরনের ভয় দেখানো।</li><li><strong>অবিশ্বাস্য প্রস্তাব:</strong> লটারি জেতা বা অপ্রত্যাশিত পুরস্কারের খবর।</li><li><strong>গোপন তথ্য চাওয়া:</strong> কোনো বৈধ প্রতিষ্ঠান বার্তায় পিন, পাসওয়ার্ড বা ওটিপি চায় না।</li><li><strong>সন্দেহজনক ঠিকানা:</strong> প্রেরকের ঠিকানা বা লিংকের বানানে সামান্য গরমিল।</li><li><strong>অপ্রত্যাশিত সংযুক্তি:</strong> অচেনা উৎস থেকে ফাইল খুলতে বলা।</li></ol>",
        "<h2>সন্দেহ হলে কী করবেন</h2>",
        "বার্তার লিংকে না গিয়ে প্রতিষ্ঠানের অফিশিয়াল ওয়েবসাইট বা হেল্পলাইনে নিজে যোগাযোগ করে যাচাই করুন। ভুল করে তথ্য দিয়ে ফেললে দ্রুত পাসওয়ার্ড বদলান এবং সংশ্লিষ্ট ব্যাংক বা সেবাদাতাকে জানান।",
      ),
    },
    en: {
      title: "Five simple ways to spot a phishing message",
      slug: "five-ways-to-spot-a-phishing-message",
      summary: "Tempting prizes, pressure to act fast and unfamiliar links: knowing the common tricks of online fraudsters keeps both your money and your data safe.",
      body: p(
        "Phishing messages arrive by SMS, email or messaging apps, and they usually want one thing: to get you to click a link, reveal a password or one-time code, or send money.",
        "<h2>Signs to watch for</h2>",
        "<ol><li><strong>Pressure to hurry:</strong> threats such as “your account will be closed unless you act now”.</li><li><strong>Too-good-to-be-true offers:</strong> lottery wins or unexpected prizes.</li><li><strong>Requests for secrets:</strong> legitimate organisations do not ask for your PIN, password or one-time code by message.</li><li><strong>Odd addresses:</strong> small misspellings in the sender’s address or the link.</li><li><strong>Unexpected attachments:</strong> requests to open files from unknown sources.</li></ol>",
        "<h2>If you are unsure</h2>",
        "Do not use the link in the message. Contact the organisation through its official website or helpline to check. If you have already shared details, change your password quickly and tell your bank or service provider.",
      ),
    },
  },
  {
    key: "cyclone",
    category: "national",
    tags: ["disaster", "weather"],
    author: "desk",
    image: "storm",
    format: "standard",
    featured: true,
    ageHours: 20,
    bn: {
      title: "ঘূর্ণিঝড় মৌসুমে পরিবারের জরুরি প্রস্তুতি",
      slug: "ঘূর্ণিঝড়-মৌসুমে-পরিবারের-প্রস্তুতি",
      summary: "একটি জরুরি ব্যাগ, প্রয়োজনীয় কাগজপত্রের নিরাপদ কপি আর নিকটতম আশ্রয়কেন্দ্রের পথ জানা থাকলে বিপদের সময় সিদ্ধান্ত নেওয়া সহজ হয়।",
      body: p(
        "উপকূলীয় এলাকায় ঘূর্ণিঝড়ের ঝুঁকি মোকাবিলায় আগাম প্রস্তুতিই সবচেয়ে কার্যকর। সতর্কসংকেত জারির পর হাতে সময় কম থাকে, তাই প্রস্তুতি শুরু করুন মৌসুমের আগেই।",
        "<h2>জরুরি ব্যাগে যা রাখবেন</h2>",
        "<ul><li>শুকনো খাবার ও বিশুদ্ধ খাবার পানি</li><li>নিয়মিত ওষুধ ও প্রাথমিক চিকিৎসার সরঞ্জাম</li><li>টর্চ, বাড়তি ব্যাটারি ও চার্জ দেওয়া পাওয়ার ব্যাংক</li><li>জাতীয় পরিচয়পত্র, জমির দলিলসহ জরুরি কাগজের কপি, পানিরোধী প্যাকেটে</li><li>কিছু নগদ টাকা ও জরুরি ফোন নম্বরের তালিকা</li></ul>",
        "<h2>পরিবারের পরিকল্পনা</h2>",
        "নিকটতম আশ্রয়কেন্দ্র কোথায় এবং সেখানে যাওয়ার নিরাপদ পথ কোনটি, তা পরিবারের সবাইকে জানিয়ে রাখুন। বয়স্ক, প্রতিবন্ধী ব্যক্তি ও শিশুদের কে সহায়তা করবেন, তা আগেই ঠিক করুন। গবাদিপশু ও জরুরি সম্পদ সুরক্ষার ব্যবস্থাও ভাবুন।",
        "রেডিও, টেলিভিশন ও সরকারি সূত্র থেকে আবহাওয়া অধিদপ্তরের সতর্কসংকেত এবং স্থানীয় প্রশাসনের নির্দেশনা অনুসরণ করুন। গুজবে কান দেবেন না।",
      ),
    },
    en: {
      title: "Preparing your household for cyclone season",
      slug: "preparing-your-household-for-cyclone-season",
      summary: "An emergency bag, safe copies of key documents and knowing the way to the nearest shelter make decisions easier when danger comes.",
      body: p(
        "In coastal areas, preparing early is the most effective way to reduce cyclone risk. Once warning signals are raised there is little time, so start before the season begins.",
        "<h2>What to pack in an emergency bag</h2>",
        "<ul><li>Dry food and safe drinking water</li><li>Regular medicines and a first-aid kit</li><li>A torch, spare batteries and a charged power bank</li><li>Copies of your national ID, land papers and other key documents in a waterproof pouch</li><li>Some cash and a list of emergency phone numbers</li></ul>",
        "<h2>A family plan</h2>",
        "Make sure everyone knows where the nearest shelter is and the safest way to get there. Decide in advance who will help older relatives, people with disabilities and children. Think about how to protect livestock and essential belongings.",
        "Follow the meteorological department’s warning signals and local administration instructions through radio, television and official sources. Do not rely on rumours.",
      ),
    },
  },
  {
    key: "boishakh",
    category: "culture",
    tags: ["festivals"],
    author: "explainer",
    image: "festival",
    format: "explainer",
    editorsPick: true,
    ageHours: 28,
    bn: {
      title: "পহেলা বৈশাখ: বাংলা নববর্ষ উদ্‌যাপনের ইতিহাস",
      slug: "পহেলা-বৈশাখ-উদ্‌যাপনের-ইতিহাস",
      summary: "খাজনা আদায়ের হিসাব থেকে সর্বজনীন উৎসব: বাংলা সন ও নববর্ষ উদ্‌যাপনের দীর্ঘ পথচলার সংক্ষিপ্ত পরিচয়।",
      body: p(
        "বাংলা বছরের প্রথম দিন পহেলা বৈশাখ। বাংলাদেশে দিনটি সাধারণত ১৪ এপ্রিল পালিত হয় এবং এটি ধর্ম-বর্ণনির্বিশেষে সবার উৎসব হিসেবে পরিচিত।",
        "<h2>বাংলা সনের সূচনা</h2>",
        "প্রচলিত মত অনুযায়ী, মোগল আমলে কৃষিকাজ ও খাজনা আদায়ের সুবিধার জন্য ফসলের মৌসুমের সঙ্গে মিল রেখে বাংলা সনের প্রবর্তন হয়। ইতিহাসবিদদের মধ্যে এর উৎপত্তি নিয়ে ভিন্নমতও আছে।",
        "<h2>হালখাতা থেকে শোভাযাত্রা</h2>",
        "একসময় ব্যবসায়ীরা বছরের শুরুতে পুরোনো হিসাব মিটিয়ে নতুন খাতা খুলতেন, যা “হালখাতা” নামে পরিচিত। সময়ের সঙ্গে নববর্ষ হয়ে ওঠে মেলা, গান, ঐতিহ্যবাহী খাবার আর রঙিন সাজের উৎসব। ঢাকা বিশ্ববিদ্যালয়ের চারুকলা অনুষদ আয়োজিত নববর্ষের শোভাযাত্রা ২০১৬ সালে ইউনেসকোর মানবতার অধরা সাংস্কৃতিক ঐতিহ্যের তালিকায় স্থান পায়।",
      ),
    },
    en: {
      title: "Pohela Boishakh: a short history of Bengali New Year",
      slug: "pohela-boishakh-history-of-bengali-new-year",
      summary: "From a tax-collection calendar to a festival for everyone: a brief introduction to the Bengali year and how its first day came to be celebrated.",
      body: p(
        "Pohela Boishakh is the first day of the Bengali year. In Bangladesh it is usually observed on 14 April and is celebrated as a festival for people of every faith and background.",
        "<h2>The origins of the Bengali calendar</h2>",
        "According to the most widely held account, the Bengali calendar was introduced in the Mughal era to align tax collection with the harvest seasons. Historians also debate other explanations of its origin.",
        "<h2>From ledgers to processions</h2>",
        "Traders once settled old accounts and opened new ledgers at the start of the year, a custom known as “halkhata”. Over time the new year became a festival of fairs, music, traditional food and colourful dress. The new-year procession organised by the Faculty of Fine Arts at the University of Dhaka was inscribed on UNESCO’s list of the Intangible Cultural Heritage of Humanity in 2016.",
      ),
    },
  },
  {
    key: "drs",
    category: "cricket",
    tags: ["cricketRules"],
    author: "explainer",
    image: "cricket",
    format: "explainer",
    ageHours: 33,
    bn: {
      title: "ক্রিকেটে ডিআরএস কীভাবে কাজ করে",
      slug: "ক্রিকেটে-ডিআরএস-কীভাবে-কাজ-করে",
      summary: "বল-ট্র্যাকিং, শব্দ শনাক্তকরণ আর “আম্পায়ার্স কল”: রিভিউ ব্যবস্থার মূল উপাদানগুলো এক নজরে।",
      body: p(
        "ডিসিশন রিভিউ সিস্টেম বা ডিআরএস হলো মাঠের আম্পায়ারের সিদ্ধান্ত প্রযুক্তির সাহায্যে পুনর্বিবেচনার ব্যবস্থা। কোনো দল সিদ্ধান্তে আপত্তি জানালে তৃতীয় আম্পায়ার রিপ্লে ও প্রযুক্তিগত তথ্য দেখে সিদ্ধান্ত বহাল রাখেন বা বদলান।",
        "<h2>প্রধান প্রযুক্তি</h2>",
        "<ul><li><strong>বল-ট্র্যাকিং:</strong> বলের গতিপথ বিশ্লেষণ করে দেখায়, বলটি স্টাম্পে লাগত কি না। এলবিডব্লিউ সিদ্ধান্তে এটি গুরুত্বপূর্ণ।</li><li><strong>শব্দ ও তাপ শনাক্তকরণ:</strong> বল ব্যাট বা গ্লাভস ছুঁয়েছে কি না, তা বুঝতে সাহায্য করে।</li><li><strong>রিপ্লে:</strong> বিভিন্ন কোণ থেকে ধীরগতির ভিডিও।</li></ul>",
        "<h2>আম্পায়ার্স কল</h2>",
        "প্রযুক্তি যখন দেখায় যে বল স্টাম্পে খুব সামান্য অংশে লাগত, তখন মাঠের আম্পায়ারের মূল সিদ্ধান্তই বহাল থাকে। একে “আম্পায়ার্স কল” বলা হয়। প্রতিটি দলের ব্যর্থ রিভিউয়ের সংখ্যা সীমিত, এবং আম্পায়ার্স কলের ক্ষেত্রে রিভিউটি হারায় না।",
      ),
    },
    en: {
      title: "How cricket’s Decision Review System works",
      slug: "how-cricket-drs-works",
      summary: "Ball-tracking, edge detection and “umpire’s call”: the key parts of the review system at a glance.",
      body: p(
        "The Decision Review System, or DRS, lets teams ask for an on-field decision to be checked with technology. When a team challenges a decision, the third umpire studies replays and technical data and either upholds or overturns it.",
        "<h2>The main tools</h2>",
        "<ul><li><strong>Ball-tracking:</strong> projects the ball’s path to show whether it would have hit the stumps, which is central to lbw decisions.</li><li><strong>Sound and heat detection:</strong> helps show whether the ball touched the bat or glove.</li><li><strong>Replays:</strong> slow-motion video from several angles.</li></ul>",
        "<h2>Umpire’s call</h2>",
        "When the technology shows the ball clipping only a small part of the stumps, the on-field umpire’s original decision stands. This is called “umpire’s call”. Each team has a limited number of unsuccessful reviews, and a review is not lost when the outcome is umpire’s call.",
      ),
    },
  },
  {
    key: "mfs",
    category: "economy",
    tags: ["finance", "cyber"],
    author: "desk",
    image: "security",
    format: "standard",
    ageHours: 40,
    bn: {
      title: "মোবাইল আর্থিক সেবার অ্যাকাউন্ট নিরাপদ রাখবেন যেভাবে",
      slug: "মোবাইল-আর্থিক-সেবার-অ্যাকাউন্ট-নিরাপদ-রাখুন",
      summary: "পিন ও ওটিপি কারও সঙ্গে ভাগ না করা, লেনদেনের বার্তা মিলিয়ে দেখা আর সন্দেহজনক কলে সাড়া না দেওয়া: মোবাইলে টাকা লেনদেনের নিরাপত্তার মূল কথা।",
      body: p(
        "মোবাইল আর্থিক সেবা দ্রুত ও সহজে টাকা পাঠানোর সুযোগ দিয়েছে। তবে প্রতারকেরাও নানা কৌশলে গ্রাহকের পিন বা ওটিপি জেনে নেওয়ার চেষ্টা করে।",
        "<h2>যা কখনো করবেন না</h2>",
        "<ul><li>পিন বা ওটিপি কাউকে বলবেন না, এমনকি নিজেকে সেবাদাতা প্রতিষ্ঠানের কর্মী দাবি করলেও।</li><li>“ভুল করে টাকা চলে গেছে, ফেরত দিন” ধরনের অনুরোধে লেনদেন যাচাই না করে টাকা পাঠাবেন না।</li><li>অচেনা লিংক থেকে অ্যাপ নামাবেন না।</li></ul>",
        "<h2>নিয়মিত অভ্যাস</h2>",
        "প্রতিটি লেনদেনের পর আসা বার্তা ও ব্যালান্স মিলিয়ে দেখুন। সহজে অনুমান করা যায় এমন পিন ব্যবহার করবেন না এবং মাঝে মাঝে পিন বদলান। ফোন হারালে বা সন্দেহজনক লেনদেন দেখলে দ্রুত সেবাদাতার অফিশিয়াল হেল্পলাইনে জানিয়ে অ্যাকাউন্ট সুরক্ষিত করুন।",
      ),
    },
    en: {
      title: "How to keep your mobile money account safe",
      slug: "how-to-keep-your-mobile-money-account-safe",
      summary: "Never share your PIN or one-time code, check every transaction message and ignore suspicious calls: the basics of mobile payment safety.",
      body: p(
        "Mobile financial services make sending money fast and easy. Fraudsters, however, use many tricks to learn customers’ PINs or one-time codes.",
        "<h2>What never to do</h2>",
        "<ul><li>Never tell anyone your PIN or one-time code, even someone who claims to work for the provider.</li><li>Do not send money in response to “I sent money to you by mistake, please return it” without checking your own transaction history first.</li><li>Do not install apps from unknown links.</li></ul>",
        "<h2>Good habits</h2>",
        "Compare every transaction message with your balance. Avoid PINs that are easy to guess and change yours from time to time. If you lose your phone or spot a suspicious transaction, call the provider’s official helpline promptly to secure the account.",
      ),
    },
  },
  {
    key: "unga",
    category: "world",
    tags: ["un"],
    author: "explainer",
    image: "globe",
    format: "explainer",
    ageHours: 52,
    bn: {
      title: "জাতিসংঘ সাধারণ পরিষদ কী করে",
      slug: "জাতিসংঘ-সাধারণ-পরিষদ-কী-করে",
      summary: "প্রতিটি সদস্যরাষ্ট্রের একটি করে ভোট, বেশির ভাগ প্রস্তাব বাধ্যতামূলক নয়, কিন্তু বৈশ্বিক মতামতের গুরুত্বপূর্ণ মঞ্চ।",
      body: p(
        "সাধারণ পরিষদ জাতিসংঘের প্রধান আলোচনাসভা, যেখানে সব সদস্যরাষ্ট্রের প্রতিনিধিত্ব আছে। ছোট-বড় নির্বিশেষে প্রতিটি দেশের একটি করে ভোট।",
        "<h2>কাজের পরিধি</h2>",
        "পরিষদ শান্তি ও নিরাপত্তা, উন্নয়ন, মানবাধিকারসহ নানা বিষয়ে আলোচনা করে প্রস্তাব গ্রহণ করে। জাতিসংঘের বাজেট অনুমোদন, নিরাপত্তা পরিষদের অস্থায়ী সদস্য নির্বাচন এবং নিরাপত্তা পরিষদের সুপারিশে মহাসচিব নিয়োগও এর দায়িত্ব।",
        "<h2>প্রস্তাবের ক্ষমতা</h2>",
        "সাধারণ পরিষদের বেশির ভাগ প্রস্তাব আইনগতভাবে বাধ্যতামূলক নয়; সেগুলো বিশ্বসম্প্রদায়ের মতামত ও রাজনৈতিক অবস্থানের প্রকাশ। প্রতিবছর সেপ্টেম্বরে নিয়মিত অধিবেশন শুরু হয়, যার শুরুতে বিভিন্ন দেশের সরকারপ্রধানেরা ভাষণ দেন।",
      ),
    },
    en: {
      title: "What the UN General Assembly does",
      slug: "what-the-un-general-assembly-does",
      summary: "One vote per member state and mostly non-binding resolutions, but an important stage for global opinion.",
      body: p(
        "The General Assembly is the main deliberative body of the United Nations, where every member state is represented. Each country, large or small, has one vote.",
        "<h2>What it covers</h2>",
        "The Assembly debates and adopts resolutions on peace and security, development, human rights and many other subjects. It approves the UN budget, elects the non-permanent members of the Security Council and appoints the Secretary-General on the Security Council’s recommendation.",
        "<h2>How much power resolutions have</h2>",
        "Most General Assembly resolutions are not legally binding; they express the views and political positions of the international community. Each regular session opens in September, beginning with speeches by heads of state and government.",
      ),
    },
  },
  {
    key: "sleep",
    category: "health",
    tags: ["publicHealth"],
    author: "desk",
    image: "sleep",
    format: "standard",
    ageHours: 60,
    bn: {
      title: "ভালো ঘুম কেন জরুরি, কীভাবে অভ্যাস গড়বেন",
      slug: "ভালো-ঘুম-কেন-জরুরি",
      summary: "নিয়মিত সময়ে ঘুমানো, ঘুমের আগে স্ক্রিন কমানো আর দিনের আলোয় সময় কাটানো: সুস্থ ঘুমের জন্য প্রমাণভিত্তিক সাধারণ পরামর্শ।",
      body: p(
        "ঘুম শুধু বিশ্রাম নয়; এ সময় শরীর ও মস্তিষ্ক নিজেকে পুনর্গঠন করে। পর্যাপ্ত ঘুম মনোযোগ, স্মৃতি, মেজাজ ও রোগ প্রতিরোধক্ষমতার সঙ্গে জড়িত।",
        "<h2>কতটা ঘুম দরকার</h2>",
        "ঘুমবিষয়ক বিশেষজ্ঞ সংগঠনগুলো প্রাপ্তবয়স্কদের সাধারণত রাতে অন্তত সাত ঘণ্টা ঘুমানোর পরামর্শ দেয়। শিশু ও কিশোরদের এর চেয়ে বেশি ঘুম প্রয়োজন।",
        "<h2>ভালো ঘুমের অভ্যাস</h2>",
        "<ul><li>প্রতিদিন একই সময়ে ঘুমাতে যাওয়া ও ওঠার চেষ্টা করুন।</li><li>ঘুমানোর আগে মোবাইল ও অন্যান্য স্ক্রিনের ব্যবহার কমান।</li><li>সন্ধ্যার পর চা-কফির মতো ক্যাফেইনযুক্ত পানীয় এড়িয়ে চলুন।</li><li>দিনের বেলায় কিছুটা সময় বাইরের আলোয় কাটান।</li></ul>",
        "দীর্ঘদিন ঘুমের সমস্যা, ঘুমের মধ্যে জোরে নাক ডাকা বা শ্বাস আটকে যাওয়ার মতো লক্ষণ থাকলে চিকিৎসকের পরামর্শ নিন।",
      ),
    },
    en: {
      title: "Why good sleep matters, and how to build the habit",
      slug: "why-good-sleep-matters",
      summary: "Keep regular hours, cut screen time before bed and get daylight: general, evidence-based advice for healthy sleep.",
      body: p(
        "Sleep is more than rest: it is when the body and brain repair themselves. Getting enough sleep is linked to attention, memory, mood and the immune system.",
        "<h2>How much sleep you need</h2>",
        "Sleep medicine organisations generally recommend that adults get at least seven hours a night. Children and teenagers need more.",
        "<h2>Habits that help</h2>",
        "<ul><li>Go to bed and get up at the same times every day.</li><li>Reduce phone and other screen use before sleep.</li><li>Avoid caffeinated drinks such as tea and coffee in the evening.</li><li>Spend some time in daylight during the day.</li></ul>",
        "If sleep problems last for a long time, or you have signs such as loud snoring or pauses in breathing during sleep, consult a doctor.",
      ),
    },
  },
  {
    key: "bill",
    category: "politics",
    tags: ["parliament"],
    author: "explainer",
    image: "civic",
    format: "explainer",
    ageHours: 72,
    bn: {
      title: "সংসদে একটি বিল কীভাবে আইনে পরিণত হয়",
      slug: "সংসদে-বিল-কীভাবে-আইন-হয়",
      summary: "উত্থাপন, কমিটিতে যাচাই, পাস এবং রাষ্ট্রপতির সম্মতি: বাংলাদেশের সংবিধান অনুযায়ী আইন প্রণয়নের ধাপগুলো।",
      body: p(
        "বাংলাদেশে আইন প্রণয়নের ক্ষমতা জাতীয় সংসদের। প্রস্তাবিত আইনকে বিল বলা হয়, যা সরকারের পক্ষে মন্ত্রী অথবা কোনো বেসরকারি সদস্য উত্থাপন করতে পারেন।",
        "<h2>প্রধান ধাপগুলো</h2>",
        "<ol><li><strong>উত্থাপন:</strong> বিলটি সংসদে উপস্থাপন করা হয়।</li><li><strong>কমিটিতে যাচাই:</strong> সাধারণত সংশ্লিষ্ট সংসদীয় স্থায়ী কমিটি বিলটি পরীক্ষা করে সুপারিশসহ প্রতিবেদন দেয়।</li><li><strong>বিবেচনা ও সংশোধনী:</strong> সংসদ ধারাওয়ারি আলোচনা করে সংশোধনী প্রস্তাব নিষ্পত্তি করে।</li><li><strong>পাস:</strong> ভোটে গৃহীত হলে বিলটি পাস হয়।</li></ol>",
        "<h2>রাষ্ট্রপতির সম্মতি</h2>",
        "সংবিধানের ৮০ অনুচ্ছেদ অনুযায়ী পাস হওয়া বিল সম্মতির জন্য রাষ্ট্রপতির কাছে পাঠানো হয়। অর্থবিল ছাড়া অন্য বিল রাষ্ট্রপতি নির্ধারিত সময়ের মধ্যে পুনর্বিবেচনার অনুরোধসহ সংসদে ফেরত পাঠাতে পারেন। সম্মতি পাওয়ার পর বিলটি আইনে পরিণত হয় এবং গেজেটে প্রকাশিত হয়।",
      ),
    },
    en: {
      title: "How a bill becomes law in Bangladesh’s parliament",
      slug: "how-a-bill-becomes-law-in-bangladesh",
      summary: "Introduction, committee scrutiny, passage and presidential assent: the steps of law-making under the constitution.",
      body: p(
        "In Bangladesh, the power to make laws rests with the Jatiya Sangsad, the national parliament. A proposed law is called a bill, and it can be introduced by a minister on behalf of the government or by a private member.",
        "<h2>The main steps</h2>",
        "<ol><li><strong>Introduction:</strong> the bill is presented in parliament.</li><li><strong>Committee scrutiny:</strong> usually the relevant standing committee examines the bill and reports with recommendations.</li><li><strong>Consideration and amendments:</strong> parliament debates the bill clause by clause and settles proposed amendments.</li><li><strong>Passage:</strong> the bill is passed when adopted by vote.</li></ol>",
        "<h2>Presidential assent</h2>",
        "Under Article 80 of the constitution, a passed bill goes to the President for assent. For bills other than money bills, the President may return the bill to parliament within a set period with a request for reconsideration. Once assent is given, the bill becomes law and is published in the official gazette.",
      ),
    },
  },
  {
    key: "passwords",
    category: "science",
    tags: ["cyber"],
    author: "desk",
    image: "security",
    format: "standard",
    ageHours: 84,
    bn: {
      title: "শক্তিশালী পাসওয়ার্ড আর টু-ফ্যাক্টর যাচাই: অনলাইন অ্যাকাউন্টের দুই পাহারাদার",
      slug: "শক্তিশালী-পাসওয়ার্ড-ও-টু-ফ্যাক্টর",
      summary: "লম্বা ও আলাদা পাসওয়ার্ড, পাসওয়ার্ড ম্যানেজার আর দ্বিতীয় ধাপের যাচাই চালু করলে অ্যাকাউন্ট হাতছাড়া হওয়ার ঝুঁকি অনেক কমে।",
      body: p(
        "একই পাসওয়ার্ড বিভিন্ন জায়গায় ব্যবহার করলে একটি ওয়েবসাইটের তথ্য ফাঁস হলেই অন্য অ্যাকাউন্টগুলোও ঝুঁকিতে পড়ে। তাই প্রতিটি গুরুত্বপূর্ণ অ্যাকাউন্টের জন্য আলাদা পাসওয়ার্ড জরুরি।",
        "<h2>ভালো পাসওয়ার্ডের বৈশিষ্ট্য</h2>",
        "ছোট কিন্তু জটিল পাসওয়ার্ডের চেয়ে কয়েকটি এলোমেলো শব্দ মিলিয়ে তৈরি লম্বা পাসফ্রেজ মনে রাখা সহজ এবং অনুমান করা কঠিন। জন্মতারিখ, ফোন নম্বর বা নামের মতো ব্যক্তিগত তথ্য ব্যবহার করবেন না। পাসওয়ার্ড ম্যানেজার ব্যবহার করলে অনেকগুলো আলাদা পাসওয়ার্ড নিরাপদে সংরক্ষণ করা যায়।",
        "<h2>টু-ফ্যাক্টর যাচাই</h2>",
        "টু-ফ্যাক্টর যাচাই চালু থাকলে পাসওয়ার্ড জানা গেলেও দ্বিতীয় ধাপের কোড ছাড়া অ্যাকাউন্টে ঢোকা যায় না। সম্ভব হলে এসএমএসের চেয়ে অথেনটিকেটর অ্যাপ বা নিরাপত্তা চাবি ব্যবহার করা ভালো। ইমেইল ও ব্যাংকিং অ্যাকাউন্ট দিয়ে শুরু করুন, কারণ এগুলো দিয়েই অন্য অ্যাকাউন্ট পুনরুদ্ধার করা হয়।",
      ),
    },
    en: {
      title: "Strong passwords and two-factor authentication: two guards for your accounts",
      slug: "strong-passwords-and-two-factor-authentication",
      summary: "Long, unique passwords, a password manager and a second verification step greatly reduce the risk of losing an account.",
      body: p(
        "Reusing one password across sites means a leak at one website puts every other account at risk. Each important account needs its own password.",
        "<h2>What makes a good password</h2>",
        "A long passphrase made of several random words is easier to remember and harder to guess than a short, complicated password. Avoid personal details such as birthdays, phone numbers or names. A password manager lets you store many different passwords safely.",
        "<h2>Two-factor authentication</h2>",
        "With two-factor authentication turned on, someone who learns your password still cannot sign in without the second code. Where possible, an authenticator app or security key is better than SMS. Start with your email and banking accounts, because they are used to recover everything else.",
      ),
    },
  },
  {
    key: "road",
    category: "national",
    tags: ["roadSafety"],
    author: "desk",
    image: "road",
    format: "standard",
    ageHours: 96,
    bn: {
      title: "পথচারীর নিরাপত্তা: রাস্তা পার হওয়ার আগে যা মনে রাখবেন",
      slug: "পথচারীর-নিরাপত্তা-রাস্তা-পারাপার",
      summary: "জেব্রা ক্রসিং ও ফুটওভারব্রিজ ব্যবহার, মোবাইলে মগ্ন না থাকা আর রাতে উজ্জ্বল পোশাক: পথচারীর সুরক্ষার সহজ নিয়ম।",
      body: p(
        "সড়ক দুর্ঘটনায় পথচারীরা সবচেয়ে ঝুঁকিপূর্ণ অবস্থানে থাকেন। কয়েকটি সহজ অভ্যাস এই ঝুঁকি অনেকটাই কমাতে পারে।",
        "<ul><li>নির্ধারিত জেব্রা ক্রসিং, ফুটওভারব্রিজ বা আন্ডারপাস ব্যবহার করুন।</li><li>রাস্তা পার হওয়ার আগে দুই দিকে ভালো করে দেখুন; চলন্ত যানবাহনের ফাঁক দিয়ে দৌড়ে পার হবেন না।</li><li>পারাপারের সময় মোবাইল ফোনে কথা বলা বা স্ক্রিনে মগ্ন থাকা থেকে বিরত থাকুন।</li><li>ফুটপাত থাকলে সেটি ব্যবহার করুন; না থাকলে রাস্তার এক পাশ দিয়ে আসা গাড়ির মুখোমুখি হয়ে হাঁটুন।</li><li>রাতে হালকা বা উজ্জ্বল রঙের পোশাক পরুন, যাতে চালকেরা দূর থেকে দেখতে পান।</li></ul>",
        "শিশুদের রাস্তা পার হওয়ার নিয়ম শেখানো এবং তাদের হাত ধরে পারাপার করানো পরিবারের বড়দের দায়িত্ব।",
      ),
    },
    en: {
      title: "Pedestrian safety: what to remember before you cross",
      slug: "pedestrian-safety-before-you-cross",
      summary: "Use zebra crossings and footbridges, keep your eyes off the phone and wear bright clothing at night: simple rules for staying safe on foot.",
      body: p(
        "Pedestrians are among the most vulnerable people on the road. A few simple habits can reduce the risk considerably.",
        "<ul><li>Use marked zebra crossings, footbridges or underpasses.</li><li>Look carefully both ways before crossing; do not run through gaps in moving traffic.</li><li>Do not talk on the phone or stare at a screen while crossing.</li><li>Use the footpath where there is one; where there is not, walk facing oncoming traffic on one side of the road.</li><li>Wear light or bright clothing at night so drivers can see you from a distance.</li></ul>",
        "Teaching children how to cross safely, and holding their hands while crossing, is a responsibility for every adult in the family.",
      ),
    },
  },
  {
    key: "trust",
    category: "opinion",
    tags: ["journalism"],
    author: "editorial",
    format: "opinion",
    ageHours: 120,
    bn: {
      title: "পাঠকের আস্থাই সংবাদের ভিত্তি",
      slug: "পাঠকের-আস্থাই-সংবাদের-ভিত্তি",
      summary: "দ্রুততার প্রতিযোগিতায় যাচাইকে বিসর্জন দেওয়া চলে না। ভুল হলে স্বীকার করা এবং সংশোধন প্রকাশ করাই দায়িত্বশীল সাংবাদিকতার পরিচয়।",
      body: p(
        "সংবাদমাধ্যমের সবচেয়ে বড় সম্পদ তার পাঠকের আস্থা। এই আস্থা একদিনে তৈরি হয় না, কিন্তু একটি অযাচাইকৃত খবরেই তা নষ্ট হতে পারে।",
        "সামাজিক যোগাযোগমাধ্যমের যুগে সবার আগে খবর দেওয়ার চাপ বেড়েছে। আমরা মনে করি, আগে দেওয়ার চেয়ে সঠিক দেওয়া বেশি জরুরি। তাই প্রতিটি তথ্য একাধিক সূত্রে যাচাই করা, সূত্র স্পষ্টভাবে উল্লেখ করা এবং মতামতকে সংবাদ থেকে আলাদা রাখা আমাদের নীতি।",
        "ভুল যেকোনো সংবাদমাধ্যমেরই হতে পারে। সেই ভুল স্বীকার করা, স্পষ্টভাবে সংশোধনী প্রকাশ করা এবং কোন তথ্য বদলেছে তা পাঠককে জানানোই দায়িত্বশীলতা। পাঠকের প্রশ্ন ও সমালোচনাকে আমরা স্বাগত জানাই, কারণ সেগুলোই আমাদের আরও ভালো করে তোলে।",
      ),
    },
    en: {
      title: "Reader trust is the foundation of news",
      slug: "reader-trust-is-the-foundation-of-news",
      summary: "Verification cannot be sacrificed in the race to be first. Admitting mistakes and publishing corrections is what responsible journalism looks like.",
      body: p(
        "A news organisation’s greatest asset is the trust of its readers. That trust is built slowly, and a single unverified story can damage it.",
        "Social media has increased the pressure to publish first. We believe being right matters more than being first. That is why our policy is to verify information with more than one source, to name our sources clearly wherever we can, and to keep opinion separate from news.",
        "Every newsroom makes mistakes. Acknowledging them, publishing clear corrections and telling readers what has changed is what responsibility means. We welcome readers’ questions and criticism, because they make our work better.",
      ),
    },
  },
];
