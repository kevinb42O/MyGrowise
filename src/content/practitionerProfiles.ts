/**
 * Personal introductions recovered from the original website copy in
 * scratch_content.json (the online-psychologists page). Current roles, bio,
 * expertise, languages and booking settings remain owned by Supabase.
 * Amy's copy follows the corrected scope in 20260925120000: no couples therapy.
 */
type PractitionerStory = {
  introduction: string;
  approach: string[];
  audience: string;
};

export const practitionerStories: Record<string, PractitionerStory> = {
  margot: {
    introduction: 'Een warme, veilige ruimte om jouw verhaal te delen. Op jouw tempo.',
    approach: [
      'Margot is erkend klinisch psycholoog en werkt vanuit een systeemtheoretische visie, waarbij ze aandacht heeft voor de relatie met jezelf en met anderen.',
      'Ze biedt een warme, veilige ruimte waarin je jouw verhaal kan delen op jouw tempo. Met oprechte betrokkenheid en nieuwsgierigheid luistert ze naar wat er speelt, zonder oordeel.',
      'Naast haar werk als psycholoog is Margot ook yogadocent en heeft ze ervaring met mindfulness, wat ze indien gewenst integreert in de begeleiding om meer rust en lichaamsbewustzijn te brengen.',
    ],
    audience: 'Volwassenen',
  },
  virginie: {
    introduction: 'Samen begrijpen wat er speelt. Met ruimte voor meer evenwicht en veerkracht.',
    approach: [
      'Virginie werkt vanuit een rustige en betrokken benadering. Ze combineert gesprekstherapie met EMDR om onderliggende ervaringen en spanningen te verwerken.',
      'Samen met jou gaat ze op zoek naar wat er speelt en hoe je opnieuw meer evenwicht en veerkracht kan ervaren.',
      'Als oprichter van MyGrowise vertrekt ze vanuit haar klinische praktijkervaring, met aandacht voor stress, emotionele belasting en trauma.',
    ],
    audience: 'Jongeren en volwassenen',
  },
  amy: {
    introduction: 'Ruimte voor wat je bezighoudt. Met aandacht voor jou als geheel.',
    approach: [
      'Amy is kinesitherapeut van opleiding en volgde nadien een master seksuologie en een opleiding integratieve psychotherapie. Vanuit haar ervaring merkte ze dat lichamelijke klachten vaak samenhangen met emotionele en seksuele thema’s.',
      'In haar begeleiding kijkt ze daarom steeds naar de mens als geheel. Haar aanpak is warm, laagdrempelig en integratief, waarbij er ruimte is om samen af te stemmen wat jij nodig hebt.',
      'Ze ondersteunt je in het verkrijgen van meer inzicht, verbinding en evenwicht in jezelf.',
    ],
    audience: 'Volwassenen',
  },
};
