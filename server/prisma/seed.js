import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.TZ ||= "Africa/Kigali";
const prisma = new PrismaClient();

// ── Deterministic randomness so every seed produces the same shop history ──
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261121);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const chance = (p) => rand() < p;
function sample(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

// ── Photos (Unsplash CDN, all verified to resolve) ──
const U = (id, w = 900) => `https://images.unsplash.com/photo-${id}?w=${w}&q=72&auto=format&fit=crop`;
const IMG = {
  icedCoffee: "1461023058943-07fcbe16d735", avoToast: "1482049016688-2d3e1b311543", parfait: "1488477181946-6428a0291777",
  healthyPlate: "1490645935967-10de6ba17061", cappuccino: "1495474472287-4d71bcdd2085", beefPlate: "1504674900247-0877df9cc836",
  pilau: "1512058564366-18510be2db19", bakery: "1517433670267-08bbd4be890f", eggToast: "1525351484163-7529414344d8",
  meatballs: "1529042410759-befb1204b468", grilledChicken: "1532550907401-a500c9a57435", darkSalad: "1540189549336-e6e99c3679fe",
  saladBowl: "1543339308-43e59d6b73a6", mocktails: "1544145945-f90425340c7e", teaCookies: "1544787219-7f47ccb76574",
  sliders: "1550547660-d9450f859349", burgerFries: "1551782450-a2132b4ba21d", clubSandwich: "1553909489-cd47e0907980",
  icedTea: "1556679343-c7306c1976bc", blackTea: "1558160074-4d7d8bdf4256", cookies: "1558961363-fa8fdf82db35",
  shrimpPasta: "1563379926898-05f4575a45d8", curry: "1565557623262-b51c2513a641", berryCake: "1565958011703-44f9829ba187",
  layerCake: "1571115177098-24ec42ed204d", oreoShake: "1572490122747-3968b75cc699", margherita: "1574071318508-1cdbab80d002",
  teaGlass: "1576092768241-dec231879fc3", tallBurger: "1586190848861-99aa4a171e90", burgerFries2: "1594212699903-ec8a3eca50f5",
  steakFries: "1600891964092-4316c288032e", samosa: "1601050690597-df0568f70950", friedRice: "1603133872878-684f208fb84b",
  brownies: "1606313564200-e75d5e30476c", fruitSpread: "1606787366850-de6330128bfc", friedChicken: "1626082927389-6cd097cdc6ec",
  frenchToast: "1484723091739-30a097e8f929", iceCream: "1497034825429-c343d7c6a68f", cafe: "1501339847302-ac426a4a7cbb",
  smoothies: "1505252585461-04db1eb84625", coffee: "1509042239860-f550ce710b93", vegBowl: "1512621776951-a57141f2eefd",
  pizzaSlices: "1513104890138-7c749659a591", toastie: "1528735602780-2552fd46c7af", dumplings: "1534422298391-e4f8c172dddb",
  chickenBowl: "1546069901-ba9599a7e63c", grainBowl: "1547592180-85f173990554", donuts: "1551024601-bec78aea704b",
  croissant: "1555507036-ab1f4038808a", skewers: "1555939594-58d7cb561ad1", chocJar: "1563805042-7684c019e1cb",
  pancakes: "1567620905732-2d1ec7ab7445", cheeseburger: "1568901346375-23c9450c58cd", burger: "1571091718767-18b5b1457add",
  tiramisu: "1571877227200-a0d98ea607e9", fries: "1573080496219-bb080dd4f877", chocCake: "1578985545062-69928b1d9587",
  noodles: "1585032226651-759b368d7246", bibimbap: "1590301157890-4810ed352733", chickenVeg: "1598515214211-89d3c73ae83b",
  tacos: "1599974579688-8dbdd335c77f", oj: "1600271886742-f049cd451bba", benedict: "1608039829572-78524f79c4c7",
  penne: "1621996346565-e3dbc646d9a9", juiceJars: "1622597467836-f3285f2131b8", chickenPlatter: "1626645738196-c2a7c87a8f58",
};
const img = (k) => (k ? U(IMG[k]) : null);

// ── Shops ──
// quality: centre of the rating distribution; traffic: relative order volume; slots: pickup-hour weights
const LUNCH = [12, 12, 12, 13, 13, 11, 14, 18, 17, 19];
const BREAKFAST = [7, 7, 8, 8, 8, 9, 10, 10, 15, 16];
const ALLDAY = [8, 10, 12, 12, 13, 13, 15, 16, 17, 18];

const SHOPS = [
  {
    owner: ["Marie Uwimana", "marie@campusbite.test"],
    shop_name: "Mama Marie's Kitchen",
    cuisine: "Rwandan",
    description: "Home cooking the way it's done up-country. Isombe on Mondays and Thursdays, brochettes every day, and a buffet plate that will carry you through a double lab.",
    location: "Behind the Main Library",
    phone: "0788123456",
    opens_at: "07:30", closes_at: "20:00", prep_minutes: 20,
    cover: "skewers", quality: 4.6, traffic: 1.5, slots: LUNCH, is_open: true,
    items: [
      ["Buffet Plate", "Rice, beans, greens, plantain and a piece of beef. Ask for extra sauce.", 2000, "Plates", "beefPlate"],
      ["Isombe & Ubugali", "Pounded cassava leaves cooked with eggplant and peanut, served with ubugali.", 1500, "Plates", null],
      ["Rice & Beans", "Steamed rice, slow-cooked red beans, a spoon of kachumbari.", 1200, "Plates", "friedRice"],
      ["Beef Brochettes (2)", "Charcoal-grilled beef skewers with chips and salad.", 2500, "Grill", "skewers"],
      ["Goat Brochettes (2)", "Marinated goat on the grill, served with grilled plantain.", 2800, "Grill", "steakFries"],
      ["Chips Mayai", "Fries folded into a two-egg omelette. A campus institution.", 1800, "Plates", null],
      ["Matoke in Peanut Sauce", "Steamed green bananas in a rich groundnut sauce.", 1600, "Plates", "curry"],
      ["Pilau", "Spiced rice with beef, cumin and cardamom.", 1800, "Plates", "pilau"],
      ["Chapati", "Soft layered flatbread, made fresh every morning.", 300, "Sides", null],
      ["Ikivuguto", "Traditional fermented milk, served cold.", 500, "Drinks", null],
      ["Passion Juice", "Fresh-pressed passion fruit, lightly sweetened.", 800, "Drinks", "juiceJars"],
    ],
  },
  {
    owner: ["Jean Habimana", "jean@campusbite.test"],
    shop_name: "Quick Bites",
    cuisine: "Snacks",
    description: "Toasties, samosas and cold drinks out of a window by the main gate. Built for the ten minutes between lectures.",
    location: "Main Gate kiosk",
    phone: "0788654321",
    opens_at: "07:00", closes_at: "21:00", prep_minutes: 10,
    cover: "toastie", quality: 4.2, traffic: 1.3, slots: ALLDAY, is_open: true,
    items: [
      ["Beef Samosas (3)", "Crispy pastry, spiced minced beef, lemon wedge.", 600, "Snacks", "samosa"],
      ["Chicken Toastie", "Pulled chicken, cheese and onion pressed in a sandwich toaster.", 1500, "Sandwiches", "toastie"],
      ["Club Sandwich", "Triple-decker with egg, chicken, tomato and lettuce.", 2000, "Sandwiches", "clubSandwich"],
      ["Egg & Avocado Toast", "Fried egg on sourdough with smashed avocado.", 1200, "Sandwiches", "avoToast"],
      ["Chips", "Hand-cut fries, salted. Add chilli on request.", 800, "Snacks", "fries"],
      ["Meatballs & Bread", "Six beef meatballs in tomato sauce with a bread roll.", 1500, "Snacks", "meatballs"],
      ["Sugar Doughnut", "Fried this morning, rolled in sugar.", 300, "Snacks", null],
      ["Soda 500ml", "Coca-Cola, Fanta Orange or Sprite.", 500, "Drinks", null],
      ["Iced Lemon Tea", "Black tea, lemon and mint over ice.", 700, "Drinks", "icedTea"],
      ["Water 500ml", "Still mineral water.", 300, "Drinks", null],
    ],
  },
  {
    owner: ["Aline Mukiza", "aline@campusbite.test"],
    shop_name: "Fresh Juice Corner",
    cuisine: "Juices & Breakfast",
    description: "Juice pressed to order, smoothies, and a proper breakfast menu until 11. Fruit comes in from Kimironko market every morning.",
    location: "Student Centre, ground floor",
    phone: "0788111222",
    opens_at: "06:30", closes_at: "18:00", prep_minutes: 10,
    cover: "fruitSpread", quality: 4.7, traffic: 1.1, slots: BREAKFAST, is_open: true,
    items: [
      ["Fresh Orange Juice", "Squeezed when you order. Nothing added.", 900, "Juices", "oj"],
      ["Passion & Mango", "Half passion fruit, half mango. Our best seller.", 1100, "Juices", "juiceJars"],
      ["Tree Tomato Juice", "Tamarillo, sweet and sharp.", 800, "Juices", null],
      ["Mango Smoothie", "Mango, yoghurt, honey.", 1200, "Smoothies", "smoothies"],
      ["Peanut Banana Smoothie", "Banana, peanut butter, milk. Basically lunch.", 1300, "Smoothies", "oreoShake"],
      ["Yoghurt Parfait", "Greek yoghurt, granola and strawberries.", 1300, "Breakfast", "parfait"],
      ["Pancake Stack", "Three pancakes with honey and banana.", 1500, "Breakfast", "pancakes"],
      ["French Toast", "Brioche, berries, banana.", 1600, "Breakfast", "frenchToast"],
      ["Eggs on Toast", "Two fried eggs on buttered toast.", 1200, "Breakfast", "eggToast"],
      ["Fruit Salad", "Pineapple, papaya, banana, passion.", 1000, "Breakfast", "fruitSpread"],
    ],
  },
  {
    owner: ["Patrick Nshimiyimana", "patrick@campusbite.test"],
    shop_name: "Campus Grill House",
    cuisine: "Grill",
    description: "Charcoal grill behind Lecture Hall B. Chicken, tilapia and goat, all with chips and a fresh salad. Worth the queue.",
    location: "Behind Lecture Hall B",
    phone: "0788333444",
    opens_at: "11:00", closes_at: "21:30", prep_minutes: 25,
    cover: "steakFries", quality: 4.4, traffic: 1.2, slots: LUNCH, is_open: true,
    items: [
      ["Quarter Chicken & Chips", "Grilled chicken quarter, chips, kachumbari.", 2800, "Grill", "chickenVeg"],
      ["Half Chicken & Chips", "For the hungry. Feeds one very well.", 4500, "Grill", "grilledChicken"],
      ["Grilled Tilapia", "Whole tilapia from Lake Kivu, chips and salad.", 4000, "Grill", null],
      ["Steak & Chips", "Sirloin cooked over charcoal with garlic butter.", 4200, "Grill", "steakFries"],
      ["Fried Chicken (4 pcs)", "Crispy, peppery, with a chilli dip.", 3000, "Fried", "chickenPlatter"],
      ["Spicy Wings (6)", "Grilled wings in pili-pili glaze.", 2200, "Fried", "friedChicken"],
      ["Grill House Burger", "Beef patty, cheddar, pickles, chips.", 2800, "Burgers", "burgerFries"],
      ["Coleslaw", "Cabbage, carrot, light mayo.", 500, "Sides", null],
      ["Chips", "Large portion.", 900, "Sides", "fries"],
      ["Soda 350ml", "Assorted.", 400, "Drinks", null],
    ],
  },
  {
    owner: ["Diane Uwera", "diane@campusbite.test"],
    shop_name: "Sweet Tooth Bakery",
    cuisine: "Bakery & Coffee",
    description: "Croissants out of the oven at 7, Rwandan single-origin coffee, and cakes that disappear by 4pm. Sit in or grab and go.",
    location: "Near the Computer Lab",
    phone: "0788555666",
    opens_at: "07:00", closes_at: "19:00", prep_minutes: 10,
    cover: "bakery", quality: 4.8, traffic: 1.2, slots: BREAKFAST, is_open: true,
    items: [
      ["Butter Croissant", "Laminated by hand, baked every morning.", 800, "Bakery", "croissant"],
      ["Chocolate Cake Slice", "Dark chocolate sponge, ganache frosting.", 1500, "Cakes", "chocCake"],
      ["Raspberry Sponge", "Vanilla sponge, cream, raspberries.", 1600, "Cakes", "berryCake"],
      ["Tiramisu", "Espresso-soaked, mascarpone, cocoa.", 1800, "Cakes", "tiramisu"],
      ["Fudge Brownie", "Dense, gooey, generous.", 900, "Bakery", "brownies"],
      ["Chocolate Chip Cookies (3)", "Crisp edges, soft middle.", 700, "Bakery", "cookies"],
      ["Glazed Doughnuts (2)", "Sprinkles optional, joy guaranteed.", 1000, "Bakery", "donuts"],
      ["Cappuccino", "Double shot, Maraba beans.", 1200, "Coffee", "cappuccino"],
      ["Iced Coffee", "Cold brew over milk and ice.", 1400, "Coffee", "icedCoffee"],
      ["Black Coffee", "Filter, refilled once for free.", 600, "Coffee", "coffee"],
      ["Hot Chocolate", "Proper cocoa, whipped cream.", 1100, "Coffee", "chocJar"],
    ],
  },
  {
    owner: ["Claude Mugabo", "claude@campusbite.test"],
    shop_name: "Kigali Bowl",
    cuisine: "Healthy",
    description: "Grain bowls and salads with local produce. Vegetarian options on every line. Closed during exam week for restocking.",
    location: "Sports Complex entrance",
    phone: "0788777888",
    opens_at: "10:00", closes_at: "19:00", prep_minutes: 15,
    cover: "vegBowl", quality: 4.3, traffic: 0.8, slots: LUNCH, is_open: false,
    items: [
      ["Rainbow Bowl", "Brown rice, chickpeas, avocado, roast veg, tahini.", 2500, "Bowls", "vegBowl"],
      ["Chicken Power Bowl", "Grilled chicken, quinoa, corn, slaw.", 3000, "Bowls", "chickenBowl"],
      ["Harvest Grain Bowl", "Farro, green beans, tomatoes, seeds.", 2400, "Bowls", "grainBowl"],
      ["Egg & Greens Plate", "Boiled eggs, spinach, cucumber, salsa.", 2200, "Bowls", "healthyPlate"],
      ["Garden Salad", "Mixed leaves, tomato, onion, lemon dressing.", 1500, "Salads", "saladBowl"],
      ["Beetroot & Orange Salad", "With toasted pumpkin seeds.", 1700, "Salads", "darkSalad"],
      ["Avocado Smash Toast", "Sourdough, avocado, chilli flakes.", 1400, "Salads", "avoToast"],
      ["Mint Lemonade", "Fresh lemon, mint, a little honey.", 800, "Drinks", "mocktails"],
    ],
  },
  {
    owner: ["Sandrine Ingabire", "sandrine@campusbite.test"],
    shop_name: "Chai & Chapati",
    cuisine: "East African",
    description: "A tea house that opens at 6am for the early labs. Spiced chai, chapati off the pan, mandazi and beef curry at lunchtime.",
    location: "East Wing courtyard",
    phone: "0788999000",
    opens_at: "06:00", closes_at: "20:00", prep_minutes: 12,
    cover: "curry", quality: 4.5, traffic: 1.0, slots: BREAKFAST, is_open: true,
    items: [
      ["Spiced Chai", "Black tea, ginger, cardamom, milk.", 500, "Tea", "teaGlass"],
      ["African Tea Pot", "A pot for two, with milk on the side.", 900, "Tea", "blackTea"],
      ["Tea & Biscuits", "Cup of chai with two home-made biscuits.", 700, "Tea", "teaCookies"],
      ["Chapati (2)", "Layered, soft, buttery.", 600, "Breakfast", null],
      ["Mandazi (4)", "Coconut and cardamom doughnuts.", 500, "Breakfast", null],
      ["Beef Curry & Chapati", "Slow-cooked beef in a tomato curry.", 2200, "Lunch", "curry"],
      ["Bean Stew & Chapati", "Coconut beans, two chapatis.", 1500, "Lunch", null],
      ["Vegetable Samosas (3)", "Potato, peas, green chilli.", 600, "Snacks", "samosa"],
    ],
  },
  {
    owner: ["Emmanuel Tuyishime", "emmanuel@campusbite.test"],
    shop_name: "Pizza Corner",
    cuisine: "Pizza",
    description: "Stone-oven pizza by the slice or whole. Thursday is two-for-one on whole pizzas after 5pm.",
    location: "West Entrance",
    phone: "0788222333",
    opens_at: "11:00", closes_at: "22:00", prep_minutes: 20,
    cover: "margherita", quality: 4.1, traffic: 0.9, slots: LUNCH, is_open: true,
    items: [
      ["Margherita (whole)", "Tomato, mozzarella, basil.", 5000, "Pizza", "margherita"],
      ["Pepperoni (whole)", "Beef pepperoni, mozzarella, oregano.", 6000, "Pizza", "pizzaSlices"],
      ["Slice of the Day", "Ask what's in the oven.", 1200, "Pizza", "pizzaSlices"],
      ["Chicken Tikka Pizza", "Tikka chicken, red onion, coriander.", 6500, "Pizza", null],
      ["Penne Arrabbiata", "Spicy tomato, garlic, parmesan.", 3000, "Pasta", "penne"],
      ["Prawn Spaghetti", "Garlic, chilli, cherry tomatoes.", 4500, "Pasta", "shrimpPasta"],
      ["Garlic Bread", "With mozzarella.", 1200, "Sides", null],
      ["Vanilla Cone", "Soft serve.", 800, "Desserts", "iceCream"],
    ],
  },
  {
    owner: ["Olivier Kamanzi", "olivier@campusbite.test"],
    shop_name: "Burger Lab",
    cuisine: "Burgers",
    description: "Smash burgers on brioche, loaded fries and thick shakes. Run by two engineering graduates who took burgers too seriously.",
    location: "Engineering Block car park",
    phone: "0788444555",
    opens_at: "11:30", closes_at: "22:00", prep_minutes: 15,
    cover: "cheeseburger", quality: 4.5, traffic: 1.1, slots: LUNCH, is_open: true,
    items: [
      ["Classic Smash", "Double smashed beef, cheese, pickles, house sauce.", 3200, "Burgers", "cheeseburger"],
      ["Lab Stack", "Triple patty, bacon, onion rings. Not for the faint-hearted.", 4500, "Burgers", "tallBurger"],
      ["Chicken Crunch", "Buttermilk fried chicken thigh, slaw, chilli mayo.", 3000, "Burgers", "burger"],
      ["Slider Trio", "Three mini burgers, three sauces.", 3500, "Burgers", "sliders"],
      ["Burger & Fries Combo", "Classic Smash with fries and a soda.", 4200, "Combos", "burgerFries2"],
      ["Loaded Fries", "Cheese sauce, jalapeños, crispy onions.", 1800, "Sides", "fries"],
      ["Oreo Shake", "Vanilla ice cream, Oreos, whipped cream.", 2000, "Shakes", "oreoShake"],
      ["Chocolate Shake", "Thick enough to need a spoon.", 2000, "Shakes", "chocJar"],
    ],
  },
  {
    owner: ["Fiona Uwamahoro", "fiona@campusbite.test"],
    shop_name: "Noodle House",
    cuisine: "Asian",
    description: "Wok noodles, fried rice and dumplings. Everything is cooked to order on a very loud wok burner.",
    location: "Hostel Block C, ground floor",
    phone: "0788666777",
    opens_at: "11:00", closes_at: "21:00", prep_minutes: 15,
    cover: "noodles", quality: 4.0, traffic: 0.9, slots: LUNCH, is_open: true,
    items: [
      ["Chicken Chow Mein", "Egg noodles, chicken, cabbage, soy.", 2500, "Noodles", "noodles"],
      ["Veg Fried Rice", "Egg, peas, carrot, spring onion.", 1800, "Rice", "friedRice"],
      ["Beef Fried Rice", "With chilli oil on the side.", 2500, "Rice", "pilau"],
      ["Bibimbap", "Rice, vegetables, fried egg, gochujang.", 3000, "Rice", "bibimbap"],
      ["Pork Dumplings (6)", "Steamed, with black vinegar dip.", 2000, "Small plates", "dumplings"],
      ["Chicken Tacos (2)", "Our Friday special, now every day.", 2200, "Small plates", "tacos"],
      ["Iced Tea", "Lemon, lightly sweet.", 700, "Drinks", "icedTea"],
    ],
  },
];

const STUDENT_NAMES = [
  "Eric Niyonzima", "Grace Ishimwe", "David Mugisha", "Clarisse Umutoni", "Kevin Ndayisaba", "Alice Mukamana",
  "Samuel Bizimana", "Josiane Uwase", "Yves Habimana", "Ange Iradukunda", "Bosco Nkurunziza", "Divine Uwineza",
  "Fabrice Mutabazi", "Gloria Akaliza", "Herve Manzi", "Ines Keza", "Jules Ntwari", "Kelia Mutesi",
  "Landry Gatete", "Merveille Ingabire", "Nadine Umuhoza", "Oscar Shema", "Pacifique Hakizimana", "Queen Uwera",
  "Regis Nsengiyumva", "Sonia Mukeshimana", "Thierry Rugamba", "Vanessa Tuyisenge", "Wilson Nzeyimana", "Xavier Byiringiro",
  "Yvette Nyiransabimana", "Zawadi Kayitesi", "Aimable Ndikumana", "Bella Uwamahoro", "Cedric Murenzi", "Doreen Umutesi",
  "Elvis Kwizera", "Faith Ishema", "Gad Rukundo", "Honorine Mukandayisenga",
];

const REVIEW_TEXT = {
  5: [
    "The {item} was spot on, and it was ready the minute I walked up. This is how pre-ordering should work.",
    "Best {item} on campus, I'm not even debating it.",
    "Ordered between two lectures, picked up in under a minute. {item} still hot.",
    "Generous portion. The {item} alone could feed two first-years.",
    "Consistently good. I've had the {item} maybe ten times now and it's never been off.",
    "Friendly staff, remembered my name. The {item} was excellent.",
    "Honestly better than places in town. {item} 10/10.",
    "Fast, clean, tasty. Nothing else to say.",
  ],
  4: [
    "Really good {item}. Took a few minutes longer than the pickup time but worth it.",
    "Solid as always. Would love a bit more sauce with the {item}.",
    "Good value for the price. The {item} was tasty, packaging could be better.",
    "Nice {item}, will order again. Queue at pickup was a bit long.",
    "Tasty and filling. Wish they opened earlier on weekends.",
  ],
  3: [
    "The {item} was okay. A bit cold by the time I got it.",
    "Decent, but portion was smaller than last time.",
    "Food was fine, but my order wasn't ready at the pickup time.",
    "Average. The {item} needed more salt.",
  ],
  2: [
    "Waited 15 minutes after my pickup time. {item} was lukewarm.",
    "They forgot part of my order. Sorted it out eventually but annoying.",
  ],
  1: [
    "Waited almost 25 minutes past pickup and nobody answered the phone.",
    "{item} was cold and dry. Not ordering again.",
  ],
};

// Reviews written in Kinyarwanda (about 40% of seeded reviews)
const REVIEW_TEXT_RW = {
  5: [
    "Ibiryo biraryoshye cyane, kandi byari byiteguye nkihagera. Nzagaruka!",
    "Ni ho hantu heza ho kurira hano ku ishuri. Murakoze cyane!",
    "Natumije hagati y'amasomo, mbibona bigishyushye. Ni byiza cyane.",
    "Ibiryo ni byiza cyane, kandi igiciro kirahendutse.",
    "Abakozi bakira neza abakiriya, n'ibiryo biraryoshye.",
    "Serivisi yihuse cyane. Sinongeye gutegereza ku murongo!",
  ],
  4: [
    "Ibiryo ni byiza, ariko byatinze iminota mike.",
    "Biraryoshye, gusa mwongereho isosi.",
    "Ni byiza ku giciro cyabyo, ariko mupfunyike neza kurushaho.",
    "Ndabishima. Nifuza ko mwajya mufungura kare mu mpera z'icyumweru.",
  ],
  3: [
    "Ibiryo byari bisanzwe. Byangezeho bikonje gato.",
    "Ingano y'ibiryo yari nto ugereranyije n'ubushize.",
    "Ntabwo byari byiteguye ku isaha nari nahisemo.",
  ],
  2: [
    "Nategereje iminota 15 nyuma y'isaha nari nahisemo, kandi ibiryo byari bikonje.",
    "Bibagiwe igice cy'ibyo natumije. Byakemutse ariko byantinze.",
  ],
  1: [
    "Ibiryo byari bikonje kandi byumye. Sinzongera gutumiza hano.",
    "Nategereje igihe kirekire kandi nta wafataga telefoni.",
  ],
};

const REPLIES_RW = {
  high: ["Murakoze cyane! Muzagaruke.", "Twishimiye ko byabanyuze. Murakaza neza igihe cyose!", "Murakoze ku magambo meza!"],
  low: ["Tubiseguyeho. Twabikosoye, muzongere mutugerageze.", "Murakoze kutubwira. Tugiye kubikosora.", "Mutubabarire. Muze tubakemurire ikibazo."],
};

const REPLIES = {
  high: [
    "Thank you! See you at the counter again soon.",
    "Murakoze cyane! Glad you enjoyed it.",
    "That means a lot to the whole team. Thank you!",
    "Thanks for the kind words, next one's on us if you show this review.",
  ],
  low: [
    "Sorry about that. We were short-staffed at lunch, it's been fixed. Please give us another try.",
    "Thanks for telling us. We've spoken to the kitchen about portion sizes.",
    "Apologies! Come by and we'll make it right.",
  ],
};

const CANCEL_VENDOR = ["Ran out of ingredients for this dish", "Kitchen closing early today", "Item sold out, sorry!"];
const CANCEL_STUDENT = ["Changed my plans", "Ordered by mistake", "Class ran late"];
const NOTES = ["Extra pili-pili please", "No onions", "Less salt", "I'll be 5 minutes late", "Extra sauce", "Please pack separately", null, null, null, null, null, null];

function ratingAround(q) {
  const r = q + (rand() - 0.5) * 2.2 + (chance(0.06) ? -2 : 0);
  return Math.max(1, Math.min(5, Math.round(r)));
}

function at(dayOffset, hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const usedCodes = new Set();
function code() {
  let c;
  do {
    c = "CB-" + Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]).join("");
  } while (usedCodes.has(c));
  usedCodes.add(c);
  return c;
}

async function main() {
  console.log("Seeding CampusBite…");

  await prisma.$executeRawUnsafe(
    'TRUNCATE "ReviewPhoto", "Review", "Favorite", "OrderItem", "Order", "Promo", "MenuItem", "Vendor", "User" RESTART IDENTITY CASCADE',
  );

  const hash = await bcrypt.hash("password123", 10);

  // Students
  const students = [];
  for (const name of STUDENT_NAMES) {
    const email = `${name.split(" ")[0].toLowerCase()}@campusbite.test`;
    students.push(
      await prisma.user.create({
        data: { name, email, password_hash: hash, role: "STUDENT", phone: `07${pick(["8", "9", "2", "3"])}${String(between(0, 9999999)).padStart(7, "0")}` },
      }),
    );
  }

  // Vendors + menus
  const shops = [];
  for (const s of SHOPS) {
    const user = await prisma.user.create({
      data: { name: s.owner[0], email: s.owner[1], password_hash: hash, role: "VENDOR", phone: s.phone },
    });
    const vendor = await prisma.vendor.create({
      data: {
        user_id: user.id,
        shop_name: s.shop_name,
        cuisine: s.cuisine,
        description: s.description,
        location: s.location,
        phone: s.phone,
        opens_at: s.opens_at,
        closes_at: s.closes_at,
        prep_minutes: s.prep_minutes,
        is_open: s.is_open,
        cover_url: U(IMG[s.cover], 1400),
      },
    });
    const items = await prisma.menuItem.createManyAndReturn({
      data: s.items.map(([name, description, price, category, photo], idx) => ({
        vendor_id: vendor.id,
        name,
        description,
        price,
        category,
        image_url: img(photo),
        // one item per shop sold out so the state is visible
        is_available: idx !== s.items.length - 2 || !chance(0.5),
      })),
    });
    shops.push({ ...s, vendor, items });
  }

  // Promo codes
  const promoDefs = [
    [0, "KARIBU10", 10, 1500, null, 30],
    [0, "LUNCH15", 15, 3000, 100, 12],
    [1, "BETWEEN5", 5, 0, null, null],
    [2, "MORNING20", 20, 2000, 50, 20],
    [4, "SWEET10", 10, 1000, null, 30],
    [8, "SMASH2026", 15, 3000, 200, 45],
    [6, "CHAI10", 10, 1000, null, null],
  ];
  const promos = [];
  for (const [si, c, pct, min, max, days] of promoDefs) {
    promos.push(
      await prisma.promo.create({
        data: {
          vendor_id: shops[si].vendor.id,
          code: c,
          percent_off: pct,
          min_order: min,
          max_uses: max,
          expires_at: days ? new Date(Date.now() + days * 864e5) : null,
        },
      }),
    );
  }
  await prisma.promo.create({
    data: { vendor_id: shops[0].vendor.id, code: "EXAMS25", percent_off: 25, min_order: 2000, is_active: false, used_count: 0 },
  });

  // ── Order history ──
  const orderRows = [];
  const itemRowsByCode = new Map();
  const meta = new Map(); // code -> {shop, completed}
  const promoUses = new Map();
  const now = new Date();

  function buildOrder(shop, student, created, pickup, status, opts = {}) {
    const available = shop.items.filter((i) => i.is_available);
    const lineCount = chance(0.55) ? 1 : chance(0.7) ? 2 : 3;
    const chosen = sample(available, lineCount);
    const lines = chosen.map((m) => {
      const q = chance(0.8) ? 1 : between(2, 3);
      return { menu_item_id: m.id, quantity: q, unit_price: m.price, subtotal: m.price * q, _name: m.name, _img: m.image_url };
    });
    const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);

    let promo_code = null;
    let discount = 0;
    const shopPromos = promos.filter((p) => p.vendor_id === shop.vendor.id && p.is_active && subtotal >= p.min_order);
    if (shopPromos.length && chance(0.18)) {
      const p = pick(shopPromos);
      promo_code = p.code;
      discount = Math.floor((subtotal * p.percent_off) / 100);
      if (status !== "CANCELLED") promoUses.set(p.id, (promoUses.get(p.id) || 0) + 1);
    }

    const method = chance(0.55) ? "MOMO" : chance(0.4) ? "AIRTEL" : "CASH";
    let payment_status = "PENDING";
    if (status === "COMPLETED") payment_status = "PAID";
    else if (status === "CANCELLED") payment_status = method !== "CASH" && chance(0.6) ? "REFUNDED" : "PENDING";
    else if (method !== "CASH") payment_status = chance(0.9) ? "PAID" : "PENDING";

    const c = code();
    const vendorCancel = chance(0.6);
    const accepted = ["ACCEPTED", "PREPARING", "READY", "COMPLETED"].includes(status) ? new Date(created.getTime() + between(1, 4) * 60000) : null;
    const ready = ["READY", "COMPLETED"].includes(status) ? new Date(accepted.getTime() + between(Math.max(5, shop.prep_minutes - 6), shop.prep_minutes + 8) * 60000) : null;

    orderRows.push({
      code: c,
      student_id: student.id,
      vendor_id: shop.vendor.id,
      status,
      pickup_time: pickup,
      subtotal,
      discount,
      total_amount: subtotal - discount,
      promo_code,
      payment_method: method,
      payment_status,
      payment_phone: method === "CASH" ? null : student.phone,
      note: pick(NOTES),
      cancel_reason: status === "CANCELLED" ? (vendorCancel ? pick(CANCEL_VENDOR) : pick(CANCEL_STUDENT)) : null,
      cancelled_by: status === "CANCELLED" ? (vendorCancel ? "VENDOR" : "STUDENT") : null,
      accepted_at: accepted,
      ready_at: ready,
      completed_at: status === "COMPLETED" ? new Date(Math.max(ready.getTime(), pickup.getTime()) + between(0, 6) * 60000) : null,
      created_at: created,
      updated_at: created,
      // usability-evaluation samples (brief §2.10): time from first basket add to order, and "how easy was it?"
      checkout_seconds: chance(0.7) ? between(28, 75) + (chance(0.15) ? between(40, 160) : 0) : null,
      ease_rating: chance(0.35) ? (chance(0.82) ? between(4, 5) : between(2, 3)) : null,
      ...opts,
    });
    itemRowsByCode.set(c, lines);
    meta.set(c, { shop, student, status });
    return c;
  }

  // Each student has 2–4 regular haunts
  const haunts = new Map(students.map((st) => [st.id, sample(shops, between(2, 4))]));

  for (let day = 29; day >= 1; day--) {
    const date = at(day, 12, 0);
    const weekend = [0, 6].includes(date.getDay());
    for (const shop of shops) {
      if (!shop.is_open && day < 4) continue; // Kigali Bowl closed for the last few days
      const n = Math.round((weekend ? 2 : 5) * shop.traffic + rand() * 3);
      for (let k = 0; k < n; k++) {
        const regulars = students.filter((st) => haunts.get(st.id).includes(shop));
        const student = regulars.length && chance(0.75) ? pick(regulars) : pick(students);
        const hour = pick(shop.slots);
        const pickup = at(day, hour, pick([0, 10, 15, 20, 30, 40, 45, 50]));
        const created = new Date(pickup.getTime() - between(shop.prep_minutes + 2, 90) * 60000);
        buildOrder(shop, student, created, pickup, chance(0.08) ? "CANCELLED" : "COMPLETED");
      }
    }
  }

  // Today: some finished earlier, plus a live queue for every open shop
  const eric = students[0];
  for (const shop of shops.filter((s) => s.is_open)) {
    const doneToday = between(2, 6);
    for (let k = 0; k < doneToday; k++) {
      const pickup = new Date(now.getTime() - between(30, 300) * 60000);
      buildOrder(shop, pick(students), new Date(pickup.getTime() - between(20, 60) * 60000), pickup, chance(0.1) ? "CANCELLED" : "COMPLETED");
    }
    const live = shop === shops[0]
      ? ["SUBMITTED", "SUBMITTED", "SUBMITTED", "ACCEPTED", "ACCEPTED", "PREPARING", "PREPARING", "READY", "READY"]
      : ["SUBMITTED", "ACCEPTED", "PREPARING", "READY"].filter(() => chance(0.65));
    for (const st of live) {
      const pickup = new Date(now.getTime() + between(-5, 55) * 60000);
      pickup.setSeconds(0, 0);
      const created = new Date(now.getTime() - between(2, 25) * 60000);
      buildOrder(shop, pick(students.slice(1)), created, pickup, st);
    }
  }

  // Eric (demo student): an active order + a recent completed one waiting for a review
  const ericActive = buildOrder(shops[4], eric, new Date(now.getTime() - 6 * 60000), new Date(now.getTime() + 18 * 60000), "PREPARING");
  const ericUnreviewed = buildOrder(shops[0], eric, at(1, 12, 5), at(1, 12, 30), "COMPLETED");

  const createdOrders = await prisma.order.createManyAndReturn({ data: orderRows, select: { id: true, code: true } });
  const idByCode = new Map(createdOrders.map((o) => [o.code, o.id]));

  const itemRows = [];
  for (const [c, lines] of itemRowsByCode) {
    for (const { _name, _img, ...l } of lines) itemRows.push({ ...l, order_id: idByCode.get(c) });
  }
  await prisma.orderItem.createMany({ data: itemRows });

  for (const [pid, n] of promoUses) await prisma.promo.update({ where: { id: pid }, data: { used_count: n } });

  // ── Reviews (≈45% of completed orders), some with photos and owner replies ──
  const reviewRows = [];
  const photoPlan = [];
  for (const row of orderRows) {
    if (row.status !== "COMPLETED" || row.code === ericUnreviewed) continue;
    if (!chance(0.45)) continue;
    const { shop } = meta.get(row.code);
    const lines = itemRowsByCode.get(row.code);
    const rating = row.cancel_reason ? 1 : ratingAround(shop.quality);
    const hero = pick(lines);
    const rw = chance(0.4);
    const text = chance(0.85)
      ? rw
        ? pick(REVIEW_TEXT_RW[rating])
        : pick(REVIEW_TEXT[rating]).replace("{item}", hero._name.replace(/\s*\(.*\)$/, ""))
      : null;
    const created = new Date(row.completed_at.getTime() + between(10, 600) * 60000);
    if (created > now) continue;

    let vendor_reply = null;
    let replied_at = null;
    const replyChance = shop.shop_name === "Mama Marie's Kitchen" ? 0.5 : 0.4;
    // keep the newest few unreplied so vendors have something in their inbox
    if (chance(replyChance) && now - created > 2 * 864e5) {
      const pool = rw ? REPLIES_RW : REPLIES;
      vendor_reply = pick(rating >= 4 ? pool.high : pool.low);
      replied_at = new Date(created.getTime() + between(60, 1440) * 60000);
    }

    reviewRows.push({
      order_id: idByCode.get(row.code),
      user_id: row.student_id,
      vendor_id: row.vendor_id,
      rating,
      comment: text,
      vendor_reply,
      replied_at,
      created_at: created,
    });
    const pics = lines.map((l) => l._img).filter(Boolean);
    if (pics.length && rating >= 3 && chance(0.32)) photoPlan.push([idByCode.get(row.code), sample(pics, between(1, Math.min(3, pics.length)))]);
  }
  const reviews = await prisma.review.createManyAndReturn({ data: reviewRows, select: { id: true, order_id: true } });
  const reviewByOrder = new Map(reviews.map((r) => [r.order_id, r.id]));
  const photoRows = [];
  for (const [orderId, pics] of photoPlan) {
    for (const url of pics) photoRows.push({ review_id: reviewByOrder.get(orderId), url: url.replace("w=900", "w=700") });
  }
  await prisma.reviewPhoto.createMany({ data: photoRows });

  // Denormalised ratings
  for (const shop of shops) {
    const agg = await prisma.review.aggregate({ where: { vendor_id: shop.vendor.id }, _avg: { rating: true }, _count: true });
    await prisma.vendor.update({
      where: { id: shop.vendor.id },
      data: { rating_avg: Math.round((agg._avg.rating || 0) * 10) / 10, rating_count: agg._count },
    });
  }

  // Favourites
  const favRows = [];
  for (const st of students) for (const shop of haunts.get(st.id).slice(0, 2)) favRows.push({ user_id: st.id, vendor_id: shop.vendor.id });
  await prisma.favorite.createMany({ data: favRows, skipDuplicates: true });

  const counts = {
    students: students.length,
    vendors: shops.length,
    menu_items: shops.reduce((s, x) => s + x.items.length, 0),
    orders: orderRows.length,
    reviews: reviews.length,
    review_photos: photoRows.length,
    promos: promos.length + 1,
  };
  console.log(counts);
  console.log(`
  Demo accounts — password for all: password123

  Customer:  eric@campusbite.test   (live order ${ericActive}, an order waiting for a review)
  Vendor:    marie@campusbite.test  (Mama Marie's Kitchen — busy queue, unanswered reviews)
  Others:    jean@, aline@, patrick@, diane@, claude@, sandrine@, emmanuel@, olivier@, fiona@  (vendors)
             grace@, david@, clarisse@, kevin@ … (customers)
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
