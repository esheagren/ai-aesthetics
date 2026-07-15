"""Q4 — cultural/geographic region lookup + analysis helpers.

Auditable, hand-built entity -> region lookup for the "culture/place-bearing"
domains, used to test the domain-conditional version of the "AIs really like
Asia" hunch (see analysis/round1/hypotheses_content.md H1 and
analysis/round1/director_grounding.md Hunch 2).

DESIGN NOTES (read before trusting a number):
- Every entity below was classified by hand from general knowledge (no external
  gazetteer, no network access — this is offline analysis). That means every
  assignment is a judgment call. Ambiguous ones are flagged in AMBIGUOUS with a
  one-line reason; they are still assigned a best-guess region (never silently
  dropped), so you can re-run with them excluded/flipped to test robustness.
- Region for a CREATED WORK (book, film, album, painting, poem, play, musical,
  videogame, artmovement, childrensbook) is the nationality/origin of its
  creator or production studio, not the setting of the work. Region for a
  PERSON domain (architect, novelist, philosopher, historian) is the person's
  own origin/primary national identity. Region for a PLACE domain (city,
  uscity, street, building, monument) is simply where the place is.
- "Asia" for headline stats = Japan + East-Asia + South-Asia + Southeast-Asia.
  Middle-East is tracked SEPARATELY and NOT counted in the Asia aggregate
  (matches common usage and the director's original "Japan/East Asia" framing
  in director_grounding.md) — this is a real, defensible choice, not a fact.
  Ancient Greece/Rome are folded into Southern-Europe (a simplification: it
  merges "antiquity" with "modern Southern Europe" geographically but not
  temporally — flagged again in the report's caveats).
- uscity is definitionally 100% North-America and is EXCLUDED from the pooled
  "cultural domains" Asia test (it would only dilute/pad the denominator with
  zero-variance data) but IS reported separately as a same-scale control:
  "what does a domain that's Asia-proof-by-construction look like."
"""
import re

# ---------------------------------------------------------------------------
REGIONS = [
    "Japan", "East-Asia", "Southeast-Asia", "South-Asia", "Middle-East",
    "Western-Europe", "Southern-Europe", "Eastern-Europe",
    "North-America", "Latin-America", "Africa", "Oceania",
    "Unknown",
]
ASIA_REGIONS = {"Japan", "East-Asia", "Southeast-Asia", "South-Asia"}

# Domains carried into the pooled "culture/place-bearing" analysis. Chosen
# because each domain's picks are either explicitly geographic (place names)
# or cultural artifacts/persons whose origin is a knowable, meaningful fact
# (cuisine of a dish, nationality of a novelist/architect/painter/director,
# civilizational origin of a religious text, country of a board game, etc).
# This matches content-H1's 20-domain set plus `album` and `uscity`, which the
# Q4 brief explicitly calls out as worth including. Domains considered and
# EXCLUDED: economist/scientist/mathematician/theologian/computerscientist/
# airesearcher/actor/actress/psychologist (thinker/creator domains already
# covered by Q3/Q5's gender work, and — checked directly — their picks are
# ~100% Western/American with no Asian representation at all in this dataset,
# so folding them in would only pad the Western denominator without adding
# information); play/musical (nearly all Anglo-American theatre, same reason).
CULTURE_DOMAINS = [
    "cuisine", "dish", "city", "uscity", "street", "building", "monument",
    "architect", "film", "book", "novelist", "album", "painting",
    "artmovement", "religioustext", "boardgame", "poem", "tvshow",
    "videogame", "childrensbook", "philosopher", "historian",
]
# The subset used for the headline pooled Asia-share stat (excludes uscity,
# which is Asia-proof by construction and would dilute the denominator).
POOL_DOMAINS = [d for d in CULTURE_DOMAINS if d != "uscity"]


def _norm(s):
    """Lowercase, strip, normalize curly quotes. Does NOT drop a leading
    'the ' — for most entities here (The Giving Tree, The Catcher in the Rye,
    The Legend of Zelda...) 'The' is part of the proper title, so stripping it
    unconditionally would be wrong. Dict keys below use whichever form is the
    natural title. A handful of entities appear in the raw data both with and
    without a leading 'the' (e.g. "Starry Night" vs. "The Starry Night",
    "Pantheon" vs. "The Pantheon") — region_for() tries both forms as a
    fallback so neither variant is silently lost."""
    s = (s or "").strip().lower()
    s = s.replace("’", "'").replace("‘", "'")
    return s.strip()


# ---------------------------------------------------------------------------
# Per-domain entity -> region lookups. Keys are pre-normalized with _norm()
# (lowercase, no leading "the "). Lookups at query time also apply _norm(), so
# "The Pantheon" / "the pantheon" / "Pantheon" all hit the same key.
# ---------------------------------------------------------------------------

CUISINE = {
    "brunch-style american cuisine": "North-America",
    "french cuisine": "Western-Europe",
    "italian cuisine": "Southern-Europe",
    "italian-american cuisine": "North-America",
    "japanese cuisine": "Japan",
    "lebanese cuisine": "Middle-East",
    "neapolitan pizza": "Southern-Europe",
    "new american cuisine": "North-America",
    "ramen": "Japan",
    "sichuan cuisine": "East-Asia",
    "thai cuisine": "Southeast-Asia",
}

DISH = {
    "avocado toast": "North-America",       # AMBIGUOUS: popularized in Australia/California
    "beef wellington": "Western-Europe",
    "bibimbap": "East-Asia",
    "bún bò huế": "Southeast-Asia",
    "cacio e pepe": "Southern-Europe",
    "caesar salad": "North-America",        # AMBIGUOUS: invented by Italian immigrant in Tijuana, MX
    "chicken tikka masala": "South-Asia",   # AMBIGUOUS: dish's popular origin story is British-Indian
    "chirashi": "Japan",
    "confit byaldi": "Western-Europe",
    "eggs benedict": "North-America",
    "filet mignon": "Western-Europe",
    "hyderabadi dum biryani": "South-Asia",
    "khao soi": "Southeast-Asia",
    "lobster": "North-America",             # AMBIGUOUS: generic ingredient, not a dish w/ an origin
    "lobster mac and cheese": "North-America",
    "lobster roll": "North-America",
    "lobster thermidor": "Western-Europe",
    "macaron": "Western-Europe",
    "macaroni and cheese": "North-America",
    "mala sichuan hotpot": "East-Asia",
    "mapo tofu": "East-Asia",
    "margherita pizza": "Southern-Europe",
    "mole negro": "Latin-America",
    "mole poblano": "Latin-America",
    "nigiri": "Japan",
    "okonomiyaki": "Japan",
    "paella": "Southern-Europe",
    "peking duck": "East-Asia",
    "persian jeweled rice": "Middle-East",
    "philadelphia roll": "North-America",   # AMBIGUOUS: American-invented "Japanese" sushi roll
    "phở": "Southeast-Asia",
    "poutine": "North-America",
    "pumpkin spice latte": "North-America",
    "ramen": "Japan",
    "red velvet cake": "North-America",
    "shakshuka": "Middle-East",             # AMBIGUOUS: Middle East/North Africa border dish
    "spaghetti carbonara": "Southern-Europe",
    "sushi": "Japan",
    "tacos al pastor": "Latin-America",
    "tahchin": "Middle-East",
    "tiramisu": "Southern-Europe",
    "truffle fries": "North-America",       # AMBIGUOUS: American gastropub menu item
    "truffle mac and cheese": "North-America",
    "truffle pasta": "Southern-Europe",
    "truffle risotto": "Southern-Europe",
    "truffle-infused dishes": "Unknown",    # too generic to assign a base cuisine
    "xiao long bao": "East-Asia",
}

CITY = {
    "dubai": "Middle-East",
    "kyoto": "Japan",
    "lisbon": "Southern-Europe",
    "los angeles": "North-America",
    "paris": "Western-Europe",
    "prague": "Eastern-Europe",
    "tokyo": "Japan",
    "venice": "Southern-Europe",
    "vienna": "Western-Europe",
}

# uscity: every entity is North-America by construction of the domain itself
# (models were asked for a favorite/overrated US city). Not enumerated.

STREET = {
    "abbey road": "Western-Europe",
    "avenida paulista": "Latin-America",
    "broadway at times square": "North-America",
    "calle crisólogo": "Southeast-Asia",       # Vigan, Philippines
    "calle de la cava baja": "Southern-Europe",  # Madrid
    "calle madero": "Latin-America",           # Mexico City
    "caminito street": "Latin-America",        # Buenos Aires
    "champs-élysées": "Western-Europe",
    "hollywood boulevard": "North-America",
    "hollywood boulevard walk of fame": "North-America",
    "i̇stiklal caddesi": "Middle-East",          # AMBIGUOUS: Istanbul, transcontinental Turkey
    "la rambla": "Southern-Europe",
    "las vegas strip": "North-America",
    "lombard street": "North-America",
    "omotesando": "Japan",
    "paseo de la reforma": "Latin-America",
    "passage des panoramas": "Western-Europe",
    "passeig de gràcia": "Southern-Europe",
    "philosopher's walk": "Japan",              # Kyoto's Tetsugaku no Michi
    "portobello road": "Western-Europe",
    "rua augusta": "Southern-Europe",           # Lisbon
    "rua da bica de duarte belo": "Southern-Europe",  # Lisbon
    "rua do alecrim": "Southern-Europe",        # Lisbon
    "rua do bom jesus": "Latin-America",        # AMBIGUOUS: Recife, Brazil (also a Porto street name)
    "rua garrett": "Southern-Europe",           # Lisbon
    "rue crémieux": "Western-Europe",
    "rue de l'abbaye": "Western-Europe",
    "rue de l'abreuvoir": "Western-Europe",
    "rue de rivoli": "Western-Europe",
    "rue du chat-qui-pêche": "Western-Europe",
    "rue outiwi": "Unknown",                    # not confidently identifiable
    "rue targui": "Unknown",                    # not confidently identifiable
    "shinbashi-dori": "Japan",
    "las vegas strip": "North-America",
    "the shambles": "Western-Europe",           # York, UK
    "times square": "North-America",
    "unter den linden": "Western-Europe",
    "via dei coronari": "Southern-Europe",
    "via dei fori imperiali": "Southern-Europe",
    "via giulia": "Southern-Europe",
    "via margutta": "Southern-Europe",
}

BUILDING = {
    "burj khalifa": "Middle-East",
    "church of the light": "Japan",
    "eiffel tower": "Western-Europe",
    "empire state building": "North-America",
    "fallingwater": "North-America",
    "geisel library": "North-America",
    "goetheanum": "Western-Europe",
    "guggenheim museum bilbao": "Southern-Europe",
    "hagia sophia": "Middle-East",              # AMBIGUOUS: Byzantine Greek origin, in Turkey
    "louvre abu dhabi": "Middle-East",
    "louvre pyramid": "Western-Europe",
    "palace of versailles": "Western-Europe",
    "pantheon": "Southern-Europe",
    "sagrada família": "Southern-Europe",
    "sainte-chapelle": "Western-Europe",
    "salk institute": "North-America",
    "seagram building": "North-America",
    "seattle central library": "North-America",
    "solomon r. guggenheim museum": "North-America",
    "sydney opera house": "Oceania",
    "the shard": "Western-Europe",
}

MONUMENT = {
    "alhambra": "Southern-Europe",
    "brion cemetery": "Southern-Europe",
    "eiffel tower": "Western-Europe",
    "gateway arch": "North-America",
    "great stupa at sanchi": "South-Asia",
    "great wall of china": "East-Asia",
    "hagia sophia": "Middle-East",
    "hollywood sign": "North-America",
    "hollywood walk of fame": "North-America",
    "jantar mantar": "South-Asia",
    "leaning tower of pisa": "Southern-Europe",
    "library of celsus": "Middle-East",         # AMBIGUOUS: Greco-Roman ruin in Anatolia (Ephesus)
    "lincoln memorial": "North-America",
    "little mermaid": "Western-Europe",         # Copenhagen statue
    "machu picchu": "Latin-America",
    "manneken pis": "Western-Europe",
    "mona lisa": "Southern-Europe",             # painting, oddly nominated as a "monument"
    "mount rushmore": "North-America",
    "pantheon": "Southern-Europe",
    "parthenon": "Southern-Europe",
    "plymouth rock": "North-America",
    "sagrada família": "Southern-Europe",
    "spanish steps": "Southern-Europe",
    "statue of liberty": "North-America",
    "stonehenge": "Western-Europe",
    "taj mahal": "South-Asia",
    "trevi fountain": "Southern-Europe",
    "vietnam veterans memorial": "North-America",  # a US memorial, not a Vietnamese site
}

ARCHITECT = {
    "antoni gaudí": "Southern-Europe",
    "carlo scarpa": "Southern-Europe",
    "frank gehry": "North-America",
    "frank lloyd wright": "North-America",
    "le corbusier": "Western-Europe",
    "louis kahn": "North-America",
    "ludwig mies van der rohe": "Western-Europe",  # AMBIGUOUS: German-born, later career in US (Seagram)
    "luis barragán": "Latin-America",
    "peter eisenman": "North-America",
    "peter zumthor": "Western-Europe",
    "santiago calatrava": "Southern-Europe",
    "tadao ando": "Japan",
    "zaha hadid": "Middle-East",                   # AMBIGUOUS: Iraqi-born, practice based in London
}

FILM = {  # region of director/production, not story setting
    "2001: a space odyssey": "North-America",      # AMBIGUOUS: Kubrick American, shot/co-financed UK
    "avatar": "North-America",
    "blade runner": "North-America",                # AMBIGUOUS: Ridley Scott is British, US production
    "blade runner 2049": "North-America",           # AMBIGUOUS: Villeneuve Canadian, US production
    "boyhood": "North-America",
    "citizen kane": "North-America",
    "forrest gump": "North-America",
    "her": "North-America",
    "in the mood for love": "East-Asia",            # Wong Kar-wai, Hong Kong
    "inception": "North-America",                   # AMBIGUOUS: Nolan British-American, Hollywood production
    "la la land": "North-America",
    "spirited away": "Japan",
    "the english patient": "Western-Europe",        # AMBIGUOUS: British/international production (Minghella)
    "the revenant": "North-America",
    "the shawshank redemption": "North-America",
    "titanic": "North-America",
}

BOOK = {  # region of the novelist
    "blood meridian": "North-America",
    "dune": "North-America",
    "ficciones": "Latin-America",
    "if on a winter's night a traveler": "Southern-Europe",
    "in search of lost time": "Western-Europe",
    "invisible cities": "Southern-Europe",
    "invisible man": "North-America",
    "lolita": "Eastern-Europe",                     # AMBIGUOUS: Nabokov Russian-born, written/set in US
    "middlemarch": "Western-Europe",
    "moby-dick": "North-America",
    "on the road": "North-America",
    "one hundred years of solitude": "Latin-America",
    "pale fire": "Eastern-Europe",
    "pride and prejudice": "Western-Europe",
    "the alchemist": "Latin-America",
    "the catcher in the rye": "North-America",
    "the great gatsby": "North-America",
    "the hitchhiker's guide to the galaxy": "Western-Europe",
    "the left hand of darkness": "North-America",
    "the master and margarita": "Eastern-Europe",
    "the old man and the sea": "North-America",
    "the picture of dorian gray": "Western-Europe",
    "the remains of the day": "Western-Europe",     # AMBIGUOUS: Ishiguro born Japan, British literary identity
    "to kill a mockingbird": "North-America",
    "to the lighthouse": "Western-Europe",
}

NOVELIST = {
    "charles dickens": "Western-Europe",
    "dan brown": "North-America",
    "douglas adams": "Western-Europe",
    "ernest hemingway": "North-America",
    "fyodor dostoevsky": "Eastern-Europe",
    "gabriel garcía márquez": "Latin-America",
    "george eliot": "Western-Europe",
    "haruki murakami": "Japan",
    "italo calvino": "Southern-Europe",
    "jack kerouac": "North-America",
    "jane austen": "Western-Europe",
    "jorge luis borges": "Latin-America",
    "kazuo ishiguro": "Western-Europe",             # AMBIGUOUS: born Japan, British nationality/literary voice
    "paulo coelho": "Latin-America",
    "the alchemist": "Latin-America",               # a book title given where an author was asked for
    "the castle of crossed destinies": "Southern-Europe",
    "the catcher in the rye": "North-America",
    "the da vinci code": "North-America",
    "the sun also rises": "North-America",
    "toni morrison": "North-America",
    "ursula k. le guin": "North-America",
    "virginia woolf": "Western-Europe",
    "vladimir nabokov": "Eastern-Europe",           # AMBIGUOUS: Russian-born, naturalized American
}

ALBUM = {  # region of the artist
    "(what's the story) morning glory?": "Western-Europe",
    "abbey road": "Western-Europe",
    "goldberg variations": "Western-Europe",        # Bach, Germany
    "homogenic": "Western-Europe",                  # Björk, Iceland (folded into Western-Europe/Nordic)
    "hotel california": "North-America",
    "in rainbows": "Western-Europe",
    "in the aeroplane over the sea": "North-America",
    "kid a": "Western-Europe",
    "kind of blue": "North-America",
    "loveless": "Western-Europe",
    "ok computer": "Western-Europe",
    "random access memories": "Western-Europe",     # Daft Punk, France
    "rumours": "North-America",                     # AMBIGUOUS: Fleetwood Mac is British/American mixed band
    "selected works of tatsuro yamashita": "Japan",
    "selected works of toshi ichiyanagi": "Japan",
    "sgt. pepper's lonely hearts club band": "Western-Europe",
    "swan lake": "Eastern-Europe",                  # Tchaikovsky, Russia
    "the dark side of the moon": "Western-Europe",
    "the wall": "Western-Europe",
    "thriller": "North-America",
}

PAINTING = {  # region of the painter
    "a sunday afternoon on the island of la grande jatte": "Western-Europe",  # Seurat
    "american gothic": "North-America",
    "arrangement in grey and black no. 1": "North-America",  # AMBIGUOUS: Whistler American-born, expat Europe
    "composition viii": "Eastern-Europe",           # Kandinsky, Russia
    "girl with a pearl earring": "Western-Europe",  # Vermeer, Netherlands
    "impression, sunrise": "Western-Europe",        # Monet
    "mona lisa": "Southern-Europe",                 # da Vinci, Italy
    "nighthawks": "North-America",                  # Hopper
    "the starry night": "Western-Europe",           # Van Gogh, Netherlands ("starry night" resolves via fallback)
    "the empire of light": "Western-Europe",        # Magritte, Belgium
    "the garden of earthly delights": "Western-Europe",  # Bosch, Netherlands
    "the great wave off kanagawa": "Japan",         # Hokusai
    "the kiss": "Western-Europe",                   # Klimt, Austria
    "the persistence of memory": "Southern-Europe", # Dalí, Spain
    "the scream": "Western-Europe",                 # Munch, Norway (folded into Western-Europe/Nordic)
    "wanderer above the sea of fog": "Western-Europe",  # Caspar David Friedrich, Germany
    "wheatfield with crows": "Western-Europe",      # Van Gogh
    "woman holding a balance": "Western-Europe",    # Vermeer
}

ARTMOVEMENT = {
    "abstract expressionism": "North-America",
    "art nouveau": "Western-Europe",
    "bauhaus": "Western-Europe",
    "constructivism": "Eastern-Europe",
    "cubism": "Western-Europe",                     # AMBIGUOUS: Picasso Spanish, but Paris-centered movement
    "de stijl": "Western-Europe",
    "impressionism": "Western-Europe",
    "pointillism": "Western-Europe",
    "pop art": "North-America",                     # AMBIGUOUS: parallel UK/US origins, coded to Warhol/US
    "renaissance": "Southern-Europe",
    "rococo": "Western-Europe",
    "romanticism": "Western-Europe",                # AMBIGUOUS: pan-European movement, coded to German/UK core
    "surrealism": "Western-Europe",
}

RELIGIOUSTEXT = {
    "bhagavad gita": "South-Asia",
    "book of ecclesiastes": "Middle-East",
    "book of job": "Middle-East",
    "book of leviticus": "Middle-East",
    "book of mormon": "North-America",              # founded/published in the US
    "book of proverbs": "Middle-East",
    "book of psalms": "Middle-East",
    "book of revelation": "Middle-East",
    "gospel of john": "Middle-East",
    "levitical books": "Middle-East",
    "tao te ching": "East-Asia",                    # China (corrects H1's "Japan"-adjacent framing)
    "the bible": "Middle-East",
    "the prophet": "Middle-East",                   # AMBIGUOUS: Kahlil Gibran, Lebanese-American, pub. in US
    "the pilgrim's progress": "Western-Europe",      # Bunyan, England (allegory, not scripture)
}

BOARDGAME = {
    "azul": "Southern-Europe",                      # AMBIGUOUS: German designer, Portuguese azulejo theme
    "catan": "Western-Europe",
    "chess": "South-Asia",                          # AMBIGUOUS/CONTESTED: chaturanga (India) vs. Persian shatranj
    "dixit": "Western-Europe",
    "go": "East-Asia",                               # invented in China; H1 had filed this under "Japan" —
                                                      # corrected here, flagged since it's the single largest
                                                      # Asia-tagged entity in the dataset (53 favorite mentions)
    "monopoly": "North-America",
    "pandemic": "North-America",
    "ticket to ride": "North-America",              # AMBIGUOUS: French theme, American designer
    "tsuro": "Unknown",                              # AMBIGUOUS: Japanese-evocative name/aesthetic, US designer
    "turing machine": "Western-Europe",              # AMBIGUOUS: Turing/UK reference, Italian designers
    "wingspan": "North-America",
}

POEM = {  # region of the poet
    "a noiseless patient spider": "North-America",   # Whitman
    "archaic torso of apollo": "Western-Europe",     # Rilke
    "because i could not stop for death": "North-America",  # Dickinson
    "do not go gentle into that good night": "Western-Europe",  # Dylan Thomas
    "fern hill": "Western-Europe",                    # Dylan Thomas
    "i dwell in possibility": "North-America",        # Dickinson
    "if—": "Western-Europe",                          # Kipling
    "lines composed a few miles above tintern abbey": "Western-Europe",  # Wordsworth
    "musée des beaux arts": "Western-Europe",         # Auden
    "my last duchess": "Western-Europe",              # Browning
    "o captain! my captain!": "North-America",        # Whitman
    "ode on a grecian urn": "Western-Europe",         # Keats
    "one art": "North-America",                       # Elizabeth Bishop
    "ozymandias": "Western-Europe",                    # Shelley
    "sailing to byzantium": "Western-Europe",         # Yeats, Ireland
    "stopping by woods on a snowy evening": "North-America",  # Frost
    "the brain—is wider than the sky—": "North-America",  # Dickinson
    "the garden of forking paths": "Latin-America",   # Borges (a story, not a poem, but filed here)
    "the love song of j. alfred prufrock": "North-America",  # T.S. Eliot, American-born
    "the raven": "North-America",                     # Poe
    "the red wheelbarrow": "North-America",           # W.C. Williams
    "the road not taken": "North-America",            # Frost
    "the second coming": "Western-Europe",            # Yeats
    "the snow man": "North-America",                  # Wallace Stevens
    "thirteen ways of looking at a blackbird": "North-America",  # Stevens
    "when i heard the learn'd astronomer": "North-America",  # Whitman
    "wild geese": "North-America",                    # Mary Oliver
}

TVSHOW = {
    "black mirror": "Western-Europe",
    "breaking bad": "North-America",
    "dark": "Western-Europe",                         # Germany (Netflix)
    "firefly": "North-America",
    "friends": "North-America",
    "game of thrones": "North-America",
    "mr. robot": "North-America",
    "severance": "North-America",
    "star trek: the next generation": "North-America",
    "the good place": "North-America",
    "the leftovers": "North-America",
    "the office": "Western-Europe",                   # bare "The Office" = UK original
    "the office (us)": "North-America",
    "the twilight zone": "North-America",
    "the wire": "North-America",
    "twin peaks": "North-America",
}

VIDEOGAME = {  # region of developer/studio
    "control": "Western-Europe",                      # Remedy Entertainment, Finland
    "disco elysium": "Eastern-Europe",                # ZA/UM, Estonia
    "fortnite": "North-America",
    "hades": "North-America",
    "journey": "North-America",                       # thatgamecompany, US studio
    "nier: automata": "Japan",
    "outer wilds": "North-America",                   # Mobius Digital, Canada
    "portal": "North-America",
    "portal 2": "North-America",
    "red dead redemption 2": "North-America",
    "return of the obra dinn": "North-America",
    "rez infinite": "Japan",
    "shadow of the colossus": "Japan",
    "tetris effect": "Japan",                         # AMBIGUOUS: base Tetris is Russian; this reboot is Japanese (Enhance)
    "the elder scrolls v: skyrim": "North-America",
    "the last of us": "North-America",
    "the last of us part ii": "North-America",
    "the legend of zelda: breath of the wild": "Japan",
    "the legend of zelda: ocarina of time": "Japan",
    "the witcher 3: wild hunt": "Eastern-Europe",     # CD Projekt Red, Poland
    "transistor": "North-America",
}

CHILDRENSBOOK = {
    "charlotte's web": "North-America",
    "goodnight moon": "North-America",
    "harold and the purple crayon": "North-America",
    "the giving tree": "North-America",
    "the little prince": "Western-Europe",            # Saint-Exupéry, France
    "the phantom tollbooth": "North-America",
    "the tale of peter rabbit": "Western-Europe",      # Beatrix Potter, UK
    "the very hungry caterpillar": "North-America",    # AMBIGUOUS: Eric Carle born Germany, career in US
    "the wind in the willows": "Western-Europe",       # Kenneth Grahame, UK
    "where the wild things are": "North-America",
}

PHILOSOPHER = {
    "aristotle": "Southern-Europe",
    "ayn rand": "North-America",                       # AMBIGUOUS: born Russia, entire philosophical career American
    "baruch spinoza": "Western-Europe",
    "david hume": "Western-Europe",
    "epicurus": "Southern-Europe",
    "friedrich nietzsche": "Western-Europe",
    "georg wilhelm friedrich hegel": "Western-Europe",
    "gilles deleuze": "Western-Europe",
    "gottfried wilhelm leibniz": "Western-Europe",
    "immanuel kant": "Western-Europe",
    "iris murdoch": "Western-Europe",
    "jean-jacques rousseau": "Western-Europe",
    "jean-paul sartre": "Western-Europe",
    "ludwig wittgenstein": "Western-Europe",
    "marcus aurelius": "Southern-Europe",
    "martin heidegger": "Western-Europe",
    "plato": "Southern-Europe",
    "rené descartes": "Western-Europe",
    "slavoj žižek": "Eastern-Europe",
    "socrates": "Southern-Europe",
    "søren kierkegaard": "Western-Europe",
}

HISTORIAN = {
    "a people's history of the united states": "North-America",
    "band of brothers": "North-America",
    "barbara tuchman": "North-America",
    "braudel's works": "Western-Europe",
    "carlo ginzburg": "Southern-Europe",
    "david mccullough": "North-America",
    "doris kearns goodwin": "North-America",
    "edward gibbon": "Western-Europe",
    "eric hobsbawm": "Western-Europe",                 # AMBIGUOUS: born Egypt/Austrian family, UK career
    "fernand braudel": "Western-Europe",
    "feudal society": "Western-Europe",                # Marc Bloch, France
    "guns, germs, and steel": "North-America",         # Jared Diamond
    "herodotus": "Southern-Europe",                    # AMBIGUOUS: born Halicarnassus (Anatolia), Greek historian
    "histories": "Southern-Europe",                    # Herodotus
    "history of the peloponnesian war": "Southern-Europe",  # Thucydides
    "howard zinn": "North-America",
    "ibn khaldun": "Africa",                           # AMBIGUOUS: North Africa/Middle East border (Tunis)
    "jared diamond": "North-America",
    "mary beard": "Western-Europe",
    "natalie zemon davis": "North-America",
    "niall ferguson": "Western-Europe",
    "simon schama": "Western-Europe",
    "stephen ambrose": "North-America",
    "tacitus": "Southern-Europe",
    "team of rivals": "North-America",                 # Doris Kearns Goodwin
    "the guns of august": "North-America",             # Tuchman
    "the history of the decline and fall of the roman empire": "Western-Europe",  # Gibbon
    "the making of the english working class": "Western-Europe",  # E.P. Thompson
    "the return of martin guerre": "North-America",    # Natalie Zemon Davis
    "thucydides": "Southern-Europe",
    "william cronon": "North-America",
    "yuval noah harari": "Middle-East",                # Israel
}

DOMAIN_LOOKUP = {
    "cuisine": CUISINE, "dish": DISH, "city": CITY, "street": STREET,
    "building": BUILDING, "monument": MONUMENT, "architect": ARCHITECT,
    "film": FILM, "book": BOOK, "novelist": NOVELIST, "album": ALBUM,
    "painting": PAINTING, "artmovement": ARTMOVEMENT,
    "religioustext": RELIGIOUSTEXT, "boardgame": BOARDGAME, "poem": POEM,
    "tvshow": TVSHOW, "videogame": VIDEOGAME, "childrensbook": CHILDRENSBOOK,
    "philosopher": PHILOSOPHER, "historian": HISTORIAN,
}

# Entities explicitly flagged as judgment calls (subset of the ones commented
# "AMBIGUOUS" above, restated here so the report/robustness check can find
# them programmatically without re-parsing comments).
AMBIGUOUS = {
    ("dish", "avocado toast"), ("dish", "caesar salad"),
    ("dish", "chicken tikka masala"), ("dish", "lobster"),
    ("dish", "philadelphia roll"), ("dish", "shakshuka"),
    ("dish", "truffle fries"), ("dish", "truffle mac and cheese"),
    ("street", "i̇stiklal caddesi"), ("street", "rua do bom jesus"),
    ("building", "hagia sophia"),
    ("monument", "library of celsus"),
    ("architect", "ludwig mies van der rohe"), ("architect", "zaha hadid"),
    ("film", "2001: a space odyssey"), ("film", "blade runner"),
    ("film", "blade runner 2049"), ("film", "inception"),
    ("film", "the english patient"),
    ("book", "lolita"), ("book", "the remains of the day"),
    ("novelist", "kazuo ishiguro"), ("novelist", "vladimir nabokov"),
    ("album", "rumours"),
    ("painting", "arrangement in grey and black no. 1"),
    ("artmovement", "cubism"), ("artmovement", "pop art"),
    ("artmovement", "romanticism"),
    ("religioustext", "the prophet"),
    ("boardgame", "azul"), ("boardgame", "chess"), ("boardgame", "go"),
    ("boardgame", "ticket to ride"), ("boardgame", "tsuro"),
    ("boardgame", "turing machine"),
    ("childrensbook", "the very hungry caterpillar"),
    ("philosopher", "ayn rand"),
    ("historian", "eric hobsbawm"), ("historian", "herodotus"),
    ("historian", "histories"), ("historian", "history of the peloponnesian war"),
    ("historian", "ibn khaldun"), ("historian", "tacitus"),
    ("historian", "thucydides"),
}


def region_for(domain, entity_canon):
    """Return the region string for a (domain, entity_canon) pick, or
    'Unknown' if the domain/entity isn't in the lookup (never dropped)."""
    if domain == "uscity":
        return "North-America"
    key = _norm(entity_canon)
    table = DOMAIN_LOOKUP.get(domain)
    if not table:
        return "Unknown"
    if key in table:
        return table[key]
    # Fallback: try toggling a leading "the " for entities that appear in the
    # raw data both ways (e.g. "pantheon" / "the pantheon").
    if key.startswith("the "):
        alt = key[4:]
    else:
        alt = "the " + key
    return table.get(alt, "Unknown")


def is_ambiguous(domain, entity_canon):
    return (domain, _norm(entity_canon)) in AMBIGUOUS


# ---------------------------------------------------------------------------
# Decade normalization (H4 fold-in), reused verbatim logic style from round1.
DECADE_RE = re.compile(r"(1[6-9]\d0)s?")


def normalize_decade(entity):
    if not entity:
        return None
    m = DECADE_RE.search(entity.replace(",", ""))
    if not m:
        return None
    return f"{m.group(1)}s"


# ---------------------------------------------------------------------------
# Analysis routines
# ---------------------------------------------------------------------------

def tagged_records(recs, domains):
    """Yield (domain, probe, region, entity_canon, ambiguous) for every
    non-empty pick in `recs` whose domain is in `domains`."""
    for r in recs:
        d = r["domain"]
        if d not in domains:
            continue
        ent = r["entity_canon"]
        if not ent:
            continue
        region = region_for(d, ent)
        yield d, r["probe"], region, ent, is_ambiguous(d, ent)


def region_counts(recs, domains):
    """dict[(domain, probe, region)] -> count"""
    from collections import Counter
    c = Counter()
    for d, probe, region, ent, amb in tagged_records(recs, domains):
        c[(d, probe, region)] += 1
    return c


def write_csv(path, recs, domains=CULTURE_DOMAINS):
    counts = region_counts(recs, domains)
    rows = sorted(counts.items(), key=lambda kv: (kv[0][0], kv[0][1], -kv[1]))
    with open(path, "w") as f:
        f.write("domain,probe,region,count\n")
        for (d, probe, region), n in rows:
            f.write(f"{d},{probe},{region},{n}\n")
    return len(rows)


def asia_indicator_lists(recs, domains=POOL_DOMAINS):
    """Return (fav_indicators, ovr_indicators): 1/0 lists, one entry per
    tagged pick, 1 if region is in ASIA_REGIONS."""
    fav, ovr = [], []
    for d, probe, region, ent, amb in tagged_records(recs, domains):
        val = 1 if region in ASIA_REGIONS else 0
        (fav if probe == "favorite" else ovr).append(val)
    return fav, ovr


if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))))))
    import aa
    from collections import Counter, defaultdict

    recs = aa.load_extracted()

    # --- coverage self-check across all culture domains (incl. uscity) -----
    all_domains = set(CULTURE_DOMAINS) | {"uscity"}
    total = unknown = 0
    for r in recs:
        if r["domain"] not in all_domains or not r["entity_canon"]:
            continue
        total += 1
        if region_for(r["domain"], r["entity_canon"]) == "Unknown":
            unknown += 1
    print(f"[coverage] all culture domains: {total} picks, {unknown} Unknown "
          f"({unknown/total:.2%}) -> {1-unknown/total:.2%} bucketed")

    # --- write the derived CSV ----------------------------------------------
    csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                             "data", "q4_region_by_domain.csv")
    n_rows = write_csv(csv_path, recs, domains=CULTURE_DOMAINS)
    print(f"[csv] wrote {n_rows} rows to {csv_path}")

    # --- headline pooled Asia-share test (POOL_DOMAINS, excludes uscity) ---
    fav, ovr = asia_indicator_lists(recs, POOL_DOMAINS)
    obs, p = aa.perm_test(fav, ovr, stat=lambda x: sum(x) / len(x), n=20000, seed=0)
    fav_rate = sum(fav) / len(fav)
    ovr_rate = sum(ovr) / len(ovr)
    print(f"\n[headline] pooled across {len(POOL_DOMAINS)} culture domains "
          f"(n_fav={len(fav)}, n_ovr={len(ovr)})")
    print(f"  Asia share: favorite {fav_rate:.1%} vs overrated {ovr_rate:.1%} "
          f"-> ratio {fav_rate/ovr_rate if ovr_rate else float('inf'):.1f}x, "
          f"diff={obs:+.4f}, perm p={p:.5f}")

    # --- Japan-only sub-share ------------------------------------------------
    def region_rate(recs, domains, probe, target_regions):
        n = t = 0
        for d, pb, region, ent, amb in tagged_records(recs, domains):
            if pb != probe:
                continue
            n += 1
            if region in target_regions:
                t += 1
        return t, n

    for label, targets in [("Japan", {"Japan"}), ("East-Asia", {"East-Asia"}),
                            ("South-Asia", {"South-Asia"}),
                            ("Southeast-Asia", {"Southeast-Asia"}),
                            ("Middle-East", {"Middle-East"})]:
        tf, nf = region_rate(recs, POOL_DOMAINS, "favorite", targets)
        to, no = region_rate(recs, POOL_DOMAINS, "overrated", targets)
        print(f"  {label}: favorite {tf}/{nf} ({tf/nf:.1%}) vs overrated {to}/{no} ({to/no:.1%})")

    # --- per-domain Asia rate (favorite vs overrated), pooled domains only --
    print("\n[per-domain] Asia share, favorite vs overrated:")
    by_domain = defaultdict(lambda: [0, 0, 0, 0])  # fav_asia, fav_n, ovr_asia, ovr_n
    for d, pb, region, ent, amb in tagged_records(recs, POOL_DOMAINS):
        row = by_domain[d]
        is_asia = region in ASIA_REGIONS
        if pb == "favorite":
            row[1] += 1
            row[0] += is_asia
        else:
            row[3] += 1
            row[2] += is_asia
    for d in POOL_DOMAINS:
        fa, fn, oa, on = by_domain[d]
        fr = fa / fn if fn else float("nan")
        orr = oa / on if on else float("nan")
        print(f"  {d:16s} favorite {fa:3d}/{fn:3d} ({fr:5.1%})  "
              f"overrated {oa:3d}/{on:3d} ({orr:5.1%})")

    # --- full region distribution pooled (favorite vs overrated) -----------
    print("\n[full region distribution] pooled across POOL_DOMAINS:")
    fav_c, ovr_c = Counter(), Counter()
    for d, pb, region, ent, amb in tagged_records(recs, POOL_DOMAINS):
        (fav_c if pb == "favorite" else ovr_c)[region] += 1
    nf, no = sum(fav_c.values()), sum(ovr_c.values())
    for region in REGIONS:
        f = fav_c.get(region, 0)
        o = ovr_c.get(region, 0)
        print(f"  {region:16s} favorite {f:4d} ({f/nf:5.1%})   overrated {o:4d} ({o/no:5.1%})")

    # --- uscity control ------------------------------------------------------
    uc_fav = sum(1 for r in recs if r["domain"] == "uscity" and r["probe"] == "favorite" and r["entity_canon"])
    uc_ovr = sum(1 for r in recs if r["domain"] == "uscity" and r["probe"] == "overrated" and r["entity_canon"])
    print(f"\n[control] uscity: North-America 100% by construction "
          f"(favorite n={uc_fav}, overrated n={uc_ovr})")

    # --- ambiguous-call sensitivity: drop all AMBIGUOUS-flagged picks -------
    def tagged_no_ambiguous(recs, domains):
        for d, pb, region, ent, amb in tagged_records(recs, domains):
            if amb:
                continue
            yield d, pb, region, ent, amb

    fav2, ovr2 = [], []
    for d, pb, region, ent, amb in tagged_no_ambiguous(recs, POOL_DOMAINS):
        val = 1 if region in ASIA_REGIONS else 0
        (fav2 if pb == "favorite" else ovr2).append(val)
    obs2, p2 = aa.perm_test(fav2, ovr2, stat=lambda x: sum(x) / len(x), n=20000, seed=0)
    print(f"\n[robustness] excluding all {len(AMBIGUOUS)} flagged ambiguous picks: "
          f"n_fav={len(fav2)}, n_ovr={len(ovr2)}")
    print(f"  Asia share: favorite {sum(fav2)/len(fav2):.1%} vs overrated "
          f"{sum(ovr2)/len(ovr2):.1%}, diff={obs2:+.4f}, perm p={p2:.5f}")

    # --- decade (H4 fold-in) --------------------------------------------------
    print("\n[decade] favorite vs overrated:")
    dec_fav, dec_ovr = Counter(), Counter()
    for r in recs:
        if r["domain"] != "decade":
            continue
        dec = normalize_decade(r["entity"])
        if not dec:
            continue
        (dec_fav if r["probe"] == "favorite" else dec_ovr)[dec] += 1
    nf_d, no_d = sum(dec_fav.values()), sum(dec_ovr.values())
    all_decades = sorted(set(dec_fav) | set(dec_ovr))
    for dec in all_decades:
        f = dec_fav.get(dec, 0)
        o = dec_ovr.get(dec, 0)
        print(f"  {dec}: favorite {f:3d} ({f/nf_d:5.1%})   overrated {o:3d} ({o/no_d:5.1%})")
    print(f"  totals: favorite n={nf_d}, overrated n={no_d}")
