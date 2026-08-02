/**
 * Every sentence the product says, in one file.
 *
 * This text is the highest-risk surface in the product: it is what a worried
 * parent reads at eleven at night. Keeping it here as data, rather than
 * concatenated through components, is so it can be reviewed in one sitting —
 * and it needs a BVC nurse to read it before this ships.
 *
 * The rules the copy has to keep:
 *   - never a verdict, a status word, a score or a colour-coded state
 *   - never a diagnosis, and never an instruction about what to do medically
 *   - the word "percentil" never appears; Swedish charts are read in SD
 *   - channel-crossing in early infancy is named as expected, not flagged
 *   - weight is never interpreted on its own
 *   - concern routes to BVC, and contacting BVC is never gated on a flag
 */

import { formatNumber } from "./format";

export const APP_NAME = "Kurvan";

export const START = {
  promise:
    "Barnets vikt, längd och huvudomfång på samma tillväxtkurvor som BVC använder. Så att siffrorna på kortet betyder något också hemma.",
  promiseWide:
    "Barnets vikt, längd och huvudomfång på samma tillväxtkurvor som BVC använder. Kurvan bedömer ingenting — den visar, och pekar vidare till BVC när något är värt att ta upp.",
  points: [
    "Samma referenskurvor som på BVC-kortet — medelvärde och standardavvikelser (SD).",
    "Du ser hur barnet följer sin egen kanal över tid. Det är trenden som säger något, inte en enskild punkt.",
    "Kurvan bedömer ingenting och ställer inga diagnoser. Det gör BVC — och dit hjälper vi dig hitta.",
  ],
  addChild: "Lägg till barn",
  // The design's first-run screen promised device-local storage. This build
  // keeps the data in an account so it survives a lost phone, so the promise
  // is stated as it actually is.
  storage: "Uppgifterna sparas på ditt konto och syns bara för dig.",
};

export const AUTH = {
  title: "Logga in",
  intro:
    "Kurvan sparar barnets mätningar på ditt konto. Bara du kommer åt dem.",
  email: "E-postadress",
  password: "Lösenord",
  signIn: "Logga in",
  signUp: "Skapa konto",
  toggleToSignUp: "Har du inget konto? Skapa ett",
  toggleToSignIn: "Har du redan ett konto? Logga in",
  signOut: "Logga ut",
  passwordHint: "Minst 8 tecken.",
  errors: {
    invalid: "E-postadressen eller lösenordet stämmer inte.",
    emailRequired: "Fyll i din e-postadress.",
    passwordRequired: "Fyll i ett lösenord.",
    passwordShort: "Lösenordet behöver vara minst 8 tecken.",
    alreadyRegistered: "Det finns redan ett konto med den e-postadressen.",
    generic: "Det gick inte just nu. Försök igen.",
  },
};

export const BVC_CARD = {
  title: "Fråga BVC när du vill",
  body: "Du behöver ingen bra anledning för att höra av dig. Frågor om vikt, längd, amning och ätande är precis vad BVC finns till för, också mellan de inbokade besöken — och det är helt i sin ordning att ringa bara för att du undrar.",
  where: "Numret till er mottagning står på BVC-kortet och på 1177.se.",
};

export const ATTENTION_TITLE = "Något att ta upp på BVC";

export const CURVES_CARD = {
  title: "Kurvor",
  body: "Vikt, längd och huvudomfång har varsin kurva. De läses tillsammans, men varje mått plottas på sin egen.",
  open: "Öppna →",
};

export const CHILD_FORM = {
  title: "Lägg till barn",
  name: "Namn",
  namePlaceholder: "Barnets namn",
  sex: "Kön",
  girl: "Flicka",
  boy: "Pojke",
  sexHint: "Referenskurvorna skiljer sig åt för flickor och pojkar.",
  birthDate: "Födelsedatum",
  gestation: "Graviditetslängd vid födseln",
  weeks: "veckor",
  days: "dagar",
  gestationExplainer:
    "Står på BVC-kortet, ofta som ”39+2”. Ett barn som föds i vecka 38 har hunnit växa två veckor mindre än ett barn som föds i vecka 40. Vi flyttar kurvan lika mycket, så att jämförelsen blir rättvis. Fullgången tid är 37–42 veckor.",
  correctionLabel: "Ålderskorrektion:",
  correctionPending: "fylls i när veckor är ifyllt",
  correctionNone: "ingen — född vecka 40+0",
  correctionLeft: (days: number) => `${days} dagar, kurvan flyttas åt vänster`,
  correctionRight: (days: number) => `${days} dagar, kurvan flyttas åt höger`,
  birthValues: "Födelseuppgifter",
  birthValuesOptional: "— frivilligt",
  birthWeight: "Vikt, kg",
  birthLength: "Längd, cm",
  birthHead: "Huvud, cm",
  save: "Spara barn",
  saveEdit: "Spara ändringar",
  editTitle: "Ändra barn",
  remove: "Ta bort barn",
  removeConfirm:
    "Barnet och alla dess mätningar tas bort. Det går inte att ångra.",
};

export const MEASUREMENT_FORM = {
  newTitle: "Ny mätning",
  editTitle: "Ändra mätning",
  forChild: "Mätning för",
  switchChild: "Byt",
  date: "Datum för mätningen",
  dateHint: "Står som i dag. Ändra om du fyller i från BVC-kortet i efterhand.",
  helper: "Fyll i det du har — ett värde räcker. Använd decimalkomma, som på kortet.",
  save: "Spara mätning",
  cancel: "Avbryt",
};

export const HISTORY = {
  title: "Alla mätningar",
  empty:
    "Här är tomt än. Har du BVC-kortet framme går det bra att fylla i äldre mätningar också — kurvan blir mer läsbar ju fler punkter den har.",
  add: "Lägg till mätning",
  edit: "Ändra",
  remove: "Ta bort",
  columns: {
    date: "Datum",
    age: "Ålder",
  },
};

export const SWITCHER = {
  hint: "Mätningar sparas på det barn du väljer här.",
  selected: "Vald",
  add: "+ Lägg till barn",
  heading: "Barn",
};

export const CHART = {
  axisCaption: "Vågrätt: ålder i månader, F = födsel",
  show: "Visa",
  zoom: { three: "0–3 mån", twelve: "0–12 mån", twentyFour: "0–2 år" },
  legendMean: "M (medel)",
  legendOne: "±1 SD",
  legendTwoThree: "±2, ±3 SD",
  others: "De andra kurvorna",
  emptyForMeasure: (measure: string) =>
    `Inga mätningar av ${measure.toLowerCase()} än. Kurvorna visas ändå, så du ser var värdena kommer att hamna.`,
  /** Values that exist but sit outside the reference are named, not hidden. */
  notPlotted: (count: number, explanation: string) =>
    `${count === 1 ? "En mätning visas inte i diagrammet" : `${count} mätningar visas inte i diagrammet`}. ${explanation}`,
  footnote: (correctionDays: number, gestation: string) => {
    const correction =
      correctionDays === 0
        ? "noll dagar"
        : `${Math.abs(correctionDays)} dagar ${correctionDays > 0 ? "åt vänster" : "åt höger"}`;
    return `Kurvorna visar medelvärde (M) och standardavvikelser för svenska barn födda i fullgången tid. Ungefär 68 % av alla barn ligger inom ±1 SD och 95 % inom ±2 SD. Åldern är korrigerad ${correction} för graviditetslängd ${gestation}.`;
  },
};

/**
 * The SD wording. Always a description of where a value sits, never an
 * evaluation of it.
 */
export function sdPhrase(sd: number): string {
  const magnitude = Math.abs(sd);
  const direction = sd >= 0 ? "över" : "under";
  const stem = `${formatNumber(magnitude, 1)} SD ${direction} medel`;
  if (magnitude <= 1) return `${stem} — inom det vanligaste området`;
  if (magnitude <= 2) return `${stem} — mellan 1 och 2 SD`;
  return `${stem} — utanför 2 SD`;
}

/** The short form used inside the reading's sentences. */
export function sdShort(sd: number): string {
  return `${formatNumber(Math.abs(sd), 1)} SD ${sd >= 0 ? "över" : "under"} medel`;
}

/**
 * What to say when a value cannot be placed on the reference at all. The rule
 * is to say so plainly rather than clamp the value onto the nearest edge of the
 * chart, which would put it somewhere it does not belong.
 */
export const OUT_OF_RANGE = {
  "age-before-range":
    "Kurvan börjar vid fullgången tid, vecka 40+0. Den här mätningen är gjord innan dess, så den går inte att placera på kurvan än. Värdet är sparat och dyker upp så snart barnet når vecka 40.",
  "age-after-range":
    "Kurvan gäller till två år. Den här mätningen är gjord efter det, så den går inte att placera på kurvan.",
  "gestation-not-term":
    "Kurvorna gäller barn födda i fullgången tid, vecka 37–42. För barn födda tidigare finns särskilda kurvor som BVC använder — de finns inte här.",
} as const;

export const OUT_OF_RANGE_SHORT = {
  "age-before-range": "före kurvans början",
  "age-after-range": "efter kurvans slut",
  "gestation-not-term": "utanför kurvornas område",
} as const;

export const VALIDATION = {
  nameRequired: "Fyll i barnets namn.",
  sexRequired: "Välj flicka eller pojke.",
  birthDateRequired: "Fyll i födelsedatum.",
  birthDateInvalid: "Datumet finns inte. Skriv det som ÅÅÅÅ-MM-DD.",
  birthDateFuture: "Födelsedatumet ligger i framtiden.",
  birthDateTooOld: "Kurvan gäller barn upp till två år.",
  gestationRequired: "Fyll i graviditetslängden — den står på BVC-kortet.",
  gestationDaysRange: "Dagar anges som 0–6.",
  gestationNotTerm:
    "Kurvan gäller barn födda i fullgången tid, vecka 37+0 till 42+0. För barn födda tidigare finns särskilda kurvor som BVC använder — de finns inte här.",
  measurementDateRequired: "Fyll i datum för mätningen.",
  measurementDateInvalid: "Datumet finns inte. Skriv det som ÅÅÅÅ-MM-DD.",
  measurementDateFuture: "Datumet ligger i framtiden.",
  measurementDateBeforeBirth: "Datumet ligger före barnets födelsedatum.",
  atLeastOneValue: "Fyll i minst ett värde.",
  notANumber: (label: string) => `${label} går inte att läsa som ett tal. Skriv till exempel 4,250.`,
  outsideRange: (label: string, min: string, max: string, unit: string) =>
    `${label} ska vara mellan ${min} och ${max} ${unit}. Kontrollera decimalkommat.`,
};

export const READING = {
  empty: {
    title: "Kurvan är tom än",
    body: "Lägg in det som står på BVC-kortet, så börjar kurvan ta form. Det går bra att fylla i gamla mätningar i efterhand.",
  },
  single: {
    title: "En punkt är ingen kurva",
    body: (name: string) =>
      `Vi kan visa var ${name}s mått ligger i förhållande till andra barn, men inte hur ${name} växer. Det syns först när det finns fler mätningar att dra en linje mellan. Att en första punkt ligger högt eller lågt säger i sig väldigt lite.`,
    newbornWeightLoss:
      " De första dagarna går de flesta barn ner omkring 6 % i vikt och är tillbaka på födelsevikten vid två veckor — så vikten just nu är svårläst av sig själv.",
  },
  weightOnly: {
    title: "Bara vikt sedan födseln",
    body: (weightCount: number) =>
      `Vi har ${weightCount} viktmätningar men bara en längd. Vikt utan längd är svår att tolka — ett barn som växer mycket på längden ska väga mer. Kurvan visar vikten som den är, men drar inga slutsatser av den. Fråga gärna BVC om längden kan mätas vid nästa besök.`,
  },
  current: {
    title: "Så ser kurvan ut nu",
    /** Opening sentence: where the values sit, described not judged. */
    position: (weightSd: number, lengthSd: number | null) => {
      let text = `Vikten ligger ${sdShort(weightSd)}`;
      if (lengthSd !== null) text += ` och längden ${sdShort(lengthSd)}`;
      return text + (Math.abs(weightSd) <= 1 ? ", båda inom det vanligaste området. " : ". ");
    },
    noDrift:
      "Det finns ännu inte mätningar över tillräckligt lång tid för att säga något om riktningen. Under första halvåret byter många barn kanal medan de hittar sin egen storlek — det är väntat.",
    steady: (name: string, windowMonths: number) =>
      `${name} har hållit sig i ungefär samma kanal de senaste ${windowMonths} månaderna. Det är det som brukar vara det intressanta — inte var kurvan ligger, utan att den följer sig själv.`,
    moved: (drift: number, windowMonths: number) =>
      `Kurvan har flyttat sig ${formatNumber(Math.abs(drift), 1)} SD ${drift > 0 ? "uppåt" : "nedåt"} de senaste ${windowMonths} månaderna. Att byta kanal är vanligt det första året och behöver inte betyda något.`,
    movedFar: (drift: number, windowMonths: number) =>
      `Kurvan har flyttat sig ${formatNumber(Math.abs(drift), 1)} SD ${drift > 0 ? "uppåt" : "nedåt"} de senaste ${windowMonths} månaderna.`,
  },
  /**
   * Not in the design handover: the state where there are several measurements
   * but none of them is a weight, so none of the weight-based sentences can be
   * written. Built from the same pieces as the states above and flagged for the
   * same clinical review.
   */
  noWeight: {
    title: "Så ser kurvan ut nu",
    body: (parts: string[]) =>
      `${parts.join(" och ")}. Vikt saknas, och riktningen i tillväxten läses framför allt på vikt tillsammans med längd. Fråga gärna BVC om vikten kan mätas vid nästa besök.`,
  },
  /** No point can be placed on the curve — every measurement is out of range. */
  unplottable: {
    title: "Inget att visa på kurvan än",
    body: "Mätningarna är sparade, men ligger utanför den ålder kurvorna täcker. De dyker upp på kurvan så snart barnet är inne i intervallet.",
  },
  attention: {
    weightDrift: (windowMonths: number) =>
      `Vikten har flyttat sig mer än 1 SD på ${windowMonths} månader. Det händer av många skäl och behöver inte betyda något alls, men det är precis en sådan sak BVC vill titta på tillsammans med dig. Ta med det till nästa besök, eller hör av dig innan om du vill.`,
    lengthLow:
      "Längden ligger under −2 SD. Det säger inget i sig, men BVC brukar vilja följa upp det. Ta upp det vid nästa besök.",
  },
  latestHeading: "Senaste mätning",
};

export const PROVENANCE = {
  title: "Om kurvorna",
  intro:
    "Referenskurvorna är avlästa ur Sveriges officiella tillväxtkurvor för barn 0–2 år, samma diagram som BVC plottar på. De ändras inte i appen och ligger inte i databasen — de följer med koden.",
  chartIsTruth:
    "Diagrammet är utgångspunkt. Den publicerade tabellen i Niklasson & Albertsson-Wikland, BMC Pediatrics 2008;8:8, avviker från diagrammet, mest vid födseln och tre månader. Avvikelsen redovisas nedan i stället för att räknas bort.",
  sdExplainer:
    "Måtten anges i SD — standardavvikelser från medelvärdet — som på BVC. Ungefär 68 % av alla barn ligger inom ±1 SD och 95 % inom ±2 SD.",
  distributionExplainer:
    "Vikt är log-normalfördelad och räknas på log10-skalan; längd och huvudomfång är normalfördelade och räknas i centimeter. Alla tre ritas på logaritmiska axlar i det tryckta diagrammet, vilket är en egenskap hos diagrammet och inte hos fördelningen.",
  ageExplainer:
    "Åldersaxeln utgår från fullgången tid, vecka 40+0, inte från födseln. Ett barn fött i vecka 38 och ett fött i vecka 41 hamnar därför på olika ställen på kurvan vid samma levnadsålder. Utanför 0–24 månader och utanför vecka 37–42 visar appen ingenting — den räknar inte vidare utanför kurvornas område.",
  disclaimer:
    "Kurvan är inget medicinskt hjälpmedel. Appen bedömer ingenting och ställer inga diagnoser. Frågor om barnets tillväxt hör hemma på BVC.",
};

export const NAV = {
  overview: "Översikt",
  charts: "Kurvor",
  measurements: "Mätningar",
  addMeasurement: "Lägg till mätning",
  back: "Tillbaka",
  switch: "byt ▾",
  about: "Om kurvorna",
};
