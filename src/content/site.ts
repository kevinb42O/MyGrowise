import { profileImages } from './profileImages';

// Editorial details only. Publication status, title, summary and price live in Supabase.
export const profilePresentation = [
  {
    slug: 'stress-en-emotieprofiel',
    eyebrow: 'Een helder vertrekpunt',
    image: profileImages['stress-en-emotieprofiel'],
    features: [
      'Persoonlijk en genuanceerd inzicht',
      'Overzicht van stress- en emotiepatronen',
      'Concrete aanknopingspunten voor je volgende stap',
    ],
  },
  {
    slug: 'hechting-en-relatieprofiel',
    eyebrow: 'Inzicht in verbinding',
    image: profileImages['hechting-en-relatieprofiel'],
    features: [
      'Inzicht in relationele patronen',
      'Aandacht voor behoeften en grenzen',
      'Een basis voor verdere reflectie of begeleiding',
    ],
  },
];

// Keep unfinished profiles visible as previews, without accepting orders.
export const profilesInDevelopment = [
  {
    slug: 'hechting-en-relatieprofiel',
    title: 'Hechting- en relatieprofiel',
    summary: 'We werken aan een profiel rond hechting en relationele patronen.',
    image: profileImages['hechting-en-relatieprofiel'],
  },
];

export const isProfileInDevelopment = (slug: string) =>
  profilesInDevelopment.some((profile) => profile.slug === slug.toLowerCase());

export const practitioners = [
  {
    slug: 'virginie',
    name: 'Virginie',
    role: 'Oprichter · erkend klinisch psychotherapeut',
    focus: 'Jongeren en volwassenen · stress, emotionele belasting, burn-out, depressie, EMDR, hypnotherapie en cognitieve en oplossingsgerichte therapie',
    image: '/images/practitioners/virginie-real.jpg',
  },
  {
    slug: 'margot',
    name: 'Margot',
    role: 'Erkend klinisch psycholoog',
    focus: 'Online psychologische begeleiding en EMDR',
    image: '/images/practitioners/margot-real.jpg',
  },
  {
    slug: 'amy',
    name: 'Amy',
    role: 'Erkend seksuoloog',
    focus: 'Intimiteit, lichaamsbeleving en seksueel welzijn',
    image: '/images/practitioners/amy-real.jpg',
  },
];

export const homeFaqs = [
  {
    question: 'Waar begin ik als ik nog niet goed weet wat ik nodig heb?',
    answer:
      'Wil je eerst zelf begrijpen wat er gebeurt, dan is een profiel een logisch vertrekpunt. Wil je liever meteen met iemand spreken, kies dan persoonlijke begeleiding. Je hoeft vooraf geen diagnose of perfect geformuleerde hulpvraag te hebben.',
  },
  {
    question: 'Is een profiel hetzelfde als een diagnose?',
    answer:
      'Nee. Een profiel is bedoeld voor inzicht en oriëntatie. Het vervangt geen diagnostisch onderzoek of persoonlijk advies van een bevoegde zorgprofessional.',
  },
  {
    question: 'Hoe verloopt online begeleiding?',
    answer:
      'Je kiest een professional, bekijkt de vrije online momenten en vraagt een beschikbaar moment rechtstreeks via MyGrowise. Een geslaagde boeking is meteen bevestigd; je ontvangt de praktische informatie per e-mail.',
  },
  {
    question: 'Kan ik alles op mijn eigen tempo doen?',
    answer:
      'Digitale profielen en modules zijn juist bedoeld om zelfstandig en op een rustig tempo te gebruiken. Wanneer je behoefte hebt aan afstemming, kan je begeleiding toevoegen.',
  },
];

export const recognitionItems = [
  'Je hoofd blijft doorgaan, ook wanneer je lichaam moe is.',
  'Je merkt dat emoties sneller of intenser binnenkomen.',
  'Je functioneert nog, maar het kost steeds meer energie.',
  'Je wil begrijpen wat er gebeurt vóór je een volgende stap kiest.',
];
