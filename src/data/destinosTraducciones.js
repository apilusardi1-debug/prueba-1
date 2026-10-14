// Portugués e inglés del contenido de los destinos (mockData.js). Mismo armado que
// el original, pero solo con los textos: fotos, íconos, videos y links salen de
// mockData.js. Lo que falte acá se ve en español. Al cambiar un texto en
// mockData.js, actualizarlo también acá.
import { destinos } from './mockData.js'

const TRADUCCIONES = {
  pt: {
    porto: {
      descripcion: 'Famosa pelas piscinas naturais e águas cristalinas. Uma das melhores praias do Brasil.',
      contenido: {
        intro: 'Porto de Galinhas é a praia mais visitada de Pernambuco, no município de Ipojuca, a cerca de 50 km do Recife. Deve sua fama a um recife de coral de quase 700 metros paralelo à costa: quando a maré baixa, a água que fica presa entre a areia e o recife forma piscinas naturais de águas mornas e transparentes.',
        pullQuote: 'O recife faz de parede, a maré baixa faz o resto: aparece uma piscina que ninguém construiu.',
        datos: [
          { titulo: 'Como chegar', texto: 'A cerca de 50 km do Aeroporto do Recife, aproximadamente uma hora de carro pela PE-009.' },
          { titulo: 'Piscinas naturais', texto: 'Formam-se entre a areia e um recife de coral de quase 700 metros. São melhores com maré média ou baixa.' },
          { titulo: 'Como se chega', texto: 'De jangada, o barco a vela típico da região — não é preciso saber nadar. Ir por conta própria nadando exige bom preparo físico.' },
          { titulo: 'Melhor época', texto: 'Set-mar: estação seca. Abr-ago: estação de chuvas, mais fortes entre maio e julho (embora costumem ser curtas).' },
          { titulo: 'Cuide do recife', texto: 'É proibido pisar no coral: é frágil e morre com o contato. Recomenda-se usar calçado aquático por causa dos ouriços.' },
          { titulo: 'Um nome com história', texto: 'Vem da época colonial: depois da proibição do tráfico de pessoas escravizadas, quem continuava fazendo isso em segredo usava a frase em código "tem galinha nova no porto" para avisar os compradores.' },
        ],
        fotoSecundaria: {
          titulo: 'A feirinha, à noite',
          texto: 'Quando o sol se põe, a rua principal da vila se enche de barracas de artesanato, roupas e comida — o passeio clássico depois de um dia de praia, com os guarda-sóis coloridos como marca do lugar.',
        },
        epoca: {
          temporadas: [
            { titulo: 'Setembro a março', subtitulo: 'A época que recomendamos', texto: 'Estação seca, com mais sol e céu limpo — temperaturas entre 26° e 32°, ideais para passar o dia nas piscinas naturais.' },
            { titulo: 'Abril a agosto', subtitulo: 'Estação de chuvas', texto: 'As chuvas costumam ser curtas e intercaladas com sol; os meses mais chuvosos são maio, junho e julho. O mar continua bom para as piscinas naturais, mas com menos dias de sol.' },
          ],
        },
        actividad: {
          titulo: 'As piscinas naturais',
          texto: 'São o cartão-postal de Porto de Galinhas: o recife quebra as ondas e deixa um espelho de água morna e transparente, com centenas de peixes coloridos nadando junto aos banhistas. Chega-se de jangada — o barco a vela artesanal conduzido pelos jangadeiros locais —, um passeio de uns 40 minutos que não exige saber nadar. Antes de descer, muitos operadores mostram um breve vídeo de conscientização ambiental: andar sobre o coral é proibido porque o danifica, então é bom entrar com cuidado e, se possível, com calçado aquático.',
          checklist: [
            'Água morna o ano todo, em torno de 29°.',
            'Não é preciso saber nadar: a jangada leva e traz.',
            'Centenas de peixes de recife nadando ao seu lado.',
          ],
        },
        banner: {
          texto: 'Porto de Galinhas foi eleita várias vezes a "Melhor Praia do Brasil" pelos leitores da revista Viagem & Turismo — e as jangadas coloridas na beira do mar são parte do motivo.',
        },
        galeria: [
          { alt: 'Barcos sobre o recife em Porto de Galinhas' },
        ],
        cierre: [
          { titulo: 'Como se locomover', texto: 'Além das jangadas até as piscinas, os passeios de buggy são um clássico para conhecer o litoral: numa mesma saída dá para percorrer Maracaípe, Cupe, Muro Alto e as piscinas naturais.' },
          { titulo: 'Um destino acessível', texto: 'Diferente de outros destinos do Nordeste, Porto de Galinhas não tem limite de visitantes nem taxas de entrada: chega-se de carro a partir do Recife no mesmo dia, e há hospedagem para todos os orçamentos.' },
        ],
        cierreTexto: 'Entre o recife, a areia e a feirinha da noite, Porto de Galinhas tem o ritmo perfeito para desconectar sem complicações de logística.',
        playasDestacadas: [
          { texto: 'O coração da vila: daqui saem os passeios de jangada até as piscinas naturais, com a areia cheia de guarda-sóis coloridos. É a base ideal para o resto dos passeios.' },
          { texto: 'Sua piscina natural, protegida por um recife a cerca de 150 metros da costa, está entre as maiores da América Latina (mais de 2 km). Águas calmas e mornas, ideais para ir com crianças.' },
          { texto: 'Já no município vizinho de Tamandaré, com águas tranquilas protegidas por recifes e uma pequena capela branca de frente para o mar como cartão-postal. Visita-se num passeio de um dia, combinando praia, rio e manguezal.' },
        ],
        playasMas: [
          { texto: 'Com ondas mais fortes que o resto da região, é uma das praias preferidas dos surfistas. Pontal do Cupe, um trecho mais protegido, também tem suas próprias piscinas naturais na maré baixa.' },
          { texto: 'A mais selvagem e menos movimentada do circuito, com as ondas mais fortes — o melhor lugar para surfar perto de Porto de Galinhas.' },
        ],
      },
    },
    maragogi: { descripcion: 'O "Caribe brasileiro". Recifes de coral e piscinas naturais de águas turquesa.' },
    maceio: { descripcion: 'Capital de Alagoas. Praias urbanas, coqueirais e as famosas piscinas naturais de Pajuçara.' },
    pipa: { descripcion: 'Vila boêmia com falésias, golfinhos e o melhor surfe do Nordeste.' },
    noronha: {
      descripcion: 'Arquipélago protegido. O melhor mergulho e snorkel do Brasil, com golfinhos e tartarugas.',
      contenido: {
        intro: 'Fernando de Noronha é um arquipélago vulcânico em frente à costa de Pernambuco, declarado Patrimônio Natural da Humanidade pela UNESCO. Chega-se em pouco mais de uma hora de voo a partir do Recife ou de Natal, mas lá o ritmo muda completamente: a ilha limita o número de visitantes por dia, por isso suas praias e recifes continuam quase intactos.',
        pullQuote: 'Em Noronha não somos visitantes: somos convidados da natureza.',
        datos: [
          { titulo: 'Como chegar', texto: 'Não há voos diretos: chega-se com uma conexão doméstica dentro do Brasil, via Recife ou Natal, até a ilha.' },
          { titulo: 'Taxa de preservação (TPA)', texto: 'É paga por dia de estadia, online ou na chegada ao aeroporto, e financia a conservação da ilha.' },
          { titulo: 'Parque Nacional Marinho', texto: 'Um ingresso à parte — com QR code — libera a entrada em praias e áreas protegidas, como a Baía do Sancho.' },
          { titulo: 'Melhor época', texto: 'Jun-nov: mar calmo e máxima transparência, ideal para mergulho. Nov-mai: chegam as ondas grandes e o surfe.' },
          { titulo: 'É um destino caro?', texto: 'Sim, e é bom saber antes de viajar: é uma ilha isolada, quase tudo chega de barco ou avião, e isso encarece a estadia.' },
          { titulo: 'Acesso limitado', texto: 'A ilha controla o número de turistas e de voos diários, por isso é bom reservar com antecedência.' },
        ],
        caro: {
          intro: 'Noronha não é um destino econômico, e é importante saber disso antes de viajar. Mas também vale cada centavo: não é um lugar como qualquer outro.',
          porQue: 'É uma ilha isolada, de acesso controlado, e quase tudo o que se consome chega de barco ou avião. Isso encarece produtos, serviços e toda a logística — o mesmo motivo pelo qual esse paraíso está tão bem conservado. Somam-se a isso a taxa ambiental obrigatória (por dia de estadia) e o ingresso do Parque Nacional, necessário para várias das praias mais famosas.',
          cierre: 'Entender isso desde o início ajuda a viajar com expectativas realistas e a valorizar ainda mais a experiência que a ilha oferece.',
        },
        tasas: {
          items: [
            { titulo: '1) TPA — Taxa de preservação ambiental diária', texto: 'É obrigatória para todos os visitantes e paga por dia de permanência na ilha. Pode ser paga online, pelo site oficial do governo do arquipélago, ou diretamente no aeroporto na chegada.' },
            { titulo: '2) Ingresso no Parque Nacional Marinho (taxa ICMBio)', texto: 'Esse ingresso é necessário para visitar praias, trilhas e áreas protegidas dentro do Parque Nacional Marinho. É comprado online e você recebe um QR code para apresentar durante as visitas.' },
          ],
          boton: { texto: 'Ver ingresso e taxa' },
        },
        fotoSecundaria: {
          titulo: 'Chegando a Noronha',
          texto: 'Chegar já faz parte da experiência: na aproximação final, a vista da janela mostra o Morro Dois Irmãos e as primeiras praias da ilha.',
        },
        epoca: {
          temporadas: [
            { titulo: 'Junho a novembro', subtitulo: 'A época que recomendamos', texto: 'O mar fica mais calmo e alcança uma transparência impressionante, o cenário perfeito para mergulho, snorkel e para contemplar a natureza da ilha sem ondas.' },
            { titulo: 'Novembro a maio', subtitulo: 'Temporada de ondas e surfe', texto: 'O mar muda de comportamento e chegam ondas grandes, com campeonatos que atraem surfistas de várias partes do mundo. Não é a época ideal se a sua prioridade é o mar tranquilo e cristalino que caracteriza Noronha.' },
          ],
        },
        actividad: {
          titulo: 'Um paraíso para o mergulho',
          texto: 'Noronha é reconhecida mundialmente como um dos melhores destinos de mergulho do planeta. Debaixo d’água convivem tartarugas gigantes, raias, cardumes coloridos, moreias, lagostas, barracudas, tubarões (lixa, limão) e golfinhos, além de naufrágios transformados em recifes artificiais, cavernas, túneis e outras formações rochosas submarinas. E não é preciso ser um mergulhador experiente: as operadoras da ilha acompanham cada passo para que, mesmo que seja a sua primeira vez, a experiência seja segura, guiada e inesquecível.',
          checklist: [
            'Visibilidade incomparável: até 50 metros de transparência em alguns pontos.',
            'Águas mornas o ano todo: não é preciso roupa de neoprene.',
            'Biodiversidade impressionante: vida marinha exótica e abundante.',
          ],
          niveles: 'Há opções para todos os níveis: batismo de mergulho para quem nunca mergulhou (com instrutor desde o primeiro minuto, em pontos seguros e rasos), mergulhos recreativos para mergulhadores certificados e saídas técnicas e avançadas para quem busca mais profundidade, como o naufrágio da Corveta Ipiranga, a 62 metros. E se você não se anima com o cilindro, alguns dos melhores pontos de snorkel do mundo mostram quase a mesma vida marinha a partir da superfície.',
        },
        banner: {
          texto: 'Nadar perto de golfinhos-rotadores é uma das experiências mais procuradas da ilha: eles chegam em grupo todas as manhãs para descansar na Baía dos Golfinhos.',
        },
        galeria: [
          { alt: 'Baía do Sancho, Fernando de Noronha' },
          { alt: 'Pôr do sol junto ao Morro Dois Irmãos, Fernando de Noronha' },
          { alt: 'Vista do alto de uma praia em Fernando de Noronha' },
          { alt: 'O Morro do Pico visto da praia, Fernando de Noronha' },
          { alt: 'Piscina natural nas pedras de Fernando de Noronha' },
          { alt: 'Vista do litoral de Fernando de Noronha' },
        ],
        videos: [
          { titulo: 'Mergulhando em Noronha' },
          { titulo: 'Mergulhando em Noronha' },
          { titulo: 'Mergulhando em Noronha' },
        ],
        cierre: [
          { titulo: 'Onde se hospedar', texto: 'Diferente de outros destinos do Nordeste, em Noronha não há grandes resorts de frente para o mar: a ilha prioriza a conservação em vez do desenvolvimento hoteleiro. A maioria são pousadas familiares, montadas em casas adaptadas, desde opções boutique mais exclusivas até alternativas intermediárias perto do centro (ideal para sair à noite) e outras mais simples e tranquilas. Chegar a algumas praias exige uma caminhada curta, e isso também faz parte da experiência.', whatsappMensaje: 'Olá! Quero cotar hospedagem em Fernando de Noronha', boton: 'Cote sua hospedagem' },
          { titulo: 'Um destino que pede planejamento', texto: 'Noronha não é um destino de massa: tem limite de visitantes, poucos voos por dia e trâmites próprios (taxa ambiental, ingresso do parque). Chegar de fora do Brasil implica pelo menos dois voos domésticos — por exemplo, com conexão em São Paulo ou Recife —, por isso é bom montar bem o roteiro e reservar com antecedência.' },
        ],
        cierreTexto: 'Entender tudo isso antes de viajar não é um detalhe: é o que transforma Noronha em muito mais que um destino de praia — uma experiência transformadora.',
        playasDestacadas: [
          { texto: 'Eleita 7 vezes a melhor praia do mundo. O verde-esmeralda das falésias se mistura com o azul-turquesa do mar e a areia dourada — uma paisagem difícil de acreditar que seja real. Chega-se descendo escadas talhadas na rocha ou em passeios de barco, e ela faz parte do Parque Nacional Marinho: para visitá-la é preciso o ingresso do parque.' },
          { texto: 'A poucos minutos do centro, com o Morro do Pico — a formação rochosa mais alta da ilha — dominando a paisagem ao fundo. Um dos melhores lugares de Noronha para ver o pôr do sol, com piscinas naturais quando a maré baixa (o acesso a pé só é possível na maré baixa).' },
          { texto: 'Com o Morro Dois Irmãos — símbolo absoluto de Noronha — ao fundo, é o paraíso dos surfistas: entre dezembro e março chegam ondas grandes que atraem surfistas do mundo todo. No resto do ano o mar acalma e é ideal para nadar ou simplesmente caminhar pela areia. Seus pores do sol, com o céu pintado de laranja, rosa e violeta atrás dos morros, estão entre os mais bonitos da ilha.' },
          { texto: 'A mais próxima do centro histórico — para muitos viajantes, o primeiro contato com o mar de Noronha. O nome vem de uma antiga fonte de pedra em forma de cabeça de cachorro. Tem piscinas naturais entre as pedras quando a maré baixa, a mais famosa a do Buraco do Galego: um cantinho escondido de água tão clara que se vê cada detalhe do fundo.' },
        ],
        playasMas: [
          { texto: 'Entre a Praia do Cachorro e a Praia da Conceição, é a menor e mais tranquila desse trecho do litoral: cercada de formações rochosas, com ar de praia escondida para quem busca calma longe do movimento.' },
          { texto: 'Um dos pontos de mergulho e snorkel mais procurados da ilha: um aquário natural a céu aberto onde é comum cruzar com tartarugas, raias e até algum tubarão. Ali descansam os restos do Navio Elefante, um naufrágio transformado em recife, e também é o ponto de partida da maioria dos passeios de barco.' },
        ],
      },
    },
  },
  en: {
    porto: {
      descripcion: 'Famous for its natural pools and crystal-clear water. One of the best beaches in Brazil.',
      contenido: {
        intro: 'Porto de Galinhas is the most visited beach in Pernambuco, in the municipality of Ipojuca, about 50 km from Recife. It owes its fame to a coral reef almost 700 meters long running parallel to the coast: when the tide goes out, the water trapped between the sand and the reef forms natural pools of warm, clear water.',
        pullQuote: 'The reef is the wall, low tide does the rest: a pool appears that nobody built.',
        datos: [
          { titulo: 'Getting there', texto: 'About 50 km from Recife Airport, roughly an hour by car on the PE-009 highway.' },
          { titulo: 'Natural pools', texto: 'They form between the sand and a coral reef almost 700 meters long. They’re best at mid or low tide.' },
          { titulo: 'Reaching the pools', texto: 'By jangada, the traditional local sailboat — you don’t need to know how to swim. Swimming out on your own requires good fitness.' },
          { titulo: 'Best time to go', texto: 'Sep–Mar: dry season. Apr–Aug: rainy season, heaviest from May to July (though showers are usually short).' },
          { titulo: 'Protect the reef', texto: 'Stepping on the coral is forbidden: it’s fragile and dies on contact. Water shoes are recommended because of sea urchins.' },
          { titulo: 'A name with history', texto: 'It dates back to colonial times: after the slave trade was banned, those who kept doing it in secret used the code phrase "there are new chickens in the port" to alert buyers.' },
        ],
        fotoSecundaria: {
          titulo: 'The feirinha at night',
          texto: 'When the sun goes down, the village’s main street fills with stalls selling crafts, clothes and food — the classic stroll after a day at the beach, with colorful umbrellas as the town’s signature.',
        },
        epoca: {
          temporadas: [
            { titulo: 'September to March', subtitulo: 'The season we recommend', texto: 'Dry season, with more sun and clear skies — temperatures between 26° and 32°C, ideal for spending the day at the natural pools.' },
            { titulo: 'April to August', subtitulo: 'Rainy season', texto: 'Rain usually comes in short spells with sunshine in between; the wettest months are May, June and July. The sea is still fine for the natural pools, but with fewer sunny days.' },
          ],
        },
        actividad: {
          titulo: 'The natural pools',
          texto: 'They’re the postcard image of Porto de Galinhas: the reef breaks the waves and leaves a mirror of warm, clear water, with hundreds of colorful fish swimming alongside bathers. You get there by jangada — the handmade sailboat run by local jangadeiros — a trip of about 40 minutes that doesn’t require swimming. Before getting in, many operators show a short environmental awareness video: walking on the coral is forbidden because it damages it, so go in carefully and, if possible, wear water shoes.',
          checklist: [
            'Warm water all year round, around 29°C.',
            'No need to swim: the jangada takes you there and back.',
            'Hundreds of reef fish swimming right next to you.',
          ],
        },
        banner: {
          texto: 'Porto de Galinhas has been voted "Best Beach in Brazil" several times by readers of Viagem & Turismo magazine — and the colorful jangadas along the shore are part of the reason.',
        },
        galeria: [
          { alt: 'Boats on the reef at Porto de Galinhas' },
        ],
        cierre: [
          { titulo: 'Getting around', texto: 'Besides the jangadas to the pools, buggy rides are a classic way to see the coast: one trip can take in Maracaípe, Cupe, Muro Alto and the natural pools.' },
          { titulo: 'An easy destination', texto: 'Unlike other destinations in the Northeast, Porto de Galinhas has no visitor caps or entry fees: you can drive from Recife the same day, and there’s accommodation for every budget.' },
        ],
        cierreTexto: 'Between the reef, the sand and the evening feirinha, Porto de Galinhas has the perfect pace to switch off without any logistical hassle.',
        playasDestacadas: [
          { texto: 'The heart of the village: this is where the jangada trips to the natural pools start, with the sand full of colorful umbrellas. It’s the ideal base for the rest of your outings.' },
          { texto: 'Its natural pool, sheltered by a reef about 150 meters offshore, is among the largest in Latin America (over 2 km). Calm, warm water, ideal for families with children.' },
          { texto: 'In the neighboring municipality of Tamandaré, with calm water sheltered by reefs and a small white chapel facing the sea as its postcard. It’s visited on a day trip combining beach, river and mangroves.' },
        ],
        playasMas: [
          { texto: 'With stronger waves than the rest of the area, it’s a favorite with surfers. Pontal do Cupe, a more sheltered stretch, also has its own natural pools at low tide.' },
          { texto: 'The wildest and least crowded beach on the circuit, with the strongest surf — the best place to surf near Porto de Galinhas.' },
        ],
      },
    },
    maragogi: { descripcion: 'The "Brazilian Caribbean". Coral reefs and natural pools of turquoise water.' },
    maceio: { descripcion: 'Capital of Alagoas. City beaches, coconut palms and the famous natural pools of Pajuçara.' },
    pipa: { descripcion: 'A bohemian village with cliffs, dolphins and the best surfing in the Northeast.' },
    noronha: {
      descripcion: 'A protected archipelago. The best diving and snorkeling in Brazil, with dolphins and turtles.',
      contenido: {
        intro: 'Fernando de Noronha is a volcanic archipelago off the coast of Pernambuco, declared a UNESCO Natural World Heritage Site. It’s just over an hour’s flight from Recife or Natal, but there the pace changes completely: the island limits the number of visitors per day, so its beaches and reefs remain almost untouched.',
        pullQuote: 'In Noronha we aren’t visitors: we are nature’s guests.',
        datos: [
          { titulo: 'Getting there', texto: 'There are no direct flights: you arrive on a domestic connection within Brazil, via Recife or Natal.' },
          { titulo: 'Preservation fee (TPA)', texto: 'Charged per day of your stay, paid online or on arrival at the airport, and it funds the island’s conservation.' },
          { titulo: 'Marine National Park', texto: 'A separate pass — with a QR code — gives access to beaches and protected areas such as Baía do Sancho.' },
          { titulo: 'Best time to go', texto: 'Jun–Nov: calm sea and maximum clarity, ideal for diving. Nov–May: big waves and surfing arrive.' },
          { titulo: 'Is it expensive?', texto: 'Yes, and it’s worth knowing before you go: it’s a remote island, almost everything arrives by boat or plane, and that makes a stay more expensive.' },
          { titulo: 'Limited access', texto: 'The island controls the number of tourists and daily flights, so it’s best to book well in advance.' },
        ],
        caro: {
          intro: 'Noronha is not a budget destination, and it’s important to know that before you travel. But it’s worth every penny: it’s not like anywhere else.',
          porQue: 'It’s a remote island with controlled access, and almost everything consumed there arrives by boat or plane. That raises the cost of goods, services and all the logistics — the same reason this paradise is so well preserved. On top of that come the mandatory environmental fee (per day of stay) and the National Park pass, required for several of the most famous beaches.',
          cierre: 'Understanding this from the start helps you travel with realistic expectations and appreciate the island’s experience even more.',
        },
        tasas: {
          items: [
            { titulo: '1) TPA — Daily environmental preservation fee', texto: 'Mandatory for all visitors and charged per day spent on the island. It can be paid online, through the archipelago government’s official website, or directly at the airport on arrival.' },
            { titulo: '2) Marine National Park entry (ICMBio fee)', texto: 'This pass is required to visit beaches, trails and protected areas within the Marine National Park. It’s bought online and you receive a QR code to show during your visits.' },
          ],
          boton: { texto: 'See entry and fees' },
        },
        fotoSecundaria: {
          titulo: 'Arriving in Noronha',
          texto: 'Getting there is already part of the experience: on final approach, the view from the window shows Morro Dois Irmãos and the island’s first beaches.',
        },
        epoca: {
          temporadas: [
            { titulo: 'June to November', subtitulo: 'The season we recommend', texto: 'The sea is calmer and reaches impressive clarity, the perfect setting for diving, snorkeling and taking in the island’s nature without the swell.' },
            { titulo: 'November to May', subtitulo: 'Wave and surf season', texto: 'The sea changes and big waves arrive, with competitions that draw surfers from around the world. It’s not the ideal time if your priority is the calm, crystal-clear sea Noronha is known for.' },
          ],
        },
        actividad: {
          titulo: 'A diving paradise',
          texto: 'Noronha is recognized worldwide as one of the best diving destinations on the planet. Underwater you’ll find giant turtles, rays, colorful schools of fish, moray eels, lobsters, barracudas, sharks (nurse and lemon) and dolphins, plus shipwrecks turned into artificial reefs, caves, tunnels and other underwater rock formations. And you don’t need to be an experienced diver: the island’s dive operators guide you every step of the way so that, even if it’s your first time, the experience is safe, guided and unforgettable.',
          checklist: [
            'Unmatched visibility: up to 50 meters in some spots.',
            'Warm water all year round: no wetsuit needed.',
            'Stunning biodiversity: exotic and abundant marine life.',
          ],
          niveles: 'There are options for every level: discovery dives for first-timers (with an instructor from the very first minute, at safe, shallow sites), recreational dives for certified divers, and technical and advanced trips for those seeking more depth, such as the wreck of the Corveta Ipiranga at 62 meters. And if scuba isn’t for you, some of the world’s best snorkeling spots show almost the same marine life from the surface.',
        },
        banner: {
          texto: 'Swimming near spinner dolphins is one of the island’s most sought-after experiences: they arrive in pods every morning to rest in Baía dos Golfinhos.',
        },
        galeria: [
          { alt: 'Baía do Sancho, Fernando de Noronha' },
          { alt: 'Sunset by Morro Dois Irmãos, Fernando de Noronha' },
          { alt: 'Aerial view of a beach in Fernando de Noronha' },
          { alt: 'Morro do Pico seen from the beach, Fernando de Noronha' },
          { alt: 'Natural pool in the rocks of Fernando de Noronha' },
          { alt: 'View of the Fernando de Noronha coastline' },
        ],
        videos: [
          { titulo: 'Diving in Noronha' },
          { titulo: 'Diving in Noronha' },
          { titulo: 'Diving in Noronha' },
        ],
        cierre: [
          { titulo: 'Where you’ll stay', texto: 'Unlike other destinations in the Northeast, Noronha has no large beachfront resorts: the island puts conservation ahead of hotel development. Most places are family-run inns in converted houses, from more exclusive boutique options to mid-range choices near the center (ideal for going out at night) and simpler, quieter ones. Reaching some beaches involves a short walk, and that’s part of the experience too.', whatsappMensaje: "Hi! I'd like a quote for accommodation in Fernando de Noronha", boton: 'Get an accommodation quote' },
          { titulo: 'A destination that needs planning', texto: 'Noronha isn’t a mass-tourism destination: visitor numbers are capped, there are few flights a day and its own procedures (environmental fee, park pass). Coming from outside Brazil means at least two domestic flights — for example, connecting in São Paulo or Recife — so it’s worth planning your itinerary carefully and booking early.' },
        ],
        cierreTexto: 'Understanding all this before you travel is no small detail: it’s what turns Noronha into much more than a beach destination — a transformative experience.',
        playasDestacadas: [
          { texto: 'Voted the best beach in the world 7 times. The emerald green of the cliffs blends with the turquoise sea and golden sand — a landscape that’s hard to believe is real. You reach it down stairs carved into the rock or on boat trips, and it’s part of the Marine National Park: you need the park pass to visit.' },
          { texto: 'A few minutes from the center, with Morro do Pico — the island’s highest rock formation — dominating the backdrop. One of the best places in Noronha to watch the sunset, with natural pools at low tide (it can only be reached on foot at low tide).' },
          { texto: 'With Morro Dois Irmãos — the ultimate symbol of Noronha — as its backdrop, it’s a surfers’ paradise: from December to March big waves arrive, drawing surfers from all over the world. The rest of the year the sea calms down, ideal for swimming or simply walking along the shore. Its sunsets, with the sky painted orange, pink and violet behind the hills, are among the most beautiful on the island.' },
          { texto: 'The closest to the historic center — for many travelers, their first contact with Noronha’s sea. Its name comes from an old stone fountain shaped like a dog’s head. It has natural pools among the rocks at low tide, the most famous being Buraco do Galego: a hidden corner of water so clear you can see every detail of the bottom.' },
        ],
        playasMas: [
          { texto: 'Between Praia do Cachorro and Praia da Conceição, it’s the smallest and quietest along that stretch of coast: surrounded by rock formations, with the feel of a hidden beach for those seeking calm away from the crowds.' },
          { texto: 'One of the island’s most popular diving and snorkeling spots: an open-air natural aquarium where turtles, rays and even the odd shark are common. The remains of the Navio Elefante, a wreck turned reef, lie here, and it’s also the starting point for most boat trips.' },
        ],
      },
    },
  },
}

// Mezcla la traducción sobre el original: listas por posición, objetos por clave
function mezclar(base, trad) {
  if (trad === undefined || trad === null) return base
  if (Array.isArray(base)) return base.map((b, i) => mezclar(b, trad[i]))
  if (base && typeof base === 'object') {
    const out = {}
    for (const k of Object.keys(base)) out[k] = mezclar(base[k], trad[k])
    return out
  }
  return trad
}

const cache = {}

// Lista de destinos en el idioma pedido (mismo armado que `destinos` de mockData.js)
export function destinosEn(lang) {
  if (!TRADUCCIONES[lang]) return destinos
  if (!cache[lang]) cache[lang] = destinos.map(d => mezclar(d, TRADUCCIONES[lang][d.id]))
  return cache[lang]
}
