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

/**
 * The brand. Note that "kurvan" is also ordinary Swedish for "the curve" and is
 * used that way all over the copy below — "Kurvan har flyttat sig 0,8 SD nedåt"
 * is the child's line on the chart, not the service. Only the places where the
 * word is a title, a wordmark, or the subject of a sentence about what the
 * *service* does carry the brand name.
 */
export const APP_NAME = "Barntillväxt";

export const START = {
  promise:
    "Barnets vikt, längd och huvudomfång på samma tillväxtkurvor som BVC använder. Så att siffrorna på kortet betyder något också hemma.",
  promiseWide:
    "Barnets vikt, längd och huvudomfång på samma tillväxtkurvor som BVC använder. Barntillväxt bedömer ingenting — den visar, och pekar vidare till BVC när något är värt att ta upp.",
  points: [
    "Samma referenskurvor som på BVC-kortet — medelvärde och standardavvikelser (SD).",
    "Du ser hur barnet följer sin egen kanal över tid. Det är trenden som säger något, inte en enskild punkt.",
    "Barntillväxt bedömer ingenting och ställer inga diagnoser. Det gör BVC — och dit hjälper vi dig hitta.",
  ],
  addChild: "Lägg till barn",
  // The design's first-run screen promised device-local storage. This build
  // keeps the data in an account so it survives a lost phone, so the promise
  // is stated as it actually is — including the part sharing added: "bara du"
  // stopped being the whole truth the moment a child could be shared.
  storage: "Uppgifterna sparas på ditt konto och syns bara för dig och dem du delar med.",
};

export const AUTH = {
  title: "Logga in",
  intro:
    "Barntillväxt sparar barnets mätningar på ditt konto. Bara du kommer åt dem, och de du själv väljer att dela med.",
  /**
   * Creating an account and signing in are the same form in two modes, and the
   * two used to be told apart by the button alone. The heading and this lead
   * say which one the reader is in, and the lead is the one place to say what
   * an account is before someone makes one.
   */
  signUpTitle: "Skapa konto",
  signUpIntro:
    "Kontot är ditt eget. Barnen lägger du in efteråt, och du bestämmer själv om någon annan ska se dem.",
  email: "E-postadress",
  password: "Lösenord",
  signIn: "Logga in",
  signUp: "Skapa konto",
  toggleToSignUp: "Har du inget konto? Skapa ett",
  toggleToSignIn: "Har du redan ett konto? Logga in",
  signOut: "Logga ut",
  passwordHint: "Minst 8 tecken.",
  /**
   * The name the people you share a child with see next to your access and
   * under the measurements you enter. Optional — an empty field keeps the name
   * the database derives from the email — but the hint asks for the real one,
   * because "Erik" beside a child's health data is only worth anything to the
   * other parent if it is the Erik they think it is.
   *
   * Two people are allowed the same name. Nothing checks for it and nothing
   * refuses it: names are printed, never used to tell accounts apart.
   */
  displayName: "Ditt namn (valfritt)",
  displayNameHint:
    "Skriv ditt riktiga namn — det är så du visas för dem du delar barnets uppgifter med. Lämnar du fältet tomt bildas namnet av din e-postadress.",
  /**
   * The settings screen is the child-editing screen, which a view-only user has
   * no business on — but signing out lives there too, so they get the same
   * route with nothing on it but their account.
   */
  accountTitle: "Ditt konto",
  errors: {
    invalid: "E-postadressen eller lösenordet stämmer inte.",
    emailRequired: "Fyll i din e-postadress.",
    passwordRequired: "Fyll i ett lösenord.",
    passwordShort: "Lösenordet behöver vara minst 8 tecken.",
    alreadyRegistered: "Det finns redan ett konto med den e-postadressen.",
    displayNameLong: "Namnet får vara högst 60 tecken.",
    generic: "Det gick inte just nu. Försök igen.",
  },
};

/**
 * Sharing a child.
 *
 * Two roles, and the wording of the difference between them is the design:
 * "Delar ansvaret" is permanent and says so three times — on the invite screen,
 * on the accept screen, and on the person's row afterwards — while "Kan se" is
 * removable and never pretends otherwise.
 *
 * Nobody is notified about anything here, which the revoke confirmation states
 * out loud rather than leaving for the parent to discover.
 *
 * The strings for the link's dead ends (used, expired, wrong) are not in the
 * design handover and are written to the same rules: say what happened, say
 * what to do, blame nobody.
 */
export const SHARE = {
  cardTitle: "Vem har tillgång",
  cardOpen: "Öppna →",
  /** The one-line summary on the child's home screen. */
  countAlone: "Bara du",
  count: (people: number) => `${people} personer`,
  you: "Du",
  youLower: "du",

  title: (childName: string) => `Vem har tillgång till ${childName}`,
  intro:
    "Två roller. Den som delar ansvaret gör allt du gör. Den som bara ser kan följa kurvorna utan att kunna ändra något.",
  since: (date: string) => `Har tillgång sedan ${date}`,
  footnote:
    "Barntillväxt är ingen journal. Uppgifterna är de ni själva fört in från BVC-kortet, och de som har tillgång ser allt som står här.",

  roleName: { guardian: "Delar ansvaret", viewer: "Kan se" },
  roleSummary: {
    guardian: "Lägger till och ändrar mätningar. Ser hela läsningen.",
    viewer: "Ser kurvor och mätningar. Ändrar ingenting.",
  },
  /** The longer form, used where the choice is being made rather than shown. */
  roleChoice: {
    guardian:
      "Lägger till och ändrar mätningar, och ser hela läsningen. Går inte att ta bort efteråt.",
    viewer: "Ser kurvor och mätningar. Ändrar ingenting. Du kan ta bort tillgången när du vill.",
  },

  permanent: (personName: string, childName: string) =>
    `Kan inte tas bort — varken av dig eller av ${personName}. Ni har lika rätt till ${childName}s uppgifter.`,
  removeAsk: "Ta bort tillgång",
  removeConfirm: (personName: string, childName: string) =>
    `Ta bort ${personName}s tillgång? ${childName} försvinner ur ${personName}s app. ${personName} får inget meddelande om det.`,
  remove: "Ta bort",
  cancel: "Avbryt",

  invite: "Bjud in någon",
  inviteTitle: (childName: string) => `Bjud in till ${childName}`,
  inviteIntro:
    "Välj vad personen ska kunna göra. Det bestäms nu, innan länken finns — den som öppnar länken kan inte välja själv.",
  permanentWarning: (childName: string) =>
    `Att dela ansvaret är permanent. Den som går med får samma rätt till ${childName}s uppgifter som du, och ingen av er kan ta bort den andra. Så fungerar det för att två vårdnadshavare inte ska kunna stänga ut varandra.`,
  createLink: "Skapa länk",
  linkFor: (roleName: string) => `Länk för ${roleName}`,
  copyLink: "Kopiera länk",
  copied: "Kopierad ✓",
  newLink: "Ny länk",
  linkTerms:
    "Gäller i 7 dagar och kan användas en gång. Skicka den i SMS, chatt eller mejl — hur du vill. Den som öppnar länken först är den som får tillgång, så skicka den bara till den du menar.",
  linkFailed: "Det gick inte att skapa en länk just nu. Försök igen.",

  acceptTitle: (inviterName: string, childName: string) =>
    `${inviterName} har delat ${childName} med dig`,
  acceptBody: (childName: string, pronoun: string) =>
    `${childName} finns redan i Barntillväxt. Går du med hamnar ${pronoun} i din app, med de mätningar som redan är inlagda.`,
  acceptRoleLabel: "Du går med som",
  acceptPermanent: (inviterName: string) =>
    `Att dela ansvaret är permanent. Du får samma rätt till uppgifterna som ${inviterName}, och ingen av er kan ta bort den andra.`,
  acceptJoin: "Gå med",
  acceptSignIn: "Logga in för att gå med",
  acceptDecline: "Nej tack",
  acceptFootnote:
    "Barntillväxt är ingen journal och ersätter inte BVC. Uppgifterna är de föräldrarna själva fört in från BVC-kortet.",
  acceptAlreadyMember: (childName: string) => `Du har redan tillgång till ${childName}.`,
  acceptOpenChild: "Öppna barnet",

  linkDead: {
    title: "Länken fungerar inte längre",
    used: "Länken är redan använd. Varje länk gäller en gång, och den som öppnade den först är den som fick tillgång. Be om en ny länk om det inte var du.",
    expired:
      "Länken har gått ut. En länk gäller i sju dagar. Be den som delade barnet att skapa en ny.",
    missing:
      "Den här länken stämmer inte. Kontrollera att hela adressen kom med — en länk som delats i ett meddelande blir ibland avklippt.",
    failed: "Det gick inte att gå med just nu. Försök igen, eller be om en ny länk.",
  },
  back: "Tillbaka",
} as const;

/**
 * What a view-only user is told, first thing, instead of finding out by
 * noticing what is missing. The reading and the attention card are not hidden
 * from them as a punishment — they interpret, and interpreting belongs to the
 * person who will ring BVC.
 */
export const VIEW_ONLY = {
  title: (childName: string) => `Du ser ${childName}s kurvor`,
  body: (childName: string) =>
    `Du kan följa mätningarna men inte ändra dem. Tolkningen och kontakten med BVC ligger hos ${childName}s vårdnadshavare.`,
};

/**
 * "lagt in av Erik", under a measurement, and only when the child is actually
 * shared — a parent alone does not need to be told they entered their own data.
 *
 * The design's prototype falls back to "dig" for a measurement with no recorded
 * author. Here that fallback is dropped: rows written before attribution
 * existed, or by an account since deleted, are genuinely unknown, and guessing
 * "dig" would put someone else's entry in your name.
 */
export const ATTRIBUTION = {
  by: (personName: string) => `lagt in av ${personName}`,
  you: "dig",
  column: "Inlagt av",
};

/** A child that is no longer shared with you, which is state and not a message. */
export const ACCESS_ENDED = {
  title: "Du har inte längre tillgång",
  body: "Barnet visas inte här längre. Var det delat med dig har den som delade det tagit bort din tillgång — det sker utan meddelande, och uppgifterna finns kvar hos vårdnadshavarna.",
  back: "Till dina barn",
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
  /**
   * The way into "Ändra barn" from the overview. It used to hang off the
   * measurement list, next to the add button, where nobody found it — a
   * mistyped birth week is rare enough that it should be findable from the
   * screen a parent actually lands on, and common enough that it should not
   * take a hunt.
   */
  cardTitle: "Barnets uppgifter",
  cardOpen: "Ändra →",
  cardSummary: (sex: string, birthDate: string, gestation: string) =>
    `${sex} · född ${birthDate} · vecka ${gestation}`,
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
    "Står på BVC-kortet, ofta som ”39+2”. Vi frågar för att se om kurvorna här gäller ditt barn: de gäller barn födda från vecka 37. Åldern räknas sedan från födseln, precis som på BVC — kurvan flyttas inte.",
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
  /**
   * Not in the design handover. Deleting a shared child would remove the
   * measurements for the other guardian too, which is the thing "ingen av er
   * kan ta bort den andra" exists to prevent — so it is refused while more than
   * one person shares the responsibility, and the refusal says why. Needs the
   * same sign-off as the permanence rule itself.
   */
  removeSharedBlocked: (childName: string) =>
    `${childName} delas med någon som också ansvarar för uppgifterna. Därför går barnet inte att ta bort här — det skulle ta bort mätningarna för er båda.`,
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
  emptyForMeasure: (measure: string) =>
    `Inga mätningar av ${measure.toLowerCase()} än. Kurvorna visas ändå, så du ser var värdena kommer att hamna.`,
  /** Values that exist but sit outside the reference are named, not hidden. */
  notPlotted: (count: number, explanation: string) =>
    `${count === 1 ? "En mätning visas inte i diagrammet" : `${count} mätningar visas inte i diagrammet`}. ${explanation}`,
  footnote:
    "Kurvorna visar medelvärde (M) och standardavvikelser för svenska barn födda i fullgången tid. Ungefär 68 % av alla barn ligger inom ±1 SD och 95 % inom ±2 SD. Åldern räknas från födseln.",
};

/**
 * "Visa fortsättning" — the opt-in continuation of the child's own line, drawn
 * from the latest measurement to the child's age today.
 *
 * The last sentence of `note` is load-bearing: it is the difference between a
 * parent reading this as information and reading it as a promise the child then
 * fails to keep. It stays in the same block as the number.
 */
export const PROJECTION = {
  toggle: "Visa fortsättning",
  legend: "fram till i dag",
  noMeasurement: "Det finns ingen mätning att räkna vidare från än.",
  /**
   * Verbatim from the design handover, and the one line here worth a second
   * look in the clinical review: this fires when *today's* age is past
   * the chosen interval, which is not the same thing as the measurement being
   * outside it. With a measurement at two months and a child of eight, the
   * 0–3 mån view shows the point and says the value was measured later than the
   * interval shows. Left as written rather than reworded unilaterally.
   */
  pastInterval: (measureDefinite: string) =>
    `${capitalise(measureDefinite)} är mätt senare än det valda intervallet visar. Välj ett längre intervall för att se fram till i dag.`,
  /**
   * Not in the design handover, which assumes a longer interval always exists.
   * Past two years there is none — the reference stops there — so the app says
   * that instead of offering a zoom that would not help.
   */
  pastReference:
    "Kurvan gäller till två år, och barnet är äldre än så. Linjen kan inte räknas fram till i dag.",
  alreadyCurrent:
    "Senaste mätningen är i stort sett aktuell. Det finns ingen tid emellan att räkna fram över.",
  note: ({
    name,
    sds,
    measureDefinite,
    value,
    unit,
    ageMonths,
  }: {
    name: string;
    sds: number;
    measureDefinite: string;
    value: string;
    unit: string;
    ageMonths: number;
  }) =>
    `Linjen räknas fram till i dag och slutar där. Om ${name} stannar på ${sdSigned(sds)} ligger ${measureDefinite} nu på ungefär ${value} ${unit} vid ${formatNumber(ageMonths, 1)} månader. Det är ingen förutsägelse — barn byter kanal, särskilt under första året.`,
};

/** "+0,4 SD" / "−0,4 SD", with a real minus sign. */
function sdSigned(sd: number): string {
  return `${sd >= 0 ? "+" : "−"}${formatNumber(Math.abs(sd), 1)} SD`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

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
    "Kurvan börjar vid födseln. Den här mätningen är daterad före barnets födelsedatum, så den går inte att placera på kurvan.",
  "age-after-range":
    "Kurvan gäller till två år. Den här mätningen är gjord efter det, så den går inte att placera på kurvan.",
  "gestation-preterm":
    "Kurvorna gäller barn födda från vecka 37. För barn som föds tidigare än så finns särskilda kurvor som BVC använder — de finns inte här.",
} as const;

export const OUT_OF_RANGE_SHORT = {
  "age-before-range": "före födseln",
  "age-after-range": "efter kurvans slut",
  "gestation-preterm": "utanför kurvornas område",
} as const;

export const VALIDATION = {
  nameRequired: "Fyll i barnets namn.",
  sexRequired: "Välj flicka eller pojke.",
  birthDateRequired: "Fyll i födelsedatum.",
  birthDateInvalid: "Datumet finns inte. Skriv det som ÅÅÅÅ-MM-DD.",
  birthDateFuture: "Födelsedatumet ligger i framtiden.",
  birthDateAfterMeasurement:
    "Det finns redan en mätning som är gjord före det här datumet. Ändra eller ta bort den mätningen först.",
  gestationRequired: "Fyll i graviditetslängden — den står på BVC-kortet.",
  gestationDaysRange: "Dagar anges som 0–6.",
  gestationPreterm:
    "Kurvorna gäller barn födda från vecka 37+0. För barn som föds tidigare än så finns särskilda kurvor som BVC använder — de finns inte här.",
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
  /**
   * The heading over the values on the home screen. It says "värden" and not
   * "mätning" because the three numbers under it need not come from the same
   * visit: each measure shows the newest value there is of *that* measure, with
   * its own date beside it.
   */
  latestHeading: "Senaste värden",
  /** The date line under one measure: "26 augusti 2026 · 6 veckor". */
  valueTaken: (date: string, age: string) => `${date} · ${age}`,
  /** A measure that has never been filled in for this child. */
  valueMissing: "Ingen mätning än",
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
    "Åldern räknas från födseln, precis som på BVC. Ett barn fött i vecka 38 och ett fött i vecka 41 hamnar på samma ställe på kurvan vid samma levnadsålder — kurvan flyttas inte för graviditetslängden. Det är bara för tidigt födda barn som åldern korrigeras inom vården, och de följs på egna kurvor som inte finns här. Appen visar därför barn födda från vecka 37, och bara under de första 0–24 månaderna — utanför det räknar den inte vidare.",
  disclaimer:
    "Barntillväxt är inget medicinskt hjälpmedel. Appen bedömer ingenting och ställer inga diagnoser. Frågor om barnets tillväxt hör hemma på BVC.",
};

export const NAV = {
  overview: "Översikt",
  charts: "Tillväxtkurvor",
  measurements: "Mätningar",
  access: "Tillgång",
  addMeasurement: "Lägg till mätning",
  back: "Tillbaka",
  switch: "byt ▾",
  about: "Om kurvorna",
};
